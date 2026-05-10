# MishiPay — Ecuador Restaurant Ordering & Payment PWA
## Requirements & Implementation Specification v1.0

---

## 1. Project Overview

**MishiPay** is an open-source, multi-tenant Progressive Web App (PWA) for Ecuadorian restaurants. It enables customers to browse a menu, place orders, and pay using local payment methods — primarily **DeUna QR** (Banco Pichincha's free wallet) — by uploading or sharing their payment receipt directly through the app. Restaurant owners get a real-time dashboard to verify receipts and send orders to the kitchen, with automatic duplicate-receipt fraud detection.

### Goals

- Zero commissions on DeUna QR payments (free tier, no Pichincha enterprise contract required)
- Works as a web app on any device; installable as a PWA on Android for share-target functionality
- Single codebase supports multiple restaurants via slug-based routing (`/r/[slug]`)
- Open-source, self-hostable, with optional managed hosting as a future monetization path
- SRI-compliant electronic invoicing (Ecuador mandate, January 2026)

### Non-goals (v1.0)

- Native iOS/Android apps
- Integrated card payment processing (Payphone integration deferred to v1.1)
- Kitchen display system (KDS) hardware integration
- Inventory management

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR + PWA + API routes in one repo |
| Language | TypeScript | Type safety for payment/order logic |
| Database | Supabase (PostgreSQL) | Real-time subscriptions, built-in storage, free tier |
| Auth | Supabase Auth | Restaurant owner login; customers are session-only |
| File storage | Supabase Storage | Receipt image uploads |
| OCR | Tesseract.js (server-side) | Free, no external API needed; Claude API as fallback |
| Styling | Tailwind CSS | Utility-first, PWA-friendly |
| PWA | next-pwa | Service worker + Web Share Target manifest |
| Hosting | Vercel (frontend) + Supabase (backend) | Free tier covers MVP |
| Invoicing | Dátil API (optional, v1.1) | SRI electronic invoicing |

---

## 3. Repository Structure

```
mishipay/
├── app/
│   ├── layout.tsx                  # Root layout, PWA meta tags
│   ├── page.tsx                    # Landing page / restaurant finder
│   ├── r/
│   │   └── [slug]/
│   │       ├── page.tsx            # Customer: menu + ordering flow
│   │       ├── pay/
│   │       │   └── [orderId]/
│   │       │       └── page.tsx    # Customer: payment + receipt upload
│   │       └── dashboard/
│   │           └── page.tsx        # Owner: real-time order dashboard
│   └── api/
│       ├── orders/
│       │   ├── route.ts            # POST: create order
│       │   └── [id]/
│       │       └── route.ts        # GET/PATCH: order detail and status update
│       ├── receipts/
│       │   └── route.ts            # POST: upload receipt image, trigger OCR
│       └── ocr/
│           └── route.ts            # POST: internal OCR job handler
├── components/
│   ├── menu/
│   │   ├── MenuScreen.tsx
│   │   ├── MenuCategory.tsx
│   │   └── CartBar.tsx
│   ├── order/
│   │   ├── OrderSummary.tsx
│   │   └── OrderTypeSelector.tsx
│   ├── payment/
│   │   ├── PaymentScreen.tsx
│   │   ├── DeUnaQR.tsx
│   │   ├── AmountCopy.tsx
│   │   └── ReceiptUpload.tsx
│   ├── dashboard/
│   │   ├── DashboardStats.tsx
│   │   ├── OrderCard.tsx
│   │   └── FraudAlert.tsx
│   └── ui/                         # Shared: Button, Badge, Card, Toast
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser client
│   │   └── server.ts               # Server client (API routes)
│   ├── ocr/
│   │   ├── tesseract.ts            # Tesseract.js OCR runner
│   │   └── parser.ts               # Extract txId, amount from OCR text
│   ├── fraud/
│   │   └── detection.ts            # Hash comparison + txId dedup logic
│   └── types.ts                    # Shared TypeScript interfaces
├── public/
│   ├── manifest.json               # PWA manifest with share_target
│   └── icons/                      # PWA icons (192px, 512px, maskable)
├── supabase/
│   └── migrations/
│       └── 001_initial.sql         # Full schema (see Section 5)
└── .env.local.example
```

---

## 4. Core User Flows

### 4.1 Customer Flow

```
1. Customer visits /r/[restaurantSlug]
2. Browses menu, adds items to cart (local state, no login required)
3. Reviews order → selects "En mesa" (enters table number) or "Para llevar"
4. Clicks "Pagar con DeUna"
   → Server creates an Order record (status: pending_payment)
   → Redirects to /r/[slug]/pay/[orderId]
5. Payment screen shows:
   - Restaurant's DeUna static QR (from restaurant profile)
   - Exact order total (auto-copied to clipboard on page load)
   - Instructions: open DeUna, scan QR, paste amount, pay
6. Customer pays in DeUna app outside the browser
7. Customer returns to payment screen and either:
   a. Taps "Subir comprobante" → selects screenshot from gallery
   b. OR uses Android share sheet from DeUna: Share → MishiPay
      → App opens at pending order, receipt pre-attached
8. Taps "Enviar comprobante"
   → Image uploaded to Supabase Storage
   → Order status → receipt_received
   → Background OCR job queued
9. Customer sees order status timeline (real-time via Supabase subscription)
```

### 4.2 Restaurant Owner Flow

```
1. Owner logs in at /r/[slug]/dashboard
2. Sees real-time stats: verified revenue today, orders to review, fraud alerts
3. New order with receipt arrives (status: receipt_received) → card appears instantly
4. OCR completes → extracted txId and amount shown on order card
5. Owner taps "Verificar y a cocina":
   → Order status → verified
   → Kitchen can now prepare (future: KDS integration)
6. OR owner taps "Rechazar":
   → Order status → rejected
   → Customer sees rejection on their status screen
7. Fraud alert (duplicate receipt):
   → Card highlighted red, shows which previous order it duplicates
   → Owner cannot verify without explicit override
```

### 4.3 Web Share Target Flow (Android PWA)

```
1. Customer installs PWA (Add to Home Screen prompt shown after 2nd visit)
2. In DeUna, after payment, taps Share on confirmation screen
3. Share sheet shows "MishiPay - La Esquina Cuencana" as an option
4. Tapping it opens the PWA with the shared image as a POST to /api/share-target
5. App detects active pending order for this session
6. Shows confirmation: "¿Vincular este comprobante a tu orden #0042 de $13.50?"
7. Customer confirms → receipt submitted
```

---

## 5. Database Schema

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Restaurants (multi-tenant)
create table restaurants (
  id          uuid primary key default uuid_generate_v4(),
  slug        text unique not null,             -- URL identifier, e.g. "la-esquina"
  name        text not null,
  address     text,
  phone       text,
  ruc         text,                             -- Ecuador tax ID, required for SRI invoicing
  deuna_qr_url text,                            -- URL to DeUna static QR image
  deuna_account_name text,                      -- Display name on DeUna
  logo_url    text,
  active      boolean default true,
  created_at  timestamptz default now()
);

-- Menu categories
create table categories (
  id            uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  name          text not null,
  sort_order    integer default 0
);

-- Menu items
create table menu_items (
  id            uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  category_id   uuid references categories(id) on delete set null,
  name          text not null,
  description   text,
  price         numeric(10,2) not null,
  emoji         text,
  image_url     text,
  available     boolean default true,
  sort_order    integer default 0
);

-- Orders
create table orders (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid references restaurants(id) on delete cascade,
  order_number    serial,                       -- Human-readable: #0042
  session_id      text not null,               -- Anonymous customer session (localStorage UUID)
  order_type      text not null check (order_type in ('mesa', 'llevar')),
  table_number    text,                         -- Null if llevar
  status          text not null default 'pending_payment' check (status in (
                    'pending_payment',          -- Order created, awaiting payment
                    'receipt_received',         -- Receipt uploaded, pending OCR/review
                    'ocr_processing',           -- OCR running in background
                    'verified',                 -- Owner confirmed payment, go to kitchen
                    'rejected',                 -- Owner rejected (fraud or wrong amount)
                    'expired'                   -- No receipt uploaded within 15 minutes
                  )),
  subtotal        numeric(10,2) not null,
  total           numeric(10,2) not null,       -- Same as subtotal in v1 (no tax separation)
  notes           text,
  expires_at      timestamptz default (now() + interval '15 minutes'),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Order line items (snapshot of menu items at time of order)
create table order_items (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name        text not null,                    -- Snapshot
  price       numeric(10,2) not null,           -- Snapshot
  quantity    integer not null check (quantity > 0),
  subtotal    numeric(10,2) not null
);

-- Receipts (one per order, replaced on re-upload)
create table receipts (
  id                uuid primary key default uuid_generate_v4(),
  order_id          uuid references orders(id) on delete cascade unique,
  storage_path      text not null,              -- Supabase Storage path
  image_hash        text,                       -- SHA-256 of raw image bytes
  perceptual_hash   text,                       -- pHash for near-duplicate detection
  ocr_raw_text      text,                       -- Full OCR output
  extracted_tx_id   text,                       -- e.g. DEU-2024-91827
  extracted_amount  numeric(10,2),              -- Amount parsed from receipt
  extracted_sender  text,                       -- Payer name from receipt
  ocr_status        text default 'pending' check (ocr_status in ('pending','processing','done','failed')),
  is_duplicate      boolean default false,
  duplicate_of_order_id uuid references orders(id), -- Which order this receipt was already used on
  submitted_via     text check (submitted_via in ('upload', 'share_target')),
  created_at        timestamptz default now()
);

-- Indexes
create index idx_orders_restaurant_id on orders(restaurant_id);
create index idx_orders_session_id on orders(session_id);
create index idx_orders_status on orders(status);
create index idx_receipts_image_hash on receipts(image_hash);
create index idx_receipts_tx_id on receipts(extracted_tx_id);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger orders_updated_at before update on orders
for each row execute function update_updated_at();

-- Row Level Security
alter table restaurants enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table receipts enable row level security;

-- Public can read active restaurants and their menu
create policy "public read restaurants" on restaurants for select using (active = true);
create policy "public read menu_items" on menu_items for select using (available = true);

-- Customers can insert orders (no login)
create policy "public insert orders" on orders for insert with check (true);

-- Customers can read their own order by session_id
create policy "customer read own orders" on orders for select
  using (session_id = current_setting('app.session_id', true));

-- Restaurant owners (authenticated) can read/update all their orders
create policy "owner manage orders" on orders for all
  using (restaurant_id in (
    select id from restaurants where id = auth.uid()
  ));
```

---

## 6. API Routes

### `POST /api/orders`

Creates a new order. Called when customer confirms their cart.

**Request body:**
```typescript
{
  restaurantId: string;
  sessionId: string;           // UUID generated client-side, stored in localStorage
  orderType: 'mesa' | 'llevar';
  tableNumber?: string;
  items: {
    menuItemId: string;
    quantity: number;
  }[];
}
```

**Response:**
```typescript
{
  orderId: string;
  orderNumber: number;
  total: number;
  expiresAt: string;           // ISO timestamp, 15 minutes from now
}
```

**Logic:**
1. Validate all `menuItemId` values belong to the given `restaurantId`
2. Fetch current prices server-side (never trust client prices)
3. Calculate subtotal and total
4. Insert `orders` + `order_items` records
5. Return order ID for redirect to `/r/[slug]/pay/[orderId]`

---

### `POST /api/receipts`

Handles receipt image upload. Called after customer selects/shares an image.

**Request:** `multipart/form-data`
```
orderId: string
image: File (JPEG or PNG, max 10MB)
submittedVia: 'upload' | 'share_target'
```

**Response:**
```typescript
{
  receiptId: string;
  isDuplicate: boolean;
  duplicateOrderId?: string;
}
```

**Logic:**
1. Validate order exists, belongs to a valid restaurant, status is `pending_payment`
2. Validate image MIME type (accept only `image/jpeg`, `image/png`)
3. Compute SHA-256 hash of image bytes
4. **Duplicate check:** query `receipts` table for matching `image_hash` — if found, set `is_duplicate = true`, `duplicate_of_order_id`, update order status to `receipt_received` with fraud flag
5. Upload image to Supabase Storage at path: `receipts/{restaurantId}/{orderId}/{timestamp}.jpg`
6. Insert `receipts` record
7. Update order status to `receipt_received`
8. Queue OCR job (call `/api/ocr` as a background fetch, or use Supabase Edge Function)
9. Return result

---

### `POST /api/ocr` (internal)

Runs Tesseract.js OCR on a receipt image and updates the receipt record.

**Request:**
```typescript
{ receiptId: string }
```

**Logic:**
1. Fetch receipt record from DB
2. Download image from Supabase Storage
3. Run Tesseract.js with `spa` (Spanish) language pack
4. Pass raw OCR text to `lib/ocr/parser.ts`
5. Parser extracts:
   - Transaction ID: regex pattern `DEU-\d{4}-\d+` or similar DeUna format
   - Amount: regex for currency patterns `\$?\d+\.\d{2}` near keywords "total", "monto", "pagado"
   - Sender name: text near "pagado por", "cliente", first capitalized name block
6. **Second duplicate check:** query `receipts.extracted_tx_id` — if transaction ID already exists on a different order, flag as duplicate
7. Update `receipts` record: `ocr_raw_text`, `extracted_tx_id`, `extracted_amount`, `extracted_sender`, `ocr_status = 'done'`
8. If amount extracted and does NOT match `orders.total` (tolerance: ±$0.01), add a warning flag (do not auto-reject, let owner decide)
9. Supabase real-time update will push changes to owner's dashboard automatically

---

### `POST /api/share-target`

Receives images shared from the Android share sheet (Web Share Target API).

**Request:** `multipart/form-data` (as defined in `manifest.json` share_target)
```
title: string
text: string
url: string
files[]: File[]
```

**Logic:**
1. Extract first image from `files[]`
2. Read `session_id` from the `url` query param or cookie
3. Find most recent `pending_payment` order for that `session_id`
4. If found: return redirect to `/r/[slug]/pay/[orderId]?shared=1` with image stored temporarily in Supabase Storage pending confirmation
5. If not found: return redirect to `/r/[slug]?error=no_pending_order`

---

### `PATCH /api/orders/[id]`

Owner updates order status (verify or reject).

**Request:**
```typescript
{ status: 'verified' | 'rejected' }
```

**Auth:** Requires authenticated Supabase session (restaurant owner).

---

## 7. PWA Manifest (`public/manifest.json`)

```json
{
  "name": "MishiPay",
  "short_name": "MishiPay",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1D9E75",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "share_target": {
    "action": "/api/share-target",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url",
      "files": [
        {
          "name": "files",
          "accept": ["image/jpeg", "image/png"]
        }
      ]
    }
  }
}
```

> **Note:** The share_target only works when the PWA is installed (added to home screen) on Android Chrome. On iOS and desktop the upload fallback is used instead.

---

## 8. OCR Parser Logic (`lib/ocr/parser.ts`)

DeUna confirmation screens follow a consistent visual layout. The parser should handle:

### Transaction ID patterns
```typescript
// Primary: DEU-YYYY-NNNNN format
/DEU-\d{4}-\d{4,8}/i

