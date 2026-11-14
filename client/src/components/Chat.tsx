import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { io, type Socket } from "socket.io-client";

import { ArrowDown, FileText, MoreVertical, X } from "lucide-react";
import { inferPlatformTargetsFromScope } from "@/lib/deliverables";
import { buildMilestones, sumMilestoneAmounts } from "@/lib/milestones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DemoWidget } from "@/components/DemoWidget";
import { DemoSubmitDialog } from "@/components/DemoSubmitDialog";
import { OffersPanel, type OfferRecord } from "@/components/OfferWidget";
import { ProjectControls } from "@/components/ProjectControls";
import { ScopeIntakeForm } from "@/components/ScopeIntakeForm";
import { ScopeWidget } from "@/components/ScopeWidget";
import { SOCKET_URL } from "@/lib/api";

interface ChatMessage {
  id: string;
  projectId: string;
  senderId?: string | null;
  type: string;
  content: string;
  payload?: unknown;
  createdAt?: string;
  sender?: { id: string; name?: string | null; image?: string | null } | null;
}

interface DemoPayload {
  milestoneId?: string;
  specVersion?: number;
  bundle?: unknown;
  whatChanged?: string;
  demoUrl?: string | null;
  accessUrl?: string | null;
}

interface ScopePayload {
  title?: string;
  executiveSummary?: string;
  technicalArchitecture?: string;
  coreFeatures?: string[];
  milestones?: { title: string; amount: number; releasePercent?: number }[];
  outOfScope?: string[];
  budgetCents?: number;
  appKinds?: string[];
  appKindOther?: string;
}

interface ChatProps {
  userId: string;
  role: string;
  name: string;
  probationary?: boolean;
  builderAtCapacity?: boolean;
  clientOpenBidsCount?: number;
  clientOpenBidsLimit?: number;
  clientOpenBidProjects?: { id: string; title: string }[];
  projectId?: string;
  onProjectStatusChange?: (projectId: string, status: string) => void;
  onClose?: () => void;
}

