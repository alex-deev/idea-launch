## 2. Repository Layout

```
idea-launch/
├── package.json                 # npm workspaces root; concurrently dev script
├── package-lock.json
├── skills-lock.json
├── .gitignore                   # ignores node_modules, dist, .env*
├── .devcontainer/
│   ├── Dockerfile
│   └── devcontainer.json        # forwards 3001, 5173, 5555; postCreate: npm install
├── .opencode/
│   ├── agents/frontend-developer.md
│   └── skills/                  # reusable engineering skills
├── client/                      # React 19 + Vite + Tailwind v4 + shadcn/ui
│   ├── package.json
│   ├── vite.config.ts           # React + Tailwind plugins, "@" → ./src
│   ├── components.json          # shadcn config (radix-nova, neutral, lucide)
│   ├── tsconfig*.json
│   ├── .env.example             # VITE_API_URL (optional)
│   ├── .oxlintrc.json
│   ├── public/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx              # routes, auth, theme
│   │   ├── App.css
│   │   ├── index.css            # Tailwind v4 theme, Geist font, light/dark tokens
│   │   ├── components/
│   │   │   ├── Chat.tsx
│   │   │   ├── ProjectWorkspace.tsx
│   │   │   ├── ScopeIntakeForm.tsx
│   │   │   ├── ScopeWidget.tsx
│   │   │   ├── OfferWidget.tsx
│   │   │   ├── DemoWidget.tsx
│   │   │   ├── ProjectControls.tsx
│   │   │   ├── BuilderOnboarding.tsx
│   │   │   └── ui/              # badge, button, card, checkbox, input, ...
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx  # Auth.js session handling
│   │   ├── pages/               # SignInPage, SignUpPage
│   │   └── lib/
│   │       ├── api.ts           # VITE_API_URL → HTTP + Socket.io origin
│   │       └── utils.ts         # cn() helper
│   └── dist/                    # production build (present)
└── server/                      # Express 5 + Socket.io + Prisma + Auth.js v5
    ├── package.json
    ├── tsconfig.json
    ├── .env                     # DATABASE_URL, DIRECT_URL, AUTH_SECRET, PORT, CLIENT_ORIGIN (gitignored)
    ├── .env.example
    ├── prisma/
    │   ├── schema.prisma        # User, Project, Milestone, Message (+ Auth.js)
    │   ├── migrations/          # PostgreSQL migrations (init, payments, user password)
    │   └── seed.ts              # Demo client/builder + 4 projects
    ├── src/
    │   ├── index.ts             # Express app, Auth.js, HTTP server bootstrap
    │   ├── socket.ts            # all Socket.io event handlers
    │   ├── lib/
    │   │   ├── prisma.ts        # shared PrismaClient
    │   │   └── password.ts      # scrypt hash/verify
    │   ├── routes/
    │   │   ├── auth.ts          # POST /api/auth/register
    │   │   ├── projects.ts      # list/detail/create/claim
    │   │   └── payments.ts      # config, audit trail, fund/release
    │   └── services/
    │       ├── synthesis.ts     # Gemini structured-output scoping agent
    │       ├── escrow.ts        # fundEscrow / releaseMilestone
    │       └── payments/        # mock + stripe providers
    └── dist/                    # compiled JS (present)
```

**Workspace model:** npm workspaces (`client`, `server`). Root `npm run dev` runs both dev servers via `concurrently`.

---
