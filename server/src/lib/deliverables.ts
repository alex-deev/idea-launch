/**
 * v2 deliverable contract (multi-target bundles). v1/legacy model removed.
 *
 * Project-level `platformTargets[]` are propagated uniformly to every milestone.
 * Each milestone stores a v2 bundle spec (pinned slots per target). Submissions are
 * bundles: the server derives/locks kind+platform/OS from the spec and validates
 * builder-entered content only.
 */

export const PLATFORM_TARGETS = [
  "WEB",
  "MOBILE_IOS",
  "MOBILE_ANDROID",
  "MOBILE_CROSS_PLATFORM",
  "DESKTOP_WINDOWS",
  "DESKTOP_MACOS",
  "DESKTOP_LINUX",
] as const;

export type PlatformTarget = (typeof PLATFORM_TARGETS)[number];

export const DELIVERABLE_KINDS = ["WEB_LINK", "MOBILE_BUILD", "DESKTOP_BUILD"] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

export type DeliverablePlatform = "ANDROID" | "IOS" | "CROSS_PLATFORM";
export type DeliverableOs = "WINDOWS" | "MACOS" | "LINUX";

export interface TargetMatrixRow {
  target: PlatformTarget;
  kind: DeliverableKind;
  platform?: DeliverablePlatform;
  os?: DeliverableOs;
  label: string;
}

export const TARGET_MATRIX: Record<PlatformTarget, TargetMatrixRow> = {
  WEB: { target: "WEB", kind: "WEB_LINK", label: "Web" },
  MOBILE_IOS: { target: "MOBILE_IOS", kind: "MOBILE_BUILD", platform: "IOS", label: "iOS app" },
  MOBILE_ANDROID: {
    target: "MOBILE_ANDROID",
    kind: "MOBILE_BUILD",
    platform: "ANDROID",
    label: "Android app",
  },
  MOBILE_CROSS_PLATFORM: {
    target: "MOBILE_CROSS_PLATFORM",
    kind: "MOBILE_BUILD",
    platform: "CROSS_PLATFORM",
    label: "Cross-platform mobile app",
  },
  DESKTOP_WINDOWS: {
    target: "DESKTOP_WINDOWS",
    kind: "DESKTOP_BUILD",
    os: "WINDOWS",
    label: "Windows app",
  },
  DESKTOP_MACOS: {
    target: "DESKTOP_MACOS",
    kind: "DESKTOP_BUILD",
    os: "MACOS",
    label: "macOS app",
  },
  DESKTOP_LINUX: {
    target: "DESKTOP_LINUX",
    kind: "DESKTOP_BUILD",
    os: "LINUX",
    label: "Linux app",
  },
};

export const PLATFORM_TARGET_LABELS: Record<PlatformTarget, string> = {
  WEB: "Web",
  MOBILE_IOS: "iOS",
  MOBILE_ANDROID: "Android",
  MOBILE_CROSS_PLATFORM: "Cross-platform mobile",
  DESKTOP_WINDOWS: "Windows",
  DESKTOP_MACOS: "macOS",
  DESKTOP_LINUX: "Linux",
};

export interface BundleSlotSpec {
  target: PlatformTarget;
  kind: DeliverableKind;
  platform?: DeliverablePlatform;
  os?: DeliverableOs;
  label: string | null;
  notes: string | null;
}

export interface BundleSpec {
  version: 2;
  targets: PlatformTarget[];
  slots: BundleSlotSpec[];
}

export interface SlotDeliverableContent {
  title: string;
  accessUrl: string;
  instructions: string;
  version?: string;
  credentials?: string;
  summary?: string;
}

export interface NormalizedSlotDeliverable extends SlotDeliverableContent {
  kind: DeliverableKind;
  platform?: DeliverablePlatform;
  os?: DeliverableOs;
}

export interface NormalizedBundleSubmission {
  slots: Array<{ target: PlatformTarget; deliverable: NormalizedSlotDeliverable }>;
  whatChanged?: string;
}

