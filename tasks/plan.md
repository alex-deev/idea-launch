# Implementation Plan: Demo Accept/Reject with Soft 24h Revision (Direction A)

> Replaces the previous completed App kind intake plan. Source idea: [`docs/ideas/demo-review-and-revision.md`](../docs/ideas/demo-review-and-revision.md) (Direction A — lightweight review loop).

## Overview
Add client **accept/reject** controls for demo submissions on **Initial Demo** and **Final Demo** milestones. On rejection (reason required), the builder gets a **soft 24-hour** update window to **resubmit the same milestone**; the window **resets on each rejection** and lateness is **visible/flagged** (no hard block/escalation). Keep the implementation lightweight: minimal persisted review state, clear audit messages, and server-guarded actions so only the **current, non-rejected** submission can be approved/released.

## Task List Target
- Tasks tracked in `tasks/todo.md`.

## Architecture Decisions
- **Scope:** demo review/revision applies to **Initial Demo** and **Final Demo** only (stages 2–3). Agreement/Deployment excluded in MVP.
- **Client actions:** `approve_milestone` remains the escrow-release path (unchanged semantics) but is guarded to the **current, non-rejected** submission. New client-only **`reject_demo`** (milestone-scoped, reason required) records “changes requested” + `revisionRequestedAt` (soft 24h target, reset per rejection) and emits audit `SYSTEM` message.
- **Builder resubmission:** `submit_demo` (or equivalent path) must be able to resubmit for a **changes-requested milestone** (same milestone), creating a new `DEMO_WIDGET` message, updating current demo reference/URL, clearing/transitioning review state appropriately, and flagging if resubmitted after the soft 24h target (audit). “Submit Next Demo” UI targets the changes-requested demo milestone when present (not the next stage).
- **State (lightweight, persisted):** extend `Milestone` to store review state for rejoin/guards — planned approach: add `CHANGES_REQUESTED` to `MilestoneStatus` (and/or explicit fields) plus `revisionRequestedAt`, `revisionReason`, and a pointer to the current demo submission (e.g. `currentDemoMessageId`/URL as appropriate). Final field/enum names to be confirmed during implementation; update Prisma schema and sync DB (workspace typically uses `prisma db push`; add migration file if feasible/required by environment).
- **Current vs historical submissions:** each submission creates a new `DEMO_WIDGET` for the same `milestoneId`; only the **latest/current** is actionable. `DemoWidget`/chat rendering derives actionable vs historical/superseded from milestone review state/current pointer and message payload (older widgets must not approve/reject).
- **Soft 24h visibility:** compute target as `revisionRequestedAt + 24h`; show “update requested — due in … / overdue by …” (and reason) on the actionable demo widget and near the submit action when relevant; refresh periodically in UI. Lateness is informational (no block, no penalty change).
- **Audit messages:** centered green `SYSTEM` notifications for key events (changes requested w/o leaking sensitive amounts? reason shown appropriately, resubmitted, resubmitted overdue as applicable) consistent with existing audit style.

## Task List
See `tasks/todo.md` for the ordered, checkable task list and checkpoints.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Wrong submission approved/rejected (stale widgets) | High | Server guards + authoritative “current” demo pointer/state; render older widgets non-actionable/superseded. |
| Resubmit advances to next stage instead of same milestone | High | Make submit targeting milestone-aware (prefer changes-requested demo milestone) in client and validate in server. |
| Review state lost/inconsistent on rejoin/refresh | Med | Persist review fields on `Milestone` (and include in `project_updated`/milestone payloads); derive UI from state, not transient client memory. |
| Enum/schema migration friction in dev workspace | Med | Prefer minimal additive schema changes; sync with `prisma db push` (per workspace practice) and regenerate client; adjust if migration file required. |
| Multiple rapid cycles confuse state/timing | Med | Reset 24h target on each rejection; keep transitions server-enforced and idempotent where sensible; clear audit trail. |
| Approve path accidentally releases a rejected demo | High | Enforce in `approve_milestone` handler that milestone is current, reviewable (not changes-requested) and demo-submittable state before escrow release. |

## Open Questions (confirm during implementation)
- Exact Prisma field/enum names (e.g. `CHANGES_REQUESTED` status vs dedicated review fields) and DB sync method used.
- Authoritative “current” demo identifier (message id vs derived latest) and payload shape on `DEMO_WIDGET`.
- Final UI copy/placement for reject reason entry and soft-24h/overdue indicators (widget + submit area).
- Whether to emit a distinct `SYSTEM` message for “resubmitted (overdue)” vs normal resubmission.

## Assumptions
- Demo review scope limited to **Initial Demo** and **Final Demo** only.
- 24h is a **soft** target, **reset per rejection**; no hard block/penalty/escalation in MVP.
- Approve/release semantics unchanged except added guards; reject never releases funds.
- `BUSINESS_MODEL.md` remains untracked; no pricing/escrow math changes. No CI/tests exist; verify via builds/lint and manual smoke.