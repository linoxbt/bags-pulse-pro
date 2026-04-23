import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { listMyBaskets, listPublicBaskets, createBasket, type Basket } from "@/server/baskets";
import { useWallet } from "@/hooks/useWallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import { Plus, Sparkles, Users, Loader2 } from "lucide-react";
import { RelativeTime } from "@/components/RelativeTime";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/baskets")({
  head: () => ({
    meta: [
      { title: "Baskets — BagsPulse" },
      { name: "description", content: "Curate group token baskets with friends. Track shared P&L on Bags." },
    ],
  }),
  loader: () => listPublicBaskets(),
  component: BasketsPage,
});

function BasketsPage() {
  const { baskets: publicBaskets } = Route.useLoaderData() as { baskets: Basket[] };
  const wallet = useWallet();
  const [mine, setMine] = useState<Basket[]>([]);
  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const has = !!data.user;
      setAuthed(has);
      if (has) loadMine();
    });
  }, []);

  async function loadMine() {
    setLoading(true);
    try {
      const res = await listMyBaskets();
      setMine(res.baskets);
    } catch {
      /* ignore — user not signed in */
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Group baskets</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Curate token baskets with friends. Co-own performance, share alpha.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!wallet.authenticated && <ConnectWallet size="sm" />}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground" disabled={!authed}>
                  <Plus className="h-4 w-4" /> New basket
                </Button>
              </DialogTrigger>
              <CreateBasketDialog
                onCreated={(b) => {
                  setOpen(false);
                  setMine((prev) => [b, ...prev]);
                  toast.success(`${b.name} created`);
                }}
              />
            </Dialog>
          </div>
        </header>

        {!authed && (
          <Card className="bg-card/60 border-dashed">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Sign in to create and manage your own baskets.{" "}
              <Link to="/auth" className="text-primary hover:underline">Open auth →</Link>
            </CardContent>
          </Card>
        )}

        {authed && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">My baskets</h2>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : mine.length === 0 ? (
              <Card className="bg-card/60 border-dashed">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No baskets yet. Create your first one above.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mine.map((b) => (
                  <BasketCard key={b.id} b={b} />
                ))}
              </div>
            )}
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Public baskets</h2>
            <span className="text-xs text-muted-foreground font-mono">{publicBaskets.length} live</span>
          </div>
          {publicBaskets.length === 0 ? (
            <Card className="bg-card/60 border-dashed">
              <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-2">
                <Sparkles className="h-6 w-6 text-primary mx-auto" />
                <p>No public baskets yet — be the first to share one with the community.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {publicBaskets.map((b) => (
                <BasketCard key={b.id} b={b} />
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function BasketCard({ b }: { b: Basket }) {
  return (
    <Link to="/baskets/$id" params={{ id: b.id }} className="block group">
      <Card className="bg-card/60 hover:border-primary/40 transition h-full">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="truncate">{b.name}</span>
            {b.is_public && (
              <span className="text-[10px] font-mono uppercase tracking-widest text-primary">public</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          {b.description && <p className="text-sm text-muted-foreground line-clamp-2">{b.description}</p>}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> shared</span>
            <RelativeTime date={b.updated_at} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CreateBasketDialog({ onCreated }: { onCreated: (b: Basket) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await createBasket({ data: { name, description, isPublic } });
      onCreated(res.basket);
      setName("");
      setDescription("");
      setIsPublic(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New basket</DialogTitle>
        <DialogDescription>Create a shared bag — add tokens and invite friends.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input required maxLength={80} placeholder="Friday Degens" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea rows={2} maxLength={280} placeholder="What's this basket about?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/30 px-3 py-2">
          <div>
            <p className="text-sm font-medium">Public</p>
            <p className="text-xs text-muted-foreground">Discoverable by anyone</p>
          </div>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting || !name.trim()} className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create basket"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
