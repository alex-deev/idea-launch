/**
 * Client-side mirror of the server deliverable contract.
 * Server validation in `server/src/lib/deliverables.ts` is authoritative;
 * this keeps the form UX consistent with it.
 */

export const DELIVERABLE_KINDS = [
  "WEB_LINK",
  "MOBILE_BUILD",
  "DESKTOP_BUILD",
  "SOURCE_PACKAGE",
  "DOCUMENT",
  "OTHER",
] as const;

export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

export const DELIVERABLE_FIELDS = [
  "ACCESS_URL",
  "VERSION",
  "PLATFORM",
  "OS",
  "INSTRUCTIONS",
  "CREDENTIALS",
  "LABEL",
  "SUMMARY",
] as const;

export type DeliverableField = (typeof DELIVERABLE_FIELDS)[number];

export type DeliverablePlatform = "ANDROID" | "IOS" | "CROSS_PLATFORM";
export type DeliverableOs = "WINDOWS" | "MACOS" | "LINUX";

export interface DeliverableSpec {
  kind: DeliverableKind;
  label?: string | null;
  requiredFields?: DeliverableField[] | null;
  notes?: string | null;
}

export interface DeliverableDraft {
  kind: DeliverableKind;
  title: string;
  accessUrl: string;
  instructions: string;
  version: string;
  platform: "" | DeliverablePlatform;
  os: "" | DeliverableOs;
  credentials: string;
  label: string;
  summary: string;
  whatChanged: string;
}

export const DELIVERABLE_KIND_LABELS: Record<DeliverableKind, string> = {
  WEB_LINK: "Website / web app link",
  MOBILE_BUILD: "Mobile build",
  DESKTOP_BUILD: "Desktop build",
  SOURCE_PACKAGE: "Source package",
  DOCUMENT: "Document",
  OTHER: "Other",
};

export const DELIVERABLE_KIND_HINTS: Record<DeliverableKind, string> = {
  WEB_LINK: "Hosted preview or production URL the client can open in a browser.",
  MOBILE_BUILD: "Link to an APK/IPA/TestFlight or unlisted store build.",
  DESKTOP_BUILD: "Link to an installer or portable binary.",
  SOURCE_PACKAGE: "Repo/archive link (include a branch or tag when useful).",
  DOCUMENT: "Link to a spec, design file, report, or deck.",
  OTHER: "Anything else — describe the deliverable and how to access it.",
};

export const DELIVERABLE_FIELD_LABELS: Record<DeliverableField, string> = {
  ACCESS_URL: "Access / download link",
  VERSION: "Version / build / branch",
  PLATFORM: "Platform",
  OS: "Operating system",
  INSTRUCTIONS: "Access / install / review instructions",
  CREDENTIALS: "Credentials (optional)",
  LABEL: "Describe the deliverable",
  SUMMARY: "Summary (optional)",
};

const KIND_RULES: Record<
  DeliverableKind,
  { allowed: DeliverableField[]; required: DeliverableField[] }
> = {
  WEB_LINK: {
    allowed: ["ACCESS_URL", "VERSION", "INSTRUCTIONS", "CREDENTIALS", "SUMMARY"],
    required: ["ACCESS_URL", "INSTRUCTIONS"],
  },
  MOBILE_BUILD: {
    allowed: ["ACCESS_URL", "VERSION", "PLATFORM", "INSTRUCTIONS", "CREDENTIALS", "SUMMARY"],
    required: ["ACCESS_URL", "PLATFORM", "INSTRUCTIONS"],
  },
  DESKTOP_BUILD: {
    allowed: ["ACCESS_URL", "VERSION", "OS", "INSTRUCTIONS", "CREDENTIALS", "SUMMARY"],
    required: ["ACCESS_URL", "OS", "INSTRUCTIONS"],
  },
  SOURCE_PACKAGE: {
    allowed: ["ACCESS_URL", "VERSION", "INSTRUCTIONS", "CREDENTIALS", "SUMMARY"],
    required: ["ACCESS_URL", "INSTRUCTIONS"],
  },
  DOCUMENT: {
    allowed: ["ACCESS_URL", "VERSION", "INSTRUCTIONS", "CREDENTIALS", "SUMMARY"],
    required: ["ACCESS_URL", "INSTRUCTIONS"],
  },
  OTHER: {
    allowed: ["ACCESS_URL", "VERSION", "LABEL", "INSTRUCTIONS", "CREDENTIALS", "SUMMARY"],
    required: ["ACCESS_URL", "LABEL", "INSTRUCTIONS"],
  },
};

export const PLATFORM_LABELS: Record<DeliverablePlatform, string> = {
  ANDROID: "Android",
  IOS: "iOS",
  CROSS_PLATFORM: "Cross-platform",
};

export const OS_LABELS: Record<DeliverableOs, string> = {
  WINDOWS: "Windows",
  MACOS: "macOS",
  LINUX: "Linux",
};

export function allowedFields(kind: DeliverableKind): DeliverableField[] {
  return [...KIND_RULES[kind].allowed];
}

export function requiredFields(kind: DeliverableKind): DeliverableField[] {
  return [...KIND_RULES[kind].required];
}

export function defaultDeliverableSpec(kind: DeliverableKind = "WEB_LINK"): DeliverableSpec {
  return { kind, label: null, requiredFields: requiredFields(kind), notes: null };
}

