import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchTokens } from "@/server/bags";
import type { Token } from "@/server/bags";
import { formatNumber, formatPct, formatUsd, shortAddress } from "@/lib/format";
import { Plus, Users, Wallet, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useWallet } from "@/hooks/useWallet";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — BagsPulse" },
      { name: "description", content: "Track every Bags token you hold with live P&L and group baskets." },
    ],
  }),
  loader: () => fetchTokens(),
  component: PortfolioPage,
});

function PortfolioPage() {
  const data = Route.useLoaderData() as { tokens: Token[]; live: boolean };
  const holdings = data.tokens.slice(0, 5).map((t, i) => {
    const balance = (1500 - i * 230) * 1000;
    const cost = balance * t.price * 0.78;
    const value = balance * t.price;
    return { token: t, balance, cost, value, pnl: value - cost };
  });
  const totalValue = holdings.reduce((s, h) => s + h.value, 0);
  const totalPnl = holdings.reduce((s, h) => s + h.pnl, 0);
  const totalPnlPct = (totalPnl / (totalValue - totalPnl || 1)) * 100;

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">My portfolio</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Connect a Solana wallet to track your Bags ecosystem holdings.
            </p>
          </div>
          <Button className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
            <Wallet className="mr-2 h-4 w-4" /> Connect wallet
          </Button>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-card/60 border-primary/30">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Portfolio value</p>
              <p className="mt-2 text-3xl font-semibold font-mono">{formatUsd(totalValue)}</p>
              <p className={cn("mt-1 text-sm font-mono", totalPnl >= 0 ? "text-success" : "text-destructive")}>
                {totalPnl >= 0 ? "+" : ""}
                {formatUsd(totalPnl)} · {formatPct(totalPnlPct)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/60">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Tokens held</p>
              <p className="mt-2 text-3xl font-semibold font-mono">{holdings.length}</p>
              <p className="mt-1 text-sm text-muted-foreground">across the Bags ecosystem</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Group baskets</p>
                <p className="mt-2 text-3xl font-semibold font-mono">2</p>
                <p className="mt-1 text-sm text-muted-foreground">co-managed with friends</p>
              </div>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" /> New
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/60">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base">Holdings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground bg-secondary/30">
                  <tr>
                    <th className="text-left px-5 py-3">Token</th>
                    <th className="text-right px-3 py-3">Balance</th>
                    <th className="text-right px-3 py-3">Avg cost</th>
                    <th className="text-right px-3 py-3">Price</th>
                    <th className="text-right px-3 py-3">Value</th>
                    <th className="text-right px-5 py-3">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const pct = (h.pnl / h.cost) * 100;
                    return (
                      <tr key={h.token.mint} className="border-t border-border/40 hover:bg-secondary/20">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <img src={h.token.image} alt="" className="h-9 w-9 rounded-md ring-1 ring-border" loading="lazy" />
                            <div>
                              <p className="font-medium">${h.token.symbol}</p>
                              <p className="text-xs text-muted-foreground">{h.token.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono">{formatNumber(h.balance)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatUsd(h.cost / h.balance)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatUsd(h.token.price)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatUsd(h.value)}</td>
                        <td
                          className={cn(
                            "px-5 py-3 text-right font-mono",
                            h.pnl >= 0 ? "text-success" : "text-destructive",
                          )}
                        >
                          {h.pnl >= 0 ? "+" : ""}
                          {formatUsd(h.pnl)} ({formatPct(pct)})
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <BasketCard
            name="Friday Degens"
            members={4}
            tokens={data.tokens.slice(0, 3)}
            value={42_318}
            pnl={6.4}
          />
          <BasketCard
            name="Long-term Bags"
            members={2}
            tokens={data.tokens.slice(3, 6)}
            value={18_902}
            pnl={-2.1}
          />
        </div>

        <Card className="bg-gradient-to-br from-primary/15 via-card/60 to-card/60 border-primary/30">
          <CardContent className="p-8 flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 text-sm text-primary"><Sparkles className="h-4 w-4" /> Pro tier</p>
              <h3 className="text-xl font-semibold">Unlock alerts, advanced analytics and unlimited group baskets</h3>
              <p className="text-sm text-muted-foreground">$9.99/mo · cancel anytime</p>
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

function BasketCard({
  name,
  members,
  tokens,
  value,
  pnl,
}: {
  name: string;
  members: number;
  tokens: Token[];
  value: number;
  pnl: number;
}) {
  return (
    <Card className="bg-card/60">
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{name}</CardTitle>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> {members} members
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-semibold font-mono">{formatUsd(value)}</p>
            <p className={cn("text-sm font-mono", pnl >= 0 ? "text-success" : "text-destructive")}>{formatPct(pnl)} 7d</p>
          </div>
          <div className="flex -space-x-2">
            {tokens.map((t) => (
              <img
                key={t.mint}
                src={t.image}
                alt=""
                className="h-8 w-8 rounded-md ring-2 ring-card"
                loading="lazy"
              />
            ))}
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full">View basket</Button>
      </CardContent>
    </Card>
  );
}
