# MishiMenu — Architecture

## Overview

MishiMenu is a **single-tenant** self-hosted web application. One installation serves one restaurant. The owner runs their own copy; there are no shared accounts, no SaaS billing, no slug-based routing.

```
┌────────────────────────────────────────────────────────────┐
│  Docker Compose stack (runs on owner's VPS / home server)  │
│                                                            │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │  Next.js app    │    │  Supabase (self-hosted)       │   │
│  │  (port 3000)    │◄──►│  • Kong API gateway :8000    │   │
│  │                 │    │  • GoTrue auth :9999          │   │
│  │  / (menu)       │    │  • PostgREST :3001            │   │
│  │  /pay/[orderId] │    │  • Realtime WS               │   │
│  │  /dashboard     │    │  • Storage (receipts)        │   │
│  │  /dashboard/    │    │  • Postgres :5432            │   │
│  │    login        │    └──────────────────────────────┘   │
│  └─────────────────┘                                       │
│           ▲                                                 │
│  nginx / Caddy reverse proxy (TLS termination)             │
└────────────────────────────────────────────────────────────┘
```

## Repository layout

| Repo | Purpose | Distribution |
|------|---------|--------------|
| `mishimenu` | Web server (Next.js) + Docker Compose stack | Public GitHub |
| `mishimenu-app` | Native companion app for customers (Expo/React Native) | GitHub Releases (APK/IPA) |
| `mishimenu-web` | Marketing / landing page | Public GitHub |

## Single-tenant design

- No `restaurants` table with multiple rows — there is a single `restaurant` table with exactly **one row** seeded by `./mishimenu install`.
- No `restaurant_id` foreign keys on `categories`, `menu_items`, or `orders`. Every row in the database belongs to the installation by definition.
- Routes are flat: `/` (menu), `/pay/[orderId]`, `/dashboard`, `/dashboard/login`.
- `getRestaurant()` in `lib/restaurant.ts` fetches the single row and caches it for the process lifetime.

## Data model

```
restaurant          (1 row, seeded at install time)
├── categories      (menu sections)
│   └── menu_items  (dishes)
└── orders
    ├── order_items
    └── receipts    (not created for cash orders)
```

### Tables

```sql
restaurant      id, name, address, phone, ruc,
                deuna_qr_url, deuna_account_name,
                sipi_qr_url, sipi_account_name,
                transfer_bank, transfer_account_number, transfer_account_name,
                payment_policy ('upfront'|'at_end'),
                accepted_payment_methods (text[]),
                logo_url, created_at

categories      id, name, sort_order

menu_items      id, category_id → categories, name, description,
                price, emoji, image_url, available, sort_order

orders          id, order_number(serial), session_id, order_type,
                table_number, payment_method ('deuna'|'sipi'|'transfer'|'cash'|'card'),
                status, subtotal, total, notes,
                expires_at, created_at, updated_at

order_items     id, order_id → orders, menu_item_id → menu_items,
                name, price, quantity, subtotal

receipts        id, order_id → orders (unique), storage_path,
                image_hash, ocr_raw_text, extracted_tx_id,
                extracted_amount, extracted_sender, ocr_status,
                is_duplicate, duplicate_of_order_id → orders,
                submitted_via, created_at
                (not created for cash orders)
```

## Payment methods

| Method | Receipt | OCR | Fraud check | Dashboard action |
|--------|---------|-----|-------------|-----------------|
| `deuna` | upload / share | yes, DEU- pattern | hash + txId | Verify / Reject |
| `sipi` | upload / share | yes, SIP- pattern | hash + txId | Verify / Reject |
| `transfer` | upload / share | yes, generic ref | hash + txId | Verify / Reject |
| `cash` | — | — | — | "Cobrar en efectivo" → Verified |
| `card` | — | — | — | "Cobrar con tarjeta" → Verified |

## Payment policy

Stored in `restaurant.payment_policy`:

- **`upfront`** (default): kitchen only processes `verified` orders. The dashboard separates orders into a verification queue and a kitchen queue.
- **`at_end`**: all active orders appear in the kitchen queue immediately. Payment verification happens after the fact.

## Auth

Supabase GoTrue handles owner authentication. One owner account, created by `./mishimenu add-owner`.

- **Customer routes** (`/`, `/pay/[orderId]`) — no auth required.
- **Dashboard** (`/dashboard`) — requires Supabase session cookie. Server component checks `auth.getUser()` and redirects to `/dashboard/login` if unauthenticated.
- **API routes that mutate order status** (`PATCH /api/orders/[id]`) — require authenticated session cookie.

## Row Level Security

```
restaurant    public SELECT (service role writes only)
categories    public SELECT
menu_items    public SELECT (available = true)
orders        INSERT without auth (customers create orders)
              SELECT by session_id (customers see their own)
              ALL by authenticated owner
receipts      INSERT without auth (receipt upload)
              ALL by authenticated owner
```

All server-side DB access uses the service role key (bypasses RLS). The anon key is used only for browser-side real-time subscriptions.

## Request flows

### Customer orders (web)

```
Customer browser
  → GET /                         (SSR: renders menu, calls getRestaurant())
  → POST /api/orders              (creates order with payment_method, returns orderId)
  → GET /pay/[orderId]            (SSR: renders payment screen based on payment_method)

  If digital (deuna/sipi/transfer):
    → POST /api/receipts          (multipart: uploads receipt image)
    → [Realtime subscription]     (watches order status changes)

  If cash:
    → No receipt upload
    → [Realtime subscription]     (watches for cashier verification)
```

