#!/usr/bin/env python3
"""CrowdJARVIS が直近24時間で使ったAnthropicクレジットの概算レポート。

毎朝の定点チェック用:

    npm run credit-report

金額は「実測のトークン数 × 公式単価」で積み上げた概算です。
Anthropicコンソールの請求額と完全一致はしませんが、
「どのアプリがどれだけ使っているか」を比較するには十分な精度です。

正確な請求額（全プロジェクト合計）はコンソールで確認:
    https://console.anthropic.com/settings/usage
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import sys
import urllib.error
import socket
import urllib.parse
import urllib.request
from pathlib import Path

# 応答が返らない場合に長時間ぶら下がらないようにする
socket.setdefaulttimeout(10)
NET_TIMEOUT = 10

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.local"

# 公式単価（USD / 100万トークン）
PRICING = {
    "haiku": {"in": 1.0, "out": 5.0},    # claude-haiku-4-5  … 翻訳
    "sonnet": {"in": 3.0, "out": 15.0},  # claude-sonnet-4-6 … 文面生成
}

# 1トークンあたりの文字数の目安（実測テキスト長からトークン数を推定するため）
CHARS_PER_TOKEN_EN = 4.0   # 英数字
CHARS_PER_TOKEN_JA = 1.6   # 日本語

# 翻訳プロンプト自体のトークン数（lib/claude.ts の固定文言ぶん）
TRANSLATE_PROMPT_OVERHEAD = 60

# AI生成1件あたりのSonnet消費量（プロンプト＋出力の実測に基づく概算）
# kind -> (入力トークン, 出力トークン)
AI_GEN_COST = {
    "offer_first": (1800, 2600),      # 変数生成 + 日本語訳 + 現地語訳
    "offer_second": (1800, 2600),
    "ks_message": (900, 1400),        # 生成 + 日本語訳
    "market_analysis": (400, 900),
    "sns_dm": (350, 400),
    "japan_page": (450, 1500),
}
MARKET_REPORT_COST = (700, 2800)  # 市場レポート1件あたり


def load_env() -> dict[str, str]:
    env = dict(os.environ)
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env.setdefault(key, value.strip().strip('"').strip("'"))
    return env


def est_tokens(text: str | None) -> int:
    """テキストのトークン数を文字種から推定する。"""
    if not text:
        return 0
    ja = sum(1 for ch in text if "぀" <= ch <= "ヿ" or "一" <= ch <= "龯")
    other = len(text) - ja
    return round(ja / CHARS_PER_TOKEN_JA + other / CHARS_PER_TOKEN_EN)


def usd(tokens_in: int, tokens_out: int, model: str) -> float:
    rate = PRICING[model]
    return tokens_in / 1_000_000 * rate["in"] + tokens_out / 1_000_000 * rate["out"]


class Supabase:
    def __init__(self, env: dict[str, str]) -> None:
        self.base = env.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
        self.key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get(
            "NEXT_PUBLIC_SUPABASE_ANON_KEY", ""
        )
        self.ok = bool(self.base and self.key)
        self.failures: list[str] = []

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {"apikey": self.key, "Authorization": f"Bearer {self.key}"}
        headers.update(extra or {})
        return headers

    def rows(self, query: str) -> list[dict]:
        if not self.ok:
            return []
        try:
            req = urllib.request.Request(
                f"{self.base}/rest/v1/{query}", headers=self._headers()
            )
            with urllib.request.urlopen(req, timeout=NET_TIMEOUT) as res:
                return json.loads(res.read().decode())
        except Exception as exc:
            self.failures.append(f"{query.split('?')[0]}: {exc}")
            return []

    def count(self, query: str) -> int:
        if not self.ok:
            return -1
        try:
            req = urllib.request.Request(
                f"{self.base}/rest/v1/{query}",
                headers=self._headers({"Prefer": "count=exact", "Range": "0-0"}),
            )
            with urllib.request.urlopen(req, timeout=NET_TIMEOUT) as res:
                return int(res.headers.get("Content-Range", "0/0").split("/")[-1])
        except Exception as exc:
            self.failures.append(f"{query.split('?')[0]}: {exc}")
            return -1


def translation_cost(db: Supabase, since: str) -> tuple[int, float, dict[str, int]]:
    """新規案件の翻訳コストを実際のテキスト長から積み上げる。"""
    rows = db.rows(
        "projects?select=platform,title,subtitle,title_ja,subtitle_ja"
        f"&created_at=gte.{urllib.parse.quote(since)}&limit=5000"
    )
    tokens_in = tokens_out = 0
    by_platform: dict[str, int] = {}
    for row in rows:
        by_platform[row.get("platform") or "?"] = by_platform.get(row.get("platform") or "?", 0) + 1
        tokens_in += TRANSLATE_PROMPT_OVERHEAD + est_tokens(row.get("title")) + est_tokens(row.get("subtitle"))
        tokens_out += est_tokens(row.get("title_ja")) + est_tokens(row.get("subtitle_ja"))
    return len(rows), usd(tokens_in, tokens_out, "haiku"), by_platform


def generation_cost(db: Supabase, since: str) -> tuple[dict[str, int], float]:
    """オファーメール等のAI生成コスト。ai_cache の新規行＝実際に生成した回数。"""
    rows = db.rows(
        f"ai_cache?select=kind&created_at=gte.{urllib.parse.quote(since)}&limit=2000"
    )
    counts: dict[str, int] = {}
    total = 0.0
    for row in rows:
        kind = row.get("kind") or "?"
        counts[kind] = counts.get(kind, 0) + 1
        t_in, t_out = AI_GEN_COST.get(kind, (500, 800))
        total += usd(t_in, t_out, "sonnet")

    reports = db.count(f"reports?select=project_id&created_at=gte.{urllib.parse.quote(since)}")
    if reports > 0:
        counts["market_report"] = reports
        total += reports * usd(*MARKET_REPORT_COST, "sonnet")
    return counts, total


def crawl_runs(hours: int) -> list[str]:
    try:
        proc = subprocess.run(
            ["gh", "run", "list", "--limit", "15", "--json", "name,conclusion,status,createdAt"],
            cwd=ROOT, capture_output=True, text=True, timeout=NET_TIMEOUT,
        )
        if proc.returncode != 0:
            return []
        cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=hours)
        lines = []
        for run in json.loads(proc.stdout):
            when = dt.datetime.fromisoformat(run["createdAt"].replace("Z", "+00:00"))
            if when < cutoff:
                continue
            label = {"success": "OK", "cancelled": "打ち切り", "failure": "失敗"}.get(
                run["conclusion"] or run["status"], run["conclusion"] or run["status"]
            )
            lines.append(f"  {when.astimezone():%m/%d %H:%M}  {label:<8} {run['name']}")
        return lines
    except Exception:
        return []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hours", type=int, default=24, help="対象時間（デフォルト24）")
    args = parser.parse_args()

    env = load_env()
    db = Supabase(env)
    now = dt.datetime.now(dt.timezone.utc)
    since_dt = now - dt.timedelta(hours=args.hours)
    since = since_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    print("=" * 64)
    print(f"  CrowdJARVIS  Anthropicクレジット {args.hours}時間レポート")
    print(f"  {since_dt.astimezone():%m/%d %H:%M} 〜 {now.astimezone():%m/%d %H:%M}")
    print("=" * 64)

    if not db.ok:
        print("\n  Supabaseに接続できません（.env.local を確認してください）")
        return 1

    print("\n  集計中...", end="", flush=True)
    new_projects, tr_cost, by_platform = translation_cost(db, since)
    gen_counts, gen_cost = generation_cost(db, since)
    total = tr_cost + gen_cost
    print("\r" + " " * 20 + "\r", end="")

    if db.failures:
        print("\n  ⚠ データ取得に失敗した項目があります。下の金額は過少表示です:")
        for msg in db.failures:
            print(f"    - {msg}")

    print(f"\n■ このアプリの消費額（概算）:  ${total:.2f}"
          + ("  ← 不完全" if db.failures else ""))
    print(f"  ├ 翻訳（Haiku）    ${tr_cost:.2f}   新規案件 {new_projects} 件")
    if by_platform:
        print("  │   " + " / ".join(f"{k} {v}件" for k, v in sorted(by_platform.items())))
    print(f"  └ AI生成（Sonnet） ${gen_cost:.2f}   " + (
        " / ".join(f"{k} {v}回" for k, v in sorted(gen_counts.items())) if gen_counts else "生成なし"
    ))

    cached = db.count("ai_cache?select=id")
    print("\n■ キャッシュ節約:")
    if cached < 0:
        print("  ai_cache テーブルが未作成です（migrations/20260814_ai_cache.sql を実行）")
    else:
        print(f"  保存済みのAI生成結果 {cached} 件 — 再表示ではクレジットを消費しません")

    print(f"\n■ 自動クロール（{args.hours}時間）:")
    runs = crawl_runs(args.hours)
    if runs:
        for line in runs:
            print(line)
        if any("打ち切り" in r or "失敗" in r for r in runs):
            print("  ⚠ 打ち切り/失敗あり — 案件が取り切れていない可能性があります")
    else:
        print("  実行なし、または gh コマンドが未認証です")

    print("\n" + "-" * 64)
    print("  ※ 概算です。全プロジェクト合計の実額はコンソールで確認:")
    print("     https://console.anthropic.com/settings/usage")
    print("  ※ APIキーを3アプリで共用しているため、コンソールでは内訳が出ません。")
    print("=" * 64)
    return 0


if __name__ == "__main__":
    sys.exit(main())
