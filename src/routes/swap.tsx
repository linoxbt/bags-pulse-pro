import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ChevronDown,
  Loader2,
  Search,
  Settings2,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useConnection, useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import {
  getSwapQuote,
  buildSwapTransaction,
  prepareFeeAccount,
  listJupiterTokens,
  getJupiterPrices,
  resolveMint,
  type SwapQuote,
  type JupToken,
} from "@/server/swap";
import {
  SOL_MINT,
  USDC_MINT,
  BAGSPULSE_TREASURY,
  PULSEROUTER_PROTOCOL_BPS,
} from "@/lib/constants";
import { toast } from "sonner";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

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
        content:
          "Best-route swap for every SPL token on Solana. Powered by Jupiter, a 0.5% PulseRouter fee funds the BagsPulse treasury.",
      },
    ],
  }),
  loader: () => listJupiterTokens(),
  component: SwapPage,
});

function SwapPage() {
  const search = Route.useSearch();
  const initial = Route.useLoaderData() as { tokens: JupToken[] };

  const wallet = useWallet();
  const solana = useSolanaWallet();
  const { connection } = useConnection();

  const [tokens, setTokens] = useState<JupToken[]>(initial.tokens);

  const findInitial = (mint: string, fallback: JupToken): JupToken =>
    tokens.find((t) => t.address === mint) ?? fallback;

  const SOL_FALLBACK: JupToken = {
    address: SOL_MINT,
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    tags: ["verified"],
    daily_volume: null,
  };
  const USDC_FALLBACK: JupToken = {
    address: USDC_MINT,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    tags: ["verified"],
    daily_volume: null,
  };

  const [inToken, setInToken] = useState<JupToken>(
    findInitial(search.inputMint ?? SOL_MINT, SOL_FALLBACK),
  );
  const [outToken, setOutToken] = useState<JupToken>(
    findInitial(search.outputMint ?? USDC_MINT, USDC_FALLBACK),
  );
  const [amount, setAmount] = useState("0.1");
  const [slippageBps, setSlippageBps] = useState(100);
  const [slippageOpen, setSlippageOpen] = useState(false);

  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pickerSide, setPickerSide] = useState<"in" | "out" | null>(null);

  const lamports = Math.floor(Number(amount || 0) * 10 ** inToken.decimals);

  // Load USD prices for the displayed pair
  useEffect(() => {
    getJupiterPrices({ data: { mints: [inToken.address, outToken.address] } })
      .then((res) => setPrices((p) => ({ ...p, ...res.prices })))
      .catch(() => {});
  }, [inToken.address, outToken.address]);

  useEffect(() => {
    if (!lamports || lamports <= 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const t = setTimeout(() => {
      getSwapQuote({
        data: {
          inputMint: inToken.address,
          outputMint: outToken.address,
          amount: lamports,
          slippageBps,
        },
      })
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
  }, [inToken.address, outToken.address, lamports, slippageBps]);

  function flip() {
    const prevIn = inToken;
    setInToken(outToken);
    setOutToken(prevIn);
    setQuote(null);
  }

  const outAmountUi = quote
    ? Number(quote.outAmount) / 10 ** outToken.decimals
    : 0;
  const inUsd = (Number(amount) || 0) * (prices[inToken.address] ?? 0);
  const outUsd = outAmountUi * (prices[outToken.address] ?? 0);

  async function executeSwap() {
    if (!quote || !solana.publicKey || !solana.signTransaction) {
      toast.error("Connect a wallet first");
      return;
    }
    setSwapping(true);
    setSignature(null);
    try {
      const { VersionedTransaction, Transaction } = await import("@solana/web3.js");
      const payer = solana.publicKey.toBase58();

      const prep = await prepareFeeAccount({
        data: { outputMint: outToken.address, payer },
      });
      if (!prep.exists && prep.createTx) {
        const cbuf = Uint8Array.from(atob(prep.createTx), (c) => c.charCodeAt(0));
        const ctx = Transaction.from(cbuf);
        const csigned = await solana.signTransaction(ctx);
        const csig = await connection.sendRawTransaction(csigned.serialize(), {
          skipPreflight: false,
        });
        await connection.confirmTransaction(csig, "confirmed");
      }

      const { swapTransaction, error } = await buildSwapTransaction({
        data: { quote, userPublicKey: payer, feeAccount: prep.feeAccount },
      });
      if (!swapTransaction) throw new Error(error ?? "Could not build swap transaction");

      const buf = Uint8Array.from(atob(swapTransaction), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(buf);
      const signed = await solana.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      await connection.confirmTransaction(sig, "confirmed");
      setSignature(sig);
      toast.success("Swap confirmed", { description: sig.slice(0, 16) + "…" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSwapping(false);
    }
  }

  const routeHops = useMemo(() => {
    if (!quote) return [];
    try {
      const plan = JSON.parse(quote.routePlan) as Array<{
        swapInfo?: { label?: string };
      }>;
      return plan.map((p) => p.swapInfo?.label || "DEX").slice(0, 6);
    } catch {
      return [];
    }
  }, [quote]);

  return (
    <PageShell>
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-10 space-y-5">
        <header className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary">
              <Sparkles className="h-3 w-3" /> PulseRouter · Jupiter
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Swap</h1>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSlippageOpen(true)}
            aria-label="Slippage settings"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </header>

        <Card className="bg-card/60 overflow-visible">
          <CardContent className="p-4 space-y-2">
            {/* YOU PAY */}
            <TokenPanel
              label="You pay"
              token={inToken}
              amount={amount}
              onAmountChange={setAmount}
              usd={inUsd}
              onPick={() => setPickerSide("in")}
              editable
            />

            {/* FLIP */}
            <div className="relative h-0">
              <button
                onClick={flip}
                className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-10 rounded-full border border-border bg-background p-2 shadow hover:bg-secondary transition"
                aria-label="Flip"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>

            {/* YOU RECEIVE */}
            <TokenPanel
              label="You receive"
              token={outToken}
              amount={quote ? outAmountUi.toFixed(6) : quoting ? "…" : "0"}
              usd={outUsd}
              onPick={() => setPickerSide("out")}
              editable={false}
              loading={quoting}
            />

            {/* QUOTE DETAILS */}
            {quote && (
              <div className="mt-3 rounded-lg bg-secondary/30 p-3 text-xs space-y-1.5">
                <Row
                  label="Rate"
                  value={`1 ${inToken.symbol} ≈ ${(
                    outAmountUi / Math.max(1, Number(amount) || 1)
                  ).toFixed(6)} ${outToken.symbol}`}
                />
                <Row
                  label="Price impact"
                  value={`${Number(quote.priceImpactPct).toFixed(2)}%`}
                  warn={Math.abs(Number(quote.priceImpactPct)) > 1}
                />
                <Row label="Min received" value={`${(Number(quote.otherAmountThreshold) / 10 ** outToken.decimals).toFixed(6)} ${outToken.symbol}`} />
                <Row
                  label="PulseRouter fee"
                  value={`${(quote.protocolFeeBps / 100).toFixed(2)}% → ${shortAddress(quote.protocolFeeRecipient)}`}
                />
                {routeHops.length > 0 && (
                  <Row
                    label={`Route (${routeHops.length})`}
                    value={routeHops.join(" → ")}
                  />
                )}
              </div>
            )}

            {wallet.authenticated ? (
              <Button
                onClick={executeSwap}
                disabled={!quote || quoting || swapping}
                size="lg"
                className="mt-3 w-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground"
              >
                {swapping ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Swapping…
                  </>
                ) : (
                  <>
                    <Wallet className="h-4 w-4" /> Swap
                  </>
                )}
              </Button>
            ) : (
              <div className="mt-3">
                <ConnectWallet size="default" full />
              </div>
            )}

            {signature && (
              <p className="text-xs text-success font-mono break-all pt-2">
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

        <p className="text-center text-[11px] text-muted-foreground font-mono">
          Treasury · {BAGSPULSE_TREASURY.slice(0, 8)}…{BAGSPULSE_TREASURY.slice(-6)} ·
          {" "}Routes aggregated by Jupiter across Meteora, Orca, Raydium, Phoenix, Lifinity…
        </p>
      </div>

      <TokenPickerDialog
        open={pickerSide !== null}
        onOpenChange={(o) => !o && setPickerSide(null)}
        tokens={tokens}
        onSelect={(t) => {
          if (pickerSide === "in") setInToken(t);
          else if (pickerSide === "out") setOutToken(t);
          setPickerSide(null);
          setQuote(null);
        }}
        onResolveExternal={async (mint) => {
          const res = await resolveMint({ data: { mint } });
          if (res.token) {
            setTokens((prev) =>
              prev.find((t) => t.address === res.token!.address)
                ? prev
                : [res.token!, ...prev],
            );
          }
          return res.token;
        }}
      />

      <Dialog open={slippageOpen} onOpenChange={setSlippageOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Slippage tolerance</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              {[50, 100, 300, 500].map((bps) => (
                <Button
                  key={bps}
                  variant={slippageBps === bps ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSlippageBps(bps)}
                  className="flex-1"
                >
                  {(bps / 100).toFixed(1)}%
                </Button>
              ))}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Custom: {(slippageBps / 100).toFixed(2)}%</p>
              <input
                type="range"
                min={10}
                max={1000}
                step={10}
                value={slippageBps}
                onChange={(e) => setSlippageBps(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              PulseRouter takes {(PULSEROUTER_PROTOCOL_BPS / 100).toFixed(2)}% per swap into
              the BagsPulse treasury — funds creator rewards + infrastructure.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function TokenPanel({
  label,
  token,
  amount,
  onAmountChange,
  onPick,
  usd,
  editable,
  loading,
}: {
  label: string;
  token: JupToken;
  amount: string;
  onAmountChange?: (v: string) => void;
  onPick: () => void;
  usd: number;
  editable: boolean;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl bg-secondary/30 p-4 border border-transparent hover:border-border/50 transition">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {usd > 0 && (
          <span className="text-[11px] text-muted-foreground font-mono">
            ≈ ${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onPick}
          className="inline-flex items-center gap-2 rounded-full bg-background border border-border px-3 py-1.5 text-sm font-medium hover:border-primary/40 transition shrink-0"
        >
          <TokenIcon token={token} />
          {token.symbol}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={loading && !editable ? "" : amount}
          placeholder={loading && !editable ? "…" : "0.00"}
          readOnly={!editable}
          onChange={(e) => onAmountChange?.(e.target.value)}
          className={cn(
            "h-10 bg-transparent border-0 focus-visible:ring-0 text-right text-xl font-mono p-0",
            !editable && "text-muted-foreground",
          )}
        />
      </div>
    </div>
  );
}

function TokenIcon({ token }: { token: JupToken }) {
  if (token.logoURI) {
    return (
      <img
        src={token.logoURI}
        alt={token.symbol}
        className="h-5 w-5 rounded-full object-cover"
        onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
      />
    );
  }
  return (
    <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">
      {token.symbol[0] ?? "?"}
    </span>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-right truncate", warn && "text-destructive")}>{value}</span>
    </div>
  );
}

function TokenPickerDialog({
  open,
  onOpenChange,
  tokens,
  onSelect,
  onResolveExternal,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tokens: JupToken[];
  onSelect: (t: JupToken) => void;
  onResolveExternal: (mint: string) => Promise<JupToken | null>;
}) {
  const [q, setQ] = useState("");
  const [resolving, setResolving] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return tokens.slice(0, 80);
    return tokens
      .filter(
        (t) =>
          t.symbol.toLowerCase().includes(query) ||
          t.name.toLowerCase().includes(query) ||
          t.address.toLowerCase().includes(query),
      )
      .slice(0, 80);
  }, [q, tokens]);

  const looksLikeMint = q.length >= 32 && q.length <= 48 && !q.includes(" ");

  async function pasteMint() {
    setResolving(true);
    try {
      const t = await onResolveExternal(q.trim());
      if (t) onSelect(t);
      else toast.error("Mint not found");
    } finally {
      setResolving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Select a token</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, symbol or paste mint address"
              className="pl-8 font-mono text-sm"
              autoFocus
            />
          </div>
          {looksLikeMint && !filtered.find((t) => t.address === q.trim()) && (
            <Button
              variant="outline"
              size="sm"
              onClick={pasteMint}
              disabled={resolving}
              className="mt-2 w-full"
            >
              {resolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Use mint {shortAddress(q.trim())}
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto border-t border-border/50">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No tokens match</p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.address}
                onClick={() => onSelect(t)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 transition text-left"
              >
                <TokenIcon token={t} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{t.symbol}</span>
                    <span className="text-xs text-muted-foreground truncate">{t.name}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                    {shortAddress(t.address)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
