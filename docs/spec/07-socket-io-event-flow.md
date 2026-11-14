## 7. Socket.io Event Flow

### 7.1 Event Summary

| Event | Direction | Required payload | Ack | Side effects | Broadcasts |
|---|---|---|---|---|---|
| `join_project` | C→S | `{ projectId, userId? }` | — | Joins room; loads project (+ milestones, offers/selection as applicable); replays history | `project_updated`, `message_history`, `offers_updated` (to caller/room as applicable) |
| `send_message` | C→S | `{ projectId, content, senderId?, type?, payload? }` | `{ ok, message }` | Inserts `Message`; scope trigger special-case. **Pre-funding composer allowed only for client + selected builder during offer negotiation; always allowed when `ACTIVE` (and subject to role/room rules).** | `new_message` (room) |
| `approve_scope` | C→S | `{ projectId, userId?, payload?, messageId? }` | `{ ok, project }` (or `{ ok: false, error, code, openBidsCount, openBidsLimit }`) | **Approve & Publish:** server normalizes scope/milestones/total (30/40/30, 3 milestones), persists blueprint, enforces client **open-for-bids limit** (max 3 `OPEN_FOR_BIDS`), then sets `OPEN_FOR_BIDS` (open for offers) | `message_updated` (scope), `project_updated`, `new_message` |
| `submit_offer` | C→S | `{ projectId, builderId, totalCents, longTermAmountCents?, longTermCadence?, longTermNotes?, milestoneDueDates?, platformTargets, slotOverrides? }` | `{ ok, offer }` | Creates builder’s **single** `SUBMITTED` offer (auto-calc milestones snapshot). `platformTargets` (ordered, unique) define a uniform v2 deliverable bundle propagated to every milestone (with optional per-slot label/notes `slotOverrides`); rejected if builder already has **3 accepted/active (`ACTIVE`) projects**. | `offers_updated`, `new_message` (offer widget/system) |
| `revise_offer` | C→S | `{ offerId|projectId, builderId, ...terms incl. platformTargets?/slotOverrides? }` | `{ ok, offer }` | Updates terms on builder’s offer when allowed (`SUBMITTED`; or selected/unfinalized `SELECTED` pre-accept). Terms are **frozen while `FINAL`** (unfinalize first). Rebuilds the uniform v2 bundle snapshot. | `offers_updated`, `new_message` |
| `withdraw_offer` | C→S | `{ offerId|projectId, builderId }` | `{ ok, offer }` | Sets offer `WITHDRAWN` (final for project in MVP) when allowed (`SUBMITTED`) | `offers_updated`, `new_message` |
| `select_offer` | C→S | `{ projectId, offerId, clientId }` | `{ ok, project, offer }` | Sets project selection; chosen offer `SELECTED`, other non-terminal offers `BLOCKED` | `offers_updated`, `project_updated`, `new_message` |
| `update_offer_terms` | C→S | `{ projectId, offerId, actorId, totalCents?, longTerm*, milestoneDueDates?, platformTargets?, slotOverrides? }` | `{ ok, offer }` | Negotiation term edits (total→recalc, long-term costs, due dates, platform targets/bundle) for the selected builder while `SELECTED`. **Rejected while `FINAL`** (unfinalize first). | `offers_updated`, `new_message` |
| `mark_offer_final` | C→S | `{ projectId, offerId, builderId }` | `{ ok, offer }` | Builder marks selected offer `FINAL` (terms/bundle frozen and ready for decision). Rejected if the offer lacks a complete deliverable bundle. | `offers_updated`, `new_message` |
| `unfinalize_offer` | C→S | `{ projectId, offerId, builderId }` | `{ ok, offer }` | Builder-only. Reopens a `FINAL` selected offer to `SELECTED` (pre-accept, `OPEN_FOR_BIDS`, unfunded) so terms/bundle can be edited; selection/blocked offers preserved. Requires re-finalize before acceptance. No funding movement. | `offers_updated`, `project_updated`, `new_message` |
| `cancel_negotiation` | C→S | `{ projectId, clientId }` | `{ ok, project }` | Clears selection; selected offer reverts to `SUBMITTED` retaining terms; blocked offers reopen (choosable) | `offers_updated`, `project_updated`, `new_message` |
| `accept_offer` | C→S | `{ projectId, offerId, clientId }` | `{ ok, project, payment, clientSecret, offer }` | Accepts **final** offer: applies agreed terms/due dates and copies the agreed v2 bundle to every project milestone (`deliverableSpec`), assigns builder, rejects other offers, funds escrow | `offers_updated`, `project_updated`, `new_message` |
| `submit_demo` | C→S | `{ projectId, milestoneId, senderId?, bundle, whatChanged? }` | `{ ok, message, latePenalty, revisionOverdue? }` | Submits/resubmits a **v2 bundle** for a milestone, validated server-side against the locked milestone `deliverableSpec`. `bundle.slots` must cover every contracted target (one pinned slot per target; kind/platform/OS server-derived and locked). Each slot deliverable requires `title`, `accessUrl` (HTTP(S)), `instructions` (+ optional `version`/`credentials`/`summary`). Resubmissions/changes-requested require bundle-level `whatChanged`. Applies due-date late penalty; sets `demoUrl` to the first slot URL and records current `DEMO_WIDGET` (`specVersion: 2`, bundle payload, mirrored `demoUrl/accessUrl`). For **changes-requested** resubmissions targets the same milestone; soft 24h revision window is non-blocking but overdue resubmission is flagged. Persists a `SYSTEM` message for resubmission only. | `new_message`, `milestone_updated`, `project_updated` (as applicable) |
| `reject_demo` | C→S | `{ projectId, milestoneId, reason, userId? }` | `{ ok, milestone }` | Client-only (project owner) for **Initial/Final Demo** current submissions. Requires reason; sets `CHANGES_REQUESTED` with `revisionRequestedAt` (resets per rejection) and `revisionReason`; does **not** release funds. Emits audit `SYSTEM` message. | `new_message`, `milestone_updated`, `project_updated` |
| `approve_milestone` | C→S | `{ milestoneId, userId? }` | `{ ok, milestone }` | Client-only; approves/releases the **current, non-rejected** reviewable demo submission. Releases via escrow (milestones transfer funds; 30/40/30). On a non-idempotent release emits a persisted `SYSTEM` outcome message (“approved and released” when released, or “approved; transfer pending” when transfer is pending); idempotent already-released approvals do not emit a new chat message. May complete project when all 3 milestones released/completed. Guarded to reject approval when changes are requested or submission is not current. | `new_message` (on non-idempotent release), `milestone_updated`, `project_updated` |
| `cancel_project` | C→S | `{ projectId, userId? }` | `{ ok, project, refundPercent, refundAmount }` | Computes refund tier; sets `CANCELLED`, refund fields; inserts `SYSTEM` message | `project_updated`, `new_message` |
| `request_extension` | C→S | `{ projectId, userId? }` | `{ ok, project }` | Adds 48h to deadline (or now); sets `extensionRequested` (post-acceptance/`ACTIVE` flow) | `project_updated` |
| `submit_rating` | C→S | `{ projectId, rating 1–5, feedback?, userId? }` | `{ ok, project }` | Validates completed/cancelled; stores score/feedback | `project_updated`, `new_message` |
| `submit_onboarding` | C→S | `{ userId, ecosystems[], portfolioUrls[], rulesAccepted }` | `{ ok, user }` | Updates builder profile; clears `probationary` | — |
| `new_message` | S→C | Message record | — | — | room |
| `project_updated` | S→C | `{ project }` incl. milestones/selection context | — | — | room/caller |
| `offers_updated` | S→C | `{ projectId, offers, selectedOfferId }` | — | — | room/caller (visibility-filtered as needed) |
| `milestone_updated` | S→C | `{ milestone }` | — | — | room |

