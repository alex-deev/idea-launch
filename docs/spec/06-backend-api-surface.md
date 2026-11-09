## 6. Backend API Surface

### 6.1 HTTP

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/health` | Public | `{ "status": "ok", "uptime": <seconds> }` |
| * | `/auth/*` | Auth.js | Standard Auth.js endpoints (sign-in, session, callbacks, etc.) |

No project/milestone/message REST endpoints exist; those operations are Socket.io-only.

### 6.2 Socket.io Connection

- CORS origin: `CLIENT_ORIGIN` (default `http://localhost:5173`), credentials enabled.
- On connect: `socket.data.userId = socket.handshake.auth?.userId ?? null`.
- Client may send `auth: { userId, role, name }`; only `userId` is stored.
- Logs connection and disconnection with reason.

**Room model:** one Socket.io room per `projectId`. Clients join via `join_project`; all subsequent project events are broadcast with `io.to(projectId).emit(...)`.

**Ack convention:** mutating handlers accept an optional callback `ack({ ok, ... })`. On failure: `{ ok: false, error: "<message>" }`.

---

