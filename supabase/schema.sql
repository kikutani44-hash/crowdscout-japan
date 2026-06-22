-- CrowdScout Japan: Supabase schema
-- Run in Supabase SQL Editor

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_ja text,
  subtitle text,
  subtitle_ja text,
  platform text not null check (platform in ('kickstarter', 'indiegogo')),
  original_url text not null,
  image_url text,
  raised_usd integer not null default 0,
  goal_usd integer not null default 0,
  backers integer not null default 0,
  category text,
  country text,
  status text not null default 'ended' check (status in ('active', 'ended')),
  score integer not null default 0,
  offer_status text not null default '未接触'
    check (offer_status in ('未接触', '交渉中', '獲得済み', '却下')),
  japan_cf_checked boolean not null default false,
  japan_cf_result jsonb,
  pse_ok boolean not null default false,
  giteki_ok boolean not null default false,
  maker_email text,
  maker_website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_score on projects (score desc);
create index if not exists idx_projects_platform on projects (platform);
create index if not exists idx_projects_offer_status on projects (offer_status);
create unique index if not exists idx_projects_original_url on projects (original_url);

-- Row Level Security (service_role bypasses RLS for server-side writes)
alter table projects enable row level security;

create policy "projects_public_read"
  on projects for select
  to anon, authenticated
  using (true);

-- updated_at auto-touch on update
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_updated_at on projects;
create trigger projects_updated_at
  before update on projects
  for each row execute function set_updated_at();
