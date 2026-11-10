import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { io, type Socket } from "socket.io-client";

import { ArrowDown, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DemoWidget } from "@/components/DemoWidget";
import { OfferWidget } from "@/components/OfferWidget";
import { ProjectControls } from "@/components/ProjectControls";
import { ScopeIntakeForm } from "@/components/ScopeIntakeForm";
import { ScopeWidget } from "@/components/ScopeWidget";
import { SOCKET_URL } from "@/lib/api";


const OFFER_MILESTONES = [
  { title: "Agreement", amount: 25000 },
  { title: "Initial Demo", amount: 25000 },
  { title: "Final Demo", amount: 25000 },
  { title: "Deployment", amount: 25000 },
];

const MILESTONE_IDS = ["milestone-1", "milestone-2", "milestone-3", "milestone-4"];

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

interface OfferPayload {
  milestones?: { title: string; amount: number }[];
  total?: number;
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
  milestones?: { title: string; amount: number }[];
  outOfScope?: string[];
}

interface ChatProps {
  userId: string;
  role: string;
  name: string;
  probationary?: boolean;
  projectId?: string;
  onProjectStatusChange?: (projectId: string, status: string) => void;
}

export function Chat({
  userId,
  role,
  name,
  probationary = false,
  projectId = "project-123",
  onProjectStatusChange,
}: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [projectStatus, setProjectStatus] = useState("SCOPING");
  const [project, setProject] = useState<any>(null);
  const [nextMilestoneIndex, setNextMilestoneIndex] = useState(0);
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

    socket.emit("join_project", { projectId: projectId, userId });

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
        if (data.project.status) {
          setProjectStatus(data.project.status);
          onProjectStatusChange?.(projectId, data.project.status);
        }
      }
    });

    socket.on("milestone_updated", (data: { milestone?: { id?: string; title?: string } }) => {
      const milestone = data?.milestone;
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          projectId: projectId,
          type: "SYSTEM",
          content: `Milestone ${milestone?.title ?? milestone?.id ?? ""} Approved - Escrow Released`,
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
  }, [messages]);

  const sendMessage = () => {
    const content = draft.trim();
    if (!content || !socketRef.current) return;

    socketRef.current.emit("send_message", {
      projectId: projectId,
      senderId: userId,
      type: "TEXT",
      content,
    });
    setDraft("");
  };

  const submitDemo = () => {
    if (role !== "BUILDER" || projectStatus !== "ACTIVE" || !socketRef.current) return;
    if (nextMilestoneIndex >= MILESTONE_IDS.length) return;

    const milestoneId = MILESTONE_IDS[nextMilestoneIndex];
    socketRef.current.emit("submit_demo", {
      projectId: projectId,
      milestoneId,
      senderId: userId,
      demoUrl: `https://demo.example.com/${milestoneId}`,
    });
    setNextMilestoneIndex((index) => Math.min(index + 1, MILESTONE_IDS.length));
  };

  const generateFinalOffer = () => {
    if (projectStatus === "ACTIVE" || !socketRef.current) return;

    socketRef.current.emit("send_message", {
      projectId: projectId,
      senderId: userId,
      type: "WIDGET",
      content: "Final Offer",
      payload: {
        milestones: OFFER_MILESTONES,
        total: OFFER_MILESTONES.reduce((sum, item) => sum + item.amount, 0),
      },
    });
  };

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 rounded-xl border border-border/60">
      <Card size="sm" className="flex min-h-0 flex-1 flex-col gap-0 ring-0 py-0">
      <CardHeader className="shrink-0 !flex items-center justify-between border-b border-border/60 pt-2">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle className="truncate">
              {project?.title ?? `Project ${projectId}`} (
              {role === "CLIENT"
                ? (project?.builder?.name ?? "Builder")
                : (project?.client?.name ?? "Client")}
              )
            </CardTitle>
            {projectStatus === "ACTIVE" ? (
              <Badge variant="secondary" className="shrink-0">
                Funded
              </Badge>
            ) : null}
          </div>
          <div className="relative" ref={controlsRef}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setControlsOpen((open) => !open)}
              aria-label="Project controls"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            {controlsOpen ? (
              <div className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)]">
                <ProjectControls
                  socket={socketRef.current}
                  project={project}
                  role={role}
                  userId={userId}
                />
              </div>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-0 overflow-hidden">
        {showIntakeForm ? (
          <div className="flex flex-1 items-center justify-center">
            <ScopeIntakeForm
              projectId={projectId}
              userId={userId}
              socket={socketRef.current}
              projectTotal={project?.totalEscrow ?? 0}
            />
          </div>
        ) : (
          <div className="relative min-h-0 flex-1">
            <div
              ref={messagesContainerRef}
              className="absolute inset-0 space-y-3 overflow-y-auto rounded-md p-3"
            >
            {messages.length === 0 ? null : (
              messages.map((message) => {
              const isOwnMessage = message.senderId === userId;

              if (message.type === "WIDGET") {
                const payload = (message.payload ?? {}) as OfferPayload;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <OfferWidget
                      socket={socketRef.current}
                      projectId={projectId}
                      role={role}
                      projectStatus={projectStatus}
                      milestones={payload.milestones}
                      total={payload.total}
                    />
                  </div>
                );
              }

              if (message.type === "DEMO_WIDGET") {
                const payload = (message.payload ?? {}) as DemoPayload;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <DemoWidget
                      socket={socketRef.current}
                      milestoneId={payload.milestoneId ?? "milestone-1"}
                      demoUrl={payload.demoUrl}
                      role={role}
                    />
                  </div>
                );
              }

              if (message.type === "SCOPE_WIDGET") {
                const payload = (message.payload ?? {}) as ScopePayload;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <ScopeWidget
                      socket={socketRef.current}
                      projectId={projectId}
                      role={role}
                      payload={payload}
                      messageId={message.id}
                      editable={projectStatus === "SCOPING"}
                    />
                  </div>
                );
              }

              if (message.type === "SYSTEM") {
                return (
                  <div key={message.id} className="text-center text-sm font-medium text-green-600">
                    {message.content}
                  </div>
                );
              }


              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 text-sm ${
                      isOwnMessage
                        ? "rounded-tl-2xl rounded-tr-2xl rounded-br-sm rounded-bl-2xl bg-primary text-primary-foreground"
                        : "rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl bg-muted text-foreground"
                    }`}
                  >
                    <span className="font-medium">
                      {isOwnMessage
                        ? "You"
                        : (message.sender?.name ?? message.senderId ?? "Unknown")}
                      :
                    </span>{" "}
                    {message.content}
                  </div>
                </div>
              );
            })
            )}
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
        {!showIntakeForm && projectStatus !== "SCOPING" ? (
        <div className="flex gap-2 border-t border-border/60 -mx-3 px-3 py-3">
          {role === "BUILDER" && projectStatus !== "ACTIVE" ? (
            <Button
              variant="outline"
              onClick={generateFinalOffer}
              disabled={probationary && (project?.totalEscrow ?? 0) > 150000}
              title={
                probationary && (project?.totalEscrow ?? 0) > 150000
                  ? "Budget exceeds $1,500 cap for probationary builders"
                  : undefined
              }
            >
              Generate Final Offer
            </Button>
          ) : null}
          {role === "BUILDER" && projectStatus === "ACTIVE" ? (
            <Button
              variant="outline"
              onClick={submitDemo}
              disabled={nextMilestoneIndex >= MILESTONE_IDS.length}
            >
              Submit Next Demo
            </Button>
          ) : null}
          <Input
            value={draft}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setDraft(event.target.value)
            }
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter") sendMessage();
            }}
            placeholder="Type a message..."
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
