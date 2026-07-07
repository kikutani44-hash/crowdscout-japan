#!/usr/bin/env python3
"""
Zeczec (嘖嘖) Taiwan crowdfunding crawler.
Uses Playwright to scrape project listings from category pages.
Currency: NTD -> USD (1 USD ≈ 32 NTD)
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

import requests as _requests
from playwright.sync_api import sync_playwright

from common import (
    compute_campaign_metrics,
    normalize_project,
    save_json,
    save_to_supabase,
    utc_now_iso,
)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = "zeczec-images"


def ensure_bucket() -> bool:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return False
    r = _requests.post(
        f"{SUPABASE_URL}/storage/v1/bucket",
        headers={"Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"},
        json={"id": BUCKET, "name": BUCKET, "public": True},
    )
    return r.ok or r.status_code == 409  # 409 = already exists


def upload_image_bytes(img_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str | None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    r = _requests.put(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{filename}",
        headers={
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        data=img_bytes,
    )
    if r.ok:
        return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{filename}"
    print(f"[zeczec] storage upload failed: {r.status_code} {r.text[:100]}")
    return None

NTD_TO_USD = 1 / 32.0

CATEGORY_URLS = [
    "https://www.zeczec.com/categories?category=11&scope=active",
    "https://www.zeczec.com/categories?category=8&scope=active",
    "https://www.zeczec.com/categories?category=7&scope=active",
    "https://www.zeczec.com/categories?category=13&scope=active",
    "https://www.zeczec.com/categories?category=21&scope=active",
]


def parse_ntd(text: str) -> int:
    text = text.replace(",", "").replace("NT$", "").replace("$", "").strip()
    match = re.search(r"[\d.]+", text)
    if match:
        return int(float(match.group()) * NTD_TO_USD)
    return 0


def scrape_category_page(page, cat_url: str, captured_images: dict[str, bytes] | None = None) -> list[dict[str, Any]]:
    print(f"[zeczec] loading: {cat_url}")
    page.set_extra_http_headers({"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"})

    # ブラウザが画像をロードする際にレスポンスをインターセプト
    if captured_images is not None:
        def on_response(response):
            url = response.url
            if "assets.zeczec.com" in url and ("image_big" in url or "image_original" in url):
                try:
                    body = response.body()
                    if body:
                        captured_images[url.split("?")[0]] = body
                except Exception:
                    pass
        page.on("response", on_response)

    page.goto(cat_url, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(5000)

    # Scroll to trigger lazy loading
    for _ in range(6):
        page.mouse.wheel(0, 1200)
        page.wait_for_timeout(800)
    page.wait_for_timeout(2000)

    projects_data = page.evaluate("""
        () => {
            const results = [];
            const seen = new Set();
            const anchors = [...document.querySelectorAll('a[href*="/projects/"]')];

            for (const a of anchors) {
                const url = a.href.split('?')[0].split('#')[0];
                if (!url.includes('/projects/') || seen.has(url)) continue;

                const text = (a.innerText || '').replace(/\\s+/g, ' ').trim();
                if (!text.includes('NT$')) continue;

                // imgタグのsrcを直接取得（networkidleで待機済みなので確実に読み込まれている）
                const imgEl = a.querySelector('img');
                let img = null;
                if (imgEl) {
                    img = imgEl.src || imgEl.getAttribute('data-src') || null;
                    if (img && (img.startsWith('data:') || img.length < 20)) img = null;
                }

                const lines = (a.innerText || '').split('\\n').map(l => l.trim()).filter(Boolean);
                const title = lines[0] || '';

                seen.add(url);
                results.push({ url, text, img, title });
            }

            return results;
        }
    """)
    for d in projects_data[:5]:
        print(f"[zeczec] img url: {(d.get('img') or 'None')[:80]}")
    return projects_data


def parse_card_data(card: dict[str, Any]) -> dict[str, Any] | None:
    url = card.get("url") or ""
    text = card.get("text") or ""
    title = card.get("title") or ""
    img = card.get("img")

    if not title:
        # Try extracting from text
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        title = lines[0][:100] if lines else ""
    if not title:
        return None

    # Parse NT$ amount
    raised_usd = 0
    ntd_matches = re.findall(r"NT\$[\d,]+", text)
    for m in ntd_matches:
        amount = parse_ntd(m)
        if amount > raised_usd:
            raised_usd = amount

    # Parse % funded
    pct_match = re.search(r"([\d,]+)%", text)
    funded_pct = int(pct_match.group(1).replace(",", "")) if pct_match else 0

    # Backers
    backers = 0
    backers_match = re.search(r"([\d,]+)\s*人", text)
    if backers_match:
        backers = int(backers_match.group(1).replace(",", ""))

    # Days remaining
    days_remaining = None
    days_match = re.search(r"([\d]+)\s*天", text)
    if days_match:
        days_remaining = int(days_match.group(1))

    print(f"[zeczec] card: title={title[:30]}, raised_usd={raised_usd}, funded_pct={funded_pct}, backers={backers}")

    min_usd = 10000
    if raised_usd < min_usd and funded_pct < 100:
        print(f"[zeczec] skip (raised ${raised_usd:,}): {title[:40]}")
        return None

    status = "active" if days_remaining else "ended"
    deadline_ts = None
    if days_remaining:
        deadline_dt = datetime.now(timezone.utc) + timedelta(days=days_remaining)
        deadline_ts = int(deadline_dt.timestamp())

    metrics = compute_campaign_metrics(
        status=status,
        backers=backers,
        deadline_ts=deadline_ts,
        launched_ts=None,
    )

    return normalize_project({
        "title": title,
        "subtitle": "",
        "platform": "zeczec",
        "original_url": url,
        "image_url": img,
        "raised_usd": raised_usd,
        "goal_usd": max(int(raised_usd * 0.1), 1),
        "backers": backers,
        "category": "テクノロジー・ガジェット",
        "country": "TW",
        "status": status,
        **metrics,
        "maker_website": None,
        "created_at": utc_now_iso(),
    })


def fetch_og_image(page, project_url: str) -> str | None:
    """プロジェクトページからog:imageを取得する"""
    try:
        page.goto(project_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(4000)
        og = page.evaluate("""() => {
            const og = document.querySelector('meta[property="og:image"]');
            return og?.content || null;
        }""")
        if og:
            print(f"[zeczec] og:image found: {og[:60]}...")
        else:
            print(f"[zeczec] og:image not found for {project_url}")
        return og
    except Exception as e:
        print(f"[zeczec] og:image fetch error: {e}")
        return None


def crawl_zeczec(max_projects: int = 20) -> list[dict[str, Any]]:
    projects: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(extra_http_headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        })
        list_page = context.new_page()
        captured_images: dict[str, bytes] = {}
        use_storage = bool(SUPABASE_URL and SUPABASE_KEY and ensure_bucket())
        if use_storage:
            print("[zeczec] Supabase Storage ready — will upload images")

        for cat_url in CATEGORY_URLS:
            if len(projects) >= max_projects:
                break
            cards = scrape_category_page(list_page, cat_url, captured_images)
            print(f"[zeczec] found {len(cards)} cards, captured {len(captured_images)} images")
            for card in cards:
                if len(projects) >= max_projects:
                    break
                url = card.get("url") or ""
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                try:
                    result = parse_card_data(card)
                    if result and use_storage:
                        raw_img = result.get("image_url") or ""
                        img_key = raw_img.split("?")[0]
                        img_bytes = captured_images.get(img_key)
                        if img_bytes:
                            ext = img_key.rsplit(".", 1)[-1] if "." in img_key else "jpg"
                            fname = img_key.rsplit("/", 1)[-1]
                            ctype = f"image/{ext}" if ext in ("jpg", "jpeg", "png", "webp") else "image/jpeg"
                            public_url = upload_image_bytes(img_bytes, fname, ctype)
                            if public_url:
                                result["image_url"] = public_url
                                print(f"[zeczec] uploaded image: {fname}")
                    if result:
                        projects.append(result)
                except Exception as e:
                    print(f"[zeczec] error: {e}")

        browser.close()

    projects.sort(key=lambda p: p["raised_usd"], reverse=True)
    return projects


def main() -> int:
    parser = argparse.ArgumentParser(description="Crawl Zeczec projects")
    parser.add_argument("--max", type=int, default=20)
    parser.add_argument("--no-save", action="store_true")
    parser.add_argument("--no-supabase", action="store_true")
    parser.add_argument("--no-translate", action="store_true")
    parser.add_argument("--force-translate", action="store_true")
    args = parser.parse_args()

    projects = crawl_zeczec(max_projects=args.max)
    print(f"[zeczec] total matched: {len(projects)}")

    if not projects:
        print("[zeczec] no projects found")
        return 1

    if not args.no_save:
        if not args.no_translate:
            from translator import translate_projects

            print(f"[zeczec] translating {len(projects)} projects...")
            translate_projects(projects, force=args.force_translate)

        path = save_json(projects, "zeczec_projects.json")
        print(f"[zeczec] saved to {path}")

        if not args.no_supabase:
            saved = save_to_supabase(projects)
            if saved:
                print(f"[zeczec] upserted {saved} rows to Supabase")
            else:
                print("[zeczec] ERROR: Supabase sync failed", file=sys.stderr)
                return 1

    print(json.dumps({"count": len(projects), "top": projects[:2]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
