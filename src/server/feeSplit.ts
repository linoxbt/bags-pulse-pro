import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Default split (basis points, must sum to 10_000)
export const DEFAULT_SPLIT = {
  creator_bps: 6000, // 60% to AI agent / strategy creator
  platform_bps: 2500, // 25% to Bags platform partner
  treasury_bps: 1500, // 15% to BagsPulse treasury
};

export type FeeSplitRecord = {
  source_tx: string;
  source: string;
  total_lamports: number;
  creator_wallet?: string | null;
  metadata?: Record<string, unknown>;
};

export function computeSplit(totalLamports: number, bps = DEFAULT_SPLIT) {
  const creator = Math.floor((totalLamports * bps.creator_bps) / 10_000);
  const platform = Math.floor((totalLamports * bps.platform_bps) / 10_000);
  const treasury = totalLamports - creator - platform;
  return { creator, platform, treasury };
}

// Server fn: record a routed fee split into Supabase
export const recordFeeSplit = createServerFn({ method: "POST" })
  .inputValidator((d: FeeSplitRecord) => d)
  .handler(async ({ data }) => {
    const split = computeSplit(data.total_lamports);
    const { error } = await supabaseAdmin.from("fee_splits").insert({
      source_tx: data.source_tx,
      source: data.source,
      total_lamports: data.total_lamports,
      creator_wallet: data.creator_wallet ?? null,
      creator_lamports: split.creator,
      platform_lamports: split.platform,
      treasury_lamports: split.treasury,
      creator_bps: DEFAULT_SPLIT.creator_bps,
      platform_bps: DEFAULT_SPLIT.platform_bps,
      treasury_bps: DEFAULT_SPLIT.treasury_bps,
      metadata: data.metadata ?? {},
    });
    if (error) throw new Error(error.message);
    return { success: true, split };
  });

export const getFeeSplitStats = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("fee_splits")
    .select("total_lamports,creator_lamports,platform_lamports,treasury_lamports,source,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const totals = rows.reduce(
    (acc, r) => {
      acc.total += Number(r.total_lamports);
      acc.creator += Number(r.creator_lamports);
      acc.platform += Number(r.platform_lamports);
      acc.treasury += Number(r.treasury_lamports);
      return acc;
    },
    { total: 0, creator: 0, platform: 0, treasury: 0 },
  );
  return { totalsLamports: totals, recent: rows };
});
