
-- Premium AI strategy licenses (cNFT-backed)
CREATE TABLE public.strategy_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wallet_address TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  cnft_mint TEXT,
  cnft_asset_id TEXT,
  payment_tx TEXT NOT NULL,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  payment_token TEXT NOT NULL DEFAULT 'SOL',
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.strategy_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own licenses"
  ON public.strategy_licenses FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own licenses"
  ON public.strategy_licenses FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_strategy_licenses_wallet ON public.strategy_licenses(wallet_address);
CREATE INDEX idx_strategy_licenses_strategy ON public.strategy_licenses(strategy_id);

-- Autonomous Analyst agent proposals
CREATE TABLE public.agent_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id UUID NOT NULL REFERENCES public.baskets(id) ON DELETE CASCADE,
  proposal_type TEXT NOT NULL DEFAULT 'rebalance',
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasoning TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view basket proposals"
  ON public.agent_proposals FOR SELECT
  USING (public.is_basket_member(basket_id, auth.uid()));

CREATE POLICY "Owners decide proposals"
  ON public.agent_proposals FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.baskets b WHERE b.id = agent_proposals.basket_id AND b.owner_id = auth.uid()));

CREATE INDEX idx_agent_proposals_basket ON public.agent_proposals(basket_id);
CREATE INDEX idx_agent_proposals_status ON public.agent_proposals(status);

-- PulseRouter fee splits ledger
CREATE TABLE public.fee_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tx TEXT NOT NULL,
  source TEXT NOT NULL,
  total_lamports NUMERIC NOT NULL,
  creator_wallet TEXT,
  creator_lamports NUMERIC NOT NULL DEFAULT 0,
  platform_lamports NUMERIC NOT NULL DEFAULT 0,
  treasury_lamports NUMERIC NOT NULL DEFAULT 0,
  creator_bps INTEGER NOT NULL DEFAULT 0,
  platform_bps INTEGER NOT NULL DEFAULT 0,
  treasury_bps INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fee splits are public"
  ON public.fee_splits FOR SELECT
  USING (true);

CREATE INDEX idx_fee_splits_created ON public.fee_splits(created_at DESC);
CREATE INDEX idx_fee_splits_source ON public.fee_splits(source);
