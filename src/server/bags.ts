import { createServerFn } from "@tanstack/react-start";

const BAGS_BASE = "https://public-api-v2.bags.fm/api/v1";
const DEX_BASE = "https://api.dexscreener.com";

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

type DexPair = {
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  info?: { imageUrl?: string };
  pairCreatedAt?: number;
  liquidity?: { usd?: number };
};

async function dexFetchBatch(mints: string[]): Promise<Map<string, DexPair>> {
  const map = new Map<string, DexPair>();
  // DexScreener accepts up to 30 mints per call
  const chunks: string[][] = [];
  for (let i = 0; i < mints.length; i += 30) chunks.push(mints.slice(i, i + 30));
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const res = await fetch(`${DEX_BASE}/tokens/v1/solana/${chunk.join(",")}`, {
          headers: { accept: "application/json" },
        });
        if (!res.ok) return;
        const arr = (await res.json()) as DexPair[];
        if (!Array.isArray(arr)) return;
        for (const pair of arr) {
          const addr = pair.baseToken?.address;
          if (!addr) continue;
          const existing = map.get(addr);
          // Pick the pair with highest liquidity
          if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
            map.set(addr, pair);
          }
        }
      } catch (err) {
        console.error(`[dex] batch failed`, err);
      }
    }),
  );
  return map;
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

function normalizeBagsToken(raw: unknown, i = 0): Token {
  const t = asRecord(raw);
  const mint = String(t.tokenMint ?? t.mint ?? t.address ?? `unknown-${i}`);
  const symbol = String(t.symbol ?? "?");
  const status = typeof t.status === "string" ? t.status : null;
  return {
    mint,
    name: String(t.name ?? symbol),
    symbol,
    image: String(t.image ?? t.imageUrl ?? t.logoURI ?? ""),
    description: String(t.description ?? ""),
    creator: String(t.creatorName ?? t.providerUsername ?? t.creator ?? "bags creator"),
    creatorWallet: String(t.creatorWallet ?? t.creator ?? t.wallet ?? ""),
    marketCap: 0,
    price: 0,
    volume24h: 0,
    holders: 0,
    feesEarned24h: 0,
    feesEarnedTotal: 0,
    change24h: 0,
    graduated: status === "GRADUATED" || Boolean(t.dammV2PoolKey),
    launchedAt: String(t.launchedAt ?? t.createdAt ?? new Date().toISOString()),
    website: typeof t.website === "string" && t.website ? t.website : null,
    twitter: typeof t.twitter === "string" && t.twitter ? t.twitter : null,
    status,
    dbcPoolKey: typeof t.dbcPoolKey === "string" ? t.dbcPoolKey : null,
    dammV2PoolKey: typeof t.dammV2PoolKey === "string" ? t.dammV2PoolKey : null,
  };
}

function enrichWithDex(token: Token, pair: DexPair | undefined): Token {
  if (!pair) return token;
  const price = Number(pair.priceUsd ?? 0);
  const marketCap = Number(pair.marketCap ?? pair.fdv ?? 0);
  const volume24h = Number(pair.volume?.h24 ?? 0);
  const change24h = Number(pair.priceChange?.h24 ?? 0);
  return {
    ...token,
    price: Number.isFinite(price) ? price : 0,
    marketCap: Number.isFinite(marketCap) ? marketCap : 0,
    volume24h: Number.isFinite(volume24h) ? volume24h : 0,
    change24h: Number.isFinite(change24h) ? change24h : 0,
    // Bags creator fees ≈ 1% of volume on the bonding curve
    feesEarned24h: Number.isFinite(volume24h) ? volume24h * 0.01 : 0,
    image: token.image || pair.info?.imageUrl || "",
    launchedAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : token.launchedAt,
  };
}

async function loadBagsTokens(): Promise<Token[]> {
  const feed = unwrapList(await bagsFetch("/token-launch/feed"));
  const tokens = feed.map((raw, i) => normalizeBagsToken(raw, i)).filter((t) => !t.mint.startsWith("unknown"));
  if (tokens.length === 0) return [];
  // Enrich with DexScreener market data
  const dexMap = await dexFetchBatch(tokens.map((t) => t.mint));
  const enriched = tokens.map((t) => enrichWithDex(t, dexMap.get(t.mint)));
  // Sort by market cap (the leaderboard signal)
  return enriched.sort((a, b) => b.marketCap - a.marketCap);
}

export const fetchTokens = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ tokens: Token[]; live: boolean }> => {
    const tokens = await loadBagsTokens();
    return { tokens, live: tokens.length > 0 };
  },
);

function feedEventFromToken(token: Token, raw: Record<string, unknown>, i: number): FeedEvent {
  const status = String(raw.status ?? token.status ?? "").toUpperCase();
  const isGrad = status.includes("GRAD") || token.graduated;
  return {
    id: String(raw.launchSignature ?? raw.signature ?? token.mint ?? `feed-${i}`),
    type: isGrad ? "graduation" : "launch",
    token: token.name,
    symbol: token.symbol,
    mint: token.mint,
    amountUsd: token.marketCap,
    actor: token.creatorWallet || token.creator,
    message: isGrad ? `${token.symbol} graduated on Bags` : `${token.symbol} launched on Bags`,
    at: token.launchedAt,
  };
}

