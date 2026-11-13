# App routing: public landing + unified workspace

## Problem Statement
How might we give Idea Launch a clear public entry point and a single canonical app URL so visitors can discover the product at `/` and authenticated users can work in a role-aware `/workspace` without relying on role-specific routes?

## Recommended Direction
Serve a minimal placeholder landing page at `/` with a short value prop and CTAs to `/signin` and `/signup`. When a user is already signed in, `/` still shows the landing but includes a quick button to go to `/workspace`.

Introduce `/workspace` as the sole authenticated app route: unauthenticated visitors redirect to `/signin`, and signed-in users see client or builder UI based on their account role (including existing builder onboarding/probation behavior). Keep `/signin` and `/signup` as auth routes but redirect authenticated users from them to `/workspace`.

Redirect legacy `/client` and `/builder` to `/workspace` (replace) for backward compatibility. Update header links/CTAs, document titles, and any path-based UI conditions (e.g. builder badge logic tied to `/builder`) to align with the new route structure.

## Key Assumptions to Validate
- [ ] A minimal placeholder landing is sufficient for the current launch stage (no marketing redesign/assets implied).
- [ ] A single role-aware `/workspace` URL is acceptable (no `/workspace/client` or `/workspace/builder`).
- [ ] Signed-in users prefer seeing the landing at `/` with a quick “Go to workspace” action (rather than being auto-redirected).
- [ ] Redirecting authenticated users from `/signin`/`/signup` to `/workspace` avoids confusion without breaking any flows.
- [ ] No external/hardcoded dependencies require `/client` or `/builder` to remain distinct, content-serving paths.

## MVP Scope
**In:** minimal landing at `/` (public CTAs + signed-in quick link to `/workspace`), `/workspace` route with auth redirect + role-based rendering reusing existing workspace/onboarding logic, `/signin`/`/signup` redirect-to-workspace when authenticated, `/client` and `/builder` → `/workspace` (replace) redirects, header/title/path-condition updates, `*` → `/` (or appropriate public fallback).
**Out:** full marketing/copy/design, return-to/deep-link state restoration, workspace sub-routes, backend/API changes.

## Not Doing (and Why)
- **Full landing/marketing build** — explicitly a minimal placeholder for now.
- **Separate `/workspace/client` & `/workspace/builder` URLs** — single canonical, role-aware workspace keeps routing simple.
- **Auto-redirect signed-in users from `/`** — landing remains visible with a quick workspace button per confirmed preference.
- **Return-to/deep-link restoration** — unnecessary for this routing slice.

## Open Questions
- Exact minimal landing copy/value-prop text and CTA labels for `/` (placeholder content).
- Should the catch-all route redirect unknown paths to `/` or to `/workspace` for signed-in users? (default: `/`.)
