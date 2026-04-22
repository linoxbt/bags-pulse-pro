import { useEffect, useState, type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { getPrivyConfig, getHeliusEndpoints } from "@/server/helius";

type Endpoints = { rpc: string; ws: string; live: boolean };

const FALLBACK_ENDPOINTS: Endpoints = {
  rpc: "https://api.mainnet-beta.solana.com",
  ws: "wss://api.mainnet-beta.solana.com",
  live: false,
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [appId, setAppId] = useState<string | null>(null);
  const [, setEndpoints] = useState<Endpoints>(FALLBACK_ENDPOINTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPrivyConfig(), getHeliusEndpoints()]).then(([cfg, ep]) => {
      if (cancelled) return;
      setAppId(cfg.appId);
      setEndpoints(ep);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || !appId) {
    // Privy not configured — render children plainly so the app still works.
    // The `useWallet` hook returns `configured: false` and shows a CTA.
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#10b981",
          walletChainType: "solana-only",
        },
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors() },
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
        loginMethods: ["wallet", "email"],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
