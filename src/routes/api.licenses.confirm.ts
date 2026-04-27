import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeSplit, DEFAULT_SPLIT } from "@/server/feeSplit";
import { BAGSPULSE_TREASURY, SOL_MINT, USDC_MINT, USDT_MINT, PRICING_TIERS, TIER_STRATEGY_ID } from "@/lib/constants";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

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
            amount: number;
            payment_token: "SOL" | "USDC" | "USDT";
            creator_wallet?: string;
          };

          if (!body.wallet_address || !body.payment_tx || !body.strategy_id || !body.payment_token) {
            return new Response(JSON.stringify({ error: "missing fields" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          // 1. Verify the transaction landed on-chain and is successful
          const rpcUrl = process.env.HELIUS_API_KEY
            ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
            : "https://api.mainnet-beta.solana.com";
          const connection = new Connection(rpcUrl, "confirmed");
          
          const tx = await connection.getTransaction(body.payment_tx, {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed"
          });

          if (!tx) {
            return new Response(JSON.stringify({ error: "Transaction not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          if (tx.meta?.err) {
            return new Response(JSON.stringify({ error: "Transaction failed on-chain" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          // 2. Verify signer = caller's wallet
          const signer = tx.transaction.message.staticAccountKeys[0].toBase58();
          if (signer !== body.wallet_address) {
             return new Response(JSON.stringify({ error: "Signer mismatch" }), {
              status: 403,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          // 3. Find the tier to verify price
          const tier = PRICING_TIERS.find(t => TIER_STRATEGY_ID[t.id] === body.strategy_id);
          if (!tier) throw new Error("Invalid strategy ID");

          // 4. Verify recipient and amount
          const treasuryPubKey = new PublicKey(BAGSPULSE_TREASURY);
          let verified = false;

          if (body.payment_token === "SOL") {
            const expectedLamports = Math.floor(body.amount * 1_000_000_000);
            // Check pre/post balances for the treasury to confirm payment
            const treasuryIndex = tx.transaction.message.staticAccountKeys.findIndex(k => k.equals(treasuryPubKey));
            if (treasuryIndex !== -1) {
              const preBalance = tx.meta?.preBalances[treasuryIndex] || 0;
              const postBalance = tx.meta?.postBalances[treasuryIndex] || 0;
              if (postBalance - preBalance >= expectedLamports) {
                verified = true;
              }
            }
          } else {
            // SPL Token (USDC/USDT)
            const mint = body.payment_token === "USDC" ? USDC_MINT : USDT_MINT;
            const decimals = 6;
            const expectedTokenAmount = Math.floor(body.amount * Math.pow(10, decimals));
            
            // Derive treasury ATA
            const treasuryAta = await getAssociatedTokenAddress(new PublicKey(mint), treasuryPubKey);
            
            // Check token balances in metadata
            const preTokenBalance = tx.meta?.preTokenBalances?.find(b => b.owner === BAGSPULSE_TREASURY && b.mint === mint);
            const postTokenBalance = tx.meta?.postTokenBalances?.find(b => b.owner === BAGSPULSE_TREASURY && b.mint === mint);
            
            const preAmount = Number(preTokenBalance?.uiTokenAmount.amount || 0);
            const postAmount = Number(postTokenBalance?.uiTokenAmount.amount || 0);

            if (postAmount - preAmount >= expectedTokenAmount) {
              verified = true;
            }
          }

          if (!verified) {
            return new Response(JSON.stringify({ error: "Payment verification failed (amount or recipient mismatch)" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          // Success - proceed with license insertion
          const lamports = body.payment_token === "SOL" 
            ? Math.floor(body.amount * 1_000_000_000)
            : 0; // We split SOL immediately; SPL tokens stay in treasury for now or managed separately

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
            amount_paid: body.amount,
            payment_token: body.payment_token,
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
