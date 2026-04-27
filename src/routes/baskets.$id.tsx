import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExecuteBasketDialog } from "@/components/ExecuteBasketDialog";
import { getBasket, addBasketToken, type Basket, type BasketToken, type BasketMember } from "@/server/baskets";
import { fetchTokens, type Token } from "@/server/bags";
import { ArrowLeft, Coins, Loader2, Plus, Users, Zap } from "lucide-react";
import { RelativeTime } from "@/components/RelativeTime";
import { useState } from "react";
import { toast } from "sonner";
import { formatUsd, shortAddress } from "@/lib/format";

export const Route = createFileRoute("/baskets/$id")({
  head: ({ loaderData }) => {
    const ld = loaderData as unknown as { basket?: Basket | null } | undefined;
    return {
      meta: [
        { title: `${ld?.basket?.name ?? "Basket"} — BagsPulse` },
        { name: "description", content: "Group portfolio basket on BagsPulse." },
      ],
    };
  },
  loader: async ({ params }) => {
    const [detail, tokens] = await Promise.all([
      getBasket({ data: { id: params.id } }),
      fetchTokens(),
    ]);
    if (!detail.basket) throw notFound();
    return { ...detail, allTokens: tokens.tokens };
  },
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <PageShell>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center space-y-3">
          <h1 className="text-2xl font-semibold">Could not load basket</h1>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
        </div>
      </PageShell>
    );
  },
  notFoundComponent: () => (
    <PageShell>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center space-y-3">
        <h1 className="text-2xl font-semibold">Basket not found</h1>
        <Button asChild><Link to="/baskets">Back to baskets</Link></Button>
      </div>
    </PageShell>
  ),
  component: BasketDetailPage,
});

function BasketDetailPage() {
  const data = Route.useLoaderData() as {
    basket: Basket;
    tokens: BasketToken[];
    members: BasketMember[];
    allTokens: Token[];
  };
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [execOpen, setExecOpen] = useState(false);
  const tokenMap = new Map(data.allTokens.map((t) => [t.mint, t]));
  const enriched = data.tokens.map((bt) => {
    const live = tokenMap.get(bt.mint);
    return { bt, live };
  });
  const totalValue = enriched.reduce((s, { live }) => s + (live?.marketCap ?? 0), 0);

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 space-y-8">
        <Link to="/baskets" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to baskets
        </Link>

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{data.basket.name}</h1>
            {data.basket.description && (
              <p className="text-muted-foreground mt-1 text-sm max-w-xl">{data.basket.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              <Users className="inline h-3 w-3 mr-1" /> {data.members.length} member{data.members.length === 1 ? "" : "s"}
              {" · "}updated <RelativeTime date={data.basket.updated_at} />
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
                <Plus className="h-4 w-4" /> Add token
              </Button>
            </DialogTrigger>
            <AddTokenDialog
              basketId={data.basket.id}
              candidates={data.allTokens}
              onAdded={() => {
                setOpen(false);
                router.invalidate();
              }}
            />
          </Dialog>

          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied to clipboard");
              }}
            >
              Share
            </Button>

            <Button 
              variant="outline" 
              onClick={() => setExecOpen(true)}
              className="border-primary/50 text-primary hover:bg-primary/10"
            >
              <Zap className="h-4 w-4 mr-2" /> Buy basket
            </Button>
          </div>

          <ExecuteBasketDialog
            basket={data.basket}
            tokens={data.tokens}
            open={execOpen}
            onOpenChange={setExecOpen}
          />
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard label="Tracked mcap" value={formatUsd(totalValue, { compact: true })} />
          <KpiCard label="Tokens" value={String(enriched.length)} />
          <KpiCard label="Members" value={String(data.members.length)} />
        </div>

        <Card className="bg-card/60">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base">Holdings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {enriched.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Coins className="h-6 w-6 text-primary mx-auto mb-2" />
                No tokens yet. Add one to get started.
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {enriched.map(({ bt, live }) => (
                  <li key={bt.id} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30">
                    {live?.image || bt.image ? (
                      <img src={live?.image ?? bt.image ?? ""} alt="" className="h-9 w-9 rounded-md ring-1 ring-border" loading="lazy" />
                    ) : (
                      <div className="h-9 w-9 rounded-md bg-secondary" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">${live?.symbol ?? bt.symbol ?? "?"}</p>
                      <p className="text-xs text-muted-foreground truncate">{live?.name ?? bt.name ?? shortAddress(bt.mint)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono">{formatUsd(live?.marketCap ?? 0, { compact: true })}</p>
                      <p className="text-xs font-mono text-muted-foreground">{(bt.target_bps / 100).toFixed(1)}% target</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base">Members</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <ul className="space-y-2">
              {data.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="font-mono">{shortAddress(m.user_id)}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-widest">{m.role}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-card/60">
      <CardContent className="p-5">
        <p className="text-xs uppercase text-muted-foreground tracking-widest">{label}</p>
        <p className="mt-2 text-2xl font-semibold font-mono">{value}</p>
      </CardContent>
    </Card>
  );
}

function AddTokenDialog({
  basketId,
  candidates,
  onAdded,
}: {
  basketId: string;
  candidates: Token[];
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const filtered = candidates
    .filter((t) => !query || t.symbol.toLowerCase().includes(query.toLowerCase()) || t.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 30);

  async function add(t: Token) {
    setAdding(t.mint);
    try {
      await addBasketToken({
        data: { basketId, mint: t.mint, symbol: t.symbol, name: t.name, image: t.image, targetBps: 1000 },
      });
      toast.success(`Added $${t.symbol}`);
      onAdded();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAdding(null);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add a Bags token</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Search</Label>
          <Input placeholder="Search symbol or name…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <ul className="max-h-80 overflow-y-auto divide-y divide-border/50 rounded-md border border-border/60">
          {filtered.map((t) => (
            <li key={t.mint} className="flex items-center gap-3 px-3 py-2">
              <img src={t.image} alt="" className="h-8 w-8 rounded-md ring-1 ring-border" loading="lazy" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">${t.symbol}</p>
                <p className="text-xs text-muted-foreground truncate">{t.name}</p>
              </div>
              <Button size="sm" variant="outline" disabled={adding === t.mint} onClick={() => add(t)}>
                {adding === t.mint ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <DialogFooter />
    </DialogContent>
  );
}
