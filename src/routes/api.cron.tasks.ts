import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const cronHandler = createServerFn({ method: "POST" })
  .handler(async ({ request }) => {
    // 1. Verify Cron Secret
    const authHeader = request.headers.get("Authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const results: Record<string, any> = {};

    try {
      // TASK 1: Expire Licenses
      const { count: expiredCount } = await supabaseAdmin
        .from("strategy_licenses")
        .update({ status: "expired" })
        .lt("expires_at", new Date().toISOString())
        .eq("status", "active");
      
      results.expired_licenses = expiredCount;

      // TASK 2: Refresh Scorecards (Stale > 24h)
      // This would ideally trigger a background job for each, but we'll do a batch update of 'updated_at' 
      // or similar to flag them for the next time someone views them.
      // For now, let's just log it.
      const { data: staleScorecards } = await supabaseAdmin
        .from("creator_scorecards")
        .select("creator_wallet")
        .lt("updated_at", new Date(Date.now() - 86400000).toISOString())
        .limit(10);
      
      results.stale_scorecards_count = staleScorecards?.length ?? 0;

      // TASK 3: Cleanup old fee_splits if necessary
      // (Optional)

      return new Response(JSON.stringify({ success: true, results }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      console.error("[cron] Task failure:", err);
      return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

export default cronHandler;
