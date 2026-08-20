# CLAUDE.md — CrowdJARVIS 開発ガイド

このファイルは Claude Code が本リポジトリで作業する際の指針です。
**詳細な開発経緯・過去の問題と解決策は [PROJECT_HISTORY.md](PROJECT_HISTORY.md) を参照してください。**

---

## プロジェクト概要

**CrowdJARVIS**（リポジトリ名 `crowdscout-japan`）は、海外クラウドファンディング
（Kickstarter / Indiegogo / Wadiz / Zeczec）の案件を自動収集し、
**日本市場での独占販売権取得の交渉を支援する**Webアプリです。

- 運営: ブリンクジャパン株式会社（21期目）
- 本番: https://crowdjarvis.netlify.app
- GitHub: https://github.com/kikutani44-hash/crowdscout-japan

---

## 現在の開発状況

> 最終更新: 2026-08-20

### フェーズ
**機能開発はほぼ完了。次は実際のオファー送信（交渉）フェーズ。**

案件収集・翻訳・スコアリング・パイプライン管理・オファー文面生成・
連絡先取得・返信アラートまで一通り実装済みです。

### 直近で完了した作業（2026-08-09〜10）
- 1通目・2通目オファーメールの全面刷新（新着/サクセス自動判定、差別化チェックリスト）
- Gmail返信アラートベル
- メールアドレス取得: Kickstarterページ → 公式サイト直接抽出 → Hunter.io フォールバック
- KSメッセージタブ（メール不明でもクリエイターへ直接アプローチ・日本語訳併記）
- 新着ポテンシャルスコア・バッジ・フィルター

### 現在取り組み中
- **Anthropicクレジットの無駄消費の排除** — 実装完了（2026-08-14）
  - AI生成結果のキャッシュ層 `lib/ai-cache.ts` を追加
  - オファーメール / KSメッセージ / 市場分析 / SNS DM / 日本向けページをキャッシュ
  - 翻訳済み案件はClaude APIを呼ばない（`/api/translate`, `/api/translate/batch`）
  - CFチェックは判定済みなら再取得しない
  - `supabase/migrations/20260814_ai_cache.sql` は実行済み（2026-08-20）
- **Kickstarterクロールの停止を修正**（2026-08-20）
  - 8日間 magic/archive が5時間で打ち切られ全件破棄されていた
  - 詳細は PROJECT_HISTORY.md の「主要な問題と解決方法」10番
- **毎日のクレジット消費レポート**: `npm run credit-report`

### 次にやるべきこと
1. Anthropicクレジットのチャージ（現在残高ゼロ）
2. 実際のオファー送信を開始する
3. メールアドレス取得率の実測
4. 日本で発売済み商品の傾向分析（カテゴリ・金額帯・プラットフォーム）

### 主な未解決課題
PROJECT_HISTORY.md の[未解決・持ち越し課題](PROJECT_HISTORY.md#未解決持ち越し課題)を参照。
特に Zeczec の自動クロール未設定、VPS（ConoHa）の未使用課金、
`/api/crawl/route.ts` のVPS webhookデッドコードの整理。

---

## 技術構成

| 層 | 使用技術 |
|---|---|
| Frontend | Next.js 14 (App Router) / Tailwind / shadcn/ui / Recharts |
| Hosting | Netlify（Free プラン、**関数タイムアウト26秒**） |
| DB | Supabase (PostgreSQL) |
| 画像 | Supabase Storage |
| クロール | Python + Playwright、**GitHub Actions で毎日自動実行** |
| AI | Anthropic Claude API（翻訳=Haiku / 重要文面=Sonnet） |
| メール | SendGrid（送信）/ Gmail API（返信監視） |
| 連絡先 | Google Custom Search API + Hunter.io |
| 通知 | Chatwork API |

### ディレクトリ

```
app/           ページ & API Routes
components/    UIコンポーネント
lib/           Supabase, Claude, メール, スコアリング
scripts/       Python クロールスクリプト
supabase/      DBスキーマ
.github/workflows/  自動クロール定義
```

### 自動クロール（JST）

| 時刻 | 対象 |
|---|---|
| 03:00 | Kickstarter（magic順 + 新着順 + アーカイブ） |
| 04:00 | Indiegogo（tech/health系 + design系 + アーカイブ） |
| 05:00 | Wadiz（通常 + アーカイブ） |
| 05:00 | 日本CF突き合わせ |
| 手動 | Zeczec（台湾）、再翻訳 |

---

## 開発ルール（必ず守ること）

### 1. Anthropicクレジットを無駄に使わない ★最重要
- **翻訳・AI生成の結果は必ずSupabaseに保存し、2回目以降はスキップする**
- 既に翻訳済み・取得済みのデータに対して再度APIを呼ばない
- 大量処理（翻訳・CFチェック）は **Haiku**、オファーメール等の重要文面のみ **Sonnet**
- Kickstarter / Indiegogo 案件の翻訳先言語は **英語固定**（台湾語・韓国語は該当プラットフォームのみ）
- メール取得は全件一括ではなく、**オファーする案件だけ個別ボタンで実行**
- `--force-translate` のような全件再実行フラグは使わない
- 参考: クロール自体はAnthropic APIを使わないため**費用ゼロ**

### 2. オファー文面のルール
- KSメッセージ本文に**URLを書かない**（スパムフィルター回避）
- CTAは「メールアドレスを教えてください」ではなく「**こちらのメールアドレスをお知らせします**」
- 「全面サポート」等の表現は使わない（代理店ではなく**独占権を取得して自社主導で販売**する立場）
- Makuake / CAMPFIRE は「取引実績」ではなく「**直接の関係**」と表現を抑える
- 差別化質問は「グループや提携先の実績ではなく、**御社として**」を明示
- 新着案件には祝辞を出さない（自動判定で出し分ける）

### 3. 実装上の注意
- **重いAI生成処理は Netlify Background Function + Supabase ポーリング**にする
  （直接呼ぶと26秒でタイムアウトする）
- クロールの upsert で `offer_status` などの**手動管理フィールドを上書きしない**
- ワークフローファイル（`.github/workflows/`）を変更するpushには
  `workflow` スコープ付きのGitHub PATが必要

### 4. コミュニケーション
- オーナー（菊谷 / KIKUTANI）は**プログラミング非専門**。
  ターミナル操作は**1コマンドずつ、どこで実行するか含めて具体的に**指示する
- Macのターミナルは「アプリケーション → ユーティリティ」から開く
- 「自動モード」設定中は確認を挟まず作業を進めてよい
- コミットメッセージは日本語（`feat:` / `fix:` / `perf:` / `refactor:` プレフィックス）

### 5. セキュリティ
- **APIキー・パスワードをコードやドキュメントに直書きしない**
  （過去にNetlifyのsecret検出でビルドが落ちた事例あり）
- 認証情報は `.env.local` / Netlify環境変数 / GitHub Secrets に置く
- Anthropic APIキーは他プロジェクト（AI-tools-crawler / PROJECT-US）と**共用**。
  再発行時は全プロジェクトの環境変数を更新する

---

## よく使うコマンド

```bash
npm run dev              # 開発サーバー
npm run build            # ビルド
npm run lint             # Lint
npm run crawl            # 全プラットフォームをクロール
npm run cf-check         # 日本CF突き合わせ
npm run sync:supabase    # Supabaseへ同期
```
