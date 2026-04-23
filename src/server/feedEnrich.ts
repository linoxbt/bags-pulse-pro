// Helius transaction parsing — turns recent on-chain activity for Bags-launched
// mints into FeedEvent rows (buys, sells, fees, milestones).
import { createServerFn } from "@tanstack/react-start";
import type { FeedEvent } from "./bags";

const HELIUS_BASE = "https://api.helius.xyz/v0";

type ParsedTx = {
  signature: string;
  timestamp: number;
  type: string;
  description?: string;
  source?: string;
  fee?: number;
  feePayer?: string;
  tokenTransfers?: Array<{
    fromUserAccount?: string;
    toUserAccount?: string;
    mint: string;
    tokenAmount: number;
  }>;
  nativeTransfers?: Array<{
    fromUserAccount?: string;
    toUserAccount?: string;
    amount: number;
  }>;
  events?: { swap?: unknown };
};

function shortAddr(a?: string) {
  if (!a) return "anon";
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function classify(tx: ParsedTx, mint: string): { type: FeedEvent["type"]; message: string; actor: string; amountUsd: number } {
  const transfers = tx.tokenTransfers ?? [];
  const inflow = transfers
    .filter((t) => t.mint === mint && t.toUserAccount)
    .reduce((s, t) => s + (t.tokenAmount ?? 0), 0);
  const outflow = transfers
    .filter((t) => t.mint === mint && t.fromUserAccount)
    .reduce((s, t) => s + (t.tokenAmount ?? 0), 0);
  const sol = (tx.nativeTransfers ?? []).reduce((s, n) => s + Math.abs(n.amount ?? 0), 0) / 1_000_000_000;

  const actor = shortAddr(tx.feePayer);
  const looksFee = (tx.description ?? "").toLowerCase().includes("claim");
  if (looksFee) {
    return { type: "fee", message: `Fee claim on token`, actor, amountUsd: sol * 200 };
  }
  if (inflow > outflow) {
    return { type: "buy", message: `Bought ${inflow.toFixed(2)} tokens`, actor, amountUsd: sol * 200 };
  }
  if (outflow > inflow) {
    return { type: "sell", message: `Sold ${outflow.toFixed(2)} tokens`, actor, amountUsd: sol * 200 };
  }
  return { type: "milestone", message: tx.description ?? "On-chain activity", actor, amountUsd: sol * 200 };
}

async function fetchMintTxs(mint: string, limit = 6): Promise<ParsedTx[]> {
  const key = process.env.HELIUS_API_KEY?.trim();
  if (!key) return [];
  try {
    const url = `${HELIUS_BASE}/addresses/${mint}/transactions?api-key=${key}&limit=${limit}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return [];
    const arr = (await res.json()) as ParsedTx[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export const fetchOnchainFeed = createServerFn({ method: "POST" })
  .inputValidator((d: { mints: { mint: string; symbol: string; name: string }[] }) => d)
  .handler(async ({ data }): Promise<{ events: FeedEvent[]; live: boolean }> => {
    const mints = data.mints.slice(0, 8); // cap to keep latency reasonable
    if (mints.length === 0) return { events: [], live: false };
    const all: FeedEvent[] = [];
    await Promise.all(
      mints.map(async (m) => {
        const txs = await fetchMintTxs(m.mint, 4);
        for (const tx of txs) {
          const { type, message, actor, amountUsd } = classify(tx, m.mint);
          all.push({
            id: tx.signature,
            type,
            token: m.name,
            symbol: m.symbol,
            mint: m.mint,
            amountUsd,
            actor,
            message: `${m.symbol}: ${message}`,
            at: new Date((tx.timestamp ?? 0) * 1000).toISOString(),
          });
        }
      }),
    );
    all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return { events: all.slice(0, 50), live: all.length > 0 };
  });
