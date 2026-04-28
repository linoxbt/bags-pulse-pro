import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useWallet } from "@/hooks/useWallet";
import {
  useConnection,
  useWallet as useSolanaWallet,
} from "@solana/wallet-adapter-react";
import { buildTokenLaunchPlan, type LaunchPlan } from "@/server/launchpad";
import { Loader2, Rocket, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/launch")({
  head: () => ({
    meta: [
      { title: "Launch a token — BagsPulse" },
      {
        name: "description",
        content:
          "Launch an SPL token on Bags through BagsPulse. Creator earns 80% of trading fees forever, BagsPulse routes 15% to the treasury, partners earn 5%.",
      },
    ],
  }),
  component: LaunchPage,
});

function LaunchPage() {
  const wallet = useWallet();
  const solana = useSolanaWallet();
  const { connection } = useConnection();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [twitter, setTwitter] = useState("");
  const [website, setWebsite] = useState("");
  const [telegram, setTelegram] = useState("");
  const [initialBuySol, setInitialBuySol] = useState("0");

  const [building, setBuilding] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [plan, setPlan] = useState<LaunchPlan | null>(null);
  const [step, setStep] = useState(0);
  const [signatures, setSignatures] = useState<string[]>([]);

  async function build() {
    if (!solana.publicKey) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!name || !symbol || !description || !imageUrl) {
      toast.error("Fill name, symbol, description and image URL");
      return;
    }
    setBuilding(true);
    setPlan(null);
    setSignatures([]);
    setStep(0);
    try {
      const initial = Math.floor((Number(initialBuySol) || 0) * 1_000_000_000);
      const res = await buildTokenLaunchPlan({
        data: {
          launcher: solana.publicKey.toBase58(),
          name,
          symbol,
          description,
          imageUrl,
          website: website || undefined,
          twitter: twitter || undefined,
          telegram: telegram || undefined,
          initialBuyLamports: initial,
        },
      });
      if (!res.plan) throw new Error(res.error || "Could not prepare launch");
      setPlan(res.plan);
      toast.success("Launch plan ready — sign each transaction");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBuilding(false);
    }
  }

  async function executePlan() {
    if (!plan || !solana.signTransaction) return;
    setLaunching(true);
    try {
      const { VersionedTransaction } = await import("@solana/web3.js");
      const sigs: string[] = [];
      for (let i = step; i < plan.transactions.length; i++) {
        setStep(i);
        const buf = Uint8Array.from(atob(plan.transactions[i]), (c) => c.charCodeAt(0));
        const tx = VersionedTransaction.deserialize(buf);
        const signed = await solana.signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });
        await connection.confirmTransaction(sig, "confirmed");
        sigs.push(sig);
        setSignatures([...sigs]);
        toast.success(`${plan.labels[i]} confirmed`);
      }
      setStep(plan.transactions.length);
      toast.success("🚀 Token launched on Bags", {
        description: `${symbol} is live at ${plan.tokenMint.slice(0, 12)}…`,
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLaunching(false);
    }
  }

  const complete = plan && step >= plan.transactions.length;

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12 space-y-8">
        <header className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Powered by Bags + PulseRouter
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Launch your token
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto">
            Creator keeps <span className="text-foreground font-medium">80%</span> of
            trading fees forever. BagsPulse routes <span className="text-foreground font-medium">15%</span> to the treasury and
            <span className="text-foreground font-medium"> 5%</span> to the partner ecosystem — all settled on-chain inside the Bags fee program.
          </p>
        </header>

        <Card className="bg-card/60">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" /> Token details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="BagsPulse" maxLength={32} />
              </Field>
              <Field label="Symbol" required>
                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="PULSE"
                  maxLength={10}
                />
              </Field>
            </div>
            <Field label="Description" required>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="What your token represents. Shown on Bags, Jupiter, DexScreener."
              />
            </Field>
            <Field label="Image URL" required>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…/logo.png (512×512 recommended)"
              />
              {imageUrl && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={imageUrl}
                    alt="preview"
                    className="h-16 w-16 rounded-md object-cover border border-border"
                    onError={(e) => ((e.currentTarget.style.opacity = "0.2"))}
                  />
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Upload className="h-3 w-3" /> preview
                  </span>
                </div>
              )}
            </Field>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Twitter / X">
                <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" />
              </Field>
              <Field label="Website">
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Telegram">
                <Input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="t.me/…" />
              </Field>
            </div>
            <Field label={`Initial buy — ${initialBuySol} SOL`}>
              <input
                type="range"
                min={0}
                max={10}
                step={0.1}
                value={initialBuySol}
                onChange={(e) => setInitialBuySol(e.target.value)}
                className="w-full accent-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                Snipe your own bonding curve at launch. Optional — set 0 to skip.
              </p>
            </Field>

            {wallet.authenticated ? (
              <Button
                onClick={build}
                disabled={building}
                className="w-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground"
              >
                {building ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Preparing…
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" /> Prepare launch plan
                  </>
                )}
              </Button>
            ) : (
              <ConnectWallet size="default" full />
            )}
          </CardContent>
        </Card>

        {plan && (
          <Card className="bg-card/60 border-primary/30">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Sign &amp; launch
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="rounded-md bg-secondary/30 p-3 text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mint</span>
                  <span>{plan.tokenMint.slice(0, 12)}…{plan.tokenMint.slice(-6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Config</span>
                  <span>{plan.configKey.slice(0, 12)}…{plan.configKey.slice(-6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transactions</span>
                  <span>{plan.transactions.length}</span>
                </div>
              </div>

              <ul className="space-y-2">
                {plan.labels.map((label, i) => {
                  const done = i < step || (complete && i === plan.transactions.length - 1);
                  const active = i === step && launching;
                  return (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        {done ? (
                          <ShieldCheck className="h-4 w-4 text-success" />
                        ) : active ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <span className="h-4 w-4 rounded-full border border-border" />
                        )}
                        {label}
                      </span>
                      {signatures[i] && (
                        <a
                          href={`https://solscan.io/tx/${signatures[i]}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] text-primary hover:underline"
                        >
                          {signatures[i].slice(0, 10)}…
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>

              {complete ? (
                <div className="rounded-md bg-success/10 border border-success/30 p-4 text-sm space-y-2">
                  <p className="font-semibold text-success flex items-center gap-2">
                    <Rocket className="h-4 w-4" /> Launched!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {symbol} is live. View it on{" "}
                    <a
                      className="text-primary underline"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://bags.fm/${plan.tokenMint}`}
                    >
                      bags.fm
                    </a>{" "}
                    or open it on{" "}
                    <a
                      className="text-primary underline"
                      target="_blank"
                      rel="noreferrer"
                      href={`/token/${plan.tokenMint}`}
                    >
                      BagsPulse
                    </a>
                    .
                  </p>
                </div>
              ) : (
                <Button
                  onClick={executePlan}
                  disabled={launching}
                  className="w-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground"
                >
                  {launching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Signing step {step + 1} / {plan.transactions.length}…
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4" /> Sign &amp; send all
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <Badge variant="outline" className="border-primary/30 text-primary">
            Creator 80%
          </Badge>
          <Badge variant="outline" className="border-accent/30 text-accent">
            BagsPulse 15%
          </Badge>
          <Badge variant="outline">Partners 5%</Badge>
        </div>
      </div>
    </PageShell>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
