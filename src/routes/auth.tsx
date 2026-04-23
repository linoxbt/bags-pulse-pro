import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { BagsPulseLogo } from "@/components/BagsPulseLogo";
import { ConnectWallet } from "@/components/ConnectWallet";
import { Wallet } from "lucide-react";
import { useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — BagsPulse" },
      { name: "description", content: "Sign in to BagsPulse with your Solana wallet." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const wallet = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    if (wallet.ready && wallet.authenticated && wallet.address) {
      navigate({ to: "/dashboard" });
    }
  }, [wallet.ready, wallet.authenticated, wallet.address, navigate]);

  return (
    <PageShell>
      <div className="mx-auto max-w-md px-4 py-16">
        <Card className="bg-card/60">
          <CardContent className="p-8 space-y-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <BagsPulseLogo withWordmark={false} size={48} />
              <h1 className="text-2xl font-semibold tracking-tight">Welcome to BagsPulse</h1>
              <p className="text-sm text-muted-foreground">
                Connect your Solana wallet to enter BagsPulse.
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-secondary/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Wallet className="h-4 w-4 text-primary" /> Solana wallet
              </div>
              <ConnectWallet size="lg" full />
            </div>
            {wallet.ready && wallet.authenticated && wallet.address && (
              <div className="rounded-md border border-border/40 bg-secondary/10 p-3 text-xs text-muted-foreground">
                Signing you in and opening your dashboard…
              </div>
            )}
            <p className="text-center text-xs text-muted-foreground">
              By continuing you agree to BagsPulse{" "}
              <Link to="/" className="text-primary hover:underline">terms</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
