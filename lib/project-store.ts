import { readFile, writeFile } from "fs/promises";
import path from "path";
import type { JapanCfResult, OfferStatus, Project } from "./types";
import { calculateScore } from "./scoring";

const MERGED_PATH = path.join(process.cwd(), "data", "projects_merged.json");

interface MergedPayload {
  projects: Project[];
  fetched_at?: string;
  cf_checked_at?: string;
}

function slugId(originalUrl: string, platform: string): string {
  const slug = originalUrl.split("/").filter(Boolean).slice(-2).join("-");
  return `${platform}-${slug}`.slice(0, 80);
}

export async function findLocalProject(projectId: string): Promise<Project | null> {
  const projects = await loadLocalProjects();
  return projects.find((p) => p.id === projectId) ?? null;
}

export async function loadLocalProjects(): Promise<Project[]> {
  try {
    const raw = await readFile(MERGED_PATH, "utf-8");
    const payload = JSON.parse(raw) as MergedPayload;
    return (payload.projects ?? []).map((p, index) => ({
      ...p,
      id: p.id || slugId(p.original_url, p.platform) || `crawled-${index}`,
    }));
  } catch {
    const { sampleProjects } = await import("./sample-data");
    return sampleProjects;
  }
}

export async function updateLocalProject(
  projectId: string,
  updates: Partial<Project>
): Promise<Project | null> {
  try {
    const raw = await readFile(MERGED_PATH, "utf-8");
    const payload = JSON.parse(raw) as MergedPayload;
    const index = payload.projects.findIndex(
      (p, i) => (p.id || slugId(p.original_url, p.platform) || `crawled-${i}`) === projectId
    );
    if (index < 0) return null;

    payload.projects[index] = {
      ...payload.projects[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    await writeFile(MERGED_PATH, JSON.stringify(payload, null, 2), "utf-8");
    const updated = payload.projects[index];
    return {
      ...updated,
      id: projectId,
    } as Project;
  } catch {
    return null;
  }
}

export function applyCfCheckToProject(
  project: Pick<
    Project,
    "raised_usd" | "goal_usd" | "backers" | "category" | "japan_cf_result"
  >,
  result: JapanCfResult
) {
  return {
    japan_cf_checked: true,
    japan_cf_result: result,
    score: calculateScore({ ...project, japan_cf_result: result }),
  };
}

export async function patchOfferStatus(
  projectId: string,
  offerStatus: OfferStatus
): Promise<Project | null> {
  return updateLocalProject(projectId, { offer_status: offerStatus });
}
