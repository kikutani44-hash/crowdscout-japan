import { NextResponse } from "next/server";
import { fetchProjects } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projects = await fetchProjects({
      search: searchParams.get("search") ?? undefined,
      platform: searchParams.get("platform") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      offerStatus: searchParams.get("offerStatus") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      japanUnenteredOnly: searchParams.get("japanUnenteredOnly") === "true",
    });
    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ project: body, message: "手動登録（Supabase接続後に有効化）" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "登録に失敗しました" },
      { status: 500 }
    );
  }
}
