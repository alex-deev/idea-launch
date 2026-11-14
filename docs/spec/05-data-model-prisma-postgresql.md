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
| `totalEscrow` | Int | `@default(0)` — cents (agreed/funded total; on acceptance reflects accepted final offer) |
| `status` | ProjectStatus | `@default(SCOPING)` |
| `clientId` | String | FK → `User.id`, `onDelete: Cascade` |
| `builderId` | String? | FK → `User.id`, `onDelete: SetNull` — **assigned on acceptance** of the winning offer (not via first-claim) |
| `selectedOfferId` | String? | FK → `Offer.id` (`onDelete: SetNull`) — offer currently selected for negotiation/decision (null when none) |
| `acceptedOfferId` | String? | FK → `Offer.id` (`onDelete: SetNull`) — winning accepted/final offer |
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
| `offers` | Offer[] | |
| `createdAt` / `updatedAt` | DateTime | `now()` / `@updatedAt` |

### 5.6 `Milestone`

| Field | Type | Attributes |
|---|---|---|
| `id` | String | `@id @default(cuid())` |
| `projectId` | String | FK → `Project.id`, `onDelete: Cascade` |
| `stageNumber` | Int | 1–3 |
| `title` | String | |
| `amount` | Int | cents |
| `releasePercent` | Int | `@default(0)` — payout share metadata (30/40/30); milestone `amount` is the releasable cents (Initial 30%, Final 40%, Deployment 30% of total) |
| `status` | MilestoneStatus | `@default(PLANNED)` |
| `dueDate` | DateTime? | negotiable in offer terms pre-accept; applied to project milestones on acceptance |
| `releasedAt` | DateTime? | |
| `latePenalty` | Int | `@default(0)` — cents |
| `demoUrl` | String? | current primary link for the milestone (latest submission; mirrors the first bundle slot’s `accessUrl`) |
| `revisionRequestedAt` | DateTime? | when client requested demo changes (soft 24h revision target source; reset on each rejection) |
| `revisionReason` | String? | client’s required reason for requesting changes on the current demo |
| `currentDemoMessageId` | String? | reference to the current actionable `DEMO_WIDGET` submission message for this milestone |
| `deliverableSpec` | Json? | agreed v2 multi-target deliverable bundle (uniform across all milestones), copied from the accepted offer snapshot at acceptance: `{ version: 2, targets: PlatformTarget[], slots: [{ target, kind, platform?, os?, label?, notes? }] }`. `submit_demo` derives/locks slot kind/platform/OS from this contract and validates the bundle submission against it. |
| `createdAt` / `updatedAt` | DateTime | `now()` / `@updatedAt` |

> **Demo review (Direction A, lightweight):** applies to **Initial Demo** and **Final Demo** milestones only. A rejection sets `CHANGES_REQUESTED` with `revisionRequestedAt`/`revisionReason` and targets the current submission; each new rejection resets the soft 24h target. Builder resubmission creates a new `DEMO_WIDGET` for the same milestone (a complete bundle covering every contracted target), updates `currentDemoMessageId`/`demoUrl` and clears/advances review state per flow (late resubmission allowed and flagged). Only the current, non-rejected submission may be approved/released. Submissions are v2 bundles validated against the locked milestone bundle spec (server-derived kind/platform/OS per slot, strict HTTP(S) links, bundle-level `whatChanged` on resubmission); legacy v1 single-deliverable/demoUrl submissions are not supported.

### 5.7 `Offer` (first-class)

