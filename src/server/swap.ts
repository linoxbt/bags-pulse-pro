// Jupiter aggregator-powered swap. Pure HTTP, no Node-only SDK — works in
// the Worker runtime. Every swap routes a protocol fee to the BagsPulse
// treasury via Jupiter's `platformFeeBps` + `feeAccount` parameters →
// real PulseRouter revenue, on-chain, settled inside the swap tx itself.
import { createServerFn } from "@tanstack/react-start";
import { BAGSPULSE_TREASURY, PULSEROUTER_PROTOCOL_BPS } from "@/lib/constants";

const JUP_QUOTE = "https://quote-api.jup.ag/v6/quote";
const JUP_SWAP = "https://quote-api.jup.ag/v6/swap";
const JUP_TOKENS = "https://tokens.jup.ag";
const JUP_PRICE = "https://price.jup.ag/v6/price";

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
  raw: string; // JSON-stringified full Jupiter quote, needed verbatim by /swap endpoint
};

// Return the top ~200 strict-listed tokens from Jupiter — what jupiter.ag shows.
export const listJupiterTokens = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ tokens: JupToken[] }> => {
    try {
      const res = await fetch(`${JUP_TOKENS}/tokens?tags=verified`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return { tokens: [] };
      const raw = (await res.json()) as Array<Record<string, unknown>>;
      const tokens: JupToken[] = raw.slice(0, 300).map((t) => ({
        address: String(t.address ?? ""),
        symbol: String(t.symbol ?? "?"),
        name: String(t.name ?? "Unknown"),
        decimals: Number(t.decimals ?? 9),
        logoURI: typeof t.logoURI === "string" ? t.logoURI : null,
        tags: Array.isArray(t.tags) ? (t.tags as string[]) : [],
        daily_volume: typeof t.daily_volume === "number" ? t.daily_volume : null,
      }));
      return { tokens };
    } catch {
      return { tokens: [] };
    }
  },
);

// USD prices for a batch of mints (Jupiter Price API v6).
export const getJupiterPrices = createServerFn({ method: "POST" })
  .inputValidator((d: { mints: string[] }) => d)
  .handler(async ({ data }): Promise<{ prices: Record<string, number> }> => {
    if (!data.mints.length) return { prices: {} };
    try {
      const ids = data.mints.slice(0, 10).join(",");
      const res = await fetch(`${JUP_PRICE}?ids=${ids}`);
      if (!res.ok) return { prices: {} };
      const json = (await res.json()) as { data?: Record<string, { price: number }> };
      const prices: Record<string, number> = {};
      for (const [mint, row] of Object.entries(json.data ?? {})) {
        prices[mint] = Number(row.price ?? 0);
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
      const res = await fetch(`${JUP_TOKENS}/token/${data.mint}`);
      if (!res.ok) return { token: null };
      const t = (await res.json()) as Record<string, unknown>;
      return {
        token: {
          address: String(t.address ?? data.mint),
          symbol: String(t.symbol ?? "?"),
          name: String(t.name ?? "Unknown"),
          decimals: Number(t.decimals ?? 9),
          logoURI: typeof t.logoURI === "string" ? t.logoURI : null,
          tags: Array.isArray(t.tags) ? (t.tags as string[]) : [],
          daily_volume: typeof t.daily_volume === "number" ? t.daily_volume : null,
        },
      };
    } catch {
      return { token: null };
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
          return { quote: null, error: `Jupiter quote failed (${res.status})` };
        }
        const raw = (await res.json()) as Record<string, unknown>;
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
          return {
            swapTransaction: null,
            error: `Jupiter swap failed (${res.status})`,
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
