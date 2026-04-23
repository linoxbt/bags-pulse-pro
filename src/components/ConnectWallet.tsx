import { Button } from "./ui/button";
import { Wallet, LogOut, Loader2, Copy, ExternalLink } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { shortAddress } from "@/lib/format";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import { getWalletOverview, type WalletOverview } from "@/server/wallet";
import { formatNumber, formatUsd } from "@/lib/format";

interface ConnectWalletProps {
  size?: "sm" | "default" | "lg";
  full?: boolean;
}

export function ConnectWallet({ size = "sm", full = false }: ConnectWalletProps) {
  const wallet = useWallet();
  const [overview, setOverview] = useState<WalletOverview | null>(null);

  useEffect(() => {
    if (!wallet.authenticated || !wallet.address) {
      setOverview(null);
      return;
    }
    let cancelled = false;
    getWalletOverview({ data: { wallet: wallet.address } })
      .then((res) => !cancelled && setOverview(res))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wallet.authenticated, wallet.address]);

  if (!wallet.ready && !wallet.configured) {
    return (
      <Button size={size} variant="outline" disabled className={full ? "w-full" : undefined}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading
      </Button>
    );
  }

  if (!wallet.authenticated || !wallet.address) {
    return (
      <Button
        size={size}
        onClick={wallet.login}
        className={`bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90 ${full ? "w-full" : ""}`}
      >
        <Wallet className="h-4 w-4" /> Connect
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant="outline" className={full ? "w-full" : undefined}>
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="font-mono">{shortAddress(wallet.address)}</span>
          {overview && (
            <span className="hidden sm:inline text-xs text-muted-foreground font-mono">
              · {overview.solBalance.toFixed(2)} SOL
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal space-y-1">
          <p className="text-xs text-muted-foreground">Connected wallet</p>
          <p className="font-mono text-sm truncate">{wallet.address}</p>
          {overview && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-secondary/40 p-2">
                <p className="text-muted-foreground">SOL</p>
                <p className="font-mono">{overview.solBalance.toFixed(4)}</p>
              </div>
              <div className="rounded-md bg-secondary/40 p-2">
                <p className="text-muted-foreground">Holdings</p>
                <p className="font-mono">{formatUsd(overview.totalUsd, { compact: true })}</p>
              </div>
              <div className="rounded-md bg-secondary/40 p-2">
                <p className="text-muted-foreground">Bags tokens</p>
                <p className="font-mono">{formatNumber(overview.tokenCount, false)}</p>
              </div>
              <div className="rounded-md bg-secondary/40 p-2">
                <p className="text-muted-foreground">Network</p>
                <p className="font-mono">mainnet</p>
              </div>
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard.writeText(wallet.address!);
            toast.success("Address copied");
          }}
        >
          <Copy className="h-4 w-4" /> Copy address
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            window.open(`https://solscan.io/account/${wallet.address}`, "_blank", "noopener")
          }
        >
          <ExternalLink className="h-4 w-4" /> View on Solscan
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await wallet.logout();
            toast.success("Wallet disconnected");
          }}
        >
          <LogOut className="h-4 w-4" /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
