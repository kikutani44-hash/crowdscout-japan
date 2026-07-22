-- offer_status に「ウォッチ中」を追加
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_offer_status_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_offer_status_check
  CHECK (offer_status IN ('未接触', 'ウォッチ中', '交渉中', '獲得済み', '却下'));
