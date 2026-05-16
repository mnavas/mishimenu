# MishiMenu — Requirements & Specification
## v2.0 — Single-tenant

---

## 1. Project overview

**MishiMenu** is an open-source Progressive Web App (PWA) for Ecuadorian restaurants. A restaurant owner downloads and self-hosts one instance on their own server or VPS. Customers browse the menu, place orders, and choose how to pay. The owner gets a real-time dashboard to verify payments and send orders to the kitchen, with automatic duplicate-receipt fraud detection.

**One installation = one restaurant.** There is no multi-tenant management. Each restaurant runs its own copy.

### Goals

- Supports multiple payment methods: DeUna QR, Sipi, bank transfer, and cash
- Configurable payment policy: pay upfront (before cooking) or pay at the end
- Works as a web app on any device; installable as a PWA on Android for share-target functionality
- Single command to install and run: `./mishimenu install`
- Open-source, self-hosted, no cloud dependency
- Companion native app ([mishimenu-app](https://github.com/youruser/mishimenu-app)) for customers who prefer it over the PWA

### Out of scope for v1.0

- Multi-tenant hosting (one instance for multiple restaurants)
- Integrated card payment processing (Visa/MC)
- Kitchen display system (KDS) hardware integration
- Inventory management
- SRI electronic invoicing (planned for v1.1)

---

## 2. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router) | SSR + PWA + API routes in one repo |
| Language | TypeScript | Type safety for payment/order logic |
| Database | Supabase self-hosted (PostgreSQL) | Real-time subscriptions, built-in storage, self-hostable |
| Auth | Supabase Auth | Restaurant owner login; customers are session-only |
| File storage | Supabase Storage | Receipt image uploads |
| OCR | Tesseract.js (server-side) | Free, no external API needed |
| Styling | Tailwind CSS | Utility-first, PWA-friendly |
| Hosting | Docker Compose | Single `./mishimenu install` deploys everything |

---

## 3. Repository structure

```
mishimenu/
├── app/
│   ├── layout.tsx                   # Root layout, PWA meta tags
│   ├── page.tsx                     # Customer: menu + ordering flow
│   ├── pay/
│   │   └── [orderId]/page.tsx       # Customer: payment + receipt upload
│   ├── dashboard/
│   │   ├── page.tsx                 # Owner: real-time order dashboard (auth required)
│   │   └── login/page.tsx           # Owner: login
│   └── api/
│       ├── config/route.ts          # GET:  server config for mobile app clients
│       ├── orders/route.ts          # POST: create order
│       ├── orders/[id]/route.ts     # PATCH: verify / reject
│       ├── receipts/route.ts        # POST: upload receipt
│       ├── receipts/staged/route.ts # GET:  retrieve share-target staged image
│       ├── ocr/route.ts             # POST: internal OCR job
│       └── share-target/route.ts   # POST: Web Share Target handler
├── components/
│   ├── menu/         MenuScreen, MenuCategory, CartBar
│   ├── order/        OrderSummary, OrderTypeSelector
│   ├── payment/      PaymentScreen, CashPayment, DeUnaQR, SipiPayment,
│   │                 TransferPayment, AmountCopy, ReceiptUpload, OrderStatusTimeline
│   ├── dashboard/    DashboardScreen, DashboardStats, OrderCard, FraudAlert
│   └── ui/           Button, Badge, Card, Toast
├── lib/
│   ├── supabase/     client.ts, server.ts
│   ├── ocr/          tesseract.ts, parser.ts
│   ├── fraud/        detection.ts
│   ├── restaurant.ts # getRestaurant() — fetches + caches single row
│   ├── session.ts
│   └── types.ts
├── public/manifest.json
├── supabase/migrations/001_initial.sql
├── mishimenu.py      # Management CLI
├── mishimenu         # Linux/Mac entry point
├── mishimenu.bat     # Windows entry point
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## 4. Core user flows

### 4.1 Customer flow (web / PWA)

```
1. Customer visits the root URL (e.g. http://192.168.1.10:3000)
2. Browses menu, adds items to cart (local state, no login)
3. Reviews order → selects "En mesa" (with table number) or "Para llevar"
4. Selects payment method from the options the restaurant accepts:
   - DeUna QR
   - Sipi
   - Transferencia bancaria
   - Efectivo (cash)
   - Tarjeta de crédito/débito
5. Taps "Confirmar pedido"
   → Server creates Order (status: pending_payment)
   → Redirects to /pay/[orderId]

6a. DeUna / Sipi:
   - Payment screen shows QR code + total (auto-copied to clipboard)
   - Customer opens DeUna/Sipi, scans QR, pastes amount, pays
   - Customer uploads or shares the payment receipt (screenshot)
   - Customer can also attend the cashier/waitress to confirm

6b. Transferencia:
   - Payment screen shows bank account details + total
   - Customer makes the transfer in their banking app
   - Customer uploads or shares the transfer receipt

6c. Efectivo / Tarjeta:
   - Payment screen shows order number + total + "Acércate a la caja"
   - Customer goes to cashier: pays cash or presents card for the terminal
   - Staff confirms payment in the dashboard ("Cobrar en efectivo" / "Cobrar con tarjeta")

7. Customer sees real-time status timeline until order is verified
```

**Payment collection**: In all cases, the customer interacts with the cashier or waitress to confirm or receive payment. The receipt upload is a verification aid, not a replacement for the staff touchpoint.

### 4.2 Customer flow (native app)

```
1. Customer opens mishimenu-app, scans table QR code
   → App calls GET /api/config to discover Supabase credentials
2. App loads menu, cart, and ordering flow natively
   → Includes payment method selection matching restaurant config
3. On order confirm: app shows payment screen appropriate to method
4. For digital payments: app shows share sheet to receive DeUna/Sipi/bank screenshot
   → App shows pending orders, customer confirms which order the receipt belongs to
5. App posts receipt to POST /api/receipts
6. Real-time order status via Supabase subscription
```

### 4.3 Owner / staff flow

```
1. Owner logs in at /dashboard
2. Sees active orders grouped by state and policy
3. Policy banner shows: "Pago anticipado" or "Pago al final"

For "Pago anticipado" (upfront):
  - Kitchen section shows only verified orders
  - Verification queue shows pending-payment and receipt orders

For "Pago al final" (at end):
  - Kitchen section shows ALL active orders immediately
  - Payment collection section flags orders still awaiting payment/receipt

4. For digital payments (DeUna / Sipi / Transferencia):
   - Receipt upload → OCR results appear on the card (txId, amount, match indicator)
   - Owner taps "Verificar y a cocina" → order → verified
   - OR "Rechazar" → order → rejected
   - Duplicate receipts are flagged and blocked until override

5. For cash orders:
   - Order card shows "Cobrar en efectivo" button + amount
   - Cashier taps after receiving cash → order → verified

6. For card orders:
   - Order card shows "Cobrar con tarjeta" button + amount prominently
   - Staff enters the amount in the card terminal, processes the payment
   - Staff taps "Cobrar con tarjeta" to confirm → order → verified
```

---

## 5. Payment methods

### DeUna QR
- Banco Pichincha free digital wallet; zero commissions
- Customer scans the restaurant's QR code in DeUna, enters amount, pays
- Customer uploads or shares the DeUna confirmation screenshot
- OCR extracts `DEU-XXXX-XXXXXXXX` transaction ID

### Sipi
- Digital wallet; similar QR payment flow
- Restaurant configures Sipi QR URL and account name
- OCR extracts Sipi transaction ID (`SIP-` prefix pattern)

### Transferencia bancaria (Bank transfer)
- Customer receives bank account details (bank, account number, account name) on screen
- Customer makes a regular bank transfer in their app
- Customer uploads or shares the transfer confirmation
- OCR extracts reference/transaction code; amount checked but no strict TX ID format

### Efectivo (Cash)
- No receipt upload required
- Customer is directed to the cashier with their order number and total
- Cashier confirms receipt of cash in the dashboard by pressing "Cobrar en efectivo"
- No OCR or fraud detection applies

### Tarjeta de crédito/débito (Card)
- No receipt upload required
- Customer is directed to the cashier with their order number and total
- The dashboard card shows the exact amount the staff needs to charge on the physical card terminal
- Staff processes the card on their terminal, then confirms in the dashboard by pressing "Cobrar con tarjeta"
- No OCR or fraud detection applies

---

## 6. Payment policy

Configured per-installation in the `restaurant` table (`payment_policy` column):

| Policy | Kitchen starts when… | Description |
|--------|----------------------|-------------|
| `upfront` (default) | Payment verified | Food is prepared only after payment is confirmed |
| `at_end` | Order is placed | Food is prepared immediately; payment collected when done |

The policy affects only the dashboard display — the status workflow is the same. In `at_end` mode, the dashboard kitchen section shows all active orders regardless of payment state.

---

## 7. Database schema

The `restaurant` table always contains exactly **one row**, seeded by `./mishimenu install`. There is no `restaurant_id` foreign key on other tables.

```sql
create extension if not exists "uuid-ossp";

create table restaurant (
  id                       uuid primary key default uuid_generate_v4(),
  name                     text not null,
  address                  text,
  phone                    text,
  ruc                      text,
  -- DeUna
  deuna_qr_url             text,
  deuna_account_name       text,
  -- Sipi
  sipi_qr_url              text,
  sipi_account_name        text,
  -- Bank transfer
  transfer_bank            text,
  transfer_account_number  text,
  transfer_account_name    text,
  -- Payment settings
  payment_policy           text not null default 'upfront'
                             check (payment_policy in ('upfront', 'at_end')),
  accepted_payment_methods text[] not null default array['deuna', 'cash'],
  logo_url                 text,
  created_at               timestamptz default now()
);

create table categories (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  sort_order integer default 0
);

create table menu_items (
  id          uuid primary key default uuid_generate_v4(),
  category_id uuid references categories(id) on delete set null,
  name        text not null,
  description text,
  price       numeric(10,2) not null,
  emoji       text,
  available   boolean default true,
  sort_order  integer default 0
);

create table orders (
  id             uuid primary key default uuid_generate_v4(),
  order_number   serial,
  session_id     text not null,
  order_type     text not null check (order_type in ('mesa', 'llevar')),
  table_number   text,
  payment_method text check (payment_method in ('deuna', 'sipi', 'transfer', 'cash', 'card')),
  status         text not null default 'pending_payment' check (status in (
                   'pending_payment','receipt_received','ocr_processing',
                   'verified','rejected','expired'
                 )),
  subtotal       numeric(10,2) not null,
  total          numeric(10,2) not null,
  notes          text,
  expires_at     timestamptz default (now() + interval '15 minutes'),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table order_items (
  id           uuid primary key default uuid_generate_v4(),
  order_id     uuid references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name         text not null,
  price        numeric(10,2) not null,
  quantity     integer not null check (quantity > 0),
  subtotal     numeric(10,2) not null
);

create table receipts (
  id                    uuid primary key default uuid_generate_v4(),
  order_id              uuid references orders(id) on delete cascade unique,
  storage_path          text not null,
  image_hash            text,
  ocr_raw_text          text,
  extracted_tx_id       text,
  extracted_amount      numeric(10,2),
  extracted_sender      text,
  ocr_status            text default 'pending' check (ocr_status in ('pending','processing','done','failed')),
  is_duplicate          boolean default false,
  duplicate_of_order_id uuid references orders(id),
  submitted_via         text check (submitted_via in ('upload','share_target')),
  created_at            timestamptz default now()
);
```

---

## 8. API reference

### `GET /api/config` — public

Returns server configuration for native app clients.

**Response:**
```json
{
  "supabaseUrl": "http://192.168.1.10:8000",
  "supabaseAnonKey": "eyJ...",
  "restaurantName": "La Esquina Cuencana",
  "restaurantAddress": "Calle Larga 123",
  "deuna_qr_url": "https://...",
  "deuna_account_name": "La Esquina Cuencana",
  "sipi_qr_url": "https://...",
  "sipi_account_name": "La Esquina Cuencana",
  "transfer_bank": "Banco Pichincha",
  "transfer_account_number": "2200123456",
  "transfer_account_name": "La Esquina Cuencana",
  "payment_policy": "upfront",
  "accepted_payment_methods": ["deuna", "sipi", "cash"]
}
```

### `POST /api/orders`

Server fetches prices server-side — client sends only item IDs and quantities.

**Request:** `{ sessionId, orderType, tableNumber?, paymentMethod, items: [{menuItemId, quantity}] }`
**Response:** `{ orderId, orderNumber, total, expiresAt }`

Notes:
- `paymentMethod` must be one of the restaurant's `accepted_payment_methods`
- Cash and card orders receive a 4-hour `expiresAt` instead of the default 15 minutes

### `POST /api/receipts`

Not called for cash orders. For DeUna, Sipi, and transfer payments.

**Request:** `multipart/form-data` — `orderId`, `image` (JPEG/PNG ≤ 10 MB), `submittedVia`
**Response:** `{ receiptId, isDuplicate, duplicateOrderId? }`

### `GET /api/receipts/staged?orderId=...`

Returns the staged image uploaded by the share-target handler.

### `POST /api/ocr` — internal, `Authorization: Bearer <OCR_INTERNAL_SECRET>`

Triggered non-blocking after receipt upload for DeUna, Sipi, and transfer orders. Skipped for cash. Uses payment-method-aware parsing patterns.

### `POST /api/share-target` — Web Share Target

Receives shared image from Android PWA share sheet. Redirects to `/pay/{orderId}?shared=1`.

### `PATCH /api/orders/[id]` — owner auth required

**Request:** `{ status: 'verified' | 'rejected', overrideReason? }`

Notes:
- For cash/card orders: allows transition from `pending_payment` → `verified` (staff collected payment in person)
- For digital orders: requires `receipt_received` or `ocr_processing` status before verifying
- `overrideReason` required when verifying a receipt flagged as duplicate

---

## 9. PWA manifest

```json
{
  "name": "MishiMenu",
  "short_name": "MishiMenu",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#1D9E75",
  "share_target": {
    "action": "/api/share-target",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "files": [{ "name": "files", "accept": ["image/jpeg","image/png"] }]
    }
  }
}
```

---

## 10. OCR pipeline (`lib/ocr/`)

**tesseract.ts** — singleton Tesseract.js worker (Spanish), lazy-initialized, reused across requests.

**parser.ts** — extracts from raw OCR text, with patterns per payment method:

```
DeUna TX ID:      /DEU-\d{4}-\d{4,8}/i
Sipi TX ID:       /SIP-\d{4,12}/i  (+ generic reference fallback)
Transfer TX ID:   generic reference/comprobante pattern
Amount (all):     /(total|monto|pagado|valor|pagaste)[:\s]*\$?\s*(\d{1,4}[.,]\d{2})/i
Sender (all):     /(pagado por|de:|cliente)[:\s]+([A-ZÁÉÍÓÚÑ]...)/i
```

Amount match check: `|parsed.amount - order.total| ≤ $0.01`

OCR is skipped entirely for cash orders (no receipt).

---

## 11. Fraud detection (`lib/fraud/detection.ts`)

Applies to DeUna, Sipi, and transfer orders only. Not applicable to cash.

1. **SHA-256 image hash** — computed server-side at upload time, checked against all existing receipt hashes.
2. **Transaction ID** — checked after OCR completes. Catches the case where the same payment is photographed differently.

Duplicate orders are flagged `is_duplicate = true`. The dashboard blocks the "Verify" button until the owner provides an explicit override reason.

---

## 12. Environment variables

All variables are generated and written by `./mishimenu install`.

```bash
# Supabase internal (docker-compose.yml)
POSTGRES_PASSWORD=
JWT_SECRET=
ANON_KEY=
SERVICE_ROLE_KEY=

# Next.js (.env.local)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
OCR_INTERNAL_SECRET=

# Restaurant info (written by install wizard, read by seed command)
RESTAURANT_NAME=
RESTAURANT_ADDRESS=
RESTAURANT_PHONE=
RESTAURANT_RUC=
RESTAURANT_PAYMENT_POLICY=upfront
RESTAURANT_ACCEPTED_PAYMENTS=deuna,cash
# DeUna
RESTAURANT_DEUNA_QR_URL=
RESTAURANT_DEUNA_ACCOUNT_NAME=
# Sipi (optional)
RESTAURANT_SIPI_QR_URL=
RESTAURANT_SIPI_ACCOUNT_NAME=
# Bank transfer (optional)
RESTAURANT_TRANSFER_BANK=
RESTAURANT_TRANSFER_ACCOUNT_NUMBER=
RESTAURANT_TRANSFER_ACCOUNT_NAME=
# Owner
OWNER_EMAIL=
```

---

## 13. Restaurant setup

Handled entirely by `./mishimenu install`:
1. Checks Docker is installed and running
2. Asks: restaurant name, address, phone, RUC, payment policy, accepted payment methods, payment account details (DeUna, Sipi, transfer — only for selected methods), app URL, owner email/password
3. Generates all secrets (pure Python — no Node.js needed on host)
4. Writes `.env` (Docker Compose) and appends restaurant info
5. Runs `docker compose up -d --build`
6. Waits for Supabase to be ready (polls GoTrue health endpoint)
7. Seeds the `restaurant` row via `psql` in the Docker container
8. Creates the owner auth account via GoTrue API

**Menu management** after install:
- Supabase Studio (port 3001) — table editor, no code needed
- OR run `./mishimenu seed` after editing `.env` values

---

*Version: 2.0 — May 2026*
