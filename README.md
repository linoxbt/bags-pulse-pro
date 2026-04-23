# BagsPulse

The social finance super-dashboard and fee-split protocol for Bags.fm

> Live leaderboards. Real-time on-chain feed. Wallet-level portfolio. Group baskets co-managed with friends. And **PulseRouter** — a protocol-grade fee-split layer that earns every app a permanent on-chain share of every token launched through it.

Live: https://bagspulse.lovable.app
Treasury: `6CxhRUpZ9av3X28QxvppYycEm8SjTS5Wf5UgxBaEzhd`
Built on: Solana mainnet, Bags.fm public API, Helius DAS, DexScreener

---

## What BagsPulse does

BagsPulse is a complete operating layer on top of [Bags.fm](https://bags.fm) — the creator-coin launchpad on Solana. It fuses three product surfaces and one protocol primitive into a single dashboard:

1. **Pulse Dashboard** — Real-time leaderboards (top 50), creator scorecards, market-cap and volume charts, and ecosystem KPIs refreshed live from the Bags v2 public API and DexScreener.
2. **BagsFeed** — Live social finance feed of launches, graduations, **buys**, **sells**, **fee claims**, and milestones, parsed from on-chain transactions via Helius.
3. **Portfolio + Baskets** — Connect a Solana wallet (Phantom, Solflare, Backpack) and we read every SPL token via Helius DAS, price it via DexScreener, and split your holdings into Bags-ecosystem vs other. Co-manage *group baskets* with friends, with shared P&L.
4. **PulseRouter** — A registered-app fee-split protocol. Wrap the Bags SDK once, and every token launched through your app routes a permanent on-chain share of fees to your wallet, the creator, and the BagsPulse treasury.

Key differentiators:
- **Live everywhere.** No mock data. Tokens, prices, holdings, fees, and feed events all come from production sources.
- **Protocol revenue.** PulseRouter earns 5% of every fee on every token launched through it — on-chain, programmatic MRR.
- **Wallet-native.** Standard Solana Wallet Adapter, no custodial accounts, no email middleware.
- **Group baskets.** Co-owned token baskets backed by Postgres + RLS — invite friends, share alpha, track together.
- **PulseRouter Blink.** Subscriptions and partner registration paid in SOL / USDC / USDT directly through Solana Actions.

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                     BagsPulse Frontend                        │
│   React 19 · TanStack Start · Tailwind v4 · shadcn/ui         │
└────────────┬───────────────────────────────────┬─────────────┘
             │                                   │
             ▼                                   ▼
   ┌────────────────────┐             ┌───────────────────────┐
   │  Server Functions   │             │  Wallet Adapter       │
   │  (createServerFn)   │             │  Phantom / Solflare   │
   │                     │             │  Backpack             │
   │  - bags.ts          │             └───────────────────────┘
   │  - wallet.ts        │
   │  - baskets.ts       │
   │  - feeSplit.ts      │
   │  - bagsrouter.ts    │
   └─────────┬──────────┘
             │
   ┌─────────┴───────────────────────────────────────────────┐
   │                                                         │
   ▼                ▼                  ▼                     ▼
┌────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────────┐
│ Bags   │   │ Helius RPC   │   │ DexScreener  │   │ Lovable Cloud  │
│ v2 API │   │ + DAS API    │   │ pricing      │   │ (Postgres+RLS) │
└────────┘   └──────────────┘   └──────────────┘   └────────────────┘
```

| Layer | Tech |
|---|---|
| Frontend | React 19, TanStack Start v1, TanStack Router, Tailwind v4, shadcn/ui, Recharts, Lottie |
| Server | TanStack `createServerFn` (Cloudflare Worker SSR), Zod validation |
| Database | Lovable Cloud (Postgres + RLS), `baskets`, `basket_members`, `basket_tokens`, `partner_registry`, `fee_splits`, `fee_claims`, `strategy_licenses`, `profiles` |
| Auth | Standard Solana Wallet Adapter — no custodial layer |
| On-chain | Bags fee program `FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK` |
| External APIs | Bags.fm public v2, Helius (RPC + DAS + parsed transactions), DexScreener |

---

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing — hero, live leaderboard preview, feature grid |
| `/dashboard` | Ecosystem KPIs, top tokens, ecosystem volume chart, live BagsFeed snippet |
| `/leaderboard` | Top 50 tokens by market cap, with searchable filter |
| `/feed` | Full BagsFeed — buys, sells, fees, launches, graduations, milestones |
| `/portfolio` | Wallet holdings via Helius DAS — Bags vs other SPL tokens |
| `/baskets` | Group baskets (mine + public) |
| `/baskets/$id` | Basket detail — holdings, members, add tokens |
| `/router` | PulseRouter marketplace — register your app, claim fees, fee-split visualizer |
| `/pricing` | Starter (free), Pro (0.2 SOL), Elite (0.5 SOL), paid in SOL / USDC / USDT |
| `/docs` | SDK, MCP, and API docs |
| `/auth` | Sign in (wallet → Supabase session) |

### Public APIs
| Endpoint | Purpose |
|---|---|
| `/api/actions/subscribe` | Solana Action (Blink) for subscription payments |
| `/api/licenses/confirm` | Confirms strategy-license payments and mints cNFT receipts |
| `/api/mcp` | Model Context Protocol server — exposes `get_leaderboard`, `get_token`, `get_feed` to AI agents |
| `/api/public/agent/run` | Public agent run endpoint |

---

## PulseRouter — fee-split protocol

PulseRouter wraps the Bags fee program at the launch layer:

```text
Token launch fees (per Bags fee program)
                │
                ▼
┌────────────────────────────────┐
│   PulseRouter SDK split        │
│                                │
│   Creator …………… 80%  (8000 BPS)│
│   Partner app ……… 15%  (1500 BPS)│
│   BagsPulse treasury  5%  (500 BPS)│
└────────────────────────────────┘
```

- BPS sums to **10,000**.
- Creator share is configurable per app (slider in `/router` register dialog).
- Treasury is **always** `6CxhRUpZ9av3X28QxvppYycEm8SjTS5Wf5UgxBaEzhd`.
- Recorded in the `fee_splits` table (server-only Supabase admin client) for auditability.

### Two routes to fees

PulseRouter operates in two modes:

| Mode | What it splits | Status |
|---|---|---|
| **Own-tx splitting** | Subscription payments and partner-registration fees routed through BagsPulse Actions / Blinks | ✅ Active today — no Bags partner key required |
| **Bags partner-key path** | Fee splits applied directly inside Bags' on-chain fee program at launch | 🔧 Scaffolded — requires registering at [bags.fm/partners](https://bags.fm) and providing a partner key |

When a partner key is provided, the SDK auto-injects your fee wallet into `createBagsFeeShareConfig` of every token launched through your app, and fees flow on-chain forever.

---

## Group baskets

Baskets are co-owned bags backed by three Postgres tables with strict RLS:

- `baskets` (id, owner_id, name, description, is_public, …)
- `basket_members` (basket_id, user_id, role)
- `basket_tokens` (basket_id, mint, symbol, name, image, target_bps)

Access is enforced by the `is_basket_member(_basket_id, _user_id)` SECURITY DEFINER function — preventing recursive RLS while keeping non-members locked out of private baskets. Public baskets are readable by anyone via the `is_public = true` policy.

---

## Pricing

Subscriptions settle on Solana mainnet (no credit cards). Toggle between SOL, USDC, and USDT on the pricing page; conversions use a live SOL price from DexScreener.

| Tier | Price | Highlights |
|---|---|---|
| Starter | Free | Live leaderboards (top 50), public BagsFeed, real-wallet portfolio, 1 basket |
| **Pro** | **0.2 SOL / mo** | Unlimited baskets, real-time alerts, whale-watch, cost basis & tax export, Alpha Pulse signals |
| Elite | 0.5 SOL / mo | Everything in Pro + Creator CRM, custom fee dashboards, PulseRouter partner registry, webhooks + REST + MCP, AI auto-rebalance |

---

## Local development

```bash
# Install
bun install

# Run dev server
bun run dev
```

### Environment / secrets

Configured via the Lovable Cloud secrets manager (never hard-coded):

| Secret | Purpose |
|---|---|
| `BAGS_API_KEY` | Bags v2 public API authentication |
| `HELIUS_API_KEY` | Helius RPC + DAS + parsed transactions |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin client (bypasses RLS for `fee_splits` writes) |

The Solana publishable details (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are auto-injected by Lovable Cloud.

---

## Tech notes

- **No mock data.** Every figure on screen comes from a live source. If a source is down (e.g. Bags API hiccup), the UI labels itself as such instead of falling back to fixtures.
- **SSR-safe wallet adapter.** Wallet hooks are wrapped to render gracefully before the Solana adapter mounts, avoiding hydration mismatches.
- **AmbientBackground.** A lightweight, GPU-accelerated CSS animation of drifting orbs and a subtle moving grid sits behind every page — purely decorative, fully theme-aware (dark + soft-white).
- **Lottie loader.** A custom BagsPulse Lottie mark plays during heavy data fetches.

---

## Roadmap

- [ ] Bags partner-key activation for on-chain fee splitting
- [ ] Cross-basket P&L analytics (cost basis from on-chain history)
- [ ] Telegram / X notifications for whale buys & milestones
- [ ] Public MCP server for any agent to query the Bags ecosystem
- [ ] Strategy marketplace (`strategy_licenses` table + cNFT receipts)

---

## License

MIT — built with ❤ on Lovable Cloud, for the Bags ecosystem.
