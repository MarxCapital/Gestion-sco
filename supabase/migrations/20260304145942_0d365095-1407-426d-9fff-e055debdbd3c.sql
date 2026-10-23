
-- Create app_role enum
create type public.app_role as enum ('admin', 'center', 'csbante');

-- Create profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  identifier text unique not null,
  display_name text,
  must_change_password boolean default true,
  created_at timestamptz default now()
);

-- Create user_roles table
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);

-- Create candidates table
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  center_id uuid references public.profiles(id) on delete cascade not null,
  numero_table text,
  nom text not null,
  prenoms text,
  sexe text check (sexe in ('M', 'F')),
  ecole_provenance text,
  is_absent boolean default false,
  created_at timestamptz default now()
);

-- Create notes table
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete cascade not null unique,
  dictee numeric(4,2),
  expression_ecrite numeric(4,2),
  lecture numeric(4,2),
  es numeric(4,2),
  est numeric(4,2),
  mathematique numeric(4,2),
  ea_dessin numeric(4,2),
  ea_poesie numeric(4,2),
  eps numeric(4,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.candidates enable row level security;
alter table public.notes enable row level security;

-- Security definer function for role check
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Profiles RLS
create policy "Users can view own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'csbante'));
create policy "Admin can insert profiles" on public.profiles for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Users can update own profile" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admin can delete profiles" on public.profiles for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- User roles RLS
create policy "Users can view own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admin can insert roles" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

-- Candidates RLS
create policy "Admin can do all on candidates" on public.candidates for all to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "Centers can view own candidates" on public.candidates for select to authenticated
  using (center_id = auth.uid());
create policy "Centers can update own candidates" on public.candidates for update to authenticated
  using (center_id = auth.uid());
create policy "Csbante can view all candidates" on public.candidates for select to authenticated
  using (public.has_role(auth.uid(), 'csbante'));

-- Notes RLS
create policy "Admin can do all on notes" on public.notes for all to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "Centers can manage own notes" on public.notes for all to authenticated
  using (exists (select 1 from public.candidates c where c.id = candidate_id and c.center_id = auth.uid()));
create policy "Csbante can view all notes" on public.notes for select to authenticated
  using (public.has_role(auth.uid(), 'csbante'));
