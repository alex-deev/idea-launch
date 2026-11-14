/**
 * Deliverable contract for demo/milestone submissions.
 *
 * The builder declares what each milestone delivers in the offer terms. The
 * accepted offer's snapshot is copied onto the milestone (`deliverableSpec`)
 * and `submit_demo` validates against that spec, so the submission form and
 * the server enforce the same shape.
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

export const DELIVERABLE_PLATFORMS = ["ANDROID", "IOS", "CROSS_PLATFORM"] as const;
export type DeliverablePlatform = (typeof DELIVERABLE_PLATFORMS)[number];

export const DELIVERABLE_OSES = ["WINDOWS", "MACOS", "LINUX"] as const;
export type DeliverableOs = (typeof DELIVERABLE_OSES)[number];

export interface DeliverableSpec {
  kind: DeliverableKind;
  label: string | null;
  requiredFields: DeliverableField[];
  notes: string | null;
}

type KindRules = {
  allowed: DeliverableField[];
  required: DeliverableField[];
};

const KIND_RULES: Record<DeliverableKind, KindRules> = {
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

export function isDeliverableKind(value: unknown): value is DeliverableKind {
  return typeof value === "string" && (DELIVERABLE_KINDS as readonly string[]).includes(value);
}

export function isDeliverablePlatform(value: unknown): value is DeliverablePlatform {
  return (
    typeof value === "string" && (DELIVERABLE_PLATFORMS as readonly string[]).includes(value)
  );
}

export function isDeliverableOs(value: unknown): value is DeliverableOs {
  return typeof value === "string" && (DELIVERABLE_OSES as readonly string[]).includes(value);
}

export function deliverableAllowedFields(kind: DeliverableKind): DeliverableField[] {
  return [...KIND_RULES[kind].allowed];
}

export function deliverableRequiredFields(kind: DeliverableKind): DeliverableField[] {
  return [...KIND_RULES[kind].required];
}

export function defaultDeliverableSpec(kind: DeliverableKind = "WEB_LINK"): DeliverableSpec {
  return {
    kind,
    label: null,
    requiredFields: deliverableRequiredFields(kind),
    notes: null,
  };
}

/**
 * Best-effort mapping from the scope intake's app kinds to a default
 * deliverable kind. Suggestions only — the offer remains authoritative.
 */
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

function clampText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Parse a spec from offer terms. Accepts a bare kind string for convenience.
 * `requiredFields` is additive-only: the kind's defaults always stay required.
 */
