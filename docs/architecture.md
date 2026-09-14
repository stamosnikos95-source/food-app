# Healthy Food App — Πρόταση Αρχιτεκτονικής & Πλάνο Υλοποίησης

> Στάδιο: architecture review, πριν από οποιονδήποτε κώδικα. Θα υλοποιήσουμε ένα milestone τη φορά.

## 0. Σύνοψη

Δύο εφαρμογές πελάτη (iOS/Android) + ένα admin web dashboard, πάνω σε ένα κεντρικό backend API με PostgreSQL, και ένα ξεχωριστό AI service για recommendations, conversational assistant, demand forecasting και waste reduction. Modular, testable, με RBAC και σαφή διαχωρισμό ευθυνών ανά service — όχι monolith "όλα σε ένα".

## 1. High-level architecture

Βασικά components (βλ. διάγραμμα παραπάνω):

- **Mobile app (customer)** — React Native, iOS + Android από ένα codebase.
- **Admin web** — ξεχωριστή web εφαρμογή (όχι mobile) για dashboard, μενού, παραγγελίες, inventory. Το admin θέλει πραγματική οθόνη, πληκτρολόγιο, πολλαπλά παράθυρα δεδομένων — mobile-first UX δεν ταιριάζει εκεί.
- **Backend API** — ένα REST API (NestJS) με σαφή module boundaries, πίσω από API gateway/reverse proxy.
- **PostgreSQL** — κύρια βάση δεδομένων (relational, ταιριάζει απόλυτα σε menu/orders/inventory με ισχυρές σχέσεις).
- **AI service** — ξεχωριστό Python service (recommendations, forecasting, conversational assistant), επικοινωνεί με το backend μέσω internal API. Ξεχωριστό γιατί το ML/data-science tooling είναι πολύ πιο ώριμο σε Python απ' ό,τι σε Node.
- **Redis** — cache, rate limiting, job queue (BullMQ) για async εργασίες (π.χ. αποστολή email/push, batch forecasting jobs).
- **Object storage (S3-compatible)** — εικόνες πιάτων/μενού.
- **Payment provider** — Viva Wallet (ελληνικός πάροχος, καλή τοπική υποστήριξη) ή Stripe (αν χρειάζεται διεθνής επεκτασιμότητα)· η επιλογή δεν κλειδώνει την αρχιτεκτονική, το payment module είναι abstracted πίσω από ένα interface.
- **Push notifications** — Expo push / FCM / APNs.

Όλα τα services είναι containerized (Docker) και deployed ξεχωριστά, ώστε το AI service να μπορεί να scale-άρει ανεξάρτητα από το core API.

## 2. Technology stack & αιτιολόγηση

| Layer | Επιλογή | Γιατί |
|---|---|---|
| Mobile | React Native (Expo) + TypeScript | Ένα codebase για iOS/Android, μεγάλο ecosystem, γρήγορο iteration, δυνατότητα custom native modules όταν χρειαστεί (π.χ. payment SDK) |
| Admin web | Next.js + TypeScript | Server-side rendering για γρήγορο dashboard, καλό DX, ίδιο TypeScript type-sharing με το backend |
| Backend API | NestJS (Node.js + TypeScript) | Δομημένη, modular αρχιτεκτονική εξ ορισμού (modules/controllers/services), built-in DI, guards για RBAC, decorators για validation, αυτόματο OpenAPI/Swagger |
| ORM / migrations | Prisma | Type-safe queries, καθαρό migration system, καλή εμπειρία με PostgreSQL |
| Database | PostgreSQL (managed, π.χ. RDS/Cloud SQL) | Ισχυρές relational εγγυήσεις για παραγγελίες/πληρωμές, ώριμο tooling, καλή κλιμάκωση |
| AI / ML service | Python (FastAPI) | Ώριμο ecosystem για forecasting (π.χ. gradient boosting/time-series) και ενσωμάτωση με LLM API |
| Conversational assistant | Anthropic API (Claude), tool-use grounded στο πραγματικό μενού | Ώστε οι προτάσεις να αναφέρονται πάντα σε πραγματικά, υπαρκτά items — όχι hallucinated πιάτα |
| Cache / queue | Redis + BullMQ | Απλό, αξιόπιστο, ήδη μέρος του Node ecosystem |
| Auth | JWT (access + refresh) | Stateless, καλά υποστηριζόμενο σε mobile + web |
| CI/CD | GitHub Actions | Καλή ενσωμάτωση με monorepo, δωρεάν για μικρές ομάδες |
| Infra | Docker + ECS/Cloud Run (όχι πλήρες k8s στην αρχή) | Αρκετό για scale σε χιλιάδες χρήστες χωρίς το operational overhead του Kubernetes· k8s μπορεί να έρθει αργότερα αν χρειαστεί |

