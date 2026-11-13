# Client–Builder Offer Workflow (Multi-Offer, Negotiation, Final Acceptance)

## Problem Statement
**How might we** let clients confidently compare offers from multiple builders, refine terms with a chosen builder, and commit to a single funded “final” agreement — within the current Idea Launch architecture and milestone-escrow model?

## Recommended Direction
Adopt **V2 + V5 + V4-lite**: a **lean first-class `Offer` model** with **multi-builder bidding decoupled from exclusive claim**, and a **lightweight structured term sheet** for negotiation/finalization.

- **V2 (lean Offer record):** introduce an `Offer` entity tied to `project` + `builder` (one active offer per builder per project) capturing status, proposed/agreed `total` (milestones auto-derived 0/30/40/30, read-only), long-term cost terms, and milestone due dates. Offers are comparable, auditable, and enforceable (not just `WIDGET` payloads).
- **V5 (decouple bids from claim):** published plans are visible to eligible builders without exclusive claim; builders submit/maintain their single offer. Builder assignment/commitment is established through **selection and acceptance** of an offer (not first-claim).
- **V4-lite (structured terms, minimal UI):** negotiation centers on a small term sheet — **total** (recalculates milestones), **long-term costs** (separate), and **demo/deployment deadlines** (`dueDate`s) — with the builder able to mark a revision as **“Final offer”**. Chat remains available for discussion with the selected builder during negotiation (pre-funding) but terms of record live on the offer.

This preserves the platform’s strengths (AI-scoped plans, fixed milestone structure, escrow-backed funding) while fixing today’s core gaps: exclusive claim blocks competition, offers lack lifecycle/state, and there is no path to compare → select → refine → finalize → accept.

## Target Workflow
1. **Client — plan & publish:** creates a project plan, writes a rich description, refines with AI, edits or accepts the blueprint, then **publishes** the project (scope approved/open for offers).
2. **Builders — analyze & offer (many):** multiple eligible builders can receive/review the published plan; **each builder may submit only one initial offer** (proposed total → auto-calculated milestones, plus long-term cost terms/deadline proposals as applicable).
3. **Client — compare & choose:** receives multiple offers, compares them, and **chooses one** to negotiate with (**other offers become blocked from acceptance** while a selection is active).
4. **Client + chosen builder — negotiate:** chat to refine the plan, adjust **total** (milestones recalc, read-only), **long-term costs**, and **demo/deployment deadlines**.
5. **Builder — finalize:** after negotiation, builder updates/marks the offer as **“Final offer”** (terms locked for decision).
6. **Client — decide:**  
   - **Accepts final offer** → offer is accepted/funded per escrow rules, **all other offers are rejected**, project proceeds with the chosen builder.  
   - **Cancels negotiation** (does not accept) → selection is released and **other offers become choosable again**; client may pick another offer and repeat negotiation/finalization.

## Offer Lifecycle (conceptual states)
- `SUBMITTED` (initial offer, **one active offer per builder** per project)
- `SELECTED` (client picked this offer to negotiate; all other non-terminal offers become `BLOCKED` from acceptance)
- `FINAL` (builder-marked after negotiation; ready for client decision) — negotiation term updates occur on the selected offer until marked final (intermediate “revising” is an allowed update, not necessarily a distinct persisted state)
- **Terminal/resolution:** `ACCEPTED` (wins; project funded/assigned) | `REJECTED` (lost because another offer was accepted) | `WITHDRAWN` (builder; **final for that project in MVP**)
- **Negotiation canceled:** selection is released → the previously selected offer reverts to `SUBMITTED` (choosable) **retaining its last terms**; other non-withdrawn/non-rejected offers become choosable again.

**Rules (MVP):**
- Builder may **revise** or **withdraw** only while `SUBMITTED` (not selected/blocked/terminal). Withdraw is final for that project. After a canceled negotiation returns an offer to `SUBMITTED`, revise/withdraw is allowed again.
- At most one selected/negotiating/final-pending decision path at a time; **only the accepted final offer** can fund/assign the project.

> Exact state names/transitions to be finalized in spec; invariants above are normative.

## Resolved Decisions (open questions closed)

