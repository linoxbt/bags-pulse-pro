// Jupiter aggregator-powered swap. Pure HTTP, no node-only SDK — works in
// the Worker. Every swap routes a small protocol fee to the BagsPulse
// treasury via Jupiter's `feeBps` + `feeAccount` parameters → real
// PulseRouter revenue, on-chain.
import { createServerFn } from "@tanstack/react-start";
import { BAGSPULSE_TREASURY, PULSEROUTER_PROTOCOL_BPS } from "@/lib/constants";

const JUP_QUOTE = "https://quote-api.jup.ag/v6/quote";
const JUP_SWAP = "https://quote-api.jup.ag/v6/swap";

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
};

export const getSwapQuote = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { inputMint: string; outputMint: string; amount: number; slippageBps?: number }) => d,
  )
  .handler(async ({ data }): Promise<{ quote: SwapQuote | null; error?: string }> => {
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
        },
      };
    } catch (e) {
      return { quote: null, error: (e as Error).message };
    }
  });

export const buildSwapTransaction = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { quote: any; userPublicKey: string }) => d,
  )
  .handler(async ({ data }): Promise<{ swapTransaction: string | null; error?: string }> => {
    try {
      const { PublicKey } = await import("@solana/web3.js");
      const { getAssociatedTokenAddress } = await import("@solana/spl-token");
      
      const outMint = new PublicKey(data.quote.outputMint);
      const treasury = new PublicKey(BAGSPULSE_TREASURY);
      
      // Derive the referral ATA for the output mint owned by the treasury
      const feeAccount = await getAssociatedTokenAddress(outMint, treasury);

      const res = await fetch(JUP_SWAP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: data.quote,
          userPublicKey: data.userPublicKey,
          wrapAndUnwrapSol: true,
          // PulseRouter cut -> BagsPulse treasury
          feeAccount: feeAccount.toBase58(),
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto", // Set a reasonable priority fee
        }),
      });
      if (!res.ok) return { swapTransaction: null, error: `Jupiter swap failed (${res.status})` };
      const json = (await res.json()) as { swapTransaction?: string };
      return { swapTransaction: json.swapTransaction ?? null };
    } catch (e) {
      return { swapTransaction: null, error: (e as Error).message };
    }
  });

export const buildBasketTransactions = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { 
      userPublicKey: string; 
      items: Array<{ mint: string; amount: number }>; 
      slippageBps?: number;
    }) => d,
  )
  .handler(async ({ data }): Promise<{ transactions: string[]; errors: string[] }> => {
    const transactions: string[] = [];
    const errors: string[] = [];

    // Process each item to get a quote and then a transaction
    for (const item of data.items) {
      try {
        const quoteRes = await getSwapQuote({ 
          data: { 
            inputMint: "So11111111111111111111111111111111111111112", 
            outputMint: item.mint, 
            amount: item.amount, 
            slippageBps: data.slippageBps 
          } 
        });

        if (quoteRes.error || !quoteRes.quote) {
          errors.push(`Quote failed for ${item.mint}: ${quoteRes.error}`);
          continue;
        }

        const txRes = await buildSwapTransaction({ 
          data: { 
            quote: JSON.parse(JSON.stringify(quoteRes.quote)), // Ensure it's the raw quote object Jupiter expects
            userPublicKey: data.userPublicKey 
          } 
        });

        if (txRes.error || !txRes.swapTransaction) {
          errors.push(`TX failed for ${item.mint}: ${txRes.error}`);
          continue;
        }

        transactions.push(txRes.swapTransaction);
      } catch (err) {
        errors.push(`System error for ${item.mint}: ${(err as Error).message}`);
      }
    }

    return { transactions, errors };
  });
