import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  const payload = token ? verifyAuthToken(token) : null;
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pat = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO;
  if (!pat || !repo) {
    return NextResponse.json({ error: "GITHUB_PAT or GITHUB_REPO not configured" }, { status: 500 });
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/crawl-zeczec.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { max_projects: "20" } }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}
