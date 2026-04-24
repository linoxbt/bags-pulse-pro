import { useContext, useEffect, useState } from "react";
import { WalletContext } from "@solana/wallet-adapter-react";
import { WalletModalContext } from "@solana/wallet-adapter-react-ui";

export interface WalletState {
  ready: boolean;
  authenticated: boolean;
  configured: boolean;
  address: string | null;
  login: () => void;
  logout: () => Promise<void>;
}

// SSR-safe wrapper. The Solana wallet-adapter hooks throw synchronously when
// no provider is mounted (which is the case during SSR and the first client
// paint). We read the contexts directly so we can fall back gracefully.
export function useWallet(): WalletState {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const walletCtx = useContext(WalletContext);
  const modalCtx = useContext(WalletModalContext);

  if (!mounted || !walletCtx || !modalCtx) {
    return {
      ready: false,
      authenticated: false,
      configured: false,
      address: null,
      login: () => {
        if (typeof window !== "undefined") window.location.reload();
      },
      logout: async () => {},
    };
  }

  const { publicKey, connected, connecting, disconnect } = walletCtx;
  const address = publicKey ? publicKey.toBase58() : null;
  return {
    ready: !connecting,
    authenticated: connected && !!address,
    configured: true,
    address,
    login: () => modalCtx.setVisible(true),
    logout: async () => {
      try {
        await disconnect();
      } catch {
        /* ignore */
      }
    },
  };
}
