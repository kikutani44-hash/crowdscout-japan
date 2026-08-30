-- 日本CF（Makuake）における「同カテゴリの実在案件」を保存する
--
-- 用途: 交渉相手に送る日本市場レポートで
--       「日本でやる価値がある」ことを実データで示すため。
--
-- 既存の japan_cf_check は商品名で検索して「日本未参入」を確認するもの。
-- こちらはカテゴリのキーワードで検索して「比較対象」を集めるもので、目的が異なる。
--
-- Supabase → SQL Editor に貼って実行してください。

CREATE TABLE IF NOT EXISTS jp_comparables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 検索に使ったカテゴリキーワード（例: プロジェクター、ロボット掃除機）
  keyword text NOT NULL,
  site text NOT NULL DEFAULT 'makuake',
  title text NOT NULL,
  url text NOT NULL,
  -- 応援購入総額（円）
  raised_jpy bigint,
  -- 達成率（%）
  achievement_pct integer,
  -- 実施中か終了済みか（'active' / 'ended'）
  status text,
  -- 残り日数（実施中の場合）
  days_remaining integer,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- 同じキーワード×同じ案件は1行にまとめる（再取得時は上書き）
CREATE UNIQUE INDEX IF NOT EXISTS idx_jp_comparables_key
  ON jp_comparables (keyword, url);

CREATE INDEX IF NOT EXISTS idx_jp_comparables_keyword
  ON jp_comparables (keyword);
