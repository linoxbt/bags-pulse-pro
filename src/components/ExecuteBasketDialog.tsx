import { useState, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Zap, AlertTriangle, ShieldCheck } from "lucide-react";
import { buildBasketTransactions } from "@/server/swap";
import type { Basket, BasketToken } from "@/server/baskets";
import { getMyLicenseTier } from "@/server/licenses";
import { useQuery } from "@tanstack/react-query";

interface ExecuteBasketDialogProps {
  basket: Basket;
  tokens: BasketToken[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecuteBasketDialog({ basket, tokens, open, onOpenChange }: ExecuteBasketDialogProps) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [solAmount, setSolAmount] = useState("0.1");
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");

  const { data: tier } = useQuery({
    queryKey: ["license-tier"],
    queryFn: () => getMyLicenseTier(),
    enabled: open
  });

  const isPro = tier && (tier.tier === "pro" || tier.tier === "elite");

  const execute = async () => {
    if (!publicKey) return toast.error("Wallet not connected");
    if (tokens.length === 0) return toast.error("Basket is empty");

    const totalLamports = parseFloat(solAmount) * 1_000_000_000;
    if (isNaN(totalLamports) || totalLamports <= 0) return toast.error("Invalid SOL amount");

    setExecuting(true);
    setProgress(0);
    setStatus("Building transactions...");

    try {
      // 1. Calculate allocations
      const items = tokens.map(t => ({
        mint: t.mint,
        amount: Math.floor((totalLamports * t.target_bps) / 10000)
      }));

      // 2. Fetch transactions from server
      const { transactions, errors } = await buildBasketTransactions({
        data: {
          userPublicKey: publicKey.toBase58(),
          items,
          slippageBps: 100 // 1%
        }
      });

      if (errors.length > 0) {
        errors.forEach(err => toast.error(err));
      }

      if (transactions.length === 0) {
        throw new Error("No transactions built");
      }

      setStatus(`Executing ${transactions.length} swaps...`);
      let completed = 0;

      // 3. Send transactions
      // If Pro/Elite, we could try to send in parallel or batch if possible.
      // For now, we do them one by one but in the same loop.
      for (const txBase64 of transactions) {
        const txBuffer = Buffer.from(txBase64, "base64");
        const tx = VersionedTransaction.deserialize(txBuffer);
        
        try {
          const signature = await sendTransaction(tx, connection);
          console.log(`[basket] Tx sent: ${signature}`);
          
          completed++;
          setProgress((completed / transactions.length) * 100);
          setStatus(`Swapped ${completed}/${transactions.length}...`);
          
          // Small delay between pops if not using a "bulk" signer
          if (!isPro) {
            await new Promise(r => setTimeout(r, 1000));
          }
        } catch (err) {
          console.error(`[basket] Tx failed`, err);
          toast.error(`A swap failed, continuing...`);
        }
      }

      toast.success("Basket execution complete!");
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExecuting(false);
      setProgress(0);
      setStatus("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Buy Basket
          </DialogTitle>
          <DialogDescription>
            Allocate SOL across all {tokens.length} tokens in {basket.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Total SOL to invest</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={solAmount}
                onChange={(e) => setSolAmount(e.target.value)}
                disabled={executing}
                className="pr-12 font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                SOL
              </span>
            </div>
          </div>

          {isPro ? (
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-primary">Pro/Elite Benefit</p>
                <p className="text-xs text-muted-foreground">
                  Batched execution enabled. Swaps will be prepared and sent with minimal delays.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-500">Starter Tier</p>
                <p className="text-xs text-muted-foreground">
                  Swaps will be sent sequentially with a delay. Upgrade to Pro for instant batching.
                </p>
              </div>
            </div>
          )}

          {executing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span>{status}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={executing}>
            Cancel
          </Button>
          <Button onClick={execute} disabled={executing || !publicKey}>
            {executing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Executing...
              </>
            ) : (
              "Confirm & Buy"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
