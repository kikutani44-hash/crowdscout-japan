#!/usr/bin/env python3
"""Check Indiegogo projects with null deadline_at in Supabase."""
import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

resp = requests.get(
    f"{SUPABASE_URL}/rest/v1/projects",
    headers=headers,
    params={
        "platform": "eq.indiegogo",
        "deadline_at": "is.null",
        "select": "title,original_url,status,deadline_at",
        "limit": "20",
    }
)
data = resp.json()
print(f"Indiegogo projects with null deadline_at: {len(data)}")
for p in data:
    print(f"  [{p['status']}] {p['title'][:50]}")
    print(f"         {p['original_url']}")
