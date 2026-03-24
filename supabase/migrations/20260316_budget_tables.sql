-- Budget tracking tables: categories, monthly budgets, expenses
create extension if not exists pgcrypto;

-- ── budget_categories ──────────────────────────────────────────────────

create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  icon text not null default 'Circle',
  color text not null default '#6366f1',
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.budget_categories enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_categories'
      and policyname = 'budget_categories_select_own'
  ) then
    create policy "budget_categories_select_own"
      on public.budget_categories for select
      using (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_categories'
      and policyname = 'budget_categories_insert_own'
  ) then
    create policy "budget_categories_insert_own"
      on public.budget_categories for insert
      with check (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_categories'
      and policyname = 'budget_categories_update_own'
  ) then
    create policy "budget_categories_update_own"
      on public.budget_categories for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_categories'
      and policyname = 'budget_categories_delete_own'
  ) then
    create policy "budget_categories_delete_own"
      on public.budget_categories for delete
      using (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

create index if not exists budget_categories_user_id_idx
  on public.budget_categories (user_id);

-- ── monthly_budgets ────────────────────────────────────────────────────

create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.budget_categories (id) on delete cascade,
  month date not null,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

alter table public.monthly_budgets enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'monthly_budgets'
      and policyname = 'monthly_budgets_select_own'
  ) then
    create policy "monthly_budgets_select_own"
      on public.monthly_budgets for select
      using (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'monthly_budgets'
      and policyname = 'monthly_budgets_insert_own'
  ) then
    create policy "monthly_budgets_insert_own"
      on public.monthly_budgets for insert
      with check (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'monthly_budgets'
      and policyname = 'monthly_budgets_update_own'
  ) then
    create policy "monthly_budgets_update_own"
      on public.monthly_budgets for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'monthly_budgets'
      and policyname = 'monthly_budgets_delete_own'
  ) then
    create policy "monthly_budgets_delete_own"
      on public.monthly_budgets for delete
      using (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

create or replace function public.set_monthly_budgets_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_monthly_budgets_updated_at on public.monthly_budgets;
create trigger set_monthly_budgets_updated_at
before update on public.monthly_budgets
for each row execute function public.set_monthly_budgets_updated_at();

create index if not exists monthly_budgets_user_id_idx
  on public.monthly_budgets (user_id);

create index if not exists monthly_budgets_user_month_idx
  on public.monthly_budgets (user_id, month);

-- ── budget_expenses ────────────────────────────────────────────────────

create table if not exists public.budget_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.budget_categories (id) on delete cascade,
  amount numeric(12,2) not null,
  date date not null default current_date,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.budget_expenses enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_expenses'
      and policyname = 'budget_expenses_select_own'
  ) then
    create policy "budget_expenses_select_own"
      on public.budget_expenses for select
      using (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_expenses'
      and policyname = 'budget_expenses_insert_own'
  ) then
    create policy "budget_expenses_insert_own"
      on public.budget_expenses for insert
      with check (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_expenses'
      and policyname = 'budget_expenses_update_own'
  ) then
    create policy "budget_expenses_update_own"
      on public.budget_expenses for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_expenses'
      and policyname = 'budget_expenses_delete_own'
  ) then
    create policy "budget_expenses_delete_own"
      on public.budget_expenses for delete
      using (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

create or replace function public.set_budget_expenses_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_budget_expenses_updated_at on public.budget_expenses;
create trigger set_budget_expenses_updated_at
before update on public.budget_expenses
for each row execute function public.set_budget_expenses_updated_at();

create index if not exists budget_expenses_user_id_idx
  on public.budget_expenses (user_id);

create index if not exists budget_expenses_user_date_idx
  on public.budget_expenses (user_id, date);

create index if not exists budget_expenses_user_category_idx
  on public.budget_expenses (user_id, category_id);
