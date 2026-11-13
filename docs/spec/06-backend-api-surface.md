## 6. Backend API Surface

### 6.1 HTTP

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | Public | `{ "status": "ok", "uptime": <seconds> }` |
| * | `/auth/*` | Auth.js | Standard Auth.js endpoints (sign-in, session, callbacks, signout) |
| POST | `/api/auth/register` | Public | Create account (`name`, `email`, `password`, optional `role`) |
| GET | `/api/projects` | Client-supplied `userId`/`role` | List client's projects, or builder's assigned/active projects and **published/open (`OPEN_FOR_BIDS`) projects available to offer on** (`?available=true`), including offer-summary context as needed |
| GET | `/api/projects/:id` | Public (by id) | Project detail with milestones/messages/client/builder and (as applicable) offers/selection state |
| GET | `/api/projects/:id/offers` | Client-supplied (authorized) | List offers for a project (client: all; builder: own/visible per rules) for comparison |
| POST | `/api/projects` | Client-supplied `clientId` | Create project (SCOPING) with optional milestones |
| GET | `/api/payments/config` | Public | Current payment provider mode |
| GET | `/api/payments?projectId=` | Public | Payment audit trail |
| POST | `/api/payments/escrow/fund` | Client-supplied | Fund escrow (`{ projectId, amountCents? }`) — normally driven by final-offer acceptance |
| POST | `/api/payments/milestones/release` | Client-supplied | Release milestone payout (`{ milestoneId }`) |

> **Deprecated (replaced by Offer flow):** `POST /api/projects/:id/claim` (exclusive first-claim). Builder participation occurs via offer submission/selection/acceptance (see §7). Implementations may retain a compatibility shim during migration, but the claim model is not authoritative.

### 6.2 Socket.io Connection

- CORS origin: `CLIENT_ORIGIN` (default `http://localhost:5173`), credentials enabled.
- On connect: `socket.data.userId = socket.handshake.auth?.userId ?? null`.
- Client may send `auth: { userId, role, name }`; only `userId` is stored. Identity is **not** verified against the Auth.js session.
- Logs connection and disconnection with reason.

**Room model:** one Socket.io room per `projectId`. Clients join via `join_project`; all subsequent project events are broadcast with `io.to(projectId).emit(...)`.

**Ack convention:** mutating handlers accept an optional callback `ack({ ok, ... })`. On failure: `{ ok: false, error: "<message>" }`.

---
