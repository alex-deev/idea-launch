import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DELIVERABLE_KIND_LABELS,
  OS_LABELS,
  PLATFORM_LABELS,
  type DeliverableKind,
  type DeliverableOs,
  type DeliverablePlatform,
} from "@/lib/deliverables";

interface MilestoneLike {
  id?: string;
  title?: string;
  status?: string;
  revisionRequestedAt?: string | null;
  revisionReason?: string | null;
  currentDemoMessageId?: string | null;
}

interface DemoDeliverableLike {
  kind?: string;
  title?: string;
  accessUrl?: string;
  instructions?: string;
  version?: string;
  platform?: string;
  os?: string;
  credentials?: string;
  label?: string;
  summary?: string;
  whatChanged?: string;
}

interface DemoWidgetProps {
  socket: Socket | null;
  projectId: string;
  userId: string;
  role: string;
  messageId: string;
  milestoneId: string;
  demoUrl?: string | null;
  payload?: {
    deliverable?: DemoDeliverableLike | null;
    accessUrl?: string | null;
    demoUrl?: string | null;
    resubmission?: boolean;
    latePenalty?: number;
  } | null;
  milestone?: MilestoneLike | null;
}

const PRIMARY_LINK_LABELS: Record<DeliverableKind, string> = {
  WEB_LINK: "Open demo",
  MOBILE_BUILD: "Download build",
  DESKTOP_BUILD: "Download build",
  SOURCE_PACKAGE: "Open package",
  DOCUMENT: "Open document",
  OTHER: "Open deliverable",
};

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

function labelFor(kind?: string | null) {
  return DELIVERABLE_KIND_LABELS[kind as DeliverableKind] ?? "Deliverable";
}

export function DemoWidget({
  socket,
  projectId,
  userId,
  role,
  messageId,
  milestoneId,
  demoUrl,
  payload,
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
  const isApproved =
    isCurrent && (status === "RELEASED" || status === "COMPLETED");
  const statusBadge = !isCurrent
    ? { label: "Previous submission", variant: "outline" as const }
    : isChangesRequested
      ? { label: "Changes requested", variant: "destructive" as const }
      : isApproved
        ? { label: "Approved", variant: "default" as const }
        : { label: "Awaiting review", variant: "secondary" as const };

  const deliverable = payload?.deliverable ?? null;
  const kind = (deliverable?.kind as DeliverableKind | undefined) ?? null;
  const primaryUrl = deliverable?.accessUrl ?? payload?.accessUrl ?? demoUrl ?? null;
  const primaryLabel = kind ? PRIMARY_LINK_LABELS[kind] ?? "Open deliverable" : "Open demo link";

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
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">
              {deliverable?.title || "Demo Submission"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {labelFor(kind)} · {milestone?.title ?? milestoneId}
            </p>
          </div>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {primaryUrl ? (
          <a
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            href={primaryUrl}
            target="_blank"
            rel="noreferrer"
          >
            {primaryLabel}
          </a>
        ) : (
          <p className="text-muted-foreground">Demo link not provided</p>
        )}

        {deliverable?.version || deliverable?.platform || deliverable?.os ? (
          <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
            {deliverable?.version ? <Badge variant="outline">v{deliverable.version}</Badge> : null}
            {deliverable?.platform ? (
              <Badge variant="outline">
                {PLATFORM_LABELS[deliverable.platform as DeliverablePlatform] ?? deliverable.platform}
              </Badge>
            ) : null}
            {deliverable?.os ? (
              <Badge variant="outline">
                {OS_LABELS[deliverable.os as DeliverableOs] ?? deliverable.os}
              </Badge>
            ) : null}
          </div>
        ) : null}

        {deliverable?.label ? (
          <p>
            <span className="font-medium">Deliverable:</span> {deliverable.label}
          </p>
        ) : null}

        {deliverable?.instructions ? (
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">How to review</p>
            <p className="whitespace-pre-line">{deliverable.instructions}</p>
          </div>
        ) : null}

        {deliverable?.credentials ? (
          <div className="space-y-0.5 rounded-md border border-amber-300/60 bg-amber-50 p-2 text-xs dark:bg-amber-950/20">
            <p className="font-medium">Access credentials</p>
            <p className="break-all whitespace-pre-line">{deliverable.credentials}</p>
          </div>
        ) : null}

        {deliverable?.summary ? (
          <p className="text-xs text-muted-foreground">{deliverable.summary}</p>
        ) : null}

        {deliverable?.whatChanged ? (
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">What changed</p>
            <p className="whitespace-pre-line">{deliverable.whatChanged}</p>
          </div>
        ) : null}

        <p className="break-all text-xs text-muted-foreground">
          <span className="font-medium">Link:</span>{" "}
          {primaryUrl ? (
            <a className="text-primary underline" href={primaryUrl} target="_blank" rel="noreferrer">
              {primaryUrl}
            </a>
          ) : (
            "—"
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
          isApproved ? (
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
