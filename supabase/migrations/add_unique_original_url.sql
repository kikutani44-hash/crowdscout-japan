-- Run in Supabase SQL Editor if bulk upsert fails (optional optimization)
create unique index if not exists idx_projects_original_url on projects (original_url);
