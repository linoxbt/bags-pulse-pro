import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchFeed } from "@/server/bags";
import type { FeedEvent } from "@/lib/sample-data";
import { formatNumber, timeAgo } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, GraduationCap, Megaphone, Rocket, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "BagsFeed — BagsPulse" },
      { name: "description", content: "Realtime social finance feed for every Bags token." },
    ],
  }),
  loader: () => fetchFeed(),
  component: FeedPage,
});

const ICONS = {
  buy: ArrowUpRight,
  sell: ArrowDownRight,
  milestone: Sparkles,
  graduation: GraduationCap,
  launch: Rocket,
  fee: Megaphone,
} as const;

function FeedPage() {
  const data = Route.useLoaderData() as { events: FeedEvent[]; live: boolean };
  const [filter, setFilter] = useState<"all" | FeedEvent["type"]>("all");
  const events = filter === "all" ? data.events : data.events.filter((e) => e.type === filter);

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">BagsFeed</h1>
          <p className="text-muted-foreground text-sm">
            Realtime stream of buys, milestones, graduations and creator fee claims across the ecosystem.
          </p>
        </header>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="bg-secondary/40 flex-wrap h-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="buy">Buys</TabsTrigger>
            <TabsTrigger value="sell">Sells</TabsTrigger>
            <TabsTrigger value="milestone">Milestones</TabsTrigger>
            <TabsTrigger value="graduation">Graduations</TabsTrigger>
            <TabsTrigger value="launch">Launches</TabsTrigger>
            <TabsTrigger value="fee">Fees</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="bg-card/60">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary pulse-ring" /> Live
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/50">
              {events.map((e) => {
                const Icon = ICONS[e.type];
                const positive =
                  e.type === "buy" || e.type === "milestone" || e.type === "graduation" || e.type === "launch";
                return (
                  <li key={e.id} className="flex items-start gap-3 px-5 py-4 hover:bg-secondary/20">
                    <span
                      className={cn(
                        "h-9 w-9 rounded-lg inline-flex items-center justify-center",
                        positive ? "bg-success/15 text-success" : e.type === "sell" ? "bg-destructive/15 text-destructive" : "bg-accent/15 text-accent",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold">${e.symbol}</span> · {e.message}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {e.actor} · {timeAgo(e.at)}
                      </p>
                    </div>
                    <span className="text-sm font-mono text-muted-foreground shrink-0">
                      ${formatNumber(e.amountUsd)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
