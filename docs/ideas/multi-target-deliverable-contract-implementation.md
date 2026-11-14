# Multi-Target Deliverable Contract — Implementation Draft (Direction A, v2-only)

Companion to `docs/ideas/multi-target-deliverable-contract.md`. This freezes the concrete model, rules, and change list so implementation can proceed without guessing. It **replaces** the prior single-deliverable (v1) model: there is **no legacy/v1 support** at runtime—specs, payloads, APIs, and UI are v2 bundle-only.

## 1. Decisions (frozen for implementation)

| Topic | Decision |
|---|---|
| Direction | **A — Uniform multi-target bundle:** same project `platformTargets[]` required on **every** milestone (Initial/Final/Deployment). |
| Lock | Freeze deliverable/target terms at **`mark_offer_final`** (pre-accept). **`unfinalize_offer`** (builder-only) → `FINAL` back to `SELECTED` to edit, then re-finalize. No funding movement (accept/fund is a later step). |
| Submission | **Bundle per submission**, one pinned slot per required target; builder supplies content only. **Kind/target/platform/OS server-derived & UI-locked**; hard-block kind/platform/OS mismatch and missing targets. |
| Review | **Atomic bundle** (MVP): single current submission, approve/reject/`CHANGES_REQUESTED` + soft-24h/reset apply to the bundle as a unit. |
| Legacy model | **Removed.** No v1 spec/payload parsing or dual paths. All deliverable contracts and demo submissions use the v2 bundle format; existing data is migrated/normalized to v2 (see §7). |

## 2. Target taxonomy & compatibility matrix (day-1)

Canonical `PlatformTarget` ids are the project-level contract. Each resolves to exactly one **pinned slot** (kind + concrete platform/OS). The set is uniform across all 3 milestones.

| `PlatformTarget` | Pinned `kind` | Pinned `platform` | Pinned `os` | Builder-entered content (per slot) | Required content |
|---|---|---|---|---|---|
| `WEB` | `WEB_LINK` | — | — | `title`, `accessUrl`, `instructions`, `version?`, `credentials?`, `summary?` | `title`, `accessUrl`, `instructions` |
| `MOBILE_IOS` | `MOBILE_BUILD` | `IOS` | — | same core | core + platform fixed to `IOS` |
| `MOBILE_ANDROID` | `MOBILE_BUILD` | `ANDROID` | — | same core | core + platform fixed to `ANDROID` |
| `MOBILE_CROSS_PLATFORM` | `MOBILE_BUILD` | `CROSS_PLATFORM` | — | same core | core + platform fixed to `CROSS_PLATFORM` |
| `DESKTOP_WINDOWS` | `DESKTOP_BUILD` | — | `WINDOWS` | same core | core + os fixed to `WINDOWS` |
| `DESKTOP_MACOS` | `DESKTOP_BUILD` | — | `MACOS` | same core | core + os fixed to `MACOS` |
| `DESKTOP_LINUX` | `DESKTOP_BUILD` | — | `LINUX` | same core | core + os fixed to `LINUX` |

Notes:
- A project may declare **one or more** targets (e.g. `[WEB, MOBILE_IOS, MOBILE_ANDROID]`). Order is preserved and defines tab/slot order.
- Targets are **enumerable/pinnable** (no “unspecified” platform target). The v2 contract models **platform targets only** (matrix above); non-platform kinds (`SOURCE_PACKAGE`/`DOCUMENT`/`OTHER`) are out of the v2 deliverable model. If needed later, extend the matrix with explicit pinning semantics for them.
- `version` (builder-entered artifact version) remains **optional** for every slot (existing rule). Instructions minimum-length/URL validation rules carry over per slot.

## 3. Data model (v2 bundle)

### 3.1 Offer terms / snapshot (`Offer.milestonesSnapshot`, per milestone item)
Extend items with a versioned bundle spec (uniform across all 3 items in a v2 offer):

```json
{
  "stageNumber": 1,
  "title": "Initial Demo",
  "amount": 30000,
  "releasePercent": 30,
  "dueDate": null,
  "deliverable": {
    "version": 2,
    "targets": ["WEB", "MOBILE_IOS"],
    "slots": [
      { "target": "WEB", "kind": "WEB_LINK", "label": null, "notes": null },
      { "target": "MOBILE_IOS", "kind": "MOBILE_BUILD", "platform": "IOS", "label": null, "notes": null }
    ]
  }
}
```