> **Compatibility:** legacy `claim` and prior single-`WIDGET` offer/fund flow are superseded by Offer events; `WIDGET` rendering may be derived from Offers during migration.

### 7.2 Project State Machine

```mermaid
stateDiagram-v2
    [*] --> SCOPING: project created
    SCOPING --> OPEN_FOR_BIDS: approve_scope / Approve & Publish
    OPEN_FOR_BIDS --> ACTIVE: accept_offer (accepted FINAL offer funded)
    ACTIVE --> COMPLETED: all milestones RELEASED/COMPLETED
    SCOPING --> CANCELLED: cancel_project
    OPEN_FOR_BIDS --> CANCELLED: cancel_project
    ACTIVE --> CANCELLED: cancel_project
    COMPLETED --> [*]
    CANCELLED --> [*]
```

> Offer selection/negotiation/finalization and negotiation-cancel occur while the project remains `OPEN_FOR_BIDS` (no funding). `accept_offer` applies agreed terms, assigns builder, rejects other offers, and funds escrow (mock activates; real Stripe may remain pending until funded). No exclusive first-claim step.

### 7.3 Primary Happy Path (sequence)

```mermaid
sequenceDiagram
    actor Client
    actor B1 as Builder A
    actor B2 as Builder B
    participant UI as React SPA
    participant S as Socket.io Server
    participant DB as PostgreSQL (Prisma)

    Client->>UI: Create plan, describe, refine with AI (SCOPE_WIDGET)
    Client->>UI: Edit/accept blueprint
    UI->>S: approve_scope (Approve & Publish)
    S->>DB: normalize scope/milestones, project → OPEN_FOR_BIDS
    S-->>UI: project_updated, new_message

    B1->>UI: Review published plan, submit initial offer
    UI->>S: submit_offer
    B2->>UI: Submit initial offer
    UI->>S: submit_offer
    S->>DB: create Offers (one per builder)
    S-->>UI: offers_updated

    Client->>UI: Compare offers, choose Builder A
    UI->>S: select_offer
    S->>DB: A=SELECTED, B=BLOCKED, project.selectedOfferId set
    S-->>UI: offers_updated, project_updated

    Note over Client,B1,UI: Negotiation (client + selected builder): chat + term edits
    Client->>UI: Discuss/adjust total, long-term costs, due dates
    UI->>S: send_message / update_offer_terms
    B1->>UI: Mark Final Offer
    UI->>S: mark_offer_final
    S-->>UI: offers_updated, new_message

    alt Client accepts final offer
        Client->>UI: Accept & Fund
        UI->>S: accept_offer(offerId)
        S->>DB: apply terms/due dates, assign builder, reject other offers, fund escrow
        S-->>UI: project_updated (ACTIVE), offers_updated, new_message
    else Client cancels negotiation
        Client->>UI: Cancel negotiation
        UI->>S: cancel_negotiation
        S->>DB: clear selection, A→SUBMITTED (terms kept), B unblocked
        S-->>UI: project_updated, offers_updated
    end

    Note over S,DB: Post-acceptance: demos, milestone approvals (30/40/30), completion
```

