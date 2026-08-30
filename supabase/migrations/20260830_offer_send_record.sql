-- オファー送信の記録を残す
--
-- 目的:
--   Kickstarterのメッセージが送れず、メールアドレスも取れないため、
--   実際の送信は公式サイトの問い合わせフォーム／卸申込フォームから手作業で行っている。
--   その結果「いつ・どこに・何を送ったか」がツールに残らず、
--   ステータスを「交渉中」に変えるだけになっていた。
--   2通目を書く際に1通目の文面が必要になるため、送った本文ごと保存する。
--
-- Supabase → SQL Editor に貼って実行してください。

ALTER TABLE projects
  -- 送信に使った窓口のURL（例: .../pages/become-a-wholesaler）
  ADD COLUMN IF NOT EXISTS offer_sent_via text,
  -- 実際に送った本文。2通目で矛盾しないようにするため保存する
  ADD COLUMN IF NOT EXISTS offer_sent_text text;
