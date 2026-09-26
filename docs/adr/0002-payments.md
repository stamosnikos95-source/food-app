# ADR 0002: Online payments via hosted checkout

**Status**: Accepted (M3)

## Decision

- Card payments use **Stripe Checkout** (hosted payment page). Card data never
  reaches our servers, which keeps PCI scope minimal (SAQ A). The page is
  localized to Greek and offers Apple Pay / Google Pay where available.
- Our code talks to a `PaymentProvider` interface
  (`apps/api/src/modules/payments/providers`). Stripe is the only
  implementation today; Viva Wallet can be added as another class.
- One `payments` row per checkout attempt. Starting a new attempt first
  expires the previous open session, so an order can't be charged twice.
- Amounts always come from the stored, server-priced order. A paid session is
  only accepted if amount, currency and order id all match.
- Order lifecycle: `pending` (awaiting payment) -> `confirmed` (paid) ->
  `ready` -> `completed`, or `cancelled`.

## How payment results reach us

1. **Return confirmation**: after paying, the customer is redirected to the
   app, which calls `POST /payments/confirm`; the API asks Stripe for the
   session status (never trusting the redirect itself).
2. **Reconciliation**: listing orders re-checks the customer's recent pending
   attempts, covering customers who closed the tab before returning.
3. **Webhooks** (`POST /payments/webhooks/stripe`, signature-verified against
   the raw body): implemented, active once `STRIPE_WEBHOOK_SECRET` is set.
   **Required before live payments**, because the kitchen must see paid
   orders even if the customer never reopens the app.

All three paths are idempotent (conditional updates on `pending` rows).

## Configuration

`STRIPE_SECRET_KEY` (and later `STRIPE_WEBHOOK_SECRET`) are set only in the
hosting provider's environment settings — never committed, never pasted into
chats or tickets. Without a key the API runs normally and reports payments as
unavailable. `APP_URL` is where checkout redirects back to.
