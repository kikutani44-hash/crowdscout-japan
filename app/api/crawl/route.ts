import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { token?: string };
  const payload = body.token ? verifyAuthToken(body.token) : null;
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const VPS_WEBHOOK_URL = process.env.VPS_WEBHOOK_URL;
  const VPS_WEBHOOK_SECRET = process.env.VPS_WEBHOOK_SECRET;

  if (!VPS_WEBHOOK_URL || !VPS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "VPS_WEBHOOK_URL / VPS_WEBHOOK_SECRET が設定されていません" }, { status: 500 });
  }

  try {
    const res = await fetch(VPS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: VPS_WEBHOOK_SECRET }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`VPS応答エラー: ${res.status}`);
    }

    return NextResponse.json({ success: true, message: "クロールを開始しました（VPS処理中）" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "クロールに失敗しました";
    return NextResponse.json(
      { error: `データ更新に失敗しました: ${msg}` },
      { status: 500 }
    );
  }
}
