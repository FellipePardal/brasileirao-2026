-- ─── AUTH PROFILES ────────────────────────────────────────────────────────────
-- Creates a profiles table with role-based access control.
-- DO NOT modify the existing app_state table.

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'visualizador' check (role in ('admin','visualizador','fornecedor')),
  nome       text,
  email      text,
  created_at timestamptz not null default now()
);

-- Auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'visualizador')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable RLS
alter table public.profiles enable row level security;

-- Security definer function to get current user role (avoids RLS recursion)
create or replace function public.get_my_role()
returns text
language sql
security definer stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Policies
drop policy if exists "Users can view own profile or admin sees all" on public.profiles;
create policy "Users can view own profile or admin sees all"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.get_my_role() = 'admin'
  );

drop policy if exists "Admin can update any profile" on public.profiles;
create policy "Admin can update any profile"
  on public.profiles for update
  using (public.get_my_role() = 'admin');
