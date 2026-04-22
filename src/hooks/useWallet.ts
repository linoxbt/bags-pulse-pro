import { usePrivy, useSolanaWallets } from "@privy-io/react-auth";

export interface WalletState {
  ready: boolean;
  authenticated: boolean;
  configured: boolean;
  address: string | null;
  login: () => void;
  logout: () => Promise<void>;
}

// Safe wrapper that returns a "not configured" state when Privy isn't set up
// instead of throwing — so pages can still render.
export function useWallet(): WalletState {
  try {
    const { ready, authenticated, login, logout } = usePrivy();
    const { wallets } = useSolanaWallets();
    const address = wallets[0]?.address ?? null;
    return {
      ready,
      authenticated,
      configured: true,
      address,
      login,
      logout,
    };
  } catch {
    return {
      ready: false,
      authenticated: false,
      configured: false,
      address: null,
      login: () => {
        // No-op when Privy isn't configured
        if (typeof window !== "undefined") {
          window.alert(
            "Wallet login isn't configured yet. Set VITE_PRIVY_APP_ID in your environment to enable Solana wallet sign-in.",
          );
        }
      },
      logout: async () => {},
    };
  }
}
