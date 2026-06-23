"use client";

import { Badge } from "@/components/ui/badge";
import type { JapanCfResult } from "@/lib/types";
import { ExternalLink } from "lucide-react";

interface CFCheckResultProps {
  result: JapanCfResult | null;
}

const siteLabels = {
  makuake: "Makuake",
  greenfunding: "GREEN FUNDING",
  campfire: "CAMPFIRE",
} as const;

export function CFCheckResult({ result }: CFCheckResultProps) {
  if (!result) {
    return (
      <p className="text-sm text-muted-foreground">まだ日本CFチェックは実行されていません。</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={result.isJapanUnentered ? "success" : "warning"}>
          {result.isJapanUnentered ? "🇯🇵 日本未参入" : "🇯🇵 日本で掲載あり"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          検索語: {result.query}
          {result.checkedAt ? ` · ${new Date(result.checkedAt).toLocaleString("ja-JP")}` : ""}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Makuake / GREEN FUNDING / CAMPFIRE の検索結果に基づく判定です。
      </p>
      <ul className="space-y-2">
        {result.sites.map((site) => (
          <li
            key={site.site}
            className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span>{siteLabels[site.site]}</span>
              <div className="flex items-center gap-2">
                <Badge variant={site.found ? "warning" : "success"}>
                  {site.found ? "ヒット" : "未掲載"}
                </Badge>
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
            {site.matches && site.matches.length > 0 && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {site.matches[0]}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
