import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useWallet } from "@/hooks/useWallet";
import { useEffect, useState } from "react";
import { getWalletOverview, type WalletOverview, type WalletHolding } from "@/server/wallet";
import { formatNumber, formatPct, formatUsd, shortAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles, Wallet } from "lucide-react";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — BagsPulse" },
      { name: "description", content: "Track every Bags token you hold with live wallet data and group baskets." },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const wallet = useWallet();
  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet.authenticated || !wallet.address) {
      setOverview(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getWalletOverview({ data: { wallet: wallet.address } })
      .then((res) => {
        if (!cancelled) setOverview(res);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wallet.authenticated, wallet.address]);

  if (!wallet.authenticated) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center space-y-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary mx-auto">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Connect to view your portfolio</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            BagsPulse pulls every SPL token in your Solana wallet via Helius DAS, prices them
            with DexScreener, and surfaces your live Bags ecosystem holdings.
          </p>
          <div className="flex justify-center">
            <ConnectWallet size="lg" />
          </div>
        </div>
      </PageShell>
    );
  }

  const bagsHoldings = (overview?.holdings ?? []).filter((h) => h.isBags);
  const otherHoldings = (overview?.holdings ?? []).filter((h) => !h.isBags);

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">My portfolio</h1>
            <p className="text-muted-foreground text-sm mt-1 font-mono">
              {shortAddress(wallet.address!)} · live wallet data
            </p>
          </div>
          <Link to="/baskets">
            <Button variant="outline">View group baskets</Button>
          </Link>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard label="Total value" value={formatUsd(overview?.totalUsd ?? 0)} loading={loading} />
          <KpiCard label="SOL balance" value={`${(overview?.solBalance ?? 0).toFixed(4)} SOL`} loading={loading} />
          <KpiCard label="SPL tokens" value={formatNumber(overview?.holdings.length ?? 0, false)} loading={loading} />
          <KpiCard label="Bags tokens" value={formatNumber(bagsHoldings.length, false)} loading={loading} />
        </div>

        <Card className="bg-card/60">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Bags ecosystem holdings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <HoldingsTable holdings={bagsHoldings} loading={loading} emptyLabel="No Bags-launched tokens detected in this wallet yet." />
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base">Other SPL holdings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <HoldingsTable holdings={otherHoldings} loading={loading} emptyLabel="No other tokens." />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/15 via-card/60 to-card/60 border-primary/30">
          <CardContent className="p-8 flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 text-sm text-primary"><Sparkles className="h-4 w-4" /> Pro tier</p>
              <h3 className="text-xl font-semibold">Unlock alerts, advanced analytics and unlimited group baskets</h3>
              <p className="text-sm text-muted-foreground">0.2 SOL / mo · cancel anytime</p>
            </div>
            <Button asChild size="lg" className="bg-foreground text-background hover:bg-foreground/90">
              <Link to="/pricing">See plans</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function KpiCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <Card className="bg-card/60">
      <CardContent className="p-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold font-mono inline-flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function HoldingsTable({ holdings, loading, emptyLabel }: { holdings: WalletHolding[]; loading: boolean; emptyLabel: string }) {
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading on-chain holdings…
      </div>
    );
  }
  if (holdings.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">{emptyLabel}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground bg-secondary/30">
          <tr>
            <th className="text-left px-5 py-3">Token</th>
            <th className="text-right px-3 py-3">Balance</th>
            <th className="text-right px-3 py-3">Price</th>
            <th className="text-right px-3 py-3">24h</th>
            <th className="text-right px-5 py-3">Value</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.mint} className="border-t border-border/40 hover:bg-secondary/20">
              <td className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  {h.image ? (
                    <img src={h.image} alt="" className="h-9 w-9 rounded-md ring-1 ring-border" loading="lazy" />
                  ) : (
                    <div className="h-9 w-9 rounded-md bg-secondary" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">${h.symbol}</p>
                    <p className="text-xs text-muted-foreground truncate">{h.name}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-right font-mono">{formatNumber(h.amount)}</td>
              <td className="px-3 py-3 text-right font-mono">{h.priceUsd > 0 ? formatUsd(h.priceUsd) : "—"}</td>
              <td className={cn("px-3 py-3 text-right font-mono", h.change24h >= 0 ? "text-success" : "text-destructive")}>
                {h.priceUsd > 0 ? formatPct(h.change24h) : "—"}
              </td>
              <td className="px-5 py-3 text-right font-mono">{formatUsd(h.valueUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
