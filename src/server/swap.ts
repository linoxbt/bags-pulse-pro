// Jupiter aggregator-powered swap. Pure HTTP, no Node-only SDK — works in
// the Worker runtime. Every swap routes a protocol fee to the BagsPulse
// treasury via Jupiter's `platformFeeBps` + `feeAccount` parameters →
// real PulseRouter revenue, on-chain, settled inside the swap tx itself.
//
// NOTE: As of 2026-04, the old `quote-api.jup.ag/v6/*` hostname is dead.
// We target `lite-api.jup.ag` — the current free-tier Jupiter Aggregator API.
import { createServerFn } from "@tanstack/react-start";
import { BAGSPULSE_TREASURY, PULSEROUTER_PROTOCOL_BPS } from "@/lib/constants";

const JUP_BASE = "https://lite-api.jup.ag";
const JUP_QUOTE = `${JUP_BASE}/swap/v1/quote`;
const JUP_SWAP = `${JUP_BASE}/swap/v1/swap`;
const JUP_TOKEN_TAG = `${JUP_BASE}/tokens/v2/tag`;
const JUP_TOKEN_SEARCH = `${JUP_BASE}/tokens/v2/search`;
const JUP_PRICE = `${JUP_BASE}/price/v3`;

function heliusRpc(): string {
  const key = process.env.HELIUS_API_KEY;
  return key
    ? `https://mainnet.helius-rpc.com/?api-key=${key}`
    : "https://api.mainnet-beta.solana.com";
}

export type JupToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string | null;
  tags: string[];
  daily_volume: number | null;
};

export type SwapQuote = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: "ExactIn" | "ExactOut";
  slippageBps: number;
  priceImpactPct: string;
  routePlan: string; // JSON-stringified — keep serializable across server-fn boundary
  protocolFeeBps: number;
  protocolFeeRecipient: string;
  platformFeeLamports: string; // Jupiter-reported fee in output-mint base units
  raw: string; // JSON-stringified full Jupiter quote, needed verbatim by /swap endpoint
};

// Map a v2-shape token row into our JupToken.
// v2 returns: { id, name, symbol, icon, decimals, tokenProgram, stats24h: { buyVolume, sellVolume }, ... }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeV2(t: any): JupToken {
  const stats = t?.stats24h || {};
  const vol = Number(stats.buyVolume ?? 0) + Number(stats.sellVolume ?? 0);
  return {
    address: String(t.id ?? t.address ?? ""),
    symbol: String(t.symbol ?? "?"),
    name: String(t.name ?? "Unknown"),
    decimals: Number(t.decimals ?? 9),
    logoURI: typeof t.icon === "string" ? t.icon : typeof t.logoURI === "string" ? t.logoURI : null,
    tags: Array.isArray(t.tags) ? (t.tags as string[]) : [],
    daily_volume: vol > 0 ? vol : null,
  };
}

// Return the top ~300 verified tokens from Jupiter — what jupiter.ag shows.
export const listJupiterTokens = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ tokens: JupToken[] }> => {
    try {
      const res = await fetch(`${JUP_TOKEN_TAG}?query=verified`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return { tokens: [] };
      const raw = (await res.json()) as unknown;
      const arr = Array.isArray(raw) ? raw : [];
      const tokens: JupToken[] = arr.slice(0, 300).map(normalizeV2);
      return { tokens };
    } catch {
      return { tokens: [] };
    }
  },
);

// USD prices for a batch of mints (Jupiter Price v3).
// v3 returns `{ [mint]: { usdPrice, ... } }`.
export const getJupiterPrices = createServerFn({ method: "POST" })
  .inputValidator((d: { mints: string[] }) => d)
  .handler(async ({ data }): Promise<{ prices: Record<string, number> }> => {
    if (!data.mints.length) return { prices: {} };
    try {
      const ids = data.mints.slice(0, 50).join(",");
      const res = await fetch(`${JUP_PRICE}?ids=${ids}`);
      if (!res.ok) return { prices: {} };
      const json = (await res.json()) as Record<string, { usdPrice?: number; price?: number }>;
      const prices: Record<string, number> = {};
      for (const [mint, row] of Object.entries(json ?? {})) {
        const p = Number(row?.usdPrice ?? row?.price ?? 0);
        if (p > 0) prices[mint] = p;
      }
      return { prices };
    } catch {
      return { prices: {} };
    }
  });

