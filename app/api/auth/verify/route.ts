import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { findGuestPasswordById } from "@/lib/passwords";
import type { AuthRole } from "@/lib/auth-types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const payload = verifyAuthToken(token);
    if (!payload) {
      return NextResponse.json({ valid: false });
    }

    if (payload.role === "guest" && payload.guestId) {
      const guest = await findGuestPasswordById(payload.guestId);
      if (!guest) {
        return NextResponse.json({ valid: false });
      }
      return NextResponse.json({
        valid: true,
        role: payload.role as AuthRole,
        expiresAt: guest.expires_at,
      });
    }

    return NextResponse.json({
      valid: true,
      role: payload.role as AuthRole,
      expiresAt: null,
    });
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : "検証に失敗しました" },
      { status: 500 }
    );
  }
}
