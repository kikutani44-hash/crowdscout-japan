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
| 6 | Netlify デプロイ | ✅ 完了 |

## Supabase セットアップ（アカウント作成〜本番反映）

CrowdScout Japan の案件データを Supabase（PostgreSQL）に保存し、Netlify 本番サイトから読み込む手順です。

### Step 1: Supabase アカウント作成

1. [supabase.com](https://supabase.com) を開く
2. **Start your project** → GitHub / Google / メールでサインアップ
3. ダッシュボード（[supabase.com/dashboard](https://supabase.com/dashboard)）にログイン

### Step 2: プロジェクト作成

1. **New project** をクリック
2. 設定:
   - **Name**: `crowdscout-japan`（任意）
   - **Database Password**: 強力なパスワードを設定（必ず控える）
   - **Region**: **Northeast Asia (Tokyo)** を選択（日本向け）
3. **Create new project** → 1〜2分待つ（DB プロビジョニング）

### Step 3: テーブル作成（SQL）

1. 左メニュー **SQL Editor** → **New query**
2. リポジトリの `supabase/schema.sql` の内容をすべてコピー＆ペースト
3. **Run** をクリック → `Success. No rows returned` と表示されれば OK

### Step 4: API キー取得

1. 左メニュー **Project Settings**（歯車）→ **API**
2. 以下を控える:

| 項目 | 環境変数名 |
|------|-----------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| anon public | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| service_role secret | `SUPABASE_SERVICE_ROLE_KEY` |

> **service_role** は秘密鍵です。GitHub に commit しないでください。Netlify の Environment variables にのみ設定します。

### Step 5: ローカル環境変数

```bash
cd crowdscout-japan
cp .env.local.example .env.local
```

`.env.local` を編集:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

### Step 6: クロールデータを Supabase に同期

```bash
# Python 依存（初回のみ）
pip3 install -r scripts/requirements.txt

# 既存の projects_merged.json をアップロード
npm run sync:supabase
# または
python3 scripts/sync_to_supabase.py
```

成功例:

```
[sync] 11 projects from data/projects_merged.json
[sync] OK: 11/11 projects upserted at 2026-06-22T...
```

Supabase ダッシュボード → **Table Editor** → **projects** で 11 件表示を確認。

以降、クロール実行時も自動同期されます:

```bash
python3 scripts/run_crawl.py --ks-pages 15 --igg-max 15
```

### Step 7: Netlify に環境変数を設定

1. [app.netlify.com](https://app.netlify.com) → サイト **crowdscout-japan** を開く
2. **Site configuration** → **Environment variables** → **Add a variable**
3. 以下 3 つを追加（Scopes: **All** または **Production**）:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Step 4 の Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Step 4 の anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Step 4 の service_role |

4. **Deploys** → **Trigger deploy** → **Deploy site**（環境変数反映のため再デプロイ必須）

### Step 8: 本番 URL で確認

1. Netlify の **Visit** リンク（例: `https://crowdscout-japan.netlify.app`）を開く
2. トップページに Supabase の 11 件（クロール結果）が表示される
3. オファー状況の変更・CF チェック結果も Supabase に永続化される

### トラブルシューティング

| 症状 | 対処 |
|------|------|
| 本番がサンプルデータのまま | Netlify の 3 つの Supabase 環境変数を確認 → 再デプロイ |
| `sync:supabase` が 0 rows | `.env.local` の URL / service_role を確認 |
| `upsert failed: 401` | service_role キーが誤っている |
| `upsert failed: 42P01` | `schema.sql` を SQL Editor で未実行 |
| RLS エラー | `schema.sql` の RLS ポリシー部分を再実行 |

### データ更新フロー（運用）

```
ローカル: run_crawl.py → projects_merged.json + Supabase upsert
         batch_check_japan_cf.py → 同上
Netlify:  環境変数経由で Supabase から読み書き（永続化）
```

## Python クロール（Phase 3）

```bash
cd scripts
pip install -r requirements.txt
python3 -m playwright install chromium

# 両方実行して data/projects_merged.json に統合（Claude で自動翻訳 → Supabase 同期）
python3 run_crawl.py --ks-pages 15 --igg-max 15 --replace

# 翻訳をスキップする場合
python3 run_crawl.py --ks-pages 15 --igg-max 15 --no-translate

# 既存データだけ翻訳して Supabase に反映
python3 sync_to_supabase.py --translate --replace

# 個別実行（単体でも翻訳されます）
python3 crawl_kickstarter.py --pages 10
python3 crawl_indiegogo.py --max 15
```

### 自動翻訳

`.env.local` に `ANTHROPIC_API_KEY` を設定すると、クロール完了後に Claude API で **商品名・説明を日本語翻訳** し、`title_ja` / `subtitle_ja` として Supabase に保存します。キー未設定時は `【翻訳デモ】` プレフィックス付きのフォールバックを使用します。

アプリでは `title_ja ?? title` / `subtitle_ja ?? subtitle` で **日本語を優先表示** します。

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

または npm から:

```bash
npm run crawl
```

### フィルタ条件

- **Kickstarter**: 成功案件、`$50,000` 以上、終了から180日以内
- **Indiegogo**: Explore から案件 URL を収集し、各ページから調達額・支援者数を取得

### カテゴリ（優先取得・除外）

クロールは以下のカテゴリを **優先** し、ゲーム・出版・アート系は **除外** します（`scripts/category_filters.py`）。

| 優先グループ | 例 |
|-------------|-----|
| テクノロジー・ガジェット | Technology/Hardware, Gadgets |
| ヘルスケア・フィットネス | Health, Fitness |
| アウトドア・スポーツ | Outdoor, Sports |
| キッチン・家電 | Food, Home, Kitchen |
| モビリティ・乗り物 | Transportation, Bike, Mobility |
| ライフスタイル・デザイン | Design/Product Design, Fashion |

**除外**: Games, Publishing, Art, Comics, Film & Video, Music, Theater など

- Kickstarter: Technology / Design / Food / Fashion カテゴリごとに `--pages` 分クロール
- Indiegogo: tech-and-innovation, health-and-fitness, home, product-design の Explore のみ

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

## Netlify デプロイ（Phase 6）

GitHub リポジトリと連携して [Netlify](https://www.netlify.com) にデプロイします。設定は `netlify.toml` に記載済みです。

### GitHub リポジトリ

https://github.com/kikutani44-hash/crowdscout-japan

### 初回デプロイ（ダッシュボード操作）

1. [app.netlify.com](https://app.netlify.com) にログイン
2. **Add new site** → **Import an existing project**
3. **Deploy with GitHub** を選択し、GitHub アカウントを連携（未連携の場合）
4. リポジトリ **`kikutani44-hash/crowdscout-japan`** を選択
5. ビルド設定を確認（`netlify.toml` から自動読み込み）:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
   - **Plugin**: `@netlify/plugin-nextjs`
6. **Environment variables** に必要な変数を追加（下表）
7. **Deploy crowdscout-japan** をクリック
8. 完了後、表示される **Visit** リンクが本番 URL（例: `https://crowdscout-japan.netlify.app`）

### 再デプロイ

- `main` ブランチへの push で自動デプロイ（Git 連携時）
- 手動: **Deploys** → **Trigger deploy** → **Deploy site**

### 環境変数（Site configuration → Environment variables）

| 変数 | 必須 | 説明 |
|------|------|------|
| `ANTHROPIC_API_KEY` | 任意 | Claude 翻訳 |
| `NEXT_PUBLIC_SUPABASE_URL` | 推奨 | DB（本番データ永続化） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 推奨 | DB |
| `SUPABASE_SERVICE_ROLE_KEY` | 推奨 | サーバー側 DB 操作 |
| `SENDGRID_API_KEY` | 任意 | オファーメール送信 |
| `FROM_EMAIL` | 任意 | 送信元（例: `kikuya@blinkjapan.co.jp`） |
| `FROM_NAME` | 任意 | 送信者名（例: `Blink Japan Co., Ltd.`） |

変数追加・変更後は **Deploys → Trigger deploy** で反映してください。

### 本番環境の制限

- **Python クロール / 日本CFチェック** は Netlify 上では動作しません（ローカル実行 → Supabase 同期）
- Supabase 未設定時は `data/projects_merged.json` のスナップショットを表示（読み取り専用）

---

ブリンクジャパン株式会社 | CrowdScout Japan 仕様書 v1.0
