import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BAGSPULSE_TREASURY } from "@/lib/constants";

const BAGS_PROGRAM_ID = "FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK";

interface HeliusTransaction {
  signature: string;
  type: string;
  description: string;
  timestamp: number;
  instructions: Array<{ programId: string; accounts: string[]; data: string }>;
}

export const Route = createFileRoute("/api/public/webhooks/helius")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as HeliusTransaction[];
        if (!Array.isArray(body)) return new Response("Invalid body", { status: 400 });

        for (const tx of body) {
          try {
            const signature = tx.signature;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const enhancedTx = tx as any;

            const bagsInstructions = tx.instructions.filter(
              (i) => i.programId === BAGS_PROGRAM_ID,
            );
            if (bagsInstructions.length > 0) {
              for (const inst of bagsInstructions) {
                const accounts = inst.accounts;
                const { data: partner } = await supabaseAdmin
                  .from("partner_registry")
                  .select("id, app_id, fee_wallet, bps")
                  .in("fee_wallet", accounts)
                  .eq("is_active", true)
                  .maybeSingle();

                if (partner) {
                  const totalLamports = (enhancedTx.nativeTransfers ?? []).reduce(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (s: number, n: any) => s + (n.amount || 0),
                    0,
                  );
                  await supabaseAdmin.from("fee_splits").insert({
                    source_tx: signature,
                    source: partner.app_id,
                    total_lamports: totalLamports,
                    platform_lamports: (totalLamports * partner.bps) / 10000,
                    platform_bps: partner.bps,
                    metadata: { mint: accounts[accounts.length - 1], type: "pulserouter" },
                  });
                }
              }
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const nativeTransfers = (enhancedTx.nativeTransfers ?? []) as any[];
            const treasuryTransfers = nativeTransfers.filter(
              (t) => t.toUserAccount === BAGSPULSE_TREASURY,
            );
            for (const t of treasuryTransfers) {
              const { data: existing } = await supabaseAdmin
                .from("fee_splits")
                .select("id")
                .eq("source_tx", signature)
                .maybeSingle();
              if (!existing) {
                await supabaseAdmin.from("fee_splits").insert({
                  source_tx: signature,
                  source: "direct_revenue",
                  total_lamports: t.amount,
                  treasury_lamports: t.amount,
                  metadata: { from: t.fromUserAccount, type: "native_transfer" },
                });
              }
            }
          } catch (err) {
            console.error(`[helius-webhook] Error processing tx ${tx.signature}:`, err);
          }
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
