import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Wallet, CheckCircle2, AlertCircle, Coins } from "lucide-react";
import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useSafeSignTransaction } from "@/hooks/useSafeSignTransaction";
import { ConnectWallet } from "./ConnectWallet";
import {
  getClaimablePositions,
  buildClaimTransaction,
  recordFeeClaim,
  type ClaimablePosition,
} from "@/server/bagsrouter";
import { Connection, VersionedTransaction, Transaction } from "@solana/web3.js";
import { getHeliusEndpoints } from "@/server/helius";
import { formatUsd } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getMyLicenseTier, tierAtLeast, type LicenseSummary } from "@/server/licenses";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Info } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClaimFeesDialog({ open, onOpenChange }: Props) {
  const wallet = useWallet();
  const signer = useSafeSignTransaction();
  const [positions, setPositions] = useState<ClaimablePosition[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [claiming, setClaiming] = useState(false);
  const [license, setLicense] = useState<LicenseSummary | null>(null);

  useEffect(() => {
    if (!open || !wallet.address) return;
    setLoading(true);
    
    // Parallel load positions and license
    Promise.all([
      getClaimablePositions({ data: { wallet: wallet.address } }),
      getMyLicenseTier()
    ]).then(([posRes, licRes]) => {
      setPositions(posRes.positions);
      setLive(posRes.live);
      setLicense(licRes);
      
      // If Pro/Elite, default select all. If Starter, select top 1.
      if (posRes.positions.length > 0) {
        if (licRes.tier === "starter") {
          setSelected(new Set([posRes.positions[0].mint]));
        } else {
          setSelected(new Set(posRes.positions.map((p) => p.mint)));
        }
      }
      setLoading(false);
    });
  }, [open, wallet.address]);

  const total = positions
    .filter((p) => selected.has(p.mint))
    .reduce((s, p) => s + p.amountUsd, 0);

  function toggle(mint: string) {
    const next = new Set(selected);
    if (next.has(mint)) {
      next.delete(mint);
    } else {
      // Enforce Starter limit
      if (license?.tier === "starter" && selected.size >= 1) {
        toast.info("Upgrade to Pro for batch claiming", {
          description: "Starter tier can only claim one position at a time.",
          action: {
            label: "Upgrade",
            onClick: () => (window.location.href = "/pricing"),
          },
        });
        return;
      }
      next.add(mint);
    }
    setSelected(next);
  }

  async function handleClaim() {
    if (!wallet.address) return;
    if (selected.size === 0) {
      toast.error("Select at least one position");
      return;
    }
    setClaiming(true);
    try {
      const mints = Array.from(selected);
      const { transactions, error } = await buildClaimTransaction({
        data: { wallet: wallet.address, mints },
      });

      if (!transactions.length) {
        toast.error("On-chain claim unavailable", { description: error ?? "Bags did not return a claim transaction." });
        setClaiming(false);
        return;
      }

      if (!signer?.signTransaction) {
        toast.error("Wallet not ready to sign");
        setClaiming(false);
        return;
      }

      const ep = await getHeliusEndpoints();
      const conn = new Connection(ep.rpc, "confirmed");
      let sig = "";
      for (const b64 of transactions) {
        const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        try {
          VersionedTransaction.deserialize(buf);
        } catch {
          Transaction.from(buf);
        }
        const { signedTransaction } = await signer.signTransaction({ transaction: buf });
        sig = await conn.sendRawTransaction(signedTransaction, { skipPreflight: false });
        await conn.confirmTransaction(sig, "confirmed");
      }

      // Record
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        for (const mint of mints) {
          const pos = positions.find((p) => p.mint === mint)!;
          await recordFeeClaim({
            data: {
              wallet: wallet.address,
              mint: pos.mint,
              symbol: pos.symbol,
              amount: pos.amount,
              amountUsd: pos.amountUsd,
              txSignature: sig,
            },
          });
        }
      }
      toast.success(`Claimed ${formatUsd(total)}`, { description: `tx ${sig.slice(0, 12)}…` });
      onOpenChange(false);
    } catch (e) {
      toast.error("Claim failed", { description: (e as Error).message });
    } finally {
      setClaiming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" /> Claim creator fees
            </DialogTitle>
            {license && (
              <Badge variant="outline" className={cn(
                "capitalize font-mono text-[10px] px-1.5 py-0",
                license.tier === "elite" ? "border-accent text-accent bg-accent/5" :
                license.tier === "pro" ? "border-primary text-primary bg-primary/5" : 
                "border-muted text-muted-foreground"
              )}>
                {license.tier} Plan
              </Badge>
            )}
          </div>
          <DialogDescription>
            {live ? "Live claimable positions from the Bags fee program." : "Connect a wallet with active fees to see claimable positions."}
          </DialogDescription>
        </DialogHeader>

        {!wallet.address ? (
          <div className="py-8 text-center space-y-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              Connect your Solana wallet to load and claim your fees.
            </p>
            <ConnectWallet />
          </div>
        ) : loading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        ) : positions.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
            <p className="text-sm">No claimable fees right now.</p>
          </div>
        ) : (
          <>
            <div className="py-2">
              {license?.tier === "starter" && positions.length > 1 && (
                <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3 flex gap-3 items-start">
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold">Unlock Batch Claiming</p>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      You have {positions.length} positions. Pro & Elite users can claim them all in a single transaction to save time and rent.
                    </p>
                    <Button variant="link" className="h-auto p-0 text-[11px] text-primary" asChild>
                      <Link to="/pricing">Upgrade now →</Link>
                    </Button>
                  </div>
                </div>
              )}
              <ul className="divide-y divide-border/60 max-h-72 overflow-y-auto -mx-2">
                {positions.map((p) => (
                  <li
                    key={p.mint}
                    className={cn(
                      "flex items-center gap-3 px-2 py-3 hover:bg-secondary/30 rounded-md transition",
                      !selected.has(p.mint) && license?.tier === "starter" && selected.size > 0 && "opacity-60"
                    )}
                  >
                    <Checkbox
                      checked={selected.has(p.mint)}
                      onCheckedChange={() => toggle(p.mint)}
                      disabled={!selected.has(p.mint) && license?.tier === "starter" && selected.size >= 1}
                    />
                    <div className="flex-1 min-w-0" onClick={() => toggle(p.mint)}>
                      <p className="font-medium truncate">${p.symbol}</p>
                      <p className="text-[10px] text-muted-foreground truncate uppercase font-mono">{p.mint.slice(0, 4)}…{p.mint.slice(-4)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm">{p.amount.toFixed(4)} SOL</p>
                      <p className="text-xs font-mono text-success">{formatUsd(p.amountUsd)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <DialogFooter className="flex-col sm:flex-row sm:justify-between sm:items-center gap-2 pt-2 border-t border-border/50">
              <div className="space-y-0.5">
                <p className="text-sm text-muted-foreground">
                  Total: <span className="font-mono font-semibold text-foreground">{formatUsd(total)}</span>
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" /> SOL rent will be reclaimed to your wallet
                </p>
              </div>
              <Button
                onClick={handleClaim}
                disabled={claiming || selected.size === 0}
                className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow"
              >
                {claiming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Claiming…
                  </>
                ) : (
                  <>
                    <Wallet className="h-4 w-4" /> 
                    {selected.size > 1 ? `Batch Claim ${selected.size}` : "Claim Position"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
