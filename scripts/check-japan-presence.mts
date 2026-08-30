/**
 * 日本参入チェックを案件にまとめてかける。
 *
 *   npm run japan-presence            -- 過去案件を新しい順に50件
 *   npm run japan-presence -- --all --limit 300
 *   npm run japan-presence -- --force  -- 判定済みも再チェック
 *
 * ■ なぜローカル実行なのか
 *   Amazon.co.jp はデータセンターのIPからのアクセスにボット検知を返しやすい。
 *   Netlify や GitHub Actions 上で走らせると Amazon 分が「未確認」になりやすいため、
 *   まとめて回すときは手元のMacから実行する。
 *
 * ■ 費用
 *   Anthropic API も有料の検索API も使わない。クレジット消費はゼロ。
 */

import { readFileSync } from "node:fs";
import { checkJapanPresence } from "../lib/japan-presence";

// .env.local を読む（Next.js を経由しないため自前で読み込む）
for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const index = trimmed.indexOf("=");
  const key = trimmed.slice(0, index);
  if (!process.env[key]) process.env[key] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
}

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const AUTH = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const value = (flag: string, fallback: number) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};

const limit = value("--limit", 50);
const force = has("--force");
const all = has("--all");

type Row = {
  id: string;
  title: string;
  maker_website: string | null;
  raised_usd: number | null;
  deadline_at: string | null;
};

async function fetchTargets(): Promise<Row[]> {
  const params = new URLSearchParams({
    select: "id,title,maker_website,raised_usd,deadline_at",
    order: "raised_usd.desc",
    limit: String(limit),
  });
  if (!force) params.set("japan_presence_checked_at", "is.null");
  if (!all) params.set("deadline_at", `lt.${new Date().toISOString()}`);

  const res = await fetch(`${BASE}/rest/v1/projects?${params}`, { headers: AUTH });
  if (!res.ok) throw new Error(`案件の取得に失敗: ${res.status} ${await res.text()}`);
  return (await res.json()) as Row[];
}

async function save(id: string, result: Awaited<ReturnType<typeof checkJapanPresence>>) {
  const res = await fetch(`${BASE}/rest/v1/projects?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...AUTH, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      japan_presence_verdict: result.verdict,
      japan_presence_score: result.score,
      japan_presence_result: result,
      japan_presence_checked_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) console.error(`  保存失敗 ${id}: ${res.status} ${await res.text()}`);
}

const rows = await fetchTargets();
console.log(`対象 ${rows.length}件（${all ? "全案件" : "過去案件"} / ${force ? "再チェック" : "未チェックのみ"}）\n`);

const tally = { entered: 0, clear: 0, unknown: 0 };

for (const [i, row] of rows.entries()) {
  const result = await checkJapanPresence(row.title, row.maker_website);
  tally[result.verdict]++;

  const mark = result.verdict === "entered" ? "🔴" : result.verdict === "clear" ? "🟢" : "⚪";
  const usd = row.raised_usd ? `$${Math.round(row.raised_usd / 1000)}k` : "-";
  console.log(`${mark} [${i + 1}/${rows.length}] ${usd.padStart(7)} ${row.title.slice(0, 46)}`);
  console.log(`   ブランド="${result.brand}" ${result.summary}`);
  for (const e of result.evidence) console.log(`     ・${e.label}`);

  await save(row.id, result);
  // 相手サイトに負荷をかけないよう間隔を空ける
  await new Promise((r) => setTimeout(r, 1200));
}

console.log(`\n── 集計 ──`);
console.log(`🔴 日本販売の形跡あり : ${tally.entered}件`);
console.log(`🟢 形跡なし（候補）   : ${tally.clear}件`);
console.log(`⚪ 判定できず         : ${tally.unknown}件`);