// Pull recent on-chain txs from Helius (parsed) so the feed shows buys, sells,
// fees and milestones — not only launch / graduation events from Bags.
type ParsedTx = {
  signature: string;
  timestamp: number;
  description?: string;
  feePayer?: string;
  tokenTransfers?: Array<{ fromUserAccount?: string; toUserAccount?: string; mint: string; tokenAmount: number }>;
  nativeTransfers?: Array<{ fromUserAccount?: string; toUserAccount?: string; amount: number }>;
};
function shortAddr(a?: string) {
  if (!a) return "anon";
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}
async function fetchHeliusTxs(mint: string, limit = 4): Promise<ParsedTx[]> {
  const key = process.env.HELIUS_API_KEY?.trim();
  if (!key) return [];
  try {
    const url = `https://api.helius.xyz/v0/addresses/${mint}/transactions?api-key=${key}&limit=${limit}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return [];
    const arr = (await res.json()) as ParsedTx[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function txToEvent(tx: ParsedTx, token: Token): FeedEvent {
  const transfers = tx.tokenTransfers ?? [];
  const inflow = transfers.filter((t) => t.mint === token.mint && t.toUserAccount).reduce((s, t) => s + (t.tokenAmount ?? 0), 0);
  const outflow = transfers.filter((t) => t.mint === token.mint && t.fromUserAccount).reduce((s, t) => s + (t.tokenAmount ?? 0), 0);
  const sol = (tx.nativeTransfers ?? []).reduce((s, n) => s + Math.abs(n.amount ?? 0), 0) / 1_000_000_000;
  const looksFee = (tx.description ?? "").toLowerCase().includes("claim") || (tx.description ?? "").toLowerCase().includes("fee");
  let type: FeedEvent["type"] = "milestone";
  let message = tx.description || `${token.symbol} on-chain activity`;
  if (looksFee) {
    type = "fee";
    message = `${token.symbol}: creator fee claim`;
  } else if (inflow > outflow && inflow > 0) {
    type = "buy";
    message = `${token.symbol} buy: ${inflow.toFixed(2)} tokens`;
  } else if (outflow > inflow && outflow > 0) {
    type = "sell";
    message = `${token.symbol} sell: ${outflow.toFixed(2)} tokens`;
  }
  return {
    id: tx.signature,
    type,
    token: token.name,
    symbol: token.symbol,
    mint: token.mint,
    amountUsd: sol * (token.price > 0 ? 200 : 200),
    actor: shortAddr(tx.feePayer),
    message,
    at: new Date((tx.timestamp ?? Date.now() / 1000) * 1000).toISOString(),
  };
}

export const fetchFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ events: FeedEvent[]; live: boolean }> => {
    const raw = unwrapList(await bagsFetch("/token-launch/feed"));
    if (raw.length === 0) return { events: [], live: false };
    const tokens = raw.map((r, i) => normalizeBagsToken(r, i));
    const dexMap = await dexFetchBatch(tokens.map((t) => t.mint));
    const enriched = tokens.map((t) => enrichWithDex(t, dexMap.get(t.mint)));
    // Launch / graduation events from the Bags feed
    const launchEvents = enriched.map((t, i) => feedEventFromToken(t, asRecord(raw[i]), i));
    // On-chain events from Helius for the top mints (cap to control latency)
    const topMints = enriched.slice(0, 6);
    const onchainBatches = await Promise.all(
      topMints.map(async (t) => {
        const txs = await fetchHeliusTxs(t.mint, 4);
        return txs.map((tx) => txToEvent(tx, t));
      }),
    );
    const onchainEvents = onchainBatches.flat();
    const all = [...launchEvents, ...onchainEvents].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
    return { events: all.slice(0, 80), live: true };
  },
);

export const searchTokens = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }): Promise<{ tokens: Token[]; live: boolean }> => {
    const q = data.query.trim().toLowerCase();
    const { tokens, live } = await fetchTokens();
    return {
      tokens: tokens.filter(
        (t) =>
          !q ||
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.mint.toLowerCase().includes(q),
      ),
      live,
    };
  });

export const fetchTokenDetail = createServerFn({ method: "GET" })
  .inputValidator((d: { mint: string }) => d)
  .handler(async ({ data }): Promise<{ token: Token | null; live: boolean }> => {
    const feed = unwrapList(await bagsFetch("/token-launch/feed"));
    const found = feed.map((r, i) => normalizeBagsToken(r, i)).find((t) => t.mint === data.mint);
    let token: Token | null = found ?? null;
    // Always try to enrich via DexScreener even if not in the recent feed
    try {
      const dexMap = await dexFetchBatch([data.mint]);
      const pair = dexMap.get(data.mint);
      if (pair) {
        const base: Token = token ?? {
          mint: data.mint,
          name: pair.baseToken?.name ?? pair.baseToken?.symbol ?? "Unknown",
          symbol: pair.baseToken?.symbol ?? "?",
          image: pair.info?.imageUrl ?? "",
          description: "",
          creator: "bags creator",
          creatorWallet: "",
          marketCap: 0,
          price: 0,
          volume24h: 0,
          holders: 0,
          feesEarned24h: 0,
          feesEarnedTotal: 0,
          change24h: 0,
          graduated: false,
          launchedAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : new Date().toISOString(),
          website: null,
          twitter: null,
          status: null,
          dbcPoolKey: null,
          dammV2PoolKey: null,
        };
        token = enrichWithDex(base, pair);
      }
    } catch (err) {
      console.error("[bags] dex enrich failed", err);
    }
    if (!token) return { token: null, live: false };
    // Lifetime fees from Bags
    const fees = await bagsFetch(`/token-launch/lifetime-fees?tokenMint=${encodeURIComponent(data.mint)}`).catch(() => null);
    const feeValue = asRecord(fees).response;
    if (feeValue !== undefined) {
      const lamports = Number(feeValue);
      if (Number.isFinite(lamports)) token = { ...token, feesEarnedTotal: lamports / 1_000_000_000 };
    }
    return { token, live: true };
  });
