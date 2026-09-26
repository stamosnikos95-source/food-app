# @food-app/admin-web

Back office for the shop, as a static Next.js export (no Node server): all
data comes from the API at runtime with the staff member's JWT.

- **Παραγγελίες** — kitchen board (new → preparing → ready → picked up),
  refreshes every 15 s, flags late tickets, shows allergens per line.
  Orders paid online can't be cancelled until refunds exist.
- **Μενού** — dishes, prices, nutrition and the 14 EU allergens
  (admins only; staff see it read-only). Dishes are retired, never deleted.
- **Αναφορές** — daily sales summary.

Access: `admin` and `staff` roles only. The first admin is granted by setting
`ADMIN_EMAILS` on the API to the email of an **already registered** account
(see `AdminBootstrapService`). Every status change and menu edit is written
to `audit_logs`.

```bash
pnpm --filter @food-app/admin-web dev     # local
pnpm --filter @food-app/admin-web build   # static site in ./out
```

`NEXT_PUBLIC_API_URL` overrides the API base URL at build time.
