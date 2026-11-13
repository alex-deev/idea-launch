# Client Open-for-Bids Project Limit (Guided Quota)

## Problem Statement
**How might we** protect marketplace quality and builder attention by limiting each client to **3 projects open for bids** at a time—so clients focus on advancing a few serious plans—while keeping drafting/scoping frictionless and making the constraint visible, fair, and actionable?

## Recommended Direction
**Direction B — Guided quota experience (with explicit lifecycle rules).** Enforce a **hard, server-authoritative cap of 3** client-owned projects in **`OPEN_FOR_BIDS`** at the publish gate (`approve_scope` / “Approve & Publish”). Clients may continue creating and refining unlimited `SCOPING` drafts, but publishing is blocked when at cap with a clear, specific message and count. This directly prevents marketplace flooding while preserving exploration and preparation.

Wrap the hard gate in lightweight guidance so the limit feels predictable rather than punitive: surface **“Open for bids: X/3”** slot visibility, show a **gentle nudge at 2/3** (“1 slot left”), and at 3/3 provide **actionable guidance** on how to free a slot (e.g. accept/fund an offer so a project becomes `ACTIVE`, or cancel an open project so it becomes `CANCELLED`). Messaging should frame the rule consistently with builder capacity limits (focused projects, timely builder attention) so numeric parity is intentional.

Count **only** projects with `status = OPEN_FOR_BIDS` owned by the client (including projects selected/in negotiation but not yet funded, since they remain `OPEN_FOR_BIDS`). Slots free when a project transitions to **`ACTIVE`** (accepted/funded) or **`CANCELLED`**. Enforce on the server (`server/src/socket.ts`, `approve_scope`) as the source of truth, with UI reflecting state from existing project data (e.g. `client/src/components/ScopeWidget.tsx` publish flow and project/workspace views). If a client is already over the cap (grandfathered), block **new publishes** only until below the limit.

## Key Assumptions to Validate
- [ ] **Cap of 3 is the right threshold** — 3 `OPEN_FOR_BIDS` projects reduces noise while letting clients run a few serious plans in parallel. *Test:* observe publish blocks, slot churn, and builder/offer quality signals after rollout; compare to support/complaint feedback.
- [ ] **`OPEN_FOR_BIDS`-only counting matches intent** — including negotiating/selected-but-unfunded projects (still `OPEN_FOR_BIDS`) is understood and seen as fair; drafts (`SCOPING`) remaining unlimited is valued. *Test:* review edge cases with real flows (select/negotiate/cancel negotiation/accept/cancel) and confirm slot changes match expectations.
- [ ] **Guidance makes the hard block acceptable** — “X/3” visibility, 2/3 nudge, and clear “how to free a slot” reduce surprise and drop-off at publish. *Test:* usability pass on publish-at-cap and near-cap states; track failed publish attempts and recovery actions.
- [ ] **Server-side gate is sufficient** — checking the count in `approve_scope` (and any future publish path) prevents bypass despite UI staleness or concurrent actions. *Test:* attempt rapid/double publishes and publish with stale UI; confirm authoritative rejection and consistent state.
- [ ] **Freeing paths are clear in practice** — clients can and will free slots via **accept/fund → `ACTIVE`** or **cancel → `CANCELLED`** given in-product guidance. *Test:* verify users can identify and complete a slot-freeing action from the blocked state.

## MVP Scope
**In**
- **Server enforcement (authoritative):** in `approve_scope` (and any publish transition to `OPEN_FOR_BIDS`), reject when the client already has **≥ 3** projects with `status = OPEN_FOR_BIDS`; return a clear, specific error/ack (include count/limit context as useful).
- **Client UI — hard block:** prevent/disable “Approve & Publish” when at cap (and handle server rejection gracefully) with a clear message explaining the limit and current usage.
- **Client UI — slot visibility & nudge:** show **“Open for bids: X/3”** where relevant; display a gentle notice at **2/3** (“1 slot left”).
- **Client UI — actionable guidance at cap:** when blocked, explain how to free a slot (accept/fund an open project → `ACTIVE`, or cancel an open project → `CANCELLED`) and, where feasible, surface/link the client’s open projects occupying slots.
- **Lifecycle semantics:** count only `OPEN_FOR_BIDS` (incl. negotiating/selected pre-funding); slots free on `ACTIVE` or `CANCELLED`; drafts (`SCOPING`) unlimited; grandfather existing over-cap clients by blocking **new publishes** only.
- **Spec/docs alignment:** update affected `docs/spec/*` (e.g. business rules, socket/API/flow, frontend behavior) and `AGENTS.md`/`TECHNICAL_SPEC.md` as appropriate per repo convention.

**Out**
- **Capping drafts/creation:** no limit on creating or scoping `SCOPING` projects.
- **Alternative exposure/ranking schemes:** no “open but hidden/deprioritized” projects (#6-style) — the rule is a clear publish cap.
- **Configurable/admin-tuned limits or tiered caps:** fixed **3** for MVP (can be centralized as a constant, but no runtime config/UI).
- **Auto-closing, archiving, or unpublishing projects:** no new lifecycle transitions to force slots free; no changes to escrow/offer/pricing rules.
- **Notifications beyond in-app UI:** no email/push alerts about slot usage (beyond existing in-product state).

## Not Doing (and Why)
- **Limit `SCOPING` drafts or project creation** — drafting is low-cost and valuable; the marketplace-facing action is **publishing/opening for bids**, so gating publish (not ideation) targets the real problem.
- **Soft-only warning without enforcement** — would fail to protect builder attention/market quality; server-authoritative blocking is required for the stated goal.
- **Exposure/routing throttles instead of a count cap** — “open but unseen” is ambiguous and harder to explain/enforce than a simple, visible quota.
- **Variable/configurable or per-tier caps now** — adds policy/product complexity before validating that **3** is the right threshold; revisit with evidence.
- **Auto-remediation (auto-cancel/unpublish)** — destructive and surprising; clients should explicitly choose how to free a slot.

## Open Questions
- **Count source/consistency in UI:** derive “X/3” from existing polled project data in the workspace vs a dedicated count in publish/ack responses—how to keep it consistent with server truth at publish time?
- **Grandfathering details:** exact UX/copy when a client is already over 3 (legacy state) and tries to publish another—block with guidance until ≤2 open.
- **Slot-freeing completeness:** are `ACTIVE` and `CANCELLED` the only transitions that should free a slot given current/near-term flows (no unpublish path today)?
- **Copy/placement:** final wording and where to surface the counter/nudge/guidance (e.g. `ScopeWidget` approve area, project list/sidebar, both) for clarity without clutter.
- **Concurrency edge case:** is a simple server-side count check in `approve_scope` sufficient for MVP, or should publish be made transactionally guarded against rare double-publish races?
