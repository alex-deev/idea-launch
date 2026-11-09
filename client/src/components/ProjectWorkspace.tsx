import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Chat } from "@/components/Chat";
import { API_URL } from "@/lib/api";

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  totalEscrow: number;
  milestones: { id: string; title: string; status: string }[];
}

interface ProjectWorkspaceProps {
  userId: string;
  role: string;
  name: string;
  probationary: boolean;
}

const BUILDER_PROJECT_LIMIT = 3;

export function ProjectWorkspace({
  userId,
  role,
  name,
  probationary,
}: ProjectWorkspaceProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [availableProjects, setAvailableProjects] = useState<ProjectSummary[]>([]);
  const [view, setView] = useState<"mine" | "available">("mine");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const mineResponse = await fetch(
        `${API_URL}/api/projects?userId=${encodeURIComponent(userId)}&role=${role}`,
      );
      if (!mineResponse.ok) throw new Error("Failed to load projects");
      const mineData = (await mineResponse.json()) as { projects: ProjectSummary[] };
      const loaded = mineData.projects ?? [];
      setProjects(loaded);
      setSelectedProjectId((current) =>
        current && loaded.some((project) => project.id === current)
          ? current
          : (loaded[0]?.id ?? null),
      );

      if (role === "BUILDER") {
        const availableResponse = await fetch(
          `${API_URL}/api/projects?userId=${encodeURIComponent(userId)}&role=${role}&available=true`,
        );
        if (availableResponse.ok) {
          const availableData = (await availableResponse.json()) as { projects: ProjectSummary[] };
          setAvailableProjects(availableData.projects ?? []);
        }
      } else {
        setAvailableProjects([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  }, [role, userId]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const activeProjects = projects.filter(
    (project) => project.status !== "COMPLETED" && project.status !== "CANCELLED",
  );
  const atCapacity =
    role === "BUILDER" && activeProjects.length >= BUILDER_PROJECT_LIMIT;

  const handleCreateProject = async () => {
    const title = window.prompt("Project title");
    if (!title?.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          clientId: userId,
          totalEscrow: 100000,
          milestones: [
            { title: "Agreement", amount: 25000, releasePercent: 0 },
            { title: "Initial Demo", amount: 25000, releasePercent: 30 },
            { title: "Final Demo", amount: 25000, releasePercent: 40 },
            { title: "Deployment", amount: 25000, releasePercent: 30 },
          ],
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to create project");
      }

      const data = (await response.json()) as { project: ProjectSummary };
      setProjects((current) => [data.project, ...current]);
      setSelectedProjectId(data.project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClaimProject = async (projectId: string) => {
    if (atCapacity) return;
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ builderId: userId }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to claim project");
      }

      await loadProjects();
      setSelectedProjectId(projectId);
      setView("mine");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim project");
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading projects...</p>;
  }

  if (error && projects.length === 0) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="flex w-full max-w-6xl gap-4">
      <aside className="w-80 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Project Plans</h2>
          {role === "CLIENT" ? (
            <Button size="sm" onClick={handleCreateProject} disabled={isCreating}>
              New
            </Button>
          ) : null}
        </div>

        {role === "BUILDER" ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={view === "mine" ? "default" : "outline"}
              onClick={() => setView("mine")}
            >
              My Projects
            </Button>
            <Button
              size="sm"
              variant={view === "available" ? "default" : "outline"}
              onClick={() => setView("available")}
            >
              Available
            </Button>
          </div>
        ) : null}

        {role === "BUILDER" ? (
          <p className="text-xs text-muted-foreground">
            {activeProjects.length}/{BUILDER_PROJECT_LIMIT} active projects
            {atCapacity ? " (limit reached)" : ""}
          </p>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="space-y-2">
          {view === "available" && role === "BUILDER" ? (
            availableProjects.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  No available project plans.
                </CardContent>
              </Card>
            ) : (
              availableProjects.map((project) => (
                <div key={project.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{project.title}</span>
                    <Badge variant="outline">{project.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ${(project.totalEscrow / 100).toFixed(2)} ·{" "}
                    {project.milestones.length} milestones
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    disabled={atCapacity}
                    onClick={() => handleClaimProject(project.id)}
                  >
                    Claim Project
                  </Button>
                </div>
              ))
            )
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                No projects yet.
              </CardContent>
            </Card>
          ) : (
            projects.map((project) => {
              const releasedCount = project.milestones.filter(
                (milestone) =>
                  milestone.status === "RELEASED" || milestone.status === "COMPLETED",
              ).length;

              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedProjectId === project.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{project.title}</span>
                    <Badge variant="outline">{project.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ${(project.totalEscrow / 100).toFixed(2)} · {releasedCount}/
                    {project.milestones.length} milestones
                  </p>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        {selectedProjectId ? (
          <Chat
            key={selectedProjectId}
            projectId={selectedProjectId}
            userId={userId}
            role={role}
            name={name}
            probationary={probationary}
          />
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Select a project to open its chat and milestone controls.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
