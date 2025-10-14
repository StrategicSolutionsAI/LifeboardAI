-- Shopping list items per user
create extension if not exists pgcrypto;

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text null,
  name text not null,
  quantity text null,
  notes text null,
  is_purchased boolean not null default false,
  needed_by date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shopping_list_items enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'shopping_list_items'
      and policyname = 'shopping_list_items_select_own'
  ) then
    create policy "shopping_list_items_select_own"
      on public.shopping_list_items for select
      using (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'shopping_list_items'
      and policyname = 'shopping_list_items_insert_own'
  ) then
    create policy "shopping_list_items_insert_own"
      on public.shopping_list_items for insert
      with check (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'shopping_list_items'
      and policyname = 'shopping_list_items_update_own'
  ) then
    create policy "shopping_list_items_update_own"
      on public.shopping_list_items for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'shopping_list_items'
      and policyname = 'shopping_list_items_delete_own'
  ) then
    create policy "shopping_list_items_delete_own"
      on public.shopping_list_items for delete
      using (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

create or replace function public.set_shopping_list_items_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_shopping_list_items_updated_at on public.shopping_list_items;
create trigger set_shopping_list_items_updated_at
before update on public.shopping_list_items
for each row execute function public.set_shopping_list_items_updated_at();

create index if not exists shopping_list_items_user_id_idx
  on public.shopping_list_items (user_id);

create index if not exists shopping_list_items_user_bucket_idx
  on public.shopping_list_items (user_id, bucket);
