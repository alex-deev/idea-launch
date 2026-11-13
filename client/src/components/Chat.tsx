import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { io, type Socket } from "socket.io-client";

import { ArrowDown, MoreVertical, X } from "lucide-react";
import { sumMilestoneAmounts } from "@/lib/milestones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DemoWidget } from "@/components/DemoWidget";
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
  demoUrl?: string | null;
}

interface ScopePayload {
  title?: string;
  executiveSummary?: string;
  technicalArchitecture?: string;
  coreFeatures?: string[];
  milestones?: { title: string; amount: number; releasePercent?: number }[];
  outOfScope?: string[];
  budgetCents?: number;
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

    socket.on("milestone_updated", (data: { milestone?: { id?: string; title?: string } }) => {
      const milestone = data?.milestone;
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          projectId,
          type: "SYSTEM",
          content: `Milestone ${milestone?.title ?? milestone?.id ?? ""} updated`,
          senderId: null,
        },
      ]);
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

  const latestScopePayload = [...messages]
    .reverse()
    .find((message) => message.type === "SCOPE_WIDGET")
    ?.payload as ScopePayload | undefined;

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

  const emitAck = (event: string, payload: any) => {
    setActionError(null);
    socketRef.current?.emit(event, payload, (res: any) => {
      if (res && res.ok === false && res.error) {
        setActionError(String(res.error));
      }
    });
  };

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

  const submitDemo = () => {
    if (role !== "BUILDER" || projectStatus !== "ACTIVE" || !socketRef.current) return;
    if (!nextDemoMilestone?.id) return;
    emitAck("submit_demo", {
      projectId,
      milestoneId: nextDemoMilestone.id,
      senderId: userId,
      demoUrl: `https://demo.example.com/${nextDemoMilestone.id}`,
    });
  };

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 rounded-xl border border-border/60">
      <Card size="sm" className="flex min-h-0 flex-1 flex-col gap-0 overflow-visible ring-0 py-0">
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
        <CardContent className="flex flex-1 flex-col gap-0 overflow-hidden">
          {showIntakeForm ? (
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-4">
              <ScopeIntakeForm
                projectId={projectId}
                userId={userId}
                socket={socketRef.current}
                projectTotal={project?.totalEscrow ?? 0}
              />
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
                          demoUrl={payload.demoUrl}
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

                {!showIntakeForm ? (
                  <>
                    {actionError ? <p className="pt-2 text-sm text-red-600">{actionError}</p> : null}
                    <OffersPanel
                      role={role}
                      userId={userId}
                      projectId={projectId}
                      projectStatus={projectStatus}
                      selectedOfferId={selectedOfferId}
                      offers={offers}
                      probationary={probationary}
                      builderAtCapacity={builderAtCapacity}
                      defaultTotalCents={scopeTotalCents || project?.totalEscrow || 100000}
                      onSubmitOffer={(terms) => emitAck("submit_offer", { projectId, builderId: userId, ...terms })}
                      onReviseOffer={(terms) => emitAck("revise_offer", { projectId, builderId: userId, ...terms })}
                      onWithdrawOffer={() => emitAck("withdraw_offer", { projectId, builderId: userId })}
                      onSelectOffer={(offerId) => emitAck("select_offer", { projectId, offerId, clientId: userId })}
                      onCancelNegotiation={() => emitAck("cancel_negotiation", { projectId, clientId: userId })}
                      onUpdateOfferTerms={(offerId, terms) => emitAck("update_offer_terms", { projectId, offerId, actorId: userId, ...terms })}
                      onMarkOfferFinal={(offerId) => emitAck("mark_offer_final", { projectId, offerId, builderId: userId })}
                      onAcceptOffer={(offerId) => emitAck("accept_offer", { projectId, offerId, clientId: userId })}
                    />
                  </>
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

          {!showIntakeForm && canChat ? (
            <div className="flex flex-wrap items-end gap-2 border-t border-border/60 -mx-3 px-3 py-3">
              {role === "BUILDER" && projectStatus === "ACTIVE" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={submitDemo} disabled={!nextDemoMilestone?.id}>
                    Submit Next Demo
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
              <Input
                value={draft}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "Enter") sendMessage();
                }}
                placeholder={isNegotiationParticipant ? "Discuss terms with the selected builder..." : "Type a message..."}
              />
              <Button onClick={sendMessage}>Send</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default Chat;