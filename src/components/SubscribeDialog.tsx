import { useState } from "react";
import { useWallet as useSolanaWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { BAGSPULSE_TREASURY, TIER_STRATEGY_ID } from "@/lib/constants";
import type { PricingTier, PaymentCurrency } from "@/lib/constants";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tier: PricingTier | null;
  currency: PaymentCurrency;
  solUsd: number;
}

// On-chain subscription payment. Sends SystemProgram.transfer of SOL from the
// connected wallet to the BagsPulse treasury, then registers the strategy
// license via /api/licenses/confirm. License unlocks the matching tier.
export function SubscribeDialog({ open, onOpenChange, tier, currency, solUsd }: Props) {
  const { publicKey, sendTransaction } = useSolanaWallet();
  const { connection } = useConnection();
  const [submitting, setSubmitting] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const priceUsd = tier?.priceUsd ?? 0;
  const priceSol = solUsd > 0 ? priceUsd / solUsd : 0;

  async function pay() {
    if (!tier || !publicKey) {
      toast.error("Connect your wallet first");
      return;
    }
    if (currency !== "SOL") {
      toast.message("USDC/USDT payments coming soon", {
        description: "For now please pay in SOL.",
      });
      return;
    }
    setSubmitting(true);
    setSignature(null);
    try {
      const { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
      const treasury = new PublicKey(BAGSPULSE_TREASURY);
      const lamports = Math.floor(priceSol * LAMPORTS_PER_SOL);
      if (lamports <= 0) throw new Error("Could not compute SOL amount");

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasury,
          lamports,
        }),
      );
      const sig = await sendTransaction(tx, connection);
      setSignature(sig);

      try {
        await connection.confirmTransaction(sig, "confirmed");
      } catch {
        /* server will re-verify */
      }

      const strategyId = TIER_STRATEGY_ID[tier.id];
      const res = await fetch("/api/licenses/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: publicKey.toBase58(),
          strategy_id: strategyId,
          payment_tx: sig,
          amount_sol: priceSol,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "License confirm failed");
      }
      toast.success(`Welcome to ${tier.name}!`, {
        description: "Your subscription is active for 30 days.",
      });
    } catch (err) {
      toast.error((err as Error).message ?? "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subscribe to {tier?.name}</DialogTitle>
          <DialogDescription>
            Pay on Solana mainnet. Funds settle directly with the BagsPulse treasury — no credit cards, no middlemen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{tier?.name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price (USD)</span>
              <span className="font-mono">${priceUsd.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-mono">
                {currency === "SOL" ? `${priceSol.toFixed(4)} SOL` : `${priceUsd.toFixed(2)} ${currency}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Treasury</span>
              <span className="font-mono truncate ml-2">6CxhRUpZ…BaEzhd</span>
            </div>
          </div>
          {signature && (
            <div className="rounded-md border border-success/30 bg-success/10 p-3 text-xs flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-success font-medium">Transaction submitted</p>
                <a
                  href={`https://solscan.io/tx/${signature}`}
                  target="_blank"
                  rel="noopener"
                  className="text-primary hover:underline font-mono inline-flex items-center gap-1 truncate"
                >
                  {signature.slice(0, 16)}… <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={pay}
            disabled={submitting || !publicKey || !tier}
            className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Confirming…
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" />
                Pay {currency === "SOL" ? `${priceSol.toFixed(4)} SOL` : `${priceUsd.toFixed(2)} ${currency}`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
