import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasSendGrid: !!process.env.SENDGRID_API_KEY,
    sendGridLength: process.env.SENDGRID_API_KEY?.length || 0,
    sendGridStart: process.env.SENDGRID_API_KEY?.substring(0, 5) || "none",
  });
}
