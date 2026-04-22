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
import { useWallets } from "@privy-io/react-auth/solana";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClaimFeesDialog({ open, onOpenChange }: Props) {
  const wallet = useWallet();
  const signer = useSafeSignTransaction();
  const { wallets } = useWallets();
  const [positions, setPositions] = useState<ClaimablePosition[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!open || !wallet.address) return;
    setLoading(true);
    getClaimablePositions({ data: { wallet: wallet.address } }).then((res) => {
      setPositions(res.positions);
      setLive(res.live);
      setSelected(new Set(res.positions.map((p) => p.mint)));
      setLoading(false);
    });
  }, [open, wallet.address]);

  const total = positions
    .filter((p) => selected.has(p.mint))
    .reduce((s, p) => s + p.amountUsd, 0);

  function toggle(mint: string) {
    const next = new Set(selected);
    if (next.has(mint)) next.delete(mint);
    else next.add(mint);
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
      const { transaction, error } = await buildClaimTransaction({
        data: { wallet: wallet.address, mints },
      });

      if (!transaction) {
        toast.error("On-chain claim unavailable", { description: error ?? "Bags did not return a claim transaction." });
        setClaiming(false);
        return;
      }

      const solanaWallet = wallets.find((w) => w.address === wallet.address) ?? wallets[0];
      if (!signer?.signTransaction || !solanaWallet) {
        toast.error("Wallet not ready to sign");
        setClaiming(false);
        return;
      }

      // Decode the unsigned tx returned by Bags into raw bytes for Privy
      const buf = Uint8Array.from(atob(transaction), (c) => c.charCodeAt(0));
      // Validate it deserializes (versioned or legacy) — sanity check
      try {
        VersionedTransaction.deserialize(buf);
      } catch {
        Transaction.from(buf);
      }

      const ep = await getHeliusEndpoints();
      const conn = new Connection(ep.rpc, "confirmed");
      const { signedTransaction } = await signer.signTransaction({
        transaction: buf,
        wallet: solanaWallet,
        chain: "solana:mainnet",
      });
      const sig = await conn.sendRawTransaction(signedTransaction, { skipPreflight: false });
      await conn.confirmTransaction(sig, "confirmed");

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
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" /> Claim creator fees
          </DialogTitle>
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
            <ul className="divide-y divide-border/60 max-h-72 overflow-y-auto -mx-2">
              {positions.map((p) => (
                <li
                  key={p.mint}
                  className="flex items-center gap-3 px-2 py-3 hover:bg-secondary/30 rounded-md"
                >
                  <Checkbox
                    checked={selected.has(p.mint)}
                    onCheckedChange={() => toggle(p.mint)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">${p.symbol}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">{p.amount.toFixed(4)} SOL</p>
                    <p className="text-xs font-mono text-success">{formatUsd(p.amountUsd)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <DialogFooter className="flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-mono font-semibold text-foreground">{formatUsd(total)}</span>
              </p>
              <Button
                onClick={handleClaim}
                disabled={claiming || selected.size === 0}
                className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground"
              >
                {claiming ? <><Loader2 className="h-4 w-4 animate-spin" /> Claiming…</> : <><Wallet className="h-4 w-4" /> Claim {selected.size} position{selected.size === 1 ? "" : "s"}</>}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
