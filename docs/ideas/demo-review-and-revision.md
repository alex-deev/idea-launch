# Demo Accept/Reject with Soft 24h Revision Window (Lightweight)

## Problem Statement
**How might we** give clients clear quality control over submitted demos—so they can **accept or reject with actionable feedback** and builders can **resubmit an updated demo for the same milestone within a soft 24-hour window**—making the review loop fast, explicit, and auditable without blocking progress if the window is missed?

## Recommended Direction
**Direction A — Lightweight review loop (minimal state).** Add an explicit client **Reject** action alongside **Approve** on the current demo for a milestone (Initial Demo / Final Demo). Reject requires a clear reason, records a `SYSTEM` audit message, and moves that demo into a **“changes requested”** state with a **soft 24-hour update target** (visible countdown/label; if missed, shown as overdue but the builder can still resubmit). Approving continues to release escrow as today; rejecting never releases funds.

Builders respond by **resubmitting an updated demo for the same milestone** (not advancing to the next stage), producing a new demo submission tied to that milestone that the client can then **accept or reject again**. To stay lightweight, “history” relies primarily on the existing chat trail of demo/system messages plus just-enough state to identify the **current actionable submission**, its feedback/reason, and the revision-request timestamp/target—so actions (approve/reject, submit-next targeting, and UI state) are unambiguous on refresh/rejoin without introducing a full versioned review model.

This fits the current stack/patterns (Socket.io events + acks, `DEMO_WIDGET` messages, milestone status/`demoUrl`, `SYSTEM` audit messages, client-only approve in `DemoWidget`) and optimizes for the chosen goal: **client quality control** and **clear feedback + fast revision**, with the 24h window treated as a visible expectation rather than a hard gate.

## Key Assumptions to Validate
- [ ] **Reason + soft 24h is enough** — requiring a rejection reason and showing a soft 24h target drives timely, actionable revisions without hard enforcement. *Test:* run a few reject→resubmit cycles and check time-to-update and feedback clarity.
- [ ] **“Current actionable demo” is unambiguous** — clients/builders can always tell which submission is pending review and old demo widgets can’t trigger the wrong action. *Test:* reject/resubmit multiple times, refresh/rejoin, and verify only the latest submission is actionable and approve/reject targets the right one.
- [ ] **Resubmit targets the rejected milestone** — when changes are requested, the builder’s submit flow updates that same milestone (not the next unreleased stage). *Test:* request changes on Initial/Final Demo and confirm “submit next demo”/resubmission applies to that milestone.
- [ ] **Multiple cycles stay manageable (lightweight)** — allowing iterative reject→resubmit is understandable without a full version/history UI; chat + current-state indicators suffice. *Test:* perform 2–3 cycles on one milestone and review comprehension/audit trail.
- [ ] **Soft lateness is the right consequence** — marking missed 24h updates as overdue/visible (no block/penalty) matches expectations. *Test:* let the window lapse and confirm both sides interpret status correctly.

## MVP Scope
**In**
- **Client actions (demo milestones):** **Approve** or **Reject** on the current demo (Initial Demo, Final Demo). **Reject requires a reason**; Approve preserves existing escrow-release behavior and must only apply to the current, non-rejected submission.
- **Builder resubmission:** resubmit an **updated demo for the same milestone** while changes are requested (and after, per soft window), producing an updated demo submission the client can review again (accept/reject again).
- **Soft 24h revision window:** on each rejection, record request time and show a **24h target** (countdown/“due in…”), then **“overdue by…”** if missed; builder can still update late and lateness is **visible/flagged** (no hard block).
- **State & audit (lightweight):** track enough state to know the milestone’s current demo review status, latest submission, rejection reason, and revision-request timing; emit clear `SYSTEM` audit messages for reject/request-changes and resubmission/late updates; ensure correct behavior on refresh/rejoin.
- **UI:** update `DemoWidget`/chat demo rendering to reflect pending-review vs changes-requested vs approved (current submission), show reason and 24h/overdue indicator, and adjust submit targeting so resubmits apply to the changes-requested milestone. Server-side guards to prevent approving/releasing a rejected or non-current demo.

