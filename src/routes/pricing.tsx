import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — BagsPulse" },
      { name: "description", content: "Free, Pro and Creator tiers for BagsPulse." },
    ],
  }),
  component: PricingPage,
});

const TIERS = [
  {
    name: "Free",
    price: "$0",
    desc: "Everything you need to track the ecosystem.",
    features: ["Live leaderboards", "Public BagsFeed", "Read-only portfolio", "1 group basket"],
    cta: "Start free",
    href: "/dashboard",
    accent: false,
  },
  {
    name: "Pro",
    price: "$9.99",
    desc: "Advanced analytics, alerts, unlimited baskets.",
    features: [
      "Everything in Free",
      "Realtime price alerts",
      "Unlimited group baskets",
      "Whale-watch & big-buy filters",
      "Cost basis & tax export",
    ],
    cta: "Upgrade to Pro",
    href: "/auth",
    accent: true,
  },
  {
    name: "Creator",
    price: "$29.99",
    desc: "For token creators and apps building on PulseRouter.",
    features: [
      "Everything in Pro",
      "Creator CRM + holder insights",
      "Custom fee dashboards",
      "PulseRouter partner registry",
      "Webhooks + API access",
    ],
    cta: "Become a creator",
    href: "/router",
    accent: false,
  },
];

function PricingPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 space-y-12">
        <header className="text-center space-y-3 max-w-2xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Pricing</p>
          <h1 className="text-4xl font-semibold tracking-tight">Simple, fair, on-chain.</h1>
          <p className="text-muted-foreground">
            Start free. Upgrade when you need pro analytics or are building on
            top of PulseRouter.
          </p>
        </header>
        <div className="grid md:grid-cols-3 gap-5">
          {TIERS.map((t) => (
            <Card
              key={t.name}
              className={cn(
                "relative bg-card/60",
                t.accent && "border-primary/50 shadow-glow",
              )}
            >
              {t.accent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-primary-glow px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most popular
                </div>
              )}
              <CardContent className="p-7 space-y-5">
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight">
                    {t.price}
                    <span className="text-sm text-muted-foreground font-normal">/mo</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
                </div>
                <ul className="space-y-2 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={cn(
                    "w-full",
                    t.accent
                      ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground"
                      : "",
                  )}
                  variant={t.accent ? "default" : "outline"}
                >
                  <Link to={t.href}>{t.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