## 3. Database schema (PostgreSQL) — βασικές οντότητες

**Χρήστες & προφίλ**
- `users` (id, email, phone, password_hash, role, created_at)
- `customer_profiles` (user_id FK, age, gender, height_cm, weight_kg, activity_level, goal)
- `dietary_preferences` (user_id FK, type, value)
- `exclusions` (user_id FK, ingredient_id FK ή κατηγορία)

**Μενού & διατροφή**
- `ingredients` (id, name, unit, cost_per_unit, supplier_id, current_stock)
- `ingredient_nutrition` (ingredient_id FK, calories, protein, carbs, fat, fiber, sodium ανά 100g)
- `recipes` (id, name, description, category)
- `recipe_ingredients` (recipe_id FK, ingredient_id FK, quantity, unit)
- `menu_items` (id, recipe_id FK, name, price, portion_weight_g, image_url, available_date, max_daily_qty)

**Παραγγελίες & πληρωμές**
- `orders` (id, user_id FK, status, total_price, order_type, created_at)
- `order_items` (order_id FK, menu_item_id FK, quantity, unit_price, customizations JSON)
- `payments` (id, order_id FK, provider, status, amount, transaction_ref)

**Loyalty & subscriptions**
- `subscription_plans` (id, name, meals_per_week, price)
- `subscriptions` (id, user_id FK, plan_id FK, status, start_date, end_date)
- `loyalty_accounts` (user_id FK, points_balance, tier)
- `loyalty_transactions` (id, user_id FK, points, type, related_order_id)

**Corporate & gyms**
- `corporate_clients` (id, company_name, billing_info)
- `corporate_employees` (id, corporate_client_id FK, user_id FK)
- `gyms` (id, name, address, contact)
- `gym_qr_codes` (id, gym_id FK, code, active)

**Inventory, waste & forecasting**
- `inventory_transactions` (id, ingredient_id FK, type [in/out/waste], quantity, reason, created_at)
- `waste_logs` (id, ingredient_id FK ή menu_item_id FK, quantity, reason, date)
- `demand_forecasts` (id, menu_item_id FK, date, predicted_qty, actual_qty, model_version)

**AI & audit**
- `ai_conversations` (id, user_id FK, messages JSON, created_at)
- `ai_recommendations_log` (id, user_id FK, context, recommended_items JSON, accepted BOOLEAN)
- `audit_logs` (id, actor_user_id, action, entity, entity_id, created_at) — για ενέργειες admin/staff σε ευαίσθητα δεδομένα

Το πλήρες Prisma schema (με τύπους, indexes, constraints) γράφεται στο M0/M1, όχι τώρα — αυτό είναι το εννοιολογικό μοντέλο.

## 4. API design

- REST, versioned: `/api/v1/...`
- Consistent error format (π.χ. `{ statusCode, message, error }`), pagination με `?page&limit`, auth μέσω `Authorization: Bearer <token>`
- Αυτόματο OpenAPI/Swagger doc από τα NestJS decorators

