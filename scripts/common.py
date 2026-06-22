"""
Shared utilities for CrowdScout Japan crawlers.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
ENV_PATH = ROOT_DIR / ".env.local"

load_dotenv(ENV_PATH)

MIN_RAISED_USD = int(os.environ.get("CRAWL_MIN_RAISED_USD", "50000"))
MAX_DAYS_SINCE_END = int(os.environ.get("CRAWL_MAX_DAYS_SINCE_END", "180"))
USD_RATES: dict[str, float] = {
    "USD": 1.0,
    "US$": 1.0,
    "$": 1.0,
    "EUR": 1.08,
    "€": 1.08,
    "GBP": 1.27,
    "£": 1.27,
    "JPY": 0.0067,
    "¥": 0.0067,
    "HKD": 0.13,
    "HK$": 0.13,
    "CAD": 0.74,
    "AUD": 0.65,
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_data_dir() -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return DATA_DIR


def parse_money_to_usd(text: str) -> int:
    """Parse strings like 'HK$3,691,101' or '$842,000' into USD integer."""
    if not text:
        return 0
    cleaned = text.strip().replace("\xa0", " ")
    currency = "USD"
    for key in sorted(USD_RATES.keys(), key=len, reverse=True):
        if key in cleaned:
            currency = key
            cleaned = cleaned.replace(key, "")
            break
    digits = re.sub(r"[^\d.]", "", cleaned)
    if not digits:
        return 0
    amount = float(digits)
    rate = USD_RATES.get(currency, 1.0)
    return int(round(amount * rate))


def calculate_score(project: dict[str, Any]) -> int:
    score = 0
    raised = int(project.get("raised_usd") or 0)
    goal = int(project.get("goal_usd") or 0)
    backers = int(project.get("backers") or 0)
    category = str(project.get("category") or "")
    japan_unentered = bool((project.get("japan_cf_result") or {}).get("isJapanUnentered"))

    if raised >= 500_000:
        score += 30
    elif raised >= 100_000:
        score += 20
    elif raised >= 50_000:
        score += 10

    rate = (raised / goal * 100) if goal > 0 else 0
    if rate >= 500:
        score += 25
    elif rate >= 200:
        score += 20
    elif rate >= 100:
        score += 10

    if backers >= 10_000:
        score += 20
    elif backers >= 5_000:
        score += 15
    elif backers >= 1_000:
        score += 8

    if japan_unentered:
        score += 15

    popular = ("ガジェット", "Gadget", "Technology", "DIY", "Health", "ヘルス", "Phone")
    if any(p.lower() in category.lower() for p in popular):
        score += 10
    else:
        score += 5

    return min(score, 100)


def normalize_project(raw: dict[str, Any]) -> dict[str, Any]:
    now = utc_now_iso()
    project = {
        "title": raw["title"],
        "title_ja": raw.get("title_ja"),
        "subtitle": raw.get("subtitle"),
        "subtitle_ja": raw.get("subtitle_ja"),
        "platform": raw["platform"],
        "original_url": raw["original_url"],
        "image_url": raw.get("image_url"),
        "raised_usd": int(raw.get("raised_usd") or 0),
        "goal_usd": int(raw.get("goal_usd") or 0),
        "backers": int(raw.get("backers") or 0),
        "category": raw.get("category") or "Other",
        "country": raw.get("country"),
        "status": raw.get("status") or "ended",
        "score": 0,
        "offer_status": raw.get("offer_status") or "未接触",
        "japan_cf_checked": bool(raw.get("japan_cf_checked", False)),
        "japan_cf_result": raw.get("japan_cf_result"),
        "pse_ok": bool(raw.get("pse_ok", False)),
        "giteki_ok": bool(raw.get("giteki_ok", False)),
        "maker_email": raw.get("maker_email"),
        "maker_website": raw.get("maker_website"),
        "created_at": raw.get("created_at") or now,
        "updated_at": now,
    }
    project["score"] = calculate_score(project)
    return project


def save_json(projects: list[dict[str, Any]], filename: str) -> Path:
    ensure_data_dir()
    path = DATA_DIR / filename
    payload = {
        "fetched_at": utc_now_iso(),
        "count": len(projects),
        "projects": projects,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def save_to_supabase(projects: list[dict[str, Any]]) -> int:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return 0

    try:
        import requests
    except ImportError:
        return 0

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    saved = 0
    for project in projects:
        row = {**project, "updated_at": utc_now_iso()}
        # Upsert by original_url
        resp = requests.get(
            f"{url.rstrip('/')}/rest/v1/projects",
            headers=headers,
            params={"original_url": f"eq.{project['original_url']}", "select": "id"},
            timeout=30,
        )
        existing = resp.json() if resp.ok else []
        if existing:
            project_id = existing[0]["id"]
            patch = requests.patch(
                f"{url.rstrip('/')}/rest/v1/projects",
                headers=headers,
                params={"id": f"eq.{project_id}"},
                json=row,
                timeout=30,
            )
            if patch.ok:
                saved += 1
        else:
            post = requests.post(
                f"{url.rstrip('/')}/rest/v1/projects",
                headers=headers,
                json=row,
                timeout=30,
            )
            if post.ok:
                saved += 1
    return saved


def create_browser(playwright, headless: bool = True):
    browser = playwright.chromium.launch(
        headless=headless,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
        ],
    )
    context = browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        ),
        locale="en-US",
        timezone_id="America/New_York",
        viewport={"width": 1366, "height": 768},
    )
    context.add_init_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
    )
    return browser, context


def fetch_json_page(page, url: str) -> Optional[Any]:
    response = page.goto(url, wait_until="domcontentloaded", timeout=90000)
    if not response or response.status >= 400:
        return None
    body = page.locator("body").inner_text().strip()
    if not body:
        return None
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        pre = page.locator("pre")
        if pre.count():
            return json.loads(pre.first.inner_text())
        return None
