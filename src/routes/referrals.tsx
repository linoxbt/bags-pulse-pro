import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { formatNumber, formatUsd, shortAddress } from "@/lib/format";
import { Copy, Gift, Sparkles, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals — BagsPulse" },
      { name: "description", content: "Earn rewards by bringing new users to the BagsPulse ecosystem." },
    ],
  }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const wallet = useWallet();
  const [copied, setCopied] = useState(false);

  const refLink = wallet.address ? `${window.location.origin}/?ref=${wallet.address}` : "";

  const copy = () => {
    if (!refLink) return;
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!wallet.authenticated) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center space-y-6">
          <Gift className="h-14 w-14 text-primary mx-auto opacity-50" />
          <h1 className="text-3xl font-semibold tracking-tight">Refer & Earn</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Connect your wallet to generate a unique referral link. Earn 10% of every license 
            subscription bought by your referrals.
          </p>
          <div className="flex justify-center">
            <Button size="lg" className="bg-primary text-primary-foreground">Connect Wallet</Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 space-y-8">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Referral program</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Grow the BagsPulse ecosystem and get rewarded in real-time.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard label="Total referrals" value="0" icon={Users} />
          <KpiCard label="Earnings (SOL)" value="0.00" icon={Wallet} />
          <KpiCard label="Potential boost" value="+5%" icon={Sparkles} />
        </div>

        <Card className="bg-gradient-to-br from-primary/10 via-card/60 to-card/60 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Your referral link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 bg-background/50 rounded-lg px-4 py-3 font-mono text-sm border border-border/40 truncate flex items-center">
                {refLink}
              </div>
              <Button size="lg" onClick={copy} className="shrink-0">
                {copied ? "Copied!" : <Copy className="h-4 w-4 mr-2" />}
                {!copied && "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link with your friends. When they buy an <strong>Alpha Pulse</strong> or <strong>Group Basket AI</strong> license, 
              you'll automatically receive a 10% kickback to your wallet.
            </p>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-card/60">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base">Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No referral activity yet. Start sharing to see your stats here.
            </CardContent>
          </Card>

          <Card className="bg-card/60">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base">Rewards tiers</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border/50">
                <TierRow label="Standard" threshold="0-5 refs" reward="10% share" />
                <TierRow label="Ambassador" threshold="6-20 refs" reward="15% share" />
                <TierRow label="Ecosystem Partner" threshold="21+ refs" reward="25% share" />
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <Card className="bg-card/60">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <div className="h-8 w-8 rounded-md bg-primary/15 text-primary flex items-center justify-center">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-3xl font-semibold font-mono">{value}</p>
      </CardContent>
    </Card>
  );
}

function TierRow({ label, threshold, reward }: { label: string; threshold: string; reward: string }) {
  return (
    <li className="flex items-center justify-between px-5 py-4">
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{threshold}</p>
      </div>
      <p className="text-sm font-mono text-primary font-semibold">{reward}</p>
    </li>
  );
}
