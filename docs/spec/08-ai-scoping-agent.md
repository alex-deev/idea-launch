## 8. AI Scoping Agent

### 8.1 Trigger
- Client UI `ScopeIntakeForm` collects idea, budget, timeline, and preferred stack.
- Sending `[TRIGGER_SCOPE_GENERATION] <idea>` (via `send_message`) triggers synthesis on the server.
- The server runs `services/synthesis.ts`: Gemini Structured Outputs (`@google/genai`, `responseMimeType` + `responseSchema`) validated with Zod, normalized to exactly four milestones with the **business-model split 0% / 30% / 40% / 30%** summing to the budget (default `$1,000.00`).
- Without `GEMINI_API_KEY`/`GOOGLE_API_KEY`, a deterministic local fallback blueprint is returned so development works offline.
- On success, a `SCOPE_WIDGET` message is persisted with the normalized blueprint payload (including `budgetCents`); on failure, an error ack is returned.

### 8.2 Blueprint contract (`ScopePayload`)
```ts
{
  title: string;
  executiveSummary: string;
  technicalArchitecture: string; // builder-visible; hidden from clients in UI
  coreFeatures: string[];        // 1–12
  milestones: [{ title: string; amount: number (cents, non-negative); releasePercent?: number }]; // exactly 4, 0/30/40/30
  outOfScope: string[];         // up to 12
  budgetCents?: number;
}
```
Milestone titles are fixed: Agreement, Initial Demo, Final Demo, Deployment. Prices are auto-calculated (0/30/40/30) and read-only.

### 8.3 Client rendering
`ScopeWidget.tsx` renders title, Executive Summary, Core Features, Milestones (cents → dollars), Out of Scope. **Technical Architecture is hidden from clients** (UI-only) and visible to builders (e.g. when preparing the initial offer). Scope content is client-editable only before approval; milestone prices are auto-calculated/read-only and **Approve Blueprint** is hidden while editing. On approval the server enforces normalized milestones/total and moves the project to `OPEN_FOR_BIDS`.

### 8.4 Failure mode
Ack `{ ok: false, error }`; no empty blueprint is persisted.

---
