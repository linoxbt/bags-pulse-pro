import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { AmbientBackground } from "./AmbientBackground";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative">
      <AmbientBackground />
      <SiteHeader />
      <main className="flex-1 relative">{children}</main>
      <SiteFooter />
    </div>
  );
}
