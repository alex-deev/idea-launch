# Multi-Target Deliverable Contract (Direction A)

## Problem Statement
**How might we make the final offer the single, enforceable contract for what platform(s) are being built and how each milestone is delivered, so every demo/deployment submission provably matches what was agreed—eliminating “built the wrong thing/target” surprises in multi-platform projects?**

## Recommended Direction
**Direction A: Uniform multi-target bundle, locked at Final (atomic).** Build on the typed per-milestone deliverable specs (kinds/validation) by making the agreed **project platform target set** and per-milestone deliverables a binding, machine-checked contract.

- **Project-level `platformTargets[]`, propagated:** The offer declares the full set of agreed targets (e.g. `Web`, `iOS`, `Android`) and propagates them to every milestone. A milestone’s spec becomes target-aware (each required target pinned to a concrete, compatible deliverable kind + platform/OS where applicable). *Propagation is uniform:* **every milestone requires the full target set**.
- **Lock at Final (pre-accept freeze):** When the builder marks the offer **Final**, deliverable specs/targets (and negotiated terms they belong to) **freeze**. `revise_offer` / `update_offer_terms` are rejected while `FINAL`. The **accepted** frozen snapshot is copied to milestones as the enforced contract (`deliverableSpec`/target state). A defined **un-finalize** path (below) allows pre-accept correction without funding impact.
- **Server-derived, UI-locked submissions (no builder discretion):** Each `submit_demo` is a **bundle covering all required targets**. The builder supplies only content fields (link, instructions, version, summary, whatChanged, credentials as allowed); **kind and target/platform/OS are derived from the locked spec and not selectable/overridable** in UI or payload. Server hard-blocks missing targets and any kind or platform/OS mismatch. Applies to **Initial Demo, Final Demo, and Deployment**.
- **Tabbed bundle UX, atomic review:** `DemoSubmitDialog` and `DemoWidget` render **one tab/slot per required target** (fixed set). Review/approval is **atomic for the bundle** (MVP): the client approves or requests changes on the **current bundle** as a unit; `CHANGES_REQUESTED`, the soft 24h target/reset, `currentDemoMessageId`, and release apply to the bundle (not per-tab).

**Funding/edits clarification:** `mark_offer_final` is a **pre-funding** decision state (project remains `OPEN_FOR_BIDS`, selected). **Accept & fund** happens later at `accept_offer`. An **un-finalize → edit terms/targets → re-finalize** flow happens **before acceptance and does not require any undo-fund/re-fund**—nothing has been escrow-funded or activated yet. Post-acceptance (`ACTIVE`/funded) contract changes are a separate change-order/renegotiation problem and are **out of scope** for this lock.

## Key Assumptions to Validate
- [ ] **Uniform bundle is acceptable:** for the real projects you target (e.g. web + 2 mobile apps), clients/builders expect **every milestone** to include deliverables for **all** agreed targets (not staged per milestone). *Test:* walk 2–3 concrete project examples through Initial/Final/Deployment and confirm no target legitimately waits until a later stage.
- [ ] **Atomic bundle review fits:** approving/rejecting the whole bundle (and one `whatChanged`/revision cycle per resubmission) is sufficient; per-tab rejection isn’t required for MVP. *Test:* role-play a case where web passes but iOS fails—confirm “reject bundle, resubmit bundle” is workable.
- [ ] **Targets are enumerable & pin-able:** day-1 target set maps to concrete, server-checkable kind+platform/OS (e.g. Web, iOS, Android, Windows/macOS/Linux, cross-platform) with no “unspecified” targets that must be hard-matched. *Test:* inventory required combos and confirm each resolves to a pinned spec.
- [ ] **Un-finalize path is desirable & safe:** allowing Final → editable → Final before acceptance improves negotiation without confusing the client’s decision state. *Test:* prototype the state/UX against the “wrong target spotted after Final” scenario.

## MVP Scope
**In**
- **Data/contract:** project-level `platformTargets[]` in offer terms; per-milestone **bundled** deliverable specs (one pinned slot per target, kind + concrete platform/OS), propagated uniformly; frozen at **Final**, bound/copied on acceptance (extend `milestonesSnapshot`/`Milestone.deliverableSpec` model & `server/src/lib/{offers,deliverables}.ts`).
- **Lock-at-Final + un-finalize:** reject term/target edits while offer is `FINAL`. Provide an explicit **un-finalize** action (builder-only) to return to editable negotiation, then re-finalize; **pre-accept only, no funding movement** (see Decisions).
- **Submission enforcement:** `submit_demo` accepts/validates a **bundle** payload derived against locked slots (all targets present, content valid, no kind/target override), stores bundle on `DEMO_WIDGET`, keeps atomic milestone review state (`currentDemoMessageId`, approve/reject/soft-24h/resubmit) over the bundle; hard-block mismatches for all milestones incl. Deployment.
- **UI:** term sheet captures target set + pinned per-target milestone slots (read-only derived targets where possible); `DemoSubmitDialog`/`DemoWidget` tabbed per target, targets/kinds non-editable, builder enters content only; clear mismatch/lock messaging and review guidance (below).
- **Back-compat/migration (additive):** legacy single-deliverable offers/milestones/submissions continue to work (treated as single-target/unspecified-tolerant where needed); new/finalized contracts enforce pinned bundles.