- `targets` is the ordered project-level set (must be identical for stages 1–3). `slots.length === targets.length` and each `slot.target`/pin matches the matrix row.
- `label`/`notes` remain optional per slot (informational/review hints), **not** builder-editable at submit. `requiredFields` are not stored; derive from the matrix at validation/UI time (single source of truth).
- `version: 2` and `targets`/`slots` are **required**; malformed or non-bundle specs are rejected.

### 3.2 Milestone (`Milestone.deliverableSpec`)
- On `accept_offer`, copy the accepted snapshot’s per-milestone v2 bundle `deliverable` into `milestone.deliverableSpec` (same shape as 3.1).
- **`demoUrl` (string field):** set to the **first slot’s `accessUrl`** on each (re)submission as a summary/primary link; authoritative data lives in the `DEMO_WIDGET` payload bundle. (Never null for a valid submission.)
- `currentDemoMessageId`, `revisionRequestedAt`, `revisionReason`, status transitions remain **bundle-atomic** and unchanged in meaning.

No new Prisma columns are strictly required (JSON fields carry v2); add a migration only if implementation chooses explicit columns (e.g. denormalized target count) — prefer JSON-only for MVP.

### 3.3 `DEMO_WIDGET` message payload (v2)
Stored on the message created by `submit_demo`:

```json
{
  "milestoneId": "…",
  "specVersion": 2,
  "submittedAt": "…iso…",
  "bundle": {
    "slots": [
      {
        "target": "WEB",
        "deliverable": {
          "kind": "WEB_LINK",
          "title": "…",
          "accessUrl": "https://…",
          "instructions": "…",
          "version": "…?",
          "credentials": "…?",
          "summary": "…?"
        }
      },
      {
        "target": "MOBILE_IOS",
        "deliverable": {
          "kind": "MOBILE_BUILD",
          "platform": "IOS",
          "title": "…",
          "accessUrl": "https://…",
          "instructions": "…"
        }
      }
    ]
  },
  "whatChanged": "…",        
  "demoUrl": "https://…",     
  "accessUrl": "https://…",   
  "latePenalty": 0,
  "revisionOverdue": false,
  "resubmission": false
}
```

- `bundle.slots` order/targets **must exactly match** the milestone’s locked spec slots. `kind`/`platform`/`os` in stored deliverables are the **derived, pinned** values (server-authored).
- `whatChanged` required when resubmission/changes-requested (per existing rule) — **per-bundle** field; copy encourages per-target detail (see UI draft).
- `demoUrl`/`accessUrl` mirrored to the first slot; message `content` is a short summary (e.g. `"Bundle submitted (2 targets)"`). Payloads are **v2-only** (`specVersion: 2`, `bundle` required).

## 4. Validation & enforcement rules

### 4.1 Term authoring / finalization / acceptance (server)
- **Project targets declared:** for a v2 offer, `platformTargets` is a non-empty ordered list of unique, known `PlatformTarget` ids. Each milestone’s `deliverable.slots` must be identical in targets/pins and consistent with the matrix (no missing slot, no unknown target, no kind/platform/os drift).
- **`mark_offer_final` (gate):** reject if offer not selected/eligible or if v2 bundle is incomplete/inconsistent (actionable error pointing to milestone/target). On success, set `FINAL` + `finalizedAt` (existing) — terms become frozen.
- **Frozen while `FINAL`:** `revise_offer` and `update_offer_terms` **reject** term/spec/target mutations when offer status is `FINAL` (client/builder must un-finalize first). (Read/compare unaffected.)
- **`unfinalize_offer` (new):** builder-only, offer must be `FINAL` and the project’s selected offer. Transition `FINAL → SELECTED`, clear `finalizedAt`, **do not** change selection, `BLOCKED` others, project status, or any funding; emit `offers_updated`, `project_updated`, and a `SYSTEM` message (“Final offer reopened for revision”). Idempotent/invalid-state cases return clear errors.
- **Edits while `SELECTED`:** allow builder negotiation edits (including deliverable bundle/targets) when the selected offer is in an editable pre-final state (`SELECTED`, unfinalized) per existing negotiation rules — extend current `revise`/`update_offer_terms` guards accordingly (today `revise` is `SUBMITTED`-centric; align so post-unfinalize editing works without forcing withdraw/resubmit).
- **`accept_offer`:** requires `FINAL` (unchanged). Copies accepted v2 bundle specs to milestones, applies amounts/due dates, assigns builder, rejects others, funds escrow as today.

