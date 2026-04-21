import { Link } from "@tanstack/react-router";
import { BagsPulseLogo } from "./BagsPulseLogo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2 space-y-4">
          <BagsPulseLogo />
          <p className="text-sm text-muted-foreground max-w-sm">
            The social finance super-dashboard for the Bags ecosystem. Live
            leaderboards, creator scorecards, portfolios and the BagsRouter
            fee-split protocol — all in one place.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold mb-3">Product</p>
          <Link to="/dashboard" className="block text-muted-foreground hover:text-foreground">Dashboard</Link>
          <Link to="/leaderboard" className="block text-muted-foreground hover:text-foreground">Leaderboard</Link>
          <Link to="/feed" className="block text-muted-foreground hover:text-foreground">BagsFeed</Link>
          <Link to="/portfolio" className="block text-muted-foreground hover:text-foreground">Portfolio</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold mb-3">Protocol</p>
          <Link to="/router" className="block text-muted-foreground hover:text-foreground">BagsRouter</Link>
          <Link to="/docs" className="block text-muted-foreground hover:text-foreground">Developer docs</Link>
          <Link to="/pricing" className="block text-muted-foreground hover:text-foreground">Pricing</Link>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} BagsPulse. Built on Solana · Bags · Helius · Meteora.</p>
          <p className="font-mono">Fee program · FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK</p>
        </div>
      </div>
    </footer>
  );
}
