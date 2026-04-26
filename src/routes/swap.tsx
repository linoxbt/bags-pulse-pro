import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { ArrowUpDown, Loader2, Sparkles, Wallet } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useConnection, useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { getSwapQuote, buildSwapTransaction, type SwapQuote } from "@/server/swap";
import { SOL_MINT, USDC_MINT, BAGSPULSE_TREASURY, PULSEROUTER_PROTOCOL_BPS } from "@/lib/constants";
import { toast } from "sonner";
import { shortAddress } from "@/lib/format";

const searchSchema = z.object({
  inputMint: z.string().optional(),
  outputMint: z.string().optional(),
});

export const Route = createFileRoute("/swap")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Swap — BagsPulse" },
      {
        name: "description",
        content: "Swap any SPL token via Jupiter aggregator. PulseRouter routes a 0.5% protocol fee to creators + treasury.",
      },
    ],
  }),
  component: SwapPage,
});

function SwapPage() {
  const search = Route.useSearch();
  const wallet = useWallet();
  const solana = useSolanaWallet();
  const { connection } = useConnection();
  const [inMint, setInMint] = useState(search.inputMint || SOL_MINT);
  const [outMint, setOutMint] = useState(search.outputMint || USDC_MINT);
  const [amount, setAmount] = useState("0.1");
  const [slippageBps, setSlippageBps] = useState(100);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  // Best-effort decimals: SOL=9, most SPL=6 (we don't fetch every mint here)
  const inDecimals = inMint === SOL_MINT ? 9 : 6;
  const outDecimals = outMint === SOL_MINT ? 9 : 6;
  const lamports = Math.floor(Number(amount || 0) * 10 ** inDecimals);

  useEffect(() => {
    if (!lamports || lamports <= 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const t = setTimeout(() => {
      getSwapQuote({ data: { inputMint: inMint, outputMint: outMint, amount: lamports, slippageBps } })
        .then((res) => {
          if (cancelled) return;
          setQuote(res.quote);
          if (res.error) toast.error(res.error);
        })
        .finally(() => !cancelled && setQuoting(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [inMint, outMint, lamports, slippageBps]);

  function flip() {
    setInMint(outMint);
    setOutMint(inMint);
    setQuote(null);
  }

  async function executeSwap() {
    if (!quote || !solana.publicKey || !solana.signTransaction) {
      toast.error("Connect a wallet first");
      return;
    }
    setSwapping(true);
    setSignature(null);
    try {
      const { swapTransaction, error } = await buildSwapTransaction({
        data: { quote, userPublicKey: solana.publicKey.toBase58() },
      });
      if (!swapTransaction) throw new Error(error ?? "Could not build swap transaction");

      const { VersionedTransaction } = await import("@solana/web3.js");
      const buf = Uint8Array.from(atob(swapTransaction), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(buf);
      const signed = await solana.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction(sig, "confirmed");
      setSignature(sig);
      toast.success("Swap confirmed", { description: sig.slice(0, 16) + "…" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSwapping(false);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Swap</p>
          <h1 className="text-3xl font-semibold tracking-tight">Best-route swap powered by Jupiter</h1>
          <p className="text-muted-foreground text-sm">
            PulseRouter routes a {(PULSEROUTER_PROTOCOL_BPS / 100).toFixed(2)}% protocol fee to the BagsPulse treasury on
            every swap — funding creator rewards and infrastructure.
          </p>
        </header>

        <Card className="bg-card/60">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Build a route
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>You pay</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="font-mono text-lg"
                />
                <Input
                  value={inMint}
                  onChange={(e) => setInMint(e.target.value.trim())}
                  className="font-mono text-xs"
                  placeholder="Input mint"
                />
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                {inMint === SOL_MINT ? "Native SOL" : `Mint: ${shortAddress(inMint)}`}
              </p>
            </div>

            <div className="flex justify-center">
              <Button variant="outline" size="icon" onClick={flip} className="rounded-full">
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label>You receive (estimated)</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={
                    quote ? (Number(quote.outAmount) / 10 ** outDecimals).toFixed(6) : quoting ? "…" : "0"
                  }
                  className="font-mono text-lg bg-secondary/30"
                />
                <Input
                  value={outMint}
                  onChange={(e) => setOutMint(e.target.value.trim())}
                  className="font-mono text-xs"
                  placeholder="Output mint"
                />
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                {outMint === SOL_MINT ? "Native SOL" : `Mint: ${shortAddress(outMint)}`}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Slippage — {(slippageBps / 100).toFixed(2)}%</Label>
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={slippageBps}
                onChange={(e) => setSlippageBps(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            {quote && (
              <div className="rounded-md bg-secondary/30 p-3 text-xs space-y-1.5">
                <Stat label="Route hops" value={String(quote.routePlan.length)} />
                <Stat label="Price impact" value={`${Number(quote.priceImpactPct).toFixed(2)}%`} />
                <Stat
                  label="PulseRouter fee"
                  value={`${(quote.protocolFeeBps / 100).toFixed(2)}% → ${shortAddress(quote.protocolFeeRecipient)}`}
                />
              </div>
            )}

            {wallet.authenticated ? (
              <Button
                onClick={executeSwap}
                disabled={!quote || quoting || swapping}
                className="w-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground"
              >
                {swapping ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Swapping…
                  </>
                ) : (
                  <>
                    <Wallet className="h-4 w-4" /> Execute swap
                  </>
                )}
              </Button>
            ) : (
              <ConnectWallet size="default" full />
            )}

            {signature && (
              <p className="text-xs text-success font-mono break-all">
                Confirmed:{" "}
                <a
                  href={`https://solscan.io/tx/${signature}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {signature}
                </a>
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground font-mono">
          Treasury · {BAGSPULSE_TREASURY.slice(0, 8)}…{BAGSPULSE_TREASURY.slice(-6)} · routes via Jupiter (Meteora, Orca, Raydium, etc.)
        </p>
      </div>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
