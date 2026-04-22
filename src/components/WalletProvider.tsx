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
  const [endpoints, setEndpoints] = useState<Endpoints>(FALLBACK_ENDPOINTS);
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
    // Privy not configured yet — render children without provider so the app
    // still works. Wallet UI shows a "configure Privy" call to action.
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#10b981",
          logo: undefined,
          walletChainType: "solana-only",
        },
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors() },
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
        loginMethods: ["wallet", "email"],
        solanaClusters: [
          {
            name: "mainnet-beta",
            rpcUrl: endpoints.rpc,
          },
        ],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