// Fallback: any alphanumeric code near keywords
/(comprobante|referencia|código|transacción|txid)[:\s#]+([A-Z0-9\-]{6,20})/i
```

### Amount patterns
```typescript
// Amount near payment keywords
/(total|monto|pagado|valor|pagaste)[:\s]*\$?\s*(\d{1,4}[.,]\d{2})/i

// Standalone currency amount (last resort)
/\$\s*(\d{1,4}[.,]\d{2})/g  // take the largest match
```

### Sender name
```typescript
// DeUna shows "Pagado por [Name]" or "De: [Name]"
/(pagado por|de:|cliente)[:\s]+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/i
```

### Amount normalization
```typescript
// Handle both "13,50" and "13.50"
const normalize = (s: string) => parseFloat(s.replace(',', '.'));
```

---

## 9. Fraud Detection Logic (`lib/fraud/detection.ts`)

Duplicate detection runs at two points: on upload (image hash) and after OCR (transaction ID).

```typescript
interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: 'image_hash' | 'transaction_id' | 'perceptual_hash';
  duplicateOrderId?: string;
  duplicateOrderNumber?: number;
}

async function checkForDuplicate(
  supabase: SupabaseClient,
  restaurantId: string,
  imageHash: string,
  extractedTxId?: string
): Promise<DuplicateCheckResult>
```

**Check order:**
1. Exact image hash match → `reason: 'image_hash'` (identical screenshot)
2. Transaction ID match (if extracted) → `reason: 'transaction_id'` (cropped/edited screenshot)
3. Future v1.1: perceptual hash similarity > 95% → `reason: 'perceptual_hash'` (screenshotted a screenshot)

**Scope:** Only check within the same `restaurantId`. Cross-restaurant checks are not performed (different restaurants could legitimately receive the same DeUna QR payment if a customer made two separate purchases).

---

## 10. Real-time Dashboard

Use Supabase's real-time subscriptions on the client to listen for order changes.

```typescript
// In DashboardScreen component
const channel = supabase
  .channel('restaurant-orders')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'orders',
    filter: `restaurant_id=eq.${restaurantId}`
  }, (payload) => {
    // Update order in local state
    handleOrderChange(payload);
  })
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'receipts'
  }, (payload) => {
    // OCR results arrived — update order card with txId and amount
    handleReceiptUpdate(payload);
  })
  .subscribe();
