import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface MilestoneLike {
  id?: string;
  title?: string;
  status?: string;
  revisionRequestedAt?: string | null;
  revisionReason?: string | null;
  currentDemoMessageId?: string | null;
}

interface DemoWidgetProps {
  socket: Socket | null;
  projectId: string;
  userId: string;
  role: string;
  messageId: string;
  milestoneId: string;
  demoUrl?: string | null;
  milestone?: MilestoneLike | null;
}

function formatRemaining(targetMs: number, nowMs: number) {
  const diffMs = targetMs - nowMs;
  const abs = Math.abs(diffMs);
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const days = Math.floor(abs / dayMs);
  const hours = Math.floor((abs % dayMs) / hourMs);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days === 0) parts.push(`${hours}h`);
  const span = parts.join(" ") || "<1h";
  if (diffMs < 0) return { text: `overdue by ${span}`, overdue: true };
  if (abs < hourMs) return { text: "due in <1h", overdue: false };
  return { text: `due in ${span}`, overdue: false };
}

export function DemoWidget({
  socket,
  projectId,
  userId,
  role,
  messageId,
  milestoneId,
  demoUrl,
  milestone,
}: DemoWidgetProps) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const isCurrent =
    !!milestone?.currentDemoMessageId && milestone.currentDemoMessageId === messageId;
  const status = milestone?.status ?? "IN_PROGRESS";
  const isDemoReviewMilestone =
    milestone?.title === "Initial Demo" || milestone?.title === "Final Demo";
  const canReview =
    role === "CLIENT" &&
    isCurrent &&
    isDemoReviewMilestone &&
    status === "IN_PROGRESS";
  const isChangesRequested = isCurrent && status === "CHANGES_REQUESTED";

  const revisionTarget = milestone?.revisionRequestedAt
    ? new Date(milestone.revisionRequestedAt).getTime() + 24 * 60 * 60 * 1000
    : null;
  const revisionTiming =
    revisionTarget && Number.isFinite(revisionTarget)
      ? formatRemaining(revisionTarget, nowTick)
      : null;

  const handleApprove = () => {
    socket?.emit("approve_milestone", { milestoneId, userId });
  };

  const handleReject = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    socket?.emit(
      "reject_demo",
      { projectId, milestoneId, reason: trimmed, userId },
      (res: any) => {
        if (!res || res.ok !== false) {
          setRejecting(false);
          setReason("");
        }
      },
    );
  };

  return (
    <Card className="w-full max-w-md border-blue-300">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Demo Submission</CardTitle>
          {isCurrent ? (
            <Badge variant={isChangesRequested ? "destructive" : "secondary"}>
              {isChangesRequested ? "Changes requested" : "Awaiting review"}
            </Badge>
          ) : (
            <Badge variant="outline">Previous submission</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <span className="font-medium">Milestone:</span>{" "}
          {milestone?.title ?? milestoneId}
        </p>
        <p className="break-all">
          <span className="font-medium">Demo:</span>{" "}
          {demoUrl ? (
            <a className="text-primary underline" href={demoUrl} target="_blank" rel="noreferrer">
              {demoUrl}
            </a>
          ) : (
            "Demo link not provided"
          )}
        </p>

        {isChangesRequested ? (
          <div className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2">
            <p className="font-medium text-destructive">Changes requested</p>
            {milestone?.revisionReason ? <p>{milestone.revisionReason}</p> : null}
            {revisionTiming ? (
              <p className={revisionTiming.overdue ? "text-destructive" : "text-muted-foreground"}>
                Update requested — {revisionTiming.text} (soft 24h target)
              </p>
            ) : null}
          </div>
        ) : null}

        {canReview ? (
          rejecting ? (
            <div className="space-y-2">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for requesting changes (required)"
              />
              <div className="flex gap-2">
                <Button className="flex-1" variant="destructive" onClick={handleReject} disabled={!reason.trim()}>
                  Submit rejection
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => {
                    setRejecting(false);
                    setReason("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleApprove}>
                Approve
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => setRejecting(true)}>
                Request changes
              </Button>
            </div>
          )
        ) : isCurrent ? (
          status === "RELEASED" || status === "COMPLETED" ? (
            <p className="text-green-700">Approved and released.</p>
          ) : isChangesRequested ? (
            role === "BUILDER" ? (
              <p className="text-muted-foreground">Please submit an updated demo for this milestone.</p>
            ) : (
              <p className="text-muted-foreground">Awaiting builder update.</p>
            )
          ) : (
            <p className="text-muted-foreground">
              {role === "CLIENT" ? "Awaiting review actions." : "Awaiting client review."}
            </p>
          )
        ) : (
          <p className="text-muted-foreground">Superseded by a newer submission.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default DemoWidget;