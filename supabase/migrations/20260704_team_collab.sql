-- チームコラボ機能のカラム追加
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS assignee text,
  ADD COLUMN IF NOT EXISTS negotiation_status text DEFAULT '未接触',
  ADD COLUMN IF NOT EXISTS memo text,
  ADD COLUMN IF NOT EXISTS followup_at timestamptz;

-- negotiation_statusのインデックス（フィルター用）
CREATE INDEX IF NOT EXISTS idx_projects_negotiation_status ON projects(negotiation_status);
CREATE INDEX IF NOT EXISTS idx_projects_assignee ON projects(assignee);
CREATE INDEX IF NOT EXISTS idx_projects_followup_at ON projects(followup_at);
