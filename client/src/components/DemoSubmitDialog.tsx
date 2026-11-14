import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PLATFORM_TARGET_LABELS,
  TARGET_DESCRIPTIONS,
  TARGET_MATRIX,
  type BundleDraft,
  type BundleSpec,
  type BundleSubmissionPayload,
  type SlotDraft,
  parseBundleSpec,
  toBundleSubmissionPayload,
  validateBundleDraft,
} from "@/lib/deliverables";

interface DemoSubmitDialogProps {
  open: boolean;
  projectId: string;
  milestone: {
    id: string;
    title?: string;
    status?: string;
    revisionReason?: string | null;
    revisionRequestedAt?: string | null;
    currentDemoMessageId?: string | null;
    demoUrl?: string | null;
    deliverableSpec?: unknown;
  };
  currentSubmission?: any | null;
  onSubmit: (payload: BundleSubmissionPayload) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}

const textareaClass =
  "min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function formatSpan(diffMs: number) {
  const abs = Math.abs(diffMs);
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const days = Math.floor(abs / dayMs);
  const hours = Math.floor((abs % dayMs) / hourMs);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days === 0) parts.push(`${hours}h`);
  return parts.join(" ") || "<1h";
}

function prefillDraft(spec: BundleSpec, milestoneTitle: string, currentSubmission: any): BundleDraft {
  const existingSlots: any[] = Array.isArray(currentSubmission?.bundle?.slots)
    ? currentSubmission.bundle.slots
    : [];
  const slots: SlotDraft[] = spec.targets.map((target, i) => {
    const found =
      existingSlots.find((s) => s?.target === target) ?? existingSlots[i] ?? null;
    const d = found?.deliverable ?? found ?? {};
    return {
      target,
      title: typeof d.title === "string" && d.title ? d.title : `${milestoneTitle} — ${PLATFORM_TARGET_LABELS[target]}`,
      accessUrl: typeof d.accessUrl === "string" ? d.accessUrl : "",
      instructions: typeof d.instructions === "string" ? d.instructions : "",
      version: typeof d.version === "string" ? d.version : "",
      credentials: typeof d.credentials === "string" ? d.credentials : "",
      summary: typeof d.summary === "string" ? d.summary : "",
    };
  });
  return { slots, whatChanged: "" };
}

