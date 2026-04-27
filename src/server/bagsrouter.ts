import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BagsSDK } from "@bagsfm/bags-sdk";
import { Connection, PublicKey } from "@solana/web3.js";

const BAGS_BASE = "https://public-api-v2.bags.fm/api/v1";

export type ClaimablePosition = {
  mint: string;
  symbol: string;
  name: string;
  amount: number;
  amountUsd: number;
  feeBps: number;
};

function heliusRpc() {
  return process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : "https://api.mainnet-beta.solana.com";
}

async function bagsFetch(path: string): Promise<unknown | null> {
  const apiKey = process.env.BAGS_PARTNER_KEY || process.env.BAGS_API_KEY;
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

// Get all claimable fee positions for a wallet from the live Bags fee program.
export const getClaimablePositions = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet: string }) => d)
  .handler(async ({ data }): Promise<{ positions: ClaimablePosition[]; live: boolean }> => {
    const live = (await bagsFetch(
      `/token-launch/claimable-positions?wallet=${data.wallet}`,
    )) as { positions?: unknown[]; response?: unknown[] } | null;

    const list = Array.isArray(live?.response)
      ? live.response
      : Array.isArray(live?.positions)
        ? live.positions
        : [];
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

// Build claim transactions via Bags SDK's FeesService.
// Returns base64-encoded legacy Transactions (the SDK returns `Transaction`, not versioned).
export const buildClaimTransaction = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet: string; mints: string[] }) => d)
  .handler(
    async ({
      data,
    }): Promise<{ transactions: string[]; error?: string }> => {
      const apiKey = process.env.BAGS_PARTNER_KEY || process.env.BAGS_API_KEY;
      if (!apiKey) {
        return { transactions: [], error: "Bags API key not configured" };
      }
      try {
        const sdk = new BagsSDK(apiKey, new Connection(heliusRpc(), "confirmed"));
        const claimer = new PublicKey(data.wallet);
        const out: string[] = [];
        for (const m of data.mints) {
          const txs = await sdk.fee.getClaimTransactions(claimer, new PublicKey(m));
          for (const tx of txs) {
            const serialized = tx.serialize({
              requireAllSignatures: false,
              verifySignatures: false,
            });
            out.push(Buffer.from(serialized).toString("base64"));
          }
        }
        return { transactions: out };
      } catch (e) {
        return { transactions: [], error: (e as Error).message };
      }
    },
  );

// Record a successful claim in our DB.
export const recordFeeClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      wallet: string;
      mint: string;
      symbol: string;
      amount: number;
      amountUsd: number;
      txSignature: string;
    }) => d,
  )
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
