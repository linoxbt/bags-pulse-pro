import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BAGSPULSE_TREASURY, PULSEROUTER_PROTOCOL_BPS } from "@/lib/constants";

export const Route = createFileRoute("/api/public/router/partner")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const appId = url.searchParams.get("app_id");
        if (!appId) {
          return new Response(JSON.stringify({ error: "app_id required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { data: partner } = await supabaseAdmin
          .from("partner_registry")
          .select("app_id,app_name,fee_wallet,bps,is_active")
          .eq("app_id", appId)
          .eq("is_active", true)
          .maybeSingle();

        if (!partner) {
          return new Response(JSON.stringify({ error: "Partner not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            ...partner,
            treasury: BAGSPULSE_TREASURY,
            protocol_bps: PULSEROUTER_PROTOCOL_BPS,
          }),
          { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
        );
      },
    },
  },
});
