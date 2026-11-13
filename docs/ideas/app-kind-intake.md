# App Kind Intake (Replace Preferred Stack)

## Problem Statement
**How might we** help non-technical clients describe *what kind of product* they want—without asking them to choose a tech stack—so project intake is simpler and the resulting scope/synthesis is grounded in the right platform target(s)?

## Recommended Direction
**Direction A — Guided “App kind” intake, wired into synthesis & blueprint** (variations 1 + 3 + 7).

Replace the **“Preferred stack”** field in project intake (`client/src/components/ScopeIntakeForm.tsx`) with a plain-language **“App kind”** control: **multi-select options + “Other”** (free text). This keeps intake client-friendly (primary goal) while giving the system structured platform intent.

- **Intake UX (simpler for clients):** Label **“App kind”** with helper copy/examples (non-technical). Users can select one or more kinds and/or specify **Other**.
  - **Proposed option list (multi-select):**
    - **Website** — informational pages viewed in a browser
    - **Web app** — interactive software used in a browser
    - **Mobile app** — app for phones/tablets
    - **Desktop app** — software installed on a computer
  - **Other:** free-text field (e.g. “browser extension”, “API/backend service”, “smart TV app”) so uncommon targets aren’t lost.
- **Replace stack in data flow:** Remove `preferredStack` from the intake payload; send structured platform target(s) instead (e.g. `appKinds` array + `appKindOther`/`appKindNotes` as applicable) with the `[TRIGGER_SCOPE_GENERATION]` message (`server/src/socket.ts`).
- **Feed synthesis & store in scope:** Update `server/src/services/synthesis.ts` (prompt, schema/normalization, fallback `createFallbackBlueprint`) to use “App kind”/platform target(s) rather than “Preferred stack”, producing platform-appropriate architecture/features/out-of-scope guidance. Persist the selected app kind(s) (and Other text) in the generated **`SCOPE_WIDGET`** blueprint payload and surface them clearly in `client/src/components/ScopeWidget.tsx` (client-friendly display; builder-useful context aligned with existing visibility rules).
- **Scope boundary:** Intake + synthesis + stored/displayed blueprint only. No first-class project-wide platform taxonomy/matching (deferred, Direction C).

## Key Assumptions to Validate
- [ ] **Clients find “App kind” clearer than “Preferred stack”** — plain labels/examples (+ Other) are understood without technical knowledge. *Test:* review copy/usability with non-technical users on the intake form.
- [ ] **Platform targets drive useful synthesis/blueprints without a stack** — scopes remain concrete for Website/Web app/Mobile/Desktop/multi-select/Other. *Test:* generate and compare blueprints (Gemini + deterministic fallback) across option combinations.
- [ ] **Multi-select + Other captures intent without confusion** — users aren’t overwhelmed and combos don’t produce incoherent scopes. *Test:* observe selections; refine examples/guidance or normalization of “Other” if needed.
- [ ] **Stored/displayed app kind is helpful and appropriate** — visible in the blueprint in a client-friendly way and useful to builders, consistent with existing scope visibility. *Test:* inspect rendered `ScopeWidget` for client and builder roles.

## MVP Scope
**In**
- Intake: replace “Preferred stack” with **“App kind”** multi-select + **Other** (plain-language labels/examples), and update form state/validation/submit payload.
- Backend/socket: accept and forward app-kind fields in the scope-generation trigger; remove reliance on `preferredStack` for this flow.
- Synthesis: incorporate app kind(s)/Other into prompt and fallback; persist them in the blueprint payload (and include in structured output/normalization as needed).
- Scope UI: display stored app kind(s) in the scope blueprint (`SCOPEWidget`) appropriately for clients/builders.
- Handle multi-select combinations and free-text “Other” robustly (empty/optional-safe).

**Out**
- Keeping “Preferred stack” alongside (strict replacement per decision) or adding extra context-hint fields (Direction B), for now.
- First-class project-level platform attribute, builder matching/filtering, templates, or analytics by app kind (Direction C).
- Inferring platform without user selection.
- Changes to milestone pricing/escrow rules, delivery flow, or unrelated UI.

## Not Doing (and Why)
- **Not keeping “Preferred stack”** — chosen to simplify intake for non-technical clients; stack can be expressed later in architecture/scope details if needed.
- **Not guessing the platform automatically** — preserves client control and avoids wrong assumptions in the blueprint.
- **Not making app kind a platform-wide taxonomy yet (C)** — larger cross-cutting change; validate intake/synthesis value first.
- **Not adding extra intake questions (B)** — avoids reintroducing friction; revisit only if scopes prove under-specified.

## Open Questions
- **Final option list & copy:** confirm the exact set/labels and the **Website vs Web app** distinction (proposed above) and helper examples; include/exclude **“API/Backend”** as a listed option vs rely on **Other**?
- **Label confirmation:** **“App kind”** is chosen — any preference for helper text (e.g. “What are you building?”) or alternative label?
- **Data shape & naming:** canonical payload/blueprint field names (e.g. `appKinds: string[]`, `appKindOther?: string`) and how multi-select renders in the blueprint.
- **Blueprint visibility/placement:** where “App kind” appears in `ScopeWidget` for clients vs builders (and whether it augments or replaces stack mentions in `technicalArchitecture`).
- **Synthesis behavior for multi-select/Other:** how to guide the model for combinations (e.g. shared backend) and normalize/reflect arbitrary “Other” text.
