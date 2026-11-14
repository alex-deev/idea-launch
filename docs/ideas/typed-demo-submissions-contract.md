# Typed Demo Submissions — Contract Draft

Companion to [`typed-demo-submissions.md`](./typed-demo-submissions.md). Defines the **deliverable taxonomy**, the **per-milestone requirement matrix**, and the proposed **offer-terms / `submit_demo` payload contract**. No implementation yet.

## 1. Deliverable taxonomy

Six kinds. `kind` is the only thing the submit flow must branch on; everything else is a field.

| Kind | Use when | Primary artifact |
|---|---|---|
| `WEB_LINK` | Website, web app, hosted preview/production build | URL |
| `MOBILE_BUILD` | Android/iOS app build (APK, IPA, TestFlight, unlisted store link) | Download/install link |
| `DESKTOP_BUILD` | Windows/macOS/Linux installer or portable binary | Download link |
| `SOURCE_PACKAGE` | Repo/archive the client must run or inspect (branch/tag) | Repo/archive link |
| `DOCUMENT` | Spec, design file, report, deck — reviewable document | Document link |
| `OTHER` | Anything that fits none of the above | Link + free-text description |

Design rules:
- **Small and closed.** Six kinds cover websites, mobile, desktop, source, documents and escape hatch. New kinds are a deliberate change, not a per-offer invention.
- **`OTHER` still requires a link and a description** — no freeform dumps.
- **Kind is declared in the offer terms, not chosen ad hoc at submit time.** A builder may pick `WEB_LINK` for the Initial Demo and `MOBILE_BUILD` for the Final Demo (e.g. clickable prototype first, native build later).

## 2. Per-kind field matrix

Field keys are stable strings so the same allowlist can drive client rendering, server validation, and audit.

| Field | Key | Type | `WEB_LINK` | `MOBILE_BUILD` | `DESKTOP_BUILD` | `SOURCE_PACKAGE` | `DOCUMENT` | `OTHER` |
|---|---|---|---|---|---|---|---|---|
| Kind | `kind` | enum | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Submission title | `title` | string ≤120 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Access/download URL | `accessUrl` | http(s) URL ≤2000 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Version / build / branch | `version` | string ≤120 | opt | opt | opt | opt | opt | opt |
| Mobile platform | `platform` | `ANDROID` \| `IOS` \| `CROSS_PLATFORM` | – | ✓ | – | – | – | – |
| Desktop OS | `os` | `WINDOWS` \| `MACOS` \| `LINUX` | – | – | ✓ | – | – | – |
| Access / install / review instructions | `instructions` | string 10–4000 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gated-access credentials | `credentials` | string ≤500 | opt | opt | opt | opt | opt | opt |
| Kind clarification (required for `OTHER`) | `label` | string ≤120 | – | – | – | – | – | ✓ |
| First-submission summary | `summary` | string ≤2000 | opt | opt | opt | opt | opt | opt |
| Resubmission change note | `whatChanged` | string 10–2000 | ✓\* | ✓\* | ✓\* | ✓\* | ✓\* | ✓\* |

`✓` = required, `opt` = optional, `–` = not accepted.  
`\*` `whatChanged` is **flow-required**, not kind-required: mandatory when the milestone is `CHANGES_REQUESTED` or already has a `currentDemoMessageId` (resubmission).

`version` is **optional for every kind** (build number, branch/tag, release label). The form may nudge builders to include it for `MOBILE_BUILD`, `DESKTOP_BUILD`, or `SOURCE_PACKAGE`, but it never blocks submission.

Proposed optional per-kind additions (deferred, listed for completeness): `testCredentials`/`seedData` (`WEB_LINK`), `deviceRequirements` (`MOBILE_BUILD`), `checksum` (`DESKTOP_BUILD`).

## 3. Offer terms contract (source of truth)

### 3.1 Type shape