### 7.4 Handler Details

#### `join_project`
- Requires `projectId`; joins room.
- Emits `project_updated` (incl. milestones/selection context as applicable) and `message_history` to caller; emits `offers_updated` when offers are relevant.

#### `send_message`
- Requires `projectId` and `content`; scope trigger `[TRIGGER_SCOPE_GENERATION]` persists `SCOPE_WIDGET` (see §8).
- **Composer gating (server-enforced):** freeform `TEXT` messages allowed when project is `ACTIVE`, or when sender is the **client or selected builder** during an active negotiation/selection/final-decision window pre-funding; otherwise rejected (prevents premature/unscoped chat). System/widget emissions follow their specific handlers.

#### `approve_scope` (Approve & Publish)
- Requires `projectId`. Normalizes scope payload and project milestones/total to fixed 3 milestones (Initial Demo, Final Demo, Deployment at 30/40/30), persists blueprint/total. Agreement is implicit at final-offer acceptance (not a milestone).
- Enforces client **open-for-bids limit**: if the client already has **≥ 3** projects in `OPEN_FOR_BIDS` (including negotiating/selected pre-funding), publish is rejected with a clear error/count (`CLIENT_OPEN_BIDS_LIMIT_REACHED`) and no state change. `SCOPING` drafts are not limited; slots free on `ACTIVE`/`CANCELLED`.
- On success sets `OPEN_FOR_BIDS` (published/open for offers), emits `message_updated` (if applicable), `project_updated`, and `SYSTEM` message.

