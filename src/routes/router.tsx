import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSamplePartners } from "@/lib/sample-data";
import { formatNumber, formatUsd } from "@/lib/format";
import { shortAddress } from "@/lib/format";
import { CheckCircle2, Coins, Shield, Sparkles, Wallet } from "lucide-react";

export const Route = createFileRoute("/router")({
  head: () => ({
    meta: [
      { title: "BagsRouter — Fee-split protocol marketplace" },
      {
        name: "description",
        content:
          "Protocol-level fee infrastructure for the Bags ecosystem. Wrap the Bags SDK, register your app, earn protocol fees on every token launched through you.",
      },
    ],
  }),
  component: RouterPage,
});

function RouterPage() {
  const partners = getSamplePartners();
  const totalLaunched = partners.reduce((s, p) => s + p.totalTokensLaunched, 0);
  const totalFees = partners.reduce((s, p) => s + p.totalFeesEarned, 0);

  return (
    <PageShell>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-10">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">
              <Shield className="h-3.5 w-3.5" /> Protocol primitive
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
              <span className="text-gradient">BagsRouter</span> — earn fees on every token your app helps launch.
            </h1>
            <p className="text-lg text-muted-foreground">
              The protocol-level fee-split layer for the Bags ecosystem. Drop in our SDK,
              register your app once, and we automatically wire your fee wallet into the
              <code className="px-1 mx-1 font-mono bg-secondary rounded">createBagsFeeShareConfig</code>
              of every token launched through you.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow">
                Register your app
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/docs">Read SDK docs →</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-8 pt-6 border-t border-border/50">
              <Stat label="Active partners" value={String(partners.length)} />
              <Stat label="Tokens launched" value={formatNumber(totalLaunched)} />
              <Stat label="Total fees routed" value={formatUsd(totalFees)} />
              <Stat label="Protocol cut" value="5%" />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <h2 className="text-2xl font-semibold tracking-tight mb-8">How it works</h2>
        <div className="grid md:grid-cols-3 gap-5">
          <Step n={1} title="Register your app" body="One-time on-chain partner config (PDA). 0.1 SOL registration. Choose your fee wallet and BPS share." />
          <Step n={2} title="Wrap the Bags SDK" body="npm install @bagsrouter/sdk. Call router.launchToken() instead of sdk.tokenLaunch directly." />
          <Step n={3} title="Earn forever" body="Every token launched through you routes a permanent on-chain share of fees to your wallet. Claim anytime." />
        </div>
      </section>

      {/* Fee split visualizer */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-12">
        <Card className="bg-card/60">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base">Default fee allocation per launch</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="h-3 rounded-full overflow-hidden flex bg-secondary">
              <div className="bg-primary" style={{ width: "80%" }} title="Creator" />
              <div className="bg-accent" style={{ width: "15%" }} title="App" />
              <div className="bg-chart-3" style={{ width: "5%" }} title="Protocol" />
            </div>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-primary" /> Creator · 80% (8000 BPS)</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-accent" /> Your app · 15% (1500 BPS)</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-chart-3" /> BagsRouter protocol · 5% (500 BPS)</div>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Rooted in Bags fee program FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK · BPS sums to 10,000
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Marketplace */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-16">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Partner marketplace</h2>
            <p className="text-sm text-muted-foreground mt-1">Apps registered with BagsRouter</p>
          </div>
          <Badge className="bg-primary/15 text-primary border-0">Live registry</Badge>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {partners.map((p) => (
            <Card key={p.appId} className="bg-card/60 hover:border-primary/40 transition">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">{p.appId}</p>
                    <h3 className="text-lg font-semibold mt-1">{p.name}</h3>
                  </div>
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {(p.bps / 100).toFixed(1)}% cut
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground tracking-wider">Tokens</p>
                    <p className="font-mono font-semibold mt-0.5">{formatNumber(p.totalTokensLaunched)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground tracking-wider">Fees earned</p>
                    <p className="font-mono font-semibold mt-0.5">{formatUsd(p.totalFeesEarned, { compact: true })}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground tracking-wider">Wallet</p>
                    <p className="font-mono mt-0.5 truncate">{shortAddress(p.feeWallet)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button variant="secondary" size="sm" className="flex-1">
                    <Wallet className="h-3.5 w-3.5 mr-1" /> Claim fees
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Coins className="h-3.5 w-3.5 mr-1" /> View tokens
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Why it wins */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-20">
        <Card className="bg-gradient-to-br from-primary/10 via-card/60 to-card/60 border-primary/30">
          <CardContent className="p-8 grid md:grid-cols-3 gap-6">
            {[
              { t: "Protocol revenue", b: "5% of every fee from every token launched through BagsRouter — on-chain MRR." },
              { t: "Network effects", b: "Every dev that builds on us drives more on-chain volume — judged directly by Bags." },
              { t: "Deepest integration", b: "We don't read fees, we wrap the entire launch flow at the protocol layer." },
            ].map((x) => (
              <div key={x.t} className="space-y-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <p className="font-semibold">{x.t}</p>
                <p className="text-sm text-muted-foreground">{x.b}</p>
              </div>
            ))}
          </CardContent>
        </Card>
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

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <Card className="bg-card/60 relative overflow-hidden">
      <CardContent className="p-6 space-y-2">
        <div className="text-5xl font-semibold text-gradient/30 font-mono opacity-30 absolute -top-3 right-4">
          {n}
        </div>
        <Sparkles className="h-5 w-5 text-primary" />
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
