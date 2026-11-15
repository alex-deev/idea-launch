# Builder Funds-Release Bubbles & Deployment Completion Popup

## Problem Statement
**How might we** make it unmistakable to builders when escrow funds are released for their work, and give both parties clear closure (with payout details for the builder) when the final Deployment milestone is approved?

## Recommended Direction
**D1 — Event-driven, enriched release payload.**
- **Per-milestone system bubbles (1A):** on every milestone release emit a `SYSTEM` chat bubble mixing current phrasing with data, e.g. `"<Milestone> approved. $X.XX released (ref: mock_...)"`; if pending, `"<Milestone> approved; transfer pending. $X.XX (ref: mock_...)"`.
- **Deployment-complete popup (2A, even if pending), once in-session on live event (4A):**
  - **Builder (full, 3A):** completion confirmation, **amount released now**, **total released** (sum of released milestones), **payment/transfer status + mocked reference**, dismissible. Details remain in chat/project/payment state.
  - **Client (minimal):** simple **“project done” celebration** popup (congrats/closure only).

## Key Assumptions to Validate
- [ ] Client approves milestones; builder receives bubble/popup via room broadcast (not ack-only). Verify `approve_milestone` auth/flow.
- [ ] Payload provides milestone amount, total released, and payment status with a mocked reference for completed/pending transfers.
- [ ] Once-in-session per release id avoids duplicates; chat/project state preserves the record.

## MVP Scope
- **In:** enhanced bubble copy (amount + mocked ref, pending explicit), enriched Deployment release event, builder full payout modal (amount now, total released, status, mocked ref), client minimal celebration modal, once-per-event in-session, correct pending/completed states.
- **Out:** re-show on reload, out-of-session notifications, receipts, escrow/payment logic changes, full payout popup for non-deployment milestones.

## Not Doing (and Why)
- **Re-show on reload** — once-on-event; state/chat keep record.
- **Client payout breakdown** — celebration-only.
- **Payment mechanics changes** — UX over existing `releaseMilestone` outcomes.
