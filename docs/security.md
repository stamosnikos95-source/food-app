# Security & privacy

Status as of M10. Written for whoever operates or audits the system.

## Controls in place

**Accounts and sessions**
- Passwords hashed with argon2; emails normalised (trimmed, lower-case) so look-alike accounts can't exist.
- Short-lived JWT access tokens (15 min) + opaque, single-use refresh tokens stored only as SHA-256 hashes, rotated on every use; reuse of a rotated token revokes every session of that user.
- Rate limits per client IP (proxy-aware): 10/min on `/auth/*`, 30/min on the public gym lookup, 10/min on the AI assistant, 5/min on data export and account deletion, 120/min default.

**Authorisation**
- Roles: `customer`, `staff` (kitchen board only), `admin`. Guards on every admin route; costs, supplier prices, customers, companies, gyms, plans and analytics are admin-only.
- Admin bootstrap only promotes accounts that already exist, matched on the exact normalised email.
- Every back-office change is written to an audit log (who, what, when).

**Money and data integrity**
- Prices always come from the server; order quantities and totals are bounded.
- Discounts are applied in one fixed order inside one database transaction, with row locks on what they spend (employer allowance, meal credits, loyalty points), so concurrent requests can't double-spend.
- Idempotency: one points award / redemption / reversal per order (unique index); card checkouts use idempotency keys; payment records can't be cascade-deleted.
- Card data never reaches our servers (Stripe Checkout); payments are confirmed by asking Stripe, never by trusting the client.

**Transport and platform**
- HTTPS end to end (Render), security headers via helmet, CORS limited to browsers, secrets only in environment variables (never in code or git).
- `/api/v1/health` reports API and database health for monitoring.

**Privacy (GDPR)**
- Data minimisation: the back office never shows body metrics or allergies.
- Customers can download everything held about them (`GET /users/me/export`) and delete their account (`DELETE /users/me`, password required). Deletion anonymises: profile, employer link and sessions are removed and the email replaced; orders are kept, unlinked, because accounting law requires them.
- AI assistant conversations are not stored. The model receives today's menu and the customer's goal; allergy/diet/budget filtering happens before, and every dish it names is re-validated after.

## Known gaps — address before a public launch

1. **Email verification & password reset** need an email provider (e.g. Postmark, SES). Until then, a typo in an email can't be recovered.
2. **Admin 2FA** (TOTP) for `admin` accounts.
3. **Web token storage**: the web app keeps tokens in `localStorage` (XSS-exposed). Before the web app is public, move to httpOnly, SameSite cookies and add a Content-Security-Policy to both web apps. The native apps use the OS keychain.
4. **CI**: the GitHub Actions workflow is written but not active (the access token lacks the `workflow` scope). Add it so tests run on every push.
5. **Database**: move to a paid plan with daily backups and point-in-time recovery (the free database expires on 14 Oct 2026).
6. **Monitoring**: uptime check on `/api/v1/health` and error alerting (e.g. Sentry).
7. **Stripe webhook secret**: set `STRIPE_WEBHOOK_SECRET` when card payments go live, so payments confirm even if a customer closes the page.
8. **Secrets hygiene**: rotate the GitHub token shared during development; keep production keys out of chats.
9. **Legal**: privacy policy and terms; allergen data per dish must be real before launch (EU Regulation 1169/2011); receipts via the tax authority's e-invoicing (myDATA) — confirm with an accountant.
10. **Load testing** against a paid instance before marketing pushes; the free instance sleeps after 15 minutes.
