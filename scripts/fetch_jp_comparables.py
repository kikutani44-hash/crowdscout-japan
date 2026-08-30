#!/usr/bin/env python3
"""Makuakeから「同カテゴリの実在案件」を集める。

交渉相手に送る日本市場レポートで、
「日本でやる価値がある」ことを実データで示すために使う。

    python3 scripts/fetch_jp_comparables.py プロジェクター
    python3 scripts/fetch_jp_comparables.py プロジェクター ロボット掃除機 --max 40

■ 既存の japan_cf_check との違い
  japan_cf_check : 商品名で検索し「日本未参入」を確認する
  こちら          : カテゴリ名で検索し「比較対象」を集める

■ なぜPlaywrightが要るか
  Makuakeの検索結果はJavaScriptで描画されるため、
  通常のHTTP取得ではタイトルも金額も一切取れない（実測で確認済み）。

■ 費用
  Anthropic APIは使わない。クレジット消費はゼロ。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from common import utc_now_iso  # noqa: E402

MAKUAKE_SEARCH = "https://www.makuake.com/discover/projects/?keyword={}"

# カード1枚のテキストは「タイトル / ￥金額 / 残り日数 or 終了 / 達成率%」の並び
CARD_JS = """
() => [...document.querySelectorAll('a[href*="/project/"]')]
  .map(a => ({ href: a.href, text: a.innerText }))
  .filter(x => x.text && x.text.includes('￥'))
"""


def parse_card(href: str, text: str) -> dict[str, Any] | None:
    """カードのテキストを構造化する。想定形式:
    高輝度と映像美の新境地。…｜Aetherion
    ￥308,950,100
    52日
    30895%
    """
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    if len(lines) < 2:
        return None

    title = lines[0]

    raised = None
    achievement = None
    status = None
    days = None

    for line in lines[1:]:
        if line.startswith("￥") or line.startswith("¥"):
            digits = re.sub(r"[^\d]", "", line)
            if digits:
                raised = int(digits)
        elif line.endswith("%"):
            digits = re.sub(r"[^\d]", "", line)
            if digits:
                achievement = int(digits)
        elif line == "終了":
            status = "ended"
        elif line.endswith("日"):
            status = "active"
            digits = re.sub(r"[^\d]", "", line)
            if digits:
                days = int(digits)

    if raised is None:
        return None

    return {
        "title": title,
        "url": href.split("?")[0],
        "raised_jpy": raised,
        "achievement_pct": achievement,
        "status": status,
        "days_remaining": days,
    }


def fetch_keyword(keyword: str, max_items: int) -> list[dict[str, Any]]:
    from playwright.sync_api import sync_playwright

    url = MAKUAKE_SEARCH.format(keyword)
    results: list[dict[str, Any]] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )
        # Makuakeは日本語ロケールで開く（共通の create_browser は en-US のため使わない）
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            ),
            locale="ja-JP",
            timezone_id="Asia/Tokyo",
        )
        page = context.new_page()
        try:
            print(f"[comparables] {keyword}: {url}")
            page.goto(url, wait_until="networkidle", timeout=60_000)

            # 検索結果カードが描画されるまで待つ
            try:
                page.wait_for_selector('a[href*="/project/"]', timeout=20_000)
            except Exception:
                print(f"[comparables] {keyword}: 検索結果なし")
                return []

            # 追加読み込みのためにスクロール
            for _ in range(4):
                page.mouse.wheel(0, 4000)
                time.sleep(1.0)

            cards = page.evaluate(CARD_JS)
            seen: set[str] = set()
            for card in cards:
                parsed = parse_card(card["href"], card["text"])
                if not parsed or parsed["url"] in seen:
                    continue
                seen.add(parsed["url"])
                results.append(parsed)
                if len(results) >= max_items:
                    break
        finally:
            context.close()
            browser.close()

    print(f"[comparables] {keyword}: {len(results)}件 取得")
    return results


def save(keyword: str, rows: list[dict[str, Any]]) -> int:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key or not rows:
        if not url or not key:
            print("[comparables] Supabase未設定のため保存をスキップ")
        return 0

    import requests

    payload = [
        {**row, "keyword": keyword, "site": "makuake", "fetched_at": utc_now_iso()}
        for row in rows
    ]
    res = requests.post(
        f"{url.rstrip('/')}/rest/v1/jp_comparables",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        params={"on_conflict": "keyword,url"},
        json=payload,
        timeout=60,
    )
    if not res.ok:
        print(f"[comparables] 保存失敗 {res.status_code}: {res.text[:200]}", file=sys.stderr)
        return 0
    print(f"[comparables] {keyword}: {len(payload)}件 保存")
    return len(payload)


def summarize(keyword: str, rows: list[dict[str, Any]]) -> None:
    """レポートに書ける形の要約を出す。"""
    if not rows:
        return
    amounts = sorted((r["raised_jpy"] for r in rows if r.get("raised_jpy")), reverse=True)
    if not amounts:
        return
    total = sum(amounts)
    median = amounts[len(amounts) // 2]
    over10m = len([a for a in amounts if a >= 10_000_000])

    def man(v: int) -> str:
        return f"{v/10_000:,.0f}万円"

    print()
    print(f"  ── {keyword} の日本CF実績（Makuake） ──")
    print(f"  案件数        {len(amounts)}件")
    print(f"  総応援購入額   {man(total)}")
    print(f"  最高額        {man(amounts[0])}")
    print(f"  中央値        {man(median)}")
    print(f"  1000万円超    {over10m}件")
    print(f"  上位3件:")
    for row in rows[:3]:
        if row.get("raised_jpy"):
            print(f"    {man(row['raised_jpy']):>12}  {row['title'][:44]}")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("keywords", nargs="+", help="検索するカテゴリキーワード（日本語）")
    parser.add_argument("--max", type=int, default=40, help="1キーワードあたりの最大件数")
    parser.add_argument("--no-save", action="store_true", help="Supabaseに保存しない")
    args = parser.parse_args()

    for keyword in args.keywords:
        rows = fetch_keyword(keyword, args.max)
        summarize(keyword, rows)
        if rows and not args.no_save:
            save(keyword, rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