**Out**
- **Hard enforcement/escalation:** no auto-cancel, penalties, payout changes, or forced outcomes when the 24h window is missed.
- **Full versioned review system:** no dedicated per-submission history model/UI beyond the chat trail + current-state indicators (deeper “Direction B” versioning deferred).
- **Scope/flow changes:** no changes to pricing/escrow math, milestone amounts/order, non-demo milestones, or unrelated negotiation/delivery flows.
- **Advanced feedback tooling:** no threaded inline annotations, attachments, or structured review checklists beyond a required reason (and optional simple categorization only if trivial).
- **Notifications beyond in-app:** no email/push/real-time reminders outside existing in-app/chat/socket updates.

## Not Doing (and Why)
- **Hard 24h deadline or automatic penalties/escalation** — window is intentionally **soft** (visible, allows late update) to keep momentum and avoid premature disputes; enforcement can be revisited with evidence.
- **First-class versioned demo history model/UI now** — chosen direction favors **minimal state**; chat history + current-state indicators is sufficient for MVP and reduces schema/socket complexity.
- **Limiting/capping rejection cycles in MVP** — allowing iterative reject→resubmit supports convergence; caps/escape hatches add policy complexity best informed by real usage.
- **Changing escrow, payout, or milestone business rules** — accept still means release as today; reject is a review control, not a financial rule change.
- **Reject/review for every project artifact/state** — scoped to **demo submissions for demo milestones** to solve the stated problem without broad workflow redesign.

## Resolved Defaults (for planning)
- **Demo milestone scope:** **Initial Demo** and **Final Demo** only (stages 2–3). Agreement and Deployment are out of scope for this reject/revision flow in MVP.
- **24h window:** **Soft target that resets on each rejection**, counted from rejection time. Builder may resubmit late; lateness is **visible/flagged** (no hard block/escalation).
- **State representation:** persist lightweight review state on the **Milestone** for reliable rejoin/guards (e.g. review status/`CHANGES_REQUESTED`, `revisionRequestedAt`, `revisionReason`, and reference to the current demo submission/message) plus demo-submission context in `DEMO_WIDGET` payloads as needed. Add a client-only **`reject_demo`** socket event (milestone-scoped, **reason required**) with server-enforced transitions; **approve only** the current, non-rejected submission.
- **Current submission/history:** each resubmission creates a new `DEMO_WIDGET` for the same milestone; only the **latest/current** submission is actionable, older submissions render as historical/superseded. **Resubmit targets the changes-requested milestone** (not the next stage).
- **Missed-window visibility/audit:** show rejection reason and “update requested — due in … / overdue by …” on the demo widget (and near submit when relevant); emit clear `SYSTEM` audit messages (e.g. changes requested, demo resubmitted, resubmitted overdue) — exact copy finalized in implementation.

## Open Questions (remaining)
- **Schema details:** exact field/enum names and whether to extend `MilestoneStatus` (e.g. add `CHANGES_REQUESTED`) vs track review state via fields; migration approach in this workspace (Prisma dev DB / `db push` vs migration file).
- **Actionable submission derivation:** authoritative source for “current” demo (milestone `currentDemoMessageId`/pointer vs deriving latest by milestone from messages) and how `DemoWidget` receives/derives historical vs current state.
- **UI copy/placement:** final labels for “Request changes/Reject”, reason prompt UX, and precise placement of the soft 24h/overdue indicator (widget, milestone context, submit area) consistent with existing UI patterns.
- **Overdue resubmission signaling:** whether to emit a distinct `SYSTEM` audit message when a resubmission arrives after the 24h soft target (recommended) and its exact wording.
- **Multiple-cycle guardrails (later):** if cycles become excessive, introduce soft nudges/escalation (out of MVP) rather than hard limits.
