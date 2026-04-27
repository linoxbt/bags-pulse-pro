import { BagsSDK } from "@bagsfm/bags-sdk";
import { Connection, PublicKey } from "@solana/web3.js";

export type PulseRouterConfig = {
  appId: string;
  rpcUrl?: string;
  baseUrl?: string;
};

/**
 * PulseRouter SDK
 * A lightweight wrapper around the official Bags SDK that automatically
 * injects protocol fee-splits and partner configuration.
 */
export class PulseRouter {
  private appId: string;
  private baseUrl: string;
  private connection: Connection;

  constructor(config: PulseRouterConfig) {
    this.appId = config.appId;
    this.baseUrl = config.baseUrl || "https://bagspulse.lovable.app";
    this.connection = new Connection(config.rpcUrl || "https://api.mainnet-beta.solana.com");
  }

  /**
   * Resolves the on-chain fee configuration for a token launch.
   * Automatically fetches your registered partner wallet and injects the protocol share.
   */
  async getLaunchConfig(creatorWallet: string | PublicKey) {
    const creator = creatorWallet instanceof PublicKey ? creatorWallet.toBase58() : creatorWallet;
    
    // Fetch registered partner details from BagsPulse
    const res = await fetch(`${this.baseUrl}/api/public/router/partner?app_id=${this.appId}`);
    if (!res.ok) throw new Error("Failed to resolve PulseRouter partner configuration");
    
    const partner = await res.json();
    if (!partner || !partner.fee_wallet) {
      throw new Error(`Partner '${this.appId}' not found in PulseRouter registry`);
    }

    // Protocol treasury address (static)
    const TREASURY = "6CxhRUpZ9av3X28QxvppYycEm8SjTS5Wf5UgxBaEzhd";
    
    // Calculate shares:
    // Total = 10,000 BPS
    // Protocol = 500 BPS (5%)
    // Partner = 1500 BPS (15%) - or whatever was registered
    // Creator = Remaining (8000 BPS)
    
    const protocolBps = 500;
    const partnerBps = partner.bps || 1500;
    const creatorBps = 10000 - protocolBps - partnerBps;

    return {
      users: [
        { wallet: creator, bps: creatorBps },
        { wallet: partner.fee_wallet, bps: partnerBps },
        { wallet: TREASURY, bps: protocolBps },
      ],
    };
  }

  /**
   * Helper to build the full Bags fee configuration using the Bags SDK
   */
  async createBagsFeeShareConfig(sdk: BagsSDK, payer: PublicKey, creator: PublicKey) {
    const config = await this.getLaunchConfig(creator);
    return await (sdk as any).config.createBagsFeeShareConfig({
      payer,
      users: config.users.map(u => ({
        wallet: new PublicKey(u.wallet),
        bps: u.bps
      }))
    });
  }
}
