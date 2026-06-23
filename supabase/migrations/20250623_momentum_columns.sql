-- Add momentum columns for live campaign prioritization
alter table projects add column if not exists deadline_at timestamptz;
alter table projects add column if not exists launched_at timestamptz;
alter table projects add column if not exists days_remaining integer;
alter table projects add column if not exists backers_per_day numeric(10, 2) not null default 0;

create index if not exists idx_projects_status_momentum
  on projects (status, days_remaining, backers_per_day desc);
