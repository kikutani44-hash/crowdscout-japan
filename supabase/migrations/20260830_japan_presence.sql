-- 日本参入チェック（自動）の結果を保存する
--
-- 目的:
--   既存の japan_cf_check は Makuake 等「日本のクラウドファンディング」に
--   出ているかしか見ていないため、自社EC・Amazon.co.jp・楽天での
--   正規流通を検出できない。2026-08-30 にウォッチ4件を手作業で調べたところ
--   3件が既に日本で販売されており、この見落としが空振りの主因だった。
--
--   このテーブル列は、ブランド名から
--     ・日本向けドメイン（brandjapan.com / jp.brand.com / brand.jp）
--     ・Amazon.co.jp / 楽天市場の商品名一致
--     ・公式サイトの日本語・JPY表記
--   を自動で調べた結果を保存する。
--
-- 費用: Anthropic APIも有料検索APIも使わない。HTTPリクエストのみ。
--
-- Supabase → SQL Editor に貼って実行してください。

ALTER TABLE projects
  -- 判定サマリ: 'entered'（販売の形跡あり） / 'clear'（形跡なし） / 'unknown'（判定できず）
  ADD COLUMN IF NOT EXISTS japan_presence_verdict text,
  -- 0〜100。高いほど「既に日本で売られている」確信度が高い
  ADD COLUMN IF NOT EXISTS japan_presence_score integer,
  -- 根拠の明細（見つかったドメイン・商品名・URL など）
  ADD COLUMN IF NOT EXISTS japan_presence_result jsonb,
  ADD COLUMN IF NOT EXISTS japan_presence_checked_at timestamptz;

-- 「形跡なし」だけを絞り込む用途が多いため部分インデックスを張る
CREATE INDEX IF NOT EXISTS idx_projects_japan_presence
  ON projects (japan_presence_verdict)
  WHERE japan_presence_verdict IS NOT NULL;
