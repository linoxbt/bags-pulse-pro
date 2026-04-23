import { createServerFn } from "@tanstack/react-start";

function resolveHeliusUrl(value: string, protocol: "https" | "wss") {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (protocol === "wss") {
      return trimmed.replace(/^http(s?):\/\//, (_m, secure) => (secure ? "wss://" : "ws://"));
    }
    return trimmed;
  }
  return `${protocol}://mainnet.helius-rpc.com/?api-key=${trimmed}`;
}

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
    const rpc = resolveHeliusUrl(key, "https");
    const ws = resolveHeliusUrl(key, "wss");
    if (!rpc || !ws) {
      return {
        rpc: "https://api.mainnet-beta.solana.com",
        ws: "wss://api.mainnet-beta.solana.com",
        live: false,
      };
    }
    return {
      rpc,
      ws,
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
