import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  const payload = token ? verifyAuthToken(token) : null;
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    return NextResponse.json({ error: "GITHUB_PAT not configured" }, { status: 500 });
  }

  const res = await fetch(
    `https://api.github.com/repos/kikutani44-hash/crowdscout-japan/actions/workflows/crawl-zeczec.yml/dispatches`,
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
