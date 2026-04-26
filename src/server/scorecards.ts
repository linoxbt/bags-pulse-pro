// Creator scorecards — fee yield, holder diversity, trading activity, health.
// Source: live Bags + DexScreener data already wired in src/server/bags.ts.
// Cached into public.creator_scorecards so we don't recompute on every hit.
import { createServerFn } from "@tanstack/react-start";
import { fetchTokens, type Token } from "@/server/bags";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Scorecard = {
  creatorWallet: string;
  displayName: string;
  launchesCount: number;
  graduatedCount: number;
  graduationRate: number;
  totalMarketCap: number;
  totalVolume24h: number;
  totalFeesLifetime: number;
  totalHolders: number;
  feeYieldPct: number;
  holderDiversityScore: number;
  tradingActivityScore: number;
  healthScore: number;
  topTokens: Array<{ mint: string; symbol: string; image: string; marketCap: number }>;
};

const log10 = (n: number) => (n > 0 ? Math.log10(n) : 0);

function computeScorecard(creatorKey: string, displayName: string, launches: Token[]): Scorecard {
  const totalMcap = launches.reduce((s, t) => s + t.marketCap, 0);
  const totalVol = launches.reduce((s, t) => s + t.volume24h, 0);
  const totalFees = launches.reduce((s, t) => s + t.feesEarnedTotal, 0);
  const totalHolders = launches.reduce((s, t) => s + (t.holders || 0), 0);
  const graduated = launches.filter((t) => t.graduated).length;
  const graduationRate = launches.length ? graduated / launches.length : 0;

  // Fee yield = lifetime fees / total volume (capped at a sane 100%)
  const feeYield = totalVol > 0 ? Math.min(1, totalFees / totalVol) * 100 : 0;

  // Holder diversity = avg holders per token, normalized 0-100 on log scale
  const avgHolders = launches.length ? totalHolders / launches.length : 0;
  const diversity = Math.min(100, Math.round(log10(avgHolders + 1) * 25));

  // Trading activity = log of total volume + log of launch count
  const activity = Math.min(100, Math.round(log10(totalVol + 1) * 12 + Math.min(launches.length, 12) * 2));

  // Composite health (0-100)
  const health = Math.min(
    100,
    Math.round(
      log10(totalMcap + 1) * 8 +
        log10(totalFees + 1) * 6 +
        graduationRate * 30 +
        Math.min(launches.length, 10) * 2.5 +
        diversity * 0.15 +
        activity * 0.15,
    ),
  );

  return {
    creatorWallet: creatorKey,
    displayName,
    launchesCount: launches.length,
    graduatedCount: graduated,
    graduationRate: Number(graduationRate.toFixed(3)),
    totalMarketCap: totalMcap,
    totalVolume24h: totalVol,
    totalFeesLifetime: totalFees,
    totalHolders,
    feeYieldPct: Number(feeYield.toFixed(3)),
    holderDiversityScore: diversity,
    tradingActivityScore: activity,
    healthScore: health,
    topTokens: launches
      .slice()
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 5)
      .map((t) => ({ mint: t.mint, symbol: t.symbol, image: t.image, marketCap: t.marketCap })),
  };
}

async function persist(score: Scorecard) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin.from("creator_scorecards") as any).upsert(
    {
      creator_wallet: score.creatorWallet,
      display_name: score.displayName,
      launches_count: score.launchesCount,
      graduated_count: score.graduatedCount,
      total_market_cap: score.totalMarketCap,
      total_volume_24h: score.totalVolume24h,
      total_fees_lifetime: score.totalFeesLifetime,
      total_holders: score.totalHolders,
      fee_yield_pct: score.feeYieldPct,
      holder_diversity_score: score.holderDiversityScore,
      trading_activity_score: score.tradingActivityScore,
      health_score: score.healthScore,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "creator_wallet" },
  );
}

export const getCreatorScorecard = createServerFn({ method: "POST" })
  .inputValidator((d: { creator: string }) => d)
  .handler(async ({ data }): Promise<{ scorecard: Scorecard | null }> => {
    const key = data.creator;
    const { tokens } = await fetchTokens();
    const launches = tokens.filter(
      (t) => t.creatorWallet === key || t.creator.toLowerCase() === key.toLowerCase(),
    );
    if (launches.length === 0) return { scorecard: null };
    const display = launches[0].creator || launches[0].creatorWallet || key;
    const score = computeScorecard(launches[0].creatorWallet || key, display, launches);
    persist(score).catch(() => {});
    return { scorecard: score };
  });

export const listTopCreators = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ creators: Scorecard[] }> => {
    const { tokens } = await fetchTokens();
    const byCreator = new Map<string, Token[]>();
    for (const t of tokens) {
      const key = t.creatorWallet || t.creator;
      if (!key) continue;
      if (!byCreator.has(key)) byCreator.set(key, []);
      byCreator.get(key)!.push(t);
    }
    const cards: Scorecard[] = [];
    for (const [key, launches] of byCreator) {
      if (launches.length < 1) continue;
      cards.push(computeScorecard(key, launches[0].creator || key, launches));
    }
    cards.sort((a, b) => b.healthScore - a.healthScore);
    const top = cards.slice(0, 24);
    // Persist asynchronously
    Promise.all(top.map(persist)).catch(() => {});
    return { creators: top };
  },
);
