## 12. Known Gaps, Risks, and Open Questions

1. **No session-based authorization:** REST project/payment routes and Socket.io handlers trust client-supplied IDs; none fully verify the Auth.js session or project/offer membership/ownership. Production must authorize callers and enforce role/participant checks (especially for offers, selection, negotiation, acceptance).
2. **Offer workflow not yet implemented (promoted spec):** multi-builder offers (Offer model/events/UI), decoupled from exclusive claim, selection/negotiation/finalization/cancel flows, pre-funding chat gating to client+selected builder, and “Approve & Publish” UX are specified in `docs/spec/*` and [`docs/ideas/client-builder-offer-workflow.md`](../ideas/client-builder-offer-workflow.md) but require implementation/migration from the current claim/single-offer flow.
3. **No Stripe webhooks:** funding/payout status is set synchronously by the provider call; no async reconciliation for real Stripe intents/transfers.
4. **No platform fees / long-term cost billing:** escrow payouts use the full milestone amount; long-term costs are informational terms only in MVP (no billing/collection).
5. **No automated tests or CI:** root `npm test` is a placeholder (exits 1); no unit/integration/E2E tests and no CI workflow. Client lint (oxlint) is warning-only.
6. **No server lint:** only the client runs oxlint; the server has no lint configuration.
7. **Onboarding verification:** GitHub connection is a local boolean toggle (no OAuth); portfolio URLs are not verified.
8. **State-machine/flow gaps (remaining):** `extensionGranted` recorded but no approval flow; `BLOCKED` milestone status unused; real-Stripe funding can remain pending/unactivated. (Offer/acceptance invariants are defined in spec; enforce server-side on implementation.)
9. **Single Prisma client is shared** via `server/src/lib/prisma.ts`.
10. **Demo review/revision not yet implemented (promoted spec):** demo accept/reject with required reason, soft 24h revision window (reset per rejection, late allowed/flagged), same-milestone resubmission, current-vs-historical demo handling, `reject_demo` event, milestone review-state fields/status, and guarded `approve_milestone`/submit targeting for **Initial/Final Demo** are specified (Direction A, see [`docs/ideas/demo-review-and-revision.md`](../ideas/demo-review-and-revision.md) and `docs/spec/*`) but require implementation/migration.
11. **Spec/implementation drift:** `docs/spec/` and `TECHNICAL_SPEC.md` are the promoted target; current source may lag until promoted workflows (e.g. Offer workflow, demo review/revision) are implemented. Source/config remains authoritative for deployed behavior if they differ.

---
