import { useCallback, useEffect, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Chat } from "@/components/Chat";
import { API_URL } from "@/lib/api";
import { buildMilestones } from "@/lib/milestones";

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  totalEscrow: number;
  milestones: { id: string; title: string; status: string }[];
  offers?: { id: string; status: string }[];
}

interface ProjectWorkspaceProps {
  userId: string;
  role: string;
  name: string;
  probationary: boolean;
}

const BUILDER_PROJECT_LIMIT = 3;
const PLANS_COLLAPSED_STORAGE_KEY = "idea-launch:project-plans-collapsed";
const PLANS_NARROW_QUERY = "(max-width: 1023px)";
const PLANS_PANEL_ID = "project-plans-panel";

function readPlansCollapsedPreference() {
  try {
    return window.localStorage.getItem(PLANS_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writePlansCollapsedPreference(collapsed: boolean) {
  try {
    window.localStorage.setItem(PLANS_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // Storage can be unavailable; toggle still works this session.
  }
}

function isNarrowViewport() {
  return window.matchMedia(PLANS_NARROW_QUERY).matches;
}

export function ProjectWorkspace({
  userId,
  role,
  name,
  probationary,
}: ProjectWorkspaceProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [availableProjects, setAvailableProjects] = useState<ProjectSummary[]>([]);
  const [availableUnavailableReason, setAvailableUnavailableReason] = useState<string | null>(null);
  const [view, setView] = useState<"mine" | "available">("mine");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [isPlansCollapsed, setIsPlansCollapsed] = useState(
    () => isNarrowViewport() || readPlansCollapsedPreference(),
  );
  const [isNarrow, setIsNarrow] = useState(isNarrowViewport);
  const hasLoadedRef = useRef(false);
  const inFlightRef = useRef(false);
  const selectedProjectIdRef = useRef<string | null>(null);
  const projectStatusesRef = useRef<Record<string, string>>({});

  const loadProjects = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (!hasLoadedRef.current) setIsLoading(true);
    setError((current) => (current === null ? current : null));
    try {
      const mineResponse = await fetch(
        `${API_URL}/api/projects?userId=${encodeURIComponent(userId)}&role=${role}`,
      );
      if (!mineResponse.ok) throw new Error("Failed to load projects");
      const mineData = (await mineResponse.json()) as { projects: ProjectSummary[] };
      const loaded = mineData.projects ?? [];

      let availableLoaded: ProjectSummary[] = [];
      let availableReason: string | null = null;
      if (role === "BUILDER") {
        const availableResponse = await fetch(
          `${API_URL}/api/projects?userId=${encodeURIComponent(userId)}&role=${role}&available=true`,
        );
        if (availableResponse.ok) {
          const availableData = (await availableResponse.json()) as {
            projects: ProjectSummary[];
            unavailableReason?: string;
          };
          availableLoaded = availableData.projects ?? [];
          availableReason = availableData.unavailableReason ?? null;
        }
      }

      const allKnown = [...loaded, ...availableLoaded];
      const selectedId = selectedProjectIdRef.current;
      if (selectedId) {
        const previousStatus = projectStatusesRef.current[selectedId];
        const nextStatus = allKnown.find((project) => project.id === selectedId)?.status;
        // Only close on transition into CANCELLED (not on re-reported CANCELLED).
        if (
          previousStatus &&
          previousStatus !== "CANCELLED" &&
          nextStatus === "CANCELLED"
        ) {
          setSelectedProjectId(null);
        }
      }

      // Track statuses for both mine and available projects.
      projectStatusesRef.current = {
        ...projectStatusesRef.current,
        ...Object.fromEntries(allKnown.map((project) => [project.id, project.status])),
      };

      setProjects((prev) =>
        JSON.stringify(prev) === JSON.stringify(loaded) ? prev : loaded,
      );
      setAvailableProjects((prev) =>
        JSON.stringify(prev) === JSON.stringify(availableLoaded) ? prev : availableLoaded,
      );
      setAvailableUnavailableReason((prev) => (prev === availableReason ? prev : availableReason));

      // Keep selection if it exists in any loaded list (e.g. builder viewing an open project).
      setSelectedProjectId((current) => {
        if (!current) return null;
        const exists = loaded.some((p) => p.id === current) || availableLoaded.some((p) => p.id === current);
        return exists ? current : null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      inFlightRef.current = false;
      hasLoadedRef.current = true;
      setIsLoading(false);
    }
  }, [role, userId]);

  useEffect(() => {
    void loadProjects();
    const interval = window.setInterval(() => {
      void loadProjects();
    }, 5000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadProjects();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadProjects]);

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  useEffect(() => {
    const query = window.matchMedia(PLANS_NARROW_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsNarrow(event.matches);
      setIsPlansCollapsed(event.matches ? true : readPlansCollapsedPreference());
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  const setPlansCollapsed = useCallback(
    (collapsed: boolean) => {
      setIsPlansCollapsed(collapsed);
      if (!isNarrow) writePlansCollapsedPreference(collapsed);
    },
    [isNarrow],
  );

  const selectProject = useCallback(
    (projectId: string) => {
      setSelectedProjectId(projectId);
      if (isNarrow) setIsPlansCollapsed(true);
    },
    [isNarrow],
  );

  const closeProject = useCallback(() => {
    setSelectedProjectId(null);
    if (isNarrow) setIsPlansCollapsed(false);
  }, [isNarrow]);

  const handleProjectStatusChange = useCallback(
    (projectId: string, status: string) => {
      const previousStatus = projectStatusesRef.current[projectId];
      projectStatusesRef.current = {
        ...projectStatusesRef.current,
        [projectId]: status,
      };
      setProjects((prev) => {
        let changed = false;
        const next = prev.map((project) => {
          if (project.id === projectId && project.status !== status) {
            changed = true;
            return { ...project, status };
          }
          return project;
        });
        return changed ? next : prev;
      });
      setAvailableProjects((prev) => {
        let changed = false;
        const next = prev.map((project) => {
          if (project.id === projectId && project.status !== status) {
            changed = true;
            return { ...project, status };
          }
          return project;
        });
        return changed ? next : prev;
      });
      if (
        status === "CANCELLED" &&
        previousStatus !== undefined &&
        previousStatus !== "CANCELLED"
      ) {
        setSelectedProjectId((current) => (current === projectId ? null : current));
      }
      if (status === "ACTIVE" || status === "COMPLETED") {
        // Refresh to move accepted projects into "mine"
        void loadProjects();
      }
    },
    [loadProjects],
  );

  const archivedProjects = projects.filter((project) => project.status === "CANCELLED");
  const visibleProjects = projects.filter((project) => project.status !== "CANCELLED");
  const acceptedActiveProjects = projects.filter((project) => project.status === "ACTIVE");
  const atAcceptedLimit =
    role === "BUILDER" && acceptedActiveProjects.length >= BUILDER_PROJECT_LIMIT;

  useEffect(() => {
    if (atAcceptedLimit && view === "available") {
      setView("mine");
    }
  }, [atAcceptedLimit, view]);

  const handleCreateProject = async () => {
    const title = newProjectTitle.trim();
    if (!title) return;

    setIsCreating(true);
    setError(null);
    try {
      const totalEscrow = 100000;
      const response = await fetch(`${API_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          clientId: userId,
          totalEscrow,
          milestones: buildMilestones(totalEscrow),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to create project");
      }

      const data = (await response.json()) as { project: ProjectSummary };
      setProjects((current) => [data.project, ...current]);
      setNewProjectTitle("");
      setIsCreateFormOpen(false);
      selectProject(data.project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading projects...</p>;
  }

  if (error && projects.length === 0) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="flex h-full w-full gap-4">
      {isPlansCollapsed ? (
        <aside
          id={PLANS_PANEL_ID}
          aria-label="Project plans"
          className="flex h-full w-12 shrink-0 flex-col"
        >
          <button
            type="button"
            onClick={() => setPlansCollapsed(false)}
            aria-expanded={false}
            aria-controls={PLANS_PANEL_ID}
            aria-label={`Expand project plans (${visibleProjects.length})`}
            title="Expand project plans"
            className="flex h-full w-full flex-col items-center gap-3 rounded-lg border border-transparent py-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <PanelLeftOpen className="size-4 shrink-0" aria-hidden="true" />
            <span className="text-[0.7rem] font-semibold tracking-wider uppercase [writing-mode:vertical-rl]">
              Project Plans
            </span>
            <Badge variant="outline">{visibleProjects.length}</Badge>
          </button>
        </aside>
      ) : (
        <aside
          id={PLANS_PANEL_ID}
          aria-label="Project plans"
          className="flex h-full w-80 shrink-0 flex-col gap-3 overflow-y-auto p-1"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Project Plans</h2>
            <div className="flex items-center gap-1">
              {role === "CLIENT" && !isCreateFormOpen ? (
                <Button size="sm" onClick={() => setIsCreateFormOpen(true)} disabled={isCreating}>
                  New
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPlansCollapsed(true)}
                aria-expanded
                aria-controls={PLANS_PANEL_ID}
                aria-label="Collapse project plans"
                title="Collapse project plans"
              >
                <PanelLeftClose aria-hidden="true" />
              </Button>
            </div>
          </div>

          {role === "CLIENT" && isCreateFormOpen ? (
            <Card className="shrink-0">
              <CardContent className="space-y-1 px-2">
                <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="new-project-title">
                  Project name
                </label>
                <Input
                  id="new-project-title"
                  value={newProjectTitle}
                  onChange={(event) => setNewProjectTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreateProject();
                    }
                    if (event.key === "Escape") {
                      setIsCreateFormOpen(false);
                      setNewProjectTitle("");
                    }
                  }}
                  placeholder="e.g. Marketing website"
                  autoFocus
                  disabled={isCreating}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsCreateFormOpen(false);
                      setNewProjectTitle("");
                    }}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleCreateProject()}
                    disabled={isCreating || !newProjectTitle.trim()}
                  >
                    {isCreating ? "Creating..." : "Create"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {role === "BUILDER" ? (
            <div className="flex gap-2">
              <Button size="sm" variant={view === "mine" ? "default" : "outline"} onClick={() => setView("mine")}>
                My Projects
              </Button>
              <Button
                size="sm"
                variant={view === "available" ? "default" : "outline"}
                onClick={() => setView("available")}
                disabled={atAcceptedLimit}
                title={
                  atAcceptedLimit
                    ? "You have 3 accepted active projects and cannot take on new project plans."
                    : undefined
                }
              >
                Open for offers
              </Button>
            </div>
          ) : null}

          {role === "BUILDER" ? (
            <p className="text-xs text-muted-foreground">
              {acceptedActiveProjects.length}/{BUILDER_PROJECT_LIMIT} accepted active projects
              {atAcceptedLimit ? " (limit reached)" : ""}
            </p>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="space-y-2">
            {view === "available" && role === "BUILDER" ? (
              availableUnavailableReason === "AT_CAPACITY" || atAcceptedLimit ? (
                <Card>
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    You’ve reached the limit of {BUILDER_PROJECT_LIMIT} accepted active projects, so you
                    can’t see or take on new project plans right now.
                  </CardContent>
                </Card>
              ) : availableProjects.length === 0 ? (
                <Card>
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    No projects open for offers right now.
                  </CardContent>
                </Card>
              ) : (
                availableProjects.map((project) => {
                  const myOfferStatus = project.offers?.[0]?.status;
                  return (
                    <div key={project.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{project.title}</span>
                        <Badge variant="outline">{project.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        ${(project.totalEscrow / 100).toFixed(2)} · {project.milestones.length} milestones
                      </p>
                      {myOfferStatus ? (
                        <p className="mt-1 text-xs text-muted-foreground">Your offer: {myOfferStatus}</p>
                      ) : null}
                      <Button
                        size="sm"
                        className="mt-3 w-full"
                        variant="outline"
                        onClick={() => selectProject(project.id)}
                      >
                        {myOfferStatus ? "View / manage offer" : "View plan & submit offer"}
                      </Button>
                    </div>
                  );
                })
              )
            ) : (
              <>
                {visibleProjects.length === 0 ? (
                  archivedProjects.length === 0 ? (
                    <Card>
                      <CardContent className="p-4 text-sm text-muted-foreground">
                        No projects yet.
                      </CardContent>
                    </Card>
                  ) : null
                ) : (
                  visibleProjects.map((project) => {
                    const releasedCount = project.milestones.filter(
                      (milestone) =>
                        milestone.status === "RELEASED" || milestone.status === "COMPLETED",
                    ).length;

                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => selectProject(project.id)}
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

                {archivedProjects.length > 0 ? (
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between"
                      onClick={() => setIsArchivedOpen((open) => !open)}
                    >
                      Archived ({archivedProjects.length})
                      <span>{isArchivedOpen ? "Hide" : "Show"}</span>
                    </Button>
                    {isArchivedOpen ? (
                      <div className="mt-2 space-y-2">
                        {archivedProjects.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => selectProject(project.id)}
                            className={`w-full rounded-lg border border-dashed p-3 text-left opacity-70 transition hover:opacity-100 ${
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
                              ${(project.totalEscrow / 100).toFixed(2)} · {project.milestones.length} milestones
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </aside>
      )}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selectedProjectId ? (
          <Chat
            key={selectedProjectId}
            projectId={selectedProjectId}
            userId={userId}
            role={role}
            name={name}
            probationary={probationary}
            builderAtCapacity={atAcceptedLimit}
            onProjectStatusChange={handleProjectStatusChange}
            onClose={closeProject}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/60 p-6">
            <p className="max-w-xs text-center text-sm text-muted-foreground">
              No project open. Pick one from Project Plans to see its milestones and chat.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}