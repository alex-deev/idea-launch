# Idea Launch

Project-based development marketplace MVP: clients scope an idea with an AI agent,
approve a milestone plan, and work with builders in a realtime chat; builders
onboard, submit staged demos, and receive milestone-based escrow releases.

## Structure

```
idea-launch/
├── client/                  # React 19 + Vite + Tailwind v4 + shadcn/ui
│   └── src/
│       ├── components/      # Chat, widgets, onboarding, project controls
│       └── lib/api.ts       # VITE_API_URL → HTTP + Socket.io origin
├── server/                  # Express 5 + Socket.io + Prisma
│   ├── prisma/
│   │   ├── schema.prisma    # User, Project, Milestone, Message (+ Auth.js)
│   │   ├── migrations/      # Initial PostgreSQL migration
│   │   └── seed.ts          # Demo client/builder + project-123
│   └── src/
│       ├── index.ts         # Auth.js v5, /health, /api/me, HTTP server
│       ├── socket.ts        # Realtime marketplace events
│       ├── lib/prisma.ts    # Shared PrismaClient
│       └── services/
│           └── synthesis.ts # Gemini Structured Outputs scope agent
└── package.json             # npm workspaces: client, server
```

## Quick start

```bash
npm install
cp server/.env.example server/.env   # fill in Supabase URLs + AUTH_SECRET
cp client/.env.example client/.env   # optional; defaults to localhost:3001

npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001 (`/health`, `/auth/*`, `/api/me`)
- Prisma Studio: `npm run db:studio`

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase **Transaction pooler** (port 6543, `pgbouncer=true`) used at runtime |
| `DIRECT_URL` | Supabase **direct** connection (port 5432) used by `prisma migrate` |
| `AUTH_SECRET` | Auth.js signing secret (`openssl rand -base64 32`) |
| `GEMINI_API_KEY` | Gemini key for the Phase 2 Synthesis Agent (empty = local fallback) |
| `GEMINI_MODEL` | Defaults to `gemini-2.5-flash` |
| `CLIENT_ORIGIN` | CORS origin, defaults to `http://localhost:5173` |

## Auth

Auth.js v5 (`@auth/express` + Prisma adapter) uses **JWT sessions in an HttpOnly,
SameSite=Lax cookie**. Demo credentials: `client` / `builder` (mapped to the
seeded users). `GET /api/me` returns the current session user.

## AI scoping

`[TRIGGER_SCOPE_GENERATION] <idea>` on `send_message` calls the Synthesis Agent,
which requests JSON via Gemini Structured Outputs, validates it with Zod, and
normalizes the four milestone amounts to the project budget. Without a Gemini
key it returns a deterministic blueprint so local development still works.

## Payments (mock mode)

`USE_MOCK_PAYMENTS=true` (default) routes escrow funding and milestone payouts
through an in-memory mock provider that returns Stripe-shaped PaymentIntents
and transfers. Set `USE_MOCK_PAYMENTS=false` plus `STRIPE_SECRET_KEY` and
`STRIPE_CONNECTED_ACCOUNT_ID` to use the real Stripe REST provider.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/payments/config` | Current provider mode |
| GET | `/api/payments?projectId=` | Payment audit trail |
| POST | `/api/payments/escrow/fund` | Fund escrow (`{ projectId, amountCents? }`) |
| POST | `/api/payments/milestones/release` | Release payout (`{ milestoneId }`) |

The same service backs the Socket.io `accept_offer` and `approve_milestone`
events, so the existing chat UI exercises the mock provider end to end.
`MOCK_PAYMENT_FAILURE_RATE` (0–1) can simulate provider failures.

## Next steps

1. Verify the Auth.js session on Socket.io connections and REST routes instead of trusting client-supplied `userId`/`clientId`/`builderId`.
2. Add Stripe webhook handling and async reconciliation for real payment intents/transfers.
3. Deduct platform fees from escrow payouts and reconcile payout percentages with the business model.
4. Add automated tests (Vitest/Playwright) and CI.
5. Keep `docs/spec/` and `TECHNICAL_SPEC.md` in sync with code changes (see `AGENTS.md`).