Βασικές ομάδες endpoints:
- `/auth` — register, login, refresh, logout
- `/users/me`, `/profile`, `/preferences`
- `/menu` — σημερινό μενού, item details, nutrition
- `/ai/chat`, `/ai/recommendations`
- `/cart`, `/orders`, `/payments`
- `/subscriptions`, `/loyalty`
- `/gyms`, `/gyms/qr/:code`
- `/admin/menu`, `/admin/recipes`, `/admin/ingredients`, `/admin/pricing`
- `/admin/orders`, `/admin/customers`, `/admin/corporate`
- `/admin/inventory`, `/admin/waste`, `/admin/forecasts`, `/admin/reports`

## 5. Folder structure (monorepo, pnpm workspaces)

```
/apps
  /mobile        React Native + TypeScript (Expo)
  /admin-web     Next.js + TypeScript
  /api           NestJS + TypeScript
  /ai-service    Python (FastAPI)
/packages
  /shared-types  Κοινοί TS τύποι (mobile, admin-web, api)
  /ui-kit        Κοινά design tokens / components όπου εφικτό
  /config        eslint, tsconfig, κ.λπ.
/infra
  /docker
  /ci            GitHub Actions workflows
/docs
  architecture.md, api.md, adr/  (architecture decision records)
```

Μέσα στο `/apps/api`: modular ανά domain —
`/src/modules/{auth,users,profile,menu,orders,payments,subscriptions,loyalty,gyms,corporate,inventory,ai,admin,common}`,
κάθε module με δικό του controller/service/dto/entities/tests. Καμία λογική "όλα σε ένα αρχείο".

## 6. Authentication & authorization

- JWT access token (μικρής διάρκειας, ~15 λεπτά) + refresh token με rotation, αποθηκευμένο ασφαλώς (secure storage/keychain στο mobile)
- Password hashing με argon2/bcrypt
- Προαιρετικό social login (Google, Apple — το Apple Sign-In είναι απαραίτητο αν προσφέρεις άλλα social logins, λόγω App Store rules)
- RBAC roles: `customer`, `staff`, `admin`, `gym_partner`, `corporate_admin` — μέσω NestJS Guards, με πιο λεπτομερή permissions πίνακα για staff αν χρειαστεί (π.χ. `can_manage_menu`, `can_manage_orders`)
- Rate limiting στα auth endpoints, προαιρετικό 2FA για admin accounts
- Τα δεδομένα προφίλ (ηλικία, ύψος, βάρος, στόχος) είναι ευαίσθητα προσωπικά δεδομένα (GDPR) — encryption at rest για τα πεδία αυτά, endpoints για data export/delete ("δικαίωμα στη λήθη"), audit log σε κάθε πρόσβαση admin σε προφίλ πελάτη

## 7. AI layer

1. **Conversational food assistant** — το backend φέρνει real-time context (σημερινό μενού, προφίλ, budget), το στέλνει στο LLM με tool-use (π.χ. `get_daily_menu`, `get_nutrition_info`, `add_to_cart`) ώστε οι προτάσεις να αναφέρονται πάντα σε πραγματικά menu items, ποτέ σε κάτι εκτός μενού.
2. **Personalised recommendations** — Φάση 1 (MVP): rule-based scoring (macro-fit, budget-fit, exclusions filter, δημοφιλία). Φάση 2: ML ranking πάνω στα logs αποδοχής/απόρριψης προτάσεων.
3. **Demand forecasting** — ξεχωριστό Python job, time-series/gradient-boosting μοντέλο ανά menu item (ιστορικό πωλήσεων, ημέρα εβδομάδας, καιρός, events γυμναστηρίων) → προτεινόμενες ποσότητες παραγωγής.
4. **Waste reduction** — συνδυασμός forecast accuracy + waste logs + ημερομηνίες λήξης → προτάσεις "surplus" έκπτωσης σε πιάτα/υλικά κοντά στη λήξη.
5. **Sales analysis** — aggregated reporting queries, προαιρετικά με LLM-generated σύνοψη τάσεων για το admin (nice-to-have, όχι MVP).
6. **Product/combo suggestions** — market-basket analysis πάνω σε παραγγελίες, review από άνθρωπο πριν δημοσιευτεί combo (όχι auto-publish).

