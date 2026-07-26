-- statusに「archived」を追加（終了180日〜730日のお宝候補）
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'ended', 'archived'));

CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects (status, japan_cf_checked)
  WHERE status = 'archived';
