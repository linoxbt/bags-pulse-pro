import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchTokenDetail } from "@/server/bags";
import { formatNumber, formatPct, formatUsd, shortAddress, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/token/$mint")({
  loader: async ({ params }) => {
    const data = await fetchTokenDetail({ data: { mint: params.mint } });
    if (!data.token) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.token?.symbol ?? "Token"} — BagsPulse` },
      { name: "description", content: loaderData?.token?.description || "Live Bags ecosystem token details." },
    ],
  }),
  component: TokenPage,
  notFoundComponent: () => (
    <PageShell>
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold">Token not found</h1>
        <Button asChild className="mt-6"><Link to="/leaderboard">Back to search</Link></Button>
      </div>
    </PageShell>
  ),
});

function TokenPage() {
  const { token } = Route.useLoaderData();
  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-4">
            {token.image && <img src={token.image} alt={`${token.symbol} logo`} className="h-16 w-16 rounded-lg ring-1 ring-border" />}
            <div>
              <div className="flex items-center gap-2"><h1 className="text-3xl font-semibold">${token.symbol}</h1>{token.graduated && <Badge>Graduated</Badge>}</div>
              <p className="text-muted-foreground">{token.name} · {shortAddress(token.mint)}</p>
            </div>
          </div>
          <Button asChild variant="outline"><a href={`https://bags.fm/${token.mint}`} target="_blank" rel="noreferrer">Open on Bags</a></Button>
        </header>
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Market cap" value={formatUsd(token.marketCap, { compact: true })} />
          <Metric label="Price" value={formatUsd(token.price)} />
          <Metric label="24h volume" value={formatUsd(token.volume24h, { compact: true })} />
          <Metric label="24h change" value={formatPct(token.change24h)} tone={token.change24h >= 0 ? "up" : "down"} />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 bg-card/60"><CardHeader><CardTitle>Token details</CardTitle></CardHeader><CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">{token.description || "Live token record sourced from the Bags API on Solana mainnet."}</p>
            <Row label="Mint" value={token.mint} />
            <Row label="Creator" value={token.creatorWallet || token.creator} />
            <Row label="Launched" value={timeAgo(token.launchedAt)} />
            <Row label="DBC pool" value={token.dbcPoolKey || "—"} />
            <Row label="DAMM v2 pool" value={token.dammV2PoolKey || "—"} />
          </CardContent></Card>
          <Card className="bg-card/60"><CardHeader><CardTitle>Fees</CardTitle></CardHeader><CardContent className="space-y-4">
            <Metric label="24h fees" value={formatUsd(token.feesEarned24h, { compact: true })} />
            <Metric label="Lifetime fees" value={formatNumber(token.feesEarnedTotal)} />
            <Metric label="Holders" value={formatNumber(token.holders)} />
          </CardContent></Card>
        </div>
      </div>
    </PageShell>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return <Card className="bg-card/60"><CardContent className="p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-semibold font-mono ${tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : ""}`}>{value}</p></CardContent></Card>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 border-t border-border/50 pt-3"><span className="text-muted-foreground">{label}</span><span className="font-mono text-right break-all">{value}</span></div>;
}