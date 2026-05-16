# MishiMenu — Implementation Plan
## Single-tenant build — one installation = one restaurant

---

## Repository layout

MishiMenu is split across three repositories:

| Repo | Purpose |
|---|---|
| `mishimenu` | **This repo.** Next.js web server — customer ordering, receipt upload, owner dashboard, OCR pipeline. |
| `mishimenu-app` | Native companion app for customers (Expo/React Native, GitHub Releases). |
| `mishimenu-web` | Marketing and documentation website. |

This document covers the `mishimenu` server only. Docker Compose (`docker-compose.yml`) bundles Next.js with a full self-hosted Supabase stack so any restaurant can run it with a single command.

---

## Architecture summary

- **Single-tenant**: one installation = one restaurant. No slug-based routing, no restaurant list.
- Routes: `/` (menu), `/pay/[orderId]`, `/dashboard`, `/dashboard/login`.
- DB: `restaurant` table (singular, one row), `categories`, `menu_items`, `orders`, `order_items`, `receipts`. No `restaurant_id` FKs.
- `lib/restaurant.ts` exports `getRestaurant()` — fetches + caches the one row.
- Install: `./mishimenu install` seeds the restaurant row and creates the owner account.

---

## Phase 0 — Project Scaffold

### Task 0.1 — Initialize Next.js project `[blocking]`
```bash
npx create-next-app@latest mishimenu \
  --typescript --tailwind --eslint --app \
  --src-dir=false --import-alias="@/*"
```

### Task 0.2 — Install dependencies `[blocking]`
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install tesseract.js
```

### Task 0.3 — Environment files
Create `.env.local` (not committed) and `.env.local.example` (committed):
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
OCR_INTERNAL_SECRET=dev-secret-change-in-production
```

### Task 0.4 — Supabase client setup `[parallel]`
- `lib/supabase/client.ts` — browser client (anon key)
- `lib/supabase/server.ts` — service role client for server-side use

### Task 0.5 — Shared types `[parallel]`
Create `lib/types.ts`. Key interfaces:
- `Restaurant` — no `slug`, no `active` field
- `Category` — no `restaurant_id`
- `MenuItem` — no `restaurant_id`
- `Order` — no `restaurant_id`
- `OrderItem`, `Receipt`, `ParsedReceipt`, `DuplicateCheckResult`

### Task 0.6 — Restaurant helper `[parallel]`
Create `lib/restaurant.ts` with `getRestaurant(): Promise<Restaurant>`. Fetches the single row from the `restaurant` table, caches in module-level variable.

### Task 0.7 — Session management `[parallel]`
Create `lib/session.ts` — generate/persist session UUID in localStorage and cookie.

### Task 0.8 — PWA configuration `[parallel]`
Configure `next.config.ts` with `output: 'standalone'`. Create `public/manifest.json` with Web Share Target entry. Add PWA meta tags to `app/layout.tsx`.

### ✅ Phase 0 verification
- [ ] `npm run dev` starts without errors
- [ ] `http://localhost:3000` loads
- [ ] `.env.local` is in `.gitignore`
- [ ] `lib/types.ts` has no TypeScript errors

---

## Phase 1 — Database

### Task 1.1 — Run initial migration `[blocking]`
Create `supabase/migrations/001_initial.sql` with the single-tenant schema:

Tables: `restaurant` (1 row), `categories`, `menu_items`, `orders`, `order_items`, `receipts`. No `restaurant_id` columns anywhere except `restaurant` itself.

RLS:
- `restaurant` — public SELECT (service role only writes)
- `categories`, `menu_items` — public SELECT
- `orders` — public INSERT; SELECT by `session_id`; ALL for authenticated owner
- `receipts` — public INSERT; ALL for authenticated owner

### Task 1.2 — Storage buckets `[parallel]`
- `receipts` — private
- `restaurant-assets` — public

### Task 1.3 — Seed data `[parallel]`
Create `supabase/seed.ts`. Inserts the `restaurant` row and sample categories/menu items. Run via `npx ts-node supabase/seed.ts`.

Alternatively, `./mishimenu install` handles seeding the `restaurant` row interactively.

### Task 1.4 — Real-time `[parallel]`
Enable Supabase Realtime for `orders` (INSERT, UPDATE) and `receipts` (UPDATE).

### Task 1.5 — Order expiry cron `[parallel]`
Enable `pg_cron` extension in Supabase dashboard. Schedule a job every 5 minutes to expire `pending_payment` orders past their `expires_at`.

