"use client";

import { useCallback, useMemo, useState } from "react";
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
import {
  countJapanUnenteredCandidates,
  matchesJapanUnenteredOnlyFilter,
} from "@/lib/japan-cf-status";
import { projectMatchesSearch } from "@/lib/project-search";
import { usdToJpy } from "@/lib/utils";

interface HomeClientProps {
  initialProjects: Project[];
}

export function HomeClient({ initialProjects }: HomeClientProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [filters, setFilters] = useState<ProjectFilters>({ sortBy: "score" });
  const [offerProject, setOfferProject] = useState<Project | null>(null);
  const [cfProject, setCfProject] = useState<Project | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const categoryOptions = useMemo(() => buildCategoryOptions(projects), [projects]);

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
    const sortBy = filters.sortBy ?? "score";
    result.sort((a, b) => {
      const av = a[sortBy as keyof Project];
      const bv = b[sortBy as keyof Project];
      if (typeof av === "number" && typeof bv === "number") return bv - av;
      return String(bv ?? "").localeCompare(String(av ?? ""));
    });
    return result;
  }, [projects, filters]);

  const totalRaisedJpy = projects.reduce((sum, p) => sum + usdToJpy(p.raised_usd), 0);
  const japanUnenteredCount = countJapanUnenteredCandidates(projects);

  const updateProject = useCallback((updated: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const handleTranslate = async (project: Project) => {
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
      updateProject({ ...project, ...data.project });
    } catch (err) {
      alert(err instanceof Error ? err.message : "翻訳に失敗しました");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCfCheck = async (project: Project) => {
    setLoadingAction(`cf-${project.id}`);
    try {
      const res = await fetch("/api/cf-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          query: project.title_ja ?? project.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      updateProject({ ...project, ...data.project });
      setCfProject({ ...project, ...data.project });
    } catch (err) {
      alert(err instanceof Error ? err.message : "CFチェックに失敗しました");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleOfferStatusChange = async (projectId: string, status: OfferStatus) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    updateProject({ ...project, offer_status: status });
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer_status: status }),
    });
  };

  return (
    <div className="min-h-screen">
      <Header
        totalRaisedJpy={totalRaisedJpy}
        totalProjects={projects.length}
        japanUnenteredCount={japanUnenteredCount}
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <FilterBar filters={filters} onChange={setFilters} categoryOptions={categoryOptions} />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((project) => (
            <ProductCard
              key={project.id}
              project={project}
              onTranslate={handleTranslate}
              onCfCheck={handleCfCheck}
              onOffer={setOfferProject}
              onOfferStatusChange={handleOfferStatusChange}
              loadingAction={loadingAction}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">
            条件に一致する案件がありません。
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
