# Typed, Offer-Defined Demo Submissions (MVP)

> Concrete taxonomy, field matrix, and payload contract: [`typed-demo-submissions-contract.md`](./typed-demo-submissions-contract.md).

## Problem Statement
**How might we** replace the builder's placeholder demo submission with a real, type-aware form—defined by the accepted/final offer terms—so clients can reliably access and review each milestone deliverable (and requested revisions) with clear, validated context?

## Recommended Direction
**Direction A — Offer-defined deliverable contract, rendered and enforced end-to-end (link-based).**

The builder's **offer terms become the single source of truth** for what each milestone delivers (deliverable type/category and the required submission fields). Project `appKinds` may **seed/suggest** defaults, but the terms are authoritative and builder-authored (auditable, consistent with the builder-only term authorship model). At **Submit/Resubmit <milestone>** (inline/modal in the ACTIVE chat flow), the builder completes a **strict, type-shaped form**: type-appropriate required fields (at minimum a primary access/download link plus instructions/notes; credentials/steps where the deliverable is gated). On resubmission it **prefills the current submission, surfaces the client's revision reason and soft 24h target, and requires a "what changed / how to verify" summary**.

Cohesion comes from **one contract, many consumers**:
1. **Terms** declare per-milestone deliverable requirements (builder-only, snapshotted/finalized with the offer).
2. **Submit UI** derives fields and client-side validation from those terms.
3. **`submit_demo`** sends a typed payload that the **server validates against the same contract** and records as the current `DEMO_WIDGET` message / milestone submission state.
4. **`DemoWidget`** renders the typed content (primary access link/download, instructions, version/notes, change summary, resubmission flags) inside the existing accept / request-changes review flow.

Artifacts are provided as **access/download links**, not uploaded files, to avoid new storage infrastructure in MVP. This keeps current rules intact (Initial/Final demo review, soft 24h revisions, late/revision flags) while making "it depends on the project type" explicit, enforceable, and reviewable.

## Key Assumptions to Validate
- [ ] **Link-based artifacts suffice for MVP (including executables/binaries).** Builders can provide stable download/access links plus install/run steps that clients accept. *Test:* run one native-app example end-to-end (`.apk`/`.exe` hosted on a release/Drive/TestFlight-style link).
- [ ] **Offer terms can carry per-milestone deliverable specs as the authoritative contract.** The fields fit the terms/snapshot model, builder-only edits hold, and finalize/accept/apply flows stay coherent. *Test:* model and snapshot the fields, then exercise submit/revise/finalize/accept.
- [ ] **A small type taxonomy covers most cases.** Categories (e.g. web/preview URL, mobile build, desktop installer/binary, package/artifact, other) map to real `appKinds`, and `other` stays expressive but structured/required. *Test:* classify the seeded/demo projects and scope outputs.
- [ ] **Server-side strict validation matches client UX.** Required fields/format rules per type are defined once and enforced on `submit_demo` so incomplete/invalid payloads are rejected. *Test:* submit malformed payloads directly via socket and confirm rejection.
- [ ] **Resubmission context is reliable.** Current submission can be prefilled from milestone state / latest `DEMO_WIDGET` payload across refresh/rejoin. *Test:* reject → refresh → resubmit.

## MVP Scope
**In**
- **Per-milestone deliverable requirements in offer terms** (source of truth; builder-authored), suggested from `appKinds` where helpful, with a safe structured `other` path.
- **Inline/modal submit & resubmit form** at the existing CTA: type-appropriate required fields (primary access/download URL + instructions/notes at minimum; required **"what changed"** on resubmission), with **strict client + server validation**.
- **Resubmission context:** prefill from the current submission, show revision reason and soft-24h state, preserve history / "previous submission" semantics.
- **Typed `DEMO_WIDGET` payload + rendering** (and coherent handling of `milestone.demoUrl` / current-submission state) so clients can review, accept, or request changes as today.
- **Link-based artifacts only.**

**Out**
- Actual file uploads / object storage, signed or expiring hosted files, malware scanning.
- Changes to pricing, escrow, milestone split, review policy (who reviews, soft 24h rule), or Deployment review semantics beyond displaying its agreed deliverable.
- Rich in-app previews, versioned artifact management, or a generalized form builder.

## Not Doing (and Why)
- **Real file uploads/hosting** — requires storage, auth, delivery, and retention infrastructure not present today; links meet the need with far less risk for MVP.
- **Submit-time-only (uncontracted) typing** — breaks "offer terms as source of truth" and weakens audit/review clarity.
- **Freeform/unvalidated submissions** — conflicts with the strict-validation constraint and produces low-signal reviews.
- **Reworking escrow/milestones/review rules** — orthogonal; this is a submission-contract and UX change.

## Open Questions
- **Type taxonomy:** which exact deliverable categories do we standardize in MVP, and how do they map from `appKinds` (per-milestone vs per-offer)?
- **Schema details:** exact per-milestone term fields and the typed `submit_demo` / `DEMO_WIDGET` payload shape; how to keep `milestone.demoUrl` and existing consumers coherent/back-compatible.
- **Back-compat:** how do in-flight/legacy offers and past URL-only demo messages render and validate?
- **Access sensitivity:** how should credentials or gated-access info be captured/shared safely (if at all) within chat-visible submissions?
- **Deployment milestone:** is it submitted/reviewed with the same typed contract in MVP, or display-only per current rules?
