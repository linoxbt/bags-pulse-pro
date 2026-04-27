import { Link, useLocation } from "@tanstack/react-router";
import { BagsPulseLogo } from "./BagsPulseLogo";
import { ThemeToggle } from "./ThemeToggle";
import { ConnectWallet } from "./ConnectWallet";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { useState } from "react";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/feed", label: "BagsFeed" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/baskets", label: "Baskets" },
  { to: "/router", label: "PulseRouter" },
  { to: "/referrals", label: "Referrals" },
  { to: "/docs", label: "Docs" },
] as const;

export function SiteHeader() {
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-xl bg-background/70 overflow-hidden">
      {/* Animated wave band — mirrors the footer aesthetic */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-12 overflow-hidden opacity-60">
        <div className="absolute inset-y-0 left-0 w-[200%] animate-wave-shift" aria-hidden>
          <svg viewBox="0 0 2400 60" className="h-full w-full" preserveAspectRatio="none" fill="none">
            <defs>
              <linearGradient id="headerWaveStroke" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="oklch(0.74 0.17 158 / 0.0)" />
                <stop offset="50%" stopColor="oklch(0.82 0.18 158 / 0.7)" />
                <stop offset="100%" stopColor="oklch(0.74 0.17 158 / 0.0)" />
              </linearGradient>
            </defs>
            <path
              d="M0 30 Q 150 5 300 30 T 600 30 T 900 30 T 1200 30 T 1500 30 T 1800 30 T 2100 30 T 2400 30"
              stroke="url(#headerWaveStroke)"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </div>
        <div
          className="absolute -bottom-6 left-1/4 h-12 w-1/2 rounded-full bg-primary/20 blur-2xl animate-glow-drift"
          aria-hidden
        />
      </div>

      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="shrink-0">
          <BagsPulseLogo />
        </Link>
        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map((item) => {
            const active = loc.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ConnectWallet size="sm" />
          <button
            onClick={() => setOpen((o) => !o)}
            className="lg:hidden rounded-md p-2 text-muted-foreground hover:bg-secondary"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden border-t border-border/60 bg-background/95 backdrop-blur relative">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-3">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
