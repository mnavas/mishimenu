# MishiPay — Architecture Document
## System Design & Component Reference v1.0

---

## 1. System Overview

MishiPay is a multi-tenant web application built around a single core problem: Ecuadorian restaurants that use DeUna QR for payments have no way to verify receipts programmatically, because DeUna's free tier has no webhook or API. The architecture is designed to fill that gap — creating a receipt submission and verification loop entirely within a web app, without requiring any payment gateway contract.

The system has two distinct user surfaces: a **customer-facing ordering interface** and a **restaurant owner dashboard**. Both are served from the same Next.js application. Real-time communication between the two surfaces (receipt arrives → dashboard updates instantly) is handled by Supabase's PostgreSQL change subscriptions, avoiding the need for a separate WebSocket server.

### Design principles

- **Server-side price validation always.** Menu prices are never trusted from the client. Every order is re-priced on the server using current database values before being persisted.
- **No customer accounts.** Customers interact via anonymous sessions (a UUID in localStorage). This reduces friction to zero — no sign-up, no password reset flows.
- **Fraud detection is layered.** A receipt is checked at upload time (image hash), again after OCR (transaction ID), and visually by the restaurant owner before any order goes to the kitchen. No single automated check is treated as final.
- **OCR is advisory, not gatekeeping.** If OCR fails, the owner can still verify manually. The system degrades gracefully.
- **Real-time over polling.** The dashboard and customer status page use Supabase real-time subscriptions. There are no polling intervals anywhere in the codebase.

---

## 2. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│                                                                     │
│  ┌──────────────────────┐        ┌──────────────────────────────┐  │
│  │   Customer Browser   │        │   Owner Browser / PWA        │  │
│  │                      │        │                              │  │
│  │  Menu → Order → Pay  │        │  Dashboard (real-time)       │  │
│  │  Receipt Upload      │        │  Verify / Reject orders      │  │
│  │  Status timeline     │        │  Fraud alerts                │  │
│  └──────────┬───────────┘        └──────────────┬───────────────┘  │
│             │ HTTPS                              │ HTTPS + WS       │
└─────────────┼──────────────────────────────────-┼───────────────────┘
              │                                    │
┌─────────────▼────────────────────────────────────▼───────────────────┐
│                        NEXT.JS APPLICATION                           │
│                    (Vercel — Edge + Node.js runtime)                 │
│                                                                      │
│  ┌────────────────────┐   ┌─────────────────────────────────────┐   │
│  │    App Router      │   │           API Routes                │   │
│  │                    │   │                                     │   │
│  │  /r/[slug]         │   │  POST /api/orders                   │   │
│  │  /r/[slug]/pay/… │   │  POST /api/receipts                 │   │
│  │  /r/[slug]/        │   │  POST /api/ocr  (internal)          │   │
│  │    dashboard       │   │  POST /api/share-target             │   │
│  │                    │   │  PATCH /api/orders/[id]             │   │
│  └────────────────────┘   └──────────────┬──────────────────────┘   │
│                                          │                           │
└──────────────────────────────────────────┼───────────────────────────┘
                                           │
┌──────────────────────────────────────────▼───────────────────────────┐
│                         SUPABASE PLATFORM                            │
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────────────┐ │
│  │  PostgreSQL   │  │   Storage     │  │  Auth                    │ │
│  │               │  │               │  │                          │ │
│  │  restaurants  │  │  receipts/    │  │  Restaurant owners       │ │
│  │  menu_items   │  │  {restaurantId│  │  (email + password)      │ │
│  │  orders       │  │  }/{orderId}/ │  │                          │ │
│  │  order_items  │  │  {timestamp}  │  │  Customers: anonymous    │ │
│  │  receipts     │  │  .jpg         │  │  (session UUID only)     │ │
│  │               │  │               │  │                          │ │
│  │  Real-time    │  │  Access:      │  └──────────────────────────┘ │
│  │  subscriptions│  │  owners only  │                               │
│  └───────────────┘  └───────────────┘                               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Descriptions

### 3.1 Frontend Components

#### `MenuScreen`
The entry point for customers. Renders the restaurant's menu grouped by category. Manages cart state locally using React `useState` — no server calls until the customer proceeds to checkout. Displays a sticky `CartBar` at the bottom once at least one item is in the cart.

**State:** `cart: CartItem[]` (local only, never persisted to server until order creation)
**Reads from:** `/r/[slug]` page, which server-side fetches the restaurant and menu via Supabase on load
**Navigates to:** `OrderSummary` when cart bar is tapped

