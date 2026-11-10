## 8. AI Scoping Agent

### 8.1 Trigger
- Client UI `ScopeIntakeForm` collects idea, budget, timeline, and preferred stack.
- Sending `[TRIGGER_SCOPE_GENERATION] <idea>` (via `send_message`) triggers synthesis on the server.
- The server runs `services/synthesis.ts`: Gemini Structured Outputs (`@google/genai`, `responseMimeType` + `responseSchema`) validated with Zod, normalized to exactly four milestones whose amounts sum to the budget (default `$1,000.00`).
- Without `GEMINI_API_KEY`/`GOOGLE_API_KEY`, a deterministic local fallback blueprint is returned so development works offline.
- On success, a `SCOPE_WIDGET` message is persisted with the blueprint payload; on failure, an error ack is returned.

### 8.2 Blueprint contract (`ScopePayload`)
```ts
{
  title: string;
  executiveSummary: string;
  technicalArchitecture: string;
  coreFeatures: string[];        // 1–12
  milestones: [{ title: string; amount: number (cents) }];  // exactly 4
  outOfScope: string[];         // up to 12
}
```
Milestone titles are fixed: Agreement, Initial Demo, Final Demo, Deployment.

### 8.3 Client rendering
`ScopeWidget.tsx` renders title, Executive Summary, Technical Architecture, Core Features, Milestones (cents → dollars), Out of Scope. Clients see **Approve Blueprint** (emits `approve_scope`); builders see "Waiting for client approval." Scope content/amounts editable only before approval; titles read-only.

### 8.4 Failure mode
Ack `{ ok: false, error }`; no empty blueprint is persisted.

---
