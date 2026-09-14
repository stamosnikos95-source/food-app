# Food App — monorepo

Healthy-food / meal-prep app for a business in Athens: customer mobile app,
admin web dashboard, backend API, and an AI service. Full architecture
proposal: [`docs/architecture.md`](docs/architecture.md). Decision log:
[`docs/adr/`](docs/adr).

## Layout

```
apps/
  api          NestJS backend (auth, users — M0)
  admin-web    Next.js admin dashboard shell (M0)
  mobile       Expo customer app, navigation skeleton (M0)
packages/
  design-tokens  Shared colors/typography/spacing
  shared-types   Shared TypeScript types (Role, AuthUser, ...)
infra/
  docker         docker-compose for local Postgres + Redis
docs/
  architecture.md, adr/
```

## M0 status — what's real right now

- `apps/api`: builds clean, lints clean, 5/5 unit tests pass (AuthService,
  mocked Prisma — no DB required). Register/login with argon2 + JWT
  access/refresh, RBAC guard scaffolding, global error format, request
  logging, env validation.
- `apps/admin-web`: builds clean (`next build` succeeds), renders a
  placeholder dashboard shell wired to the shared design tokens.
- `apps/mobile`: type-checks clean (`tsc --noEmit`). Bottom-tab navigation
  with 4 placeholder screens. Running it on a simulator/device is the next
  manual check — this environment can verify types but can't launch Expo.
- CI (`.github/workflows/ci.yml`): lint + build + unit tests + e2e (against a
  real Postgres service container) + admin-web build + mobile typecheck.

**One real limitation to know about**: generating the actual Prisma client
(`prisma generate`) downloads a query-engine binary from Prisma's CDN. That
download was blocked in the environment this was built in, so the Prisma
client here has type-checked and built successfully against the *unbuilt*
package, but hasn't been exercised against a live database yet. On your own
machine or in CI (both have normal internet access) this is a non-issue —
just run the setup steps below. Treat "run the e2e suite once, for real"
as the first thing to do after cloning.

## Setup

```bash
corepack enable # or: npm install -g pnpm
pnpm install

cp apps/api/.env.example apps/api/.env
docker compose -f infra/docker/docker-compose.yml up -d

pnpm --filter @food-app/api prisma:generate
pnpm exec prisma migrate dev --name init --schema apps/api/prisma/schema.prisma

pnpm --filter @food-app/api start:dev      # http://localhost:3000/api/v1
pnpm --filter @food-app/admin-web dev      # http://localhost:3000 (admin) -- pick a different port if both run at once
pnpm --filter @food-app/mobile start       # Expo Go / simulator
```

## Tests

```bash
pnpm --filter @food-app/api test       # unit — no DB needed
pnpm --filter @food-app/api test:e2e   # e2e — needs Postgres running + migrated
pnpm --filter @food-app/mobile typecheck
```

## Next milestone

M1 — customer account & profile (register/login UI in the mobile app wired
to the `apps/api` auth endpoints, profile/preferences/budget screens and
API). See `docs/architecture.md` §9 for the full milestone list.
