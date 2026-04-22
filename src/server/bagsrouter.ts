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
      `/token-launch/claimable-positions?wallet=${data.wallet}`,
    )) as { positions?: unknown[]; response?: unknown[] } | null;

    const list = Array.isArray(live?.response) ? live.response : Array.isArray(live?.positions) ? live.positions : [];
    if (list.length > 0) {
      const positions: ClaimablePosition[] = list.slice(0, 50).map((raw) => {
        const p = raw as Record<string, unknown>;
        return {
          mint: String(p.tokenMint ?? p.mint ?? ""),
          symbol: String(p.symbol ?? "?"),
          name: String(p.name ?? "Unknown"),
          amount: Number(p.amount ?? p.claimableAmount ?? 0),
          amountUsd: Number(p.amountUsd ?? p.claimableAmountUsd ?? 0),
          feeBps: Number(p.feeBps ?? 0),
        };
      });
      return { positions, live: true };
    }

    return { positions: [], live: true };
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
      const res = await fetch(`${BAGS_BASE}/token-launch/claim-txs/v3`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ feeClaimer: data.wallet, tokenMint: data.mints[0] }),
      });
      if (!res.ok) {
        return { transaction: null, error: `Bags returned ${res.status}` };
      }
      const json = (await res.json()) as { transaction?: string; response?: string | { transaction?: string } };
      const responseTx = typeof json.response === "string" ? json.response : json.response?.transaction;
      return { transaction: json.transaction ?? responseTx ?? null };
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
