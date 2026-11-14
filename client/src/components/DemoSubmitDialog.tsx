import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DELIVERABLE_FIELD_LABELS,
  DELIVERABLE_KIND_HINTS,
  DELIVERABLE_KIND_LABELS,
  OS_LABELS,
  PLATFORM_LABELS,
  type DeliverableDraft,
  type DeliverableSpec,
  requiredFieldsForSpec,
  toDeliverablePayload,
  validateDeliverableDraft,
} from "@/lib/deliverables";

export interface DemoSubmissionDeliverable {
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

export interface DemoSubmissionPayload {
  milestoneId?: string;
  deliverable?: DemoSubmissionDeliverable | null;
  demoUrl?: string | null;
}

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
    deliverableSpec?: DeliverableSpec | null;
  };
  currentSubmission?: DemoSubmissionPayload | null;
  onSubmit: (deliverable: ReturnType<typeof toDeliverablePayload>) => Promise<{
    ok: boolean;
    error?: string;
  }>;
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

export function DemoSubmitDialog({
  open,
  projectId,
  milestone,
  currentSubmission,
  onSubmit,
  onClose,
}: DemoSubmitDialogProps) {
  const spec = milestone.deliverableSpec ?? null;
  const kind = spec?.kind ?? "WEB_LINK";
  const existing = currentSubmission?.deliverable ?? null;
  const isResubmission =
    milestone.status === "CHANGES_REQUESTED" || !!milestone.currentDemoMessageId;

  const initialAccessUrl =
    existing?.accessUrl ?? currentSubmission?.demoUrl ?? milestone.demoUrl ?? "";

  const [draft, setDraft] = useState<DeliverableDraft>(() => ({
    kind,
    title: existing?.title ?? `${milestone.title ?? "Milestone"} submission`,
    accessUrl: initialAccessUrl,
    instructions: existing?.instructions ?? "",
    version: existing?.version ?? "",
    platform: (existing?.platform as DeliverableDraft["platform"]) ?? "",
    os: (existing?.os as DeliverableDraft["os"]) ?? "",
    credentials: existing?.credentials ?? "",
    label: existing?.label ?? spec?.label ?? "",
    summary: existing?.summary ?? "",
    whatChanged: "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now] = useState(() => Date.now());

  const required = useMemo(() => new Set(requiredFieldsForSpec({ ...spec, kind })), [spec, kind]);

  if (!open) return null;

  const set = <K extends keyof DeliverableDraft>(key: K, value: DeliverableDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const revisionTiming = (() => {
    if (!milestone.revisionRequestedAt) return null;
    const target = new Date(milestone.revisionRequestedAt).getTime() + 24 * 60 * 60 * 1000;
    if (!Number.isFinite(target)) return null;
    const diffMs = target - now;
    return diffMs < 0 ? `overdue by ${formatSpan(diffMs)}` : `due in ${formatSpan(diffMs)}`;
  })();

  const handleSubmit = async () => {
    const message = validateDeliverableDraft(spec, draft, { resubmission: isResubmission });
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await onSubmit(toDeliverablePayload(draft));
      if (!result.ok) {
        setError(result.error || "Submission failed");
        return;
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const fieldLabel = (field: keyof typeof DELIVERABLE_FIELD_LABELS) => {
    const label = DELIVERABLE_FIELD_LABELS[field];
    return required.has(field) ? `${label} *` : label;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Submit ${milestone.title ?? "milestone"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <CardHeader className="sticky top-0 z-10 flex-row items-center justify-between gap-2 bg-card pb-2">
          <CardTitle className="text-base">
            {isResubmission ? "Resubmit" : "Submit"} {milestone.title ?? "milestone"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close submission form">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/30 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{DELIVERABLE_KIND_LABELS[kind]}</Badge>
              <span className="text-xs text-muted-foreground">Agreed in the offer terms</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{DELIVERABLE_KIND_HINTS[kind]}</p>
            {spec?.notes ? <p className="mt-1 text-xs">{spec.notes}</p> : null}
          </div>

          {milestone.status === "CHANGES_REQUESTED" ? (
            <div className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2">
              <p className="font-medium text-destructive">Changes requested</p>
              {milestone.revisionReason ? <p>{milestone.revisionReason}</p> : null}
              {revisionTiming ? (
                <p className="text-xs text-muted-foreground">
                  Update target: {revisionTiming} (soft 24h)
                </p>
              ) : null}
            </div>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Submission title *</span>
            <Input
              value={draft.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="e.g. Checkout flow preview"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{fieldLabel("ACCESS_URL")}</span>
            <Input
              value={draft.accessUrl}
              onChange={(event) => set("accessUrl", event.target.value)}
              placeholder="https://…"
              inputMode="url"
            />
          </label>

          {kind === "MOBILE_BUILD" ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{fieldLabel("PLATFORM")}</span>
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={draft.platform}
                onChange={(event) =>
                  set("platform", event.target.value as DeliverableDraft["platform"])
                }
              >
                <option value="">Select platform…</option>
                {(Object.keys(PLATFORM_LABELS) as Array<keyof typeof PLATFORM_LABELS>).map((key) => (
                  <option key={key} value={key}>
                    {PLATFORM_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {kind === "DESKTOP_BUILD" ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{fieldLabel("OS")}</span>
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={draft.os}
                onChange={(event) => set("os", event.target.value as DeliverableDraft["os"])}
              >
                <option value="">Select operating system…</option>
                {(Object.keys(OS_LABELS) as Array<keyof typeof OS_LABELS>).map((key) => (
                  <option key={key} value={key}>
                    {OS_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {kind === "OTHER" ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{fieldLabel("LABEL")}</span>
              <Input
                value={draft.label}
                onChange={(event) => set("label", event.target.value)}
                placeholder="e.g. Firmware image"
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{fieldLabel("INSTRUCTIONS")}</span>
            <textarea
              className={textareaClass}
              value={draft.instructions}
              onChange={(event) => set("instructions", event.target.value)}
              placeholder="How to access, install, or review this deliverable…"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{fieldLabel("VERSION")}</span>
              <Input
                value={draft.version}
                onChange={(event) => set("version", event.target.value)}
                placeholder="Optional (e.g. 0.3.1)"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{fieldLabel("CREDENTIALS")}</span>
              <Input
                value={draft.credentials}
                onChange={(event) => set("credentials", event.target.value)}
                placeholder="Only if access is gated"
              />
            </label>
          </div>
          {draft.credentials.trim() ? (
            <p className="text-xs text-amber-600">
              Credentials are visible to everyone in this project chat. Avoid reusable personal
              passwords.
            </p>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{fieldLabel("SUMMARY")}</span>
            <textarea
              className={textareaClass}
              value={draft.summary}
              onChange={(event) => set("summary", event.target.value)}
              placeholder="What should the client focus on? (optional)"
            />
          </label>

          {isResubmission ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">What changed / how to verify *</span>
              <textarea
                className={textareaClass}
                value={draft.whatChanged}
                onChange={(event) => set("whatChanged", event.target.value)}
                placeholder="Address the requested changes and say how to verify them…"
              />
            </label>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : isResubmission ? "Resubmit" : "Submit"}
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
