import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PLATFORM_TARGET_LABELS, TARGET_MATRIX, type PlatformTarget } from "@/lib/deliverables";

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
  payload?: any | null;
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
  payload,
  milestone,
}: DemoWidgetProps) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [active, setActive] = useState(0);

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
    role === "CLIENT" && isCurrent && isDemoReviewMilestone && status === "IN_PROGRESS";
  const isChangesRequested = isCurrent && status === "CHANGES_REQUESTED";
  const isApproved = isCurrent && (status === "RELEASED" || status === "COMPLETED");
  const statusBadge = !isCurrent
    ? { label: "Previous submission", variant: "outline" as const }
    : isChangesRequested
      ? { label: "Changes requested", variant: "destructive" as const }
      : isApproved
        ? { label: "Approved", variant: "default" as const }
        : { label: "Awaiting review", variant: "secondary" as const };

  const slots: Array<{ target: PlatformTarget; deliverable: any }> = Array.isArray(
    payload?.bundle?.slots,
  )
    ? payload.bundle.slots
    : [];
  const whatChanged: string | undefined =
    typeof payload?.bundle?.whatChanged === "string"
      ? payload.bundle.whatChanged
      : typeof payload?.whatChanged === "string"
        ? payload.whatChanged
        : undefined;

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

  const current = slots[Math.min(active, Math.max(0, slots.length - 1))];
  const currentTarget = current?.target as PlatformTarget | undefined;
  const d = current?.deliverable ?? {};
  const pinned = currentTarget ? TARGET_MATRIX[currentTarget] : null;
  const primaryLabel =
    pinned?.kind === "WEB_LINK" ? "Open demo" : "Open / download";

  return (
    <Card className="w-full max-w-xl border-blue-300">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">Demo submission bundle</CardTitle>
            <p className="text-xs text-muted-foreground">
              {milestone?.title ?? milestoneId} · {slots.length} target{slots.length === 1 ? "" : "s"}
            </p>
          </div>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {slots.length > 1 ? (
          <div className="flex flex-wrap gap-1 border-b pb-2">
            {slots.map((s, i) => (
              <button
                key={String(s.target ?? i)}
                type="button"
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  i === active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                }`}
                onClick={() => setActive(i)}
              >
                {PLATFORM_TARGET_LABELS[s.target as PlatformTarget] ?? String(s.target)}
              </button>
            ))}
          </div>
        ) : null}

        {current && currentTarget ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{PLATFORM_TARGET_LABELS[currentTarget]}</Badge>
              {pinned?.kind ? <Badge variant="outline">{pinned.kind.replace("_", " ")}</Badge> : null}
              {pinned?.platform ? <Badge variant="outline">{pinned.platform}</Badge> : null}
              {pinned?.os ? <Badge variant="outline">{pinned.os}</Badge> : null}
            </div>

            {d.title ? <p className="font-medium">{String(d.title)}</p> : null}

            {d.accessUrl ? (
              <a
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                href={String(d.accessUrl)}
                target="_blank"
                rel="noreferrer"
              >
                {primaryLabel}
              </a>
            ) : (
              <p className="text-muted-foreground">Link not provided</p>
            )}

            <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
              {d.version ? <Badge variant="outline">v{String(d.version)}</Badge> : null}
            </div>

            {d.instructions ? (
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">How to review</p>
                <p className="whitespace-pre-line">{String(d.instructions)}</p>
              </div>
            ) : null}

            {d.credentials ? (
              <div className="space-y-0.5 rounded-md border border-amber-300/60 bg-amber-50 p-2 text-xs dark:bg-amber-950/20">
                <p className="font-medium">Access credentials</p>
                <p className="break-all whitespace-pre-line">{String(d.credentials)}</p>
              </div>
            ) : null}

            {d.summary ? <p className="text-xs text-muted-foreground">{String(d.summary)}</p> : null}

            {d.accessUrl ? (
              <p className="break-all text-xs text-muted-foreground">
                <span className="font-medium">Link:</span>{" "}
                <a className="text-primary underline" href={String(d.accessUrl)} target="_blank" rel="noreferrer">
                  {String(d.accessUrl)}
                </a>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground">No deliverables in this submission.</p>
        )}

        {whatChanged ? (
          <div className="space-y-0.5 border-t pt-2">
            <p className="text-xs font-medium text-muted-foreground">What changed (bundle)</p>
            <p className="whitespace-pre-line">{whatChanged}</p>
          </div>
        ) : null}

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
                placeholder="Reason for requesting changes (required, call out target(s))"
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
                Approve bundle
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
              <p className="text-muted-foreground">Please submit an updated bundle for this milestone.</p>
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