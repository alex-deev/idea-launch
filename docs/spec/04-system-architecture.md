## 4. System Architecture

```
┌─────────────────────────────┐         ┌─────────────────────────────┐
│  React 19 SPA (Vite)        │         │  Node.js + Express 5        │
│  localhost:5173             │         │  localhost:3001             │
│                             │  HTTP   │                             │
│  App.tsx (role switch)      │ ──────► │  GET /health                │
│  Chat.tsx                   │         │  /auth/*  (Auth.js)         │
│  Widgets / Controls         │         │                             │
│                             │ Socket  │  Socket.io server           │
│  socket.io-client           │ ◄─────► │  src/socket.ts              │
└─────────────────────────────┘         └──────────────┬──────────────┘
                                                       │ Prisma
                                                       ▼
                                            ┌─────────────────────┐
                                            │  PostgreSQL         │
                                            │  User, Project,     │
                                            │  Milestone, Message │
                                            └─────────────────────┘
```

- The HTTP layer is intentionally minimal: health check and Auth.js endpoints only.
- **All business mutations occur over Socket.io** (not REST).
- CORS is restricted to `CLIENT_ORIGIN` (default `http://localhost:5173`) with credentials enabled, for both HTTP and Socket.io.
- Two `PrismaClient` instances exist (one in `index.ts`, one in `socket.ts`); functionally fine for the MVP but worth consolidating.

### 4.1 Runtime bootstrap (`backend/src/index.ts`)

1. Load `.env` via `dotenv/config`.
2. Instantiate `PrismaClient`.
3. Configure `ExpressAuth` with:
   - `PrismaAdapter(prisma)`
   - `secret: AUTH_SECRET`, `trustHost: true`
   - `session.strategy = "jwt"`
   - One **Credentials** provider (demo login).
4. Apply `cors({ origin: CLIENT_ORIGIN, credentials: true })` and `express.json()`.
5. Register `GET /health` → `{ status: "ok", uptime }`.
6. Mount `/auth` → `ExpressAuth(authConfig)`.
7. Create HTTP server, attach Socket.io via `initializeSocket(httpServer)`.
8. Listen on `PORT` (default `3001`).

### 4.2 Authentication (implemented)

| Aspect | Implementation |
|---|---|
| Provider | Credentials, single `username` field |
| Accepted usernames | `client` and `builder` only |
| Email mapping | `client` → `client@example.com`; `builder` → `builder@example.com` |
| User lookup | `prisma.user.findUnique({ where: { email } })`; rejects if absent |
| Returned user | `{ id, name, email, role }` |
| JWT callback | Copies `user.id` and `user.role` into token |
| Session callback | Copies `token.id` and `token.role` into `session.user` |
| Socket identity | `socket.handshake.auth.userId` (client-supplied, **not verified**) |

> **Security note:** Socket.io does not validate the Auth.js session/JWT; any client can claim any `userId`. The frontend does not currently perform an Auth.js login at all — it uses hardcoded demo identities. Production must verify the session before accepting socket events.

---

