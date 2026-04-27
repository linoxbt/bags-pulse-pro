import { Link } from "@tanstack/react-router";
import { BagsPulseLogo } from "./BagsPulseLogo";

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border/60 mt-24 overflow-hidden">
      {/* Animated wave band */}
      <div className="pointer-events-none absolute inset-x-0 -top-px h-24 overflow-hidden opacity-70">
        <div
          className="absolute inset-y-0 left-0 w-[200%] animate-wave-shift"
          aria-hidden
        >
          <svg
            viewBox="0 0 2400 120"
            className="h-full w-full"
            preserveAspectRatio="none"
            fill="none"
          >
            <defs>
              <linearGradient id="footerWaveStroke" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="oklch(0.74 0.17 158 / 0.0)" />
                <stop offset="50%" stopColor="oklch(0.82 0.18 158 / 0.9)" />
                <stop offset="100%" stopColor="oklch(0.74 0.17 158 / 0.0)" />
              </linearGradient>
            </defs>
            <path
              d="M0 70 Q 150 10 300 70 T 600 70 T 900 70 T 1200 70 T 1500 70 T 1800 70 T 2100 70 T 2400 70"
              stroke="url(#footerWaveStroke)"
              strokeWidth="2.5"
              fill="none"
            />
            <path
              d="M0 90 Q 150 40 300 90 T 600 90 T 900 90 T 1200 90 T 1500 90 T 1800 90 T 2100 90 T 2400 90"
              stroke="oklch(0.78 0.16 75 / 0.35)"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </div>
        {/* Drifting glow orb */}
        <div
          className="absolute -top-10 left-1/3 h-40 w-1/2 rounded-full bg-primary/20 blur-3xl animate-glow-drift"
          aria-hidden
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2 space-y-4">
          <BagsPulseLogo />
          <p className="text-sm text-muted-foreground max-w-sm">
            The social finance super-dashboard for the Bags ecosystem. Live
            leaderboards, creator scorecards, portfolios and the PulseRouter
            fee-split protocol — all in one place.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold mb-3">Product</p>
          <Link to="/dashboard" className="block text-muted-foreground hover:text-foreground">Dashboard</Link>
          <Link to="/leaderboard" className="block text-muted-foreground hover:text-foreground">Leaderboard</Link>
          <Link to="/feed" className="block text-muted-foreground hover:text-foreground">BagsFeed</Link>
          <Link to="/portfolio" className="block text-muted-foreground hover:text-foreground">Portfolio</Link>
          <Link to="/referrals" className="block text-muted-foreground hover:text-foreground">Referrals</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold mb-3">Protocol</p>
          <Link to="/router" className="block text-muted-foreground hover:text-foreground">PulseRouter</Link>
          <Link to="/docs" className="block text-muted-foreground hover:text-foreground">Developer docs</Link>
          <Link to="/pricing" className="block text-muted-foreground hover:text-foreground">Pricing</Link>
          <Link to="/legal" className="block text-muted-foreground hover:text-foreground">Legal</Link>
        </div>
      </div>
      <div className="relative border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} BagsPulse. Built on Solana · Bags · Helius · Meteora.</p>
          <p className="font-mono">Fee program · FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK</p>
        </div>
      </div>
    </footer>
  );
}