#### `OrderSummary`
Shows the customer a review of their cart before payment. Lets them choose between "En mesa" (dine-in, with a table number input) or "Para llevar" (takeout). On confirmation, POSTs to `/api/orders` and redirects to the payment screen. This is the only moment prices are sent to the server — the server recalculates and validates them.

**Calls:** `POST /api/orders`
**Navigates to:** `/r/[slug]/pay/[orderId]` on success

#### `PaymentScreen`
The central component of the customer flow. Shown after an order is created. Displays:
- The restaurant's DeUna QR image
- The exact order total with a one-tap clipboard copy button
- A `ReceiptUpload` component for submitting the payment screenshot

On page load, it calls `navigator.clipboard.writeText(total)` automatically so the correct amount is already in the customer's clipboard when they open DeUna.

Subscribes to real-time changes on the current order record so the status timeline updates without refresh.

**Reads:** Order record by `orderId` from URL
**Calls:** `POST /api/receipts` (via `ReceiptUpload`)
**Real-time:** Supabase subscription on `orders` table, filtered by `id`

#### `ReceiptUpload`
Handles both upload paths: file picker (`<input type="file" accept="image/*">`) and Web Share Target (detects `?shared=1` query param, retrieves pre-staged image). Shows a drag-and-drop zone that transforms to a confirmation state once a file is selected. Validates MIME type and size (10MB max) client-side before upload.

**Calls:** `POST /api/receipts`
**Share target path:** Reads staged receipt from Supabase Storage when `?shared=1` is present

#### `OrderStatusTimeline`
Rendered inside `PaymentScreen` after receipt submission. Displays a vertical timeline of order states: received → comprobante enviado → verificando → en preparación → listo. Subscribes to the order's real-time status to animate each step as it is reached. If the order is rejected, shows a red step with a message.

#### `DashboardScreen`
The restaurant owner's main view. Fetches all active orders for the restaurant on mount, then stays live via Supabase real-time subscriptions. Renders `DashboardStats` at the top and a list of `OrderCard` components below. New orders slide in at the top of the list.

**Auth:** Requires active Supabase session. Redirects to login if unauthenticated.
**Real-time:** Subscribes to `orders` and `receipts` tables filtered by `restaurant_id`

#### `DashboardStats`
Three metric cards showing: total verified revenue today, number of orders pending owner review, and number of fraud alerts. Values are derived from the in-memory order list (no separate DB queries) and update live as orders change state.

#### `OrderCard`
Represents a single order in the dashboard. Visual state is driven by `order.status`:

| Status | Left border | Action buttons |
|---|---|---|
| `pending_payment` | Gray | None — waiting for customer |
| `receipt_received` | Amber | Verify + Reject |
| `ocr_processing` | Amber (pulsing) | Verify + Reject (with spinner on txId area) |
| `verified` | Green | Print comanda |
| `rejected` | Red | — |
| `fraud` | Red (bold) | Override verify (requires confirmation dialog) |

When OCR results arrive (via real-time subscription on `receipts`), the card updates inline to show the extracted transaction ID, parsed amount, and whether the amount matches the order total.

#### `FraudAlert`
A dismissible banner shown at the top of the dashboard when any order has `is_duplicate = true`. Shows the order number, the reason (image hash or transaction ID match), and which previous order the receipt was already used on. Tapping the alert scrolls to the offending order card.

---

### 3.2 API Route Descriptions

#### `POST /api/orders`
**Purpose:** Creates a validated, server-priced order record.

Receives the customer's cart (item IDs and quantities), fetches current prices from the database, calculates the real total, and persists the order. The client-submitted prices are ignored entirely — only item IDs and quantities are used. Returns the new order ID and expiry timestamp.

This is the trust boundary between the anonymous customer and the system. Nothing downstream trusts client-provided financial data.

#### `POST /api/receipts`
**Purpose:** Ingests a receipt image, runs duplicate detection, and queues OCR.

This is the most critical route in the system. It receives the image, computes its SHA-256 hash server-side, checks for hash collisions in the `receipts` table, uploads to Supabase Storage, updates the order status, and fires off the OCR job. The duplicate check at this stage catches exact screenshot reuse (same bytes, same hash) before OCR even runs.

The OCR job is dispatched as a background fetch to `/api/ocr` using `waitUntil` on Vercel Edge Runtime, so it does not block the response to the customer.

#### `POST /api/ocr` (internal)
**Purpose:** Extracts structured payment data from receipt image using Tesseract.js.

