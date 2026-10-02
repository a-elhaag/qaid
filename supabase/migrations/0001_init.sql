create extension if not exists pgcrypto;

create table offices (id uuid primary key default gen_random_uuid(), name text not null);

create table clients (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references offices on delete cascade,
  name text not null,
  name_en text not null,
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  image_path text,
  image_hash text,
  batch_id uuid,
  status text not null default 'received' check (status in ('received','extracting','needs_review','confirmed','failed')),
  error text,
  created_at timestamptz not null default now()
);
create index on documents (client_id, created_at);
create index on documents (image_hash);

create table entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  document_id uuid references documents on delete set null,
  vendor text not null default '',
  entry_date date not null,
  subtotal numeric(14,2) not null default 0,
  vat numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  category text not null default 'other' check (category in ('rent','supplies','sales','salaries','utilities','other')),
  category_confidence numeric(3,2),
  question text,
  agreement jsonb not null default '{}',
  confidence text not null default 'high',
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);
create index on entries (client_id, entry_date);

create table expected_docs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  vendor text not null,
  label text not null
);

create table flags (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  entry_id uuid references entries on delete cascade,
  kind text not null,
  detail text not null,
  open boolean not null default true,
  created_at timestamptz not null default now()
);

create table employees (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  name text not null,
  monthly_wage numeric(12,2) not null
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued','running','retry','done','dead')),
  attempts int not null default 0,
  error text,
  run_at timestamptz not null default now(),
  started_at timestamptz,
  created_at timestamptz not null default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references offices on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create or replace function claim_job() returns jobs language plpgsql as $$
declare j jobs;
begin
  select * into j from jobs
   where (status in ('queued','retry') and run_at <= now())
      or (status = 'running' and started_at < now() - interval '2 minutes')
   order by run_at limit 1 for update skip locked;
  if not found then return null; end if;
  update jobs set status = 'running', attempts = attempts + 1, started_at = now() where id = j.id returning * into j;
  return j;
end $$;

create table office_members (
  user_id uuid not null references auth.users on delete cascade,
  office_id uuid not null references offices on delete cascade,
  primary key (user_id, office_id)
);

create or replace function my_office_ids() returns setof uuid
language sql security definer stable set search_path = public as $$
  select office_id from office_members where user_id = auth.uid()
$$;

-- Reads run under the signed-in user's JWT (needed so Realtime only streams their own rows).
-- Writes go through server code with the service key after an ownership check.
alter publication supabase_realtime add table documents, entries, flags;
alter table offices enable row level security;
alter table office_members enable row level security;
alter table clients enable row level security;
alter table documents enable row level security;
alter table entries enable row level security;
alter table flags enable row level security;
create policy own_member on office_members for select using (user_id = auth.uid());
create policy own_office on offices for select using (id in (select my_office_ids()));
create policy own_clients on clients for select using (office_id in (select my_office_ids()));
create policy own_documents on documents for select using (client_id in (select id from clients where office_id in (select my_office_ids())));
create policy own_entries on entries for select using (client_id in (select id from clients where office_id in (select my_office_ids())));
create policy own_flags on flags for select using (client_id in (select id from clients where office_id in (select my_office_ids())));

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict do nothing;
