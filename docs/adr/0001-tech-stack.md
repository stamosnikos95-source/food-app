# ADR 0001: Core technology stack

**Status**: Accepted (confirmed by the client, no changes requested)
**Date**: M0

## Decision

- Mobile: React Native (Expo) + TypeScript
- Admin: Next.js + TypeScript (separate web app, not mobile)
- Backend API: NestJS + TypeScript, PostgreSQL via Prisma
- AI/forecasting: separate Python (FastAPI) service
- Auth: JWT access + refresh, RBAC via NestJS guards
- Infra: Docker, GitHub Actions CI; Cloud Run/ECS-style deploy (no Kubernetes at this scale)

## Why

See `/docs/architecture.md` sections 1–2 for the full reasoning per component.
Kept here as a short-form record so future decisions can reference *this*
decision explicitly ("supersedes ADR 0001" / "extends ADR 0001") instead of
re-litigating the whole architecture doc.

## Consequences

- Two frontend codebases (mobile + admin-web) share `@food-app/design-tokens`
  and `@food-app/shared-types`, not UI components — React Native and React DOM
  render differently, so component-level sharing isn't attempted.
- The AI service is a second runtime (Python) alongside the Node backend —
  accepted complexity in exchange for using mature ML/forecasting tooling.
