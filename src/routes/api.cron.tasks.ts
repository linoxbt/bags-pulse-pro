import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/cron/tasks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("Authorization");
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const results: Record<string, unknown> = {};

        try {
          const { count: expiredCount } = await supabaseAdmin
            .from("strategy_licenses")
            .update({ status: "expired" })
            .lt("expires_at", new Date().toISOString())
            .eq("status", "active");
          results.expired_licenses = expiredCount;

          const { data: staleScorecards } = await supabaseAdmin
            .from("creator_scorecards")
            .select("creator_wallet")
            .lt("computed_at", new Date(Date.now() - 86400000).toISOString())
            .limit(10);
          results.stale_scorecards_count = staleScorecards?.length ?? 0;

          return new Response(JSON.stringify({ success: true, results }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ success: false, error: (err as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
