## 5. Data Model (Prisma / PostgreSQL)

**Datasource:** PostgreSQL via `DATABASE_URL`, with `DIRECT_URL` for direct connections (Supabase-compatible).
**Generator:** `prisma-client-js`.
**Money convention:** all monetary fields are `Int` **cents** (e.g. `25000` = `$250.00`). UI divides by 100 for display.

### 5.1 `User`

| Field | Type | Attributes |
|---|---|---|
| `id` | String | `@id @default(cuid())` |
| `role` | String | `@default("CLIENT")` — values used: `CLIENT`, `BUILDER` |
| `ecosystems` | String | `@default("")` — comma-separated list |
| `portfolioUrls` | String | `@default("")` — comma-separated list |
| `probationary` | Boolean | `@default(true)` |
| `rulesAccepted` | Boolean | `@default(false)` |
| `name` | String? | |
| `email` | String? | `@unique` |
| `emailVerified` | DateTime? | Auth.js field |
| `image` | String? | |
| `accounts` | Account[] | |
| `sessions` | Session[] | |
| `clientProjects` | Project[] | relation `"ClientProjects"` |
| `builderProjects` | Project[] | relation `"BuilderProjects"` |
| `sentMessages` | Message[] | relation `"SentMessages"` |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |

### 5.2 `Account` (Auth.js)

| Field | Type | Attributes |
|---|---|---|
| `id` | String | `@id @default(cuid())` |
| `userId` | String | FK → `User.id`, `onDelete: Cascade` |
| `type` | String | |
| `provider` | String | |
| `providerAccountId` | String | |
| `refresh_token`, `access_token` | String? | |
| `expires_at` | Int? | |
| `token_type`, `scope`, `id_token`, `session_state` | String? | |

Constraint: `@@unique([provider, providerAccountId])`.

### 5.3 `Session` (Auth.js)

| Field | Type | Attributes |
|---|---|---|
| `id` | String | `@id @default(cuid())` |
| `sessionToken` | String | `@unique` |
| `userId` | String | FK → `User.id`, `onDelete: Cascade` |
| `expires` | DateTime | |

### 5.4 `VerificationToken` (Auth.js)

| Field | Type | Attributes |
|---|---|---|
| `identifier` | String | |
| `token` | String | `@unique` |
| `expires` | DateTime | |

Constraint: `@@unique([identifier, token])`.

### 5.5 `Project`

| Field | Type | Attributes |
|---|---|---|
| `id` | String | `@id @default(cuid())` |
| `title` | String | |
| `totalEscrow` | Int | `@default(0)` — cents |
| `status` | ProjectStatus | `@default(SCOPING)` |
| `clientId` | String | FK → `User.id`, `onDelete: Cascade` |
| `builderId` | String? | FK → `User.id`, `onDelete: SetNull` |
| `deadline` | DateTime? | |
| `extensionRequested` | Boolean | `@default(false)` |
| `extensionGranted` | Boolean | `@default(false)` |
| `cancelledAt` | DateTime? | |
| `refundPercent` | Int? | |
| `refundAmount` | Int? | cents |
| `qualityScore` | Int? | 1–5 |
| `qualityFeedback` | String? | |
| `latePenaltyTotal` | Int | `@default(0)` — cents |
| `milestones` | Milestone[] | |
| `messages` | Message[] | |
| `createdAt` / `updatedAt` | DateTime | `now()` / `@updatedAt` |

### 5.6 `Milestone`

| Field | Type | Attributes |
|---|---|---|
| `id` | String | `@id @default(cuid())` |
| `projectId` | String | FK → `Project.id`, `onDelete: Cascade` |
| `stageNumber` | Int | 1–4 |
| `title` | String | |
| `amount` | Int | cents |
| `releasePercent` | Int | `@default(0)` |
| `status` | MilestoneStatus | `@default(PLANNED)` |
| `dueDate` | DateTime? | |
| `releasedAt` | DateTime? | |
| `latePenalty` | Int | `@default(0)` — cents |
| `demoUrl` | String? | |
| `createdAt` / `updatedAt` | DateTime | `now()` / `@updatedAt` |

### 5.7 `Message`

| Field | Type | Attributes |
|---|---|---|
| `id` | String | `@id @default(cuid())` |
| `projectId` | String | FK → `Project.id`, `onDelete: Cascade` |
| `senderId` | String? | FK → `User.id`, `onDelete: SetNull` |
| `type` | MessageType | `@default(TEXT)` |
| `content` | String | |
| `payload` | Json? | widget-specific data |
| `createdAt` | DateTime | `@default(now())` |

### 5.8 Enums

```prisma
enum ProjectStatus {
  SCOPING
  OPEN_FOR_BIDS
  ACTIVE
  COMPLETED
  CANCELLED
}

enum MilestoneStatus {
  PLANNED
  IN_PROGRESS
  RELEASED
  COMPLETED
  BLOCKED
}

enum MessageType {
  TEXT
  WIDGET
  DEMO_WIDGET
  SCOPE_WIDGET
  SYSTEM
}
```

### 5.9 Seed data (`backend/prisma/seed.ts`)

Deletes in dependency order: messages → milestones → projects → sessions → accounts → users, then creates:

- **Client:** `id: "client-user"`, `name: "Client User"`, `email: "client@example.com"`, `role: "CLIENT"`.
- **Builder:** `id: "builder-user"`, `name: "Builder User"`, `email: "builder@example.com"`, `role: "BUILDER"`.
- **Project:** `id: "project-123"`, `title: "Project 123"`, `totalEscrow: 100000` (`$1,000.00`), `status: "SCOPING"`, deadline `now + 14 days`, client + builder assigned.
- **Milestones:**

| id | Stage | Title | Amount | releasePercent | Status |
|---|---|---|---|---|---|
| `milestone-1` | 1 | Agreement | 25000 | 0 | PLANNED |
| `milestone-2` | 2 | Initial Demo | 25000 | 30 | PLANNED |
| `milestone-3` | 3 | Final Demo | 25000 | 40 | PLANNED |
| `milestone-4` | 4 | Deployment | 25000 | 30 | PLANNED |

> **No migrations exist.** `backend/prisma/` contains only `schema.prisma` and `seed.ts`; a `prisma migrate dev`/`db push` is required before seeding.

---

