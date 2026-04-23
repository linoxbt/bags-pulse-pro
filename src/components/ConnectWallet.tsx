import { Button } from "./ui/button";
import { Wallet, LogOut, Loader2 } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { shortAddress } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { toast } from "sonner";

interface ConnectWalletProps {
  size?: "sm" | "default" | "lg";
  full?: boolean;
}

export function ConnectWallet({ size = "sm", full = false }: ConnectWalletProps) {
  const wallet = useWallet();
  const handleLogin = () => wallet.login({ loginMethods: ["wallet"] });

  if (!wallet.configured) {
    return (
      <Button
        size={size}
        variant="outline"
        onClick={handleLogin}
        className={full ? "w-full" : undefined}
      >
        <Wallet className="h-4 w-4" /> Connect wallet
      </Button>
    );
  }

  if (!wallet.ready) {
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
        onClick={handleLogin}
        className={`bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90 ${full ? "w-full" : ""}`}
      >
        <Wallet className="h-4 w-4" /> Connect wallet
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant="outline" className={full ? "w-full" : undefined}>
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="font-mono">{shortAddress(wallet.address)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs text-muted-foreground">Connected wallet</p>
          <p className="font-mono text-sm mt-0.5 truncate">{wallet.address}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard.writeText(wallet.address!);
            toast.success("Address copied");
          }}
        >
          Copy address
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
