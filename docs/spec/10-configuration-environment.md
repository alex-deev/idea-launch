## 10. Configuration & Environment

### 10.1 Backend `.env` keys (values intentionally omitted)

| Key | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL pooled connection (local Prisma Dev by default) |
| `DIRECT_URL` | Direct/non-pooled connection (Supabase-compatible) |
| `AUTH_SECRET` | Auth.js signing secret |
| `PORT` | API port, default `3001` |
| `CLIENT_ORIGIN` | Allowed CORS origin, default `http://localhost:5173` |

Commented Supabase placeholders exist for production URLs. **No `.env.example` is committed**, although `.gitignore` references `!.env.example`.

### 10.2 Frontend configuration

- `vite.config.ts`: `react()`, `tailwindcss()`, alias `@` → `./src`.
- Hardcoded API origin in components: `http://localhost:3001`.
- No Vite env variables are used (e.g. no `VITE_API_URL`).

### 10.3 Devcontainer

- Name: `Build It`; Dockerfile build; user `node`; 2 GB RAM / 2 CPUs.
- Forwards ports **5173** and **49374** — note that backend **3001** is not forwarded.
- `postCreateCommand`: `npm install --prefer-offline`.

### 10.4 Commands

```bash
# Install (workspace root)
npm install

# Run both apps
npm run dev            # concurrently: backend tsx watch + frontend vite

# Individual
npm run dev -w backend
npm run dev -w frontend

# Database
npm run prisma:generate -w backend
npm run prisma:migrate  -w backend   # creates migrations (none exist yet)
npm run seed            -w backend

# Build
npm run build           # both workspaces
npm run build -w backend
npm run build -w frontend

# Lint / preview
npm run lint -w frontend
npm run preview -w frontend
```

---

