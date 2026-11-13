## 4. System Architecture

```
┌─────────────────────────────┐         ┌─────────────────────────────┐
│  React 19 SPA (Vite)        │         │  Node.js + Express 5        │
│  localhost:5173             │         │  localhost:3001             │
│                             │  HTTP   │                             │
│  App.tsx (routes/auth)      │ ──────► │  /health, /auth/*           │
│  ProjectWorkspace / Chat    │         │  /api/auth/register         │
│  Widgets / Controls         │         │  /api/projects, /api/payments│
│                             │ Socket  │                             │
│  socket.io-client           │ ◄─────► │  Socket.io server           │
│                             │         │  src/socket.ts              │
└─────────────────────────────┘         └──────────────┬──────────────┘
                                                       │ Prisma
                                                       ▼
                                            ┌─────────────────────┐
                                            │  PostgreSQL         │
                                            │  User, Project,     │
                                            │  Milestone, Message │
                                            │  Payment, Account,  │
                                            │  Session            │
                                            └─────────────────────┘
```

- HTTP exposes health, Auth.js endpoints, registration, project list/detail/create, offer listing (as applicable), and payment config/audit/funding/release.
- **Business mutations** (scoping/publish, offers, selection/negotiation/finalization/acceptance, demos, milestones, cancel, rating, onboarding) occur over Socket.io.
- **Offers are first-class records** (one active offer per builder per project) decoupled from exclusive claim: multiple builders may offer on a published/open project; builder assignment/commitment is established by offer selection and acceptance.
- CORS is restricted to `CLIENT_ORIGIN` (default `http://localhost:5173`) with credentials enabled, for both HTTP and Socket.io.
- A single shared `PrismaClient` lives in `server/src/lib/prisma.ts` (reused across HTTP and socket handlers).

### 4.1 Runtime bootstrap (`server/src/index.ts`)

1. Load `.env` via `dotenv/config`.
2. Reuse the shared `PrismaClient`.
3. Configure `ExpressAuth` with:
   - `PrismaAdapter(prisma)`
   - `secret: AUTH_SECRET`, `trustHost: true`
   - `session.strategy = "jwt"` (HttpOnly cookie)
   - One **Credentials** provider (email + password, verified with scrypt).
4. Apply `cors({ origin: CLIENT_ORIGIN, credentials: true })` and `express.json()`.
5. Register `GET /health` → `{ status: "ok", uptime }`.
6. Mount `/auth` → `ExpressAuth(authConfig)` and `POST /api/auth/register`.
7. Mount `/api/projects` and `/api/payments`.
8. Create HTTP server, attach Socket.io via `initializeSocket(httpServer)`.
9. Listen on `PORT` (default `3001`).

### 4.2 Authentication (implemented)

| Aspect | Implementation |
|---|---|
| Provider | Credentials: email + password (scrypt hash/verify) |
| Registration | `POST /api/auth/register` (`name`, `email`, `password`, optional `role`: `CLIENT`/`BUILDER`) |
| Session | JWT in an HttpOnly, SameSite=Lax cookie; no session rows read on hot path |
| User lookup | `prisma.user.findUnique({ where: { email } })` |
| Returned user | `{ id, name, email, role }` (+ probationary/rulesAccepted for builders) |
| Socket identity | `socket.handshake.auth.userId` (client-supplied, **not verified** against the Auth.js session) |

> **Security note:** REST project/payment routes and Socket.io handlers trust client-supplied `userId`/`clientId`/`builderId`; none are authorized against the Auth.js session. Production must verify the session before accepting these calls.

---