#### `submit_offer`
- Builder-only for an `OPEN_FOR_BIDS` project. Enforces **one active offer per builder** (`@@unique(projectId,builderId)` / equivalent) and the **accepted-active project limit**: builders with **3 `ACTIVE` projects** (`builderId` assigned, offers accepted) cannot submit offers on new project plans. Computes milestones snapshot from `totalCents` (30/40/30, 3 milestones, read-only), stores long-term cost terms (informational), proposed milestone due dates, and a uniform v2 deliverable bundle derived from `platformTargets` (scope-derived defaults when omitted). Creates `SUBMITTED` offer; emits `offers_updated`.

#### `revise_offer`
- Builder-only, own offer. Allowed while offer is `SUBMITTED` (or selected/unfinalized `SELECTED` after `unfinalize_offer`, pre-accept). **Rejected while `FINAL`** (terms/bundle frozen; unfinalize first). Updates terms (total→recalc, long-term costs, due dates, `platformTargets`/bundle) and emits `offers_updated`.

#### `withdraw_offer`
- Builder-only, own offer. Allowed while `SUBMITTED` (not selected/blocked). Sets `WITHDRAWN` (**final for that project in MVP**); emits `offers_updated`.

#### `select_offer`
- Client-only (project owner). Requires choosable `SUBMITTED` offer and no conflicting accepted state. Sets `project.selectedOfferId`, marks chosen offer `SELECTED`, marks other non-terminal offers `BLOCKED`; emits `offers_updated`, `project_updated`, `SYSTEM` message.

#### `update_offer_terms`
- Negotiation edits by the **selected builder**: adjust `totalCents` (milestones recalculated), long-term costs, milestone `dueDate`s, and `platformTargets`/bundle on the selected `SELECTED` offer. **Rejected while `FINAL`** (terms/bundle frozen; unfinalize first). Emits `offers_updated`.

#### `mark_offer_final`
- Builder-only (selected builder). Marks selected offer `FINAL` with finalized timestamp; terms and the deliverable bundle freeze as the decision-ready snapshot. Rejected if the offer lacks a complete bundle. Emits `offers_updated`, `SYSTEM` message.

#### `unfinalize_offer`
- Builder-only (selected builder). Reopens a `FINAL` offer to `SELECTED` while the project is `OPEN_FOR_BIDS` and unfunded (pre-accept), preserving selection and other blocked offers so terms/bundle can be edited; requires `mark_offer_final` again before acceptance. No undo-fund/re-fund. Emits `offers_updated`, `project_updated`, `SYSTEM` message.

#### `cancel_negotiation`
- Client-only. Clears selection: previously selected offer reverts to `SUBMITTED` **retaining last terms**; `BLOCKED` offers return to `SUBMITTED` (choosable). Emits `offers_updated`, `project_updated`, `SYSTEM` message.

#### `accept_offer`
- Client-only. Requires specified offer to be `FINAL` (and selected) for the project.
- Applies agreed terms: set `project.totalEscrow`, sync project milestones (3 milestones: Initial/Final/Deployment, amounts 30/40/30, titles/order), apply negotiated `dueDate`s, and copy the agreed uniform v2 bundle to each milestone’s `deliverableSpec`; assign `project.builderId` from offer.
- Marks offer `ACCEPTED`, sets `project.acceptedOfferId`, marks other offers `REJECTED`.
- Calls `fundEscrow` (mock activates; real Stripe may return pending intent/client secret). Enforces probationary cap server-side.
- Emits `offers_updated`, `project_updated`, `SYSTEM`/message as applicable. Ack includes `{ project, offer, payment, clientSecret }`.

