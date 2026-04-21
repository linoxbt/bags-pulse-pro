import { createServerFn } from "@tanstack/react-start";
import { getSampleTokens, getSampleFeed, type Token, type FeedEvent } from "@/lib/sample-data";

const BAGS_BASE = "https://public-api-v2.bags.fm/api/v1";

async function bagsFetch(path: string): Promise<unknown | null> {
  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`${BAGS_BASE}${path}`, {
      headers: {
        "x-api-key": apiKey,
        accept: "application/json",
      },
    });
    if (!res.ok) {
      console.warn(`[bags] ${path} -> ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[bags] ${path} failed`, err);
    return null;
  }
}

// Returns leaderboard tokens. Falls back to sample data if Bags API is
// unreachable / unauthorized so the UI always renders.
export const fetchTokens = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ tokens: Token[]; live: boolean }> => {
    const data = (await bagsFetch("/token-launch/trending")) as
      | { tokens?: unknown[]; data?: unknown[] }
      | null;

    const list =
      (data && (Array.isArray((data as { data?: unknown[] }).data)
        ? (data as { data: unknown[] }).data
        : Array.isArray((data as { tokens?: unknown[] }).tokens)
          ? (data as { tokens: unknown[] }).tokens
          : null)) || null;

    if (list && list.length > 0) {
      const tokens: Token[] = list.slice(0, 30).map((raw, i) => {
        const t = raw as Record<string, unknown>;
        const mc = Number(t.marketCap ?? t.market_cap ?? t.fdv ?? 0);
        const vol = Number(t.volume24h ?? t.volume ?? 0);
        return {
          mint: String(t.mint ?? t.address ?? `unknown-${i}`),
          name: String(t.name ?? "Unknown"),
          symbol: String(t.symbol ?? "?"),
          image: String(
            t.image ??
              t.logoURI ??
              `https://api.dicebear.com/7.x/shapes/svg?seed=${t.symbol ?? i}`,
          ),
          creator: String(t.creatorName ?? t.creator ?? "anon"),
          creatorWallet: String(t.creatorWallet ?? t.creator ?? ""),
          marketCap: mc,
          price: Number(t.price ?? mc / 1_000_000_000),
          volume24h: vol,
          holders: Number(t.holders ?? 0),
          feesEarned24h: Number(t.fees24h ?? vol * 0.01),
          feesEarnedTotal: Number(t.feesTotal ?? vol * 0.01 * 30),
          change24h: Number(t.change24h ?? t.priceChange24h ?? 0),
          graduated: Boolean(t.graduated ?? false),
          launchedAt: String(t.launchedAt ?? t.createdAt ?? new Date().toISOString()),
        };
      });
      return { tokens, live: true };
    }

    return { tokens: getSampleTokens(), live: false };
  },
);

export const fetchFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ events: FeedEvent[]; live: boolean }> => {
    // Bags doesn't expose a unified feed endpoint publicly; we synthesize one from sample data.
    return { events: getSampleFeed(), live: false };
  },
);
