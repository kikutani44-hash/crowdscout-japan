#!/usr/bin/env python3
"""Fix null deadline_at for Indiegogo projects by re-scraping with Playwright."""
import os
import requests
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
from crawl_indiegogo import scrape_project_page
from common import create_browser

load_dotenv(dotenv_path="../.env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

def get_null_deadline_projects():
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/projects",
        headers=headers,
        params={
            "platform": "eq.indiegogo",
            "deadline_at": "is.null",
            "status": "eq.active",
            "select": "id,title,original_url",
            "limit": "20",
        }
    )
    return resp.json()

def update_deadline(project_id: str, deadline_at: str, days_remaining):
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/projects",
        headers=headers,
        params={"id": f"eq.{project_id}"},
        json={"deadline_at": deadline_at, "days_remaining": days_remaining},
    )
    return resp.status_code < 300

def main():
    projects = get_null_deadline_projects()
    print(f"Found {len(projects)} active Indiegogo projects with null deadline_at")

    with sync_playwright() as playwright:
        browser, context = create_browser(playwright)
        page = context.new_page()

        for p in projects:
            url = p["original_url"]
            title = p["title"][:40]
            print(f"\n[fix] scraping: {title}")
            try:
                result = scrape_project_page(page, url)
                if result and result.get("deadline_at"):
                    ok = update_deadline(p["id"], result["deadline_at"], result.get("days_remaining"))
                    if ok:
                        print(f"[fix] ✅ updated: {result['deadline_at']}")
                    else:
                        print(f"[fix] ❌ update failed")
                else:
                    # InDemand or no deadline: set 1 year from now as placeholder
                    placeholder = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
                    ok = update_deadline(p["id"], placeholder, None)
                    if ok:
                        print(f"[fix] ✅ set placeholder deadline: {placeholder[:10]}")
                    else:
                        print(f"[fix] ❌ update failed")
            except Exception as e:
                print(f"[fix] error: {e}")

        browser.close()

if __name__ == "__main__":
    main()