#### `submit_demo`
- Requires `projectId` and `milestoneId`. Validates a v2 `bundle` against the milestone’s locked `deliverableSpec` (exact slot-per-target coverage; kind/platform/OS pinned by contract; per-slot `title`, HTTP(S) `accessUrl`, `instructions`; bundle-level `whatChanged` required on resubmission/changes-requested). No legacy `demoUrl`-only submissions. Applies existing due-date late penalty: `dueDate && now > dueDate ? round(amount * 0.05) : 0`.
- Creates a new `DEMO_WIDGET` submission for the milestone and records it as the **current** demo (`demoUrl` mirrors first slot, current submission ref). Payload includes `specVersion: 2`, `submittedAt`, `bundle` (slots + optional `whatChanged`), mirrored `demoUrl`/`accessUrl`, and late/revision flags. Sets pending/reviewable state (e.g. `IN_PROGRESS`) for a normal submission.
- **Resubmission (changes requested):** when the milestone is in `CHANGES_REQUESTED` (demo review scope: **Initial/Final Demo**), submission targets the **same milestone**, creates a new current `DEMO_WIDGET` bundle, and transitions state back to reviewable; the **soft 24h revision window** (`revisionRequestedAt + 24h`, reset per rejection) does **not** block submission, but resubmission after the target is flagged as overdue in state/audit (and surfaced in ack/payload). Emits a persisted `SYSTEM` message (`Demo resubmitted` / overdue variant) for resubmission only.
- Emits `new_message`, `milestone_updated` (and `project_updated` as applicable). Server must validate builder/ownership/eligibility per project rules. `milestone_updated` is a state-sync event (clients must not synthesize chat bubbles from it).

#### `reject_demo`
- Requires `projectId`, `milestoneId`, and non-empty `reason`. **Client-only** (project owner), `ACTIVE` project, demo-review milestones (**Initial/Final Demo**) with a current reviewable submission.
- Does **not** release funds. Sets milestone to `CHANGES_REQUESTED`, records `revisionReason`, and sets/resets `revisionRequestedAt` (soft 24h target) for the **current** submission. Only the current submission is rejectable.
- Emits a single persisted audit `SYSTEM` message (`Changes requested: <reason>`) plus `milestone_updated`/`project_updated` as applicable (no additional synthetic “milestone updated” chat bubble).

#### `approve_milestone`
- Requires `milestoneId`. **Client-only** (project owner). Approves/releases only the **current, non-rejected** reviewable demo submission; must reject if milestone is `CHANGES_REQUESTED` or submission is not current/actionable.
- Releases via escrow: milestone amounts transfer (mock auto-pay, real Stripe may stay pending). Clears/settles review state as appropriate and, when funds are actually released, sets `RELEASED` + `releasedAt`; completes project when all 3 milestones released/completed.
- Emits `milestone_updated` and `project_updated` as applicable. On a non-idempotent approval emits exactly one persisted `SYSTEM` outcome message: `"<title> approved and released."` when the milestone is released, or `"<title> approved; transfer pending."` when a transfer/payment is pending (and not yet released). Idempotent already-released approvals do not emit a new chat message. `milestone_updated` is state-sync only (clients must not synthesize chat bubbles from it).

#### `submit_onboarding`
- Requires `userId`. Updates builder profile fields; sets `probationary: false`; no GitHub/portfolio verification.

#### `cancel_project`
- Computes refund tier by highest released stage (≥3→60%, ≥2→90%, else 100%), sets `CANCELLED` + refund fields, emits updates/system message.

#### `request_extension`
- Post-acceptance/`ACTIVE` flow: adds 48h to deadline (or now), sets `extensionRequested`; no approval flow (`extensionGranted` unused).

#### `submit_rating`
- Integer 1–5 after `COMPLETED` or `CANCELLED`; stores score/feedback and emits system message.

---

