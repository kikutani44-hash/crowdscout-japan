import { NextResponse } from "next/server";
import { generateJapanMarketReport } from "@/lib/claude";
import { buildMarketReportHtml, buildMarketReportText } from "@/lib/market-report";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { findLocalProject } from "@/lib/project-store";

export async function POST(request: Request) {
  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId が必要です" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let project: any = await findLocalProject(projectId);
    if (isSupabaseConfigured()) {
      const supabase = createServerSupabase();
      const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (data) project = data;
    }
    if (!project) {
      return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
    }

    const reportData = await generateJapanMarketReport(
      project.title_ja ?? project.title,
      project.subtitle_ja ?? project.subtitle ?? "",
      project.category ?? "",
      project.raised_usd,
      project.backers,
      project.platform,
    );

    const html = buildMarketReportHtml({
      productTitle: project.title_ja ?? project.title,
      productUrl: project.original_url,
      raisedUsd: project.raised_usd,
      backers: project.backers,
      platform: project.platform,
      reportData,
    });

    const text = buildMarketReportText({
      productTitle: project.title_ja ?? project.title,
      productUrl: project.original_url,
      raisedUsd: project.raised_usd,
      backers: project.backers,
      platform: project.platform,
      reportData,
    });

    return NextResponse.json({ reportData, html, text });
  } catch (error) {
    const { parseAnthropicError } = await import("@/lib/api-error");
    return NextResponse.json({ error: parseAnthropicError(error) }, { status: 500 });
  }
}
