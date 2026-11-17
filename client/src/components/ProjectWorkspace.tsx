import { useCallback, useEffect, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Chat } from "@/components/Chat";
import { API_URL } from "@/lib/api";
import { buildMilestones } from "@/lib/milestones";
import { formatCurrencyCents } from "@/lib/format";

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
  const { t, i18n } = useTranslation();
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
  const openBidProjects = projects.filter((project) => project.status === "OPEN_FOR_BIDS");
  const clientOpenBidsCount = role === "CLIENT" ? openBidProjects.length : 0;
  const CLIENT_OPEN_BIDS_LIMIT = 3;
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
    return <p className="text-sm text-muted-foreground">{t("loadingProjects")}</p>;
  }

  if (error && projects.length === 0) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  const isBuilder = role === "BUILDER";
  const panelAccent = isBuilder
    ? {
        rail: "border-[#ffb110]/15 bg-[#fff4d6]/25 hover:bg-[#fff4d6]/40 dark:border-[#ffb110]/20 dark:bg-[#3a2f1e]/20 dark:hover:bg-[#3a2f1e]/30",
        railIcon: "text-[#8a5a00] dark:text-[#ffb110]",
        railLabel: "text-[#8a5a00] dark:text-[#ffb110]",
        railBadge: "border-[#ffb110]/25 bg-background/70 dark:border-[#ffb110]/25",
        aside: "border-[#ffb110]/15 bg-[#fff4d6]/20 dark:border-[#ffb110]/20 dark:bg-[#3a2f1e]/15",
        header: "border-[#ffb110]/15 dark:border-[#ffb110]/20",
        collapseBtn:
          "text-[#8a5a00] hover:bg-[#fff4d6]/50 hover:text-[#8a5a00] dark:text-[#ffb110] dark:hover:bg-[#3a2f1e]/30",
        selected:
          "border-[#ffb110]/35 bg-[#fff4d6]/35 shadow-sm dark:border-[#ffb110]/30 dark:bg-[#3a2f1e]/30",
        idle:
          "border-border bg-card hover:border-[#ffb110]/20 hover:bg-[#fff4d6]/20 dark:hover:border-[#ffb110]/20 dark:hover:bg-[#3a2f1e]/20",
        archivedIdle:
          "hover:border-[#ffb110]/20 hover:bg-[#fff4d6]/15 dark:hover:border-[#ffb110]/20 dark:hover:bg-[#3a2f1e]/15",
      }
    : {
        rail: "border-[#0075de]/10 bg-[#e6f3fe]/20 hover:bg-[#e6f3fe]/40 dark:border-[#62aef0]/15 dark:bg-[#1e3a5f]/15 dark:hover:bg-[#1e3a5f]/30",
        railIcon: "text-[#0075de] dark:text-[#62aef0]",
        railLabel: "text-[#0075de] dark:text-[#62aef0]",
        railBadge: "border-[#0075de]/20 bg-background/70 dark:border-[#62aef0]/20",
        aside: "border-[#0075de]/10 bg-[#e6f3fe]/15 dark:border-[#62aef0]/15 dark:bg-[#1e3a5f]/10",
        header: "border-[#0075de]/10 dark:border-[#62aef0]/15",
        collapseBtn:
          "text-[#0075de] hover:bg-[#e6f3fe]/50 hover:text-[#0075de] dark:text-[#62aef0] dark:hover:bg-[#1e3a5f]/30",
        selected:
          "border-[#0075de]/40 bg-[#e6f3fe]/35 shadow-sm dark:border-[#62aef0]/35 dark:bg-[#1e3a5f]/25",
        idle:
          "border-border bg-card hover:border-[#0075de]/20 hover:bg-[#e6f3fe]/20 dark:hover:border-[#62aef0]/20 dark:hover:bg-[#1e3a5f]/15",
        archivedIdle:
          "hover:border-[#0075de]/20 hover:bg-[#e6f3fe]/15 dark:hover:border-[#62aef0]/20 dark:hover:bg-[#1e3a5f]/15",
      };

  return (
    <div className="flex h-full w-full gap-4">
      {isPlansCollapsed ? (
        <aside
          id={PLANS_PANEL_ID}
          aria-label={t("projectPlans")}
          className="flex h-full w-12 shrink-0 flex-col workspace-enter"
        >
          <button
            type="button"
            onClick={() => setPlansCollapsed(false)}
            aria-expanded={false}
            aria-controls={PLANS_PANEL_ID}
            aria-label={`${t("expand")} ${t("projectPlans")} (${visibleProjects.length})`}
            title={`${t("expand")} ${t("projectPlans")}`}
            className={`flex h-full w-full flex-col items-center gap-3 rounded-lg border py-2 text-muted-foreground transition-all duration-200 hover:text-foreground active:scale-[0.98] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${panelAccent.rail}`}
          >
            <PanelLeftOpen className={`size-4 shrink-0 transition-transform duration-200 ${panelAccent.railIcon}`} aria-hidden="true" />
            <span className={`text-[0.7rem] font-semibold tracking-wider uppercase [writing-mode:vertical-rl] ${panelAccent.railLabel}`}>
              {t("projectPlans")}
            </span>
            <Badge variant="outline" className={panelAccent.railBadge}>{visibleProjects.length}</Badge>
          </button>
        </aside>
      ) : (
        <aside
          id={PLANS_PANEL_ID}
          aria-label={t("projectPlans")}
          className={`flex h-full w-80 shrink-0 flex-col gap-3 overflow-y-auto rounded-xl border p-2 workspace-enter ${panelAccent.aside}`}
        >
          <div className={`flex items-center justify-between gap-2 rounded-lg border-b px-1 pb-2 ${panelAccent.header}`}>
            <h2 className="text-lg font-semibold text-foreground">{t("projectPlans")}</h2>
            <div className="flex items-center gap-1">
              {role === "CLIENT" && !isCreateFormOpen ? (
                <Button size="sm" onClick={() => setIsCreateFormOpen(true)} disabled={isCreating}>
                  {t("new")}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPlansCollapsed(true)}
                aria-expanded
                aria-controls={PLANS_PANEL_ID}
                aria-label={t("collapse") + " " + t("projectPlans").toLowerCase()}
                title={t("collapse") + " " + t("projectPlans").toLowerCase()}
                className={panelAccent.collapseBtn}
              >
                <PanelLeftClose aria-hidden="true" />
              </Button>
            </div>
          </div>

          {role === "CLIENT" ? (
            <div className="rounded-md border border-[#0075de]/15 bg-[#e6f3fe]/40 p-2 text-xs dark:border-[#62aef0]/20 dark:bg-[#1e3a5f]/20">
              <p className="font-medium text-foreground">
                {t("openForBids", { count: clientOpenBidsCount, limit: CLIENT_OPEN_BIDS_LIMIT }).split(":")[0]}:{" "}
                <span className="text-[#0075de] dark:text-[#62aef0]">{clientOpenBidsCount}/{CLIENT_OPEN_BIDS_LIMIT}</span>
              </p>
              {clientOpenBidsCount === CLIENT_OPEN_BIDS_LIMIT - 1 ? (
                <p className="text-muted-foreground">{t("oneSlotLeft")}</p>
              ) : clientOpenBidsCount >= CLIENT_OPEN_BIDS_LIMIT ? (
                <p className="text-muted-foreground">{t("openBidsLimitReached")}</p>
              ) : null}
            </div>
          ) : null}

          {role === "CLIENT" && isCreateFormOpen ? (
            <Card className="shrink-0 slide-down-fade">
              <CardContent className="space-y-1 px-2">
                <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="new-project-title">
                  {t("projectName")}
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
                  placeholder={t("projectNamePlaceholder")}
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
                    {t("cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleCreateProject()}
                    disabled={isCreating || !newProjectTitle.trim()}
                  >
                    {isCreating ? t("creating") : t("create")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {role === "BUILDER" ? (
            <div className="flex gap-2">
              <Button size="sm" variant={view === "mine" ? "default" : "outline"} onClick={() => setView("mine")}>
                {t("myProjects")}
              </Button>
              <Button
                size="sm"
                variant={view === "available" ? "default" : "outline"}
                onClick={() => setView("available")}
                disabled={atAcceptedLimit}
                title={
                  atAcceptedLimit
                    ? t("builderAtCapacity", { limit: BUILDER_PROJECT_LIMIT })
                    : undefined
                }
              >
                {t("openForOffers")}
              </Button>
            </div>
          ) : null}

          {role === "BUILDER" ? (
            <p className="rounded-md border border-[#ffb110]/20 bg-[#fff4d6]/35 px-2 py-1.5 text-xs text-muted-foreground dark:border-[#ffb110]/20 dark:bg-[#3a2f1e]/20">
              <span className="font-medium text-[#8a5a00] dark:text-[#ffb110]">{acceptedActiveProjects.length}/{BUILDER_PROJECT_LIMIT}</span>{" "}
              {t("acceptedActiveProjects", { count: acceptedActiveProjects.length, limit: BUILDER_PROJECT_LIMIT }).replace(`${acceptedActiveProjects.length}/${BUILDER_PROJECT_LIMIT} `, "")}
              {atAcceptedLimit ? ` ${t("limitReached")}` : ""}
            </p>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div key={view} className="space-y-2 workspace-enter">
            {view === "available" && role === "BUILDER" ? (
              availableUnavailableReason === "AT_CAPACITY" || atAcceptedLimit ? (
                <Card className="border-[#ffb110]/20 bg-[#fff4d6]/30 dark:border-[#ffb110]/20 dark:bg-[#3a2f1e]/20">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    {t("builderAtCapacity", { limit: BUILDER_PROJECT_LIMIT })}
                  </CardContent>
                </Card>
              ) : availableProjects.length === 0 ? (
                <Card className="border-[#ffb110]/15 bg-[#fff4d6]/20 dark:border-[#ffb110]/15 dark:bg-[#3a2f1e]/15">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    {t("noProjectsOpenForOffers")}
                  </CardContent>
                </Card>
              ) : (
                availableProjects.map((project) => {
                  const myOfferStatus = project.offers?.[0]?.status;
                  return (
                    <div
                      key={project.id}
                      className="rounded-lg border border-[#ffb110]/15 bg-card p-3 transition-all duration-200 hover:border-[#ffb110]/30 hover:bg-[#fff4d6]/20 dark:border-[#ffb110]/15 dark:hover:bg-[#3a2f1e]/20"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{project.title}</span>
                        <Badge variant="outline">{project.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatCurrencyCents(project.totalEscrow, i18n.resolvedLanguage)} · {project.milestones.length} {t("milestones", { defaultValue: "milestones" })}
                      </p>
                      {myOfferStatus ? (
                        <p className="mt-1 text-xs text-muted-foreground">{t("yourOffer", { status: myOfferStatus })}</p>
                      ) : null}
                      <Button
                        size="sm"
                        className="mt-3 w-full active:scale-[0.98]"
                        variant="outline"
                        onClick={() => selectProject(project.id)}
                      >
                        {myOfferStatus ? t("viewManageOffer") : t("viewPlanSubmitOffer")}
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
                        {t("noProjectsYet")}
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
                        className={`w-full rounded-lg border p-3 text-left transition-all duration-200 active:scale-[0.99] ${
                          selectedProjectId === project.id ? panelAccent.selected : panelAccent.idle
                        }`}
                      >
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-medium">{project.title}</span>
                          <Badge variant="outline" className="shrink-0">{project.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatCurrencyCents(project.totalEscrow, i18n.resolvedLanguage)} · {releasedCount}/
                          {project.milestones.length} {t("milestones", { defaultValue: "milestones" })}
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
                      className="w-full justify-between transition-colors duration-200"
                      onClick={() => setIsArchivedOpen((open) => !open)}
                    >
                      {t("archivedWithCount", { count: archivedProjects.length })}
                      <span className="transition-transform duration-200">{isArchivedOpen ? t("hide") : t("show")}</span>
                    </Button>
                    <div
                      className={`grid transition-all duration-200 ease-out ${
                        isArchivedOpen ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="space-y-2">
                          {archivedProjects.map((project) => (
                            <button
                              key={project.id}
                              type="button"
                              onClick={() => selectProject(project.id)}
                              className={`w-full rounded-lg border border-dashed p-3 text-left opacity-70 transition-all duration-200 hover:opacity-100 active:scale-[0.99] ${
                                selectedProjectId === project.id ? panelAccent.selected : panelAccent.archivedIdle
                              }`}
                            >
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <span className="min-w-0 truncate font-medium">{project.title}</span>
                                <Badge variant="outline" className="shrink-0">{project.status}</Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatCurrencyCents(project.totalEscrow, i18n.resolvedLanguage)} · {project.milestones.length} {t("milestones", { defaultValue: "milestones" })}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </aside>
      )}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selectedProjectId ? (
          <div key={selectedProjectId} className="h-full workspace-scale-enter">
            <Chat
              projectId={selectedProjectId}
              userId={userId}
              role={role}
              name={name}
              probationary={probationary}
              builderAtCapacity={atAcceptedLimit}
              clientOpenBidsCount={clientOpenBidsCount}
              clientOpenBidsLimit={CLIENT_OPEN_BIDS_LIMIT}
              clientOpenBidProjects={openBidProjects.map((p) => ({ id: p.id, title: p.title }))}
              onProjectStatusChange={handleProjectStatusChange}
              onClose={closeProject}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/60 p-6 workspace-enter">
            <p className="max-w-xs text-center text-sm text-muted-foreground">
              {t("noProjectOpen")}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}