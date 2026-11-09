## 3. Technology Stack

### 3.1 Root

| Item | Version / Value |
|---|---|
| Package manager | npm workspaces |
| Node dev orchestration | `concurrently ^10.0.7` |
| Scripts | `dev` (backend + frontend), `build` (all workspaces), `test` (placeholder, exits 1) |
| Module type | `commonjs` at root |

### 3.2 Backend

| Category | Package | Version |
|---|---|---|
| Runtime | Node.js | (devcontainer image) |
| Language | TypeScript | `^7.0.2` |
| Dev runner | `tsx` | `^4.21.0` |
| Web framework | `express` | `^5.3.0` |
| Realtime | `socket.io` | `^4.8.4` |
| ORM | `@prisma/client` / `prisma` | `6.19.3` |
| Database | PostgreSQL | via `DATABASE_URL` + `DIRECT_URL` |
| Auth | `@auth/express` | `^0.12.3` |
| Auth adapter | `@auth/prisma-adapter` | `^2.11.3` |
| CORS | `cors` | `^2.8.5` |
| Env loading | `dotenv` | `^17.2.3` |
| Types | `@types/node`, `@types/express`, `@types/cors` | `^24.19.2`, `^5.0.6`, `^2.8.19` |

**Backend scripts:** `dev` (`tsx watch src/index.ts`), `build` (`tsc`), `start` (`node dist/index.js`), `prisma:generate`, `prisma:migrate` (`prisma migrate dev`), `prisma:studio`, `seed` (`tsx prisma/seed.ts`).

**Compiler:** `target ES2023`, `module NodeNext`, `strict`, `rootDir src`, `outDir dist`, source maps.

### 3.3 Frontend

| Category | Package | Version |
|---|---|---|
| UI library | `react`, `react-dom` | `^19.3.1` |
| Build tool | `vite` | `^8.3.6` |
| React plugin | `@vitejs/plugin-react` | `^6.1.2` |
| Language | TypeScript | `~7.0.2` |
| Styling | `tailwindcss` + `@tailwindcss/vite` | `^4.3.5` |
| Components | shadcn (`^4.23.0`), `radix-ui ^1.8.1` | |
| Variants | `class-variance-authority` | `^0.7.1` |
| Icons | `lucide-react` | `^1.70.0` |
| Realtime client | `socket.io-client` | `^4.8.4` |
| Fonts | `@fontsource-variable/geist` | `^5.3.0` |
| Animation | `tw-animate-css` | `^1.4.0` |
| Lint | `oxlint` | `^1.90.0` |

**Frontend scripts:** `dev` (`vite`), `build` (`tsc -b && vite build`), `lint` (`oxlint`), `preview` (`vite preview`).

**TypeScript:** bundler resolution, `jsx: react-jsx`, path alias `@/* → ./src/*`, `noUnusedLocals/Parameters`, `noEmit`.

---