// Fetch one token's metadata (for pasted mint addresses not in the verified list).
export const resolveMint = createServerFn({ method: "POST" })
  .inputValidator((d: { mint: string }) => d)
  .handler(async ({ data }): Promise<{ token: JupToken | null }> => {
    try {
      const res = await fetch(`${JUP_TOKEN_SEARCH}?query=${encodeURIComponent(data.mint)}`);
      if (!res.ok) return { token: null };
      const raw = (await res.json()) as unknown;
      const arr = Array.isArray(raw) ? raw : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hit = arr.find((t: any) => String(t?.id) === data.mint) ?? arr[0];
      if (!hit) return { token: null };
      return { token: normalizeV2(hit) };
    } catch {
      return { token: null };
    }
  });

// Free-text search by symbol / name (used by the picker).
export const searchJupiterTokens = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }): Promise<{ tokens: JupToken[] }> => {
    const q = data.query.trim();
    if (!q) return { tokens: [] };
    try {
      const res = await fetch(`${JUP_TOKEN_SEARCH}?query=${encodeURIComponent(q)}`);
      if (!res.ok) return { tokens: [] };
      const raw = (await res.json()) as unknown;
      const arr = Array.isArray(raw) ? raw : [];
      return { tokens: arr.slice(0, 40).map(normalizeV2) };
    } catch {
      return { tokens: [] };
    }
  });

export const getSwapQuote = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      inputMint: string;
      outputMint: string;
      amount: number;
      slippageBps?: number;
    }) => d,
  )
  .handler(
    async ({ data }): Promise<{ quote: SwapQuote | null; error?: string }> => {
      try {
        const params = new URLSearchParams({
          inputMint: data.inputMint,
          outputMint: data.outputMint,
          amount: String(data.amount),
          slippageBps: String(data.slippageBps ?? 100),
          platformFeeBps: String(PULSEROUTER_PROTOCOL_BPS),
        });
        const res = await fetch(`${JUP_QUOTE}?${params.toString()}`);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return { quote: null, error: `Jupiter quote failed (${res.status})${text ? `: ${text.slice(0, 120)}` : ""}` };
        }
        const raw = (await res.json()) as Record<string, unknown>;
        const platformFee = (raw.platformFee as { amount?: string } | undefined) ?? {};
        return {
          quote: {
            inputMint: String(raw.inputMint),
            outputMint: String(raw.outputMint),
            inAmount: String(raw.inAmount),
            outAmount: String(raw.outAmount),
            otherAmountThreshold: String(raw.otherAmountThreshold),
            swapMode: (raw.swapMode as "ExactIn" | "ExactOut") ?? "ExactIn",
            slippageBps: Number(raw.slippageBps ?? data.slippageBps ?? 100),
            priceImpactPct: String(raw.priceImpactPct ?? "0"),
            routePlan: JSON.stringify(raw.routePlan ?? []),
            protocolFeeBps: PULSEROUTER_PROTOCOL_BPS,
            protocolFeeRecipient: BAGSPULSE_TREASURY,
            platformFeeLamports: String(platformFee.amount ?? "0"),
            raw: JSON.stringify(raw),
          },
        };
      } catch (e) {
        return { quote: null, error: (e as Error).message };
      }
    },
  );

