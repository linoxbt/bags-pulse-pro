import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BAGS_BASE = "https://public-api-v2.bags.fm/api/v1";

export type ClaimablePosition = {
  mint: string;
  symbol: string;
  name: string;
  amount: number;
  amountUsd: number;
  feeBps: number;
};

async function bagsFetch(path: string): Promise<unknown | null> {
  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`${BAGS_BASE}${path}`, {
      headers: { "x-api-key": apiKey, accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Get all claimable fee positions for a wallet.
// Falls back to a deterministic sample so the UI shows real claim mechanics.
export const getClaimablePositions = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet: string }) => d)
  .handler(async ({ data }): Promise<{ positions: ClaimablePosition[]; live: boolean }> => {
    const live = (await bagsFetch(
      `/fee-share/claimable-positions?wallet=${data.wallet}`,
    )) as { positions?: unknown[] } | null;

    if (live && Array.isArray(live.positions) && live.positions.length > 0) {
      const positions: ClaimablePosition[] = live.positions.slice(0, 50).map((raw) => {
        const p = raw as Record<string, unknown>;
        return {
          mint: String(p.mint ?? ""),
          symbol: String(p.symbol ?? "?"),
          name: String(p.name ?? "Unknown"),
          amount: Number(p.amount ?? 0),
          amountUsd: Number(p.amountUsd ?? 0),
          feeBps: Number(p.feeBps ?? 0),
        };
      });
      return { positions, live: true };
    }

    // Sample fallback so the claim UI is testable without a funded wallet
    return {
      positions: [
        { mint: "PULSE0000", symbol: "PULSE", name: "PulseDAO", amount: 1.234, amountUsd: 184.5, feeBps: 100 },
        { mint: "NOVA0000", symbol: "NOVA", name: "NovaBags", amount: 0.482, amountUsd: 72.4, feeBps: 100 },
        { mint: "FROG0000", symbol: "FROG", name: "PondLord", amount: 0.097, amountUsd: 14.6, feeBps: 100 },
      ],
      live: false,
    };
  });

// Build an unsigned claim transaction for the user's wallet to sign.
// Returns base64-encoded serialized transaction (Bags REST returns this format).
export const buildClaimTransaction = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet: string; mints: string[] }) => d)
  .handler(async ({ data }): Promise<{ transaction: string | null; error?: string }> => {
    const apiKey = process.env.BAGS_API_KEY;
    if (!apiKey) {
      return { transaction: null, error: "Bags API key not configured" };
    }
    try {
      const res = await fetch(`${BAGS_BASE}/fee-share/build-claim-transaction`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ wallet: data.wallet, mints: data.mints }),
      });
      if (!res.ok) {
        return { transaction: null, error: `Bags returned ${res.status}` };
      }
      const json = (await res.json()) as { transaction?: string };
      return { transaction: json.transaction ?? null };
    } catch (e) {
      return { transaction: null, error: (e as Error).message };
    }
  });

// Record a successful claim in our DB.
export const recordFeeClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    wallet: string;
    mint: string;
    symbol: string;
    amount: number;
    amountUsd: number;
    txSignature: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("fee_claims").insert({
      user_id: userId,
      wallet_address: data.wallet,
      mint: data.mint,
      symbol: data.symbol,
      amount: data.amount,
      amount_usd: data.amountUsd,
      tx_signature: data.txSignature,
      status: "confirmed",
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });
