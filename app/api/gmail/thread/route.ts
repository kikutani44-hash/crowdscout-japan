import { NextRequest, NextResponse } from "next/server";
import { isGmailConfigured, searchThreadsForEmail } from "@/lib/gmail-client";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  if (!isGmailConfigured()) return NextResponse.json({ configured: false, thread: null });

  try {
    const thread = await searchThreadsForEmail(email);
    return NextResponse.json({ configured: true, thread });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
