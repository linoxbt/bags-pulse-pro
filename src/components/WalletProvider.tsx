import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import { getHeliusEndpoints } from "@/server/helius";
import { supabase } from "@/integrations/supabase/client";
import "@solana/wallet-adapter-react-ui/styles.css";

const FALLBACK_RPC = "https://api.mainnet-beta.solana.com";

// When a Solana wallet connects, ensure we have a Supabase auth session so
// RLS-protected tables (baskets, watchlists, partner_registry…) work. We use
// anonymous sign-in — the wallet is the real identity, Supabase just gives
// us a stable auth.uid() to scope rows by.
function SupabaseSessionBridge() {
  const { connected, publicKey } = useWallet();
  useEffect(() => {
    if (!connected || !publicKey) return;
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!sess.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.warn("[supabase] anon sign-in failed", error.message);
          return;
        }
      }
      // Stamp the wallet address onto the profile (best-effort).
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase
        .from("profiles")
        .upsert(
          { user_id: u.user.id, wallet_address: publicKey.toBase58() },
          { onConflict: "user_id" },
        );
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, publicKey]);
  return null;
}

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
    () => (mounted ? [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new BackpackWalletAdapter()] : []),
    [mounted],
  );

  return (
    <ConnectionProvider endpoint={rpc}>
      <SolanaWalletProvider wallets={wallets} autoConnect={mounted}>
        <WalletModalProvider>
          <SupabaseSessionBridge />
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
