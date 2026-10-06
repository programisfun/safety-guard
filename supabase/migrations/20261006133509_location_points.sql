create table public.location_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  altitude double precision,
  speed double precision,
  heading double precision,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.location_points enable row level security;

create policy "Users insert own location points"
  on public.location_points for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users read own location points"
  on public.location_points for select to authenticated
  using (auth.uid() = user_id);
