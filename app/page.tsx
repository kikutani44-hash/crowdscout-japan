import { HomeClient } from "@/components/HomeClient";
import { fetchProjects } from "@/lib/supabase";

export default async function HomePage() {
  const projects = await fetchProjects();
  return <HomeClient initialProjects={projects} />;
}
