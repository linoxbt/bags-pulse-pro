import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import { getHeliusEndpoints } from "@/server/helius";
import "@solana/wallet-adapter-react-ui/styles.css";

const FALLBACK_RPC = "https://api.mainnet-beta.solana.com";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [rpc, setRpc] = useState<string>(FALLBACK_RPC);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    getHeliusEndpoints()
      .then((ep) => setRpc(ep.rpc))
      .catch(() => {});
  }, []);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new BackpackWalletAdapter()],
    [],
  );

  // SSR-safe: render children plainly until client mount, then mount the providers.
  if (!mounted) return <>{children}</>;

  return (
    <ConnectionProvider endpoint={rpc}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