**Out (Not Doing)**
- **Per-tab independent review/approval or partial release** — atomic bundle only (avoids multiplying milestone/review/release state). *Why:* core guarantee is “matches agreed targets”; per-tab splits are a later refinement.
- **Staged/per-milestone target coverage (Direction B)** — every milestone requires the full set. *Why:* simpler invariant; defer until staged rollout is a proven need.
- **Post-acceptance target/contract renegotiation or refunds** — lock governs the agreed offer; funded change-orders are separate. *Why:* entangles escrow/refund flows.
- **File uploads / artifact hosting** — links/artifacts by URL only (current model). *Why:* orthogonal infrastructure.
- **Automated verification that a link truly matches the claimed platform** — enforce declared, pinned contract/fields, not runtime truth. *Why:* not reliably automatable in-app.
- **Per-target deadlines or independent resubmission timers** — single bundle timeline per milestone. *Why:* keeps soft-24h/review semantics coherent.

## Decisions & Drafts (from open questions)

### 1) Un-finalize mechanics (recommended)
- **Who can trigger:** **builder only** (owner of the offered terms/finalization).
- **State transition (recommended):** `FINAL` → `SELECTED` (editable negotiation) on un-finalize; **project stays `OPEN_FOR_BIDS` with the same selection**. Builder edits terms/targets, then marks **Final** again for client decision.
- **Why this over alternatives:** reverting to `SUBMITTED` or canceling negotiation would drop/reshape the client’s active choice and interacts with blocked offers; returning to `SELECTED` preserves “client chose this builder” while allowing correction. Other non-terminal offers remain **`BLOCKED`** (no selection reshuffle).
- **Effects:** emit `offers_updated`/`project_updated` (and a `SYSTEM` message) noting terms reopened for revision; client’s Accept action is unavailable until re-finalized. **No escrow/funding movement** (pre-accept). If the team prefers a stricter stance, the alternative is “Final immutable pre-accept” (builder must withdraw/re-offer)—but that is more disruptive; validate via the assumption test above.

### 2) Bundle payload/storage shape (direction confirmed)
- **Yes—extend for multi-item bundles** while preserving current review semantics: a `DEMO_WIDGET` payload carries a **bundle of per-target deliverables** (one per required slot, each validated against its pinned spec), and milestone state continues to track the single **current** actionable submission (`currentDemoMessageId`, status, revision fields) at bundle granularity. Legacy single-deliverable messages/milestones remain renderable/accepted under back-compat rules.

### 3) Review copy & criteria (draft, atomic bundle)
Use this as the baseline UI copy/guidance for client review and builder resubmission:

**Client — “Review this submission” (DemoWidget header/helper):**
> Review each target tab. This milestone is approved or sent back **as a whole bundle**—every agreed target must meet the contract.

**Per-target tab checklist (helper text/icons):**
- **Correct target & format:** matches the agreed platform/target and deliverable type (locked by contract).
- **Access works:** link opens/downloads; credentials (if any) work.
- **Follows instructions:** you can install/open/review as described.
- **Meets milestone intent:** demonstrates what this stage promised for this target.

**Request changes (client action):**
- Reason is **required** and applies to the **bundle**. Prompt: *“What needs to change? Call out which target(s) (e.g. Web, iOS) and what to fix.”*
- Sets `CHANGES_REQUESTED` with a soft 24h revision target (reset per request); non-blocking but flagged if overdue.

**Resubmit (builder, DemoSubmitDialog):**
- **What changed / how to verify** is **required** for resubmissions. Prompt: *“Describe what changed per target and how the client can verify each fix (reference Web/iOS/Android tabs as relevant).”*
- Targets/kinds are fixed (read-only); update links, instructions, version/notes, and credentials per tab as needed.

**Per-bundle vs per-target notes:** approval/rejection and the required “what changed” are **per-bundle** fields (MVP), but copy should explicitly encourage **per-target detail** in both the rejection reason and the change note so tab-by-tab issues are clear without separate per-tab state.

### 4) Target taxonomy & matrix (to finalize during implementation)
- Define the canonical day-1 `platformTargets` and the compatible, pinnable deliverable kind (+ concrete platform/OS) per target so propagation/derivation is unambiguous (e.g. Web, iOS, Android, cross-platform mobile, desktop OSes). Capture as the authoritative matrix in `lib/deliverables` / spec when implementing.

## Related
- Builds on: `docs/ideas/typed-demo-submissions.md`, `docs/ideas/typed-demo-submissions-contract.md` (typed per-milestone deliverables, current implementation baseline).
- Relevant code: `server/src/lib/{deliverables,offers}.ts`, `server/src/socket.ts` (`mark_offer_final`, `update/revise/accept_offer`, `submit_demo`), `client/src/components/{OfferWidget,DemoSubmitDialog,DemoWidget,Chat}.tsx`, `server/prisma/schema.prisma`.
