import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchTokens } from "@/server/bags";
import { formatNumber, formatPct, formatUsd } from "@/lib/format";
import type { Token } from "@/server/bags";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Search, Star, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — BagsPulse" },
      { name: "description", content: "Live rankings for every Bags token by market cap, volume, holders and fees." },
    ],
  }),
  loader: () => fetchTokens(),
  component: LeaderboardPage,
  pendingComponent: () => (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-6">
        <div className="space-y-2">
          <div className="h-9 w-64 bg-primary/10 animate-pulse rounded" />
          <div className="h-4 w-96 bg-primary/5 animate-pulse rounded" />
        </div>
        <div className="h-[600px] w-full bg-card/40 animate-pulse rounded-xl border border-border/50" />
      </div>
    </PageShell>
  ),
});

type SortKey = "marketCap" | "volume24h" | "holders" | "feesEarned24h" | "change24h";

function LeaderboardPage() {
  const data = Route.useLoaderData() as { tokens: Token[]; live: boolean };
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("marketCap");

  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return data.tokens
      .filter(
        (t) =>
          !lower ||
          t.symbol.toLowerCase().includes(lower) ||
          t.name.toLowerCase().includes(lower) ||
          t.mint.toLowerCase().includes(lower) ||
          t.creator.toLowerCase().includes(lower),
      )
      .sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))
      .slice(0, 50);
  }, [data.tokens, q, sortKey]);

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Token leaderboard</h1>
          <p className="text-muted-foreground text-sm">
            Top {filtered.length} live Bags tokens — market data via Bags + DexScreener. Search by symbol, name, mint or creator.
          </p>
        </header>

        <Card className="bg-card/60">
          <CardHeader className="border-b border-border/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Tabs value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <TabsList className="bg-secondary/40">
                  <TabsTrigger value="marketCap">Mcap</TabsTrigger>
                  <TabsTrigger value="volume24h">Volume</TabsTrigger>
                  <TabsTrigger value="holders">Holders</TabsTrigger>
                  <TabsTrigger value="feesEarned24h">Fees</TabsTrigger>
                  <TabsTrigger value="change24h">Movers</TabsTrigger>
                </TabsList>
                <TabsContent value={sortKey} />
              </Tabs>
              <form className="relative flex w-full gap-2 sm:w-96" onSubmit={(e) => { e.preventDefault(); if (filtered[0]) navigate({ to: "/token/$mint", params: { mint: filtered[0].mint } }); }}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by symbol, name, mint…"
                  className="pl-9 bg-background/40"
                />
                <Button type="submit" variant="outline">Search</Button>
              </form>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground bg-secondary/30">
                  <tr>
                    <th className="text-left px-5 py-3">#</th>
                    <th className="text-left px-3 py-3">Token</th>
                    <th className="text-left px-3 py-3 hidden md:table-cell">Creator</th>
                    <th className="text-right px-3 py-3">Price</th>
                    <th className="text-right px-3 py-3">24h</th>
                    <th className="text-right px-3 py-3">Mcap</th>
                    <th className="text-right px-3 py-3 hidden md:table-cell">Volume</th>
                    <th className="text-right px-3 py-3 hidden lg:table-cell">Holders</th>
                    <th className="text-right px-5 py-3">Fees 24h</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => (
                    <tr key={t.mint} className="border-t border-border/40 hover:bg-secondary/20">
                      <td className="px-5 py-3 font-mono text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <img src={t.image} alt="" className="h-9 w-9 rounded-md ring-1 ring-border" loading="lazy" />
                          <div className="min-w-0">
                            <Link to="/token/$mint" params={{ mint: t.mint }} className="font-medium flex items-center gap-1 hover:text-primary">
                              ${t.symbol}
                              {t.partner?.verified && (
                                <ShieldCheck className="h-3 w-3 text-success" title={`Launched via ${t.partner.appName}`} />
                              )}
                              {t.graduated && (
                                <span className="text-[10px] font-mono uppercase rounded bg-accent/15 text-accent px-1 py-0.5">
                                  graduated
                                </span>
                              )}
                            </Link>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {t.name}
                              {t.partner && !t.partner.verified && (
                                <span className="ml-1 opacity-50 text-[10px]">via {t.partner.appName}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell text-muted-foreground">{t.creator}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatUsd(t.price)}</td>
                      <td className={cn("px-3 py-3 text-right font-mono", t.change24h >= 0 ? "text-success" : "text-destructive")}>
                        {formatPct(t.change24h)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">{formatUsd(t.marketCap, { compact: true })}</td>
                      <td className="px-3 py-3 text-right font-mono hidden md:table-cell">{formatUsd(t.volume24h, { compact: true })}</td>
                      <td className="px-3 py-3 text-right font-mono hidden lg:table-cell">{formatNumber(t.holders)}</td>
                      <td className="px-5 py-3 text-right font-mono text-primary">{formatUsd(t.feesEarned24h, { compact: true })}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-muted-foreground">
                        <Star className="mx-auto mb-2 h-5 w-5" />
                        No tokens match "{q}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
