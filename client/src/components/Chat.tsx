import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { io, type Socket } from "socket.io-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DemoWidget } from "@/components/DemoWidget";
import { OfferWidget } from "@/components/OfferWidget";
import { ProjectControls } from "@/components/ProjectControls";
import { ScopeWidget } from "@/components/ScopeWidget";
import { SOCKET_URL } from "@/lib/api";

const PROJECT_ID = "project-123";

const OFFER_MILESTONES = [
  { title: "Agreement", amount: 25000 },
  { title: "Initial Demo", amount: 25000 },
  { title: "Final Demo", amount: 25000 },
  { title: "Deployment", amount: 25000 },
];

const MILESTONE_IDS = ["milestone-1", "milestone-2", "milestone-3", "milestone-4"];

const DEMO_IDEA =
  "A two-sided marketplace where clients describe a software idea, receive an AI-generated scope blueprint, and fund milestone-based escrow for vetted builders.";

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
}

export function Chat({ userId, role, name, probationary = false }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [projectStatus, setProjectStatus] = useState("SCOPING");
  const [project, setProject] = useState<any>(null);
  const [nextMilestoneIndex, setNextMilestoneIndex] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { userId, role, name },
    });
    socketRef.current = socket;

    socket.emit("join_project", { projectId: PROJECT_ID, userId });

    socket.on("new_message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("project_updated", (data: { project?: any }) => {
      if (data?.project) {
        setProject(data.project);
        if (data.project.status) setProjectStatus(data.project.status);
      }
    });

    socket.on("milestone_updated", (data: { milestone?: { id?: string; title?: string } }) => {
      const milestone = data?.milestone;
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          projectId: PROJECT_ID,
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
  }, [userId, role, name]);

  const sendMessage = () => {
    const content = draft.trim();
    if (!content || !socketRef.current) return;

    socketRef.current.emit("send_message", {
      projectId: PROJECT_ID,
      senderId: userId,
      type: "TEXT",
      content,
    });
    setDraft("");
  };

  const simulateScope = () => {
    if (role !== "CLIENT" || !socketRef.current) return;
    socketRef.current.emit("send_message", {
      projectId: PROJECT_ID,
      senderId: userId,
      type: "TEXT",
      content: `[TRIGGER_SCOPE_GENERATION] ${DEMO_IDEA}`,
    });
  };

  const submitDemo = () => {
    if (role !== "BUILDER" || projectStatus !== "ACTIVE" || !socketRef.current) return;
    if (nextMilestoneIndex >= MILESTONE_IDS.length) return;

    const milestoneId = MILESTONE_IDS[nextMilestoneIndex];
    socketRef.current.emit("submit_demo", {
      projectId: PROJECT_ID,
      milestoneId,
      senderId: userId,
      demoUrl: `https://demo.example.com/${milestoneId}`,
    });
    setNextMilestoneIndex((index) => Math.min(index + 1, MILESTONE_IDS.length));
  };

  const generateFinalOffer = () => {
    if (projectStatus === "ACTIVE" || !socketRef.current) return;

    socketRef.current.emit("send_message", {
      projectId: PROJECT_ID,
      senderId: userId,
      type: "WIDGET",
      content: "Final Offer",
      payload: {
        milestones: OFFER_MILESTONES,
        total: OFFER_MILESTONES.reduce((sum, item) => sum + item.amount, 0),
      },
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Card className="flex h-[600px] w-full flex-col">
      <CardHeader>
        <CardTitle>
          Project Chat — {PROJECT_ID} ({name})
        </CardTitle>
        {projectStatus === "ACTIVE" ? (
          <p className="text-sm font-medium text-green-600">Project Funded</p>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto rounded-md border p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((message) => {
              if (message.type === "WIDGET") {
                const payload = (message.payload ?? {}) as OfferPayload;
                return (
                  <OfferWidget
                    key={message.id}
                    socket={socketRef.current}
                    projectId={PROJECT_ID}
                    role={role}
                    projectStatus={projectStatus}
                    milestones={payload.milestones}
                    total={payload.total}
                  />
                );
              }

              if (message.type === "DEMO_WIDGET") {
                const payload = (message.payload ?? {}) as DemoPayload;
                return (
                  <DemoWidget
                    key={message.id}
                    socket={socketRef.current}
                    milestoneId={payload.milestoneId ?? "milestone-1"}
                    demoUrl={payload.demoUrl}
                    role={role}
                  />
                );
              }

              if (message.type === "SCOPE_WIDGET") {
                const payload = (message.payload ?? {}) as ScopePayload;
                return (
                  <ScopeWidget
                    key={message.id}
                    socket={socketRef.current}
                    projectId={PROJECT_ID}
                    role={role}
                    payload={payload}
                  />
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
                <div key={message.id} className="rounded-md bg-muted/50 p-2 text-sm">
                  <span className="font-medium">
                    {message.sender?.name ?? message.senderId ?? "Unknown"}:
                  </span>{" "}
                  {message.content}
                </div>
              );
            })
          )}
        </div>
        <div className="flex gap-2">
          {role === "CLIENT" ? (
            <Button variant="outline" onClick={simulateScope}>
              Generate AI Scope
            </Button>
          ) : null}
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
      </CardContent>
    </Card>
    <ProjectControls
      socket={socketRef.current}
      project={project}
      role={role}
      userId={userId}
    />
    </div>
  );
}

export default Chat;
