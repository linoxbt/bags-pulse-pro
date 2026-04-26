import { createFileRoute } from "@tanstack/react-router";
import { fetchTokens, fetchFeed } from "@/server/bags";
import { getCreatorScorecard, listTopCreators } from "@/server/scorecards";
import { getSwapQuote } from "@/server/swap";
import { listPartners } from "@/server/partners";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TIER_STRATEGY_ID } from "@/lib/constants";

// Lightweight JSON-RPC 2.0 implementation of the Model Context Protocol
// (Streamable HTTP transport). Hand-rolled so it works in the Cloudflare
// Worker SSR runtime (the official @modelcontextprotocol/sdk is Node-only).
//
// Auth: optional Bearer token. When present, we look up the linked wallet's
// active license tier — Elite-only tools (analyze_creator, get_swap_quote_for)
// check that the caller has Elite. Public tools (leaderboard, scorecards,
// partners, fees) work without auth.

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

const SERVER_INFO = { name: "bagspulse-mcp", version: "1.1.0" };

const TOOLS = [
  {
    name: "get_bags_leaderboard",
    description: "Top Bags-launched tokens ranked by 24h volume or market cap. Public.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 10 },
        sortBy: { type: "string", enum: ["volume", "marketCap"], default: "volume" },
      },
    },
  },
  {
    name: "get_top_creators",
    description: "Top Bags creators ranked by composite health score (fee yield + holder diversity + activity). Public.",
    inputSchema: { type: "object", properties: { limit: { type: "number", default: 10 } } },
  },
  {
    name: "analyze_creator",
    description: "Full scorecard for a single Bags creator. Requires Elite tier.",
    inputSchema: {
      type: "object",
      required: ["creator"],
      properties: { creator: { type: "string", description: "Creator wallet" } },
    },
  },
  {
    name: "get_pulse_fees",
    description: "Total protocol fees flowing through PulseRouter. Public.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_partners",
    description: "List verified PulseRouter partners. Public.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_recent_feed",
    description: "Recent buys, sells, launches and fee claims across the Bags ecosystem. Public.",
    inputSchema: { type: "object", properties: { limit: { type: "number", default: 20 } } },
  },
  {
    name: "quote_swap",
    description: "Get a Jupiter swap quote (PulseRouter routes 0.5% protocol fee). Requires Elite tier.",
    inputSchema: {
      type: "object",
      required: ["inputMint", "outputMint", "amount"],
      properties: {
        inputMint: { type: "string" },
        outputMint: { type: "string" },
        amount: { type: "number", description: "Atomic units (lamports for SOL, etc.)" },
        slippageBps: { type: "number", default: 100 },
      },
    },
  },
];

const ELITE_GATED = new Set(["analyze_creator", "quote_swap"]);

async function checkElite(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin.auth as any).getUser(token);
    if (error || !data?.user) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: licenses } = await (supabaseAdmin.from("strategy_licenses") as any)
      .select("strategy_id,expires_at,status")
      .eq("user_id", data.user.id)
      .eq("status", "active");
    const rows = (licenses ?? []) as Array<{ strategy_id: string; expires_at: string | null }>;
    return rows.some(
      (r) =>
        r.strategy_id === TIER_STRATEGY_ID.elite &&
        (!r.expires_at || new Date(r.expires_at) > new Date()),
    );
  } catch {
    return false;
  }
}

async function callTool(name: string, args: Record<string, unknown>) {
  if (name === "get_bags_leaderboard") {
    const limit = Math.min(Number(args.limit ?? 10), 50);
    const sortBy = args.sortBy === "marketCap" ? "marketCap" : "volume24h";
    const { tokens } = await fetchTokens();
    return [...tokens]
      .sort((a, b) => (b as never)[sortBy] - (a as never)[sortBy])
      .slice(0, limit)
      .map((t) => ({
        mint: t.mint,
        symbol: t.symbol,
        name: t.name,
        marketCap: t.marketCap,
        volume24h: t.volume24h,
        feesEarnedTotal: t.feesEarnedTotal,
      }));
  }

  if (name === "get_top_creators") {
    const limit = Math.min(Number(args.limit ?? 10), 24);
    const { creators } = await listTopCreators();
    return creators.slice(0, limit);
  }

  if (name === "analyze_creator") {
    const creator = String(args.creator ?? "");
    if (!creator) throw new Error("creator is required");
    const res = await getCreatorScorecard({ data: { creator } });
    return res.scorecard;
  }

  if (name === "get_pulse_fees") {
    const [{ tokens }, { events }] = await Promise.all([fetchTokens(), fetchFeed()]);
    return {
      totalFeesSol: Number(tokens.reduce((s, t) => s + t.feesEarnedTotal, 0).toFixed(4)),
      fees24hUsd: Number(tokens.reduce((s, t) => s + t.feesEarned24h, 0).toFixed(2)),
      tokensTracked: tokens.length,
      recentEvents: events.length,
    };
  }

  if (name === "list_partners") {
    const { partners } = await listPartners();
    return partners.map((p) => ({
      app_id: p.app_id,
      app_name: p.app_name,
      bps: p.bps,
      tokens: p.total_tokens_launched,
      fees: p.total_fees_earned,
      verified: p.domain_verified && p.wallet_verified,
    }));
  }

  if (name === "get_recent_feed") {
    const limit = Math.min(Number(args.limit ?? 20), 60);
    const { events } = await fetchFeed();
    return events.slice(0, limit);
  }

  if (name === "quote_swap") {
    const res = await getSwapQuote({
      data: {
        inputMint: String(args.inputMint),
        outputMint: String(args.outputMint),
        amount: Number(args.amount),
        slippageBps: Number(args.slippageBps ?? 100),
      },
    });
    return res.quote;
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function handleRpc(req: JsonRpcRequest, authHeader: string | null): Promise<JsonRpcResponse> {
  const id = req.id ?? null;
  try {
    if (req.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      };
    }
    if (req.method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    }
    if (req.method === "tools/call") {
      const params = (req.params ?? {}) as Record<string, unknown>;
      const name = String(params.name ?? "");
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      if (ELITE_GATED.has(name)) {
        const ok = await checkElite(authHeader);
        if (!ok) {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32001, message: `Tool '${name}' requires the Elite plan. Subscribe at /pricing.` },
          };
        }
      }
      const data = await callTool(name, args);
      return {
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] },
      };
    }
    if (req.method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${req.method}` } };
  } catch (e) {
    return { jsonrpc: "2.0", id, error: { code: -32603, message: (e as Error).message } };
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id",
};

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () =>
        new Response(
          JSON.stringify({
            name: SERVER_INFO.name,
            version: SERVER_INFO.version,
            transport: "streamable-http",
            tools: TOOLS.map((t) => ({ name: t.name, eliteGated: ELITE_GATED.has(t.name) })),
            usage: "POST JSON-RPC 2.0 requests to this endpoint. Bearer token unlocks Elite tools.",
          }),
          { headers: { "Content-Type": "application/json", ...CORS } },
        ),
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        let body: JsonRpcRequest | JsonRpcRequest[];
        try {
          body = (await request.json()) as JsonRpcRequest | JsonRpcRequest[];
        } catch {
          return new Response(
            JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }),
            { status: 400, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }
        const responses = Array.isArray(body)
          ? await Promise.all(body.map((b) => handleRpc(b, authHeader)))
          : await handleRpc(body, authHeader);
        return new Response(JSON.stringify(responses), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});
