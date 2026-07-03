import { NextRequest, NextResponse } from "next/server";
import { isGmailConfigured, searchAllOfferThreads } from "@/lib/gmail-client";
import { fetchProjects } from "@/lib/supabase";

export async function GET(_req: NextRequest) {
  if (!isGmailConfigured()) {
    return NextResponse.json({ configured: false, threads: [] });
  }

  try {
    const projects = await fetchProjects();
    const sentProjects = projects.filter((p) => p.offer_sent_at && p.maker_email);
    const emails = sentProjects.map((p) => p.maker_email!).filter(Boolean);

    const threads = await searchAllOfferThreads(emails);

    return NextResponse.json({ configured: true, threads });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