### Native app orders (mishimenu-app)

```
Customer scans table QR
  → GET /api/config               (returns supabaseUrl, anonKey, restaurant info including
                                   accepted_payment_methods and payment_policy)
  → Supabase: SELECT categories + menu_items
  → POST /api/orders              (includes payment_method)
  → payment screen (native) based on payment_method
  → POST /api/receipts            (digital methods only)
  → [Realtime subscription]
```

### Receipt processing (digital payments)

```
POST /api/receipts
  1. Validate order is pending_payment and payment_method ≠ 'cash'
  2. SHA-256 hash → duplicate check by hash
  3. Upload to Supabase Storage: receipts/{orderId}/{ts}.jpg
  4. Insert receipts row
  5. Update order status → receipt_received
  6. Fire background POST /api/ocr (non-blocking)

POST /api/ocr (internal, Bearer token)
  1. Download image from Storage
  2. Tesseract.js OCR → parse txId / amount / sender
     (uses payment-method-aware patterns: DEU-, SIP-, or generic)
  3. Second duplicate check by txId
  4. Update receipts row with OCR results
  5. Owner reviews manually on dashboard
```

### In-person payment flow (cash / card)

```
Customer places order with payment_method = 'cash' or 'card'
  → Order created with 4-hour expiry
  → Customer goes to cashier with order number + total displayed on screen
  → For cash: cashier receives cash and taps "Cobrar en efectivo"
  → For card: cashier sees amount on dashboard card, charges card terminal,
              then taps "Cobrar con tarjeta"
  → PATCH /api/orders/[id] { status: 'verified' }
     (allowed from pending_payment for cash and card orders)
```

### Web Share Target (Android PWA)

```
Android share → POST /api/share-target (multipart form)
  1. Read session cookie → find pending order
  2. Stage image in Storage: receipts/staging/{orderId}/{ts}.jpg
  3. Store staging path in orders.notes
  4. Redirect → /pay/{orderId}?shared=1

GET /pay/[orderId]?shared=1
  ReceiptUpload component sees ?shared=1
  → GET /api/receipts/staged?orderId=...
  → fetches staged image → shows preview for confirmation
```

## API endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/config` | public | Server config for native app (Supabase URL/key + all restaurant info) |
| POST | `/api/orders` | public | Create order (prices fetched server-side, payment_method validated) |
| PATCH | `/api/orders/[id]` | owner | Verify or reject; cash/card orders: verify from pending_payment |
| POST | `/api/receipts` | public | Upload receipt (digital methods only) |
| GET | `/api/receipts/staged` | public | Retrieve share-target staged image |
| POST | `/api/ocr` | internal Bearer | OCR job; uses payment-method-aware patterns |
| POST | `/api/share-target` | public | Web Share Target handler (Android PWA) |

## Companion app

[mishimenu-app](https://github.com/youruser/mishimenu-app) is a native Expo/React Native app. It:
1. Scans a QR code on the table to discover the server URL.
2. Calls `GET /api/config` to get Supabase credentials and restaurant payment config.
3. Presents the same payment method selection as the web UI.
4. Receives DeUna/Sipi/bank screenshots via the Android/iOS share sheet and posts them to `/api/receipts`.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router (TypeScript) |
| Database | PostgreSQL via Supabase self-hosted |
| Auth | Supabase GoTrue |
| Realtime | Supabase Realtime (WebSocket) |
| Storage | Supabase Storage (S3-compatible) |
| OCR | Tesseract.js (server-side, Node.js runtime) |
| Styling | Tailwind CSS v4 |
| Container | Docker Compose |
| Reverse proxy | Caddy or nginx (operator's choice) |

## Environment variables

```
# Set by ./mishimenu install — written to .env.local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=<generated>
SUPABASE_SERVICE_ROLE_KEY=<generated>
NEXT_PUBLIC_APP_URL=https://mymishimenu.example.com
OCR_INTERNAL_SECRET=<generated>

# Supabase internal (docker-compose.yml)
POSTGRES_PASSWORD=<generated>
JWT_SECRET=<generated>
ANON_KEY=<generated>
SERVICE_ROLE_KEY=<generated>
SITE_URL=https://mymishimenu.example.com

# Restaurant (seed values)
RESTAURANT_NAME=
RESTAURANT_PAYMENT_POLICY=upfront
RESTAURANT_ACCEPTED_PAYMENTS=deuna,cash
RESTAURANT_DEUNA_QR_URL=
RESTAURANT_SIPI_QR_URL=
RESTAURANT_TRANSFER_BANK=
RESTAURANT_TRANSFER_ACCOUNT_NUMBER=
```

## Deployment

```bash
git clone https://github.com/youruser/mishimenu
cd mishimenu
./mishimenu install   # interactive wizard
./mishimenu start     # docker compose up -d
```

The install wizard:
1. Generates JWT secret + Supabase keys (pure Python, no Node.js required).
2. Asks for restaurant name, payment policy, accepted methods, and account details for each enabled method.
3. Writes `.env.local` (Next.js) and `.env` (Supabase Docker).
4. Seeds the `restaurant` table row.
5. Creates the owner auth account via GoTrue API.
6. Runs `docker compose up -d`.