### ✅ Phase 1 verification
- [ ] All tables exist: `restaurant`, `categories`, `menu_items`, `orders`, `order_items`, `receipts`
- [ ] `restaurant` table has exactly 1 row
- [ ] `menu_items` has seeded items with no `restaurant_id` column

---

## Phase 2 — Customer Menu & Ordering

### Task 2.1 — Root menu page `[blocking]`
`app/page.tsx` — server component. Calls `getRestaurant()`, fetches categories and menu items (no restaurant scope filter needed), renders `MenuScreen`.

### Task 2.2 — MenuScreen component `[blocking after 2.1]`
`components/menu/MenuScreen.tsx` — client component. Manages cart state. On order created, navigates to `/pay/${orderId}`.

### Task 2.3 — MenuCategory, CartBar components `[parallel with 2.2]`

### Task 2.4 — OrderSummary component `[blocking after 2.2]`
`components/order/OrderSummary.tsx` — POSTs to `/api/orders` with `sessionId`, `orderType`, `tableNumber`, `items`. No `restaurantId` in body.

### Task 2.5 — POST /api/orders `[blocking after 2.4]`
`app/api/orders/route.ts` — fetches menu items server-side (no restaurant scope filter), calculates total, inserts `orders` and `order_items`.

### ✅ Phase 2 verification
- [ ] `/` renders the menu
- [ ] Cart add/remove works
- [ ] Submitting creates an order in Supabase with no `restaurant_id` column

---

## Phase 3 — Payment Screen & Receipt Upload

### Task 3.1 — Payment page route `[blocking]`
`app/pay/[orderId]/page.tsx` — server component. Fetches order by `orderId` (no restaurant scope). Renders expired state or `PaymentScreen`.

### Task 3.2 — PaymentScreen component `[blocking after 3.1]`
`components/payment/PaymentScreen.tsx` — client component. Back link goes to `/`. Passes no `restaurantSlug` to `ReceiptUpload`.

### Task 3.3 — DeUnaQR, AmountCopy, OrderStatusTimeline `[parallel with 3.2]`

### Task 3.4 — ReceiptUpload component `[blocking after 3.2]`
`components/payment/ReceiptUpload.tsx` — no `restaurantSlug` prop. Uploads to `/api/receipts`.

### Task 3.5 — POST /api/receipts `[blocking after 3.4]`
`app/api/receipts/route.ts` — duplicate check scoped to all orders (no restaurant filter). Storage path: `receipts/${orderId}/${ts}.jpg`.

### ✅ Phase 3 verification
- [ ] `/pay/{orderId}` renders payment screen
- [ ] Receipt upload succeeds and creates a `receipts` row
- [ ] Duplicate receipt (same image) is detected

---

## Phase 4 — OCR Pipeline

### Task 4.1 — Tesseract wrapper `[blocking]`
`lib/ocr/tesseract.ts` — singleton worker, Spanish language.

### Task 4.2 — Receipt parser `[parallel]`
`lib/ocr/parser.ts` — extract txId, amount, sender from OCR text.

### Task 4.3 — Fraud detection `[parallel]`
`lib/fraud/detection.ts` — `checkByImageHash` and `checkByTransactionId`. No `restaurantId` parameter — single-tenant, check against all orders.

### Task 4.4 — POST /api/ocr `[blocking after 4.1–4.3]`
`app/api/ocr/route.ts` — internal endpoint (Bearer auth). Downloads image, runs OCR, checks fraud by txId (no restaurant scope), updates receipt record.

### ✅ Phase 4 verification
- [ ] OCR fires after receipt upload
- [ ] `receipts.extracted_tx_id` populated for readable receipts
- [ ] Duplicate txId across any two orders triggers `is_duplicate = true`

---

## Phase 5 — Owner Dashboard

### Task 5.1 — Dashboard page `[blocking]`
`app/dashboard/page.tsx` — server component. Checks `auth.getUser()`. Redirects to `/dashboard/login` if unauthenticated. Fetches all non-expired orders (no restaurant filter).

### Task 5.2 — Login page `[parallel with 5.1]`
`app/dashboard/login/page.tsx` — client component. Supabase `signInWithPassword`. Redirects to `/dashboard` on success.

### Task 5.3 — DashboardScreen component `[blocking after 5.1]`
`components/dashboard/DashboardScreen.tsx` — real-time subscription on `orders` (no `restaurant_id` filter) and `receipts`.

### Task 5.4 — OrderCard, DashboardStats, FraudAlert `[parallel with 5.3]`

