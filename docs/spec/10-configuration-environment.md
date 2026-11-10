## 10. Configuration & Environment

### 10.1 Backend `.env` keys (values intentionally omitted)
A committed `server/.env.example` lists all keys. Copy to `server/.env` and fill in.

| Key | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL pooled connection (local Prisma Dev by default) |
| `DIRECT_URL` | Direct/non-pooled connection (Supabase-compatible; required for migrations) |
| `AUTH_SECRET` | Auth.js signing secret (`openssl rand -base64 32`) |
| `AUTH_TRUST_HOST` | Trust host header (default `true`) |
| `PORT` | API port, default `3001` |
| `CLIENT_ORIGIN` | Allowed CORS origin, default `http://localhost:5173` |
| `GEMINI_API_KEY` | Gemini key for the Synthesis Agent (empty = deterministic fallback) |
| `GEMINI_MODEL` | Defaults to `gemini-2.5-flash` |
| `USE_MOCK_PAYMENTS` | `true` (default) uses in-memory mock provider |
| `STRIPE_SECRET_KEY` | Required when `USE_MOCK_PAYMENTS=false` |
| `STRIPE_CONNECTED_ACCOUNT_ID` | Builder connected account for real payouts |
| `STRIPE_CURRENCY` | Defaults to `usd` |
| `MOCK_PAYMENT_FAILURE_RATE` | 0–1, simulates provider failures (mock mode) |

### 10.2 Frontend configuration
- `client/.env` is optional; `VITE_API_URL` defaults to `http://localhost:3001` (`client/src/lib/api.ts`).
- `vite.config.ts`: `react()`, `tailwindcss()`, alias `@` → `./src`.

### 10.3 Devcontainer
- Name: `Build It`; Dockerfile build; user `node`; 2 GB RAM / 2 CPUs.
- Forwards ports **3001**, **5173**, and **5555**.
- `postCreateCommand`: `npm install --prefer-offline`.

### 10.4 Commands
```bash
# Install (workspace root)
npm install

# Run both apps
npm run dev

# Individual
npm run dev -w client
npm run dev -w server

# Database
npm run db:generate          # prisma generate
npm run db:migrate            # prisma migrate dev
npm run prisma:deploy -w server  # deploy migrations
npm run db:seed                # destructive: resets users/projects/messages/payments
npm run db:studio

# Build
npm run build                 # both workspaces
npm run build -w client       # tsc -b && vite build
npm run build -w server       # tsc

# Lint / preview
npm run lint -w client        # oxlint (warning-only, exits 0)
npm run preview -w client
```

---
