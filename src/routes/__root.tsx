import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WalletProvider } from "@/components/WalletProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Lost in the bonding curve</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't find that page. It might have graduated to a different route.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-primary to-primary-glow px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Back to BagsPulse
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BagsPulse — Social finance super-dashboard for Bags.fm" },
      {
        name: "description",
        content:
          "Live leaderboards, creator scorecards, portfolio tracking and the PulseRouter fee-split protocol for the Bags.fm ecosystem.",
      },
      { name: "author", content: "BagsPulse" },
      { name: "theme-color", content: "#16e2a0" },
      { property: "og:title", content: "BagsPulse — Social finance super-dashboard for Bags.fm" },
      {
        property: "og:description",
        content:
          "Real-time analytics, fee marketplaces and group portfolios for every token on Bags.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "BagsPulse — Social finance super-dashboard for Bags.fm" },
      { name: "twitter:description", content: "BagsPulse: A social finance dashboard and protocol for the Bags ecosystem." },
      // OG/twitter image — favicon and social preview generated from BagsPulse brand
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <WalletProvider>
          <Outlet />
        </WalletProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