Called internally after receipt upload. Downloads the receipt image from Supabase Storage, runs Tesseract with the Spanish language pack, and passes the raw text through `lib/ocr/parser.ts` to extract the transaction ID, amount, and sender name. Runs a second duplicate check against `extracted_tx_id` — this catches cases where a customer re-crops or re-screenshots a confirmation to change the image hash. Updates the `receipts` record, triggering a real-time push to the owner's dashboard.

Protected by an internal shared secret (`OCR_INTERNAL_SECRET` env var) so it cannot be called externally.

#### `POST /api/share-target`
**Purpose:** Receives images from the Android share sheet and links them to pending orders.

When a customer shares their DeUna confirmation from the DeUna app, Android delivers the image as a multipart POST to this route. The route reads the customer's `session_id` from the request (passed as a URL parameter in the manifest's `share_target.action`), finds their most recent `pending_payment` order, stages the image in Supabase Storage, and redirects to the payment screen with `?shared=1`. The `ReceiptUpload` component detects this flag and presents the pre-staged image for the customer to confirm before final submission.

#### `PATCH /api/orders/[id]`
**Purpose:** Allows the authenticated restaurant owner to change an order's status.

Only accepts transitions to `verified` or `rejected`. Validates that the authenticated user owns the restaurant the order belongs to. If transitioning a fraud-flagged order to `verified`, requires an additional `overrideReason` field to create an audit log entry.

---

### 3.3 Library Modules

#### `lib/ocr/tesseract.ts`
Wraps Tesseract.js for server-side use in Next.js API routes. Handles worker initialization, language pack loading (Spanish `spa`), and cleanup. Returns raw OCR text. Tesseract is initialized lazily (on first call) and the worker is reused across requests via module-level singleton to avoid the overhead of reinitializing for every receipt.

#### `lib/ocr/parser.ts`
Pure function module — takes a raw OCR string and returns a structured `ParsedReceipt` object. Uses regex patterns tuned to DeUna's confirmation screen layout. All patterns are exported as named constants so they can be tested independently. Falls back gracefully: if the transaction ID cannot be found, it returns `null` for that field rather than throwing.

#### `lib/fraud/detection.ts`
Encapsulates all duplicate-checking logic. Exposes two functions:
- `checkByImageHash(hash, restaurantId)` — queries `receipts.image_hash`
- `checkByTransactionId(txId, restaurantId)` — queries `receipts.extracted_tx_id`

Both return a `DuplicateCheckResult` indicating whether a duplicate was found and on which order. Scoped to `restaurantId` to prevent false positives across different restaurants.

#### `lib/session.ts`
Manages the anonymous customer session UUID. Creates a new UUID on first visit and stores it in `localStorage`. Exposes `getOrCreateSessionId()` for use in components and `getSessionIdFromRequest(req)` for server-side use in the share target route (reads from cookie fallback).

#### `lib/supabase/client.ts` and `server.ts`
Standard Supabase client initializers. The browser client (`client.ts`) uses the public anon key and is safe to import in components. The server client (`server.ts`) uses the service role key, is only imported in API routes, and is never included in client bundles.

---

## 4. Data Flow: Customer Places and Pays for an Order

This walkthrough traces a single successful order from menu to kitchen.

