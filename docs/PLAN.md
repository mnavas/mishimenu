# MishiPay — Implementation Plan
## Phased Build Plan for Agentic Implementation v1.0

---

## Repository layout

MishiPay is split across three repositories:

| Repo | Purpose |
|---|---|
| `mishipay` | **This repo.** Next.js web server — customer ordering, receipt upload, owner dashboard, OCR pipeline. |
| `mishiapp` | Native companion app (compiled binaries released via GitHub Releases). |
| `mishipay-web` | Marketing and documentation website. |

This document covers only the `mishipay` server. Docker Compose (`docker-compose.yml`) in this repo bundles the Next.js app with a full self-hosted Supabase stack so anyone can run it on a VPS with a single command.

---

## How to use this document

This file is the execution roadmap for implementing MishiPay. It is organized into phases, each broken into tasks. Each task has a clear definition of done, the files it touches, and any hard dependencies on previous tasks.

An agent should work through phases in order. Within a phase, tasks marked `[parallel]` can be executed simultaneously. Tasks marked `[blocking]` must complete before the next task starts.

After completing each phase, run the phase's verification checklist before proceeding.

---

## Phase 0 — Project Scaffold
**Goal:** A running Next.js app connected to Supabase with nothing in it yet.

### Task 0.1 — Initialize Next.js project `[blocking]`
```bash
npx create-next-app@latest mishipay \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
cd mishipay
```
**Creates:** `app/`, `public/`, `tailwind.config.ts`, `tsconfig.json`, `package.json`

### Task 0.2 — Install dependencies `[blocking]`
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install tesseract.js
npm install next-pwa
npm install -D @types/node
```

### Task 0.3 — Create environment files
Create `.env.local` from the template below. Populate with real Supabase project credentials.
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
OCR_INTERNAL_SECRET=dev-secret-change-in-production
```
Also create `.env.local.example` with the same keys but empty values. Commit only the example file.

### Task 0.4 — Supabase client setup `[parallel]`
Create `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (API routes).

`lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

`lib/supabase/server.ts`:
```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

### Task 0.5 — TypeScript interfaces `[parallel]`
Create `lib/types.ts` with all shared types used across the app.

```typescript
// lib/types.ts

export type OrderStatus =
  | 'pending_payment'
  | 'receipt_received'
  | 'ocr_processing'
  | 'verified'
  | 'rejected'
  | 'expired'

export type OrderType = 'mesa' | 'llevar'

export type OcrStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface Restaurant {
  id: string
  slug: string
  name: string
  address: string | null
  phone: string | null
  ruc: string | null
  deuna_qr_url: string | null
  deuna_account_name: string | null
  logo_url: string | null
  active: boolean
}

export interface Category {
  id: string
  restaurant_id: string
  name: string
  sort_order: number
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  emoji: string | null
  image_url: string | null
  available: boolean
  sort_order: number
}

export interface CartItem extends MenuItem {
  quantity: number
}

export interface Order {
  id: string
  restaurant_id: string
  order_number: number
  session_id: string
  order_type: OrderType
  table_number: string | null
  status: OrderStatus
  subtotal: number
  total: number
  expires_at: string
  created_at: string
  updated_at: string
  order_items?: OrderItem[]
  receipt?: Receipt
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string | null
  name: string
  price: number
  quantity: number
  subtotal: number
}

export interface Receipt {
  id: string
  order_id: string
  storage_path: string
  image_hash: string | null
  extracted_tx_id: string | null
  extracted_amount: number | null
  extracted_sender: string | null
  ocr_status: OcrStatus
  is_duplicate: boolean
  duplicate_of_order_id: string | null
  submitted_via: 'upload' | 'share_target' | null
  created_at: string
}

export interface ParsedReceipt {
  txId: string | null
  amount: number | null
  sender: string | null
  rawText: string
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  reason?: 'image_hash' | 'transaction_id'
  duplicateOrderId?: string
  duplicateOrderNumber?: number
}
```

### Task 0.6 — Session management `[parallel]`
Create `lib/session.ts`:
```typescript
const SESSION_KEY = 'mishipay_session_id'

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}
```

### Task 0.7 — PWA configuration `[parallel]`
Configure `next.config.js` with `next-pwa`:
```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