// Makes sure the treasury's Associated Token Account for a given output mint
// exists. Jupiter swap fails silently if feeAccount is missing. We fund the
// rent from the treasury itself via the swap payer (user pays the ~0.002 SOL
// if we bundle the create-ATA ix into the tx). To keep things simple we
// pre-create it server-side via a standalone tx whenever it's missing, paid
// for by the user on their first swap for that output mint.
export const prepareFeeAccount = createServerFn({ method: "POST" })
  .inputValidator((d: { outputMint: string; payer: string }) => d)
  .handler(
    async ({ data }): Promise<{
      feeAccount: string;
      exists: boolean;
      createTx: string | null; // base64 legacy tx to create the ATA, null if exists
    }> => {
      const { Connection, PublicKey, Transaction, SystemProgram } = await import(
        "@solana/web3.js"
      );
      const {
        getAssociatedTokenAddressSync,
        createAssociatedTokenAccountInstruction,
        TOKEN_PROGRAM_ID,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      } = await import("@solana/spl-token");

      const conn = new Connection(heliusRpc(), "confirmed");
      const treasury = new PublicKey(BAGSPULSE_TREASURY);
      const mint = new PublicKey(data.outputMint);

      // Detect the token program (Token-2022 vs legacy).
      const mintInfo = await conn.getAccountInfo(mint);
      const tokenProgram =
        mintInfo?.owner.toBase58() === TOKEN_2022_PROGRAM_ID.toBase58()
          ? TOKEN_2022_PROGRAM_ID
          : TOKEN_PROGRAM_ID;

      const ata = getAssociatedTokenAddressSync(
        mint,
        treasury,
        true,
        tokenProgram,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const ataInfo = await conn.getAccountInfo(ata);
      if (ataInfo) {
        return { feeAccount: ata.toBase58(), exists: true, createTx: null };
      }

      const payer = new PublicKey(data.payer);
      const ix = createAssociatedTokenAccountInstruction(
        payer,
        ata,
        treasury,
        mint,
        tokenProgram,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      // Touch system program so tsc doesn't flag unused import.
      void SystemProgram;
      const tx = new Transaction().add(ix);
      tx.feePayer = payer;
      const { blockhash } = await conn.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      return {
        feeAccount: ata.toBase58(),
        exists: false,
        createTx: Buffer.from(serialized).toString("base64"),
      };
    },
  );

export const buildSwapTransaction = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { quote: SwapQuote; userPublicKey: string; feeAccount: string }) => d,
  )
  .handler(
    async ({
      data,
    }): Promise<{ swapTransaction: string | null; error?: string }> => {
      try {
        const quoteResponse = JSON.parse(data.quote.raw);
        const res = await fetch(JUP_SWAP, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quoteResponse,
            userPublicKey: data.userPublicKey,
            wrapAndUnwrapSol: true,
            // PulseRouter cut → BagsPulse treasury ATA for the output mint
            feeAccount: data.feeAccount,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: "auto",
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return {
            swapTransaction: null,
            error: `Jupiter swap failed (${res.status})${text ? `: ${text.slice(0, 120)}` : ""}`,
          };
        }
        const json = (await res.json()) as { swapTransaction?: string };
        return { swapTransaction: json.swapTransaction ?? null };
      } catch (e) {
        return { swapTransaction: null, error: (e as Error).message };
      }
    },
  );

export const buildBasketTransactions = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      userPublicKey: string;
      items: Array<{ mint: string; amount: number }>;
      slippageBps?: number;
    }) => d,
  )
  .handler(
    async ({ data }): Promise<{ transactions: string[]; errors: string[] }> => {
      const transactions: string[] = [];
      const errors: string[] = [];
      for (const item of data.items) {
        try {
          const quoteRes = await getSwapQuote({
            data: {
              inputMint: "So11111111111111111111111111111111111111112",
              outputMint: item.mint,
              amount: item.amount,
              slippageBps: data.slippageBps,
            },
          });
          if (quoteRes.error || !quoteRes.quote) {
            errors.push(`Quote failed for ${item.mint}: ${quoteRes.error ?? "no quote"}`);
            continue;
          }
          const prep = await prepareFeeAccount({
            data: { outputMint: item.mint, payer: data.userPublicKey },
          });
          const txRes = await buildSwapTransaction({
            data: {
              quote: quoteRes.quote,
              userPublicKey: data.userPublicKey,
              feeAccount: prep.feeAccount,
            },
          });
          if (txRes.error || !txRes.swapTransaction) {
            errors.push(`TX failed for ${item.mint}: ${txRes.error ?? "no tx"}`);
            continue;
          }
          transactions.push(txRes.swapTransaction);
        } catch (err) {
          errors.push(`System error for ${item.mint}: ${(err as Error).message}`);
        }
      }
      return { transactions, errors };
    },
  );
