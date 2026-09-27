# Food App — healthy-food ordering platform

Customer app, kitchen/back-office web app and API for a healthy-food kitchen in Athens.

| | |
|---|---|
| Customer app (web preview) | https://food-app-mobile-web.onrender.com |
| Admin / kitchen | https://food-app-admin-435q.onrender.com |
| API | https://food-app-api-6glo.onrender.com/api/v1 (health: `/health`) |

## What's built (M0–M10)

- **Customers**: accounts with rotating sessions; chip-based profile (goal, diet, 14 EU allergens, budget); daily menu with nutrition and allergens; cart and orders (pick-up or delivery to a partner gym); card payments ready (Stripe, off until a key is set); "Τι να φάω σήμερα;" recommendations with reasons; optional AI assistant (off until a key is set); loyalty points; meal plans; GDPR data export and account deletion.
- **Kitchen & back office**: live order board with what to collect; menu, ingredients and recipes with food cost; inventory ledger, waste and production planning with demand forecasts; customers and roles; corporate clients with daily allowances and monthly statements; meal plans; partner gyms with QR posters and commission reports; sales analytics, combos and forecast accuracy.
- **Quality**: 167 unit tests; typed builds against the real database schema; boot smoke test; browser checks of every screen at phone size. Details: [`docs/security.md`](docs/security.md), decisions in [`docs/adr/`](docs/adr).

## Turning on the optional features (Render → food-app-api → Environment)

| Feature | Variables |
|---|---|
| Card payments | `STRIPE_SECRET_KEY` (and later `STRIPE_WEBHOOK_SECRET`) |
| AI assistant | `ANTHROPIC_API_KEY` (optional `ANTHROPIC_MODEL`) |
| First admin | `ADMIN_EMAILS` (existing accounts only) |
| Loyalty rules | `LOYALTY_POINTS_PER_EURO`, `LOYALTY_REWARD_POINTS`, `LOYALTY_REWARD_VALUE_CENTS` |

## Layout

```
apps/api         NestJS API (PostgreSQL via Prisma, migrations in prisma/migrations)
apps/admin-web   Next.js back office (static export)
apps/mobile      Expo / React Native customer app (web export deployed)
packages/        design tokens, shared types
docs/            architecture, ADRs, security
```

## Development

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # DATABASE_URL, JWT_ACCESS_SECRET, ...
pnpm --filter @food-app/api prisma:generate
pnpm --filter @food-app/api test            # unit tests (no database needed)
pnpm --filter @food-app/api build && pnpm --filter @food-app/api run smoke
pnpm --filter @food-app/admin-web build
pnpm --filter @food-app/mobile typecheck
```

Before a public launch, work through "Known gaps" in [`docs/security.md`](docs/security.md).