```

Customer order status page uses the same pattern filtering by `id=eq.${orderId}`.

---

## 11. Customer Session Management

Customers do not create accounts. Session tracking uses a UUID stored in `localStorage`.

```typescript
// lib/session.ts
const SESSION_KEY = 'mishipay_session_id';

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
```

The `session_id` is sent with every order creation and used to look up pending orders for the share target flow.

**Security note:** Session IDs are not a security mechanism. They exist purely for UX continuity (linking a receipt to the right order). The restaurant owner's manual verification step is the security layer.

---

## 12. Environment Variables

```bash
# .env.local.example

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # Server-only, never expose to client

# App
NEXT_PUBLIC_APP_URL=https://mishipay.app
OCR_INTERNAL_SECRET=some-random-secret   # Shared between API routes for internal OCR calls

# Optional: Claude API for enhanced OCR fallback (v1.1)
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Dátil for SRI invoicing (v1.1)
DATIL_API_KEY=...
DATIL_ENV=sandbox                   # or 'production'
```

---

## 13. Order Expiry

Orders in `pending_payment` status expire after 15 minutes if no receipt is uploaded.

Implement as a Supabase scheduled function (pg_cron or Edge Function cron):

```sql
-- Run every 5 minutes
select cron.schedule(
  'expire-pending-orders',
  '*/5 * * * *',
  $$
    update orders
    set status = 'expired'
    where status = 'pending_payment'
      and expires_at < now();
  $$
);
```

The customer's payment screen should show a countdown timer and redirect to the menu if the order expires before receipt submission.

---

## 14. Multi-tenant Restaurant Onboarding

For v1.0, restaurant creation is done manually via Supabase dashboard or a seeding script.

Each restaurant record requires:
- `slug`: URL-safe name, e.g. `la-esquina-cuencana`
- `name`: Display name
- `ruc`: Ecuador RUC for future invoicing
- `deuna_qr_url`: Upload of their printed DeUna QR image (JPG/PNG)
- `deuna_account_name`: As shown in the DeUna app

Menu items are seeded via a JSON file or the dashboard. A simple `seed.ts` script should be included in `/supabase/seed.ts`.

---

## 15. Payment Methods — v1.0 Scope

| Method | Implementation | Commission |
|---|---|---|
| DeUna QR (static, no-amount) | Display QR image, copy amount to clipboard, manual receipt upload | 0% |
| Cash | "Pago en local" flag on order, no receipt needed, owner marks paid | 0% |

### v1.1 additions (out of scope for initial implementation)
- Payphone card payment (Visa/Mastercard/Diners) — REST API, ~5% + IVA
- PeiGo QR (Banco Guayaquil static QR, same flow as DeUna)
- Pagomedios integration for programmatic DeUna payment link (2% enterprise tier)

---

## 16. SRI Electronic Invoicing (v1.1 — architecture note)

Ecuador mandates real-time electronic invoice submission to SRI as of January 1, 2026. When implementing v1.1, the `orders` table needs additional fields:

```sql
alter table orders add column sri_invoice_number text;
alter table orders add column sri_clave_acceso text;   -- 49-digit access key
alter table orders add column sri_status text default 'pending'
  check (sri_status in ('pending', 'submitted', 'authorized', 'rejected'));
