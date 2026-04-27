import { createServerFileRoute } from "@tanstack/start";
import { z } from "zod";
import { getPartnerByAppId } from "@/server/partners";

/**
 * Public endpoint for PulseRouter SDK to resolve partner configuration.
 * Returns the fee_wallet and BPS for a given app_id.
 */
export const Route = createServerFileRoute("/api/public/router/partner")({
  loader: async ({ request }) => {
    const url = new URL(request.url);
    const appId = url.searchParams.get("app_id");

    if (!appId) {
      return new Response(JSON.stringify({ error: "app_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const { partner } = await getPartnerByAppId({ data: { appId } });
      
      if (!partner) {
        return new Response(JSON.stringify({ error: "Partner not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Return configuration for the SDK
      return new Response(JSON.stringify({
        app_id: partner.app_id,
        app_name: partner.app_name,
        fee_wallet: partner.fee_wallet,
        bps: partner.bps,
        is_active: partner.is_active,
        treasury: "6CxhRUpZ9av3X28QxvppYycEm8SjTS5Wf5UgxBaEzhd",
        protocol_bps: 500 // 5%
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
