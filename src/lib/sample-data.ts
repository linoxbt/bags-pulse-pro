// Realistic sample data used as fallback when Bags API is unavailable / rate-limited.
// All shapes mirror what the Bags REST API returns so swapping is trivial.

export type Token = {
  mint: string;
  name: string;
  symbol: string;
  image: string;
  creator: string;
  creatorWallet: string;
  marketCap: number;
  price: number;
  volume24h: number;
  holders: number;
  feesEarned24h: number;
  feesEarnedTotal: number;
  change24h: number;
  graduated: boolean;
  launchedAt: string;
};

const creators = [
  { name: "0xCypher", wallet: "9xQeT3uZ8KqkXjVvR4NQv1fJqpNzZ8H4Mn7d2qXJqYpA" },
  { name: "MoonDev", wallet: "5kFn7vPzD3QwLxR1tVcN8ahYsJ4rEm9bX2pUfH6gKvWj" },
  { name: "SolanaQueen", wallet: "3Xf4WqRtBnK2cP7vYjL9mZsHd1uE8aGo5xN6tKpQrSjW" },
  { name: "DegenChef", wallet: "7Tm2JqEpNwR4dXcK1vY8sZjL3HfBn5Au6gM9xPqVrTkH" },
  { name: "BagsBuilder", wallet: "4Hp9KsDvN3QmLcR7tXfY2jZ8aWb1Ue6Go5PnK4xJqMvT" },
  { name: "PixelPaul", wallet: "8Lq5KtPvR2DnXfY3jZ7aWb1cMe6Go9HnK4xJqRsT8Auv" },
  { name: "CryptoNomad", wallet: "2Bq5KtPvR2DnXfY3jZ7aWb1cMe6Go9HnK4xJqRsT8AuC" },
  { name: "VaultKing", wallet: "6Eq5KtPvR2DnXfY3jZ7aWb1cMe6Go9HnK4xJqRsT8AuV" },
];

const symbols = [
  ["PULSE", "PulseDAO"],
  ["NOVA", "NovaBags"],
  ["FROG", "PondLord"],
  ["LION", "JungleKing"],
  ["MOAI", "EasterIsle"],
  ["RAVE", "RaveCoin"],
  ["DRIP", "DripFi"],
  ["WAVE", "WaveProtocol"],
  ["FLAME", "Flameborn"],
  ["NEON", "NeonGrid"],
  ["KOI", "KoiPond"],
  ["ZEN", "ZenGarden"],
  ["AURA", "AuraNet"],
  ["TIDE", "TideRiders"],
  ["ECHO", "EchoFi"],
];

function rng(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export function getSampleTokens(): Token[] {
  const r = rng(42);
  return symbols.map(([sym, name], i) => {
    const c = creators[i % creators.length];
    const mc = 50_000 + r() * 4_900_000;
    const vol = mc * (0.1 + r() * 0.9);
    const change = (r() - 0.4) * 80;
    return {
      mint: `${sym}${"x".repeat(40)}`.slice(0, 44),
      name,
      symbol: sym,
      image: `https://api.dicebear.com/7.x/shapes/svg?seed=${sym}&backgroundColor=10b981,fbbf24,8b5cf6`,
      creator: c.name,
      creatorWallet: c.wallet,
      marketCap: mc,
      price: mc / 1_000_000_000,
      volume24h: vol,
      holders: Math.floor(80 + r() * 12000),
      feesEarned24h: vol * 0.01,
      feesEarnedTotal: vol * 0.01 * (5 + r() * 60),
      change24h: change,
      graduated: r() > 0.6,
      launchedAt: new Date(Date.now() - r() * 1000 * 60 * 60 * 24 * 30).toISOString(),
    };
  });
}

export type FeedEvent = {
  id: string;
  type: "buy" | "sell" | "milestone" | "graduation" | "launch" | "fee";
  token: string;
  symbol: string;
  amountUsd: number;
  actor: string;
  message: string;
  at: string;
};

export function getSampleFeed(): FeedEvent[] {
  const tokens = getSampleTokens();
  const r = rng(7);
  const types: FeedEvent["type"][] = ["buy", "sell", "milestone", "graduation", "launch", "fee"];
  return Array.from({ length: 24 }).map((_, i) => {
    const t = tokens[Math.floor(r() * tokens.length)];
    const type = types[Math.floor(r() * types.length)];
    const amount = 50 + r() * 50_000;
    return {
      id: `evt_${i}_${t.symbol}`,
      type,
      token: t.name,
      symbol: t.symbol,
      amountUsd: amount,
      actor: `${"0xABCDEF1234".slice(0, 6)}…${Math.floor(r() * 9999)}`,
      message:
        type === "buy"
          ? `Whale bought ${(amount / t.price).toFixed(0)} ${t.symbol}`
          : type === "sell"
            ? `Sell pressure on ${t.symbol}`
            : type === "milestone"
              ? `${t.symbol} crossed $${Math.floor(t.marketCap / 1000)}K mcap`
              : type === "graduation"
                ? `${t.symbol} graduated to Meteora 🎓`
                : type === "launch"
                  ? `${t.creator} launched ${t.symbol}`
                  : `Creator claimed ${(amount / 100).toFixed(2)} SOL in fees`,
      at: new Date(Date.now() - i * 1000 * 60 * (2 + r() * 12)).toISOString(),
    };
  });
}

export type Partner = {
  appId: string;
  name: string;
  feeWallet: string;
  bps: number;
  totalTokensLaunched: number;
  totalFeesEarned: number;
  joinedAt: string;
};

export function getSamplePartners(): Partner[] {
  return [
    {
      appId: "bagspulse",
      name: "BagsPulse Dashboard",
      feeWallet: "BPSpLs1234567890aBcDeFgHiJkLmNoPqRsTuVwXyZ",
      bps: 500,
      totalTokensLaunched: 42,
      totalFeesEarned: 1284.56,
      joinedAt: "2024-11-12",
    },
    {
      appId: "moondev-launchpad",
      name: "MoonDev Launchpad",
      feeWallet: "MoND4567890aBcDeFgHiJkLmNoPqRsTuVwXyZ12345",
      bps: 1500,
      totalTokensLaunched: 128,
      totalFeesEarned: 8231.78,
      joinedAt: "2024-09-04",
    },
    {
      appId: "vaultking-tools",
      name: "VaultKing Creator Tools",
      feeWallet: "VK7890aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890",
      bps: 1000,
      totalTokensLaunched: 87,
      totalFeesEarned: 5612.34,
      joinedAt: "2024-10-18",
    },
    {
      appId: "degenchef-bot",
      name: "DegenChef Telegram Bot",
      feeWallet: "DC890aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789aB",
      bps: 1200,
      totalTokensLaunched: 64,
      totalFeesEarned: 3987.12,
      joinedAt: "2024-12-02",
    },
  ];
}

export function buildPriceSeries(seed: number, points = 48) {
  const r = rng(seed);
  let v = 100;
  return Array.from({ length: points }).map((_, i) => {
    v += (r() - 0.48) * 8;
    v = Math.max(20, v);
    return { i, v: Number(v.toFixed(2)) };
  });
}
