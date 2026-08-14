-- AI生成結果のキャッシュテーブル
-- 同じ案件・同じ条件で2度目のAI生成を走らせないようにして
-- Anthropicクレジットの無駄消費を防ぐ。
--
-- Supabase → SQL Editor に貼って実行してください。

create table if not exists ai_cache (
  id uuid primary key default gen_random_uuid(),
  -- 生成種別: offer_first | offer_second | ks_message | market_analysis | sns_dm | japan_page
  kind text not null,
  -- 対象案件（projects.id）。案件に紐づかない生成の場合は null
  project_id uuid,
  -- 同じ kind でも条件違いを区別するためのキー（言語・プラットフォーム・備考のハッシュ等）
  variant text not null default '',
  -- 生成結果（JSON）
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_ai_cache_key
  on ai_cache (kind, project_id, variant);

create index if not exists idx_ai_cache_project
  on ai_cache (project_id);
