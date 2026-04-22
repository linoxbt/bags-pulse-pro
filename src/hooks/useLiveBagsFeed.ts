import { useEffect, useMemo, useState } from "react";
import { fetchFeed, type FeedEvent } from "@/server/bags";

export function useLiveBagsFeed(initialEvents: FeedEvent[]) {
  const [events, setEvents] = useState(initialEvents);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let closed = false;
    const ws = new WebSocket("wss://restream.bags.fm");
    const refresh = () => fetchFeed().then((res) => !closed && setEvents(res.events)).catch(() => {});
    const ping = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
    }, 30_000);

    ws.addEventListener("open", () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "subscribe", event: "launchpad_launch:BAGS" }));
    });
    ws.addEventListener("message", refresh);
    ws.addEventListener("close", () => setConnected(false));
    ws.addEventListener("error", () => setConnected(false));

    return () => {
      closed = true;
      window.clearInterval(ping);
      ws.close();
    };
  }, []);

  return useMemo(() => ({ events, connected }), [events, connected]);
}