export type BundleValidationResult =
  | { ok: true; value: NormalizedBundleSubmission }
  | { ok: false; error: string };

const MAX_TITLE = 120;
const MAX_URL = 2000;
const MAX_VERSION = 120;
const MAX_CREDENTIALS = 500;
const MAX_TEXT = 4000;
const MIN_INSTRUCTIONS = 10;
const MAX_SUMMARY = 2000;
const MIN_CHANGE_NOTE = 10;
const MAX_LABEL = 120;
const MAX_NOTES = 500;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function clampText(value: unknown, max: number): string | null {
  const text = readText(value);
  if (!text) return null;
  return text.slice(0, max);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isPlatformTarget(value: unknown): value is PlatformTarget {
  return typeof value === "string" && (PLATFORM_TARGETS as readonly string[]).includes(value);
}

export function uniqueTargets(targets: PlatformTarget[]): PlatformTarget[] {
  const seen = new Set<PlatformTarget>();
  const out: PlatformTarget[] = [];
  for (const t of targets) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** Parse/normalize an ordered, unique list of known platform targets. */
export function parsePlatformTargets(value: unknown): PlatformTarget[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: PlatformTarget[] = [];
  for (const item of value) {
    if (!isPlatformTarget(item)) return null;
    parsed.push(item);
  }
  const unique = uniqueTargets(parsed);
  if (unique.length === 0 || unique.length !== parsed.length) return null;
  return unique;
}

/** Best-effort mapping from scope intake app kinds to default platform targets. */
export function inferPlatformTargetsFromScope(
  appKinds?: unknown,
  appKindOther?: unknown,
): PlatformTarget[] {
  const list = Array.isArray(appKinds)
    ? appKinds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.toLowerCase())
    : [];
  const other = typeof appKindOther === "string" ? appKindOther.toLowerCase() : "";
  const targets: PlatformTarget[] = [];

  const wantsWeb =
    list.includes("website") ||
    list.includes("web app") ||
    /\b(website|web app|web)\b/.test(other);
  const wantsMobile =
    list.includes("mobile app") || /\b(mobile|app|apk|ipa|ios|android)\b/.test(other);
  const wantsDesktop =
    list.includes("desktop app") || /\b(desktop|windows|mac|linux|exe|installer)\b/.test(other);

  if (wantsWeb) targets.push("WEB");

  if (wantsMobile) {
    const ios = /\b(ios|iphone|ipad)\b/.test(other);
    const android = /\bandroid\b/.test(other);
    if (ios && !android) targets.push("MOBILE_IOS");
    else if (android && !ios) targets.push("MOBILE_ANDROID");
    else targets.push("MOBILE_CROSS_PLATFORM");
  }

  if (wantsDesktop) {
    const win = /\bwindows\b/.test(other);
    const mac = /\bmac(os)?\b/.test(other);
    const linux = /\blinux\b/.test(other);
    const specific = [
      ...(win ? (["DESKTOP_WINDOWS"] as const) : []),
      ...(mac ? (["DESKTOP_MACOS"] as const) : []),
      ...(linux ? (["DESKTOP_LINUX"] as const) : []),
    ];
    if (specific.length > 0) targets.push(...specific);
    else targets.push("DESKTOP_WINDOWS");
  }

  if (targets.length === 0) targets.push("WEB");
  return uniqueTargets(targets);
}

function slotFromTarget(
  target: PlatformTarget,
  override?: { label?: unknown; notes?: unknown },
): BundleSlotSpec {
  const row = TARGET_MATRIX[target];
  return {
    target,
    kind: row.kind,
    ...(row.platform ? { platform: row.platform } : {}),
    ...(row.os ? { os: row.os } : {}),
    label: clampText(override?.label, MAX_LABEL),
    notes: clampText(override?.notes, MAX_NOTES),
  };
}

/** Build a uniform v2 bundle spec for the given targets. */
export function buildBundleSpec(
  targets: PlatformTarget[],
  slotOverrides?: Array<{ label?: unknown; notes?: unknown } | null | undefined>,
): BundleSpec {
  const unique = uniqueTargets(targets);
  return {
    version: 2,
    targets: unique,
    slots: unique.map((target, i) => slotFromTarget(target, slotOverrides?.[i] ?? undefined)),
  };
}

/**
 * Parse a v2 bundle spec. Accepts a targets array as shorthand (builds default slots).
 * v1 specs are not accepted.
 */
export function parseBundleSpec(value: unknown): BundleSpec | null {
  // Shorthand: array of platform targets
  if (Array.isArray(value) && value.every(isPlatformTarget)) {
    const targets = parsePlatformTargets(value);
    return targets ? buildBundleSpec(targets) : null;
  }

  const raw = asRecord(value);
  if (!raw) return null;

  // Accept explicit v2 bundle
  const targets = parsePlatformTargets(raw.targets);
  if (!targets) return null;
  if (raw.version !== undefined && raw.version !== 2) return null;

  const slotsRaw = Array.isArray(raw.slots) ? raw.slots : null;
  if (!slotsRaw) return buildBundleSpec(targets);

  // Slots must align 1:1 with targets (same set/order by target)
  if (slotsRaw.length !== targets.length) return null;
  const overrides: Array<{ label?: unknown; notes?: unknown } | null> = [];
  for (let i = 0; i < targets.length; i++) {
    const slot = asRecord(slotsRaw[i]);
    if (!slot) return null;
    if (slot.target !== targets[i]) return null;
    const row = TARGET_MATRIX[targets[i]];
    // Pinned fields must match matrix when present
    if (slot.kind !== undefined && slot.kind !== row.kind) return null;
    if (row.platform && slot.platform !== undefined && slot.platform !== row.platform) return null;
    if (row.os && slot.os !== undefined && slot.os !== row.os) return null;
    overrides.push({ label: slot.label, notes: slot.notes });
  }
  return buildBundleSpec(targets, overrides);
}

/** Parse per-milestone bundle specs (index 0-2 / stage 1-3). */
export function parseBundleSpecs(value: unknown): Array<BundleSpec | null> {
  const result: Array<BundleSpec | null> = [null, null, null];
  if (Array.isArray(value)) {
    // A single targets array or a single bundle object applied uniformly
    if (value.every(isPlatformTarget) || (value.length > 0 && !Array.isArray(value[0]) && asRecord(value[0])?.targets)) {
      // If it looks like a single bundle spec encoded oddly, try whole value; else treat as uniform targets/bundle
    }
    // Uniform shorthand: ["WEB", ...] as targets for all milestones (length could be 1-7)
    if (value.length > 0 && value.every(isPlatformTarget)) {
      const spec = parseBundleSpec(value);
      return [spec, spec, spec];
    }
    // Per-milestone array
    if (value.length >= 1 && (asRecord(value[0])?.targets || asRecord(value[0])?.version === 2 || Array.isArray((value[0] as any)?.targets))) {
      for (let i = 0; i < 3; i++) result[i] = parseBundleSpec(value[i]);
      // If only first provided, propagate uniformly
      if (result[0] && !result[1] && !result[2]) return [result[0], result[0], result[0]];
      return result;
    }
    for (let i = 0; i < 3; i++) result[i] = parseBundleSpec(value[i]);
    return result;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Single bundle/targets object applied uniformly
    if (obj.targets || obj.version === 2) {
      const spec = parseBundleSpec(obj);
      return [spec, spec, spec];
    }
    for (let i = 0; i < 3; i++) {
      const stage = i + 1;
      result[i] = parseBundleSpec(obj[String(stage)] ?? obj[stage] ?? obj[String(i)]);
    }
  }
  return result;
}

/** Ensure all milestone bundle specs are identical (uniform propagation). */
export function ensureUniformBundles(
  specs: Array<BundleSpec | null>,
): { ok: true; spec: BundleSpec } | { ok: false; error: string } {
  const first = specs[0];
  if (!first) return { ok: false, error: "Platform targets/deliverable bundle are required" };
  const key = JSON.stringify({ targets: first.targets, slots: first.slots.map((s) => [s.target, s.kind, s.platform, s.os, s.label, s.notes]) });
  for (let i = 1; i < 3; i++) {
    const s = specs[i];
    if (!s) return { ok: false, error: "Deliverable bundle is required for every milestone" };
    const k = JSON.stringify({ targets: s.targets, slots: s.slots.map((x) => [x.target, x.kind, x.platform, x.os, x.label, x.notes]) });
    if (k !== key) {
      return { ok: false, error: "All milestones must use the same platform targets (uniform bundle)" };
    }
  }
  return { ok: true, spec: first };
}

function validateSlotContent(
  slot: BundleSlotSpec,
  input: unknown,
): { ok: true; value: NormalizedSlotDeliverable } | { ok: false; error: string } {
  const raw = asRecord(input);
  const targetLabel = PLATFORM_TARGET_LABELS[slot.target];
  if (!raw) return { ok: false, error: `Missing submission for ${targetLabel}` };

  // Reject conflicting pinned fields if client supplied them
  if (raw.kind !== undefined && raw.kind !== slot.kind) {
    return { ok: false, error: `Deliverable type for ${targetLabel} is locked by the contract` };
  }
  if (slot.platform && raw.platform !== undefined && raw.platform !== slot.platform) {
    return { ok: false, error: `Platform for ${targetLabel} is locked by the contract` };
  }
  if (slot.os && raw.os !== undefined && raw.os !== slot.os) {
    return { ok: false, error: `Operating system for ${targetLabel} is locked by the contract` };
  }
  // Disallow fields not applicable to the pinned kind
  if (slot.kind === "WEB_LINK") {
    if (raw.platform !== undefined || raw.os !== undefined) {
      return { ok: false, error: `Invalid fields for ${targetLabel} deliverable` };
    }
  }

  const title = readText(raw.title);
  if (!title) return { ok: false, error: `A title is required for ${targetLabel}` };
  if (title.length > MAX_TITLE) return { ok: false, error: `Title for ${targetLabel} must be ${MAX_TITLE} characters or fewer` };

  const accessUrl = readText(raw.accessUrl);
  if (!accessUrl) return { ok: false, error: `An access/download link is required for ${targetLabel}` };
  if (accessUrl.length > MAX_URL) return { ok: false, error: `Link for ${targetLabel} must be ${MAX_URL} characters or fewer` };
  if (!isHttpUrl(accessUrl)) return { ok: false, error: `Link for ${targetLabel} must be a valid http(s) URL` };

  const instructions = readText(raw.instructions);
  if (!instructions) return { ok: false, error: `Instructions are required for ${targetLabel}` };
  if (instructions.length < MIN_INSTRUCTIONS) {
    return { ok: false, error: `Instructions for ${targetLabel} must be at least ${MIN_INSTRUCTIONS} characters` };
  }
  if (instructions.length > MAX_TEXT) {
    return { ok: false, error: `Instructions for ${targetLabel} must be ${MAX_TEXT} characters or fewer` };
  }

  const version = readText(raw.version);
  if (version && version.length > MAX_VERSION) {
    return { ok: false, error: `Version for ${targetLabel} must be ${MAX_VERSION} characters or fewer` };
  }
  const credentials = readText(raw.credentials);
  if (credentials && credentials.length > MAX_CREDENTIALS) {
    return { ok: false, error: `Credentials for ${targetLabel} must be ${MAX_CREDENTIALS} characters or fewer` };
  }
  const summary = readText(raw.summary);
  if (summary && summary.length > MAX_SUMMARY) {
    return { ok: false, error: `Summary for ${targetLabel} must be ${MAX_SUMMARY} characters or fewer` };
  }

  return {
    ok: true,
    value: {
      kind: slot.kind,
      ...(slot.platform ? { platform: slot.platform } : {}),
      ...(slot.os ? { os: slot.os } : {}),
      title,
      accessUrl,
      instructions,
      ...(version ? { version } : {}),
      ...(credentials ? { credentials } : {}),
      ...(summary ? { summary } : {}),
    },
  };
}

/** Validate a v2 bundle submission against a locked bundle spec (server-derived/locked). */
export function validateBundleSubmission(
  spec: BundleSpec | null | undefined,
  input: unknown,
  options: { resubmission?: boolean } = {},
): BundleValidationResult {
  if (!spec || spec.version !== 2 || spec.slots.length === 0) {
    return { ok: false, error: "A valid deliverable contract is required for this milestone" };
  }
  const raw = asRecord(input);
  if (!raw) return { ok: false, error: "A bundle submission is required" };

  const bundle = asRecord(raw.bundle);
  if (!bundle) return { ok: false, error: "A bundle submission with per-target deliverables is required" };
  const slotsIn = Array.isArray(bundle.slots) ? bundle.slots : null;
  if (!slotsIn) return { ok: false, error: "Bundle slots are required" };

  // Index provided slots by target
  const byTarget = new Map<PlatformTarget, Record<string, unknown>>();
  for (const entry of slotsIn) {
    const rec = asRecord(entry);
    if (!rec || !isPlatformTarget(rec.target)) {
      return { ok: false, error: "Each bundle slot must specify a valid target" };
    }
    if (byTarget.has(rec.target)) {
      return { ok: false, error: `Duplicate submission for ${PLATFORM_TARGET_LABELS[rec.target]}` };
    }
    byTarget.set(rec.target, rec);
  }

  // Require exact coverage
  for (const slot of spec.slots) {
    if (!byTarget.has(slot.target)) {
      return { ok: false, error: `Missing submission for ${PLATFORM_TARGET_LABELS[slot.target]}` };
    }
  }
  for (const target of byTarget.keys()) {
    if (!spec.targets.includes(target)) {
      return { ok: false, error: `${PLATFORM_TARGET_LABELS[target]} is not part of the agreed contract` };
    }
  }

  const normalizedSlots: Array<{ target: PlatformTarget; deliverable: NormalizedSlotDeliverable }> = [];
  for (const slot of spec.slots) {
    const entry = byTarget.get(slot.target)!;
    const content = (entry as any).deliverable ?? entry; // accept {target,deliverable:{...}} or flat
    const validated = validateSlotContent(slot, content);
    if (!validated.ok) return validated;
    normalizedSlots.push({ target: slot.target, deliverable: validated.value });
  }

  const whatChanged = readText(raw.whatChanged);
  if (options.resubmission) {
    if (!whatChanged || whatChanged.length < MIN_CHANGE_NOTE) {
      return {
        ok: false,
        error: `Describe what changed (at least ${MIN_CHANGE_NOTE} characters) for a resubmission`,
      };
    }
  }
  if (whatChanged && whatChanged.length > MAX_SUMMARY) {
    return { ok: false, error: `What changed must be ${MAX_SUMMARY} characters or fewer` };
  }

  return {
    ok: true,
    value: {
      slots: normalizedSlots,
      ...(whatChanged ? { whatChanged } : {}),
    },
  };
}

/** Convenience: first slot access URL for summary fields. */
export function bundlePrimaryUrl(submission: NormalizedBundleSubmission): string {
  return submission.slots[0]?.deliverable.accessUrl ?? "";
}

export function bundleSummaryLabel(spec: BundleSpec): string {
  const n = spec.targets.length;
  return `Bundle submitted (${n} target${n === 1 ? "" : "s"})`;
}

/** Uniform bundle spec from a single PlatformTarget (helper for migrations/defaults). */
export function singleTargetBundleSpec(target: PlatformTarget): BundleSpec {
  return buildBundleSpec([target]);
}