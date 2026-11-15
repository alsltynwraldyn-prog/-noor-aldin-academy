-- ORVEXAL production schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.plans (
  id text primary key,
  name_ar text not null,
  billing_period text not null check (billing_period in ('monthly','yearly')),
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null default 'JOD',
  active boolean not null default false,
  features jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.plans enable row level security;
create policy "plans_public_read_active" on public.plans for select using (active = true);

insert into public.plans (id,name_ar,billing_period,amount_minor,currency,active,features)
values
('vip_monthly','VIP شهري','monthly',0,'JOD',false,'["دورات متقدمة","مؤشرات وأدوات إضافية","اختبارات تطبيقية"]'),
('vip_yearly','VIP سنوي','yearly',0,'JOD',false,'["جميع مزايا VIP","مسار سنوي","مواد تعليمية إضافية"]')
on conflict (id) do nothing;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  amount_minor integer not null,
  currency text not null default 'JOD',
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','refunded')),
  provider text not null default 'paytabs',
  provider_reference text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.orders enable row level security;
create policy "orders_select_own" on public.orders for select using (auth.uid() = user_id);
-- No client-side INSERT/UPDATE policies: order creation and payment confirmation are server-only.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null default 'pending' check (status in ('pending','active','past_due','cancelled','expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  provider text not null default 'paytabs',
  provider_reference text,
  order_id uuid unique references public.orders(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "subscriptions_select_own" on public.subscriptions for select using (auth.uid() = user_id);

create index if not exists orders_user_created_idx on public.orders(user_id,created_at desc);
create index if not exists subscriptions_user_status_idx on public.subscriptions(user_id,status);
