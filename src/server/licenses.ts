// Server-side license helpers. The hybrid gating model:
//   • UI shows upgrade prompts using `getMyLicenseTier`
//   • Critical server functions (agent runs, MCP, batch claims, swap fee
//     redirection) call `assertTier` to enforce the gate.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TIER_STRATEGY_ID, type TierId } from "@/lib/constants";

export type LicenseSummary = {
  tier: TierId;
  expiresAt: string | null;
  active: boolean;
};

const TIER_RANK: Record<TierId, number> = { starter: 0, pro: 1, elite: 2 };

// Returns the highest active tier the authenticated user owns.
export const getMyLicenseTier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LicenseSummary> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("strategy_licenses")
      .select("strategy_id,expires_at,status")
      .eq("user_id", userId)
      .eq("status", "active");
    const rows = data ?? [];
    let best: TierId = "starter";
    let bestExpires: string | null = null;
    for (const row of rows) {
      if (row.expires_at && new Date(row.expires_at) <= new Date()) continue;
      if (row.strategy_id === TIER_STRATEGY_ID.elite) {
        best = "elite";
        bestExpires = row.expires_at ?? bestExpires;
      } else if (row.strategy_id === TIER_STRATEGY_ID.pro && best !== "elite") {
        best = "pro";
        bestExpires = row.expires_at ?? bestExpires;
      }
    }
    return { tier: best, expiresAt: bestExpires, active: best !== "starter" };
  });

export async function resolveTier(supabase: { from: (t: string) => unknown }, userId: string): Promise<TierId> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("strategy_licenses") as any)
    .select("strategy_id,expires_at,status")
    .eq("user_id", userId)
    .eq("status", "active");
  const rows = (data ?? []) as Array<{ strategy_id: string; expires_at: string | null }>;
  let best: TierId = "starter";
  for (const row of rows) {
    if (row.expires_at && new Date(row.expires_at) <= new Date()) continue;
    if (row.strategy_id === TIER_STRATEGY_ID.elite) return "elite";
    if (row.strategy_id === TIER_STRATEGY_ID.pro) best = "pro";
  }
  return best;
}

export function tierAtLeast(tier: TierId, required: TierId) {
  return TIER_RANK[tier] >= TIER_RANK[required];
}

export class TierError extends Error {
  status = 402;
  required: TierId;
  current: TierId;
  constructor(required: TierId, current: TierId) {
    super(`This feature requires the ${required} plan (you have ${current}).`);
    this.required = required;
    this.current = current;
  }
}
