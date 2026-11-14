import { LongTermCadence, type OfferStatus } from "@prisma/client";

import {
  type DeliverableKind,
  type DeliverableSpec,
  defaultDeliverableSpec,
  parseDeliverableSpec,
  parseDeliverableSpecs,
} from "./deliverables.js";
import { buildMilestones } from "./milestones.js";

export const TERMINAL_OFFER_STATUSES: OfferStatus[] = [
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
];

export type OfferMilestoneSnapshotItem = {
  stageNumber: number;
  title: string;
  amount: number;
  releasePercent: number;
  dueDate: string | null;
  deliverable: DeliverableSpec;
};

export type OfferTermsInput = {
  totalCents?: unknown;
  longTermAmountCents?: unknown;
  longTermCadence?: unknown;
  longTermNotes?: unknown;
  milestoneDueDates?: unknown; // array by index (0-2) or by stageNumber (1-3)
  milestoneDeliverables?: unknown; // array by index (0-2) or by stageNumber (1-3)
};

export function parseTotalCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

export function parseLongTermCadence(value: unknown): LongTermCadence {
  const allowed: LongTermCadence[] = ["NONE", "MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"];
  if (typeof value === "string" && (allowed as string[]).includes(value)) {
    return value as LongTermCadence;
  }
  return "NONE";
}

export function parseLongTermAmountCents(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n === "number" && Number.isInteger(n) && n >= 0) return n;
  return null;
}

export function parseLongTermNotes(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function parseMilestoneDueDates(value: unknown): Array<string | null> {
  const result: Array<string | null> = [null, null, null];
  if (Array.isArray(value)) {
    for (let i = 0; i < 3; i++) {
      result[i] = toIsoOrNull(value[i]);
    }
    return result;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (let i = 0; i < 3; i++) {
      const stage = i + 1;
      const byStage = obj[String(stage)] ?? obj[stage];
      const byIndex = obj[String(i)];
      result[i] = toIsoOrNull(byStage ?? byIndex ?? null);
    }
  }
  return result;
}

export function buildMilestonesSnapshot(
  totalCents: number,
  dueDates?: Array<string | null>,
  deliverables?: Array<DeliverableSpec | null>,
  defaultDeliverableKind: DeliverableKind = "WEB_LINK",
): OfferMilestoneSnapshotItem[] {
  const dates = dueDates ?? [null, null, null];
  return buildMilestones(totalCents).map((m, i) => ({
    stageNumber: m.stageNumber,
    title: m.title,
    amount: m.amount,
    releasePercent: m.releasePercent,
    dueDate: dates[i] ?? null,
    deliverable:
      deliverables?.[i] ?? defaultDeliverableSpec(defaultDeliverableKind),
  }));
}

export type OfferTermsInputSource = {
  longTermAmountCents?: number | null;
  longTermCadence?: LongTermCadence;
  longTermNotes?: string | null;
  milestonesSnapshot?: unknown;
};

export function normalizeOfferTerms(
  totalCents: number,
  input: OfferTermsInput,
  existing?: OfferTermsInputSource,
  options: { defaultDeliverableKind?: DeliverableKind } = {},
) {
  const existingSnapshot = Array.isArray(existing?.milestonesSnapshot)
    ? (existing!.milestonesSnapshot as any[])
    : [];
  const existingDates = [0, 1, 2].map(
    (i) => (existingSnapshot[i]?.dueDate ?? null) as string | null,
  );
  const existingDeliverables: Array<DeliverableSpec | null> = [0, 1, 2].map((i) =>
    parseDeliverableSpec(existingSnapshot[i]?.deliverable),
  );

  const providedDates =
    input.milestoneDueDates !== undefined ? parseMilestoneDueDates(input.milestoneDueDates) : null;
  const dueDates = providedDates
    ? providedDates.map((d, i) => d ?? existingDates[i] ?? null)
    : existingDates;

  const providedDeliverables =
    input.milestoneDeliverables !== undefined
      ? parseDeliverableSpecs(input.milestoneDeliverables)
      : null;
  const deliverables = [0, 1, 2].map(
    (i) => providedDeliverables?.[i] ?? existingDeliverables[i] ?? null,
  );

  const longTermAmountCents =
    input.longTermAmountCents !== undefined
      ? parseLongTermAmountCents(input.longTermAmountCents)
      : (existing?.longTermAmountCents ?? null);
  const longTermCadence =
    input.longTermCadence !== undefined
      ? parseLongTermCadence(input.longTermCadence)
      : (existing?.longTermCadence ?? "NONE");
  const longTermNotes =
    input.longTermNotes !== undefined
      ? parseLongTermNotes(input.longTermNotes)
      : (existing?.longTermNotes ?? null);

  return {
    totalCents,
    milestonesSnapshot: buildMilestonesSnapshot(
      totalCents,
      dueDates,
      deliverables,
      options.defaultDeliverableKind,
    ),
    longTermAmountCents,
    longTermCadence,
    longTermNotes,
  };
}

export function snapshotDueDates(snapshot: unknown): Array<Date | null> {
  if (!Array.isArray(snapshot)) return [null, null, null];
  return [0, 1, 2].map((i) => {
    const raw = (snapshot[i] as any)?.dueDate;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  });
}

/** Deliverable specs in snapshot order (stage 1-3), defaulting to WEB_LINK. */
export function snapshotDeliverables(snapshot: unknown): DeliverableSpec[] {
  const items = Array.isArray(snapshot) ? snapshot : [];
  return [0, 1, 2].map(
    (i) => parseDeliverableSpec((items[i] as any)?.deliverable) ?? defaultDeliverableSpec("WEB_LINK"),
  );
}

export function isTerminalOfferStatus(status: OfferStatus) {
  return TERMINAL_OFFER_STATUSES.includes(status);
}
