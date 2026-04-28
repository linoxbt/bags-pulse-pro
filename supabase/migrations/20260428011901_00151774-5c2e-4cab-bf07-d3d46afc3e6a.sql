
-- Public bucket for token logos uploaded from /launch
insert into storage.buckets (id, name, public)
values ('token-images', 'token-images', true)
on conflict (id) do nothing;

-- Anyone can read token images (they must be public for external indexers)
create policy "Token images are publicly readable"
on storage.objects for select
using (bucket_id = 'token-images');

-- Authenticated users can upload into their own user-id folder
create policy "Users can upload their own token images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'token-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can replace their own uploads (e.g. re-upload)
create policy "Users can update their own token images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'token-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- User-scoped watchlist for the swap token picker favorites
create table if not exists public.swap_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mint text not null,
  symbol text,
  name text,
  logo_uri text,
  decimals int,
  created_at timestamptz not null default now(),
  unique (user_id, mint)
);

alter table public.swap_favorites enable row level security;

create policy "Users view own swap favorites"
on public.swap_favorites for select
using (auth.uid() = user_id);

create policy "Users insert own swap favorites"
on public.swap_favorites for insert
with check (auth.uid() = user_id);

create policy "Users delete own swap favorites"
on public.swap_favorites for delete
using (auth.uid() = user_id);
