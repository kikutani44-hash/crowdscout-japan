import { Suspense } from "react";
import { HomeClient } from "@/components/HomeClient";
import { fetchProjects } from "@/lib/supabase";

export const revalidate = 0;

export default async function HomePage() {
  const projects = await fetchProjects();
  return (
    <Suspense fallback={null}>
      <HomeClient initialProjects={projects} />
    </Suspense>
  );
}