import { NextRequest, NextResponse } from "next/server";
import { isGmailConfigured, searchAllOfferThreads } from "@/lib/gmail-client";
import { fetchProjects } from "@/lib/supabase";
import { sendChatworkNotification, formatReplyAlertMessage } from "@/lib/chatwork";

export async function GET(_req: NextRequest) {
  if (!isGmailConfigured()) {
    return NextResponse.json({ configured: false, threads: [] });
  }

  try {
    const projects = await fetchProjects();
    const sentProjects = projects.filter((p) => p.offer_sent_at && p.maker_email);
    const emails = sentProjects.map((p) => p.maker_email!).filter(Boolean);

    const threads = await searchAllOfferThreads(emails);

    // 返信があった案件をChatworkに通知
    if (process.env.CHATWORK_WEBHOOK_URL) {
      const replied = threads.filter((t) => t.hasReply);
      for (const thread of replied.slice(0, 3)) {
        const project = sentProjects.find((p) => p.maker_email === thread.makerEmail);
        if (project) {
          const msg = formatReplyAlertMessage(
            project.title_ja ?? project.title,
            thread.makerEmail
          );
          await sendChatworkNotification(msg);
        }
      }
    }

    return NextResponse.json({ configured: true, threads });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
