"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { logActivity } from "@/lib/activity-log";
import { useAuth } from "@/components/AuthProvider";
import { ContactModal } from "@/components/ContactModal";
import { FilterBar } from "@/components/FilterBar";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CFCheckResult } from "@/components/CFCheckResult";
import type { OfferStatus, Project, ProjectFilters } from "@/lib/types";
import { buildCategoryOptions, projectMatchesCategoryGroup } from "@/lib/categories";
import { buildPlatformCounts, isComingSoonPlatform } from "@/lib/platforms";
import {
  countJapanUnenteredCandidates,
  matchesJapanUnenteredOnlyFilter,
} from "@/lib/japan-cf-status";
import { projectMatchesSearch } from "@/lib/project-search";
import {
  compareProjectsByLiveMomentum,
  matchesLiveHotFilter,
} from "@/lib/project-momentum";
import { needsJapaneseTranslation } from "@/lib/project-translation";
import { usdToJpy } from "@/lib/utils";

const TRANSLATE_BATCH_SIZE = 3;
const TRANSLATE_FETCH_TIMEOUT_MS = 55_000;

interface HomeClientProps {
  initialProjects: Project[];
}

export function HomeClient({ initialProjects }: HomeClientProps) {
  const { token } = useAuth();
  const [projects, setProjects] = useState(initialProjects);
  const [filters, setFilters] = useState<ProjectFilters>({ sortBy: "live_momentum" });
  const [offerProject, setOfferProject] = useState<Project | null>(null);
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("project");
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logActivity(token, "page_view", { metadata: { page: "home" } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!highlightId) return;
    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(`project-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary", "ring-offset-2");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 3000);
      } else if (attempts < 20) {
        attempts++;
        setTimeout(tryScroll, 200);
      }
    };
    setTimeout(tryScroll, 300);
  }, [highlightId]);
  const [cfProject, setCfProject] = useState<Project | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const missing = initialProjects.filter(needsJapaneseTranslation);
    if (missing.length === 0) return;

    let cancelled = false;
    setTranslatingIds(new Set(missing.map((p) => p.id)));

    (async () => {
      for (let i = 0; i < missing.length; i += TRANSLATE_BATCH_SIZE) {
        if (cancelled) break;
        const batch = missing.slice(i, i + TRANSLATE_BATCH_SIZE);
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), TRANSLATE_FETCH_TIMEOUT_MS);
          const res = await fetch("/api/translate/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: batch.map((p) => ({
                id: p.id,
                title: p.title,
                subtitle: p.subtitle,
              })),
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          if (data.projects?.length) {
            const byId = new Map<string, { title_ja: string; subtitle_ja: string }>(
              data.projects.map((p: { id: string; title_ja: string; subtitle_ja: string }) => [
                p.id,
                { title_ja: p.title_ja, subtitle_ja: p.subtitle_ja },
              ])
            );
            setProjects((prev) =>
              prev.map((p) => {
                const translated = byId.get(p.id);
                return translated ? { ...p, ...translated } : p;
              })
            );
            setTranslatingIds((prev) => {
              const next = new Set(prev);
              batch.forEach((p) => next.delete(p.id));
              return next;
            });
          }
        } catch (err) {
          console.error("[auto-translate]", err);
          setTranslatingIds((prev) => {
            const next = new Set(prev);
            batch.forEach((p) => next.delete(p.id));
            return next;
          });
        }
      }
      if (!cancelled) setTranslatingIds(new Set());
    })();

    return () => {
      cancelled = true;
    };
  }, [initialProjects]);

  const categoryOptions = useMemo(() => buildCategoryOptions(projects), [projects]);
  const platformCounts = useMemo(() => buildPlatformCounts(projects), [projects]);

  const filtered = useMemo(() => {
    let result = [...projects];
    if (filters.search) {
      result = result.filter((p) => projectMatchesSearch(p, filters.search!));
    }
    if (filters.platform && filters.platform !== "all") {
      result = result.filter((p) => p.platform === filters.platform);
    }
    if (filters.category && filters.category !== "all") {
      result = result.filter((p) => projectMatchesCategoryGroup(p, filters.category!));
    }
    if (filters.offerStatus && filters.offerStatus !== "all") {
      result = result.filter((p) => p.offer_status === filters.offerStatus);
    }
    if (filters.japanUnenteredOnly) {
      result = result.filter(matchesJapanUnenteredOnlyFilter);
    }
    if (filters.liveHotOnly) {
      result = result.filter((p) => matchesLiveHotFilter(p, true));
    }

    const sortBy = filters.sortBy ?? "live_momentum";
    if (sortBy === "live_momentum") {
      result.sort(compareProjectsByLiveMomentum);
    } else {
      result.sort((a, b) => {
        const av = a[sortBy as keyof Project];
        const bv = b[sortBy as keyof Project];
        if (typeof av === "number" && typeof bv === "number") return bv - av;
        return String(bv ?? "").localeCompare(String(av ?? ""));
      });
    }
    return result;
  }, [projects, filters]);

  const totalRaisedJpy = projects.reduce((sum, p) => sum + usdToJpy(p.raised_usd), 0);
  const japanUnenteredCount = countJapanUnenteredCandidates(projects);

  const updateProject = useCallback((updated: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const handleTranslate = async (project: Project) => {
    logActivity(token, "translate", { projectId: project.id, projectTitle: project.title });
    setLoadingAction(`translate-${project.id}`);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          title: project.title,
          subtitle: project.subtitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      updateProject({ ...project, ...(data.project as Project) });
    } catch (err) {
      alert(err instanceof Error ? err.message : "翻訳に失敗しました");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCfCheck = async (project: Project) => {
    logActivity(token, "cf_check", { projectId: project.id, projectTitle: project.title });
    setLoadingAction(`cf-${project.id}`);
    try {
      const res = await fetch("/api/cf-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          query: project.title,
          title: project.title,
          title_ja: project.title_ja,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = { ...project, ...(data.project as Partial<Project>) };
      updateProject(updated);
      setCfProject(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "CFチェックに失敗しました");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFilterChange = (newFilters: ProjectFilters) => {
    const changed = Object.entries(newFilters).find(
      ([k, v]) => v !== filters[k as keyof ProjectFilters]
    );
    if (changed) {
      logActivity(token, "filter_use", { metadata: { key: changed[0], value: String(changed[1]) } });
    }
    setFilters(newFilters);
  };

  const handleOfferStatusChange = async (projectId: string, status: OfferStatus) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    logActivity(token, "status_change", {
      projectId: project.id,
      projectTitle: project.title,
      metadata: { from: project.offer_status, to: status },
    });
    const previous = project.offer_status;
    updateProject({ ...project, offer_status: status });
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_status: status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      updateProject({ ...project, offer_status: previous });
      alert(`ステータスの保存に失敗しました。再度お試しください。\n${e}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Header
        totalRaisedJpy={totalRaisedJpy}
        totalProjects={projects.length}
        japanUnenteredCount={japanUnenteredCount}
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          categoryOptions={categoryOptions}
          platformCounts={platformCounts}
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((project) => (
            <div key={project.id} id={`project-${project.id}`} className="transition-all duration-500">
            <ProductCard
              project={project}
              onTranslate={handleTranslate}
              onCfCheck={handleCfCheck}
              onOffer={(p) => {
                logActivity(token, "offer_open", { projectId: p.id, projectTitle: p.title });
                setOfferProject(p);
              }}
              onExternalLink={(p) => logActivity(token, "external_link", { projectId: p.id, projectTitle: p.title })}
              onCardClick={(p) => logActivity(token, "card_click", { projectId: p.id, projectTitle: p.title })}
              onOfferStatusChange={handleOfferStatusChange}
              loadingAction={loadingAction}
              isTranslating={translatingIds.has(project.id)}
            />
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">
            {filters.platform && isComingSoonPlatform(filters.platform)
              ? "データなし"
              : "条件に一致する案件がありません。"}
          </p>
        )}
      </main>

      <ContactModal
        project={offerProject}
        open={!!offerProject}
        onOpenChange={(open) => !open && setOfferProject(null)}
        onSent={(projectId, offerStatus) => {
          const p = projects.find((x) => x.id === projectId);
          if (p) updateProject({ ...p, offer_status: offerStatus });
        }}
      />

      <Dialog open={!!cfProject} onOpenChange={(open) => !open && setCfProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🇯🇵 日本CFチェック結果</DialogTitle>
          </DialogHeader>
          {cfProject && <CFCheckResult result={cfProject.japan_cf_result} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
