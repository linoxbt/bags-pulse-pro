import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { MarketTicker } from "@/components/MarketTicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Coins,
  Layers,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { fetchTokens } from "@/server/bags";
import { formatNumber, formatUsd, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import logo from "@/assets/bagspulse-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BagsPulse — The social finance dashboard for Bags.fm" },
      {
        name: "description",
        content:
          "Track every Bags token in real time. Leaderboards, creator scorecards, portfolios, and the PulseRouter fee-split protocol — all in one super-dashboard.",
      },
      { property: "og:title", content: "BagsPulse — Social finance for Bags.fm" },
      {
        property: "og:description",
        content:
          "Live leaderboards, fee marketplaces, group portfolios. Built for the Bags ecosystem.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [tokens, setTokens] = useState<import("@/server/bags").Token[]>([]);
  const [live, setLive] = useState(false);
  useEffect(() => {
    fetchTokens().then((d) => {
      setTokens(d.tokens);
      setLive(d.live);
    }).catch(() => {});
  }, []);
  const top = tokens.slice(0, 6);
  const totalMcap = tokens.reduce((s, t) => s + t.marketCap, 0);
  const totalVol = tokens.reduce((s, t) => s + t.volume24h, 0);
  const totalFees = tokens.reduce((s, t) => s + t.feesEarned24h, 0);

  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-20 pb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-ring" />
                {live ? "Live Bags API connected" : "Ecosystem analytics preview"}
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight">
                The pulse of the entire <span className="text-gradient">Bags ecosystem</span>, in one dashboard.
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                BagsPulse aggregates every active token on Bags.fm into a real-time
                social finance super-dashboard — leaderboards, creator scorecards,
                portfolio P&amp;L, and the PulseRouter fee-split protocol for app
                builders.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow">
                  <Link to="/dashboard">
                    Open dashboard <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/router">Explore PulseRouter →</Link>
                </Button>
              </div>
              <div className="flex flex-wrap gap-6 pt-2 text-sm">
                <Stat label="Tracked mcap" value={formatUsd(totalMcap, { compact: true })} />
                <Stat label="24h volume" value={formatUsd(totalVol, { compact: true })} />
                <Stat label="24h fees" value={formatUsd(totalFees, { compact: true })} />
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-10 bg-primary/20 blur-3xl rounded-full opacity-40" />
              <Card className="relative glass shadow-elevated overflow-hidden">
                <CardHeader className="border-b border-border/50 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary pulse-ring" />
                    <CardTitle className="text-base">Live leaderboard</CardTitle>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{live ? "top 6" : "preview data"}</span>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border/50">
                    {top.map((t, i) => (
                      <li key={t.mint} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition">
                        <span className="w-6 text-center font-mono text-xs text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <img
                          src={t.image}
                          alt=""
                          className="h-8 w-8 rounded-md ring-1 ring-border"
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">${t.symbol}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            by {t.creator}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatUsd(t.marketCap, { compact: true })}</p>
                          <p
                            className={cn(
                              "text-xs font-mono",
                              t.change24h >= 0 ? "text-success" : "text-destructive",
                            )}
                          >
                            {formatPct(t.change24h)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <img
                src={logo}
                alt=""
                className="hidden md:block absolute -top-12 -right-10 w-32 opacity-30 animate-float"
                loading="lazy"
              />
            </div>
          </div>
        </div>
        <MarketTicker />
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest">Why BagsPulse</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">
            Two products. One protocol-grade platform.
          </h2>
          <p className="mt-3 text-muted-foreground">
            BagsPulse pairs a beautifully crafted analytics super-dashboard with
            the PulseRouter fee-split protocol — so every builder, creator and
            holder sits inside the same value loop.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <Feature icon={BarChart3} title="Live leaderboards" body="Tokens ranked by market cap, volume, holder growth & fee yield — refreshed in real time." />
          <Feature icon={Users} title="Creator scorecards" body="Composite health score blending trading activity, fee yield and holder diversity." />
          <Feature icon={Activity} title="BagsFeed" body="Realtime social stream of big buys, milestones, graduations and fee claims." />
          <Feature icon={Coins} title="Portfolios & P&amp;L" body="Connect a wallet, see every Bags token you hold with cost basis and live P&amp;L." />
          <Feature icon={Layers} title="Group baskets" body="Curate token baskets with friends and track group performance over time." />
          <Feature icon={ShieldCheck} title="Trending alerts" body="Watchlist any token, get push alerts on milestones and abnormal volume." />
          <Feature icon={Zap} title="PulseRouter SDK" body="Drop-in npm package that auto-wires fee splits at token launch — earn protocol fees forever." />
          <Feature icon={Sparkles} title="Fee marketplace" body="Apps and creators see accumulated fees, claim with one click, audit every split." />
          <Feature icon={ShieldCheck} title="On-chain verified" body="Every fee config rooted in the FEE2tBh… program. Fully auditable, never custodial." />
        </div>
      </section>

      {/* CTA strip */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-surface to-surface-elevated p-10 sm:p-14">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-8 justify-between">
            <div className="max-w-xl space-y-3">
              <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Build on top of PulseRouter and earn protocol fees forever.
              </h3>
              <p className="text-muted-foreground">
                Wrap the official Bags SDK with our drop-in router. Every token you help
                launch automatically routes a share of fees to your app wallet — and
                a small protocol cut to BagsPulse.
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild size="lg" className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
                <Link to="/router">Open marketplace</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/docs">Read SDK docs</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight font-mono">{value}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Activity;
  title: string;
  body: string;
}) {
  return (
    <Card className="bg-card/60 border-border/60 hover:border-primary/40 transition group">
      <CardContent className="p-6 space-y-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary group-hover:bg-primary/25 transition">
          <Icon className="h-5 w-5" />
        </div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: body }} />
      </CardContent>
    </Card>
  );
}