export function parseDeliverableSpec(value: unknown): DeliverableSpec | null {
  if (isDeliverableKind(value)) return defaultDeliverableSpec(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  if (!isDeliverableKind(raw.kind)) return null;

  const label = clampText(raw.label, 120);
  const notes = clampText(raw.notes, 500);
  const allowed = new Set(KIND_RULES[raw.kind].allowed);
  const required = new Set<DeliverableField>(KIND_RULES[raw.kind].required);
  if (Array.isArray(raw.requiredFields)) {
    for (const field of raw.requiredFields) {
      if (typeof field === "string" && (DELIVERABLE_FIELDS as readonly string[]).includes(field)) {
        const typed = field as DeliverableField;
        // Additive only: a spec cannot remove a default requirement.
        if (allowed.has(typed)) required.add(typed);
      }
    }
  }

  return {
    kind: raw.kind,
    label,
    requiredFields: [...required],
    notes,
  };
}

/** Parse an array of specs by index (0-2) or by stage number (1-3). */
export function parseDeliverableSpecs(value: unknown): Array<DeliverableSpec | null> {
  const result: Array<DeliverableSpec | null> = [null, null, null];
  if (Array.isArray(value)) {
    for (let i = 0; i < 3; i++) result[i] = parseDeliverableSpec(value[i]);
    return result;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (let i = 0; i < 3; i++) {
      const stage = i + 1;
      result[i] = parseDeliverableSpec(obj[String(stage)] ?? obj[stage] ?? obj[String(i)]);
    }
  }
  return result;
}

export type NormalizedDeliverable = {
  kind: DeliverableKind;
  title: string;
  accessUrl: string;
  instructions: string;
  version?: string;
  platform?: DeliverablePlatform;
  os?: DeliverableOs;
  credentials?: string;
  label?: string;
  summary?: string;
  whatChanged?: string;
};

export type DeliverableValidationResult =
  | { ok: true; value: NormalizedDeliverable }
  | { ok: false; error: string };

const MAX_TITLE = 120;
const MAX_URL = 2000;
const MAX_VERSION = 120;
const MAX_CREDENTIALS = 500;
const MAX_TEXT = 4000;
const MIN_INSTRUCTIONS = 10;
const MAX_SUMMARY = 2000;
const MIN_CHANGE_NOTE = 10;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validate a submitted deliverable against the agreed spec.
 * Strict: fields that are not valid for the kind are rejected rather than dropped.
 */
export function validateDeliverableSubmission(
  spec: DeliverableSpec | null | undefined,
  input: unknown,
  options: { resubmission?: boolean; enforceRequired?: boolean } = {},
): DeliverableValidationResult {
  const resolved = spec ?? defaultDeliverableSpec("WEB_LINK");
  const raw = asRecord(input);
  if (!raw) return { ok: false, error: "A structured deliverable submission is required" };

  if (raw.kind !== undefined && raw.kind !== resolved.kind) {
    return {
      ok: false,
      error: `This milestone expects a ${resolved.kind.replaceAll("_", " ").toLowerCase()} submission`,
    };
  }

  const allowed = new Set<DeliverableField>(deliverableAllowedFields(resolved.kind));
  const required = new Set<DeliverableField>([
    ...deliverableRequiredFields(resolved.kind),
    ...resolved.requiredFields,
  ]);

  const provided: Partial<Record<DeliverableField, string>> = {};
  const fieldSources: Array<[DeliverableField, unknown]> = [
    ["ACCESS_URL", raw.accessUrl],
    ["VERSION", raw.version],
    ["PLATFORM", raw.platform],
    ["OS", raw.os],
    ["INSTRUCTIONS", raw.instructions],
    ["CREDENTIALS", raw.credentials],
    ["LABEL", raw.label],
    ["SUMMARY", raw.summary],
  ];
  for (const [field, value] of fieldSources) {
    const text = readText(value);
    if (!text) continue;
    if (!allowed.has(field)) {
      return { ok: false, error: `Field ${field} is not valid for this deliverable kind` };
    }
    provided[field] = text;
  }

  for (const field of required) {
    if (options.enforceRequired === false) break;
    if (!provided[field]) {
      return { ok: false, error: `${field.replaceAll("_", " ").toLowerCase()} is required` };
    }
  }

  const title = readText(raw.title);
  if (!title) return { ok: false, error: "A submission title is required" };
  if (title.length > MAX_TITLE) {
    return { ok: false, error: `title must be ${MAX_TITLE} characters or fewer` };
  }

  const accessUrl = provided.ACCESS_URL;
  if (!accessUrl) return { ok: false, error: "access url is required" };
  if (accessUrl.length > MAX_URL) {
    return { ok: false, error: `access url must be ${MAX_URL} characters or fewer` };
  }
  if (!isHttpUrl(accessUrl)) {
    return { ok: false, error: "access url must be a valid http(s) link" };
  }

  const instructions = provided.INSTRUCTIONS;
  if (instructions !== undefined) {
    if (instructions.length < MIN_INSTRUCTIONS) {
      return { ok: false, error: `instructions must be at least ${MIN_INSTRUCTIONS} characters` };
    }
    if (instructions.length > MAX_TEXT) {
      return { ok: false, error: `instructions must be ${MAX_TEXT} characters or fewer` };
    }
  }

  const version = provided.VERSION;
  if (version && version.length > MAX_VERSION) {
    return { ok: false, error: `version must be ${MAX_VERSION} characters or fewer` };
  }

  const credentials = provided.CREDENTIALS;
  if (credentials && credentials.length > MAX_CREDENTIALS) {
    return { ok: false, error: `credentials must be ${MAX_CREDENTIALS} characters or fewer` };
  }

  if (resolved.kind === "OTHER" && !provided.LABEL) {
    return { ok: false, error: "describe the deliverable kind for OTHER submissions" };
  }

  let platform: DeliverablePlatform | undefined;
  if (provided.PLATFORM) {
    if (!isDeliverablePlatform(provided.PLATFORM)) {
      return { ok: false, error: "platform must be ANDROID, IOS, or CROSS_PLATFORM" };
    }
    platform = provided.PLATFORM;
  }

  let os: DeliverableOs | undefined;
  if (provided.OS) {
    if (!isDeliverableOs(provided.OS)) {
      return { ok: false, error: "os must be WINDOWS, MACOS, or LINUX" };
    }
    os = provided.OS;
  }

  const summary = readText(raw.summary);
  if (summary && summary.length > MAX_SUMMARY) {
    return { ok: false, error: `summary must be ${MAX_SUMMARY} characters or fewer` };
  }

  const whatChanged = readText(raw.whatChanged);
  if (options.resubmission) {
    if (!whatChanged || whatChanged.length < MIN_CHANGE_NOTE) {
      return {
        ok: false,
        error: `describe what changed (at least ${MIN_CHANGE_NOTE} characters) for a resubmission`,
      };
    }
  }
  if (whatChanged && whatChanged.length > MAX_SUMMARY) {
    return { ok: false, error: `what changed must be ${MAX_SUMMARY} characters or fewer` };
  }

  return {
    ok: true,
    value: {
      kind: resolved.kind,
      title,
      accessUrl,
      instructions: instructions ?? "",
      ...(version ? { version } : {}),
      ...(platform ? { platform } : {}),
      ...(os ? { os } : {}),
      ...(credentials ? { credentials } : {}),
      ...(provided.LABEL ? { label: provided.LABEL } : {}),
      ...(summary ? { summary } : {}),
      ...(whatChanged ? { whatChanged } : {}),
    },
  };
}
