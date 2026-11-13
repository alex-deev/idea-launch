# AGENTS.md

## Start here
- npm workspaces: `client` (React 19 + Vite + Tailwind v4 + shadcn/ui) and `server` (Express 5 + Socket.io + Auth.js v5 + Prisma 6/Postgres). Root scripts orchestrate both.
- Entrypoints: `client/src/main.tsx` → `App.tsx`; `server/src/index.ts` → `socket.ts`. Client runs on `5173`, API on `3001` by default.
- `TECHNICAL_SPEC.md` indexes `docs/spec/01–13` (overview, layout, stack, architecture, data model, API surface, socket events, AI scoping, frontend spec, config/env, business rules, known gaps, glossary); kept in sync with code per the convention below. `client/README.md` is the stock Vite template. Prefer source/config if anything drifts.
- Convention: update affected sections of `docs/spec/` and `TECHNICAL_SPEC.md` in the same change; source/config is authoritative if they drift.
- `.opencode/agents/frontend-developer.md` is a generic Next.js-oriented profile; this repo is a Vite SPA using React Router, not Next.js.

## Setup / commands
- `server/.env` is required and gitignored; copy `server/.env.example` and set `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`. `client/.env` is optional (`VITE_API_URL`, default `http://localhost:3001`).
- In this workspace `server/.env` uses Prisma Dev Postgres on `localhost:51214`; migrations need `DIRECT_URL`.
- `npm run dev` starts both apps. Single app: `npm run dev -w client` or `npm run dev -w server`. Run the server through the workspace script so `dotenv/config` finds `server/.env`.
- `npm run db:generate` after editing `schema.prisma`. `npm run db:migrate` = `prisma migrate dev`; deploy with `npm run prisma:deploy -w server`.
- `npm run db:seed` is destructive: it deletes users/projects/messages/payments, then seeds `client@example.com` / `builder@example.com` (password `password`) and four demo projects across SCOPING/OPEN_FOR_BIDS/ACTIVE.
- Verify with `npm run build` (both workspaces), `npm run build -w client|server`, and `npm run lint -w client` (oxlint; currently warning-only, exits 0). There is no server lint.
- There are no tests, CI, or pre-commit hooks. `npm test` is a placeholder that exits 1; don't use it as a verification step.

## Toolchain traps
- Server is ESM + `module: NodeNext`: relative imports in `.ts` must use `.js` extensions.
- `prisma` and `@prisma/client` are pinned to `6.19.3` by root `overrides`; don't bump one workspace independently.
- Client build runs `tsc -b` with `noUnusedLocals`, `noUnusedParameters`, and `verbatimModuleSyntax`; unused code fails the build. Use `import type`.
- Server build only includes `src`; `server/prisma/seed.ts` is not typechecked by `npm run build`.
- Client alias `@/` → `client/src`. Tailwind v4 is CSS-first in `client/src/index.css`; there is no `tailwind.config.*`.
- API and Socket.io origin are centralized in `client/src/lib/api.ts` (`VITE_API_URL`); don't hardcode new origins. CORS uses `CLIENT_ORIGIN` (default `http://localhost:5173`).
- Auth.js v5 uses JWT sessions in an HttpOnly cookie. Client calls `/auth/session`, `/auth/csrf`, `/auth/callback/credentials`, `/auth/signout`; registration is `POST /api/auth/register`. The sign-in "Workspace" selector is cosmetic; role comes from the user record.
- Socket identity is `handshake.auth.userId`, and REST project/payment routes trust client-supplied `userId`/`clientId`/`builderId`. Neither is authorized against the Auth.js session; validate ownership when adding handlers or routes.

## Domain map
- Project states: `SCOPING` → `OPEN_FOR_BIDS` (`approve_scope`) → `ACTIVE` (`accept_offer`/escrow funding) → `COMPLETED` (all milestones released) or `CANCELLED`.
- New projects start `SCOPING`. Builders can claim only unassigned `OPEN_FOR_BIDS` projects; their own assigned projects appear across other statuses. There is no bid model: builders claim via `POST /api/projects/:id/claim`.
- Money is integer cents (`totalEscrow`, `milestone.amount`). Payouts use `milestone.amount`; `releasePercent` is display/seed metadata.
- Realtime lifecycle mutations are Socket.io (`server/src/socket.ts`); REST handles project list/create/claim/detail and payments.
- Chat is `Message` records and `join_project` replays history. Offers, demos, and scope blueprints are `WIDGET`/`DEMO_WIDGET`/`SCOPE_WIDGET` messages, not separate tables.
- `accept_offer` calls `fundEscrow`: mock payments auto-succeed and activate the project; real Stripe returns a pending intent/client secret and leaves it unactivated. `approve_milestone` calls `releaseMilestone`: mock transfers auto-pay; real Stripe transfers may stay pending. No webhooks yet.
- AI scoping: `ScopeIntakeForm` sends `[TRIGGER_SCOPE_GENERATION]` through `send_message`. `services/synthesis.ts` uses Gemini structured output + Zod, normalizes to exactly four milestones, and falls back deterministically without `GEMINI_API_KEY`.
- Fixed milestone titles: Agreement, Initial Demo, Final Demo, Deployment. Scope content and amounts are editable only before approval; titles are read-only. The chat composer is hidden during `SCOPING`.
- Rules: late demo penalty 5%; cancel refund 60/90/100% by highest released stage (≥3/≥2/else); extension +48h with no approval flow; rating 1–5 after `COMPLETED`/`CANCELLED`; builders with 3 accepted `ACTIVE` projects cannot see or submit offers on new open project plans; clients may have at most 3 projects in `OPEN_FOR_BIDS` (publish blocked at limit; `SCOPING` drafts unlimited; slots free on `ACTIVE`/`CANCELLED`); probationary `$1,500` cap is enforced only in the client.
- New builders are `probationary` until `submit_onboarding` clears it.
- Project list refreshes by 5s polling + tab focus, not socket fan-out. Cancelled projects move to the collapsible Archived section and close the open project card.
- `BUSINESS_MODEL.md` is intentionally untracked via `.git/info/exclude`; do not commit it.

## Key files
- Client: `App.tsx` (routes/auth/theme), `ProjectWorkspace.tsx` (sidebar/polling), `Chat.tsx` (socket/messages/widgets), `ScopeIntakeForm.tsx` / `ScopeWidget.tsx` (scoping).
- Server: `index.ts` (bootstrap/auth/REST), `socket.ts` (all realtime events), `routes/*`, `services/synthesis.ts`, `services/escrow.ts`, `services/payments/*`.
- DB: `server/prisma/schema.prisma`, `server/prisma/migrations/`, `server/prisma/seed.ts`.