**Guardrail**: κάθε διατροφική πρόταση εμφανίζεται ρητά ως ενδεικτική, ποτέ ως ιατρική/διαιτολογική σύσταση — αυτό μπαίνει και στο system prompt του assistant και στο UI copy.

## 8. Design system

- **Τυπογραφία**: ζευγάρι fonts με χαρακτήρα (όχι default system font) — μια ζεστή, ευανάγνωστη sans για body text + μια πιο εκφραστική για headings, ώστε να μη μοιάζει με "AI template".
- **Χρώμα**: ήπια, γήινη παλέτα (κρεμ/λευκό base, σκούρο κείμενο, μία accent — π.χ. λαδί ή terracotta) — όχι μπλε-μωβ "AI gradient" αισθητική.
- **Design tokens**: spacing scale, radius scale, ελάχιστες σκιές/κίνηση — ορισμένα μία φορά σε shared package, χρησιμοποιούνται και στο mobile και στο admin-web.
- **Information hierarchy**: menu items ως καθαρές κάρτες, ξεκάθαρα nutrition tags, φωτογραφία φαγητού στο επίκεντρο (όχι illustrations).
- **Navigation**: bottom tabs στο mobile (Σημερινό μενού / AI assistant / Παραγγελίες / Προφίλ), λίγα taps μέχρι την παραγγελία.
- **Accessibility**: WCAG AA contrast, dynamic type, screen-reader labels, tap targets ≥44px, τα nutrition tags όχι μόνο με χρώμα.

## 9. Milestones

| # | Milestone | Περιεχόμενο |
|---|---|---|
| M0 | Foundations | Monorepo, CI/CD σκελετός, βασικό infra, auth σκελετός, design tokens |
| M1 | Λογαριασμός & προφίλ | Account/login, προφίλ, προτιμήσεις, budget |
| M2 | Μενού & παραγγελία (core) | Ημερήσιο μενού, θερμίδες/macros, καλάθι, παραγγελία (pickup, χωρίς πληρωμή ακόμα) |
| M3 | Πληρωμές & ιστορικό | Payment integration, order status, ιστορικό παραγγελιών |
| M4 | AI v1 | Rule-based recommendations + conversational assistant πάνω στο πραγματικό μενού |
| M5 | Admin core | Διαχείριση μενού/συνταγών/υλικών, τιμολόγηση, διαχείριση παραγγελιών |
| M6 | Πελάτες & εταιρικοί | Διαχείριση πελατών, corporate accounts |
| M7 | Inventory & forecasting | Inventory, waste tracking, demand forecasting v1 |
| M8 | Loyalty & subscriptions | Πόντοι, συνδρομητικά πλάνα |
| M9 | Gyms & QR | Συνεργασίες γυμναστηρίων, QR ordering |
| M10 | AI v2 & scale hardening | ML recommendations, sales analytics, waste optimization, load testing, security review |

## 10. MVP scope (Phase 1)

**Μέσα**: account/login, προφίλ + προτιμήσεις + budget, ημερήσιο μενού με θερμίδες/macros, καλάθι + παραγγελία (pickup, ένας τρόπος πληρωμής), βασικό rule-based "τι να φάω σήμερα", βασικό admin (μενού/συνταγές/υλικά, διαχείριση παραγγελιών, απλή αναφορά πωλήσεων), RBAC (customer/staff/admin), CI/CD + βασικά tests.

**Έξω από το MVP** (επόμενες φάσεις): loyalty, subscriptions, corporate accounts, γυμναστήρια/QR, πλήρες conversational AI, demand forecasting, waste analytics, advanced sales analytics.

---

Επόμενο βήμα: αν το stack/scope σου φαίνονται σωστά, ξεκινάμε το M0 σε λεπτομέρεια (Prisma schema, NestJS module σκελετός, CI pipeline) — ένα κομμάτι τη φορά, με έλεγχο πριν προχωρήσουμε στο επόμενο.
