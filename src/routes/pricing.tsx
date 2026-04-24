import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRICING_TIERS,
  SOL_USD_FALLBACK,
  SUPPORTED_CURRENCIES,
  priceInCurrency,
  type PaymentCurrency,
  type PricingTier,
} from "@/lib/constants";
import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import { SubscribeDialog } from "@/components/SubscribeDialog";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — BagsPulse" },
      { name: "description", content: "Starter, Pro and Elite tiers paid in SOL, USDC or USDT on Solana." },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const [currency, setCurrency] = useState<PaymentCurrency>("SOL");
  const [solUsd, setSolUsd] = useState(SOL_USD_FALLBACK);
  const [subTier, setSubTier] = useState<PricingTier | null>(null);
  const wallet = useWallet();

  useEffect(() => {
    fetch("https://api.dexscreener.com/tokens/v1/solana/So11111111111111111111111111111111111111112")
      .then((r) => r.json())
      .then((arr: Array<{ priceUsd?: string }>) => {
        const p = Number(arr?.[0]?.priceUsd ?? 0);
        if (p > 0) setSolUsd(p);
      })
      .catch(() => {});
  }, []);

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 space-y-12">
        <header className="text-center space-y-3 max-w-2xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Pricing</p>
          <h1 className="text-4xl font-semibold tracking-tight">Pay in SOL, USDC or USDT.</h1>
          <p className="text-muted-foreground">
            Start free. Upgrade when you need pro analytics or are building on top of PulseRouter.
            Subscriptions settle on Solana mainnet — no credit cards, no middlemen.
          </p>
          <div className="inline-flex rounded-full border border-border/60 bg-secondary/40 p-1 text-xs">
            {SUPPORTED_CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={cn(
                  "px-4 py-1.5 rounded-full font-mono transition",
                  currency === c
                    ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground font-mono pt-1">
            Live SOL/USD oracle: ${solUsd.toFixed(2)}
          </p>
        </header>
        <div className="grid md:grid-cols-3 gap-5">
          {PRICING_TIERS.map((t) => {
            const amount = priceInCurrency(t.priceUsd, currency, solUsd);
            const display =
              t.priceUsd === 0
                ? "Free"
                : currency === "SOL"
                  ? `${amount} SOL`
                  : `$${amount}`;
            return (
              <Card
                key={t.id}
                className={cn(
                  "relative bg-card/60",
                  t.highlight && "border-primary/50 shadow-glow",
                )}
              >
                {t.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-primary-glow px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Most popular
                  </div>
                )}
                <CardContent className="p-7 space-y-5">
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="mt-3 text-4xl font-semibold tracking-tight font-mono">
                      {display}
                      {t.priceUsd > 0 && (
                        <span className="text-sm text-muted-foreground font-normal font-sans">/mo</span>
                      )}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {t.priceUsd === 0 ? (
                    <Button asChild className="w-full" variant="outline">
                      <a href="/dashboard">Start free</a>
                    </Button>
                  ) : !wallet.authenticated ? (
                    <ConnectWallet size="default" full />
                  ) : (
                    <Button
                      onClick={() => setSubTier(t)}
                      className={cn(
                        "w-full",
                        t.highlight
                          ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground"
                          : "",
                      )}
                      variant={t.highlight ? "default" : "outline"}
                    >
                      Upgrade to {t.name}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-center text-xs text-muted-foreground font-mono">
          Treasury: 6CxhRUpZ9av3X28QxvppYycEm8SjTS5Wf5UgxBaEzhd · Fee split via PulseRouter
        </p>
      </section>
      <SubscribeDialog
        open={!!subTier}
        onOpenChange={(o) => !o && setSubTier(null)}
        tier={subTier}
        currency={currency}
        solUsd={solUsd}
      />
    </PageShell>
  );
}