### 4.2 Submission (`submit_demo`, server-derived/locked, v2-only)
- Resolve the milestone’s locked v2 bundle spec (`deliverableSpec.version === 2` with `targets`/`slots`); reject if missing or invalid.
- Expect a v2 `bundle` payload with `slots` covering **every** required target (no extras, no omissions; order-insensitive match by target, stored in spec order).
- For each slot, validate **content only** against the pinned matrix row (title, http(s) `accessUrl`, instructions min-length, optional version/credentials/summary length/format). **Reject** any client-sent `kind`/`platform`/`os` that conflicts with the pinned values (server derives and stores pinned values regardless).
- `whatChanged` required on resubmission/`CHANGES_REQUESTED` (existing rule), bundle-level.
- Enforce builder ownership, project ACTIVE, milestone not released/completed, current-submission rules unchanged and **atomic**. No `demoUrl`-only or single-`deliverable` fallback path.

## 5. Socket / API surface changes

| Event | Change |
|---|---|
| `submit_offer` | **Require** `platformTargets` (ordered, unique, known) and normalize to a uniform v2 bundle across all 3 milestones (default/mapping from scope inference where possible; reject if targets cannot be resolved). |
| `revise_offer` / `update_offer_terms` | Accept bundle/target edits (v2-only); **reject when offer `FINAL`**; permit when editable (`SUBMITTED` or `SELECTED` unfinalized per 4.1). Keep targets uniform across milestones. |
| `mark_offer_final` | Enforce v2 completeness/consistency gate (4.1); freezes terms. |
| **`unfinalize_offer` (new)** | `{ projectId, offerId, builderId }` → builder-only, `FINAL`→`SELECTED`, clear `finalizedAt`, emit `offers_updated`/`project_updated` + `SYSTEM`. Ack `{ ok, offer }`. |
| `accept_offer` | Copy accepted v2 bundle specs to milestones. |
| `submit_demo` | **Require** v2 `bundle` payload; reject `demoUrl`-only/single-`deliverable` submissions. Return ack as today. |
| `join_project` / `offers_updated` | Include bundle/targets in offer snapshots so clients can render tabs/locks (visibility rules unchanged). |

REST: no new endpoints required for MVP unless offer/project serializers need to expose bundle fields (ensure project/milestone/offer payloads include v2 `deliverableSpec`/snapshot bundles where already returned). Remove any legacy demo/offer fields from responses that are no longer produced.

## 6. UI changes (client)

- **`client/src/lib/deliverables.ts`:** replace single-deliverable model with `PlatformTarget` taxonomy, matrix helpers (derive pinned slot from target, required content fields), v2 spec/bundle types & validators, bundle↔form mappers (remove v1-only types/paths).
- **`OfferWidget.tsx` (term sheet):** select project `platformTargets[]` (propagated uniformly) and show pinned per-milestone slots (read-only kind/target, optional label/notes). Disable/hide term edits when offer is `FINAL`; add builder **“Unfinalize / Edit terms”** action (calls `unfinalize_offer`) and preserve re-finalize flow. Display targets in offer comparison/summary.
- **`DemoSubmitDialog.tsx`:** render **fixed tabs/slots** from the locked v2 spec with target/kind pinned read-only; content inputs per slot only; bundle-level `whatChanged` on resubmit; client-side validation mirrors server (all slots, per-slot required content).
- **`DemoWidget.tsx`:** render bundle tabs per target with per-slot deliverable details; atomic status/actions (approve/request-changes) against the bundle/current submission.
- **`Chat.tsx`:** pass bundle-aware `currentDemoSubmission`/spec into dialog & widget; compute/propagate default `platformTargets` from scope for offer drafting; handle `unfinalize_offer` ack/errors in offer actions. Remove legacy single-demo submit/render assumptions.

## 7. Migration (v2-only, no legacy runtime)