```
Step 1 — Page load
  Customer visits /r/la-esquina-cuencana
  Next.js server fetches restaurant + menu from Supabase
  Page rendered with full menu (no client-side fetch on load)

Step 2 — Cart
  Customer adds items → local React state only
  No network calls until checkout

Step 3 — Order creation
  Customer taps "Pagar con DeUna"
  OrderSummary POSTs { restaurantId, sessionId, orderType, items } to /api/orders
  Server fetches current prices for each menuItemId
  Server calculates total = Σ(price × quantity)
  Server inserts orders + order_items records (status: pending_payment)
  Server returns { orderId, total, expiresAt }
  Browser redirects to /r/la-esquina-cuencana/pay/{orderId}

Step 4 — Payment screen
  Page fetches order by orderId
  navigator.clipboard.writeText(total) fires on mount
  Customer opens DeUna app, scans restaurant QR, pastes amount, pays
  DeUna shows confirmation screen

Step 5 — Receipt submission
  Customer screenshots DeUna confirmation
  Taps "Subir comprobante" → selects image
    OR
  Taps Share in DeUna → selects MishiPay from share sheet
    → /api/share-target stages image, redirects with ?shared=1

  Browser POSTs image to /api/receipts
  Server:
    a. Validates order (exists, pending_payment, not expired)
    b. Computes SHA-256 hash of image bytes
    c. Queries receipts.image_hash — no match found
    d. Uploads to Supabase Storage
    e. Inserts receipts record (ocr_status: pending)
    f. Updates order status → receipt_received
    g. Fires background call to /api/ocr

  Supabase real-time pushes order update to owner dashboard
  Customer's status timeline advances to "Comprobante enviado"

Step 6 — OCR (background, ~5–15 seconds)
  /api/ocr downloads image from Supabase Storage
  Tesseract.js runs OCR (Spanish language pack)
  parser.ts extracts:
    txId = "DEU-2024-91827"
    amount = 13.50
    sender = "Carlos Andrade"
  detection.ts checks extracted_tx_id — no match
  receipts record updated: extracted_tx_id, extracted_amount, ocr_status: done
  order status → receipt_received (no change, but receipts update triggers dashboard push)
  Owner's order card updates in real-time with txId and amount match indicator

Step 7 — Owner verification
  Owner sees order card: amber left border, "Por verificar" badge
  Sees: txId "DEU-2024-91827", amount $13.50 ✓ (matches order total)
  Taps "Verificar y a cocina"
  PATCH /api/orders/{orderId} { status: "verified" }
  Order status → verified
  Order card turns green
  Customer's status timeline advances to "En preparación"

Step 8 — Kitchen
  (v1.0) Owner tells kitchen verbally or prints comanda
  (v1.1) KDS integration fires here
```

---

## 5. Data Flow: Duplicate Receipt Detected

This traces what happens when a customer tries to reuse a receipt.

```
Customer pays $8.30 for order #0041 and submits receipt
  → receipt stored, hash = abc123, txId = DEU-2024-91798
  → order #0041 verified successfully

Same customer (or different customer who saw the screenshot)
  submits the same image for order #0044 (a new $8.30 order)

POST /api/receipts for order #0044:
  Server computes hash of image → abc123
  Queries receipts.image_hash = 'abc123', restaurant_id = current
  → MATCH FOUND on order #0041

  Sets receipts.is_duplicate = true
  Sets receipts.duplicate_of_order_id = order#0041's id
  Sets order #0044 status → receipt_received (not rejected — owner decides)
  Uploads image anyway (for audit trail)

Supabase real-time fires to dashboard

Owner dashboard:
  Order #0044 card appears with RED left border
  Badge: "Duplicado"
  Warning: "Comprobante ya usado en orden #0041"
  Verify button is disabled
  Only available action: "Rechazar" or "Override (verificar de todas formas)"

  If owner taps Rechazar:
    Order #0044 → rejected
    Customer sees "Pago rechazado — contacta al restaurante"

  If owner taps Override (requires confirming a dialog):
    Requires typing a reason
    Creates audit log entry
    Order #0044 → verified
    (This path exists for legitimate edge cases, e.g. OCR false positive)
```

---

## 6. Data Flow: Web Share Target (Android PWA)

This describes the share flow — the path that requires the PWA to be installed.

```
Precondition: Customer has installed MishiPay PWA on their Android phone
  (Triggered by "Add to Home Screen" prompt after 2nd visit)

Customer places order #0045 on the web
  session_id stored in localStorage: "550e8400-e29b-41d4..."

Customer opens DeUna app, pays
  DeUna shows payment confirmation screen
  Customer taps the Share icon in DeUna

Android share sheet appears
  Shows "MishiPay — La Esquina Cuencana" as an option
  Customer taps it

Android delivers POST to:
  /api/share-target?session=550e8400-e29b-41d4...
  multipart body: { files: [image.jpg] }

Server:
  Reads session_id from query param
  Queries orders WHERE session_id = '550e8400...'
    AND status = 'pending_payment'
    AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1
  Finds order #0045

  Stages image in Supabase Storage at:
    receipts/staging/{orderId}/{timestamp}.jpg
  (Staged = temporary, not yet linked to the order)

  Returns HTTP 303 redirect to:
    /r/la-esquina-cuencana/pay/[orderId]?shared=1

PWA opens at payment screen
  ReceiptUpload detects ?shared=1
  Fetches staged image from storage
  Shows preview: "¿Enviar este comprobante para tu orden de $22.50?"
  Customer taps "Sí, enviar"

  Now calls POST /api/receipts with the staged image path
  Normal receipt processing continues from here
```

---

## 7. Real-time Architecture

