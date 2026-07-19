-- Maker SNS / contact columns and offer tracking columns
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS maker_contact_form text,
  ADD COLUMN IF NOT EXISTS maker_instagram text,
  ADD COLUMN IF NOT EXISTS maker_twitter text,
  ADD COLUMN IF NOT EXISTS maker_facebook text,
  ADD COLUMN IF NOT EXISTS maker_linkedin text,
  ADD COLUMN IF NOT EXISTS offer_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_note text;
