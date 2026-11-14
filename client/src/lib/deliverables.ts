/**
 * Client-side mirror of the v2 deliverable contract (multi-target bundles).
 * Server validation in `server/src/lib/deliverables.ts` is authoritative.
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

interface TargetMatrixRow {
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

export const TARGET_DESCRIPTIONS: Record<PlatformTarget, string> = {
  WEB: "Website or web app (browser link)",
  MOBILE_IOS: "iOS mobile build (IPA/TestFlight/App Store link)",
  MOBILE_ANDROID: "Android mobile build (APK/store link)",
  MOBILE_CROSS_PLATFORM: "Cross-platform mobile build",
  DESKTOP_WINDOWS: "Windows desktop build/installer",
  DESKTOP_MACOS: "macOS desktop build/installer",
  DESKTOP_LINUX: "Linux desktop build/package",
};

export interface BundleSlotSpec {
  target: PlatformTarget;
  kind: DeliverableKind;
  platform?: DeliverablePlatform;
  os?: DeliverableOs;
  label?: string | null;
  notes?: string | null;
}

export interface BundleSpec {
  version: 2;
  targets: PlatformTarget[];
  slots: BundleSlotSpec[];
}

export interface SlotDraft {
  target: PlatformTarget;
  title: string;
  accessUrl: string;
  instructions: string;
  version: string;
  credentials: string;
  summary: string;
}

export interface BundleDraft {
  slots: SlotDraft[];
  whatChanged: string;
}

export interface SlotDeliverablePayload {
  target: PlatformTarget;
  deliverable: {
    title: string;
    accessUrl: string;
    instructions: string;
    version?: string;
    credentials?: string;
    summary?: string;
  };
}

export interface BundleSubmissionPayload {
  bundle: { slots: SlotDeliverablePayload[] };
  whatChanged?: string;
}

const MAX_TITLE = 120;
const MAX_URL = 2000;
const MAX_VERSION = 120;
const MAX_CREDENTIALS = 500;
const MAX_TEXT = 4000;
const MIN_INSTRUCTIONS = 10;
const MAX_SUMMARY = 2000;
const MIN_CHANGE_NOTE = 10;

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

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Best-effort mapping from scope intake to default platform targets. */
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

function slotFromTarget(target: PlatformTarget): BundleSlotSpec {
  const row = TARGET_MATRIX[target];
  return {
    target,
    kind: row.kind,
    ...(row.platform ? { platform: row.platform } : {}),
    ...(row.os ? { os: row.os } : {}),
    label: null,
    notes: null,
  };
}

export function buildBundleSpec(targets: PlatformTarget[]): BundleSpec {
  const unique = uniqueTargets(targets);
  return { version: 2, targets: unique, slots: unique.map(slotFromTarget) };
}

