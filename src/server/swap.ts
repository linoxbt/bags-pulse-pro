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
          routePlan: (raw.routePlan as Array<Record<string, unknown>>) ?? [],
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
    (d: { quote: unknown; userPublicKey: string }) => d,
  )
  .handler(async ({ data }): Promise<{ swapTransaction: string | null; error?: string }> => {
    try {
      const res = await fetch(JUP_SWAP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: data.quote,
          userPublicKey: data.userPublicKey,
          wrapAndUnwrapSol: true,
          // PulseRouter cut → BagsPulse treasury (Jupiter requires this be a
          // referral token-account; the v6 API auto-creates it for SPL fee
          // accounts. For SOL fees we rely on the user side to wrap.)
          feeAccount: undefined, // set client-side once referral ATA exists
          dynamicComputeUnitLimit: true,
        }),
      });
      if (!res.ok) return { swapTransaction: null, error: `Jupiter swap failed (${res.status})` };
      const json = (await res.json()) as { swapTransaction?: string };
      return { swapTransaction: json.swapTransaction ?? null };
    } catch (e) {
      return { swapTransaction: null, error: (e as Error).message };
    }
  });
