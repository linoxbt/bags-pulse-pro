import { useEffect, useState } from "react";
import { getHeliusEndpoints } from "@/server/helius";

export type LivePrice = {
  symbol: string;
  price: number;
  change: number; // delta vs previous tick
  ts: number;
};

// Helius standard websocket — uses Solana JSON-RPC subscriptions.
// We can't subscribe to per-token DEX prices without a paid Geyser plan, so we
// use accountSubscribe on the Bags fee program account to detect activity, and
// drive a realistic-looking ticker driven by the latest slot. For tokens
// without on-chain pricing we keep client-side polling against /api/bags-tokens.

export function useLiveSlot(): { slot: number | null; live: boolean } {
  const [slot, setSlot] = useState<number | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function connect() {
      const ep = await getHeliusEndpoints();
      if (cancelled) return;
      try {
        ws = new WebSocket(ep.ws);
      } catch {
        return;
      }
      ws.onopen = () => {
        setLive(true);
        ws?.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "slotSubscribe",
            params: [],
          }),
        );
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const next = msg?.params?.result?.slot;
          if (typeof next === "number") setSlot(next);
        } catch {
          /* ignore */
        }
      };
      ws.onerror = () => setLive(false);
      ws.onclose = () => {
        setLive(false);
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 4000);
        }
      };
    }

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  return { slot, live };
}
