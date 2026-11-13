# Collapsible Offer & Terms with Builder-Owned Edits and Audit Notifications

## Problem Statement
**How might we** keep offer negotiation focused and auditable by making **Offer & Terms** a collapsible, negotiation-scoped panel above the composer and recording each meaningful offer change as a clear, centered chat notification—while ensuring **only the builder edits offer terms**?

## Recommended Direction
**Direction A — Focused MVP (collapsible bar + builder-owned terms + event notifications).**

- **Collapsible, negotiation-scoped panel (clutter reduction):** Show an **Offer & Terms** panel **above the composer only during `OPEN_FOR_BIDS`/negotiation**. Render it as a slim, collapsible summary bar (e.g. status/participants/context at a glance) that is **default collapsed** and expands on demand to reveal the full term sheet and actions. This keeps chat first while preserving quick access to terms. (Resonates with variations 2, 7.)
- **Builder-only term authorship (clarity/ownership):** **Only the builder** can create or modify term values — **submit, revise, and update terms** (total → auto-calculated 0/30/40/30 milestones, long-term costs, milestone due dates) and **mark final**. The **client cannot modify term values**; the client retains **select offer, cancel negotiation, and accept final offer**. Client term-edit controls are removed from the UI and term-edit actions from the client are rejected server-side; clients request changes via chat. (Resonates with variation 5; primary success here is audit/clarity of who changes terms.)
- **Specific, simple, number-free audit notifications (audit trail):** Emit a **centered green chat (`SYSTEM`) notification** for each meaningful offer event. Legends are **descriptive but simple, with no numbers** (no amounts/dates). Proposed catalog:
  - `submit_offer` → **“Offer submitted”**
  - `revise_offer` → **“Offer revised”**
  - `update_offer_terms` → **“Offer terms updated”**
  - `withdraw_offer` → **“Offer withdrawn”**
  - `select_offer` → **“Offer selected for negotiation”**
  - `mark_offer_final` → **“Offer marked final”**
  - `cancel_negotiation` → **“Negotiation cancelled”**
  - `accept_offer` → **“Offer accepted”**
  (Deduplicate/align with any existing system messages so each event produces a clear, consistent legend; see Open Questions.) (Resonates with variation 6’s signal intent via specific events, kept simple for MVP.)

**Primary beneficiaries:** both client and builder (reduced clutter, trustworthy change log). Implement within current React/Express/Socket.io/Prisma patterns (`client/src/components/Chat.tsx`, `client/src/components/OfferWidget.tsx`/Offers UI, `server/src/socket.ts`).

## Key Assumptions to Validate
- [ ] **Builder-only term edits don’t block deals** — clients can negotiate effectively by requesting changes in chat while the builder applies term updates. *Test:* run a select → negotiate → finalize flow and observe friction/turn count.
- [ ] **Default-collapsed is discoverable** — users notice and expand the panel when needed during `OPEN_FOR_BIDS`/negotiation. *Test:* confirm the collapsed summary/affordance is obvious and key actions remain reachable.
- [ ] **Number-free, specific legends are sufficient** — “what changed” is understood from event type + current term sheet without amounts/dates in chat. *Test:* review a negotiation transcript for ambiguity.
- [ ] **Per-event notifications aren’t noisy** — emitting a message per meaningful event (incl. each terms update/revision) stays readable. *Test:* simulate rapid back-and-forth; if noisy, consider later batching/de-dupe (Direction C).

## MVP Scope
**In**
- Collapsible **Offer & Terms** UI above the composer, **only in `OPEN_FOR_BIDS`/negotiation**, **default collapsed**, with clear expand/collapse and a compact summary when collapsed.
- **Builder-only** term editing (UI + server enforcement): builder can submit/revise/update terms and mark final; client cannot edit term values. Client keeps select, cancel negotiation, accept.
- **Centered green `SYSTEM` notifications** for the catalog above — specific, simple, **no numbers** — emitted on the corresponding offer events; consistent with/normalized against existing messages.
- Role-aware presentation (builder sees edit/mark-final affordances; client sees read-only terms + decision actions) consistent with current Offer-driven workflow.

**Out**
- Showing the panel (or a post-accept summary) in `ACTIVE`/other states beyond the negotiation scope.
- Auto-expand/state-aware heuristics or remembered expand/collapse state (Direction B).
- Notification batching, de-duplication, or granular-vs-high-signal filtering (Direction C, later if noisy).
- Amounts/dates/diffs in notification text; in-panel change history/timeline.
- Changes to pricing rules (0/30/40/30), escrow/funding semantics, or unrelated flows.

## Not Doing (and Why)
- **Client term editing** — removed to make term authorship unambiguous and the audit trail trustworthy (client requests changes in chat instead); avoids dual-editor ambiguity.
- **Numbers in notifications** — keeps legends simple/scannable and avoids duplicating or drifting from the term sheet; details remain in Offer & Terms.
- **Always-visible/always-on panel** — default-collapsed, negotiation-scoped placement directly targets clutter.
- **Smart auto-expand or notification batching (B/C)** — added complexity/edge cases now; revisit only if MVP proves discovery or noise issues.

## Open Questions
- **Exact legend wording & mapping:** confirm the final catalog strings and replace/merge any existing overlapping `SYSTEM` messages (e.g. current submit/select/final/cancel/accept/withdraw texts) so each event is emitted once with the agreed legend.
- **Collapsed summary content:** what minimum info should the collapsed bar show (e.g. offer status, builder/client context, total, “terms updated” cue) without adding clutter?
- **Term updates while `FINAL`:** keep current behavior (a term change clears final/requires re-finalization) and emit “Offer terms updated” — confirm this matches expectations.
- **Post-accept visibility:** should accepted terms remain viewable elsewhere in `ACTIVE` (read-only), or is negotiation-only sufficient for MVP?
