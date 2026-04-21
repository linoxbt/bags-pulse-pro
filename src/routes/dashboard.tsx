import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchTokens, fetchFeed } from "@/server/bags";
import { formatNumber, formatPct, formatUsd, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FeedEvent, Token } from "@/lib/sample-data";
import { buildPriceSeries } from "@/lib/sample-data";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Flame, GraduationCap, Megaphone, Rocket, Sparkles, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — BagsPulse" },
      { name: "description", content: "Real-time analytics for the entire Bags ecosystem." },
    ],
  }),
  loader: async () => {
    const [tokens, feed] = await Promise.all([fetchTokens(), fetchFeed()]);
    return { tokens, feed };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { tokens, feed } = Route.useLoaderData() as {
    tokens: { tokens: Token[]; live: boolean };
    feed: { events: FeedEvent[]; live: boolean };
  };
  const totalMcap = tokens.tokens.reduce((s, t) => s + t.marketCap, 0);
  const totalVol = tokens.tokens.reduce((s, t) => s + t.volume24h, 0);
  const totalFees = tokens.tokens.reduce((s, t) => s + t.feesEarned24h, 0);
  const totalHolders = tokens.tokens.reduce((s, t) => s + t.holders, 0);
  const top = [...tokens.tokens].sort((a, b) => b.marketCap - a.marketCap).slice(0, 8);
  const series = buildPriceSeries(11, 60);

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Ecosystem dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {tokens.live ? "Live data from Bags REST API" : "Curated demo data — connect API key for live"} ·{" "}
              <span className="font-mono">{tokens.tokens.length} tokens tracked</span>
            </p>
          </div>
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm hover:bg-secondary/70"
          >
            <Wallet className="h-4 w-4" /> Connect wallet
          </Link>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Total mcap" value={formatUsd(totalMcap, { compact: true })} delta={6.4} icon={Sparkles} />
          <Kpi label="24h volume" value={formatUsd(totalVol, { compact: true })} delta={12.1} icon={Flame} />
          <Kpi label="24h fees paid" value={formatUsd(totalFees, { compact: true })} delta={4.7} icon={Rocket} />
          <Kpi label="Unique holders" value={formatNumber(totalHolders)} delta={1.3} icon={Wallet} />
        </div>

        {/* Chart + feed */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 bg-card/60">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
              <CardTitle className="text-base">Ecosystem volume — last 24h</CardTitle>
              <Badge variant="secondary" className="bg-primary/15 text-primary border-0">
                +{(Math.random() * 12 + 4).toFixed(1)}% vs prev day
              </Badge>
            </CardHeader>
            <CardContent className="p-4 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.74 0.17 158)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="oklch(0.74 0.17 158)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="i" hide />
                  <YAxis hide domain={["dataMin - 10", "dataMax + 10"]} />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.20 0.022 240)",
                      border: "1px solid oklch(0.30 0.02 240)",
                      borderRadius: 8,
                      color: "white",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="oklch(0.82 0.18 158)"
                    strokeWidth={2}
                    fill="url(#g)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card/60">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary pulse-ring" />
                BagsFeed
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[300px] overflow-y-auto">
              <ul className="divide-y divide-border/50">
                {feed.events.slice(0, 8).map((e) => (
                  <FeedRow key={e.id} e={e} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Top movers */}
        <Card className="bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
            <CardTitle className="text-base">Top tokens by market cap</CardTitle>
            <Link to="/leaderboard" className="text-sm text-primary hover:underline">
              View full leaderboard →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground bg-secondary/30">
                  <tr>
                    <th className="text-left px-5 py-3">#</th>
                    <th className="text-left px-3 py-3">Token</th>
                    <th className="text-right px-3 py-3">Price</th>
                    <th className="text-right px-3 py-3">24h</th>
                    <th className="text-right px-3 py-3">Mcap</th>
                    <th className="text-right px-3 py-3">Volume</th>
                    <th className="text-right px-3 py-3">Holders</th>
                    <th className="text-right px-5 py-3">24h fees</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((t, i) => (
                    <tr key={t.mint} className="border-t border-border/40 hover:bg-secondary/20">
                      <td className="px-5 py-3 font-mono text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <img src={t.image} alt="" className="h-8 w-8 rounded-md ring-1 ring-border" loading="lazy" />
                          <div>
                            <p className="font-medium">${t.symbol}</p>
                            <p className="text-xs text-muted-foreground">{t.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono">{formatUsd(t.price)}</td>
                      <td className={cn("px-3 py-3 text-right font-mono", t.change24h >= 0 ? "text-success" : "text-destructive")}>
                        {formatPct(t.change24h)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">{formatUsd(t.marketCap, { compact: true })}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatUsd(t.volume24h, { compact: true })}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatNumber(t.holders)}</td>
                      <td className="px-5 py-3 text-right font-mono text-primary">
                        {formatUsd(t.feesEarned24h, { compact: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function Kpi({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta: number;
  icon: typeof Flame;
}) {
  const up = delta >= 0;
  return (
    <Card className="bg-card/60 border-border/60">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase text-muted-foreground tracking-widest">{label}</span>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="text-2xl font-semibold tracking-tight font-mono">{value}</p>
        <p className={cn("mt-1 text-xs font-mono inline-flex items-center", up ? "text-success" : "text-destructive")}>
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {formatPct(delta)} vs 24h
        </p>
      </CardContent>
    </Card>
  );
}

function FeedRow({ e }: { e: FeedEvent }) {
  const Icon =
    e.type === "buy"
      ? ArrowUpRight
      : e.type === "sell"
        ? ArrowDownRight
        : e.type === "graduation"
          ? GraduationCap
          : e.type === "milestone"
            ? Sparkles
            : e.type === "launch"
              ? Rocket
              : Megaphone;
  const color =
    e.type === "buy" || e.type === "graduation" || e.type === "milestone" || e.type === "launch"
      ? "text-success bg-success/10"
      : e.type === "sell"
        ? "text-destructive bg-destructive/10"
        : "text-accent bg-accent/10";
  return (
    <li className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/30">
      <span className={cn("h-7 w-7 rounded-md inline-flex items-center justify-center", color)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{e.message}</p>
        <p className="text-xs text-muted-foreground font-mono">
          {e.actor} · {timeAgo(e.at)}
        </p>
      </div>
      <span className="text-xs font-mono text-muted-foreground">${formatNumber(e.amountUsd)}</span>
    </li>
  );
}
