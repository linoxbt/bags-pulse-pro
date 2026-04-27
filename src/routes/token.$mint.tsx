import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchTokenDetail } from "@/server/bags";
import { getCreatorScorecard, type Scorecard } from "@/server/scorecards";
import { formatNumber, formatPct, formatUsd, shortAddress, timeAgo } from "@/lib/format";
import { Copy, ExternalLink, Sparkles, TrendingUp, Users, Wallet, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/token/$mint")({
  loader: async ({ params }) => {
    const data = await fetchTokenDetail({ data: { mint: params.mint } });
    if (!data.token) throw notFound();
    let scorecard: Scorecard | null = null;
    if (data.token.creatorWallet) {
      const sc = await getCreatorScorecard({ data: { creator: data.token.creatorWallet } }).catch(() => null);
      scorecard = sc?.scorecard ?? null;
    }
    return { ...data, scorecard };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.token?.symbol ?? "Token"} — BagsPulse` },
      { name: "description", content: loaderData?.token?.description || "Live Bags ecosystem token details." },
      { property: "og:image", content: loaderData?.token?.image },
      { name: "twitter:image", content: loaderData?.token?.image },
    ],
  }),
  component: TokenPage,
  notFoundComponent: () => (
    <PageShell>
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold">Token not found</h1>
        <Button asChild className="mt-6">
          <Link to="/leaderboard">Back to search</Link>
        </Button>
      </div>
    </PageShell>
  ),
});

function TokenPage() {
  const { token, scorecard } = Route.useLoaderData();
  const [copyOk, setCopyOk] = useState(false);
  const series = useMemo(() => {
    if (!token) return [];
    const base = token.price || 1;
    const change = token.change24h / 100;
    const start = base / (1 + change || 0.0001);
    return Array.from({ length: 24 }, (_, i) => {
      const t = i / 23;
      const seed = (token.mint.charCodeAt((i * 3) % token.mint.length) % 7) - 3;
      return { h: i, v: Math.max(0, start + (base - start) * t + seed * base * 0.005) };
    });
  }, [token]);
  useEffect(() => {
    if (copyOk) {
      const t = setTimeout(() => setCopyOk(false), 1500);
      return () => clearTimeout(t);
    }
  }, [copyOk]);
  if (!token) return null;

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-4">
            {token.image && (
              <img
                src={token.image}
                alt={`${token.symbol} logo`}
                className="h-16 w-16 rounded-lg ring-1 ring-border"
                loading="lazy"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-semibold">${token.symbol}</h1>
                {token.partner?.verified && (
                  <Badge variant="outline" className="border-success/50 text-success bg-success/5 gap-1 py-0 px-1.5 h-6">
                    <ShieldCheck className="h-3 w-3" /> Verified Partner
                  </Badge>
                )}
                {token.graduated && <Badge variant="secondary">Graduated</Badge>}
              </div>
              <p className="text-muted-foreground flex items-center gap-2 text-sm mt-1">
                {token.name}
                <span>·</span>
                <span className="font-mono">{shortAddress(token.mint)}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(token.mint);
                    setCopyOk(true);
                    toast.success("Mint copied");
                  }}
                  className="hover:text-foreground"
                  aria-label="Copy mint"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link to="/swap" search={{ inputMint: "So11111111111111111111111111111111111111112", outputMint: token.mint }}>
                <TrendingUp className="h-4 w-4" /> Swap
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href={`https://bags.fm/${token.mint}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Open on Bags
              </a>
            </Button>
            <Button asChild variant="ghost">
              <a href={`https://dexscreener.com/solana/${token.mint}`} target="_blank" rel="noreferrer">
                Charts
              </a>
            </Button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Market cap" value={formatUsd(token.marketCap, { compact: true })} />
          <Metric label="Price" value={formatUsd(token.price)} />
          <Metric label="24h volume" value={formatUsd(token.volume24h, { compact: true })} />
          <Metric label="24h change" value={formatPct(token.change24h)} tone={token.change24h >= 0 ? "up" : "down"} />
        </div>

        <Card className="bg-card/60">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base">Price (synthetic 24h)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="tokenG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.82 0.18 158)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.74 0.17 158)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="h" hide />
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.20 0.022 240)",
                    border: "1px solid oklch(0.30 0.02 240)",
                    borderRadius: 8,
                    color: "white",
                  }}
                  formatter={(v: number) => formatUsd(v)}
                />
                <Area type="monotone" dataKey="v" stroke="oklch(0.82 0.18 158)" strokeWidth={2} fill="url(#tokenG)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 bg-card/60">
            <CardHeader>
              <CardTitle>Token details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                {token.description || "Live token record sourced from the Bags API on Solana mainnet."}
              </p>
              <Row label="Mint" value={token.mint} />
              <Row label="Creator" value={token.creatorWallet || token.creator} />
              <Row label="Launched" value={timeAgo(token.launchedAt)} />
              {token.partner && (
                <Row label="Launch partner" value={token.partner.appName} />
              )}
              <Row label="DBC pool" value={token.dbcPoolKey || "—"} />
              <Row label="DAMM v2 pool" value={token.dammV2PoolKey || "—"} />
            </CardContent>
          </Card>
          <Card className="bg-card/60">
            <CardHeader>
              <CardTitle>Fees & holders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Metric label="24h fees" value={formatUsd(token.feesEarned24h, { compact: true })} />
              <Metric label="Lifetime fees (SOL)" value={formatNumber(token.feesEarnedTotal)} />
              <Metric label="Holders" value={formatNumber(token.holders)} />
            </CardContent>
          </Card>
        </div>

        {scorecard && (
          <Card className="bg-gradient-to-br from-primary/10 via-card/60 to-card/60 border-primary/30">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Creator scorecard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid gap-6 md:grid-cols-4">
              <ScoreBlock label="Health score" value={`${scorecard.healthScore}/100`} accent />
              <ScoreBlock label="Fee yield" value={`${scorecard.feeYieldPct.toFixed(2)}%`} />
              <ScoreBlock
                label="Holder diversity"
                value={`${scorecard.holderDiversityScore}/100`}
                hint={
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {formatNumber(scorecard.totalHolders)}
                  </span>
                }
              />
              <ScoreBlock label="Trading activity" value={`${scorecard.tradingActivityScore}/100`} />
              <div className="md:col-span-4 grid sm:grid-cols-3 gap-3 pt-2">
                <Tile label="Launches" value={String(scorecard.launchesCount)} />
                <Tile label="Graduated" value={`${scorecard.graduatedCount} (${(scorecard.graduationRate * 100).toFixed(0)}%)`} />
                <Tile
                  label="Lifetime fees"
                  value={`${formatNumber(scorecard.totalFeesLifetime)} SOL`}
                  hint={<Wallet className="h-3 w-3" />}
                />
              </div>
              {scorecard.topTokens.length > 1 && (
                <div className="md:col-span-4 pt-2">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Other launches by this creator</p>
                  <div className="flex flex-wrap gap-2">
                    {scorecard.topTokens
                      .filter((t: { mint: string }) => t.mint !== token.mint)
                      .slice(0, 6)
                      .map((t: { mint: string; symbol: string; image: string; marketCap: number }) => (
                        <Link
                          key={t.mint}
                          to="/token/$mint"
                          params={{ mint: t.mint }}
                          className="inline-flex items-center gap-2 rounded-full bg-secondary/40 px-3 py-1 text-xs hover:bg-secondary/70"
                        >
                          {t.image && <img src={t.image} alt="" className="h-4 w-4 rounded-full" loading="lazy" />}
                          <span>${t.symbol}</span>
                          <span className="font-mono text-muted-foreground">{formatUsd(t.marketCap, { compact: true })}</span>
                        </Link>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <Card className="bg-card/60">
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p
          className={`mt-2 text-2xl font-semibold font-mono ${tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function ScoreBlock({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-lg p-4 ${accent ? "bg-primary/15 ring-1 ring-primary/40" : "bg-secondary/40"}`}>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold font-mono ${accent ? "text-primary" : ""}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/50 px-4 py-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono inline-flex items-center gap-1.5">
        {hint} {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-border/50 pt-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-right break-all">{value}</span>
    </div>
  );
}
