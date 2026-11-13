## 9. Frontend Specification

### 9.1 `App.tsx`
- Routes: `/` (sign-in), `/signup`, `/client`, `/builder`. Protected routes redirect to sign-in when no session.
- Auth via `AuthContext` (Auth.js session lookup at `/auth/session`); sign-in uses `/auth/callback/credentials`; registration uses `POST /api/auth/register`.
- Role comes from the user record; the sign-in "Workspace" selector is cosmetic.
- Theme toggle (light/dark) persisted to `localStorage`; applies `.dark` class.
- Builder onboarding gate: if role is `BUILDER` and not onboarded (`rulesAccepted`/not probationary), render `BuilderOnboarding`; otherwise render the workspace.

### 9.2 `ProjectWorkspace.tsx`
- "Project Plans" sidebar lists the user's projects (client: own/published projects; builder: own in-progress/accepted projects and **published/open projects available to offer on**). It collapses left into a 48px rail (icon + vertical label + project count) via the header toggle. Below 1024px it starts collapsed and re-collapses on project selection; wide-layout toggles persist to `localStorage` (`idea-launch:project-plans-collapsed`), narrow auto-collapses do not.
- **Builder accepted-active limit:** builders with **3 accepted/`ACTIVE` projects** are at capacity. The sidebar shows accepted-active capacity, disables “Open for offers”, and when that view is empty/blocked explains why: a limit-reached message if blocked by capacity (`unavailableReason: "AT_CAPACITY"` or local limit state), or “No projects open for offers right now.” if genuinely none are available.
- **No exclusive claim flow:** multiple builders may view/open a published plan and submit offers; builder assignment occurs on acceptance of the selected final offer.
- Create project (client) flow; builder capacity/eligibility rules apply where relevant.
- Polls the project list every 5s and on tab focus; guards overlapping polls; skips no-op state updates.
- Cancelled projects move to a collapsible "Archived" section; selecting an archived project reopens it. Cancelling the open project clears the selection only on transition to `CANCELLED`.
- No auto-selection of a project; right panel stays empty until selection.

### 9.3 `Chat.tsx` / project view
- Connects via Socket.io with `auth: { userId }`; uses `API_URL`/`SOCKET_URL` from `client/src/lib/api.ts`.
- Emits `join_project` on selection; subscribes to `new_message`, `project_updated`, `milestone_updated`, and `offers_updated`.
- Replays message history and current offer/selection state on join.
- **Project header counterparty:** for clients, shows the builder name only after the client selects and/or accepts that builder’s offer (no placeholder before then); for builders, always shows the client/project-owner name (no placeholder fallback).
- **Composer gating:** hidden during `SCOPING` (intake shown). Pre-funding, the **text composer is enabled only for the client and the selected builder** while an offer is selected/in negotiation/`FINAL` (existing project room, no new thread). When no offer is selected or for other builders, no freeform composer. Composer is available in `ACTIVE` for delivery collaboration.
- **Builder offers (pre-accept, published projects):** builders can review the plan (including builder-visible Technical Architecture), submit a **single initial offer** and, when allowed, **revise/withdraw**; term inputs include proposed **total** (milestones auto-calculated 0/30/40/30, read-only), long-term costs (informational), and demo/deployment due dates. Builders at the **3 accepted/`ACTIVE` projects** limit cannot submit new offers and see an explanatory message instead of the submit form.
- **Client offer management:** client views/compares offers, **selects one** (others blocked), can **cancel negotiation** (reopen choice, selected reverts to `SUBMITTED` retaining terms), and after builder marks **Final offer** can **accept & fund** or cancel negotiation.
- **Negotiation term sheet (V4-lite):** structured edits for total→recalc, long-term costs, and milestone due dates; builder marks **Final offer**. Terms of record apply on acceptance.
- **Demo review (Initial/Final Demo, Direction A):** each submission creates a `DEMO_WIDGET` for the same milestone; only the **current** submission is actionable. Client can **Approve** or **Reject** (reason required) the current demo; rejection sets a **soft 24h** revision target (reset per rejection, shown as “due in…” / “overdue by…” but non-blocking) and records feedback. Builder resubmits the **same changes-requested milestone** (not the next stage); late resubmissions are allowed and flagged. Historical/superseded demo widgets render non-actionable. “Submit Next Demo” and nearby deadline text are milestone/review-aware (including revision target/overdue when applicable).
- Message rendering by type: `WIDGET`/offer views (derived from or linked to `Offer`), `DEMO_WIDGET` → `DemoWidget`, `SCOPE_WIDGET` → `ScopeWidget`, `SYSTEM` → centered status, default → bubble.
- Scroll-to-bottom behavior; chat/project controls (extend/cancel/rate) available per status/role.

### 9.4 `ScopeIntakeForm.tsx` / `ScopeWidget.tsx`
- Intake form collects idea/budget/timeline/stack and triggers synthesis.
- `ScopeWidget` renders the blueprint (summary, features, milestones, out-of-scope). **Technical Architecture is hidden from clients** (UI-only) and visible to builders.
- Scope content is editable by the client only before approval; milestone titles/order are fixed and **milestone prices are auto-calculated (Agreement 0%, Initial Demo 30%, Final Demo 40%, Deployment 30% of total) and read-only**.
- While editing, the **Approve** action is hidden; client saves/cancels edits, then approves. Client action **“Approve & Publish”** emits `approve_scope` (server enforces normalized milestones/total) and moves the project to `OPEN_FOR_BIDS` (open for builder offers).

### 9.5 Widgets / views
| Component | Purpose |
|---|---|
| `ScopeWidget` | Blueprint view/edit + Approve & Publish (client-hidden technical architecture; read-only auto-calc milestones; approve hidden during edit) |
| `OfferWidget` / Offer views | Display/compare offers and term sheet (total, milestones read-only auto-calc, long-term costs informational, due dates); selection, finalize, accept, cancel negotiation actions per role/state |
| `DemoWidget` | Demo submission review: shows current demo link/state; client **Approve** or **Reject** (reason required) for current Initial/Final Demo; displays rejection reason and soft 24h revision target/overdue; historical/superseded submissions non-actionable |
| `ProjectControls` | Status, released %, deadline, late penalties, extension, refund preview, rating form |

### 9.6 Builder onboarding
- `BuilderOnboarding` emits `submit_onboarding` (`ecosystems[]`, `portfolioUrls[]`, `rulesAccepted`); clears `probationary` on success.
- Probationary `$1,500` cap enforced only in the client offer button.

### 9.7 UI system
- shadcn config: style `radix-nova`, base color `neutral`, CSS variables, lucide icons, no RSC.
- Tailwind v4 CSS-first config in `src/index.css`; Geist Variable font; light/dark tokens using OKLCH; `tw-animate-css`.
- Local primitives under `src/components/ui/*`; `cn()` helper in `src/lib/utils.ts`.

---
