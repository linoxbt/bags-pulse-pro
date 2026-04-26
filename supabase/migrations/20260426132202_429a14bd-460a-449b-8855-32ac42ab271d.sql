-- 1) Partner registry: add verification fields
ALTER TABLE public.partner_registry
  ADD COLUMN IF NOT EXISTS domain_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wallet_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_token text,
  ADD COLUMN IF NOT EXISTS verification_challenge text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- New launches default to inactive until verified — owners can flip via dashboard
ALTER TABLE public.partner_registry ALTER COLUMN is_active SET DEFAULT false;

-- 2) Creator scorecards cache
CREATE TABLE IF NOT EXISTS public.creator_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_wallet text NOT NULL UNIQUE,
  display_name text,
  launches_count integer NOT NULL DEFAULT 0,
  graduated_count integer NOT NULL DEFAULT 0,
  total_market_cap numeric NOT NULL DEFAULT 0,
  total_volume_24h numeric NOT NULL DEFAULT 0,
  total_fees_lifetime numeric NOT NULL DEFAULT 0,
  total_holders integer NOT NULL DEFAULT 0,
  fee_yield_pct numeric NOT NULL DEFAULT 0,
  holder_diversity_score numeric NOT NULL DEFAULT 0,
  trading_activity_score numeric NOT NULL DEFAULT 0,
  health_score integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_scorecards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Scorecards are public" ON public.creator_scorecards;
CREATE POLICY "Scorecards are public"
  ON public.creator_scorecards FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_scorecards_health ON public.creator_scorecards (health_score DESC);

-- 3) Loosen basket_tokens / basket_members so PUBLIC baskets are readable by anyone
DROP POLICY IF EXISTS "Members view basket tokens" ON public.basket_tokens;
CREATE POLICY "View basket tokens"
  ON public.basket_tokens FOR SELECT
  USING (
    public.is_basket_member(basket_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.baskets b WHERE b.id = basket_tokens.basket_id AND b.is_public)
  );

DROP POLICY IF EXISTS "Members view membership" ON public.basket_members;
CREATE POLICY "View basket members"
  ON public.basket_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_basket_member(basket_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.baskets b WHERE b.id = basket_members.basket_id AND b.is_public)
  );

-- 4) Strategy licenses: lock down inserts to service role only (server-confirmed payments)
DROP POLICY IF EXISTS "Users insert own licenses" ON public.strategy_licenses;
-- (no INSERT policy left → only service_role can write, which is what /api/licenses/confirm uses)

-- 5) Helper: does this user (or wallet) have an active license for a strategy?
CREATE OR REPLACE FUNCTION public.has_active_license(_user_id uuid, _strategy_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.strategy_licenses
    WHERE user_id = _user_id
      AND strategy_id = _strategy_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.has_active_license_by_wallet(_wallet text, _strategy_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.strategy_licenses
    WHERE wallet_address = _wallet
      AND strategy_id = _strategy_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- 6) updated_at trigger for partner_registry (has updated_at column already)
DROP TRIGGER IF EXISTS partner_registry_set_updated_at ON public.partner_registry;
CREATE TRIGGER partner_registry_set_updated_at
  BEFORE UPDATE ON public.partner_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
