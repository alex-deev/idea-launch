## 9. Frontend Specification

### 9.1 `App.tsx`
- Routes: `/` (sign-in), `/signup`, `/client`, `/builder`. Protected routes redirect to sign-in when no session.
- Auth via `AuthContext` (Auth.js session lookup at `/auth/session`); sign-in uses `/auth/callback/credentials`; registration uses `POST /api/auth/register`.
- Role comes from the user record; the sign-in "Workspace" selector is cosmetic.
- Theme toggle (light/dark) persisted to `localStorage`; applies `.dark` class.
- Builder onboarding gate: if role is `BUILDER` and not onboarded (`rulesAccepted`/not probationary), render `BuilderOnboarding`; otherwise render the workspace.

### 9.2 `ProjectWorkspace.tsx`
- Sidebar listing the user's projects (client: own projects; builder: assigned + available tabs).
- Create project (client) and claim (builder) flows; builder capacity enforced (3 active).
- Polls the project list every 5s and on tab focus; guards overlapping polls; skips no-op state updates.
- Cancelled projects move to a collapsible "Archived" section; selecting an archived project reopens it.
- Cancelling the open project clears the selection (right card closes) only on transition to `CANCELLED`.
- No auto-selection of a project; right panel stays empty until selection.

### 9.3 `Chat.tsx`
- Connects via Socket.io with `auth: { userId }`; uses `API_URL`/`SOCKET_URL` from `client/src/lib/api.ts`.
- Emits `join_project` on selection; subscribes to `new_message`, `project_updated`, `milestone_updated`.
- Replays message history on join.
- Composer hidden during `SCOPING`; visible once the scope is approved.
- Message rendering by type: `WIDGET` → `OfferWidget`, `DEMO_WIDGET` → `DemoWidget`, `SCOPE_WIDGET` → `ScopeWidget`, `SYSTEM` → centered status, default → bubble.
- Scroll-to-bottom behavior; chat controls (extend/cancel/rate) in a dropdown.
- `ScopeIntakeForm` sends `[TRIGGER_SCOPE_GENERATION]` through `send_message` for AI scoping.

### 9.4 `ScopeIntakeForm.tsx` / `ScopeWidget.tsx`
- Intake form collects idea/budget/timeline/stack and triggers synthesis.
- `ScopeWidget` renders the blueprint (summary, architecture, features, milestones, out-of-scope).
- Scope content/amounts editable only before approval; milestone titles are read-only.
- Client emits `approve_scope`, which moves the project to `OPEN_FOR_BIDS`.

### 9.5 Widgets
| Component | Purpose |
|---|---|
| `ScopeWidget` | Blueprint view/edit + `approve_scope` |
| `OfferWidget` | Milestones + total; client `accept_offer`; shows "Project Funded" when `ACTIVE` |
| `DemoWidget` | Demo link + `approve_milestone` |
| `ProjectControls` | Status, released %, deadline, late penalties, extension, refund preview, rating form |

### 9.6 Builder onboarding
- `BuilderOnboarding` emits `submit_onboarding` (`ecosystems[]`, `portfolioUrls[]`, `rulesAccepted`); clears `probationary` on success.
- Probationary `$1,500` cap enforced only in the client offer button.

### 9.7 UI system
- shadcn config: style `radix-nova`, base color `neutral`, CSS variables, lucide icons, no RSC.
- Tailwind v4 CSS-first config in `src/index.css`; Geist Variable font; light/dark tokens using OKLCH; `tw-animate-css`.
- Local primitives under `src/components/ui/*`; `cn()` helper in `src/lib/utils.ts`.

---
