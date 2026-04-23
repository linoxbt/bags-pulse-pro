import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export interface WalletState {
  ready: boolean;
  authenticated: boolean;
  configured: boolean;
  address: string | null;
  login: () => void;
  logout: () => Promise<void>;
}

// Safe wrapper around Solana wallet-adapter. When the providers haven't
// mounted yet (SSR / first paint) the hooks throw — we return a "not
// configured" state so pages render gracefully.
export function useWallet(): WalletState {
  try {
    const { publicKey, connected, connecting, disconnect, wallet } = useSolanaWallet();
    const { setVisible } = useWalletModal();
    const address = publicKey ? publicKey.toBase58() : null;
    return {
      ready: !connecting,
      authenticated: connected && !!address,
      configured: true,
      address,
      login: () => setVisible(true),
      logout: async () => {
        try {
          await disconnect();
        } catch {
          /* ignore */
        }
        // hint TS that wallet is referenced
        void wallet;
      },
    };
  } catch {
    return {
      ready: false,
      authenticated: false,
      configured: false,
      address: null,
      login: () => {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      },
      logout: async () => {},
    };
  }
}