- **No dual-path runtime:** remove v1 parsing/validation/rendering branches; all code assumes v2 bundle specs and payloads.
- **Data migration (required):** convert persisted data to v2 in a Prisma migration (or an explicit one-time backfill run as part of deploy):
  - **`Milestone.deliverableSpec` / `Offer.milestonesSnapshot[].deliverable`:** map v1 → v2 single-slot bundle. Derive `PlatformTarget` from v1 kind/pinned fields: `WEB_LINK`→`WEB`; `MOBILE_BUILD`+`IOS`→`MOBILE_IOS`, `ANDROID`→`MOBILE_ANDROID`, else `MOBILE_CROSS_PLATFORM`; `DESKTOP_BUILD`+`WINDOWS|MACOS|LINUX`→matching desktop target (default `DESKTOP_WINDOWS` if unknown); `SOURCE_PACKAGE`/`DOCUMENT`/`OTHER`→`WEB` slot (or another chosen default) **or** flag for manual fix—pick a deterministic default and document it. Carry over `label`/`notes`.
  - **`DEMO_WIDGET` messages:** convert v1 payload `{deliverable,demoUrl,...}` → v2 `{specVersion:2,bundle:{slots:[{target,deliverable:normalized}]},...}` using the milestone/spec target; set `content`/mirrored `demoUrl`/`accessUrl` consistently. Messages without a resolvable spec default to a single `WEB` slot from `demoUrl`/content.
  - Ensure all 3 milestones per offer/project share the same `targets` set (uniform propagation); if inconsistent, normalize to a deterministic union/default.
- **Seed:** rewrite `server/prisma/seed.ts` to create v2 bundles/`platformTargets` (include a multi-target example, e.g. `[WEB, MOBILE_IOS]`) and remove v1-shaped data.
- **`demoUrl`:** continue to store the first slot’s `accessUrl` as the summary field. Dev environments may alternatively be reset/reseeded if acceptable, but the migration must leave any non-empty DB in a valid v2 state.

## 8. Review copy (MVP, atomic bundle)

- **Client header/helper:** “Review each target tab. This milestone is approved or sent back **as a whole bundle**—every agreed target must meet the contract.”
- **Per-target checklist:** correct pinned target/format; access works (links/credentials); follows instructions; meets milestone intent for that target.
- **Request changes:** required **bundle-level** reason; prompt calls out which target(s) and what to fix. Sets `CHANGES_REQUESTED`, soft 24h (reset per request), non-blocking/flagged overdue.
- **Resubmit:** required **bundle-level** “what changed / how to verify” encouraging per-target detail; targets/kinds fixed (read-only), content editable per tab.
- **Approval:** atomic for the current bundle (existing release semantics).

## 9. Implementation slices (suggested order)

1. **Matrix + types + validators** (`server/src/lib/deliverables.ts`, `client/src/lib/deliverables.ts`): targets, pinning, v2-only spec/bundle parse/validate/derive (remove v1 types/branches).
2. **Data migration + seed** (`server/prisma/migrations/*`, `server/prisma/seed.ts`): convert existing specs/snapshots/`DEMO_WIDGET` payloads to v2 bundles and rewrite seed to v2/multi-target.
3. **Offer terms & gates** (`server/src/lib/offers.ts`, `socket.ts`): v2 snapshot build/merge, `mark_offer_final` gate, `unfinalize_offer`, freeze checks in revise/update, acceptance copy.
4. **Submission path** (`socket.ts`): v2 bundle `submit_demo` (derive/lock/validate, store bundle payload, atomic state, `demoUrl` summary mirror) — remove legacy submission handling.
5. **Client term sheet** (`OfferWidget.tsx`, `Chat.tsx`): target selection/propagation, locked-at-Final UI, unfinalize action.
6. **Client submit/review** (`DemoSubmitDialog.tsx`, `DemoWidget.tsx`, `Chat.tsx`): tabbed bundle UX, atomic actions, copy.
7. **Spec/docs sync:** update `docs/spec/05,07,09,11,13` and `AGENTS.md` to reflect v2-only bundle contract/gates/events.
8. **Verify:** `npm run build`, `npm run lint -w client`, `npm run db:seed`, manual smoke (multi-target offer → finalize/unfinalize → accept → bundle submit/resubmit/approve).

## 10. Resolved open questions (from idea doc)

- **Un-finalize:** builder-only; `FINAL → SELECTED` (recommended, preserves selection/blocked offers), pre-accept/no funding movement, updates + `SYSTEM` message, re-finalize required.
- **Bundle payload/storage:** multi-item bundles with single-current-submission atomic semantics, **v2-only** (no v1 compatibility).
- **Review copy:** atomic bundle with per-target detail encouraged (draft in §8). Target taxonomy/matrix fixed for day-1 in §2; revisit only if new target types are needed. Legacy model support removed per product decision.
