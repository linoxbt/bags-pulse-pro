// Central protocol constants for BagsPulse.

export const BAGSPULSE_TREASURY = "6CxhRUpZ9av3X28QxvppYycEm8SjTS5Wf5UgxBaEzhd";

// Solana mainnet SPL mints
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

export type PaymentCurrency = "SOL" | "USDC" | "USDT";

export const SUPPORTED_CURRENCIES: PaymentCurrency[] = ["SOL", "USDC", "USDT"];

export type TierId = "starter" | "pro" | "elite";

export type PricingTier = {
  id: TierId;
  name: string;
  priceUsd: number;
  description: string;
  features: string[];
  // Hard limits enforced server-side (see /server/licenses.ts)
  maxBaskets: number; // -1 = unlimited
  agentRunsPerDay: number;
  mcpAccess: boolean;
  highlight?: boolean;
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    priceUsd: 0,
    description: "Free forever — track the entire Bags ecosystem.",
    maxBaskets: 1,
    agentRunsPerDay: 0,
    mcpAccess: false,
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
    priceUsd: 2.5,
    description: "Advanced analytics, alerts and unlimited baskets.",
    maxBaskets: 10,
    agentRunsPerDay: 10,
    mcpAccess: false,
    highlight: true,
    features: [
      "Everything in Starter",
      "Realtime price + volume alerts",
      "Up to 10 group baskets",
      "Whale-watch & big-buy filters",
      "Cost basis & tax export",
      "Premium AI signals (Alpha Pulse)",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    priceUsd: 5,
    description: "For creators and apps building on PulseRouter.",
    maxBaskets: -1,
    agentRunsPerDay: 100,
    mcpAccess: true,
    features: [
      "Everything in Pro",
      "Unlimited group baskets",
      "Creator CRM + holder insights",
      "Custom fee dashboards",
      "PulseRouter partner registry",
      "Webhooks + REST + Claude MCP skill",
      "Group Basket AI auto-rebalances",
    ],
  },
];

// Map a tier to its license strategy_id (one license per tier)
export const TIER_STRATEGY_ID: Record<TierId, string> = {
  starter: "starter-free",
  pro: "alpha-pulse",
  elite: "group-basket-ai",
};

// Approx oracle prices used to display USDC/USDT equivalents on the pricing page.
export const SOL_USD_FALLBACK = 200;

export function priceInCurrency(priceUsd: number, currency: PaymentCurrency, solUsd: number): number {
  if (priceUsd === 0) return 0;
  if (currency === "SOL") {
    if (!solUsd || solUsd <= 0) return 0;
    return Number((priceUsd / solUsd).toFixed(4));
  }
  return Number(priceUsd.toFixed(2));
}

// PulseRouter fee config — used by the swap page so every Bags-token swap
// routes a 5% protocol cut to the BagsPulse treasury.
export const PULSEROUTER_PROTOCOL_BPS = 50; // 0.5% on swap notional → keeps Jupiter happy (max ~85 bps)
export const PULSEROUTER_REFERRAL_AUTHORITY = BAGSPULSE_TREASURY;
