import { createFileRoute } from "@tanstack/react-router";

// Solana Action ("Blink") for subscribing to a premium AI strategy.
// Spec: https://solana.com/docs/advanced/actions
//
// GET  /api/actions/subscribe?strategy=...  -> ActionGetResponse (metadata for the Blink card)
// POST /api/actions/subscribe?strategy=...  -> ActionPostResponse (base64 unsigned transaction)
//
// The transaction is a SystemProgram.transfer of the subscription fee in SOL
// from the buyer to the BagsPulse treasury. After confirmation, the client
// hits /api/licenses/confirm to register the cNFT-backed license.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-action-version, x-blockchain-ids",
  "Access-Control-Expose-Headers": "x-action-version, x-blockchain-ids",
  "x-action-version": "2.4",
  "x-blockchain-ids": "solana:mainnet",
};

const STRATEGIES: Record<string, { title: string; description: string; priceSol: number }> = {
  "alpha-pulse": {
    title: "Alpha Pulse — Pro AI Signals",
    description: "Live AI-curated entries on Bags-launched tokens, refreshed every 5 minutes.",
    priceSol: 0.2,
  },
  "group-basket-ai": {
    title: "Elite — Group Basket AI Manager",
    description: "Subscribe an existing group basket to autonomous AI rebalances.",
    priceSol: 0.5,
  },
};

function getStrategy(url: URL) {
  const id = url.searchParams.get("strategy") ?? "alpha-pulse";
  return { id, ...(STRATEGIES[id] ?? STRATEGIES["alpha-pulse"]) };
}

function getTreasury(): string {
  // BagsPulse treasury wallet (override with BAGSPULSE_TREASURY_WALLET secret).
  return process.env.BAGSPULSE_TREASURY_WALLET ?? "6CxhRUpZ9av3X28QxvppYycEm8SjTS5Wf5UgxBaEzhd";
}

export const Route = createFileRoute("/api/actions/subscribe")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const strat = getStrategy(url);
        const body = {
          type: "action",
          icon: `${url.origin}/favicon.ico`,
          title: strat.title,
          description: strat.description,
          label: `Subscribe — ${strat.priceSol} SOL`,
        };
        return new Response(JSON.stringify(body), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      },
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const strat = getStrategy(url);
          const { account } = (await request.json()) as { account?: string };
          if (!account) {
            return new Response(JSON.stringify({ error: "account required" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          // Build transfer transaction server-side using @solana/web3.js
          const web3 = await import("@solana/web3.js");
          const { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = web3;

          const rpc = process.env.HELIUS_API_KEY
            ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
            : "https://api.mainnet-beta.solana.com";
          const conn = new Connection(rpc, "confirmed");

          const buyer = new PublicKey(account);
          const treasury = new PublicKey(getTreasury());
          const lamports = Math.floor(strat.priceSol * LAMPORTS_PER_SOL);

          const tx = new Transaction().add(
            SystemProgram.transfer({ fromPubkey: buyer, toPubkey: treasury, lamports }),
          );
          tx.feePayer = buyer;
          const { blockhash } = await conn.getLatestBlockhash();
          tx.recentBlockhash = blockhash;

          const serialized = tx
            .serialize({ requireAllSignatures: false, verifySignatures: false })
            .toString("base64");

          return new Response(
            JSON.stringify({
              type: "transaction",
              transaction: serialized,
              message: `Subscribe to ${strat.title} for ${strat.priceSol} SOL`,
            }),
            { headers: { "Content-Type": "application/json", ...CORS } },
          );
        } catch (err) {
          console.error("[blink subscribe]", err);
          return new Response(
            JSON.stringify({ error: (err as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }
      },
    },
  },
});