MishiPay uses Supabase's PostgreSQL real-time extension (backed by logical replication) rather than a custom WebSocket server. This eliminates an entire infrastructure component.

### Subscriptions in use

| Component | Table | Filter | Events | Purpose |
|---|---|---|---|---|
| `PaymentScreen` | `orders` | `id = eq.{orderId}` | UPDATE | Customer sees status changes live |
| `DashboardScreen` | `orders` | `restaurant_id = eq.{restaurantId}` | INSERT, UPDATE | New orders appear, status changes update cards |
| `DashboardScreen` | `receipts` | (joined via in-memory order list) | UPDATE | OCR results arrive, fraud flags appear |

### Why this works without polling

When the server updates an order's status (e.g., `receipt_received` after upload), Supabase's real-time engine detects the PostgreSQL WAL event and pushes it to all subscribed clients over WebSocket. The owner's dashboard and the customer's status screen both receive the update within ~200ms on a typical connection.

### Fallback for non-WebSocket environments

If the real-time subscription fails to connect (e.g., WebSocket blocked by a corporate proxy), the components fall back to a 5-second polling interval on the relevant Supabase query. This is implemented as a `useEffect` cleanup pattern: if the subscription `status` is not `'SUBSCRIBED'` after 3 seconds, polling starts and the subscription continues trying to reconnect.

---

## 8. Security Model

### Customer surface (unauthenticated)

Customers interact without any login. Security is provided by:

- **Server-side price recalculation:** Prices cannot be manipulated client-side.
- **Order expiry:** Unsubmitted orders expire in 15 minutes, limiting the window for abuse.
- **No PII stored for customers:** Only a session UUID and optionally a table number. No name, email, or phone is collected in v1.0.
- **RLS on orders:** Customers can only read orders matching their `session_id`, which is passed as a Postgres setting on each request (`app.session_id`). They cannot enumerate other orders.

### Owner surface (authenticated)

Restaurant owners authenticate via Supabase Auth (email + password). The dashboard route checks for a valid session server-side before rendering. All owner mutations (verify, reject) go through API routes that check `auth.uid()` against the order's `restaurant_id`.

### Receipt storage

Receipt images are stored in a Supabase Storage bucket with the following policy: only the service role (used by API routes) and the authenticated restaurant owner can read images. Customers can upload (via signed upload URL) but cannot read back images — they see their own upload preview from the local file object, not a storage URL.

### OCR internal route

`/api/ocr` is protected by a shared secret (`OCR_INTERNAL_SECRET`) checked in the Authorization header. It is never called directly by clients. This prevents an attacker from triggering compute-intensive OCR jobs by calling the route directly.

---

## 9. Infrastructure & Deployment

MishiPay supports two deployment modes: **managed** (Vercel + Supabase cloud) and **self-hosted** (Docker Compose on any Linux server).

### 9a. Managed deployment (Vercel + Supabase cloud)

```
┌─────────────────────────────────────────────────────────┐
│                      Vercel                             │
│                                                         │
│   Next.js app (App Router)                              │
│   Edge runtime: layout, middleware, share-target        │
│   Node.js runtime: OCR route (Tesseract needs Node)     │
│   Static: PWA manifest, icons, service worker           │
│                                                         │
│   Environment: NEXT_PUBLIC_SUPABASE_URL                 │
│                NEXT_PUBLIC_SUPABASE_ANON_KEY            │
│                SUPABASE_SERVICE_ROLE_KEY                 │
│                OCR_INTERNAL_SECRET                      │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                     Supabase (cloud)                    │
│                                                         │
│   PostgreSQL 15                                         │
│   ├── pg_cron: order expiry job (every 5 min)           │
│   ├── Real-time: logical replication enabled            │
│   └── Row Level Security: enabled on all tables         │
│                                                         │
│   Storage                                               │
│   ├── bucket: receipts (private)                        │
│   └── bucket: restaurant-assets (public, QR images)    │
│                                                         │
│   Auth                                                  │
│   └── Email + password for restaurant owners           │
└─────────────────────────────────────────────────────────┘
```

### 9b. Self-hosted deployment (Docker Compose)