module.exports = withPWA({
  reactStrictMode: true,
})
```

Create `public/manifest.json` with the Web Share Target entry (full content in REQUIREMENTS.md §7).

Add PWA meta tags to `app/layout.tsx`:
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1D9E75" />
<meta name="apple-mobile-web-app-capable" content="yes" />
```

### ✅ Phase 0 verification checklist
- [ ] `npm run dev` starts without errors
- [ ] `http://localhost:3000` loads (even if blank)
- [ ] `.env.local` exists and is in `.gitignore`
- [ ] `lib/types.ts` has no TypeScript errors
- [ ] `lib/supabase/client.ts` and `server.ts` exist

---

## Phase 1 — Database
**Goal:** All tables created in Supabase with RLS, indexes, and seed data.

### Task 1.1 — Run initial migration `[blocking]`
Create `supabase/migrations/001_initial.sql` with the full schema from REQUIREMENTS.md §5.

Apply via Supabase dashboard SQL editor or CLI:
```bash
npx supabase db push
```

Verify in Supabase dashboard that all tables exist: `restaurants`, `categories`, `menu_items`, `orders`, `order_items`, `receipts`.

### Task 1.2 — Create storage buckets `[parallel]`
In Supabase Storage, create two buckets:
- `receipts` — **private**. Policy: service role can read/write; authenticated owners can read their restaurant's receipts by path prefix.
- `restaurant-assets` — **public**. Policy: anyone can read; service role can write. Used for QR code images and logos.

### Task 1.3 — Seed test restaurant and menu `[parallel]`
Create `supabase/seed.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seed() {
  // Insert restaurant
  const { data: restaurant } = await supabase
    .from('restaurants')
    .insert({
      slug: 'la-esquina-cuencana',
      name: 'La Esquina Cuencana',
      address: 'Calle Larga 123, Cuenca',
      ruc: '0190123456001',
      deuna_account_name: 'La Esquina Cuencana',
    })
    .select()
    .single()

  // Insert categories and menu items
  const categories = ['Platos fuertes', 'Sopas', 'Bebidas']
  // ... (full seed data matching the prototype menu)
}

seed()
```

Run with:
```bash
npx ts-node supabase/seed.ts
```

### Task 1.4 — Enable real-time on tables `[parallel]`
In Supabase dashboard → Database → Replication, enable real-time for:
- `orders` (INSERT, UPDATE)
- `receipts` (UPDATE)

### Task 1.5 — Schedule order expiry job `[parallel]`
In Supabase dashboard → Database → Extensions, enable `pg_cron`.
Then run in SQL editor:
```sql
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

### ✅ Phase 1 verification checklist
- [ ] All 6 tables exist in Supabase
- [ ] `restaurants` table has 1 seeded row (`la-esquina-cuencana`)
- [ ] `menu_items` table has at least 6 seeded items
- [ ] Both storage buckets exist with correct access policies
- [ ] Real-time is enabled for `orders` and `receipts`
- [ ] `pg_cron` extension is active

---

## Phase 2 — Customer Menu & Ordering
**Goal:** Customer can browse menu and create an order. No payment yet.

### Task 2.1 — Restaurant page route `[blocking]`
Create `app/r/[slug]/page.tsx`.

This is a **server component**. It fetches the restaurant and its menu server-side using the Supabase server client. If the slug is not found, call `notFound()` to render the 404 page.

```typescript
// app/r/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import MenuScreen from '@/components/menu/MenuScreen'