```ts
export const DELIVERABLE_KINDS = [
  "WEB_LINK", "MOBILE_BUILD", "DESKTOP_BUILD",
  "SOURCE_PACKAGE", "DOCUMENT", "OTHER",
] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

export const DELIVERABLE_FIELDS = [
  "ACCESS_URL", "VERSION", "PLATFORM", "OS",
  "INSTRUCTIONS", "CREDENTIALS", "LABEL", "SUMMARY",
] as const;
export type DeliverableField = (typeof DELIVERABLE_FIELDS)[number];

export interface DeliverableSpec {
  kind: DeliverableKind;
  label?: string | null;              // required when kind === "OTHER"
  requiredFields?: DeliverableField[]; // builder override; must be a subset of the kind default
  notes?: string | null;               // what the client should focus on / acceptance hints
}
```

### 3.2 Where it lives

`Offer.milestonesSnapshot` is already `Json`, so per-stage specs need **no migration on `Offer`**:

```ts
// Offer.milestonesSnapshot[i]
{
  stageNumber: 1,
  title: "Initial Demo",
  amount: 30000,
  releasePercent: 30,
  dueDate: "2026-12-01T00:00:00.000Z" | null,
  deliverable: {                 // NEW
    kind: "WEB_LINK",
    label: null,
    requiredFields: ["ACCESS_URL", "INSTRUCTIONS"],
    notes: "Focus review on checkout + auth",
  },
}
```

At acceptance, snapshot onto the milestone so the submit handler validates against what was agreed even if the offer is later de-referenced:

```prisma
model Milestone {
  // ...
  deliverableSpec Json?   // copied from the accepted offer in applyAcceptedOfferTerms
}
```

Additive + nullable → safe for existing rows. **Zero-migration alternative:** skip the column and resolve the spec via `project.acceptedOfferId → offer.milestonesSnapshot`. Recommended: the column, because it mirrors the existing `dueDate` copy and keeps `submit_demo` to one query.

### 3.3 Socket/event deltas

| Event | Delta |
|---|---|
| `submit_offer`, `revise_offer`, `update_offer_terms` | Accept `milestoneDeliverables?: Array<{ stageNumber?: number; kind; label?; requiredFields?; notes? }>` indexed 0–2 or by stage 1–3, mirroring `milestoneDueDates`. |
| `mark_offer_final` | Do **not** hard-block. Any stage without a spec gets the default for its inferred platform and is persisted before `FINAL`. |
| `accept_offer` → `applyAcceptedOfferTerms` | Copy `deliverable` from each snapshot item into `Milestone.deliverableSpec`. |
| `approve_scope` | Unchanged. Scope payload may gain `suggestedDeliverables` (derived from `appKinds`) for UI prefill only — never authoritative. |

Server helpers in `server/src/lib/offers.ts`:
- `parseDeliverableSpecs(value): Array<DeliverableSpec | null>` (mirrors `parseMilestoneDueDates`)
- `defaultDeliverableSpec(kind)`, `inferDeliverableKindFromAppKinds(appKinds, appKindOther)`
- `buildMilestonesSnapshot(totalCents, dueDates, deliverables)`
- `validateDeliverableSubmission(spec, input, { resubmission })` → `{ ok: true, value } | { ok: false, error }`

### 3.4 Suggestion map (`appKinds` → default kind)

| Scope `appKinds` | Default kind |
|---|---|
| Website, Web app | `WEB_LINK` |
| Mobile app | `MOBILE_BUILD` |
| Desktop app | `DESKTOP_BUILD` |
| API / backend | `SOURCE_PACKAGE`, or `DOCUMENT` for hosted API docs |
| Other / unknown | `WEB_LINK` |

This is a **prefill only**. The builder confirms or overrides per milestone in the term sheet; the offer is authoritative.

## 4. `submit_demo` payload contract

### 4.1 Request (client → server)

```ts
{
  projectId: string;
  milestoneId: string;
  deliverable: {
    kind: DeliverableKind;        // must equal milestone.deliverableSpec.kind
    title: string;
    accessUrl: string;            // http/https only
    instructions: string;
    version?: string;
    platform?: "ANDROID" | "IOS" | "CROSS_PLATFORM";
    os?: "WINDOWS" | "MACOS" | "LINUX";
    credentials?: string;
    label?: string;               // required when kind === "OTHER"
    summary?: string;
    whatChanged?: string;         // required on resubmission
  };
  // Legacy: demoUrl is still accepted and normalized to
  // { kind: milestone spec kind ?? "WEB_LINK", accessUrl: demoUrl, title: "<milestone> submission" }.
  demoUrl?: string;
}
```

