import { LongTermCadence, type OfferStatus } from "@prisma/client";

import {
  type BundleSpec,
  type PlatformTarget,
  buildBundleSpec,
  ensureUniformBundles,
  inferPlatformTargetsFromScope,
  parseBundleSpec,
  parsePlatformTargets,
  uniqueTargets,
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
  deliverable: BundleSpec;
};

export type OfferTermsInput = {
  totalCents?: unknown;
  longTermAmountCents?: unknown;
  longTermCadence?: unknown;
  longTermNotes?: unknown;
  milestoneDueDates?: unknown; // array by index (0-2) or by stageNumber (1-3)
  platformTargets?: unknown; // ordered, unique PlatformTarget[]
  /**
   * Optional per-slot label/notes overrides applied uniformly to every milestone.
   * Array aligned to platformTargets: [{label?, notes?}, ...]
   */
  slotOverrides?: unknown;
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
    for (let i = 0; i < 3; i++) result[i] = toIsoOrNull(value[i]);
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

function parseSlotOverrides(
  value: unknown,
): Array<{ label?: unknown; notes?: unknown } | null> | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? { label: (entry as any).label, notes: (entry as any).notes }
      : null,
  );
}

export function buildMilestonesSnapshot(
  totalCents: number,
  dueDates: Array<string | null>,
  deliverable: BundleSpec,
): OfferMilestoneSnapshotItem[] {
  const dates = dueDates ?? [null, null, null];
  return buildMilestones(totalCents).map((m, i) => ({
    stageNumber: m.stageNumber,
    title: m.title,
    amount: m.amount,
    releasePercent: m.releasePercent,
    dueDate: dates[i] ?? null,
    deliverable,
  }));
}

export type OfferTermsInputSource = {
  longTermAmountCents?: number | null;
  longTermCadence?: LongTermCadence;
  longTermNotes?: string | null;
  milestonesSnapshot?: unknown;
};

function extractExistingBundle(snapshot: unknown): BundleSpec | null {
  if (!Array.isArray(snapshot) || snapshot.length === 0) return null;
  // v2 uniform: first item's deliverable
  return parseBundleSpec((snapshot[0] as any)?.deliverable);
}

export type NormalizeOfferTermsResult =
  | { ok: true; terms: ReturnType<typeof normalizeOfferTermsOk> }
  | { ok: false; error: string };

function normalizeOfferTermsOk(
  totalCents: number,
  milestonesSnapshot: OfferMilestoneSnapshotItem[],
  longTermAmountCents: number | null,
  longTermCadence: LongTermCadence,
  longTermNotes: string | null,
) {
  return { totalCents, milestonesSnapshot, longTermAmountCents, longTermCadence, longTermNotes };
}

export function normalizeOfferTerms(
  totalCents: number,
  input: OfferTermsInput,
  existing?: OfferTermsInputSource,
  options: { defaultPlatformTargets?: PlatformTarget[] } = {},
): NormalizeOfferTermsResult {
  const existingSnapshot = Array.isArray(existing?.milestonesSnapshot)
    ? (existing!.milestonesSnapshot as any[])
    : [];
  const existingDates = [0, 1, 2].map(
    (i) => (existingSnapshot[i]?.dueDate ?? null) as string | null,
  );
  const existingBundle = extractExistingBundle(existingSnapshot);

  const providedDates =
    input.milestoneDueDates !== undefined ? parseMilestoneDueDates(input.milestoneDueDates) : null;
  const dueDates = providedDates
    ? providedDates.map((d, i) => d ?? existingDates[i] ?? null)
    : existingDates;

  // Resolve platform targets (v2-only): explicit > existing > default
  let targets: PlatformTarget[] | null = null;
  if (input.platformTargets !== undefined) {
    targets = parsePlatformTargets(input.platformTargets);
    if (!targets) return { ok: false, error: "A valid set of platform targets is required" };
  } else if (existingBundle) {
    targets = existingBundle.targets;
  } else if (options.defaultPlatformTargets && options.defaultPlatformTargets.length > 0) {
    targets = uniqueTargets(options.defaultPlatformTargets);
  }

  if (!targets || targets.length === 0) {
    return { ok: false, error: "Platform targets are required" };
  }

  const overrides = parseSlotOverrides(input.slotOverrides);
  // Preserve existing label/notes when targets unchanged and no overrides provided
  let effectiveOverrides = overrides;
  if (!overrides && existingBundle) {
    const same =
      existingBundle.targets.length === targets.length &&
      existingBundle.targets.every((t, i) => t === targets[i]);
    if (same) {
      effectiveOverrides = existingBundle.slots.map((s) => ({ label: s.label, notes: s.notes }));
    }
  }
  const bundle = buildBundleSpec(targets, effectiveOverrides);

  const uniform = ensureUniformBundles([bundle, bundle, bundle]);
  if (!uniform.ok) return uniform;

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
    ok: true,
    terms: normalizeOfferTermsOk(
      totalCents,
      buildMilestonesSnapshot(totalCents, dueDates, uniform.spec),
      longTermAmountCents,
      longTermCadence,
      longTermNotes,
    ),
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

/** Uniform v2 bundle spec from snapshot (stage 1). */
export function snapshotBundleSpec(snapshot: unknown): BundleSpec | null {
  return extractExistingBundle(snapshot);
}

export function isTerminalOfferStatus(status: OfferStatus) {
  return TERMINAL_OFFER_STATUSES.includes(status);
}

// Re-export for convenience
export { inferPlatformTargetsFromScope, parsePlatformTargets };