export default async function RestaurantPage({
  params
}: {
  params: { slug: string }
}) {
  const supabase = createServiceClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', params.slug)
    .eq('active', true)
    .single()

  if (!restaurant) notFound()

  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('*, categories(*)')
    .eq('restaurant_id', restaurant.id)
    .eq('available', true)
    .order('sort_order')

  return <MenuScreen restaurant={restaurant} menuItems={menuItems ?? []} />
}
```

### Task 2.2 — MenuScreen component `[blocking after 2.1]`
Create `components/menu/MenuScreen.tsx` as a **client component** (`'use client'`).

Responsibilities:
- Receive `restaurant` and `menuItems` props from the server component
- Manage `cart: CartItem[]` state locally
- Group items by category and render `MenuCategory` for each
- Render `CartBar` sticky at bottom when cart is non-empty
- When cart bar is tapped, render `OrderSummary` (inline state change, not navigation)

### Task 2.3 — MenuCategory component `[parallel with 2.2]`
Create `components/menu/MenuCategory.tsx`.

Renders a section title and list of menu items. Each item shows: emoji, name, description, price, and a quantity control (+/− buttons). The quantity controls call callbacks passed down from `MenuScreen`.

### Task 2.4 — CartBar component `[parallel with 2.2]`
Create `components/menu/CartBar.tsx`.

Sticky bottom bar. Shows item count and total. Only renders when `cart.length > 0`. Tapping triggers transition to `OrderSummary` view.

### Task 2.5 — OrderSummary component `[blocking after 2.2]`
Create `components/order/OrderSummary.tsx` as a client component.

Shows: list of ordered items with quantities and line totals, grand total, order type selector (mesa / llevar), table number input (conditionally shown). On submit, calls `POST /api/orders`.

### Task 2.6 — POST /api/orders route `[blocking after 2.5]`
Create `app/api/orders/route.ts`.

Full implementation per REQUIREMENTS.md §6.1:
1. Parse and validate request body
2. Fetch current menu item prices from DB using service client
3. Reject any `menuItemId` not belonging to the given `restaurantId`
4. Calculate server-side total
5. Insert `orders` record with `status: 'pending_payment'`
6. Insert `order_items` records (price snapshot)
7. Return `{ orderId, orderNumber, total, expiresAt }`

### ✅ Phase 2 verification checklist
- [ ] Visiting `/r/la-esquina-cuencana` renders the menu with seeded items
- [ ] Items can be added and removed from cart
- [ ] CartBar shows correct item count and total
- [ ] OrderSummary shows correct line items and grand total
- [ ] Submitting an order creates a record in Supabase `orders` table
- [ ] Server-side price calculation: manually edit a price in DB, confirm order total reflects DB price not client price
- [ ] Visiting `/r/unknown-slug` returns a 404 page

---

## Phase 3 — Payment Screen & Receipt Upload
**Goal:** Customer can see the DeUna QR, copy the amount, upload a receipt, and see their order status update.

### Task 3.1 — Payment page route `[blocking]`
Create `app/r/[slug]/pay/[orderId]/page.tsx`.

Server component. Fetches the order by `orderId`. Validates that the order belongs to the restaurant identified by `slug`. If the order is `expired` or `rejected`, renders an error state with a "Volver al menú" button instead of the payment UI.

### Task 3.2 — PaymentScreen component `[blocking after 3.1]`
Create `components/payment/PaymentScreen.tsx` as a client component.

On mount:
```typescript
useEffect(() => {
  navigator.clipboard.writeText(order.total.toFixed(2)).catch(() => {})
}, [])
```

Renders `DeUnaQR`, `AmountCopy`, `ReceiptUpload`, and `OrderStatusTimeline` components. Manages a `submitted` boolean state that switches the view from upload UI to status timeline after receipt submission.

Sets up real-time subscription on `orders` table filtered by `id = eq.{orderId}`:
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`order-${order.id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${order.id}`
    }, (payload) => setOrder(payload.new as Order))
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [order.id])
```

### Task 3.3 — DeUnaQR component `[parallel with 3.2]`
Create `components/payment/DeUnaQR.tsx`.

Renders the restaurant's DeUna QR image from `restaurant.deuna_qr_url`. If no URL is set, renders a placeholder with instructions to configure the QR in the restaurant settings. Shows the `deuna_account_name` below the QR.

### Task 3.4 — AmountCopy component `[parallel with 3.2]`
Create `components/payment/AmountCopy.tsx`.

Displays the order total formatted as `$XX.XX`. Tapping it calls `navigator.clipboard.writeText()` and shows a brief "¡Copiado!" confirmation. Handles clipboard API unavailability gracefully (shows the amount with a "Seleccionar" fallback).

### Task 3.5 — ReceiptUpload component `[blocking after 3.2]`
Create `components/payment/ReceiptUpload.tsx`.

Two upload paths:

**Path A — File picker:**
Hidden `<input type="file" accept="image/jpeg,image/png">`. Visible upload zone that opens the picker on click. Validates file type and size (≤ 10MB) before showing preview.

**Path B — Share target:**
On mount, checks for `?shared=1` in URL. If present, fetches the staged image path from the order record (stored during share-target handling). Displays the pre-fetched image as preview automatically.

On submit, POSTs `multipart/form-data` to `/api/receipts` with `orderId` and the image file.

### Task 3.6 — POST /api/receipts route `[blocking after 3.5]`
Create `app/api/receipts/route.ts`.

Full implementation per REQUIREMENTS.md §6.2:
1. Parse `multipart/form-data` — use `request.formData()`
2. Validate order exists and is in `pending_payment` status
3. Validate MIME type (`image/jpeg` or `image/png` only)
4. Read image as `ArrayBuffer`, compute SHA-256:
   ```typescript
   const hashBuffer = await crypto.subtle.digest('SHA-256', imageBuffer)
   const hash = Buffer.from(hashBuffer).toString('hex')
   ```
5. Query `receipts` for matching `image_hash` in same restaurant → set `is_duplicate` if found
6. Upload to Supabase Storage: `receipts/{restaurantId}/{orderId}/{Date.now()}.jpg`
7. Insert `receipts` record
8. Update order `status → receipt_received`
9. Fire background OCR:
   ```typescript
   // Non-blocking — don't await
   fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ocr`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${process.env.OCR_INTERNAL_SECRET}`
     },
     body: JSON.stringify({ receiptId })
   })
   ```
10. Return `{ receiptId, isDuplicate, duplicateOrderId? }`

### Task 3.7 — OrderStatusTimeline component `[parallel with 3.5]`
Create `components/payment/OrderStatusTimeline.tsx`.

Renders a vertical timeline with 5 steps. The current step is determined by `order.status`:

| Status | Active step |
|---|---|
| `pending_payment` | Step 1: Pedido recibido |
| `receipt_received` / `ocr_processing` | Step 2: Comprobante enviado |
| `verified` | Step 4: En preparación |
| `rejected` | Shows red error step with message |

Steps 1 and 2 are shown as complete after receipt submission. Steps 3–5 update via the real-time subscription in `PaymentScreen`.

### ✅ Phase 3 verification checklist
- [ ] Visiting `/r/la-esquina-cuencana/pay/{validOrderId}` renders the payment screen
- [ ] On page load, browser clipboard contains the order total (verify by pasting)
- [ ] Tapping the amount copy button shows "¡Copiado!" confirmation
- [ ] Uploading a JPEG or PNG receipt submits successfully
- [ ] After submission, `orders.status` changes to `receipt_received` in Supabase
- [ ] After submission, `receipts` table has a new row with correct `image_hash`
- [ ] Uploading the same image a second time returns `isDuplicate: true`
- [ ] Files over 10MB are rejected with a clear error message
- [ ] Files that are not images (e.g. PDF) are rejected
- [ ] Visiting a pay URL for an expired order shows an error, not the payment form

---

## Phase 4 — OCR Pipeline
**Goal:** Uploaded receipts are automatically parsed and transaction data appears on the dashboard.

### Task 4.1 — Tesseract wrapper `[blocking]`
Create `lib/ocr/tesseract.ts`.

Initialize a Tesseract worker as a module-level singleton (lazy init on first call, reuse after):

```typescript
import Tesseract from 'tesseract.js'

let worker: Tesseract.Worker | null = null

async function getWorker(): Promise<Tesseract.Worker> {
  if (!worker) {
    worker = await Tesseract.createWorker('spa')
  }
  return worker
}

export async function runOcr(imageBuffer: Buffer): Promise<string> {
  const w = await getWorker()
  const { data } = await w.recognize(imageBuffer)
  return data.text
}
```

**Note:** The OCR route must use `export const runtime = 'nodejs'` — Tesseract.js requires Node.js runtime, not Edge.

### Task 4.2 — Receipt parser `[parallel with 4.1]`
Create `lib/ocr/parser.ts`.

```typescript
import { ParsedReceipt } from '@/lib/types'

const TX_ID_PATTERNS = [
  /DEU-\d{4}-\d{4,8}/i,
  /(comprobante|referencia|código|transacción)[:\s#]+([A-Z0-9\-]{6,20})/i,
]

const AMOUNT_PATTERNS = [
  /(total|monto|pagado|valor|pagaste)[:\s]*\$?\s*(\d{1,4}[.,]\d{2})/i,
  /\$\s*(\d{1,4}[.,]\d{2})/g,
]

const SENDER_PATTERN =
  /(pagado por|de:|cliente)[:\s]+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/i

function normalizeAmount(s: string): number {
  return parseFloat(s.replace(',', '.'))
}

export function parseReceipt(rawText: string): ParsedReceipt {
  // Extract transaction ID
  let txId: string | null = null
  for (const pattern of TX_ID_PATTERNS) {
    const match = rawText.match(pattern)
    if (match) { txId = match[0].includes('-') ? match[0] : match[2]; break }
  }

  // Extract amount — prefer labeled amount, fall back to largest match
  let amount: number | null = null
  const labeledMatch = rawText.match(AMOUNT_PATTERNS[0])
  if (labeledMatch) {
    amount = normalizeAmount(labeledMatch[2])
  } else {
    const allAmounts = [...rawText.matchAll(AMOUNT_PATTERNS[1] as RegExp)]
      .map(m => normalizeAmount(m[1]))
      .filter(n => !isNaN(n) && n > 0)
    if (allAmounts.length) amount = Math.max(...allAmounts)
  }

  // Extract sender name
  const senderMatch = rawText.match(SENDER_PATTERN)
  const sender = senderMatch ? senderMatch[2].trim() : null

  return { txId, amount, sender, rawText }
}
```

### Task 4.3 — Fraud detection module `[parallel with 4.1]`
Create `lib/fraud/detection.ts` per REQUIREMENTS.md §9. Expose `checkByImageHash` and `checkByTransactionId` functions. Both accept a Supabase client, the value to check, and the `restaurantId` scope.

### Task 4.4 — POST /api/ocr route `[blocking after 4.1, 4.2, 4.3]`
Create `app/api/ocr/route.ts`.

```typescript
export const runtime = 'nodejs' // Required for Tesseract.js

export async function POST(request: Request) {
  // Verify internal secret
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.OCR_INTERNAL_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { receiptId } = await request.json()
  // ... full implementation
}
```

Full logic:
1. Fetch receipt record from DB
2. Download image from Supabase Storage
3. Update receipt `ocr_status → processing`
4. Run `runOcr(imageBuffer)` → raw text
5. Run `parseReceipt(rawText)` → `{ txId, amount, sender }`
6. If `txId` found: run `checkByTransactionId(txId, restaurantId)` — if duplicate found, update `is_duplicate` and `duplicate_of_order_id`
7. Check if `amount` matches `order.total` (within $0.01 tolerance)
8. Update receipt record with all extracted fields, `ocr_status → done`
9. Return `{ success: true }`

On any error: update `ocr_status → failed`, log error, return 500.

### ✅ Phase 4 verification checklist
- [ ] `lib/ocr/parser.ts` unit tests pass (write at least 3 test cases with sample DeUna receipt text)
- [ ] Uploading a receipt triggers an OCR job (check Vercel logs or Supabase `receipts.ocr_status`)
- [ ] After OCR, `receipts.extracted_tx_id` is populated (if text is recognizable)
- [ ] After OCR, `receipts.extracted_amount` is populated
- [ ] Uploading two receipts with the same transaction ID (different image) sets `is_duplicate = true` on the second
- [ ] OCR failure (unreadable image) sets `ocr_status = 'failed'` without crashing
- [ ] `/api/ocr` returns 401 when called without the internal secret

---

## Phase 5 — Restaurant Dashboard
**Goal:** Authenticated restaurant owners can see, verify, and reject orders in real-time.

### Task 5.1 — Dashboard page route with auth guard `[blocking]`
Create `app/r/[slug]/dashboard/page.tsx`.

Server component. Check for authenticated Supabase session using `@supabase/ssr`. If not authenticated, redirect to `/r/[slug]/dashboard/login`.

Create `app/r/[slug]/dashboard/login/page.tsx` with a simple email + password form using Supabase Auth `signInWithPassword`.

### Task 5.2 — DashboardScreen component `[blocking after 5.1]`
Create `components/dashboard/DashboardScreen.tsx` as a client component.

On mount, fetches all non-expired orders for the restaurant with their receipts:
```typescript
const { data } = await supabase
  .from('orders')
  .select('*, order_items(*), receipt:receipts(*)')
  .eq('restaurant_id', restaurantId)
  .neq('status', 'expired')
  .order('created_at', { ascending: false })
```

Sets up two real-time subscriptions (per ARCHITECTURE.md §7):
- `orders` table filtered by `restaurant_id`
- `receipts` table — on UPDATE, find matching order in local state and update its receipt

Renders `DashboardStats` and a list of `OrderCard` components.

### Task 5.3 — DashboardStats component `[parallel with 5.2]`
Create `components/dashboard/DashboardStats.tsx`.

Derives all values from the `orders` prop (no additional DB queries):
- **Cobrado hoy:** sum of `total` for all `verified` orders created today
- **Por verificar:** count of orders with status `receipt_received` or `ocr_processing`
- **Alertas:** count of orders with `receipt.is_duplicate = true`

### Task 5.4 — OrderCard component `[blocking after 5.2]`
Create `components/dashboard/OrderCard.tsx`.

Renders a single order. Visual state driven by `order.status` (see ARCHITECTURE.md §3.1, OrderCard section for the full status → style mapping).

Shows receipt data (txId, extracted amount, amount match indicator) once `receipt.ocr_status === 'done'`. Shows a spinner/pulse animation while `ocr_status === 'processing'`.

Calls passed-in `onVerify(orderId)` and `onReject(orderId)` callbacks for action buttons.

### Task 5.5 — PATCH /api/orders/[id] route `[blocking after 5.4]`
Create `app/api/orders/[id]/route.ts`.

1. Authenticate request using Supabase server client
2. Fetch order, confirm it belongs to a restaurant owned by `auth.uid()`
3. Validate target status is `verified` or `rejected`
4. If `verified` and `receipt.is_duplicate = true`, require `overrideReason` in request body
5. Update order status
6. Return updated order

### Task 5.6 — FraudAlert component `[parallel with 5.4]`
Create `components/dashboard/FraudAlert.tsx`.

Banner shown above the order list when any order has a fraud flag. Dismissible per session. Shows count of flagged orders and a summary of the most recent fraud event. Clicking it scrolls to the flagged order card using `element.scrollIntoView()`.

### ✅ Phase 5 verification checklist
- [ ] Visiting `/r/la-esquina-cuencana/dashboard` without auth redirects to login
- [ ] Login with seeded owner credentials succeeds
- [ ] Dashboard shows all non-expired orders
- [ ] New order created in another browser tab appears on dashboard without refresh
- [ ] OCR results arriving (receipt update) update the order card in real-time
- [ ] Tapping "Verificar y a cocina" changes order status to `verified` instantly
- [ ] Tapping "Rechazar" changes order status to `rejected` instantly
- [ ] Fraud-flagged order shows red border and warning message
- [ ] Fraud-flagged "Verificar" button is disabled until override is confirmed
- [ ] DashboardStats values update correctly as orders change state

---

## Phase 6 — Web Share Target
**Goal:** Android PWA users can share their DeUna screenshot directly to the app.

### Task 6.1 — Verify PWA installability `[blocking]`
Run Lighthouse audit on the app in Chrome DevTools. The PWA section must pass:
- Has a web app manifest
- Manifest has required fields (name, icons, start_url, display)
- Service worker registered
- Served over HTTPS (or localhost for dev)

Fix any failing checks before proceeding.

### Task 6.2 — POST /api/share-target route `[blocking after 6.1]`
Create `app/api/share-target/route.ts`.

```typescript
export const runtime = 'edge'

export async function POST(request: Request) {
  const formData = await request.formData()
  const files = formData.getAll('files') as File[]
  const image = files.find(f => f.type.startsWith('image/'))

  if (!image) {
    return Response.redirect(`/?error=no_image`, 303)
  }

  // Read session_id from URL query param
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('session')

  if (!sessionId) {
    return Response.redirect(`/?error=no_session`, 303)
  }

  // Find pending order for this session
  const supabase = createServiceClient()
  const { data: order } = await supabase
    .from('orders')
    .select('id, restaurant_id, restaurants(slug)')
    .eq('session_id', sessionId)
    .eq('status', 'pending_payment')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!order) {
    return Response.redirect(`/?error=no_pending_order`, 303)
  }

  // Stage image in storage
  const imageBuffer = await image.arrayBuffer()
  const stagingPath = `receipts/staging/${order.id}/${Date.now()}.jpg`
  await supabase.storage.from('receipts').upload(stagingPath, imageBuffer)

  // Redirect to payment screen with shared=1 flag
  const slug = (order.restaurants as any).slug
  return Response.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/r/${slug}/pay/${order.id}?shared=1`,
    303
  )
}
```

Update `public/manifest.json` share_target action to include `?session={session_id}`:

The session ID needs to be embedded in the share target action URL. Since the manifest is static, use a service worker to intercept the share target POST and append the session ID from localStorage before forwarding to the API route.

### Task 6.3 — Share target service worker handler `[blocking after 6.2]`
In the service worker (configured via `next-pwa`), add a handler that intercepts the share target POST, reads `session_id` from IndexedDB or cache storage (localStorage is not available in service workers), and appends it as a query param before forwarding to `/api/share-target`.

Alternatively, store the session ID in a cookie (accessible in service workers and server-side) instead of localStorage. Update `lib/session.ts` to set both localStorage and a cookie.

### Task 6.4 — Share target confirmation UI `[blocking after 6.3]`
Update `ReceiptUpload` to handle the `?shared=1` path:
1. On mount, detect `?shared=1` query param
2. Fetch staged image URL from order's receipt staging path
3. Display image preview with message: "¿Enviar este comprobante para tu orden de $X.XX?"
4. Show "Sí, enviar" and "Cancelar" buttons
5. On confirm: call `POST /api/receipts` with the staged image path (not re-upload)

### ✅ Phase 6 verification checklist
- [ ] Lighthouse PWA score is 100 (or all PWA checks pass)
- [ ] App can be installed on Android Chrome (Add to Home Screen)
- [ ] After install, app appears in Android share sheet when sharing an image
- [ ] Sharing a DeUna screenshot to the app redirects to the correct pending order
- [ ] Confirmation screen shows the staged image preview
- [ ] Confirming submission processes the receipt normally
- [ ] Sharing when no pending order exists shows a clear error

---

## Phase 7 — Polish & Production Readiness
**Goal:** Error handling, loading states, edge cases, and deployment.

### Task 7.1 — Error boundaries and loading states `[parallel]`
- Add `loading.tsx` files for all routes (Next.js App Router convention)
- Add `error.tsx` files for all routes
- Add skeleton loaders for MenuScreen and DashboardScreen
- Handle network errors in all `fetch` calls with user-visible messages

### Task 7.2 — Order expiry UX `[parallel]`
In `PaymentScreen`, add a countdown timer showing time remaining before order expires. At 2 minutes remaining, show a warning. At expiry, show a modal: "Tu orden ha expirado. Volver al menú para hacer un nuevo pedido."

Subscribe to order real-time — when status changes to `expired`, trigger the modal even if the local timer hasn't fired.

### Task 7.3 — Receipt image compression `[parallel]`
Before uploading in `ReceiptUpload`, compress the image client-side using the Canvas API:
```typescript
async function compressImage(file: File, maxSizeKB = 200): Promise<Blob> {
  const img = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  // Scale down if needed, target < 200KB JPEG at quality 0.85
  // ...
}
```
This reduces storage costs and improves OCR accuracy by standardizing image dimensions.

### Task 7.4 — Multi-restaurant isolation test `[parallel]`
Seed a second restaurant: `slug = 'el-rincon-guayaquil'`.
Verify:
- `/r/el-rincon-guayaquil` shows only its own menu
- Dashboard for restaurant A cannot see orders from restaurant B
- Duplicate receipt check is scoped to same restaurant (same receipt can be used at two different restaurants without triggering fraud flag)

### Task 7.5 — Managed deployment (Vercel + Supabase cloud) `[blocking — run last]`
1. Push repo to GitHub
2. Connect to Vercel, set all environment variables
3. Set `NEXT_PUBLIC_APP_URL` to the Vercel production URL
4. Update Supabase Auth allowed redirect URLs to include production domain
5. Run Lighthouse audit on production URL
6. Smoke test all critical paths on production

### Task 7.6 — Self-hosted deployment (Docker Compose) `[parallel with 7.5]`
Create `Dockerfile` and `docker-compose.yml` in the repo root.

**`Dockerfile`** — multi-stage build:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Add to `next.config.js`: `output: 'standalone'` so the builder produces a self-contained `server.js`.

**`docker-compose.yml`** — bundles MishiPay with Supabase self-hosted stack:
- Services: `db` (Postgres 15 with pg_cron), `auth` (GoTrue), `rest` (PostgREST), `realtime`, `storage`, `imgproxy`, `kong`, `mishipay`
- `mishipay` service depends on `kong` being healthy
- All Supabase services use the official `supabase/*` images, pinned by version

Create `.env.example`:
```bash
POSTGRES_PASSWORD=change-me
JWT_SECRET=change-me-32-chars-min
ANON_KEY=         # generated by init script
SERVICE_ROLE_KEY= # generated by init script
NEXT_PUBLIC_APP_URL=http://localhost:3000
OCR_INTERNAL_SECRET=change-me
```

Create `scripts/generate-keys.sh` to auto-generate JWT-signed anon and service role keys from `JWT_SECRET` during first run.

Operator install:
```bash
git clone https://github.com/your-org/mishipay
cd mishipay
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD, JWT_SECRET, NEXT_PUBLIC_APP_URL
bash scripts/generate-keys.sh  # writes ANON_KEY and SERVICE_ROLE_KEY into .env
docker compose up -d
```

### ✅ Phase 7 verification checklist
- [ ] All routes have loading states (no blank screens during data fetch)
- [ ] All routes have error states (no unhandled errors reach the user)
- [ ] Order expiry countdown displays correctly
- [ ] Expired order shows modal with "Volver al menú" CTA
- [ ] Receipt images are compressed before upload (verify in Supabase Storage — files should be < 300KB)
- [ ] Multi-restaurant isolation confirmed (see Task 7.4)
- [ ] Lighthouse score: Performance ≥ 90, Accessibility ≥ 90, PWA = pass
- [ ] All environment variables set on Vercel
- [ ] Production smoke test passes all critical flows

---

## Summary: Phase Dependencies

```
Phase 0 (Scaffold)
    └── Phase 1 (Database)
            └── Phase 2 (Menu & Orders)
                    └── Phase 3 (Payment & Upload)
                            ├── Phase 4 (OCR Pipeline)     [can start after Task 3.6]
                            └── Phase 5 (Dashboard)        [can start after Task 3.6]
                                        └── Phase 6 (Share Target)  [after Phase 5 complete]
                                                    └── Phase 7 (Polish & Deploy)
```

Phases 4 and 5 can be developed in parallel once Phase 3 is complete. Phase 6 requires Phase 5 to be working (the dashboard must receive share-target receipts).

---

## File Creation Order (for agents that prefer a linear list)

```
lib/types.ts
lib/session.ts
lib/supabase/client.ts
lib/supabase/server.ts
lib/ocr/tesseract.ts
lib/ocr/parser.ts
lib/fraud/detection.ts
supabase/migrations/001_initial.sql
supabase/seed.ts
public/manifest.json
next.config.js
app/layout.tsx
app/page.tsx
app/r/[slug]/page.tsx
app/r/[slug]/pay/[orderId]/page.tsx
app/r/[slug]/dashboard/page.tsx
app/r/[slug]/dashboard/login/page.tsx
app/api/orders/route.ts
app/api/orders/[id]/route.ts
app/api/receipts/route.ts
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
scripts/generate-keys.sh
```

---

*Document version: 1.0 — May 2026*
*Project: MishiPay — open-source restaurant ordering for Ecuador*