### 4.2 Validation order (server)

1. Existing guards unchanged: project exists, `ACTIVE`, sender is assigned builder, milestone not `RELEASED`/`COMPLETED`, resubmission only for Initial/Final Demo.
2. Resolve spec: `milestone.deliverableSpec` → else default `{ kind: "WEB_LINK" }` (legacy row).
3. `deliverable.kind` must equal `spec.kind`. Unknown kind → reject.
4. Required fields for the kind (or `spec.requiredFields` subset) must be present and non-empty; `whatChanged` required when resubmitting.
5. Bounds: `title` ≤120, `accessUrl` ≤2000 and `http:`/`https:`, `instructions` 10–4000, `version` ≤120, `credentials` ≤500, `summary`/`whatChanged` ≤2000.
6. `kind === "OTHER"` requires `label`.
7. Reject fields not allowed for the kind (e.g. `os` on `WEB_LINK`) — prevents contract drift.
8. Existing late-penalty / `revisionOverdue` computation stays as-is.

### 4.3 Stored `DEMO_WIDGET` payload

```ts
{
  milestoneId: string;
  deliverable: {
    kind, title, accessUrl, instructions,
    version?, platform?, os?, credentials?, label?, summary?, whatChanged?,
  },
  // Back-compat mirrors for current consumers:
  demoUrl: string,         // === deliverable.accessUrl
  accessUrl: string,
  latePenalty: number,
  revisionOverdue: boolean,
  resubmission: boolean,
  specVersion: 1,
  submittedAt: string,     // ISO
}
```

Milestone update stays: `demoUrl = accessUrl`, `status = "IN_PROGRESS"`, `currentDemoMessageId = message.id`, clear `revisionRequestedAt`/`revisionReason`.

## 5. UI mapping

| Component | Change |
|---|---|
| `OfferWidget` `TermSheet` | Per milestone: kind select (defaulted from scope `appKinds`), optional `label` (required for `OTHER`), optional `notes`. Builder-only, same audit trail as other term edits. |
| New `DemoSubmitDialog` | Opened by the existing Chat CTA instead of emitting immediately. Renders fields from `milestone.deliverableSpec`; pre-fills from the current submission (latest `DEMO_WIDGET` payload / `milestone.demoUrl`); shows `revisionReason` + soft-24h state; requires `whatChanged` on resubmit; validates locally with the same rules. |
| `Chat.tsx` | CTA opens the dialog; `submitDemo` replaced by dialog submit → `emitAck("submit_demo", …)`. Next-demo/deadline logic unchanged. |
| `DemoWidget` | Render typed fields by kind: primary link button (“Open demo” / “Download build” / “View document”), version/platform/OS, instructions, change note, credential block with a visibility warning. Legacy payloads fall back to today’s single-link rendering + “Legacy submission” affordance. |
| `demo-review-and-revision.md` flow | Unchanged (accept / request changes, soft 24h, same milestone resubmit). |

## 6. Back-compat

- **Data:** `Milestone.deliverableSpec` nullable; `Offer.milestonesSnapshot` is `Json` so older snapshots simply lack `deliverable`.
- **Legacy milestone (no spec):** submit dialog falls back to `WEB_LINK` (URL + instructions); stored submission carries `kind: "WEB_LINK"`.
- **Legacy message (no `deliverable`):** `DemoWidget` uses existing `demoUrl` rendering, labelled legacy.
- **Legacy direct socket callers:** `demoUrl` remains accepted and normalized, so the current placeholder call keeps working during rollout.
- **No pricing/escrow/review-policy changes.**

## 7. Decisions still open

- **Credentials in chat-visible messages:** acceptable with a warning, or strip credentials and require them to be exchanged out-of-band? (Current proposal: allow, warn, cap length.)
- **Deployment milestone:** same typed contract at `Deployment` (it is submittable today but not reviewable), or display-only?
- **`requiredFields` overrides:** allow builders to *add* fields beyond the kind default (e.g. force `credentials` on a web demo)? Proposal: allow only additive requirements, never remove defaults.
- **`SOURCE_PACKAGE` label** for API/backend projects vs adding a seventh `API_ENDPOINT` kind later.
- **File uploads:** still deferred; revisit if link-hosted builds prove unacceptable in review.