export function parseBundleSpec(value: unknown): BundleSpec | null {
  if (Array.isArray(value) && value.every(isPlatformTarget)) {
    const targets = uniqueTargets(value as PlatformTarget[]);
    return targets.length ? buildBundleSpec(targets) : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const targetsRaw = Array.isArray(raw.targets) ? raw.targets : null;
  if (!targetsRaw) return null;
  const targets = uniqueTargets(targetsRaw.filter(isPlatformTarget));
  if (targets.length === 0 || targets.length !== targetsRaw.length) return null;
  const slotsRaw = Array.isArray(raw.slots) ? raw.slots : null;
  if (!slotsRaw || slotsRaw.length !== targets.length) return buildBundleSpec(targets);
  const slots: BundleSlotSpec[] = [];
  for (let i = 0; i < targets.length; i++) {
    const s = slotsRaw[i] as Record<string, unknown> | null;
    if (!s || s.target !== targets[i]) return buildBundleSpec(targets);
    const base = slotFromTarget(targets[i]);
    slots.push({
      ...base,
      label: typeof s.label === "string" && s.label.trim() ? s.label.trim() : null,
      notes: typeof s.notes === "string" && s.notes.trim() ? s.notes.trim() : null,
    });
  }
  return { version: 2, targets, slots };
}

export function bundleSpecFromSnapshot(snapshot: unknown): BundleSpec | null {
  if (!Array.isArray(snapshot) || snapshot.length === 0) return null;
  return parseBundleSpec((snapshot[0] as any)?.deliverable);
}

export function emptySlotDraft(target: PlatformTarget): SlotDraft {
  return { target, title: "", accessUrl: "", instructions: "", version: "", credentials: "", summary: "" };
}

export function emptyBundleDraft(spec: BundleSpec): BundleDraft {
  return { slots: spec.targets.map(emptySlotDraft), whatChanged: "" };
}

export function validateBundleDraft(
  spec: BundleSpec | null | undefined,
  draft: BundleDraft,
  options: { resubmission?: boolean } = {},
): string | null {
  if (!spec || spec.targets.length === 0) return "A deliverable contract is required";
  for (let i = 0; i < spec.targets.length; i++) {
    const target = spec.targets[i];
    const slot = draft.slots[i];
    const label = PLATFORM_TARGET_LABELS[target];
    if (!slot || slot.target !== target) return `Missing submission for ${label}`;
    const title = slot.title.trim();
    if (!title) return `A title is required for ${label}`;
    if (title.length > MAX_TITLE) return `Title for ${label} is too long`;
    const url = slot.accessUrl.trim();
    if (!url) return `An access/download link is required for ${label}`;
    if (url.length > MAX_URL) return `Link for ${label} is too long`;
    if (!isHttpUrl(url)) return `Link for ${label} must be a valid http(s) URL`;
    const instructions = slot.instructions.trim();
    if (!instructions) return `Instructions are required for ${label}`;
    if (instructions.length < MIN_INSTRUCTIONS) return `Instructions for ${label} must be at least ${MIN_INSTRUCTIONS} characters`;
    if (instructions.length > MAX_TEXT) return `Instructions for ${label} are too long`;
    if (slot.version.trim().length > MAX_VERSION) return `Version for ${label} is too long`;
    if (slot.credentials.trim().length > MAX_CREDENTIALS) return `Credentials for ${label} are too long`;
    if (slot.summary.trim().length > MAX_SUMMARY) return `Summary for ${label} is too long`;
  }
  const whatChanged = draft.whatChanged.trim();
  if (options.resubmission && whatChanged.length < MIN_CHANGE_NOTE) {
    return `Describe what changed (at least ${MIN_CHANGE_NOTE} characters)`;
  }
  if (whatChanged.length > MAX_SUMMARY) return "Change note is too long";
  return null;
}

export function toBundleSubmissionPayload(draft: BundleDraft): BundleSubmissionPayload {
  const whatChanged = draft.whatChanged.trim();
  return {
    bundle: {
      slots: draft.slots.map((slot) => ({
        target: slot.target,
        deliverable: {
          title: slot.title.trim(),
          accessUrl: slot.accessUrl.trim(),
          instructions: slot.instructions.trim(),
          ...(slot.version.trim() ? { version: slot.version.trim() } : {}),
          ...(slot.credentials.trim() ? { credentials: slot.credentials.trim() } : {}),
          ...(slot.summary.trim() ? { summary: slot.summary.trim() } : {}),
        },
      })),
    },
    ...(whatChanged ? { whatChanged } : {}),
  };
}

export function bundleSummaryLabel(spec: BundleSpec): string {
  const n = spec.targets.length;
  return `Bundle submitted (${n} target${n === 1 ? "" : "s"})`;
}

export function bundlePrimaryUrlFromPayload(payload: any): string | null {
  const slots = payload?.bundle?.slots;
  if (!Array.isArray(slots) || slots.length === 0) return null;
  const first = slots[0]?.deliverable?.accessUrl ?? slots[0]?.accessUrl;
  return typeof first === "string" && first ? first : null;
}