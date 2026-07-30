"""
guest_activity_logs テーブルをSupabaseに作成するセットアップスクリプト。
Supabase Management API (Personal Access Token) を使用。
"""
import os
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
    sys.exit(1)

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

# テーブルが存在するか確認
check = requests.get(
    f"{SUPABASE_URL}/rest/v1/guest_activity_logs?limit=1",
    headers=headers,
    timeout=30,
)

if check.ok:
    print("[setup] guest_activity_logs テーブルは既に存在します")
    sys.exit(0)

if "PGRST205" not in check.text and "does not exist" not in check.text:
    print(f"[setup] 予期しないエラー: {check.status_code} {check.text[:200]}")
    sys.exit(1)

# Management API でテーブル作成
project_ref = SUPABASE_URL.replace("https://", "").split(".")[0]
pat = os.environ.get("SUPABASE_ACCESS_TOKEN", "")

if not pat:
    print("[setup] SUPABASE_ACCESS_TOKEN が未設定のため、SQLを手動で実行してください:")
    print("""
CREATE TABLE IF NOT EXISTS guest_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id text NOT NULL,
  action text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  project_title text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gal_guest ON guest_activity_logs (guest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gal_created ON guest_activity_logs (created_at DESC);
""")
    sys.exit(0)

sql = """
CREATE TABLE IF NOT EXISTS guest_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id text NOT NULL,
  action text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  project_title text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gal_guest ON guest_activity_logs (guest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gal_created ON guest_activity_logs (created_at DESC);
"""

resp = requests.post(
    f"https://api.supabase.com/v1/projects/{project_ref}/database/query",
    headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json"},
    json={"query": sql},
    timeout=30,
)

if resp.ok:
    print("[setup] guest_activity_logs テーブルを作成しました")
else:
    print(f"[setup] テーブル作成失敗: {resp.status_code} {resp.text[:300]}")
    sys.exit(1)