### Task 5.5 — PATCH /api/orders/[id] `[blocking after 5.4]`
`app/api/orders/[id]/route.ts` — auth required. No restaurant ownership check (single-tenant: any authenticated user is the owner). Validates `status` is `verified` or `rejected`.

### ✅ Phase 5 verification
- [ ] `/dashboard` without auth redirects to login
- [ ] Login succeeds and shows dashboard
- [ ] New orders appear in real-time
- [ ] Verify/reject works

---

## Phase 6 — Web Share Target

### Task 6.1 — Verify PWA installability `[blocking]`
Lighthouse PWA audit must pass.

### Task 6.2 — POST /api/share-target `[blocking after 6.1]`
`app/api/share-target/route.ts` — reads session cookie, finds pending order, stages image, redirects to `/pay/${orderId}?shared=1`.

### Task 6.3 — Staged image retrieval `[parallel]`
`GET /api/receipts/staged?orderId=...` — returns staged image for ReceiptUpload confirmation UI.

### ✅ Phase 6 verification
- [ ] Sharing a DeUna screenshot from Android redirects to correct order
- [ ] Confirmation screen shows staged image

---

## Phase 7 — Polish & Production

### Task 7.1 — Error boundaries and loading states `[parallel]`
Add `loading.tsx` and `error.tsx` for all routes. Skeleton loaders.

### Task 7.2 — Order expiry countdown `[parallel]`
Countdown timer in PaymentScreen. Modal at expiry.

### Task 7.3 — Receipt image compression `[parallel]`
Canvas API compression before upload. Target < 300KB JPEG.

### Task 7.4 — Docker Compose stack `[parallel]`
`docker-compose.yml` bundles Next.js + self-hosted Supabase (Kong, GoTrue, PostgREST, Realtime, Storage, imgproxy, Postgres).

`Dockerfile` — multi-stage build, `output: 'standalone'`.

### Task 7.5 — mishimenu CLI `[parallel]`
`mishimenu.py` management commands: `install`, `start`, `stop`, `restart`, `logs`, `status`, `update`, `hostname`, `backup`, `restore`, `keys`, `seed`, `add-owner`, `help`.

`./mishimenu install` wizard:
1. Generate JWT secret + Supabase keys (pure Python hmac/hashlib)
2. Ask: restaurant name, address, phone, RUC, DeUna QR URL, owner email/password, domain
3. Write `.env` (Docker) and `.env.local` (Next.js)
4. `docker compose up -d`
5. Wait for Supabase to be healthy
6. Seed `restaurant` row via `psql` in Docker
7. Create owner account via GoTrue API

### ✅ Phase 7 verification
- [ ] All routes have loading and error states
- [ ] `docker compose up` starts the full stack
- [ ] `./mishimenu install` completes without manual steps
- [ ] Lighthouse: Performance ≥ 90, PWA = pass

---

## File creation order

```
lib/types.ts
lib/session.ts
lib/restaurant.ts
lib/supabase/client.ts
lib/supabase/server.ts
lib/ocr/tesseract.ts
lib/ocr/parser.ts
lib/fraud/detection.ts
supabase/migrations/001_initial.sql
supabase/seed.ts
public/manifest.json
next.config.ts
app/layout.tsx
app/page.tsx
app/pay/[orderId]/page.tsx
app/pay/[orderId]/loading.tsx
app/dashboard/page.tsx
app/dashboard/login/page.tsx
app/dashboard/loading.tsx
app/api/orders/route.ts
app/api/orders/[id]/route.ts
app/api/receipts/route.ts
app/api/receipts/staged/route.ts
app/api/ocr/route.ts
app/api/share-target/route.ts
components/menu/MenuScreen.tsx
components/menu/MenuCategory.tsx
components/menu/CartBar.tsx
components/order/OrderSummary.tsx
components/order/OrderTypeSelector.tsx
components/payment/PaymentScreen.tsx
components/payment/DeUnaQR.tsx
components/payment/AmountCopy.tsx
components/payment/ReceiptUpload.tsx
components/payment/OrderStatusTimeline.tsx
components/dashboard/DashboardScreen.tsx
components/dashboard/DashboardStats.tsx
components/dashboard/OrderCard.tsx
components/dashboard/FraudAlert.tsx
components/ui/Button.tsx
components/ui/Badge.tsx
components/ui/Card.tsx
components/ui/Toast.tsx
Dockerfile
docker-compose.yml
.env.example
mishimenu.py
mishimenu
mishimenu.bat
```

---

*Version: 2.0 — Single-tenant rewrite — May 2026*
