import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Developer docs — BagsPulse" },
      { name: "description", content: "PulseRouter SDK reference and Bags API integration guide." },
    ],
  }),
  component: DocsPage,
});

function DocsPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12 space-y-10">
        <header className="space-y-3">
          <p className="text-sm text-primary font-semibold uppercase tracking-widest">Developer docs</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Build with PulseRouter
          </h1>
          <p className="text-muted-foreground">
            PulseRouter is BagsPulse's fee-routing layer on top of the official
            <code className="px-1 mx-1 font-mono bg-secondary rounded">@bagsfm/bags-sdk</code>.
            There is no separate npm package — you install the Bags SDK and use the
            BagsPulse partner registry to look up your fee_wallet at swap-time.
          </p>
        </header>

        <Section title="1. Install the real packages">
          <Code>{`npm install @bagsfm/bags-sdk @solana/web3.js`}</Code>
          <p className="text-xs text-muted-foreground">
            Note: <code className="font-mono">@pulserouter/sdk</code> does not exist on npm —
            PulseRouter is a hosted protocol, not a client SDK.
          </p>
        </Section>

        <Section title="2. Register your app">
          <p className="text-sm text-muted-foreground">
            Pick a unique <code className="px-1 font-mono bg-secondary rounded">app_id</code> slug
            and your <code className="px-1 font-mono bg-secondary rounded">fee_wallet</code> on the
            <Link to="/router" className="text-primary hover:underline mx-1">PulseRouter page</Link>.
            BagsPulse stores this mapping and uses it to inject your wallet into every
            <code className="px-1 mx-1 font-mono bg-secondary rounded">createBagsFeeShareConfig</code>
            call routed through your app.
          </p>
        </Section>

        <Section title="3. Launch tokens with the Bags SDK + your app_id">
          <Code>{`import { BagsSDK } from "@bagsfm/bags-sdk";
import { Connection } from "@solana/web3.js";

const sdk = new BagsSDK({
  apiKey: process.env.BAGS_API_KEY!,
  connection: new Connection(process.env.HELIUS_RPC_URL!),
});

// Resolve your registered split from BagsPulse
const partner = await fetch(
  "https://bagspulse.lovable.app/api/public/agent/run?app_id=your-app-id"
).then((r) => r.json());

// Build a fee share config with creator + your app + protocol
const feeConfig = await sdk.config.createBagsFeeShareConfig({
  payer: payerPubkey,
  users: [
    { wallet: creatorPubkey,           bps: 8000 }, // 80% creator
    { wallet: partner.fee_wallet,      bps: 1500 }, // 15% your app
    { wallet: partner.treasury_wallet, bps: 500  }, //  5% protocol
  ],
});`}</Code>
        </Section>

        <Section title="4. Claim accumulated fees">
          <p className="text-sm text-muted-foreground">
            Use the in-app <Link to="/router" className="text-primary hover:underline">Claim my fees</Link> dialog
            on the PulseRouter page — it builds and signs the on-chain claim transaction with your connected wallet.
          </p>
        </Section>

        <Section title="Resources">
          <ul className="text-sm space-y-2">
            <li>· Bags docs · <a className="text-primary hover:underline" href="https://docs.bags.fm" target="_blank" rel="noreferrer">docs.bags.fm</a></li>
            <li>· Bags SDK · <a className="text-primary hover:underline" href="https://github.com/bagsfm/bags-sdk" target="_blank" rel="noreferrer">github.com/bagsfm/bags-sdk</a></li>
            <li>· Helius RPC · <a className="text-primary hover:underline" href="https://docs.helius.dev" target="_blank" rel="noreferrer">docs.helius.dev</a></li>
            <li>· Fee program · <code className="font-mono">FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK</code></li>
          </ul>
          <p className="pt-4 text-sm">
            Ready to launch? <Link to="/router" className="text-primary hover:underline">Open the marketplace →</Link>
          </p>
        </Section>
      </div>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card/60">
      <CardHeader className="border-b border-border/50">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">{children}</CardContent>
    </Card>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-background/60 p-4 text-xs font-mono leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}
