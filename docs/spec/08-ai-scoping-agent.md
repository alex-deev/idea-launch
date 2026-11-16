## 8. AI Scoping Agent

### 8.1 Iterative trigger and refinement loop
- Client UI `ScopeIntakeForm` collects idea, budget, timeline, and app kind/platform targets and sends `[TRIGGER_SCOPE_GENERATION] <idea>` (via `send_message`) to start scoping.
- The server runs `services/synthesis.ts` (Gemini Structured Outputs, `@google/genai`, `responseMimeType` + `responseSchema`, validated/normalized in code) as an **iterative refinement** step:
  - **`needs_info`:** returns 1–4 targeted, high-signal clarifying questions (e.g. target users, core flows, must-haves, integrations, platform details, constraints/success criteria) plus optional context summary.
  - **`ready`:** returns a complete, normalized scope blueprint.
- The client answers questions in the **structured scoping panel** (SCOPING takeover) and resubmits `[TRIGGER_SCOPE_GENERATION]` with `payload.refine=true` and `answers[]` (`{ questionId, question, answer }`). The server merges answers with prior refinement context and re-runs synthesis (bounded rounds; server may force a ready blueprint at the round limit or on explicit request).
- A **ready** draft can be refined further pre-approval (client can request more questions / regenerate an updated blueprint).
- Without `GEMINI_API_KEY`/`GOOGLE_API_KEY`, synthesis returns a deterministic **ready** fallback blueprint (incorporating provided answers/context when available) so development works offline.
- On AI/validation failure, the server returns/acks an error and emits a `SYSTEM` message; no empty/corrupt blueprint state is persisted as ready.

### 8.2 Persistence and state
- Refinement state is persisted in the latest `SCOPE_WIDGET` message payload (source of truth across refresh/rejoin), e.g.:
  - `refinement.status`: `"needs_info" | "ready"`
  - `refinement.round`, `refinement.intake` (idea/budget/timeline/app kinds), `refinement.questions`, `refinement.answers`, `refinement.contextSummary`, `refinement.source`
- When `ready`, the payload includes the normalized blueprint fields (`ScopePayload`) and `refinement.status="ready"`. When `needs_info`, the payload carries refinement questions/context (and placeholder/previous scope fields as applicable) until a ready blueprint is produced.
- The server updates/upserts the scoping `SCOPE_WIDGET` during refinement and emits `message_updated`/`new_message` as appropriate so clients stay in sync.

### 8.3 Blueprint contract (`ScopePayload`, when ready)
```ts
{
  title: string;
  executiveSummary: string;
  technicalArchitecture: string; // builder-visible; hidden from clients in UI
  coreFeatures: string[];        // 1–12
  milestones: [{ title: string; amount: number (cents, non-negative); releasePercent?: number }]; // exactly 3, 30/40/30
  outOfScope: string[];         // up to 12
  budgetCents?: number;
  appKinds?: string[];
  appKindOther?: string;
  refinement?: { status: "needs_info" | "ready"; round?: number; questions?: unknown[]; answers?: unknown[]; contextSummary?: string | null; intake?: unknown };
}
```
- Milestones are normalized to exactly three: **Initial Demo, Final Demo, Deployment** with **30% / 40% / 30%** split summing to the budget (default `$1,000.00`). Titles/order/prices are fixed/read-only in the UI. Agreement is implicit at final-offer acceptance (not a milestone).

### 8.4 Client rendering and gating
- During `SCOPING`, the right panel is a dedicated scoping takeover (no chat composer): `ScopeIntakeForm` → refinement questions panel (`needs_info`) → `ScopeWidget` blueprint (`ready`).
- `ScopeRefinementPanel` presents AI questions with per-question free-text answers and submits refinement turns; `ScopeWidget` renders the ready blueprint (summary, app kind, features, milestones, out-of-scope). **Technical Architecture is hidden from clients** (UI-only) and visible to builders.
- Scope content is client-editable only before approval; milestone prices remain auto-calculated/read-only. **Approve & Publish** is available only for a **ready** blueprint (and hidden while editing) and emits `approve_scope` (server enforces normalized milestones/total, ready refinement state, and client open-for-bids limit) moving the project to `OPEN_FOR_BIDS`.
- Builders/non-clients see a clear “scoping/refining in progress” state until published.

### 8.5 Failure mode
Ack `{ ok: false, error }` and a `SYSTEM` message on synthesis failure; refinement/blueprint state is not advanced to an invalid ready state.

---