For operators who want full data ownership, MishiPay ships a `docker-compose.yml` that bundles the Next.js server with Supabase's self-hosted stack. A single `docker compose up` is all that is needed on any Linux VPS.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Docker Compose stack                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  mishipay  (Next.js, Node 20, port 3000)                  │  │
│  │  Built from Dockerfile in repo root                       │  │
│  │  Reads SUPABASE_URL = http://kong:8000                    │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │ internal network                      │
│  ┌───────────────────────▼───────────────────────────────────┐  │
│  │  kong  (Supabase API gateway, port 8000 → host 54321)     │  │
│  └──────┬──────────┬────────────┬───────────────┬────────────┘  │
│         │          │            │               │               │
│  ┌──────▼──┐  ┌────▼────┐  ┌───▼────┐  ┌───────▼────────────┐  │
│  │ postgre │  │gotrue   │  │postgre │  │storage-api         │  │
│  │ s (5432)│  │(auth)   │  │st (API)│  │+ imgproxy          │  │
│  └─────────┘  └─────────┘  └────────┘  └────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  realtime  (WebSocket, Supabase real-time server)       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  studio  (Supabase Dashboard UI, port 3001 — optional)  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Key environment variables for self-hosted mode:**
- `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321` — Kong gateway on the host
- `SUPABASE_SERVICE_ROLE_KEY` — generated during first-run setup
- `POSTGRES_PASSWORD` — set in `.env` before `docker compose up`
- `JWT_SECRET` — random secret shared between Kong, GoTrue, and PostgREST

**Operator steps:**
```bash
git clone https://github.com/your-org/mishipay
cd mishipay
cp .env.example .env          # fill in POSTGRES_PASSWORD and JWT_SECRET
docker compose up -d
# visit http://localhost:3000/r/your-restaurant-slug
```

**Limitations vs. managed hosting:**
- Tesseract.js OCR still runs in-process inside the Next.js container — no change needed.
- pg_cron must be enabled via `docker-compose.yml` Postgres init script (included).
- Push notifications and HTTPS termination are handled by the operator's reverse proxy (Nginx/Caddy). The compose file exposes port 3000 only.
- Real-time (WebSocket) works over the same port via the kong → realtime service.

### Estimated free tier capacity (managed mode)

| Resource | Supabase free | MishiPay usage |
|---|---|---|
| Database rows | 500MB | ~1000 orders/day × 365 days = well within |
| Storage | 1GB | ~200KB per receipt × 1000/day = 200MB/day (needs paid plan at scale) |
| Real-time connections | 200 concurrent | Sufficient for early adoption |
| Vercel bandwidth | 100GB/month | Sufficient for early adoption |

Storage is the first resource that will require a paid plan at meaningful scale. Receipts should be compressed server-side (target < 100KB JPEG) before storage to extend free tier runway.

---

## 10. Key Technical Decisions & Tradeoffs

### Why Tesseract.js instead of a cloud OCR API?

Tesseract.js runs in-process on Vercel's Node.js runtime with no external API calls, no per-request cost, and no data leaving the system. The tradeoff is accuracy: Tesseract is weaker than Google Vision or Claude API on complex layouts. However, DeUna's confirmation screen is visually simple (large text, high contrast, consistent layout), making Tesseract reliable enough for extracting transaction IDs and amounts. If OCR accuracy becomes a problem at scale, `lib/ocr/tesseract.ts` is the only file that needs to change — the parser and fraud detection logic are unchanged.

### Why not use the Payphone or Pagomedios API for programmatic payment verification?

The free DeUna tier (static QR, manual verification) is the right starting point for a passion project because it has zero setup cost for restaurants and zero per-transaction fees. The architecture is deliberately designed so that Payphone or Pagomedios can be added as an additional payment method in v1.1 without changing the order or receipt data model — they would simply set `order.payment_method = 'payphone'` and skip the receipt upload step, going directly to `verified` via webhook.

### Why Next.js App Router instead of a separate frontend + backend?

A single Next.js repo reduces deployment complexity to one Vercel project. API routes live alongside the pages that call them, making the codebase easier to navigate for a solo developer or small team. The tradeoff is that Node.js API routes on Vercel have cold start latency (~300ms) on the free plan. For the OCR route (which is background, not user-facing) this is acceptable. For the order creation and receipt upload routes, Vercel's Edge Runtime is used where possible to minimize cold starts.

### Why anonymous sessions instead of customer accounts?

Customer registration would add significant friction to the ordering flow — which happens at the table, often on a shared QR code, in a short window before the customer wants their food. The risk model for anonymous sessions is acceptable because: (a) the restaurant owner's manual verification step is the real fraud gate, (b) customers cannot access other customers' orders due to RLS, and (c) no financial data (card numbers, bank details) is ever collected from customers.

---

*Document version: 1.0 — May 2026*
*Project: MishiPay — open-source restaurant ordering for Ecuador*
