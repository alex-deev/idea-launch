## 8. AI Scoping Agent

### 8.1 Current implementation (mock)

There is **no LLM call, SDK, API key, or prompt file** in the repository. Scoping is simulated deterministically on the server.

**Trigger contract:**

- Client UI button **"Simulate AI Intake"** sends a normal text message whose content is exactly:
  ```
  [TRIGGER_SCOPE_GENERATION]
  ```
- Server detects the substring in `send_message` and, instead of persisting a `TEXT` message, creates a `SCOPE_WIDGET` message with the hardcoded blueprint below.

**Hardcoded blueprint payload (`socket.ts`):**

```json
{
  "title": "Project Scope Blueprint",
  "executiveSummary": "A scoped delivery plan for the idea, covering architecture, features, and milestones.",
  "technicalArchitecture": "React frontend, Node.js/Express backend, PostgreSQL via Prisma, Socket.io realtime.",
  "coreFeatures": [
    "AI-assisted scoping",
    "Milestone-based escrow",
    "Realtime chat and demos",
    "Quality scoring"
  ],
  "milestones": [
    { "title": "Agreement", "amount": 25000 },
    { "title": "Initial Demo", "amount": 25000 },
    { "title": "Final Demo", "amount": 25000 },
    { "title": "Deployment", "amount": 25000 }
  ],
  "outOfScope": [
    "Native mobile apps",
    "Third-party billing integrations"
  ]
}
```

Amounts are cents: `$250.00` each, `$1,000.00` total.

**Message envelope written to the database:**

```ts
{
  projectId,
  senderId: data.senderId ?? socket.data.userId ?? null,
  type: "SCOPE_WIDGET",
  content: "Project Scope Blueprint",
  payload: <blueprint above>
}
```

### 8.2 Client rendering

`ScopeWidget.tsx` renders, in order: title, Executive Summary, Technical Architecture, Core Features, Milestones (with `$amount/100`), Out of Scope. Clients see **Approve Blueprint** (emits `approve_scope`); builders see "Waiting for client approval."

### 8.3 AI scoping contract **[PROPOSED]**

To replace the mock with a real agent, preserve the existing UI contract and swap only the server-side generation:

- **Input:** client's free-text idea, optional constraints (budget, timeline, stack), and the project's current state.
- **Output:** JSON matching the `ScopePayload` interface below; validate with a schema before persisting.
- **Persistence:** create a `SCOPE_WIDGET` message exactly as today so the frontend needs no changes.
- **Failure mode:** ack `{ ok: false, error }` and post a `SYSTEM` message; do not create an empty blueprint.

**Suggested system prompt (proposed, not implemented):**

```text
You are the Idea Launch scoping agent. Convert a client's software idea into a
delivery blueprint for a milestone-based escrow marketplace.

Return ONLY valid JSON with this shape:
{
  "title": string,
  "executiveSummary": string,
  "technicalArchitecture": string,
  "coreFeatures": string[],
  "milestones": [{ "title": string, "amount": integer }],
  "outOfScope": string[]
}

Rules:
- Amounts are integer USD cents. The four milestone amounts MUST sum to the
  client's stated budget (or 100000 if no budget is given).
- Use exactly four milestones in this order: Agreement, Initial Demo,
  Final Demo, Deployment.
- Keep the architecture to the platform defaults (React, Node.js/Express,
  PostgreSQL/Prisma, Socket.io) unless the idea clearly requires otherwise.
- Be concrete and concise; no markdown, no commentary outside the JSON.
```

---

