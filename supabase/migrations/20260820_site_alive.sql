-- メーカー公式サイトの生存チェック結果を保存する
--
-- 過去案件へオファーをかける運用では、会社が畳まれていたり
-- サイトが消えているケースがある。事前に判別して空振りを減らす。
--
-- Supabase → SQL Editor に貼って実行してください。

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS site_alive boolean,           -- true=生存 / false=到達不可 / null=未チェック
  ADD COLUMN IF NOT EXISTS site_status_code integer,     -- HTTPステータス（取得できた場合）
  ADD COLUMN IF NOT EXISTS site_checked_at timestamptz;  -- 最終チェック日時

CREATE INDEX IF NOT EXISTS idx_projects_site_alive ON projects (site_alive);
