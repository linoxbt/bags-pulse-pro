import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BAGS_PROGRAM_ID = "FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK";

interface HeliusTransaction {
  signature: string;
  type: string;
  description: string;
  timestamp: number;
  instructions: Array<{
    programId: string;
    accounts: string[];
    data: string;
  }>;
}

export const heliusWebhookHandler = createServerFn({ method: "POST" })
  .handler(async ({ request }) => {
    // 1. Verify Helius Auth (Optional but recommended)
    // const authHeader = request.headers.get("Authorization");
    // if (process.env.HELIUS_WEBHOOK_SECRET && authHeader !== process.env.HELIUS_WEBHOOK_SECRET) {
    //   return new Response("Unauthorized", { status: 401 });
    // }

    const body = await request.json() as HeliusTransaction[];
    if (!Array.isArray(body)) {
      return new Response("Invalid body", { status: 400 });
    }

    console.log(`[helius-webhook] Received ${body.length} transactions`);

    for (const tx of body) {
      try {
        const signature = tx.signature;
        const enhancedTx = tx as any;

        // 1. Check for Bags Program (PulseRouter) fees
        const bagsInstructions = tx.instructions.filter(i => i.programId === BAGS_PROGRAM_ID);
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
              const totalLamports = (enhancedTx.nativeTransfers ?? []).reduce((s: number, n: any) => s + (n.amount || 0), 0);
              
              // 1. Index the split
              await supabaseAdmin.from("fee_splits").insert({
                source_tx: signature,
                source: partner.app_id,
                total_lamports: totalLamports,
                platform_lamports: (totalLamports * partner.bps) / 10000,
                platform_bps: partner.bps,
                metadata: { mint: accounts[accounts.length - 1], type: "pulserouter" }
              });

              // 2. Update partner stats (manual increment since we can't use RPC)
              const { data: currentPartner } = await supabaseAdmin
                .from("partner_registry")
                .select("total_fees_earned, total_tokens_launched")
                .eq("id", partner.id)
                .maybeSingle();

              if (currentPartner) {
                await supabaseAdmin
                  .from("partner_registry")
                  .update({
                    total_fees_earned: (Number(currentPartner.total_fees_earned) || 0) + (totalLamports / 1e9),
                    total_tokens_launched: (Number(currentPartner.total_tokens_launched) || 0) + 1
                  })
                  .eq("id", partner.id);
              }
            }
          }
        }

        // 2. Check for native SOL transfers to Treasury (Revenue)
        const nativeTransfers = (enhancedTx.nativeTransfers ?? []) as any[];
        const treasuryTransfers = nativeTransfers.filter(t => t.toUserAccount === BAGSPULSE_TREASURY);
        
        for (const t of treasuryTransfers) {
          // If it's not already indexed via PulseRouter logic above
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
              metadata: { from: t.fromUserAccount, type: "native_transfer" }
            });
          }
        }
      } catch (err) {
        console.error(`[helius-webhook] Error processing tx ${tx.signature}:`, err);
      }
    }

    return new Response("OK", { status: 200 });
  });

export default heliusWebhookHandler;