alter table orders add column customer_cedula text;    -- Required for factura
alter table orders add column customer_email text;     -- For RIDE PDF delivery
```

The invoicing flow triggers after `status` changes to `verified`. Integration via Dátil API (`docs.datil.com`) is recommended.

---

## 17. Acceptance Criteria

### Customer Flow
- [ ] Customer can browse menu without logging in
- [ ] Cart state persists across page navigation (local state / localStorage)
- [ ] Order creation validates prices server-side, not client-side
- [ ] Payment screen auto-copies exact order total to clipboard on load
- [ ] Customer can upload a receipt image (JPEG/PNG, max 10MB)
- [ ] After submission, customer sees real-time order status updates
- [ ] Order expires after 15 minutes with no receipt — customer redirected to menu with notification

### Receipt / OCR
- [ ] Uploaded receipt is stored in Supabase Storage with access restricted to restaurant owner
- [ ] SHA-256 hash computed server-side, not client-side
- [ ] OCR runs within 30 seconds of receipt upload
- [ ] Extracted transaction ID, amount, and sender name appear on order card in dashboard
- [ ] Amount mismatch (extracted vs order total > $0.01) shows a warning badge on the order card
- [ ] Duplicate receipt (same hash or same txId) is flagged immediately on upload, before OCR completes

### Dashboard
- [ ] New orders appear in real-time without page refresh
- [ ] OCR results update order cards in real-time
- [ ] Fraud-flagged orders cannot be verified without an explicit owner override action
- [ ] "Verificar y a cocina" and "Rechazar" buttons update status in < 1 second
- [ ] Dashboard is mobile-responsive (owner often uses phone)
- [ ] Dashboard requires authenticated session (Supabase Auth)

### PWA / Share Target
- [ ] App is installable (passes Lighthouse PWA checklist)
- [ ] Manifest includes `share_target` pointing to `/api/share-target`
- [ ] Share target on Android links shared image to most recent pending order for that session
- [ ] If no pending order found, user is redirected to menu with clear error message
- [ ] Upload fallback works on all platforms (iOS, desktop, non-PWA Android)

### Multi-tenant
- [ ] Routes `/r/[slug]` and `/r/[slug]/dashboard` are fully isolated per restaurant
- [ ] One restaurant's orders/receipts are never accessible to another restaurant's owner
- [ ] 404 page shown for unknown slugs

---

## 18. Known Constraints & Edge Cases

| Scenario | Handling |
|---|---|
| Customer pays wrong amount in DeUna | OCR detects mismatch → warning flag on dashboard, owner decides |
| Customer submits old/saved receipt | Image hash or txId matches existing receipt → fraud flag |
| OCR fails to parse the receipt | `ocr_status = 'failed'`, owner reviews image manually, can still verify |
| DeUna QR is scanned by multiple customers simultaneously | Each creates a separate order; amounts differ; restaurant owner matches manually via amounts |
| Customer loses internet before submitting receipt | Order stays in `pending_payment` until expiry; customer must reorder |
| Restaurant owner refreshes dashboard | Real-time subscription re-established, full order list re-fetched |
| Same customer places multiple orders | Each gets its own `orderId`; `session_id` links them for share target disambiguation |

---

## 19. Getting Started (for the implementing agent)

```bash
# 1. Clone and install
git clone https://github.com/your-org/mishipay
cd mishipay
npm install

# 2. Set up Supabase project
# Create project at supabase.com, copy URL and anon key

# 3. Configure environment
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# 4. Run migrations
npx supabase db push

# 5. Seed a test restaurant
npx ts-node supabase/seed.ts

# 6. Run dev server
npm run dev
# Visit http://localhost:3000/r/la-esquina-cuencana
```

---

*Document version: 1.0 — May 2026*
*Project: MishiPay — open-source restaurant ordering for Ecuador*
