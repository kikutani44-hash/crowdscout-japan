# CrowdScout Japan

海外クラウドファンディング（Kickstarter / Indiegogo）の成功案件を発掘し、日本未参入かどうかを判定、メーカーへのオファーを効率化する Web アプリケーション。

## 技術スタック

- **Frontend**: Next.js 14, Tailwind CSS, shadcn/ui, Recharts
- **Backend**: Next.js API Routes
- **DB**: Supabase (PostgreSQL)
- **AI**: Claude API（翻訳）
- **Mail**: SendGrid
- **Crawl**: Python + Playwright

## セットアップ

```bash
cd crowdscout-japan
npm install
cp .env.local.example .env.local
# .env.local に API キーを設定
npm run dev
```

http://localhost:3000 で起動します。

Supabase 未設定時は `data/projects_merged.json`（クロール結果）またはサンプルデータで動作します。

## ディレクトリ構成

```
app/           # ページ & API Routes
components/    # UI コンポーネント
lib/           # Supabase, Claude, メール, スコアリング
scripts/       # Python クロールスクリプト
supabase/      # DB スキーマ
```

## 開発フェーズ

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | プロジェクト初期設定・UIベース | ✅ 完了 |
| 2 | サンプルデータでカードUI・API動作 | ✅ 完了 |
| 3 | Python クロール・実データ取得 | ✅ 完了 |
| 4 | 日本CF自動チェック・スコアリング | ✅ 完了 |
| 5 | SendGrid・ダッシュボード | ✅ 完了 |
| 6 | Vercel デプロイ | ✅ 完了 |

## Supabase セットアップ

1. [supabase.com](https://supabase.com) でプロジェクト作成
2. SQL Editor で `supabase/schema.sql` を実行
3. `.env.local` に URL / キーを設定

## Python クロール（Phase 3）

```bash
cd scripts
pip install -r requirements.txt
python3 -m playwright install chromium

# 両方実行して data/projects_merged.json に統合
python3 run_crawl.py --ks-pages 15 --igg-max 15

# 個別実行
python3 crawl_kickstarter.py --pages 10
python3 crawl_indiegogo.py --max 15
```

または npm から:

```bash
npm run crawl
```

### フィルタ条件

- **Kickstarter**: 成功案件、`$50,000` 以上、終了から180日以内
- **Indiegogo**: Explore から案件 URL を収集し、各ページから調達額・支援者数を取得

Supabase 設定時は `original_url` をキーに自動 upsert されます。

## 日本CFチェック（Phase 4）

Makuake / GREEN FUNDING / CAMPFIRE の検索結果を Playwright で確認します。

```bash
# 単一商品チェック
python3 scripts/check_japan_cf.py "商品名" --json-only

# 登録済み案件を一括チェック（projects_merged.json を更新）
python3 scripts/batch_check_japan_cf.py
python3 scripts/batch_check_japan_cf.py --limit 5 --force
```

Web UI の「🇯🇵 CF確認」ボタン、または `POST /api/cf-check` からも実行できます。
一括実行: `POST /api/cf-check/batch`

### 判定ロジック

- 3サイトすべて未掲載 → **🇯🇵 日本未参入**（+15点）
- 1サイトのみ掲載 → +5点
- チェック結果は `data/projects_merged.json` に保存

## SendGrid オファーメール（Phase 5）

`.env.local` に SendGrid API キーを設定:

```bash
SENDGRID_API_KEY=SG.xxxx
FROM_EMAIL=kikuya@blinkjapan.co.jp
FROM_NAME=Blink Japan Co., Ltd.
```

- Web UI の **「オファー」** ボタンから英文レターを送信
- 送信前に **プレビュー** 確認可能
- 送信成功後、オファー状況は自動で **交渉中** に更新
- API キー未設定時はデモモード（ログ出力のみ）

### ダッシュボード (`/dashboard`)

- 案件サマリー（未接触 / 交渉中 / 獲得済み / 却下）
- 総調達額・日本未参入数・平均スコア
- オファー状況（円グラフ）
- プラットフォーム別 / カテゴリ別 / 調達額 Top 8 チャート
- 🇯🇵 優先オファー候補リスト
- 最近追加された案件

## Vercel デプロイ（Phase 6）

### GitHub リポジトリ

https://github.com/kikutani44-hash/crowdscout-japan

`main` ブランチへの push で Vercel が自動デプロイします（GitHub 連携設定後）。

### Vercel × GitHub 連携手順

1. [Vercel Import](https://vercel.com/new/import?s=https%3A%2F%2Fgithub.com%2Fkikutani44-hash%2Fcrowdscout-japan&project-name=crowdscout-japan&framework=nextjs) を開く
2. GitHub アカウント連携 → リポジトリ `crowdscout-japan` を選択
3. Framework: **Next.js**（自動検出）、Root Directory: **`.`**
4. Environment Variables を設定（下表参照）
5. **Deploy** をクリック

### 環境変数（Vercel Dashboard → Settings → Environment Variables）

| 変数 | 必須 | 説明 |
|------|------|------|
| `ANTHROPIC_API_KEY` | 任意 | Claude 翻訳 |
| `NEXT_PUBLIC_SUPABASE_URL` | 推奨 | DB（本番データ永続化） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 推奨 | DB |
| `SUPABASE_SERVICE_ROLE_KEY` | 推奨 | サーバー側 DB 操作 |
| `SENDGRID_API_KEY` | 任意 | オファーメール送信 |
| `FROM_EMAIL` | 任意 | 送信元 |
| `FROM_NAME` | 任意 | 送信者名 |

### 3. 本番環境の制限

- **Python クロール / 日本CFチェック** は Vercel 上では動作しません（ローカル実行 → Supabase 同期）
- Supabase 未設定時は `data/projects_merged.json` のスナップショットを表示（読み取り専用）
- リージョン: 東京 (`hnd1`) — `vercel.json` で設定済み

---

ブリンクジャパン株式会社 | CrowdScout Japan 仕様書 v1.0