/** Prefill suggestion from the scope intake; the offer terms stay authoritative. */
export function inferDeliverableKindFromAppKinds(
  appKinds?: unknown,
  appKindOther?: unknown,
): DeliverableKind {
  const list = Array.isArray(appKinds)
    ? appKinds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.toLowerCase())
    : [];
  const other = typeof appKindOther === "string" ? appKindOther.toLowerCase() : "";

  if (list.includes("mobile app") || /\b(apk|ipa|ios|android)\b/.test(other)) {
    return "MOBILE_BUILD";
  }
  if (list.includes("desktop app") || /\b(exe|installer|desktop)\b/.test(other)) {
    return "DESKTOP_BUILD";
  }
  if (list.includes("website") || list.includes("web app") || /\b(website|web app)\b/.test(other)) {
    return "WEB_LINK";
  }
  if (/\b(api|backend|sdk|library|repo|source)\b/.test(other)) {
    return "SOURCE_PACKAGE";
  }
  return "WEB_LINK";
}

export function requiredFieldsForSpec(spec: DeliverableSpec | null | undefined): DeliverableField[] {
  const kind = spec?.kind ?? "WEB_LINK";
  const allowed = new Set(allowedFields(kind));
  const merged = new Set<DeliverableField>(requiredFields(kind));
  for (const field of spec?.requiredFields ?? []) {
    if (allowed.has(field)) merged.add(field);
  }
  return [...merged];
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const MAX_TITLE = 120;
const MAX_URL = 2000;
const MAX_VERSION = 120;
const MAX_CREDENTIALS = 500;
const MAX_TEXT = 4000;
const MIN_INSTRUCTIONS = 10;
const MAX_SUMMARY = 2000;
const MIN_CHANGE_NOTE = 10;

/** Returns an error message, or null when the draft is valid. Mirrors the server. */
export function validateDeliverableDraft(
  spec: DeliverableSpec | null | undefined,
  draft: DeliverableDraft,
  options: { resubmission?: boolean } = {},
): string | null {
  const kind = spec?.kind ?? "WEB_LINK";
  const required = new Set(requiredFieldsForSpec({ ...(spec ?? {}), kind }));
  const allowed = new Set(allowedFields(kind));

  const value = (field: DeliverableField) => {
    switch (field) {
      case "ACCESS_URL":
        return draft.accessUrl.trim();
      case "VERSION":
        return draft.version.trim();
      case "PLATFORM":
        return draft.platform;
      case "OS":
        return draft.os;
      case "INSTRUCTIONS":
        return draft.instructions.trim();
      case "CREDENTIALS":
        return draft.credentials.trim();
      case "LABEL":
        return draft.label.trim();
      case "SUMMARY":
        return draft.summary.trim();
    }
  };

  for (const field of required) {
    if (!value(field)) return `${DELIVERABLE_FIELD_LABELS[field]} is required`;
  }

  const title = draft.title.trim();
  if (!title) return "A submission title is required";
  if (title.length > MAX_TITLE) return `Title must be ${MAX_TITLE} characters or fewer`;

  const url = draft.accessUrl.trim();
  if (!url) return "Access / download link is required";
  if (url.length > MAX_URL) return `Link must be ${MAX_URL} characters or fewer`;
  if (!isHttpUrl(url)) return "Access / download link must be a valid http(s) URL";

  const instructions = draft.instructions.trim();
  if (instructions) {
    if (instructions.length < MIN_INSTRUCTIONS) {
      return `Instructions must be at least ${MIN_INSTRUCTIONS} characters`;
    }
    if (instructions.length > MAX_TEXT) {
      return `Instructions must be ${MAX_TEXT} characters or fewer`;
    }
  }

  if (draft.version.trim().length > MAX_VERSION) {
    return `Version must be ${MAX_VERSION} characters or fewer`;
  }
  if (draft.credentials.trim().length > MAX_CREDENTIALS) {
    return `Credentials must be ${MAX_CREDENTIALS} characters or fewer`;
  }
  if (allowed.has("LABEL") && !draft.label.trim()) {
    return "Describe the deliverable";
  }
  if (draft.summary.trim().length > MAX_SUMMARY) {
    return `Summary must be ${MAX_SUMMARY} characters or fewer`;
  }
  const whatChanged = draft.whatChanged.trim();
  if (options.resubmission) {
    if (whatChanged.length < MIN_CHANGE_NOTE) {
      return `Describe what changed (at least ${MIN_CHANGE_NOTE} characters)`;
    }
  }
  if (whatChanged.length > MAX_SUMMARY) {
    return `Change note must be ${MAX_SUMMARY} characters or fewer`;
  }

  return null;
}

/** Build the socket payload for a submission (omits empty optional fields). */
export function toDeliverablePayload(draft: DeliverableDraft) {
  return {
    kind: draft.kind,
    title: draft.title.trim(),
    accessUrl: draft.accessUrl.trim(),
    instructions: draft.instructions.trim(),
    ...(draft.version.trim() ? { version: draft.version.trim() } : {}),
    ...(draft.platform ? { platform: draft.platform } : {}),
    ...(draft.os ? { os: draft.os } : {}),
    ...(draft.credentials.trim() ? { credentials: draft.credentials.trim() } : {}),
    ...(draft.label.trim() ? { label: draft.label.trim() } : {}),
    ...(draft.summary.trim() ? { summary: draft.summary.trim() } : {}),
    ...(draft.whatChanged.trim() ? { whatChanged: draft.whatChanged.trim() } : {}),
  };
}
