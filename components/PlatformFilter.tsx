"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PLATFORM_FILTER_OPTIONS,
  type PlatformFilterValue,
} from "@/lib/platforms";

interface PlatformFilterProps {
  value?: PlatformFilterValue;
  counts?: Partial<Record<PlatformFilterValue, number>>;
  onChange: (platform: PlatformFilterValue) => void;
}

export function PlatformFilter({
  value = "all",
  counts = {},
  onChange,
}: PlatformFilterProps) {
  const selected = value ?? "all";

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">プラットフォーム</p>
      <div className="flex flex-wrap gap-2">
        {PLATFORM_FILTER_OPTIONS.map((option) => {
          const active = selected === option.value;
          const count = counts[option.value];

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-secondary/40 text-foreground hover:border-primary/50",
                option.comingSoon && !active && "opacity-80"
              )}
            >
              <span>{option.label}</span>
              {option.comingSoon ? (
                <Badge
                  variant={active ? "secondary" : "outline"}
                  className="h-5 px-1.5 text-[10px] font-normal"
                >
                  準備中
                </Badge>
              ) : count !== undefined ? (
                <Badge
                  variant={active ? "secondary" : "outline"}
                  className="h-5 min-w-5 justify-center px-1.5 text-[10px]"
                >
                  {count}
                </Badge>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
