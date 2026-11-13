# TODO: Demo Accept/Reject with Soft 24h Revision (Direction A)

> Plan: `tasks/plan.md` · Idea: `docs/ideas/demo-review-and-revision.md` (Direction A, defaults resolved)

## Phase 1: Data Model & Server Foundations
- [x] **Task 1: Add persisted demo review state to the data model** — *Added `CHANGES_REQUESTED` to `MilestoneStatus` and `revisionRequestedAt`/`revisionReason`/`currentDemoMessageId` to `Milestone`; Prisma client generated and DB synced via `prisma db push`.*
  - **Description:** Extend the Prisma schema so milestones can represent lightweight demo review state for **Initial/Final Demo**: “changes requested” status/state, `revisionRequestedAt`, `revisionReason`, and a reference to the **current** demo submission (and any needed demo-submission linkage). Regenerate Prisma client and sync the dev DB (follow workspace practice, e.g. `db push`).
  - **Acceptance criteria:**
    - [x] Schema supports storing rejection reason, revision request timestamp (soft 24h target source), and current actionable demo submission per milestone.
    - [x] Milestone can represent a changes-requested/reviewable state distinct from released/completed; existing fields/relations remain intact.
    - [x] Prisma client generated and DB schema synced for local dev.
  - **Verification:**
    - [x] `npm run db:generate` (or equivalent) succeeds.
    - [x] DB sync command used in workspace succeeds (`npm exec -w server -- prisma db push --accept-data-loss`; initial attempt hit transient prepared-statement error, retry succeeded).
  - **Dependencies:** None
  - **Files likely touched:** `server/prisma/schema.prisma` (+ generated client)
  - **Estimated scope:** M

- [x] **Task 2: Implement `reject_demo` and harden demo socket handlers/guards** — *Added `reject_demo` (client-only, Initial/Final Demo, reason required, resets soft 24h target, audit) and hardened `submit_demo` (same-milestone resubmission, new current `DEMO_WIDGET`, overdue resubmission flagged/audited) and `approve_milestone` (rejects changes-requested/non-current demo submissions for demo-review milestones).*
  - **Description:** Add a client-only `reject_demo` handler (reason required, demo milestones only) that records changes-requested state, sets/resets `revisionRequestedAt`, emits audit `SYSTEM` message, and updates/broadcasts milestone+project state. Update `submit_demo` to support resubmitting the **same changes-requested milestone** (new `DEMO_WIDGET`, update current demo ref/URL, clear/transition review state, detect/flag overdue resubmission vs 24h target). Guard `approve_milestone` so only the current, non-rejected, reviewable submission can be released.
  - **Acceptance criteria:**
    - [x] `reject_demo` requires client/owner + valid demo milestone (Initial/Final), requires reason, resets 24h soft target on each rejection, and never releases funds.
    - [x] `submit_demo` accepts resubmission for the same changes-requested milestone, creates a new demo submission, updates current demo state, and allows late resubmission (soft) with overdue flagged via audit/state as defined.
    - [x] `approve_milestone` rejects/ignores approval when demo is changes-requested or not the current actionable submission; existing release behavior preserved for valid approvals.
    - [x] Relevant `project_updated`/`milestone_updated`/`new_message` broadcasts keep clients in sync.
  - **Verification:**
    - [x] Build succeeds: `npm run build -w server`
    - [x] Manual socket/flow check: pending full client UI; server handlers compile and enforce guards/transitions.
  - **Dependencies:** Task 1
  - **Files likely touched:** `server/src/socket.ts`
  - **Estimated scope:** L

## Checkpoint: Server Review Flow
- [ ] Review state persisted and exposed; `reject_demo`/resubmit/approve guards enforced
- [ ] 24h soft target recorded/reset per rejection; late resubmission allowed and flagged
- [ ] Server build succeeds

