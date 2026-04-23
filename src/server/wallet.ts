import { createServerFn } from "@tanstack/react-start";

const HELIUS_BASE = "https://mainnet.helius-rpc.com";
const DEX_BASE = "https://api.dexscreener.com";

function rpcUrl() {
  const key = process.env.HELIUS_API_KEY?.trim();
  if (!key) return "https://api.mainnet-beta.solana.com";
  if (key.startsWith("http")) return key;
  return `${HELIUS_BASE}/?api-key=${key}`;
}

export type WalletHolding = {
  mint: string;
  symbol: string;
  name: string;
  image: string;
  amount: number;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
  change24h: number;
  isBags: boolean;
};

export type WalletOverview = {
  address: string;
  solBalance: number;
  solUsd: number;
  totalUsd: number;
  tokenCount: number;
  holdings: WalletHolding[];
  live: boolean;
};

type DasAsset = {
  id: string;
  interface?: string;
  content?: { metadata?: { name?: string; symbol?: string }; links?: { image?: string } };
  token_info?: { balance?: number | string; decimals?: number; symbol?: string };
};

type DexPair = {
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  info?: { imageUrl?: string };
  liquidity?: { usd?: number };
};

async function fetchSolBalance(address: string): Promise<number> {
  try {
    const res = await fetch(rpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "sol-bal",
        method: "getBalance",
        params: [address],
      }),
    });
    const json = (await res.json()) as { result?: { value?: number } };
    return (json.result?.value ?? 0) / 1_000_000_000;
  } catch {
    return 0;
  }
}

async function fetchSolPrice(): Promise<number> {
  try {
    const res = await fetch(`${DEX_BASE}/tokens/v1/solana/So11111111111111111111111111111111111111112`);
    if (!res.ok) return 0;
    const arr = (await res.json()) as DexPair[];
    return Number(arr?.[0]?.priceUsd ?? 0);
  } catch {
    return 0;
  }
}

async function fetchAssets(address: string): Promise<DasAsset[]> {
  try {
    const res = await fetch(rpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "das",
        method: "getAssetsByOwner",
        params: {
          ownerAddress: address,
          page: 1,
          limit: 200,
          displayOptions: { showFungible: true, showZeroBalance: false },
        },
      }),
    });
    const json = (await res.json()) as { result?: { items?: DasAsset[] } };
    return json.result?.items ?? [];
  } catch {
    return [];
  }
}

async function fetchDexBatch(mints: string[]): Promise<Map<string, DexPair>> {
  const map = new Map<string, DexPair>();
  if (mints.length === 0) return map;
  const chunks: string[][] = [];
  for (let i = 0; i < mints.length; i += 30) chunks.push(mints.slice(i, i + 30));
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const res = await fetch(`${DEX_BASE}/tokens/v1/solana/${chunk.join(",")}`);
        if (!res.ok) return;
        const arr = (await res.json()) as DexPair[];
        if (!Array.isArray(arr)) return;
        for (const pair of arr) {
          const addr = pair.baseToken?.address;
          if (!addr) continue;
          const existing = map.get(addr);
          if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
            map.set(addr, pair);
          }
        }
      } catch {
        /* ignore */
      }
    }),
  );
  return map;
}

async function fetchBagsMintSet(): Promise<Set<string>> {
  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) return new Set();
  try {
    const res = await fetch("https://public-api-v2.bags.fm/api/v1/token-launch/feed", {
      headers: { "x-api-key": apiKey, accept: "application/json" },
    });
    if (!res.ok) return new Set();
    const json = (await res.json()) as { response?: Array<{ tokenMint?: string; mint?: string }> };
    const list = json.response ?? [];
    return new Set(list.map((t) => String(t.tokenMint ?? t.mint ?? "")).filter(Boolean));
  } catch {
    return new Set();
  }
}

export const getWalletOverview = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet: string }) => d)
  .handler(async ({ data }): Promise<WalletOverview> => {
    const address = data.wallet;
    const [solBalance, solPrice, assets, bagsMints] = await Promise.all([
      fetchSolBalance(address),
      fetchSolPrice(),
      fetchAssets(address),
      fetchBagsMintSet(),
    ]);

    const fungible = assets.filter((a) => {
      const bal = Number(a.token_info?.balance ?? 0);
      return bal > 0 && a.interface !== "V1_NFT" && a.interface !== "ProgrammableNFT";
    });
    const mints = fungible.map((a) => a.id);
    const dexMap = await fetchDexBatch(mints);

    const holdings: WalletHolding[] = fungible
      .map((a) => {
        const decimals = a.token_info?.decimals ?? 0;
        const rawBal = Number(a.token_info?.balance ?? 0);
        const amount = decimals > 0 ? rawBal / 10 ** decimals : rawBal;
        const pair = dexMap.get(a.id);
        const priceUsd = Number(pair?.priceUsd ?? 0);
        const valueUsd = amount * priceUsd;
        return {
          mint: a.id,
          symbol: pair?.baseToken?.symbol ?? a.token_info?.symbol ?? a.content?.metadata?.symbol ?? "?",
          name: pair?.baseToken?.name ?? a.content?.metadata?.name ?? "Unknown",
          image: pair?.info?.imageUrl ?? a.content?.links?.image ?? "",
          amount,
          decimals,
          priceUsd,
          valueUsd,
          change24h: Number(pair?.priceChange?.h24 ?? 0),
          isBags: bagsMints.has(a.id),
        };
      })
      .sort((a, b) => b.valueUsd - a.valueUsd);

    const tokenValue = holdings.reduce((s, h) => s + h.valueUsd, 0);
    const solUsd = solBalance * solPrice;
    const bagsHoldings = holdings.filter((h) => h.isBags);

    return {
      address,
      solBalance,
      solUsd,
      totalUsd: tokenValue + solUsd,
      tokenCount: bagsHoldings.length,
      holdings,
      live: true,
    };
  });
