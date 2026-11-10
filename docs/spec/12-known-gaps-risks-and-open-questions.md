## 12. Known Gaps, Risks, and Open Questions

1. **No session-based authorization:** REST project/payment routes and Socket.io handlers trust client-supplied `userId`/`clientId`/`builderId`; none verify the Auth.js session or project membership. Production must authorize callers.
2. **No Stripe webhooks:** funding/payout status is set synchronously by the provider call; there is no async reconciliation for real Stripe intents/transfers.
3. **No platform fees:** escrow payouts use the full milestone amount; no application fee or platform cut is deducted.
4. **Payout percentages vs. model:** `releasePercent` is display/seed metadata; payouts use `milestone.amount`. Reconcile with the business model if percentages should drive amounts.
5. **No automated tests or CI:** root `npm test` is a placeholder (exits 1); no unit/integration/E2E tests and no CI workflow. Client lint (oxlint) is warning-only.
6. **No server lint:** only the client runs oxlint; the server has no lint configuration.
7. **Onboarding verification:** GitHub connection is a local boolean toggle (no OAuth); portfolio URLs are not verified.
8. **State-machine gaps:** `accept_offer` has no status guard; `extensionGranted` is recorded but has no approval flow; `BLOCKED` milestone status is unused.
9. **Probationary cap client-only:** the `$1,500` cap is enforced only in the frontend offer button, not on the server.
10. **Single Prisma client is shared** via `server/src/lib/prisma.ts` (consolidated; previously duplicated).
11. **Spec drift risk:** `docs/spec/` and `TECHNICAL_SPEC.md` are maintained manually; source/config is authoritative if they drift.

---