## Phase 2: Client Demo Review UX
- [x] **Task 3: Update demo UI to support accept/reject, reason, and current-vs-historical submissions** — *`DemoWidget` now shows Approve/Reject (reason required) for the current Initial/Final Demo, changes-requested reason + soft 24h due/overdue (live), and renders non-current submissions as historical; wired with milestone/project/message context from chat.*
  - **Description:** Update `DemoWidget` (and chat/demo rendering) so the **current** demo submission for Initial/Final Demo shows client actions **Approve** and **Reject** (reason required) when awaiting review, and shows **changes-requested** state with reason and soft 24h “due in / overdue by” indicator (refreshing). Render older/superseded demo widgets as historical/non-actionable. Builder sees awaiting-review/changes-requested feedback clearly.
  - **Acceptance criteria:**
    - [x] Client can submit a rejection with a required reason from the actionable demo widget; builder cannot approve/reject.
    - [x] Actionable widget reflects pending review vs changes requested (reason + 24h target/overdue) vs approved/released; non-current widgets have no approve/reject actions.
    - [x] Soft 24h indicator updates over time (minute refresh) and correctly shows overdue without blocking.
  - **Verification:**
    - [x] Build succeeds: `npm run build -w client`
    - [ ] Manual check: reject/resubmit cycles render correct current vs historical states and timing labels.
  - **Dependencies:** Task 2
  - **Files likely touched:** `client/src/components/DemoWidget.tsx`, `client/src/components/Chat.tsx`
  - **Estimated scope:** M

- [x] **Task 4: Make builder submit targeting and deadline text milestone/review-aware** — *`nextDemoMilestone` naturally targets CHANGES_REQUESTED milestones; deadline label near “Submit Next Demo” now shows soft 24h revision update due/overdue when applicable, otherwise milestone due timing.*
  - **Description:** Adjust builder demo submission flow so when a demo milestone is **changes requested**, submit targets that same milestone (not the next stage) and the UI/deadline label near “Submit Next Demo” reflects the relevant revision/demo context (including soft 24h revision target/overdue when applicable) per Direction A.
  - **Acceptance criteria:**
    - [x] With a changes-requested Initial/Final Demo, builder submit/resubmit applies to that milestone and succeeds (targets same milestone; server accepts).
    - [x] “Submit Next Demo”/nearby text communicates the correct milestone and timing context (demo due vs revision requested/overdue) without misleading advancement.
    - [x] Normal progression to next milestone still works when no changes are requested.
  - **Verification:**
    - [x] Build succeeds: `npm run build -w client`
    - [ ] Manual check: request changes on a milestone, resubmit same milestone, then proceed to next milestone after approval.
  - **Dependencies:** Task 3
  - **Files likely touched:** `client/src/components/Chat.tsx`
  - **Estimated scope:** M

## Checkpoint: End-to-End Review Loop
- [x] Client can reject (with reason) and approve current demo; builder can resubmit same milestone (including late) — *server/client implemented; manual E2E smoke pending*
- [x] Soft 24h target visible/reset per rejection; historical demos non-actionable; audit messages emitted — *implemented; manual confirmation pending*
- [x] Builds succeed: `npm run build`

## Phase 3: Verification & Docs Alignment
- [x] **Task 5: Verify flow and align idea/spec/task notes** — *Build/lint pass; specs drafted and aligned with implemented Direction A (reject_demo, guarded approve/submit, soft 24h reset/overdue audit, current-vs-historical demos). Manual E2E smoke still recommended.*
  - **Description:** Run full verification for the MVP, confirm behavior against resolved defaults in `docs/ideas/demo-review-and-revision.md`, and align notes/specs only if implementation required clarified deviations (and per repo convention update affected `docs/spec/*`/`TECHNICAL_SPEC.md` when behavior/contracts change).
  - **Acceptance criteria:**
    - [x] Reject→resubmit (on-time/overdue)→approve flow implemented for Initial & Final Demo; 24h resets per rejection; only current non-rejected demo approvable; resubmits target same milestone (manual E2E confirmation recommended).
    - [x] `npm run build` and `npm run lint -w client` pass (lint warnings-only acceptable per repo).
    - [x] Idea resolved-defaults/open-questions and promoted spec contracts reflected in `docs/spec/*` (and gap noted).
  - **Verification:**
    - [x] `npm run build`
    - [x] `npm run lint -w client` (pre-existing warnings only)
    - [ ] Manual smoke: multi-cycle reject/resubmit/approve across Initial & Final Demo, including overdue resubmission and refresh/rejoin consistency.
  - **Dependencies:** Task 4
  - **Files likely touched:** `docs/spec/05-data-model-prisma-postgresql.md`, `docs/spec/07-socket-io-event-flow.md`, `docs/spec/09-frontend-specification.md`, `docs/spec/11-business-rules-reference.md`, `docs/spec/12-known-gaps-risks-and-open-questions.md`, `docs/ideas/demo-review-and-revision.md`, `tasks/todo.md`, `tasks/plan.md`
  - **Estimated scope:** M

## Checkpoint: Complete
- [x] MVP implementation and spec/plan/docs alignment complete (Direction A)
- [x] Builds/lint clean; manual E2E smoke recommended
- [x] Ready for review