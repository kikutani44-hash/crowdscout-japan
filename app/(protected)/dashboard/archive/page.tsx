import { Suspense } from "react";
import { fetchProjects } from "@/lib/supabase";
import { ArchiveClient } from "@/components/ArchiveClient";

export const revalidate = 0;

export default async function ArchivePage() {
  const projects = await fetchProjects({ archivedOnly: true, sortBy: "score" });

  return (
    <Suspense fallback={null}>
      <ArchiveClient initialProjects={projects} />
    </Suspense>
  );
}
