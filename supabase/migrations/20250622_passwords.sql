-- Guest / admin password codes for site access
-- Run in Supabase SQL Editor

create table if not exists passwords (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('admin', 'guest')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_passwords_code on passwords (code);
create index if not exists idx_passwords_type_expires on passwords (type, expires_at);

alter table passwords enable row level security;

-- No public policies: access via service_role API routes only
