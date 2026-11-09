## 12. Known Gaps, Risks, and Open Questions

1. **Missing source document:** the requested "Idea Launch Project" file does not exist; this spec is code-derived. If a canonical product brief exists elsewhere, it should be reconciled with this document.
2. **No migrations:** schema is not materialized via `prisma/migrations`; deployment must run `migrate`/`db push` and seed.
3. **No real auth in the SPA:** Auth.js is configured but unused by the frontend; sockets trust client-supplied `userId`, and no handler authorizes the caller's role or project membership.
4. **No payment/escrow integration:** "Accept & Fund Escrow" only changes status; `totalEscrow` and milestone amounts are never set by `accept_offer`.
5. **Mock AI only:** no LLM provider, prompt storage, schema validation, or retry/error UX; blueprint is static.
6. **Single hardcoded project:** `project-123` and `localhost:3001` are literals in the UI; no project list, creation, or routing.
7. **No message history:** `join_project` returns project state but not prior messages; refreshing loses chat context.
8. **State-machine gaps:** `accept_offer` has no status guard; `extensionGranted` unused; `BLOCKED` milestone status unused.
9. **Incomplete onboarding:** GitHub connection is a local boolean, not OAuth; no verification of portfolio URLs.
10. **Testing/CI:** no unit, integration, or E2E tests; root `npm test` exits with an error placeholder. No lint/CI config for the backend.
11. **Config hygiene:** `.env` is committed locally (gitignored but present); no `.env.example`; backend port 3001 is not forwarded by the devcontainer.
12. **Duplicate Prisma clients** in `index.ts` and `socket.ts`; consolidate into a shared module.

---

