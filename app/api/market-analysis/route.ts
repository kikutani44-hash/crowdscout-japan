import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { findLocalProject } from "@/lib/project-store";
import { getAiCache, setAiCache, type AiCacheKey } from "@/lib/ai-cache";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

type MarketAnalysisPayload = Record<string, unknown>;

const PSE_CATEGORIES = ["electronics", "電子機器", "gadget", "tech", "smart", "device", "charging", "battery", "light", "led"];
const GITEKI_CATEGORIES = ["wireless", "bluetooth", "wifi", "radio", "drone", "speaker", "headphone"];

function estimatePse(category: string, title: string): { required: boolean; note: string } {
  const text = `${category} ${title}`.toLowerCase();
  const required = PSE_CATEGORIES.some((k) => text.includes(k));
  return {
    required,
    note: required
      ? "PSE認証が必要な可能性があります（電気用品安全法）。輸入前に認証取得が必要です。"
      : "PSE認証不要の可能性が高いですが、製品詳細を確認してください。",
  };
}

function estimateGiteki(category: string, title: string): { required: boolean; note: string } {
  const text = `${category} ${title}`.toLowerCase();
  const required = GITEKI_CATEGORIES.some((k) => text.includes(k));
  return {
    required,
    note: required
      ? "技適マーク（技術基準適合証明）が必要です。無線機器の日本国内使用に必須です。"
      : "技適認証不要の可能性が高いですが、Bluetooth/WiFi搭載の場合は要確認。",
  };
}

export async function POST(request: Request) {
  try {
    const { projectId, regenerate = false } = await request.json();
    if (!projectId) return NextResponse.json({ error: "projectId が必要です" }, { status: 400 });

    // 分析済みなら再生成しない（Anthropicクレジット節約）
    const cacheKey: AiCacheKey = { kind: "market_analysis", projectId };
    if (!regenerate) {
      const cached = await getAiCache<MarketAnalysisPayload>(cacheKey);
      if (cached) return NextResponse.json({ ...cached, cached: true });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let project: any = await findLocalProject(projectId);
    if (isSupabaseConfigured()) {
      const supabase = createServerSupabase();
      const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (data) project = data;
    }
    if (!project) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });

    const title = project.title_ja ?? project.title;
    const category = project.category ?? "";
    const raisedUsd = project.raised_usd;
    const backers = project.backers;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        analysis: {
          targetAudience: "【デモ】30〜50代の健康意識の高い都市部ユーザー",
          priceRange: "【デモ】日本想定価格: ¥15,000〜¥25,000（市場相場から算出）",
          competitors: "【デモ】類似製品の国内販売実績を調査中",
          regulatoryRisk: "APIキー未設定のためデモ表示です",
          timing: "【デモ】Makuakeでのローンチ推奨時期: Q4（10〜12月）",
          verdict: "【デモ】高ポテンシャル",
        },
        pse: estimatePse(category, title),
        giteki: estimateGiteki(category, title),
      });
    }

    const [analysisRes] = await Promise.all([
      client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `あなたは日本市場の専門アナリストです。以下のクラウドファンディング製品について日本市場分析を行ってください。

製品名: ${title}
カテゴリ: ${category}
調達金額: $${raisedUsd.toLocaleString()}
支援者数: ${backers.toLocaleString()}人

以下のJSONを返してください（説明文不要）:
{
  "targetAudience": "具体的なターゲット層（年齢・性別・ライフスタイル）",
  "priceRange": "日本での想定販売価格帯（円）と根拠",
  "competitors": "日本での類似競合製品・サービス（2〜3例）",
  "regulatoryRisk": "輸入・販売における規制リスク（PSE/技適以外）",
  "timing": "Makuakeローンチの推奨時期・理由",
  "verdict": "総合評価（高ポテンシャル/中ポテンシャル/要検討）と一言理由"
}`,
        }],
      }),
    ]);

    const content = analysisRes.content[0].type === "text" ? analysisRes.content[0].text : "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { verdict: "分析失敗", targetAudience: content };

    const payload = {
      analysis,
      pse: estimatePse(category, title),
      giteki: estimateGiteki(category, title),
    };
    await setAiCache(cacheKey, payload);

    return NextResponse.json({ ...payload, cached: false });
  } catch (error) {
    const { parseAnthropicError } = await import("@/lib/api-error");
    return NextResponse.json({ error: parseAnthropicError(error) }, { status: 500 });
  }
}
