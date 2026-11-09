## 2. Repository Layout

```
idea-launch/
├── package.json                 # npm workspaces root; concurrently dev script
├── package-lock.json
├── skills-lock.json
├── .gitignore                   # ignores node_modules, dist, .env*
├── .devcontainer/
│   ├── Dockerfile
│   └── devcontainer.json        # forwards 5173, 49374; postCreate: npm install
├── .opencode/
│   ├── agents/frontend-developer.md
│   └── skills/                  # 27 reusable engineering skills
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                     # DATABASE_URL, DIRECT_URL, AUTH_SECRET, PORT, CLIENT_ORIGIN
│   ├── prisma/
│   │   ├── schema.prisma        # PostgreSQL schema
│   │   └── seed.ts              # demo users, project-123, 4 milestones
│   ├── src/
│   │   ├── index.ts             # Express app, Auth.js, HTTP server bootstrap
│   │   └── socket.ts            # all Socket.io event handlers
│   └── dist/                    # compiled JS (present)
└── frontend/
    ├── package.json
    ├── vite.config.ts           # React + Tailwind plugins, "@" → ./src
    ├── components.json          # shadcn config (radix-nova, neutral, lucide)
    ├── tsconfig*.json
    ├── .oxlintrc.json
    ├── public/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx              # role switcher + onboarding gate
    │   ├── App.css
    │   ├── index.css            # Tailwind v4 theme, Geist font, light/dark tokens
    │   ├── components/
    │   │   ├── Chat.tsx
    │   │   ├── BuilderOnboarding.tsx
    │   │   ├── ScopeWidget.tsx
    │   │   ├── OfferWidget.tsx
    │   │   ├── DemoWidget.tsx
    │   │   ├── ProjectControls.tsx
    │   │   └── ui/              # badge, button, card, checkbox, input
    │   └── lib/utils.ts         # cn() helper
    └── dist/                    # production build (present)
```

**Workspace model:** npm workspaces (`frontend`, `backend`). Root `npm run dev` runs both dev servers via `concurrently`.

---

