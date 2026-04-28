// Bags launchpad integration — uses our partner key so BagsPulse earns
// protocol fees on every token launched through this page.
//
// Flow:
//  1. Client POSTs { name, symbol, description, imageUrl, initialBuySol } here
//  2. We call BagsSDK.tokenLaunch.createTokenInfoAndMetadata (upload metadata)
//  3. We call BagsSDK.config.createBagsFeeShareConfig with:
//        - creator wallet  (launcher)       — 80% (8000 bps)
//        - BagsPulse treasury                — 15% (1500 bps)
//        - partner key implicitly adds its 5% cut via the partner arg
//  4. We call BagsSDK.tokenLaunch.createLaunchTransaction with the config key
//  5. Client signs all transactions in order and sends them.
import { createServerFn } from "@tanstack/react-start";
import { BagsSDK, BAGS_CONFIG_TYPE } from "@bagsfm/bags-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { BAGSPULSE_TREASURY } from "@/lib/constants";

function heliusRpc() {
  return process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : "https://api.mainnet-beta.solana.com";
}

// Derive the partner Pubkey from the BAGS_PARTNER_KEY secret.
// Bags uses the API key to look up the partner's on-chain config.
function getPartnerKey(): string | null {
  return process.env.BAGS_PARTNER_KEY?.trim() || null;
}

export type LaunchPlan = {
  tokenMint: string;
  metadataUri: string;
  configKey: string;
  // base64 serialized VersionedTransactions to be signed in order
  transactions: string[];
  // Labels for the UI — one per transaction in `transactions`
  labels: string[];
};

export const buildTokenLaunchPlan = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      launcher: string;
      name: string;
      symbol: string;
      description: string;
      imageUrl: string;
      website?: string;
      twitter?: string;
      telegram?: string;
      initialBuyLamports?: number; // lamports of SOL to buy on launch
    }) => d,
  )
  .handler(async ({ data }): Promise<{ plan: LaunchPlan | null; error?: string }> => {
    const apiKey = getPartnerKey();
    if (!apiKey) return { plan: null, error: "BAGS_PARTNER_KEY not configured" };

    try {
      const connection = new Connection(heliusRpc(), "confirmed");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sdk = new BagsSDK(apiKey, connection as any);

      const launcher = new PublicKey(data.launcher);
      const treasury = new PublicKey(BAGSPULSE_TREASURY);

      // 1. Create token metadata (uploads image if needed, returns mint + URI)
      const meta = await sdk.tokenLaunch.createTokenInfoAndMetadata({
        name: data.name.slice(0, 32),
        symbol: data.symbol.slice(0, 10),
        description: data.description.slice(0, 500),
        imageUrl: data.imageUrl,
        website: data.website,
        twitter: data.twitter,
        telegram: data.telegram,
      });

      const tokenMint = new PublicKey(meta.tokenMint);
      const quoteMint = new PublicKey("So11111111111111111111111111111111111111112"); // WSOL

      // 2. Create fee-share config — creator 80%, BagsPulse platform 15%
      //    (partner key automatically adds the partner's cut).
      const configRes = await sdk.config.createBagsFeeShareConfig({
        feeClaimers: [
          { user: launcher, userBps: 8000 }, // 80% creator
          { user: treasury, userBps: 1500 }, // 15% platform
          // partner gets the remaining 500 bps from its partner config
        ],
        payer: launcher,
        baseMint: tokenMint,
        bagsConfigType: BAGS_CONFIG_TYPE.DEFAULT,
      });

      // configRes.transactions are the config-creation txs.
      const cfgTxs: string[] = configRes.transactions.map((tx) =>
        Buffer.from(tx.serialize()).toString("base64"),
      );

      // 3. Build the launch transaction using that config key
      const launchTx = await sdk.tokenLaunch.createLaunchTransaction({
        metadataUrl: meta.tokenMetadata,
        tokenMint,
        launchWallet: launcher,
        initialBuyLamports: Math.max(0, Math.floor(data.initialBuyLamports ?? 0)),
        configKey: configRes.meteoraConfigKey,
      });
      const launchTxB64 = Buffer.from(launchTx.serialize()).toString("base64");

      // Touch to silence "unused" when quoteMint not directly referenced elsewhere
      void quoteMint;

      const transactions = [...cfgTxs, launchTxB64];
      const labels = [
        ...cfgTxs.map((_, i) => `Create fee-share config${cfgTxs.length > 1 ? ` (${i + 1}/${cfgTxs.length})` : ""}`),
        "Launch token on Bags",
      ];

      return {
        plan: {
          tokenMint: meta.tokenMint,
          metadataUri: meta.tokenMetadata,
          configKey: configRes.meteoraConfigKey.toBase58(),
          transactions,
          labels,
        },
      };
    } catch (e) {
      console.error("[launchpad] build failed", e);
      return { plan: null, error: (e as Error).message };
    }
  });
