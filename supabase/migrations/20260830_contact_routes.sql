-- 公式サイトから見つけた「連絡窓口」を保存する
--
-- 目的:
--   Kickstarterのメッセージは Web からは送れず（支援済み案件からのみ）、
--   メールアドレスが取れても事業開発の窓口に届くとは限らない。
--   2026-08-30 に実際にオファーを届けられた経路は、公式サイトの
--   「Become a Wholesaler」フォームだった。
--   そこで窓口の種類（卸・法人・問い合わせ・サポート）を保存し、
--   優先度の高いものから提示する。
--
-- 費用: Anthropic APIも有料APIも使わない。HTTPリクエストのみ。
--
-- Supabase → SQL Editor に貼って実行してください。

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS contact_routes jsonb,
  ADD COLUMN IF NOT EXISTS contact_routes_checked_at timestamptz;