| Field | Type | Attributes |
|---|---|---|
| `id` | String | `@id @default(cuid())` |
| `projectId` | String | FK → `Project.id`, `onDelete: Cascade` |
| `builderId` | String | FK → `User.id`, `onDelete: Cascade` |
| `status` | OfferStatus | `@default(SUBMITTED)` |
| `totalCents` | Int | proposed/agreed total (cents); per-milestone amounts are auto-derived 30/40/30 and read-only |
| `milestonesSnapshot` | Json | calculated milestone terms (titles, amounts, releasePercent, proposed `dueDate`s, and per-milestone `deliverable` v2 bundle `{ version: 2, targets, slots }`) for comparison/negotiation. Project-level `platformTargets` are propagated uniformly to every milestone. The accepted snapshot’s bundle is copied to project milestones as `deliverableSpec` on acceptance. |
| `longTermAmountCents` | Int? | informational (MVP, not escrowed) |
| `longTermCadence` | LongTermCadence | `@default(NONE)` |
| `longTermNotes` | String? | informational terms/notes |
| `submittedAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |
| `finalizedAt` | DateTime? | set when marked `FINAL` |
| `withdrawnAt` | DateTime? | |

**Constraints/invariants:** `@@unique([projectId, builderId])` (one active offer per builder per project). Terms of record on acceptance are applied to `Project.totalEscrow` and project `Milestone`s.

### 5.8 `Message`

| Field | Type | Attributes |
|---|---|---|
| `id` | String | `@id @default(cuid())` |
| `projectId` | String | FK → `Project.id`, `onDelete: Cascade` |
| `senderId` | String? | FK → `User.id`, `onDelete: SetNull` |
| `type` | MessageType | `@default(TEXT)` |
| `content` | String | |
| `payload` | Json? | widget/system data (offer widgets may be derived from or linked to `Offer` for compatibility). `DEMO_WIDGET` payloads carry the v2 bundle submission: `{ specVersion: 2, submittedAt, bundle: { slots: [{ target, deliverable: { kind, platform?, os?, title, accessUrl, instructions, version?, credentials?, summary? } }], whatChanged? }, demoUrl/accessUrl` (mirrored to first slot), late/revision flags }. |
| `createdAt` | DateTime | `@default(now())` |

### 5.9 Enums

```prisma
enum ProjectStatus {
  SCOPING
  OPEN_FOR_BIDS
  ACTIVE
  COMPLETED
  CANCELLED
}

enum OfferStatus {
  SUBMITTED
  SELECTED
  BLOCKED
  FINAL
  ACCEPTED
  REJECTED
  WITHDRAWN
}

enum LongTermCadence {
  NONE
  MONTHLY
  QUARTERLY
  YEARLY
  ONE_TIME
}

enum MilestoneStatus {
  PLANNED
  IN_PROGRESS
  CHANGES_REQUESTED
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

### 5.9 Seed data (`server/prisma/seed.ts`)

Deletes in dependency order: offers → messages → payments → milestones → projects → sessions → accounts → users, then creates:

- **Users:** `client@example.com` (`CLIENT`, `client-user`), `builder@example.com` (`BUILDER`, `builder-user`), `builder2@example.com` (`BUILDER`, `builder-two`), all with password `password`.
- **Projects (4):** `project-123` Idea Launch Marketplace (`SCOPING`), `project-456` Analytics Dashboard (`OPEN_FOR_BIDS`, 2 submitted offers), `project-789` Mobile Companion App (`ACTIVE`, accepted multi-target offer `[WEB, MOBILE_IOS]`, builder assigned), `project-999` Client Portal Redesign (`SCOPING`).
- **Milestones/offers:** 3 milestones per project (Initial Demo 30%, Final Demo 40%, Deployment 30%); offer snapshots and milestone `deliverableSpec` store uniform v2 multi-target bundles (project `456` includes `[WEB]` and `[WEB, MOBILE_ANDROID]` offers).


> **Migrations exist** under `server/prisma/migrations/` (`20261109000000_init`, `20261109010000_add_payments`, `20261109020000_add_user_password`, `20261114120000_add_milestone_deliverable_spec`, `20261114130000_migrate_deliverables_to_v2_bundle`). The v2 migration backfills legacy single-deliverable specs/demo payloads to uniform v2 bundles. Apply with `npm run prisma:deploy -w server` (or `npm run db:migrate` where shadow DB is supported) before seeding.

---

