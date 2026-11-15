
create table public.active_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  session_token text not null,
  last_active_at timestamptz not null default now()
);

alter table public.active_sessions enable row level security;

create policy "Users can view own session" on public.active_sessions
  for select to authenticated using (user_id = auth.uid());

create policy "Users can insert own session" on public.active_sessions
  for insert to authenticated with check (user_id = auth.uid());

create policy "Users can update own session" on public.active_sessions
  for update to authenticated using (user_id = auth.uid());

create policy "Users can delete own session" on public.active_sessions
  for delete to authenticated using (user_id = auth.uid());

create policy "Admin can manage all sessions" on public.active_sessions
  for all to authenticated using (has_role(auth.uid(), 'admin'));
