import { NextRequest, NextResponse } from "next/server";
import { isGmailConfigured, searchAllOfferThreads } from "@/lib/gmail-client";
import { fetchProjects } from "@/lib/supabase";
import { buildWatchTargets } from "@/lib/offer-watch";
import { sendChatworkNotification, formatReplyAlertMessage } from "@/lib/chatwork";

export async function GET(_req: NextRequest) {
  if (!isGmailConfigured()) {
    return NextResponse.json({ configured: false, threads: [] });
  }

  try {
    const projects = await fetchProjects();

    // メールアドレスが分かっていない案件は公式サイトのドメインで監視する。
    // フォーム送信では返信元アドレスを事前に知る方法がないため。
    const watchTargets = buildWatchTargets(projects);
    const threads = await searchAllOfferThreads(watchTargets.map((t) => t.target));

    // 返信があった案件をChatworkに通知
    if (process.env.CHATWORK_WEBHOOK_URL) {
      const replied = threads.filter((t) => t.hasReply);
      for (const thread of replied.slice(0, 3)) {
        const watched = watchTargets.find(
          (t) => t.target.toLowerCase() === thread.makerEmail.toLowerCase()
        );
        if (watched) {
          const msg = formatReplyAlertMessage(watched.title, thread.makerEmail);
          await sendChatworkNotification(msg);
        }
      }
    }

    return NextResponse.json({ configured: true, threads, watching: watchTargets });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