export function Chat({
  userId,
  role,
  name,
  probationary = false,
  builderAtCapacity = false,
  clientOpenBidsCount = 0,
  clientOpenBidsLimit = 3,
  clientOpenBidProjects = [],
  projectId = "project-123",
  onProjectStatusChange,
  onClose,
}: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [projectStatus, setProjectStatus] = useState("SCOPING");
  const [project, setProject] = useState<any>(null);
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);

  const showIntakeForm =
    role === "CLIENT" &&
    projectStatus === "SCOPING" &&
    !messages.some((message) => message.type === "SCOPE_WIDGET");

  const [controlsOpen, setControlsOpen] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { userId, role, name },
    });
    socketRef.current = socket;

    socket.emit("join_project", { projectId, userId });

    socket.on("new_message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      if (
        offersPanelOpenRef.current &&
        showOffersBarRef.current &&
        message.senderId !== userId
      ) {
        setUnreadWhileOffersOpen((c) => c + 1);
      }
    });

    socket.on("message_history", (data: { messages?: ChatMessage[] }) => {
      setMessages(data?.messages ?? []);
    });

    socket.on("message_updated", (message: ChatMessage) => {
      setMessages((prev) =>
        prev.map((item) => (item.id === message.id ? message : item)),
      );
    });

    socket.on("project_updated", (data: { project?: any }) => {
      if (data?.project) {
        setProject(data.project);
        if (Array.isArray(data.project.offers)) setOffers(data.project.offers);
        setSelectedOfferId(data.project.selectedOfferId ?? null);
        if (data.project.status) {
          setProjectStatus(data.project.status);
          onProjectStatusChange?.(projectId, data.project.status);
        }
      }
    });

    socket.on(
      "offers_updated",
      (data: { offers?: OfferRecord[]; selectedOfferId?: string | null }) => {
        if (Array.isArray(data?.offers)) setOffers(data.offers);
        if (Object.prototype.hasOwnProperty.call(data ?? {}, "selectedOfferId")) {
          setSelectedOfferId(data?.selectedOfferId ?? null);
        }
      },
    );

    socket.on("milestone_updated", (data: { milestone?: any }) => {
      const milestone = data?.milestone;
      if (!milestone?.id) return;
      setProject((prev: any) => {
        if (!prev?.milestones) return prev;
        const idx = prev.milestones.findIndex((m: any) => m.id === milestone.id);
        if (idx === -1) return prev;
        const next = [...prev.milestones];
        next[idx] = { ...next[idx], ...milestone };
        return { ...prev, milestones: next };
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, role, name, projectId, onProjectStatusChange]);

  useEffect(() => {
    if (!controlsOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (controlsRef.current && !controlsRef.current.contains(event.target as Node)) {
        setControlsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [controlsOpen]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom <= 80) {
      container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
      setShowScrollToBottom(false);
    } else {
      setShowScrollToBottom(true);
    }
    const updateVisibility = () => {
      const distance =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollToBottom(distance > 80);
    };
    container.addEventListener("scroll", updateVisibility);
    return () => container.removeEventListener("scroll", updateVisibility);
  }, [messages, offers, projectStatus]);

  const latestScopeMessage = [...messages].reverse().find((message) => message.type === "SCOPE_WIDGET");
  const latestScopePayload = latestScopeMessage?.payload as ScopePayload | undefined;

  const scopeTotalCents =
    (typeof latestScopePayload?.budgetCents === "number" && latestScopePayload.budgetCents > 0
      ? latestScopePayload.budgetCents
      : 0) ||
    (project?.totalEscrow ?? 0) ||
    sumMilestoneAmounts(latestScopePayload?.milestones) ||
    100000;

  const selectedOffer = offers.find((o) => o.id === selectedOfferId) ?? null;
  const isNegotiationParticipant =
    projectStatus === "OPEN_FOR_BIDS" &&
    !!selectedOfferId &&
    (role === "CLIENT" || (role === "BUILDER" && selectedOffer?.builderId === userId));
  const canChat = projectStatus === "ACTIVE" || isNegotiationParticipant;

  const myOffer = offers.find((o) => o.builderId === userId) ?? null;
  const acceptedTermsOffer =
    offers.find((o) => o.id === (project as any)?.acceptedOfferId) ??
    offers.find((o) => o.status === "ACCEPTED") ??
    null;
  const showOffersBar = projectStatus === "OPEN_FOR_BIDS" && !showIntakeForm;
  const showHeaderTermsButton =
    ["ACTIVE", "COMPLETED", "CANCELLED"].includes(projectStatus) &&
    (!!acceptedTermsOffer || !!(project as any)?.totalEscrow || (project?.milestones ?? []).length > 0);

  const [offersPanelOpen, setOffersPanelOpen] = useState(false);
  const [headerTermsOpen, setHeaderTermsOpen] = useState(false);
  const [unreadWhileOffersOpen, setUnreadWhileOffersOpen] = useState(0);
  const offersAutoKeyRef = useRef<string | null>(null);
  const offersPanelOpenRef = useRef(false);
  const showOffersBarRef = useRef(false);

  const offersActionNeeded =
    projectStatus === "OPEN_FOR_BIDS" &&
    (role === "CLIENT"
      ? (!selectedOfferId && offers.some((o) => o.status === "SUBMITTED")) ||
        selectedOffer?.status === "FINAL"
      : (!myOffer && !builderAtCapacity) ||
        (!!selectedOffer && selectedOffer.builderId === userId && selectedOffer.status === "SELECTED"));

  useEffect(() => {
    if (!showOffersBar) {
      setOffersPanelOpen(false);
      setUnreadWhileOffersOpen(0);
      offersAutoKeyRef.current = null;
      return;
    }
    const key = `${projectId}:${projectStatus}:${offersActionNeeded ? "need" : "idle"}`;
    if (offersActionNeeded && offersAutoKeyRef.current !== key) {
      setOffersPanelOpen(true);
    }
    offersAutoKeyRef.current = key;
  }, [showOffersBar, projectId, projectStatus, offersActionNeeded]);

  useEffect(() => {
    offersPanelOpenRef.current = offersPanelOpen;
    showOffersBarRef.current = showOffersBar;
    if (!offersPanelOpen || !showOffersBar) {
      setUnreadWhileOffersOpen(0);
    }
  }, [offersPanelOpen, showOffersBar]);

  useEffect(() => {
    setUnreadWhileOffersOpen(0);
  }, [projectId]);

  useEffect(() => {
    if (!showHeaderTermsButton) setHeaderTermsOpen(false);
  }, [showHeaderTermsButton, projectId]);

  const emitAck = (event: string, payload: any) => {
    setActionError(null);
    socketRef.current?.emit(event, payload, (res: any) => {
      if (res && res.ok === false && res.error) {
        setActionError(String(res.error));
      }
    });
  };

  const emitAckAsync = (event: string, payload: any) =>
    new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const socket = socketRef.current;
      if (!socket) {
        resolve({ ok: false, error: "Not connected" });
        return;
      }
      socket.emit(event, payload, (res: any) => {
        if (res && res.ok === false) {
          resolve({ ok: false, error: res.error ? String(res.error) : "Request failed" });
          return;
        }
        resolve({ ok: true });
      });
    });

  const sendMessage = () => {
    const content = draft.trim();
    if (!content || !socketRef.current || !canChat) return;
    socketRef.current.emit(
      "send_message",
      { projectId, senderId: userId, type: "TEXT", content },
      (res: any) => {
        if (res && res.ok === false && res.error) setActionError(String(res.error));
      },
    );
    setDraft("");
  };

  const orderedMilestones = [...(project?.milestones ?? [])].sort(
    (a: any, b: any) => (a.stageNumber ?? 0) - (b.stageNumber ?? 0),
  );
  const nextDemoMilestone =
    orderedMilestones.find(
      (milestone: any) =>
        milestone.status !== "RELEASED" && milestone.status !== "COMPLETED",
    ) ?? orderedMilestones[orderedMilestones.length - 1];

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const getMilestoneDeadlineText = (milestone: any, now: number) => {
    if (!milestone) return null;
    const title = String(milestone.title ?? "");
    const label =
      title === "Initial Demo"
        ? "Initial demo"
        : title === "Final Demo"
          ? "Final presentation"
          : title === "Deployment"
            ? "Deployment"
            : title || "Milestone";

    const formatSpan = (diffMs: number) => {
      const abs = Math.abs(diffMs);
      const dayMs = 24 * 60 * 60 * 1000;
      const hourMs = 60 * 60 * 1000;
      const days = Math.floor(abs / dayMs);
      const hours = Math.floor((abs % dayMs) / hourMs);
      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days === 0) parts.push(`${hours}h`);
      return { abs, hourMs, span: parts.join(" ") || "<1h" };
    };

    if (milestone.status === "CHANGES_REQUESTED" && milestone.revisionRequestedAt) {
      const target = new Date(milestone.revisionRequestedAt).getTime() + 24 * 60 * 60 * 1000;
      if (Number.isFinite(target)) {
        const diffMs = target - now;
        const { abs, hourMs, span } = formatSpan(diffMs);
        if (diffMs < 0) {
          return { label, text: `${label} update overdue by ${span} (soft 24h)`, overdue: true };
        }
        if (abs < hourMs) {
          return { label, text: `${label} update due in <1h (soft 24h)`, overdue: false };
        }
        return { label, text: `${label} update due in ${span} (soft 24h)`, overdue: false };
      }
    }

    const due = milestone.dueDate ? new Date(milestone.dueDate) : null;
    if (!due || Number.isNaN(due.getTime())) {
      return { label, text: `${label}: no due date`, overdue: false };
    }

    const diffMs = due.getTime() - now;
    const { abs, hourMs, span } = formatSpan(diffMs);
    if (diffMs < 0) {
      return { label, text: `${label} overdue by ${span}`, overdue: true };
    }
    if (abs < hourMs) {
      return { label, text: `${label} due in <1h`, overdue: false };
    }
    return { label, text: `${label} in ${span}`, overdue: false };
  };

  const nextDemoDeadline = getMilestoneDeadlineText(nextDemoMilestone, nowTick);

  const nextDemoLabel = (() => {
    if (!nextDemoMilestone?.id) return "Submit Demo";
    const milestoneTitle = String(nextDemoMilestone.title ?? "Demo");
    const hasSubmittedDemo =
      !!nextDemoMilestone.currentDemoMessageId &&
      nextDemoMilestone.status !== "RELEASED" &&
      nextDemoMilestone.status !== "COMPLETED";
    const isResubmission =
      nextDemoMilestone.status === "CHANGES_REQUESTED" || hasSubmittedDemo;
    return `${isResubmission ? "Resubmit" : "Submit"} ${milestoneTitle}`;
  })();

  const canSubmitDemo =
    !!nextDemoMilestone?.id &&
    nextDemoMilestone.status !== "RELEASED" &&
    nextDemoMilestone.status !== "COMPLETED";

  const currentDemoSubmission = (() => {
    if (!nextDemoMilestone?.id) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.type !== "DEMO_WIDGET") continue;
      const payload = (message.payload ?? {}) as DemoPayload;
      if ((payload.milestoneId ?? "milestone-1") === nextDemoMilestone.id) return payload;
    }
    return null;
  })();

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  };

  const jumpToLatestFromOffers = () => {
    setOffersPanelOpen(false);
    setUnreadWhileOffersOpen(0);
    setTimeout(() => scrollToBottom(), 0);
  };

  const fmtCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const headerTermsData = (() => {
    if (!showHeaderTermsButton) return null;
    if (acceptedTermsOffer) {
      const milestones =
        (acceptedTermsOffer.milestonesSnapshot && acceptedTermsOffer.milestonesSnapshot.length > 0
          ? acceptedTermsOffer.milestonesSnapshot
          : buildMilestones(acceptedTermsOffer.totalCents)) ?? [];
      return {
        builderName: acceptedTermsOffer.builder?.name ?? project?.builder?.name ?? "Builder",
        totalCents: acceptedTermsOffer.totalCents,
        milestones: milestones.map((m: any) => ({
          title: m.title,
          amount: m.amount,
          dueDate: m.dueDate ?? null,
        })),
        longTermAmountCents: acceptedTermsOffer.longTermAmountCents ?? null,
        longTermCadence: acceptedTermsOffer.longTermCadence ?? null,
        longTermNotes: acceptedTermsOffer.longTermNotes ?? null,
      };
    }
    const ms = (project?.milestones ?? []).map((m: any) => ({
      title: m.title,
      amount: m.amount,
      dueDate: m.dueDate ?? null,
    }));
    if (ms.length === 0 && !project?.totalEscrow) return null;
    return {
      builderName: project?.builder?.name ?? "Builder",
      totalCents: project?.totalEscrow ?? sumMilestoneAmounts(ms as any),
      milestones: ms,
      longTermAmountCents: null,
      longTermCadence: null,
      longTermNotes: null,
    };
  })();

  const isScopingTakeover = projectStatus === "SCOPING";

  if (isScopingTakeover) {
    return (
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 rounded-xl border border-border/60">
        <Card size="sm" className="flex min-h-0 flex-1 flex-col gap-0 overflow-visible ring-0 py-0">
          <CardHeader className="shrink-0 !flex items-center justify-between border-b border-border/60 pt-2">
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <CardTitle className="truncate">
                  {project?.title ?? `Project ${projectId}`}
                </CardTitle>
                <Badge variant="secondary" className="shrink-0">Scoping</Badge>
              </div>
              <div className="flex items-center gap-1">
                {onClose ? (
                  <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close project card" title="Close card">
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
            <div className="relative min-h-0 flex-1">
              <div className="absolute inset-0 overflow-y-auto p-4">
                <div className="mx-auto flex min-h-full w-full max-w-xl items-start justify-center">
                  {showIntakeForm ? (
                    <div className="w-full">
                      <ScopeIntakeForm
                        projectId={projectId}
                        userId={userId}
                        socket={socketRef.current}
                        projectTotal={project?.totalEscrow ?? 0}
                      />
                    </div>
                  ) : latestScopeMessage ? (
                    <div className="w-full">
                      <ScopeWidget
                        socket={socketRef.current}
                        projectId={projectId}
                        role={role}
                        payload={latestScopePayload}
                        messageId={latestScopeMessage.id}
                        editable={projectStatus === "SCOPING"}
                        totalCents={scopeTotalCents || project?.totalEscrow || undefined}
                        openBidsCount={clientOpenBidsCount}
                        openBidsLimit={clientOpenBidsLimit}
                        openBidProjects={clientOpenBidProjects}
                      />
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <p className="text-muted-foreground">
                        {role === "BUILDER"
                          ? "The client is currently scoping this project. You will be able to submit offers once it is published."
                          : "Waiting for scope generation..."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 rounded-xl border border-border/60">
      <Card
        size="sm"
        className="relative flex min-h-0 flex-1 flex-col gap-0 overflow-visible ring-0 py-0"
      >
        <CardHeader className="shrink-0 !flex items-center justify-between border-b border-border/60 pt-2">
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <CardTitle className="truncate">
                {(() => {
                  const title = project?.title ?? `Project ${projectId}`;
                  const builderName =
                    project?.builder?.name ?? (selectedOfferId ? selectedOffer?.builder?.name : null);
                  const counterpartyName =
                    role === "CLIENT" ? builderName : project?.client?.name;
                  return counterpartyName ? `${title} (${counterpartyName})` : title;
                })()}
              </CardTitle>
              {projectStatus === "ACTIVE" ? (
                <Badge variant="secondary" className="shrink-0">Funded</Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              {showHeaderTermsButton ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setHeaderTermsOpen((v) => !v)}
                  aria-label="Offer and terms"
                  aria-expanded={headerTermsOpen}
                  title="Offer & Terms"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              ) : null}
              <div className="relative" ref={controlsRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setControlsOpen((open) => !open)}
                  aria-label="Project controls"
                  aria-expanded={controlsOpen}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
                {controlsOpen ? (
                  <div className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)]">
                    <ProjectControls socket={socketRef.current} project={project} role={role} userId={userId} />
                  </div>
                ) : null}
              </div>
              {onClose ? (
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close project card" title="Close card">
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent
          className={`relative flex min-h-0 flex-1 flex-col gap-0 ${
            showOffersBar ? "overflow-visible" : "overflow-hidden"
          }`}
        >
          {showIntakeForm ? (
            <div className="relative min-h-0 flex-1">
              <div className="absolute inset-0 overflow-y-auto p-4">
                <div className="mx-auto flex min-h-full w-full max-w-xl items-start justify-center">
                  <ScopeIntakeForm
                    projectId={projectId}
                    userId={userId}
                    socket={socketRef.current}
                    projectTotal={project?.totalEscrow ?? 0}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="relative min-h-0 flex-1">
              <div ref={messagesContainerRef} className="absolute inset-0 space-y-3 overflow-y-auto rounded-md p-3">
                {messages.map((message) => {
                  const isOwnMessage = message.senderId === userId;

                  // Offer-driven workflow: ignore legacy WIDGET offer messages.
                  if (message.type === "WIDGET") {
                    return null;
                  }

                  if (message.type === "DEMO_WIDGET") {
                    const payload = (message.payload ?? {}) as DemoPayload;
                    const milestoneId = payload.milestoneId ?? "milestone-1";
                    const milestone = (project?.milestones ?? []).find((m: any) => m.id === milestoneId) ?? null;
                    return (
                      <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                        <DemoWidget
                          socket={socketRef.current}
                          projectId={projectId}
                          userId={userId}
                          role={role}
                          messageId={message.id}
                          milestoneId={milestoneId}
                          payload={payload}
                          milestone={milestone}
                        />
                      </div>
                    );
                  }

                  if (message.type === "SCOPE_WIDGET") {
                    const payload = (message.payload ?? {}) as ScopePayload;
                    return (
                      <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                        <ScopeWidget
                          socket={socketRef.current}
                          projectId={projectId}
                          role={role}
                          payload={payload}
                          messageId={message.id}
                          editable={projectStatus === "SCOPING"}
                          totalCents={scopeTotalCents || project?.totalEscrow || undefined}
                          openBidsCount={clientOpenBidsCount}
                          openBidsLimit={clientOpenBidsLimit}
                          openBidProjects={clientOpenBidProjects}
                        />
                      </div>
                    );
                  }

                  if (message.type === "SYSTEM") {
                    return (
                      <div key={message.id} className="flex justify-center">
                        <span className="max-w-[85%] rounded-full bg-muted px-3 py-1 text-center text-xs font-medium text-muted-foreground shadow-sm">
                          {message.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] px-3 py-2 text-sm ${
                          isOwnMessage
                            ? "rounded-tl-2xl rounded-tr-2xl rounded-br-sm rounded-bl-2xl bg-primary text-primary-foreground"
                            : "rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl bg-muted text-foreground"
                        }`}
                      >
                        <span className="font-medium">
                          {isOwnMessage ? "You" : (message.sender?.name ?? message.senderId ?? "Unknown")}:
                        </span>{" "}
                        {message.content}
                      </div>
                    </div>
                  );
                })}

                {!showIntakeForm && actionError ? (
                  <p className="pt-2 text-sm text-red-600">{actionError}</p>
                ) : null}
              </div>
              {showScrollToBottom ? (
                <Button
                  type="button"
                  size="icon"
                  className="absolute bottom-3 right-3 h-8 w-8 rounded-full shadow"
                  onClick={scrollToBottom}
                  aria-label="Scroll to latest messages"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          )}

          {showOffersBar ? (
            <OffersPanel
              open={offersPanelOpen}
              onToggle={() => setOffersPanelOpen((v) => !v)}
              unreadCount={unreadWhileOffersOpen}
              onJumpToLatest={jumpToLatestFromOffers}
              role={role}
                  userId={userId}
                  projectId={projectId}
                  projectStatus={projectStatus}
                  selectedOfferId={selectedOfferId}
                  offers={offers}
                  probationary={probationary}
                  builderAtCapacity={builderAtCapacity}
                  defaultTotalCents={scopeTotalCents || project?.totalEscrow || 100000}
                  defaultPlatformTargets={inferPlatformTargetsFromScope(
                    latestScopePayload?.appKinds,
                    latestScopePayload?.appKindOther,
                  )}
                  onSubmitOffer={(terms) => emitAck("submit_offer", { projectId, builderId: userId, ...terms })}
                  onReviseOffer={(terms) => emitAck("revise_offer", { projectId, builderId: userId, ...terms })}
                  onWithdrawOffer={() => emitAck("withdraw_offer", { projectId, builderId: userId })}
                  onSelectOffer={(offerId) => emitAck("select_offer", { projectId, offerId, clientId: userId })}
                  onCancelNegotiation={() => emitAck("cancel_negotiation", { projectId, clientId: userId })}
                  onUpdateOfferTerms={(offerId, terms) =>
                    emitAck("update_offer_terms", { projectId, offerId, actorId: userId, ...terms })
                  }
                  onMarkOfferFinal={(offerId) => emitAck("mark_offer_final", { projectId, offerId, builderId: userId })}
                  onUnfinalizeOffer={(offerId) => emitAck("unfinalize_offer", { projectId, offerId, builderId: userId })}
                  onAcceptOffer={(offerId) => emitAck("accept_offer", { projectId, offerId, clientId: userId })}
                />
          ) : null}

          {!showIntakeForm && canChat ? (
            <div className="flex flex-col gap-2 border-t border-border/60 -mx-3 px-3 py-3">
              {role === "BUILDER" && projectStatus === "ACTIVE" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={() => setSubmitOpen(true)} disabled={!canSubmitDemo}>
                    {nextDemoLabel}
                  </Button>
                  {nextDemoDeadline ? (
                    <span
                      className={`text-xs ${
                        nextDemoDeadline.overdue
                          ? "text-destructive font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {nextDemoDeadline.text}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <Input
                  className="flex-1 min-w-0"
                  value={draft}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
                  onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === "Enter") sendMessage();
                  }}
                  placeholder={isNegotiationParticipant ? "Discuss terms with the selected builder..." : "Type a message..."}
                />
                <Button className="shrink-0" onClick={sendMessage}>
                  Send
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
        {headerTermsOpen && headerTermsData ? (
          <div className="absolute inset-0 z-40 flex flex-col bg-background/80 backdrop-blur-[1px]">
            <div className="mt-12 flex min-h-0 flex-1 flex-col border-t bg-background shadow-lg">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">Offer &amp; Terms</h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {headerTermsData.builderName} · Agreed terms
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setHeaderTermsOpen(false)}
                  aria-label="Close terms"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
                <div className="flex items-center justify-between font-medium">
                  <span>Total</span>
                  <span>{fmtCents(headerTermsData.totalCents)}</span>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Milestones
                  </div>
                  <ul className="space-y-1">
                    {headerTermsData.milestones.map((m: any) => (
                      <li key={m.title} className="flex items-start justify-between gap-3 text-sm">
                        <span className="min-w-0">
                          <span className="font-medium">{m.title}</span>
                          {m.dueDate ? (
                            <span className="block text-xs text-muted-foreground">
                              Due {new Date(m.dueDate).toLocaleDateString()}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0">{fmtCents(m.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {(headerTermsData.longTermAmountCents != null ||
                  headerTermsData.longTermCadence ||
                  headerTermsData.longTermNotes) ? (
                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Long-term (informational)
                    </div>
                    <div className="text-sm">
                      {headerTermsData.longTermAmountCents != null
                        ? fmtCents(headerTermsData.longTermAmountCents)
                        : "—"}
                      {headerTermsData.longTermCadence && headerTermsData.longTermCadence !== "NONE"
                        ? ` · ${String(headerTermsData.longTermCadence).toLowerCase().replace("_", " ")}`
                        : ""}
                    </div>
                    {headerTermsData.longTermNotes ? (
                      <p className="text-sm text-muted-foreground">{headerTermsData.longTermNotes}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Card>
      {submitOpen && nextDemoMilestone?.id ? (
        <DemoSubmitDialog
          open={submitOpen}
          projectId={projectId}
          milestone={nextDemoMilestone}
          currentSubmission={currentDemoSubmission}
          onSubmit={async (payload) => {
            if (role !== "BUILDER" || projectStatus !== "ACTIVE") {
              return { ok: false, error: "Demo submission is not available right now" };
            }
            return emitAckAsync("submit_demo", {
              projectId,
              milestoneId: nextDemoMilestone.id,
              senderId: userId,
              bundle: payload.bundle,
              whatChanged: payload.whatChanged,
            });
          }}
          onClose={() => setSubmitOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default Chat;