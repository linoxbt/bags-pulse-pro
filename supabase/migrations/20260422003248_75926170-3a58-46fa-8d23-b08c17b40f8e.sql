
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  wallet_address TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Watchlists
CREATE TABLE public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  symbol TEXT,
  name TEXT,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mint)
);
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own watchlist" ON public.watchlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own watchlist" ON public.watchlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own watchlist" ON public.watchlists FOR DELETE USING (auth.uid() = user_id);

-- Baskets
CREATE TABLE public.baskets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.baskets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.basket_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id UUID NOT NULL REFERENCES public.baskets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (basket_id, user_id)
);
ALTER TABLE public.basket_members ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_basket_member(_basket_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.basket_members
    WHERE basket_id = _basket_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.baskets WHERE id = _basket_id AND owner_id = _user_id
  );
$$;

CREATE POLICY "Owners and members view baskets" ON public.baskets FOR SELECT
  USING (owner_id = auth.uid() OR is_public OR public.is_basket_member(id, auth.uid()));
CREATE POLICY "Users create own baskets" ON public.baskets FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update baskets" ON public.baskets FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owners delete baskets" ON public.baskets FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Members view membership" ON public.basket_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_basket_member(basket_id, auth.uid()));
CREATE POLICY "Owners manage members" ON public.basket_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.baskets b WHERE b.id = basket_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.baskets b WHERE b.id = basket_id AND b.owner_id = auth.uid()));

CREATE TABLE public.basket_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id UUID NOT NULL REFERENCES public.baskets(id) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  symbol TEXT,
  name TEXT,
  image TEXT,
  target_bps INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (basket_id, mint)
);
ALTER TABLE public.basket_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view basket tokens" ON public.basket_tokens FOR SELECT
  USING (public.is_basket_member(basket_id, auth.uid()));
CREATE POLICY "Owners modify basket tokens" ON public.basket_tokens FOR ALL
  USING (EXISTS (SELECT 1 FROM public.baskets b WHERE b.id = basket_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.baskets b WHERE b.id = basket_id AND b.owner_id = auth.uid()));

-- Partner Registry (BagsRouter)
CREATE TABLE public.partner_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL UNIQUE,
  app_name TEXT NOT NULL,
  fee_wallet TEXT NOT NULL,
  bps INTEGER NOT NULL CHECK (bps >= 0 AND bps <= 5000),
  description TEXT,
  website TEXT,
  total_tokens_launched INTEGER NOT NULL DEFAULT 0,
  total_fees_earned NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active partners are public" ON public.partner_registry FOR SELECT USING (is_active = true OR user_id = auth.uid());
CREATE POLICY "Users register own partner" ON public.partner_registry FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own partner" ON public.partner_registry FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete own partner" ON public.partner_registry FOR DELETE USING (user_id = auth.uid());

-- Fee Claims history
CREATE TABLE public.fee_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  mint TEXT NOT NULL,
  symbol TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  tx_signature TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fee_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own claims" ON public.fee_claims FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own claims" ON public.fee_claims FOR INSERT WITH CHECK (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_baskets_updated BEFORE UPDATE ON public.baskets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_partner_updated BEFORE UPDATE ON public.partner_registry FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX idx_watchlists_user ON public.watchlists(user_id);
CREATE INDEX idx_basket_members_user ON public.basket_members(user_id);
CREATE INDEX idx_basket_tokens_basket ON public.basket_tokens(basket_id);
CREATE INDEX idx_partner_active ON public.partner_registry(is_active) WHERE is_active = true;
CREATE INDEX idx_fee_claims_user ON public.fee_claims(user_id);