export function DemoSubmitDialog({
  open,
  projectId,
  milestone,
  currentSubmission,
  onSubmit,
  onClose,
}: DemoSubmitDialogProps) {
  const spec = useMemo(() => parseBundleSpec(milestone.deliverableSpec), [milestone.deliverableSpec]);
  const isResubmission =
    milestone.status === "CHANGES_REQUESTED" || !!milestone.currentDemoMessageId;
  const milestoneTitle = milestone.title ?? "Milestone";

  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now] = useState(() => Date.now());
  const [draft, setDraft] = useState<BundleDraft>(() =>
    spec ? prefillDraft(spec, milestoneTitle, currentSubmission) : { slots: [], whatChanged: "" },
  );

  if (!open || !spec) return null;

  const revisionTiming = (() => {
    if (!milestone.revisionRequestedAt) return null;
    const target = new Date(milestone.revisionRequestedAt).getTime() + 24 * 60 * 60 * 1000;
    if (!Number.isFinite(target)) return null;
    const diffMs = target - now;
    return diffMs < 0 ? `overdue by ${formatSpan(diffMs)}` : `due in ${formatSpan(diffMs)}`;
  })();

  const setSlot = (index: number, patch: Partial<SlotDraft>) => {
    setDraft((prev) => {
      const slots = [...prev.slots];
      slots[index] = { ...slots[index], ...patch };
      return { ...prev, slots };
    });
  };

  const handleSubmit = async () => {
    const message = validateBundleDraft(spec, draft, { resubmission: isResubmission });
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = toBundleSubmissionPayload(draft);
      const result = await onSubmit(payload);
      if (!result.ok) {
        setError(result.error || "Submission failed");
        return;
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const currentSlot = draft.slots[active];
  const currentTarget = spec.targets[active];
  const pinned = currentTarget ? TARGET_MATRIX[currentTarget] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Submit ${milestoneTitle}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <CardHeader className="sticky top-0 z-10 flex-row items-center justify-between gap-2 bg-card pb-2">
          <CardTitle className="text-base">
            {isResubmission ? "Resubmit" : "Submit"} {milestoneTitle}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close submission form">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/30 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Agreed contract</Badge>
              <span className="text-xs text-muted-foreground">
                Submit a deliverable for each required target (targets are locked by the offer).
              </span>
            </div>
          </div>

          {milestone.status === "CHANGES_REQUESTED" ? (
            <div className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2">
              <p className="font-medium text-destructive">Changes requested</p>
              {milestone.revisionReason ? <p>{milestone.revisionReason}</p> : null}
              {revisionTiming ? (
                <p className="text-xs text-muted-foreground">Update target: {revisionTiming} (soft 24h)</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Call out which target(s) you addressed and how to verify each fix.
              </p>
            </div>
          ) : null}

          {spec.targets.length > 1 ? (
            <div className="flex flex-wrap gap-1 border-b pb-2">
              {spec.targets.map((target, i) => (
                <button
                  key={target}
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    i === active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => setActive(i)}
                >
                  {PLATFORM_TARGET_LABELS[target]}
                </button>
              ))}
            </div>
          ) : null}

          {currentSlot && currentTarget ? (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{PLATFORM_TARGET_LABELS[currentTarget]}</p>
                  <p className="text-xs text-muted-foreground">{TARGET_DESCRIPTIONS[currentTarget]}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">{pinned?.kind === "WEB_LINK" ? "Web link" : pinned?.kind === "MOBILE_BUILD" ? "Mobile build" : "Desktop build"}</Badge>
                  {pinned?.platform ? <Badge variant="outline">{pinned.platform}</Badge> : null}
                  {pinned?.os ? <Badge variant="outline">{pinned.os}</Badge> : null}
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Submission title *</span>
                <Input
                  value={currentSlot.title}
                  onChange={(e) => setSlot(active, { title: e.target.value })}
                  placeholder={`${PLATFORM_TARGET_LABELS[currentTarget]} submission`}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Access / download link *</span>
                <Input
                  value={currentSlot.accessUrl}
                  onChange={(e) => setSlot(active, { accessUrl: e.target.value })}
                  placeholder="https://…"
                  inputMode="url"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Access / install / review instructions *</span>
                <textarea
                  className={textareaClass}
                  value={currentSlot.instructions}
                  onChange={(e) => setSlot(active, { instructions: e.target.value })}
                  placeholder="How to access, install, or review this deliverable…"
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Version / build (optional)</span>
                  <Input
                    value={currentSlot.version}
                    onChange={(e) => setSlot(active, { version: e.target.value })}
                    placeholder="e.g. 0.3.1"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Credentials (optional)</span>
                  <Input
                    value={currentSlot.credentials}
                    onChange={(e) => setSlot(active, { credentials: e.target.value })}
                    placeholder="Only if access is gated"
                  />
                </label>
              </div>
              {currentSlot.credentials.trim() ? (
                <p className="text-xs text-amber-600">
                  Credentials are visible to everyone in this project chat. Avoid reusable personal passwords.
                </p>
              ) : null}

              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Summary (optional)</span>
                <textarea
                  className={textareaClass}
                  value={currentSlot.summary}
                  onChange={(e) => setSlot(active, { summary: e.target.value })}
                  placeholder="What should the client focus on for this target?"
                />
              </label>
            </div>
          ) : null}

          {isResubmission ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">What changed / how to verify (bundle) *</span>
              <textarea
                className={textareaClass}
                value={draft.whatChanged}
                onChange={(e) => setDraft((prev) => ({ ...prev, whatChanged: e.target.value }))}
                placeholder="Describe what changed per target and how the client can verify each fix…"
              />
            </label>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : isResubmission ? "Resubmit bundle" : "Submit bundle"}
            </Button>
            <Button className="flex-1" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Project: {projectId}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default DemoSubmitDialog;