// Central protocol constants for BagsPulse.

export const BAGSPULSE_TREASURY = "6CxhRUpZ9av3X28QxvppYycEm8SjTS5Wf5UgxBaEzhd";

// Solana mainnet SPL mints for stablecoins.
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

export type PaymentCurrency = "SOL" | "USDC" | "USDT";

export const SUPPORTED_CURRENCIES: PaymentCurrency[] = ["SOL", "USDC", "USDT"];

export type PricingTier = {
  id: "starter" | "pro" | "elite";
  name: string;
  priceSol: number; // 0 = free
  description: string;
  features: string[];
  highlight?: boolean;
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    priceSol: 0,
    description: "Free forever — track the entire Bags ecosystem.",
    features: [
      "Live leaderboards (top 50)",
      "Public BagsFeed (buys, launches, graduations)",
      "Read-only portfolio with real wallet holdings",
      "1 group basket",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceSol: 0.2,
    description: "Advanced analytics, alerts and unlimited baskets.",
    features: [
      "Everything in Starter",
      "Realtime price + volume alerts",
      "Unlimited group baskets",
      "Whale-watch & big-buy filters",
      "Cost basis & tax export",
      "Premium AI signals (Alpha Pulse)",
    ],
    highlight: true,
  },
  {
    id: "elite",
    name: "Elite",
    priceSol: 0.5,
    description: "For creators and apps building on PulseRouter.",
    features: [
      "Everything in Pro",
      "Creator CRM + holder insights",
      "Custom fee dashboards",
      "PulseRouter partner registry",
      "Webhooks + REST + MCP API",
      "Group Basket AI auto-rebalances",
    ],
  },
];

// Approx oracle prices used to display USDC/USDT equivalents on the pricing page.
// Replaced at runtime with a DexScreener fetch when available.
export const SOL_USD_FALLBACK = 200;

export function priceInCurrency(priceSol: number, currency: PaymentCurrency, solUsd: number): number {
  if (currency === "SOL") return priceSol;
  return Number((priceSol * solUsd).toFixed(2));
}
