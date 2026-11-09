## 9. Frontend Specification

### 9.1 `App.tsx`

- Local state: `role` (`CLIENT` | `BUILDER`) and an in-memory `users` record.
- Hardcoded identities:
  - `CLIENT`: `id: "client-user"`, `name: "Client User"`, `probationary: false`, `rulesAccepted: true`
  - `BUILDER`: `id: "builder-user"`, `name: "Builder User"`, `probationary: true`, `rulesAccepted: false`
- Header: product title, role toggle buttons, and a `$1,500 Budget Cap` badge while the builder is probationary.
- If role is `BUILDER` and `rulesAccepted` is false → render `BuilderOnboarding`; otherwise render `Chat`.
- Onboarding completion flips the local builder flags (no session refetch).
- No Auth.js integration: the SPA never calls `/auth`.

### 9.2 `Chat.tsx`

- Constants: `PROJECT_ID = "project-123"`, `SOCKET_URL = "http://localhost:3001"`.
- Connects with `transports: ["websocket"]`, `auth: { userId, role, name }`.
- Emits `join_project` on mount; subscribes to `new_message`, `project_updated`, `milestone_updated`.
- Maintains `messages`, `draft`, `project`, `projectStatus`, `nextMilestoneIndex`.
- `milestone_updated` is rendered as a local `SYSTEM` message: `"Milestone <title|id> Approved - Escrow Released"`.
- Message rendering by type:
  - `WIDGET` → `OfferWidget`
  - `DEMO_WIDGET` → `DemoWidget`
  - `SCOPE_WIDGET` → `ScopeWidget`
  - `SYSTEM` → centered green status text
  - default → `"<sender name or id>: <content>"`
- Composer: Enter or Send emits `send_message` with `type: "TEXT"`.
- Client-only: **Simulate AI Intake** button.
- Builder-only:
  - Before `ACTIVE`: **Generate Final Offer** (disabled for probationary builders when `totalEscrow > 150000`, i.e. `$1,500`).
  - When `ACTIVE`: **Submit Next Demo**, which walks `milestone-1..4` in order via `nextMilestoneIndex` and sends mock URLs `https://demo.example.com/<milestoneId>`.
- Renders `ProjectControls` below the chat card.

### 9.3 `BuilderOnboarding.tsx`

- Separate socket connection; emits `submit_onboarding` with `{ userId, ecosystems[], portfolioUrls[], rulesAccepted }`.
- Validation before submit:
  - GitHub "connected" (local boolean toggle; no OAuth)
  - 1–2 ecosystems (comma-separated input)
  - Two non-empty portfolio URLs
  - Rules checkbox accepted
- Copy: acknowledges the **5% late penalty** and progressive escrow rules.
- On ack `{ ok: true }` calls `onComplete()`.

### 9.4 Widgets

| Component | Props | Behavior |
|---|---|---|
| `ScopeWidget` | `socket`, `projectId`, `role`, `payload` | Renders blueprint sections; client emits `approve_scope` |
| `OfferWidget` | `socket`, `projectId`, `role`, `projectStatus`, `milestones`, `total` | Lists milestones and total (cents → dollars); client emits `accept_offer`; shows "Project Funded" when `ACTIVE` |
| `DemoWidget` | `socket`, `milestoneId`, `demoUrl`, `role` | Shows milestone + demo link; client emits `approve_milestone` |
| `ProjectControls` | `socket`, `project`, `role`, `userId` | Status, released escrow %, deadline, late penalties, extension state, refund, quality rating; builder can `request_extension`; client can `cancel_project`; rating form when `COMPLETED`/`CANCELLED` and unrated |

### 9.5 UI system

- shadcn config: style `radix-nova`, base color `neutral`, CSS variables, lucide icons, no RSC.
- Tailwind v4 CSS-first config in `src/index.css`; Geist Variable font; light/dark tokens using OKLCH; `tw-animate-css`.
- Local primitives: `Badge`, `Button`, `Card`, `Checkbox`, `Input`; `cn()` helper in `src/lib/utils.ts`.

---

