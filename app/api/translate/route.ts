import { NextResponse } from "next/server";
import { translateToJapanese } from "@/lib/claude";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { projectId, title, subtitle } = body as {
    projectId?: string;
    title?: string;
    subtitle?: string;
  };

  if (!title) {
    return NextResponse.json({ error: "title が必要です" }, { status: 400 });
  }

  try {
    const { title_ja, subtitle_ja } = await translateToJapanese(
      title,
      subtitle ?? ""
    );
    return NextResponse.json({
      project: {
        id: projectId,
        title_ja,
        subtitle_ja,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "翻訳に失敗しました" },
      { status: 500 }
    );
  }
}
