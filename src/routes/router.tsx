import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatNumber, formatUsd, shortAddress } from "@/lib/format";
import { CheckCircle2, Coins, Loader2, Shield, Sparkles, Wallet } from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { ClaimFeesDialog } from "@/components/ClaimFeesDialog";
import { useWallet } from "@/hooks/useWallet";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Partner = {
  id: string;
  app_id: string;
  app_name: string;
  fee_wallet: string;
  bps: number;
  description: string | null;
  total_tokens_launched: number;
  total_fees_earned: number;
  is_active: boolean;
};

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
  const wallet = useWallet();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);

  async function loadPartners() {
    setLoading(true);
    const { data, error } = await supabase
      .from("partner_registry")
      .select("*")
      .eq("is_active", true)
      .order("total_fees_earned", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("Could not load partner registry");
      return;
    }
    setPartners((data ?? []) as Partner[]);
  }

  useEffect(() => {
    loadPartners();
  }, []);

  const totalLaunched = partners.reduce((s, p) => s + p.total_tokens_launched, 0);
  const totalFees = partners.reduce((s, p) => s + Number(p.total_fees_earned), 0);

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
              <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow">
                    Register your app
                  </Button>
                </DialogTrigger>
                <RegisterPartnerDialog
                  walletAddress={wallet.address}
                  onSuccess={() => {
                    setRegisterOpen(false);
                    loadPartners();
                  }}
                />
              </Dialog>
              <Button onClick={() => setClaimOpen(true)} size="lg" variant="outline">
                <Coins className="h-4 w-4" /> Claim my fees
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/docs">Read SDK docs →</Link>
              </Button>
            </div>
            <ClaimFeesDialog open={claimOpen} onOpenChange={setClaimOpen} />
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
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Partner marketplace</h2>
            <p className="text-sm text-muted-foreground mt-1">Apps registered with BagsRouter</p>
          </div>
          <Badge className="bg-primary/15 text-primary border-0">
            {loading ? "Loading…" : `${partners.length} live`}
          </Badge>
        </div>
        {partners.length === 0 && !loading ? (
          <Card className="bg-card/60 border-dashed">
            <CardContent className="p-12 text-center space-y-4">
              <Sparkles className="h-8 w-8 text-primary mx-auto" />
              <h3 className="text-lg font-semibold">Be the first partner</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                The registry is empty. Register your app to claim your protocol slot
                and start earning fee revenue from every Bags token launched through you.
              </p>
              <Button onClick={() => setRegisterOpen(true)} className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
                Register your app
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {partners.map((p) => (
              <Card key={p.id} className="bg-card/60 hover:border-primary/40 transition">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-mono truncate">{p.app_id}</p>
                      <h3 className="text-lg font-semibold mt-1">{p.app_name}</h3>
                      {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                    </div>
                    <Badge variant="outline" className="border-primary/40 text-primary shrink-0">
                      {(p.bps / 100).toFixed(1)}% cut
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground tracking-wider">Tokens</p>
                      <p className="font-mono font-semibold mt-0.5">{formatNumber(p.total_tokens_launched)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground tracking-wider">Fees earned</p>
                      <p className="font-mono font-semibold mt-0.5">{formatUsd(Number(p.total_fees_earned), { compact: true })}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground tracking-wider">Wallet</p>
                      <p className="font-mono mt-0.5 truncate">{shortAddress(p.fee_wallet)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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

function RegisterPartnerDialog({
  walletAddress,
  onSuccess,
}: {
  walletAddress: string | null;
  onSuccess: () => void;
}) {
  const [appId, setAppId] = useState("");
  const [appName, setAppName] = useState("");
  const [feeWallet, setFeeWallet] = useState("");
  const [bps, setBps] = useState(1500);
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (walletAddress && !feeWallet) setFeeWallet(walletAddress);
  }, [walletAddress, feeWallet]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      toast.error("Sign in first to register a partner");
      return;
    }
    const { error } = await supabase.from("partner_registry").insert({
      user_id: user.id,
      app_id: appId.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      app_name: appName,
      fee_wallet: feeWallet,
      bps,
      description: description || null,
      website: website || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${appName} registered with BagsRouter`);
    onSuccess();
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Register your app with BagsRouter</DialogTitle>
        <DialogDescription>
          Reserve your protocol slot. Your fee wallet will be auto-inserted into every
          token launched through the BagsRouter SDK.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>App ID</Label>
            <Input required placeholder="my-launchpad" value={appId} onChange={(e) => setAppId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>App name</Label>
            <Input required placeholder="My Launchpad" value={appName} onChange={(e) => setAppName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Fee wallet (Solana)</Label>
          <Input required placeholder="GxYz…" value={feeWallet} onChange={(e) => setFeeWallet(e.target.value)} className="font-mono text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label>Your fee share — {(bps / 100).toFixed(1)}%</Label>
          <input
            type="range"
            min={100}
            max={5000}
            step={50}
            value={bps}
            onChange={(e) => setBps(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="text-xs text-muted-foreground font-mono">
            {bps} BPS · creator gets {((10000 - bps - 500) / 100).toFixed(1)}% · protocol keeps 5%
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Website (optional)</Label>
          <Input placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea rows={2} placeholder="What does your app do?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Registering…</> : <><Wallet className="h-4 w-4" /> Register partner</>}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
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
