import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";

export interface WalletState {
  ready: boolean;
  authenticated: boolean;
  configured: boolean;
  address: string | null;
  login: (options?: Parameters<ReturnType<typeof usePrivy>["login"]>[0]) => void;
  logout: () => Promise<void>;
}

// Safe wrapper. When Privy isn't configured (no VITE_PRIVY_APP_ID), the
// PrivyProvider is skipped and the underlying hooks throw — we catch and
// return a "not configured" state so pages can still render gracefully.
export function useWallet(): WalletState {
  try {
    const { ready, authenticated, login, logout } = usePrivy();
    const { wallets } = useWallets();
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
        if (typeof window !== "undefined") {
          window.alert(
            "Wallet sign-in needs a Privy App ID. Add PRIVY_APP_ID to your project secrets to enable it.",
          );
        }
      },
      logout: async () => {},
    };
  }
}
