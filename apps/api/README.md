# @food-app/api

NestJS backend. M0 scope: config validation, Prisma wiring, auth (register/login with
JWT access+refresh), RBAC scaffolding (`@Roles` + `RolesGuard`), global error format
and request logging.

## Setup

```bash
cp .env.example .env
# from repo root:
docker compose -f infra/docker/docker-compose.yml up -d
pnpm install
pnpm --filter @food-app/api prisma:generate
pnpm exec prisma migrate dev --name init --schema apps/api/prisma/schema.prisma
pnpm --filter @food-app/api start:dev
```

## Tests

```bash
# Unit tests (mocked Prisma, no DB required)
pnpm --filter @food-app/api test

# End-to-end (needs Postgres running + migrations applied)
pnpm --filter @food-app/api test:e2e
```

## What's here vs. what's next

Included now: `auth` and `users` modules, Prisma `User` + `CustomerProfile` models,
global validation/error/logging, env validation.

Not yet: `menu`, `orders`, `payments`, `inventory`, `ai` modules — these land in
M1–M7 per the architecture doc, one at a time.
