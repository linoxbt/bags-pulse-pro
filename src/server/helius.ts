import { createServerFn } from "@tanstack/react-start";

// Returns the public Helius RPC + WS URLs for the browser.
// The HELIUS_API_KEY stays on the server; only the constructed URL with the
// key embedded is sent to the client (Helius URLs are designed this way and
// can be rate-limited per origin).
export const getHeliusEndpoints = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ rpc: string; ws: string; live: boolean }> => {
    const key = process.env.HELIUS_API_KEY;
    if (!key) {
      return {
        rpc: "https://api.mainnet-beta.solana.com",
        ws: "wss://api.mainnet-beta.solana.com",
        live: false,
      };
    }
    return {
      rpc: `https://mainnet.helius-rpc.com/?api-key=${key}`,
      ws: `wss://mainnet.helius-rpc.com/?api-key=${key}`,
      live: true,
    };
  },
);

// Returns the Privy App ID for the browser (public by design).
export const getPrivyConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ appId: string | null }> => {
    return { appId: process.env.VITE_PRIVY_APP_ID ?? process.env.PRIVY_APP_ID ?? null };
  },
);
