import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchTokens } from "@/server/bags";

// Autonomous "Analyst Agent" — proposes rebalances for active group baskets.
// Triggered by pg_cron via /api/public/agent/run (no auth required for cron).
// Uses Lovable AI gateway with Gemini Flash to produce structured rebalance
// actions, then writes one row per basket into agent_proposals.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const MODEL = "google/gemini-3-flash-preview";

type Basket = { id: string; name: string; owner_id: string };
type BasketToken = { mint: string; symbol: string | null; target_bps: number };

async function analyzeBasket(basket: Basket, current: BasketToken[], universe: Array<{ mint: string; symbol: string; marketCap: number; volume24h: number; change24h: number; graduated: boolean }>) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are an autonomous portfolio analyst for a Solana memecoin basket called "${basket.name}".
Current holdings (mint, symbol, target weight bps):
${current.map((t) => `- ${t.symbol ?? "?"} (${t.mint.slice(0, 8)}…) @ ${t.target_bps}bps`).join("\n") || "- (empty)"}

Top tokens from Bags ecosystem (symbol, mcap, 24hVol, 24hΔ%, graduated):
${universe.slice(0, 15).map((t) => `- ${t.symbol} mcap=$${Math.round(t.marketCap)} vol=$${Math.round(t.volume24h)} Δ=${t.change24h.toFixed(2)}% grad=${t.graduated}`).join("\n")}

Propose 1-3 specific rebalance actions (add/remove/resize). Be conservative.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "You output disciplined, hedged rebalance proposals. Always return valid JSON via the provided tool." },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "propose_rebalance",
            description: "Return rebalance actions and reasoning",
            parameters: {
              type: "object",
              properties: {
                reasoning: { type: "string" },
                actions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["add", "remove", "resize"] },
                      symbol: { type: "string" },
                      mint: { type: "string" },
                      target_bps: { type: "number" },
                      rationale: { type: "string" },
                    },
                    required: ["type", "symbol", "rationale"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["reasoning", "actions"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "propose_rebalance" } },
    }),
  });

  if (!res.ok) {
    console.error("[agent] AI gateway error", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
  };
  const argStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argStr) return null;
  try {
    return JSON.parse(argStr) as { reasoning: string; actions: unknown[] };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/agent/run")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async () => {
        try {
          const { tokens } = await fetchTokens();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const baskets = await (supabaseAdmin.from("baskets") as any)
            .select("id,name,owner_id")
            .eq("is_public", true)
            .limit(20);

          if (baskets.error) throw new Error(baskets.error.message);
          const list = (baskets.data ?? []) as Basket[];
          const proposals: Array<{ basket_id: string; ok: boolean }> = [];

          for (const basket of list) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tk = await (supabaseAdmin.from("basket_tokens") as any)
              .select("mint,symbol,target_bps")
              .eq("basket_id", basket.id);
            const current = (tk.data ?? []) as BasketToken[];
            const result = await analyzeBasket(basket, current, tokens);
            if (!result) {
              proposals.push({ basket_id: basket.id, ok: false });
              continue;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabaseAdmin.from("agent_proposals") as any).insert({
              basket_id: basket.id,
              proposal_type: "rebalance",
              actions: result.actions,
              reasoning: result.reasoning,
              model: MODEL,
              status: "pending",
            });
            proposals.push({ basket_id: basket.id, ok: true });
          }

          return new Response(
            JSON.stringify({ success: true, processed: proposals.length, proposals }),
            { headers: { "Content-Type": "application/json", ...CORS } },
          );
        } catch (err) {
          console.error("[agent run]", err);
          return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
      },
    },
  },
});