| # | Topic | Decision |
|---|---|---|
| 1 | **Long-term costs** | Simple structured fields on Offer (e.g. `longTermAmountCents` nullable, `longTermCadence` `NONE\|MONTHLY\|QUARTERLY\|YEARLY\|ONE_TIME`, `longTermNotes`) for comparison/term sheet; **informational only in MVP** (not escrowed/collected/billed), clearly labeled. |
| 2 | **Cancel negotiation** | Reverts selected offer to **`SUBMITTED`** (choosable) **retaining last terms**; other non-withdrawn/non-rejected offers reopen. Builder may revise that same single offer while `SUBMITTED`; client may choose the same or another offer. |
| 3 | **Withdraw/revise before selection** | One active offer per builder. While `SUBMITTED` (not selected/blocked/terminal): builder may **revise** or **withdraw**. Not allowed while selected/blocked; allowed again if reverted to `SUBMITTED` after cancel. **Withdraw is final for that project in MVP**. |
| 4 | **Publish UX** | **No separate publish step.** Publish = approve blueprint opens project for offers (current `OPEN_FOR_BIDS`). MVP UI copy: **“Approve & Publish”** (alias/rename); behavior/state equivalent. |
| 5 | **Chat scope pre-accept** | In the **existing project room**, enable text composer **only for client + selected builder** while an offer is selected/in negotiation/`FINAL` (pre-funding); hidden for others and when no offer selected. **No new thread model.** Composer remains available in `ACTIVE` for delivery. (Reconciles “composer only when ACTIVE”.) |
| 6 | **Deadlines** | Milestone **`dueDate`s** (demo/deployment) are negotiated in the term sheet, stored on the offer pre-accept, and **applied to project milestones on acceptance** with agreed total/milestones. Pre-accept = proposals (not enforced). Late penalty remains 5% of milestone amount if submitted after `dueDate`; **extensions remain post-acceptance (`ACTIVE`) only** in MVP. |

## Key Assumptions (to validate during implementation/rollout)
- [ ] **One offer per builder is sufficient:** builders iterate by revising their single offer (when allowed) rather than submitting multiples.
- [ ] **Structured terms reduce ambiguity:** total→recalc + long-term costs + due dates + “Final offer” give enough clarity to accept confidently.
- [ ] **Restricted pre-funding chat is enough:** client + selected builder can reach final terms without broader/pre-selection freeform chat.
- [ ] **Informational long-term costs:** capturing (not charging) maintenance/long-term terms in MVP is acceptable to users.

## MVP Scope
**In**
- First-class **Offer** records (project, builder, status, `totalCents`, auto-calculated milestone snapshot, structured long-term-cost fields/notes, milestone due dates, timestamps) with **one-per-builder** enforcement and withdraw/revise rules.
- **Published/open plans** (Approve & Publish / `OPEN_FOR_BIDS`) visible to multiple eligible builders (decoupled from exclusive claim); builders submit a single initial offer.
- Client **offer comparison & selection**: list offers, choose one → selected/others blocked; **cancel negotiation** → revert selected to `SUBMITTED` (retaining terms), reopen others.
- **Negotiation (selected builder):** chat enabled for client + selected builder pre-funding; structured term edits (total→recalc, long-term costs, due dates); builder marks **Final offer**.
- **Acceptance:** client accepts final offer → persist agreed terms & due dates, assign/fund per escrow flow, reject other offers.
- Server-side enforcement of offer ownership, selection/accept/finalize/cancel invariants, and milestone/total normalization.

**Out (defer)**
- Full marketplace ranking/recommendation/reputation gating beyond existing basics.
- Per-milestone manual price overrides (conflicts with auto-calc/read-only rule).
- Complex multi-round counteroffer threading, auctions, or time-boxed bidding windows (V6).
- Subscription billing/collections for long-term costs (capture terms; operationalize later).
- Real-time presence/typing, new thread models, and large notification systems beyond existing patterns.

## Not Doing (and Why)
- **Not keeping offers as unstructured chat-only payloads** — comparison, blocking, and finalization need enforceable state (V2 over V1).
- **Not keeping exclusive first-claim as the entry point** — it prevents multiple builders from offering on the same plan (V5).
- **Not allowing per-milestone price edits** — conflicts with the agreed auto-calc (0/30/40/30) rule; negotiate the total instead.
- **Not auto-funding on selection** — funding/escrow commits only on explicit acceptance of the **final** offer.
- **Not escrowing/billing long-term costs in MVP** — capture as terms only.
- **Not a full redesign in one pass** — evolve within current React/Express/Socket.io/Prisma patterns.

## Data & Integration Notes (MVP, within current architecture)
- **Model:** add `Offer` (and minimal supporting fields/enums) in Prisma; relate to `Project`, builder `User`, and link accepted offer to project terms. Keep `Message` `WIDGET` rendering compatible or derive it from `Offer` for backward display.
- **Realtime/API:** events/endpoints for submit-offer, revise/withdraw, list-offers, select-offer, update-terms, mark-final, accept-final, cancel-negotiation (with ack/broadcasts paralleling existing socket patterns).
- **Auth/ownership:** enforce builder ownership of their single offer and client ownership of selection/acceptance/cancel (addressing current trust gaps where feasible in touched paths).
- **Terms of record:** on acceptance, apply agreed `total` (recalc milestones 0/30/40/30), `dueDate`s, and assignment to project/milestones; negotiated drafts and long-term-cost terms live on the offer (and long-term terms surfaced on project/record as needed).

## Guiding Decisions (summary)
- **V2 + V5 + V4-lite**, MVP within current architecture.
- **Primary users:** clients choosing among builders. **Success:** confident acceptance of a final offer.
- **Pricing:** negotiate total; milestones auto-recalculated 0/30/40/30 and read-only. Long-term costs separate, structured, informational in MVP.
- **Publish = Approve & Publish** (`OPEN_FOR_BIDS`). **No separate publish step.**
- **Pre-funding chat:** client + selected builder only (project room). **Do not update official spec until this idea is promoted to a spec change.**
