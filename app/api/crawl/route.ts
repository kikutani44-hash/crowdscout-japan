import { NextResponse } from "next/server";

const VPS_WEBHOOK_URL = process.env.VPS_WEBHOOK_URL ?? "http://160.251.182.50/crawl";
const VPS_WEBHOOK_SECRET = process.env.VPS_WEBHOOK_SECRET ?? "crowdjarvis2026";

export async function POST() {
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
