import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gmail-client";

export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ error: "Google OAuth not configured" }, { status: 500 });
  }
}
