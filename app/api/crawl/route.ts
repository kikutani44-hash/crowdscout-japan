import { NextResponse } from "next/server";
import { runKickstarterCrawl } from "@/lib/kickstarter-crawl";

export async function POST() {
  try {
    const count = await runKickstarterCrawl();
    return NextResponse.json({ success: true, count });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "クロールに失敗しました" },
      { status: 500 }
    );
  }
}
