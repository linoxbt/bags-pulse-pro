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
import { CheckCircle2, Coins, Loader2, Shield, ShieldCheck, ShieldAlert, Sparkles } from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { ClaimFeesDialog } from "@/components/ClaimFeesDialog";
import { useWallet } from "@/hooks/useWallet";
import { useEffect, useState } from "react";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import {
  registerPartner,
  getMyPartner,
  verifyPartnerDomain,
  verifyPartnerWallet,
  listPartners,
  type Partner,
} from "@/server/partners";
import { toast } from "sonner";
import bs58 from "bs58";

export const Route = createFileRoute("/router")({
  head: () => ({
    meta: [
      { title: "PulseRouter — Fee-split protocol marketplace" },
      {
        name: "description",
        content:
          "Protocol-level fee infrastructure for the Bags ecosystem. Wrap the Bags SDK, register your app, earn protocol fees on every token launched through you.",
      },
    ],
  }),
  loader: () => listPartners(),
  component: RouterPage,
});

function RouterPage() {
  const initial = Route.useLoaderData() as { partners: Partner[] };
  const wallet = useWallet();
  const [partners, setPartners] = useState<Partner[]>(initial.partners);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [myPartner, setMyPartner] = useState<Partner | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);

  async function reload() {
    const res = await listPartners();
    setPartners(res.partners);
  }

  useEffect(() => {
    if (!wallet.authenticated) {
      setMyPartner(null);
      return;
    }
    getMyPartner()
      .then((res) => setMyPartner(res.partner))
      .catch(() => {});
  }, [wallet.authenticated]);

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
              <span className="text-gradient">PulseRouter</span> — earn fees on every token your app helps launch.
            </h1>
            <p className="text-lg text-muted-foreground">
              The protocol-level fee-split layer for the Bags ecosystem. Drop in our SDK, register your app,
              prove ownership of your domain + fee wallet, and we automatically wire your fee wallet into
              <code className="px-1 mx-1 font-mono bg-secondary rounded">createBagsFeeShareConfig</code>
              of every token launched through you.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {wallet.authenticated ? (
                myPartner ? (
                  <Button
                    size="lg"
                    onClick={() => setVerifyOpen(true)}
                    className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow"
                  >
                    {myPartner.is_active ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                    {myPartner.is_active ? "Manage partner" : "Finish verification"}
                  </Button>
                ) : (
                  <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="lg"
                        className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow"
                      >
                        Register your app
                      </Button>
                    </DialogTrigger>
                    <RegisterPartnerDialog
                      walletAddress={wallet.address}
                      onSuccess={async (p) => {
                        setRegisterOpen(false);
                        setMyPartner(p);
                        setVerifyOpen(true);
                        await reload();
                      }}
                    />
                  </Dialog>
                )
              ) : (
                <ConnectWallet size="lg" />
              )}
              <Button onClick={() => setClaimOpen(true)} size="lg" variant="outline">
                <Coins className="h-4 w-4" /> Claim my fees
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/docs">Read SDK docs →</Link>
              </Button>
            </div>
            <ClaimFeesDialog open={claimOpen} onOpenChange={setClaimOpen} />
            {myPartner && (
              <VerifyPartnerDialog
                open={verifyOpen}
                onOpenChange={setVerifyOpen}
                partner={myPartner}
                onUpdated={async () => {
                  const r = await getMyPartner();
                  setMyPartner(r.partner);
                  await reload();
                }}
              />
            )}
            <div className="flex flex-wrap gap-8 pt-6 border-t border-border/50">
              <Stat label="Verified partners" value={String(partners.length)} />
              <Stat label="Tokens launched" value={formatNumber(totalLaunched)} />
              <Stat label="Total fees routed" value={formatUsd(totalFees)} />
              <Stat label="Protocol cut" value="5%" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <h2 className="text-2xl font-semibold tracking-tight mb-8">How it works</h2>
        <div className="grid md:grid-cols-3 gap-5">
          <Step
            n={1}
            title="Register + verify your app"
            body="Pick a unique app_id slug. Prove ownership by adding a DNS TXT record at _bagspulse.<your-domain> AND signing a challenge with your fee wallet. Both checks must pass before your partner is marketed."
          />
          <Step
            n={2}
            title="Wrap the Bags SDK"
            body="Install @bagsfm/bags-sdk and call createBagsFeeShareConfig with the BagsPulse helper — it auto-injects your fee_wallet plus the 5% protocol cut into the on-chain config."
          />
          <Step
            n={3}
            title="Earn forever"
            body="Every token launched through your app_id routes a permanent on-chain share of fees to your wallet. Claim from the dialog above."
          />
        </div>
      </section>

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
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-primary" /> Creator · 80% (8000 BPS)
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-accent" /> Your app · 15% (1500 BPS)
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-chart-3" /> PulseRouter protocol · 5% (500 BPS)
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Rooted in Bags fee program FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK · BPS sums to 10,000
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-16">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Verified partner marketplace</h2>
            <p className="text-sm text-muted-foreground mt-1">Apps that pass domain + on-chain verification</p>
          </div>
          <Badge className="bg-primary/15 text-primary border-0">{partners.length} live</Badge>
        </div>
        {partners.length === 0 ? (
          <Card className="bg-card/60 border-dashed">
            <CardContent className="p-12 text-center space-y-4">
              <Sparkles className="h-8 w-8 text-primary mx-auto" />
              <h3 className="text-lg font-semibold">Be the first verified partner</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                The registry is empty. Register, verify your domain + wallet, and start earning protocol fees.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {partners.map((p) => (
              <Card key={p.id} className="bg-card/60 hover:border-primary/40 transition">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-mono truncate inline-flex items-center gap-1.5">
                        {p.app_id}
                        {p.domain_verified && p.wallet_verified && <ShieldCheck className="h-3 w-3 text-success" />}
                      </p>
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
                      <p className="font-mono font-semibold mt-0.5">
                        {formatUsd(Number(p.total_fees_earned), { compact: true })}
                      </p>
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
    </PageShell>
  );
}

function RegisterPartnerDialog({
  walletAddress,
  onSuccess,
}: {
  walletAddress: string | null;
  onSuccess: (p: Partner) => void;
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
    try {
      const res = await registerPartner({
        data: {
          app_id: appId,
          app_name: appName,
          fee_wallet: feeWallet,
          bps,
          description,
          website,
        },
      });
      toast.success(`${appName} registered — now verify your domain + wallet`);
      onSuccess(res.partner);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Register your app with PulseRouter</DialogTitle>
        <DialogDescription>
          Reserve your protocol slot. After registering you'll need to verify domain ownership + wallet control
          before your partner card is shown publicly.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>App ID</Label>
            <Input required minLength={3} placeholder="my-launchpad" value={appId} onChange={(e) => setAppId(e.target.value)} />
            <p className="text-[11px] text-muted-foreground leading-snug">
              Unique slug. BagsPulse uses this to look up your fee_wallet + BPS at every launch routed through your app.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>App name</Label>
            <Input required placeholder="My Launchpad" value={appName} onChange={(e) => setAppName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Fee wallet (Solana)</Label>
          <Input required value={feeWallet} onChange={(e) => setFeeWallet(e.target.value)} className="font-mono text-sm" />
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
          <Label>Website</Label>
          <Input required placeholder="https://yourapp.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Required for domain verification.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea rows={2} placeholder="What does your app do?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Registering…
              </>
            ) : (
              "Register & start verification"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function VerifyPartnerDialog({
  open,
  onOpenChange,
  partner,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partner: Partner;
  onUpdated: () => Promise<void>;
}) {
  const [checking, setChecking] = useState(false);
  const [signing, setSigning] = useState(false);
  const solana = useSolanaWallet();

  async function checkDomain() {
    setChecking(true);
    try {
      const res = await verifyPartnerDomain({ data: { partner_id: partner.id } });
      if (res.verified) {
        toast.success("Domain verified");
        await onUpdated();
      } else {
        toast.error("DNS TXT record not found yet — propagation can take a few minutes");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function signChallenge() {
    if (!solana.signMessage || !solana.publicKey) {
      toast.error("Wallet doesn't support message signing");
      return;
    }
    if (solana.publicKey.toBase58() !== partner.fee_wallet) {
      toast.error(`Connect the fee wallet (${shortAddress(partner.fee_wallet)}) to sign this challenge`);
      return;
    }
    if (!partner.verification_challenge) return;
    setSigning(true);
    try {
      const sig = await solana.signMessage(new TextEncoder().encode(partner.verification_challenge));
      const sigB58 = bs58.encode(sig);
      const res = await verifyPartnerWallet({ data: { partner_id: partner.id, signature_b58: sigB58 } });
      if (res.verified) {
        toast.success("Wallet verified");
        await onUpdated();
      } else {
        toast.error("Signature did not match the fee wallet");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSigning(false);
    }
  }

  const host = partner.website
    ? (() => {
        try {
          return new URL(partner.website.startsWith("http") ? partner.website : `https://${partner.website}`).host;
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Verify your partner</DialogTitle>
          <DialogDescription>
            Partner cards are only marketed once both checks pass. Both prove you actually control the app you're claiming.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-lg border border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {partner.domain_verified ? (
                  <ShieldCheck className="h-4 w-4 text-success" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-warning" />
                )}
                <span className="font-semibold text-sm">1. Domain ownership (DNS TXT)</span>
              </div>
              <Badge variant={partner.domain_verified ? "default" : "outline"}>
                {partner.domain_verified ? "Verified" : "Pending"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Add this TXT record to your DNS, then click verify. Cloudflare/Route53/etc. all support this.
            </p>
            <div className="rounded-md bg-secondary/40 p-3 font-mono text-xs space-y-1">
              <div>
                <span className="text-muted-foreground">Host:</span> _bagspulse.{host ?? "your-domain.com"}
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span> TXT
              </div>
              <div>
                <span className="text-muted-foreground">Value:</span> {partner.verification_token ?? "—"}
              </div>
            </div>
            <Button onClick={checkDomain} disabled={checking || partner.domain_verified} variant="outline" size="sm">
              {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {partner.domain_verified ? "Verified" : "Check DNS"}
            </Button>
          </div>

          <div className="rounded-lg border border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {partner.wallet_verified ? (
                  <ShieldCheck className="h-4 w-4 text-success" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-warning" />
                )}
                <span className="font-semibold text-sm">2. Fee-wallet control (signature)</span>
              </div>
              <Badge variant={partner.wallet_verified ? "default" : "outline"}>
                {partner.wallet_verified ? "Verified" : "Pending"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Sign a one-time challenge with the wallet you registered ({shortAddress(partner.fee_wallet)}). No on-chain
              transaction, no fee — just a signature.
            </p>
            <Button
              onClick={signChallenge}
              disabled={signing || partner.wallet_verified}
              size="sm"
              className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground"
            >
              {signing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {partner.wallet_verified ? "Verified" : "Sign challenge"}
            </Button>
          </div>

          {partner.is_active && (
            <p className="text-sm text-success inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Your partner is fully verified and live in the marketplace.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
        <div className="text-5xl font-semibold text-gradient/30 font-mono opacity-30 absolute -top-3 right-4">{n}</div>
        <Sparkles className="h-5 w-5 text-primary" />
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
