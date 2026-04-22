import { createServerFn } from "@tanstack/react-start";

const BAGS_BASE = "https://public-api-v2.bags.fm/api/v1";

export type Token = {
  mint: string;
  name: string;
  symbol: string;
  image: string;
  description: string;
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
  website?: string | null;
  twitter?: string | null;
  status?: string | null;
  dbcPoolKey?: string | null;
  dammV2PoolKey?: string | null;
};

export type FeedEvent = {
  id: string;
  type: "launch" | "graduation" | "fee" | "milestone" | "buy" | "sell";
  token: string;
  symbol: string;
  mint: string;
  amountUsd: number;
  actor: string;
  message: string;
  at: string;
};

async function bagsFetch(path: string): Promise<unknown | null> {
  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) {
    console.warn(`[bags] BAGS_API_KEY missing, skipping ${path}`);
    return null;
  }
  try {
    const res = await fetch(`${BAGS_BASE}${path}`, {
      headers: { "x-api-key": apiKey, accept: "application/json" },
    });
    if (!res.ok) {
      console.error(`[bags] ${path} returned ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[bags] ${path} failed`, err);
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function unwrapList(data: unknown): unknown[] {
  const root = asRecord(data);
  const response = root.response;
  if (Array.isArray(response)) return response;
  if (Array.isArray(root.data)) return root.data;
  if (Array.isArray(root.tokens)) return root.tokens;
  return [];
}

function numberFrom(...values: unknown[]): number {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function normalizeToken(raw: unknown, i = 0): Token {
  const t = asRecord(raw);
  const mint = String(t.tokenMint ?? t.mint ?? t.address ?? `unknown-${i}`);
  const symbol = String(t.symbol ?? "?");
  const marketCap = numberFrom(t.marketCap, t.market_cap, t.fdv, t.mcap);
  const volume24h = numberFrom(t.volume24h, t.volume24H, t.volume, t.volumeUsd24h);
  const lifetimeFeesLamports = numberFrom(t.lifetimeFees, t.totalFees, t.feesTotal);
  const feesEarnedTotal = lifetimeFeesLamports > 1_000_000 ? lifetimeFeesLamports / 1_000_000_000 : lifetimeFeesLamports;
  return {
    mint,
    name: String(t.name ?? symbol),
    symbol,
    image: String(t.image ?? t.imageUrl ?? t.logoURI ?? ""),
    description: String(t.description ?? ""),
    creator: String(t.creatorName ?? t.creator ?? t.providerUsername ?? "unknown"),
    creatorWallet: String(t.creatorWallet ?? t.creator ?? t.wallet ?? ""),
    marketCap,
    price: numberFrom(t.price, t.priceUsd, marketCap ? marketCap / 1_000_000_000 : 0),
    volume24h,
    holders: numberFrom(t.holders, t.holderCount),
    feesEarned24h: numberFrom(t.fees24h, t.feesEarned24h, volume24h * 0.01),
    feesEarnedTotal,
    change24h: numberFrom(t.change24h, t.priceChange24h, t.priceChange),
    graduated: Boolean(t.graduated ?? t.migrated ?? t.dammV2PoolKey),
    launchedAt: String(t.launchedAt ?? t.createdAt ?? t.created_at ?? new Date().toISOString()),
    website: typeof t.website === "string" ? t.website : null,
    twitter: typeof t.twitter === "string" ? t.twitter : null,
    status: typeof t.status === "string" ? t.status : null,
    dbcPoolKey: typeof t.dbcPoolKey === "string" ? t.dbcPoolKey : null,
    dammV2PoolKey: typeof t.dammV2PoolKey === "string" ? t.dammV2PoolKey : null,
  };
}

function normalizeFeedEvent(raw: unknown, i = 0): FeedEvent {
  const t = normalizeToken(raw, i);
  const r = asRecord(raw);
  const status = String(r.status ?? "").toUpperCase();
  const type: FeedEvent["type"] = status.includes("MIGRAT") || t.graduated ? "graduation" : "launch";
  return {
    id: String(r.launchSignature ?? r.signature ?? t.mint ?? `feed-${i}`),
    type,
    token: t.name,
    symbol: t.symbol,
    mint: t.mint,
    amountUsd: t.marketCap,
    actor: t.creatorWallet || t.creator,
    message: type === "graduation" ? `${t.symbol} graduated on Bags` : `${t.symbol} launched on Bags`,
    at: t.launchedAt,
  };
}

export const fetchTokens = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ tokens: Token[]; live: boolean }> => {
    const pools = unwrapList(await bagsFetch("/solana/bags/pools"));
    const feed = unwrapList(await bagsFetch("/token-launch/feed"));
    const byMint = new Map(feed.map((item, i) => [normalizeToken(item, i).mint, normalizeToken(item, i)]));
    const tokens = pools.map((pool, i) => ({ ...normalizeToken(pool, i), ...(byMint.get(normalizeToken(pool, i).mint) ?? {}) }));
    const merged = tokens.length > 0 ? tokens : feed.map(normalizeToken);
    return { tokens: merged.filter((t) => t.mint && !t.mint.startsWith("unknown")), live: true };
  },
);

export const fetchFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ events: FeedEvent[]; live: boolean }> => {
    const list = unwrapList(await bagsFetch("/token-launch/feed"));
    return { events: list.map(normalizeFeedEvent), live: true };
  },
);

export const searchTokens = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }): Promise<{ tokens: Token[]; live: boolean }> => {
    const q = data.query.trim().toLowerCase();
    const { tokens } = await fetchTokens();
    return {
      tokens: tokens.filter((t) =>
        !q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.mint.toLowerCase().includes(q),
      ),
      live: true,
    };
  });

export const fetchTokenDetail = createServerFn({ method: "GET" })
  .inputValidator((d: { mint: string }) => d)
  .handler(async ({ data }): Promise<{ token: Token | null; live: boolean }> => {
    const pool = await bagsFetch(`/solana/bags/pools/token-mint?tokenMint=${encodeURIComponent(data.mint)}`).catch(() => null);
    const feed = unwrapList(await bagsFetch("/token-launch/feed").catch(() => null));
    const launch = feed.map(normalizeToken).find((t) => t.mint === data.mint);
    if (!pool && !launch) return { token: null, live: true };
    let token = { ...(pool ? normalizeToken(asRecord(pool).response ?? pool) : normalizeToken(launch)), ...(launch ?? {}) };
    const fees = await bagsFetch(`/token-launch/lifetime-fees?tokenMint=${encodeURIComponent(data.mint)}`).catch(() => null);
    const feeValue = asRecord(fees).response;
    if (feeValue) token = { ...token, feesEarnedTotal: Number(feeValue) / 1_000_000_000 };
    return { token, live: true };
  });
