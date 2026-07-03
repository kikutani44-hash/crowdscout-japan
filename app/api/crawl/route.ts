import { NextResponse } from "next/server";
import { runKickstarterCrawl } from "@/lib/kickstarter-crawl";
import { sendChatworkNotification, formatCrawlCompleteMessage } from "@/lib/chatwork";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";

export async function POST() {
  try {
    const count = await runKickstarterCrawl();

    // クロール完了をChatworkに通知
    if (process.env.CHATWORK_WEBHOOK_URL) {
      let total = count;
      if (isSupabaseConfigured()) {
        const supabase = createServerSupabase();
        const { count: totalCount } = await supabase
          .from("projects")
          .select("*", { count: "exact", head: true });
        total = totalCount ?? count;
      }
      const msg = formatCrawlCompleteMessage(total, count);
      if (msg) await sendChatworkNotification(msg);
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "クロールに失敗しました" },
      { status: 500 }
    );
  }
}
