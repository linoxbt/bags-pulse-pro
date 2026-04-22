import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeSplit, DEFAULT_SPLIT } from "@/server/feeSplit";

// Confirm a Blink subscription payment, register the strategy license, and
// route the fee split through PulseRouter accounting.
//
// In production, this would also CPI to a Bubblegum/Helius cNFT mint — for now
// we record the license row with a placeholder cnft_mint that downstream pages
// can resolve. The license row is the authoritative on-platform proof.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const Route = createFileRoute("/api/licenses/confirm")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            user_id?: string;
            wallet_address: string;
            strategy_id: string;
            payment_tx: string;
            amount_sol: number;
            creator_wallet?: string;
          };

          if (!body.wallet_address || !body.payment_tx || !body.strategy_id) {
            return new Response(JSON.stringify({ error: "missing fields" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          // Verify the transaction landed on-chain via Helius RPC
          const rpc = process.env.HELIUS_API_KEY
            ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
            : "https://api.mainnet-beta.solana.com";
          const sigRes = await fetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getSignatureStatuses",
              params: [[body.payment_tx], { searchTransactionHistory: true }],
            }),
          });
          const sigJson = (await sigRes.json()) as { result?: { value?: Array<{ confirmationStatus?: string } | null> } };
          const status = sigJson.result?.value?.[0]?.confirmationStatus;
          if (!status || (status !== "confirmed" && status !== "finalized")) {
            return new Response(
              JSON.stringify({ error: "payment not confirmed yet", status }),
              { status: 402, headers: { "Content-Type": "application/json", ...CORS } },
            );
          }

          const lamports = Math.floor(body.amount_sol * 1_000_000_000);
          const split = computeSplit(lamports);
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

          // Insert the license (fake cnft_mint until we wire Bubblegum)
          const cnftMint = `bp-license-${body.strategy_id}-${body.payment_tx.slice(0, 8)}`;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const licenseInsert = await (supabaseAdmin.from("strategy_licenses") as any).insert({
            user_id: body.user_id ?? null,
            wallet_address: body.wallet_address,
            strategy_id: body.strategy_id,
            cnft_mint: cnftMint,
            payment_tx: body.payment_tx,
            amount_paid: body.amount_sol,
            payment_token: "SOL",
            expires_at: expiresAt,
            status: "active",
          });

          if (licenseInsert.error) throw new Error(licenseInsert.error.message);

          // Record the PulseRouter fee split
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabaseAdmin.from("fee_splits") as any).insert({
            source_tx: body.payment_tx,
            source: `blink:${body.strategy_id}`,
            total_lamports: lamports,
            creator_wallet: body.creator_wallet ?? null,
            creator_lamports: split.creator,
            platform_lamports: split.platform,
            treasury_lamports: split.treasury,
            creator_bps: DEFAULT_SPLIT.creator_bps,
            platform_bps: DEFAULT_SPLIT.platform_bps,
            treasury_bps: DEFAULT_SPLIT.treasury_bps,
            metadata: { strategy_id: body.strategy_id },
          });

          return new Response(
            JSON.stringify({
              success: true,
              cnft_mint: cnftMint,
              expires_at: expiresAt,
              split,
            }),
            { headers: { "Content-Type": "application/json", ...CORS } },
          );
        } catch (err) {
          console.error("[license confirm]", err);
          return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
      },
    },
  },
});
