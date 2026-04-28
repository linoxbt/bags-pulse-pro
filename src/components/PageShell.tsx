import type { ReactNode } from "react";
import { SiteHeader, SiteSidebar } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { AmbientBackground } from "./AmbientBackground";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative">
      <AmbientBackground />
      <SiteHeader />
      <div className="flex-1 flex">
        <SiteSidebar />
        <main className="flex-1 relative min-w-0">{children}</main>
      </div>
      <SiteFooter />
    </div>
  );
}
