# MishiMenu

Self-hosted restaurant ordering and payment web app. One installation = one restaurant. Customers browse the menu on their phones, place orders, and pay digitally. The owner gets a real-time dashboard to verify receipts and manage orders.

**No commissions. No cloud dependency. One command to install.**

---

## Quick start

```bash
git clone https://github.com/youruser/mishimenu
cd mishimenu
./mishimenu install
```

Windows:
```
mishimenu install
```

The wizard asks two questions (your network URL and owner email/password), then handles everything else automatically.

---

## Documentation

| Guide | Who it's for |
|---|---|
| [Installation & First-Time Setup](docs/install.md) | Setting up MishiMenu for the first time — hardware requirements, install steps, configuring restaurant info, building the menu |
| [Daily Use Guide](docs/daily-use.md) | Running the restaurant day-to-day — dashboard, order flow, payment verification, fraud detection, managing the menu mid-service |
| [Administration & Maintenance](docs/admin.md) | Backups, updates, troubleshooting, CLI reference, security |
| [Menu Management & Pricing](docs/menu-management.md) | Tax and service fee configuration, image uploads, pricing formula, menu API reference |

---

## What it does

- **Customer menu** — browse dishes by category with photos, prices, and tax labels
- **Cart and checkout** — choose dine-in or takeout, select payment method, see full price breakdown (subtotal + IVA + service charge)
- **Digital payments** — DeUna QR, Sipi, bank transfer: amount auto-copied to clipboard, 15-min countdown, receipt upload
- **In-person payments** — cash and card orders go straight to the kitchen queue; staff verifies after collecting
- **OCR fraud detection** — Tesseract.js reads every receipt, checks for duplicate transaction IDs and reused image files
- **Real-time dashboard** — new orders appear instantly; verify or reject with one click
- **Menu editor** — add/edit/delete categories and dishes, upload photos, toggle availability instantly
- **Settings** — restaurant info, payment methods and account details, tax rate, service charge

---

## Ports

| Port | Service | Access |
|---|---|---|
| 3000 | MishiMenu app | Share with customers |
| 3001 | Supabase Studio (admin panel) | Keep private |
| 8000 | Supabase API | Used internally |

---

## CLI

```
./mishimenu install      First-time setup
./mishimenu start        Start all containers
./mishimenu stop         Stop all containers
./mishimenu restart      Restart all containers
./mishimenu update       Pull latest version and rebuild
./mishimenu logs         Live logs (Ctrl+C to stop)
./mishimenu status       Show container status
./mishimenu backup       Back up the database
./mishimenu restore      Restore from a backup file
./mishimenu hostname     List all network URLs
./mishimenu add-owner    Create an owner login account
./mishimenu seed         Re-seed restaurant row from .env
./mishimenu keys         Show generated secrets
./mishimenu help         Show all commands
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router (TypeScript) |
| Database | PostgreSQL 15 via Supabase self-hosted |
| Auth | Supabase GoTrue |
| Realtime | Supabase Realtime (WebSocket) |
| Storage | Supabase Storage (dish photos, receipt images) |
| OCR | Tesseract.js (server-side Node.js) |
| Styling | Tailwind CSS v4 |
| API gateway | Kong 2.8.1 |
| Container | Docker Compose |

---

## Repository layout

```
mishimenu/
├── app/                          Next.js App Router pages and API routes
│   ├── page.tsx                  Customer menu
│   ├── pay/[orderId]/            Payment and receipt upload
│   ├── dashboard/                Owner dashboard, login, settings, menu editor
│   └── api/                      REST endpoints (orders, receipts, menu, restaurant)
├── components/
│   ├── menu/                     Customer-facing menu components
│   ├── payment/                  Payment screens per method
│   ├── order/                    Order summary and type selector
│   └── dashboard/                Dashboard, order cards, settings, menu editor
├── lib/
│   ├── restaurant.ts             getRestaurant() — cached single row fetch
│   ├── pricing.ts                calcBreakdown() — tax and service fee formula
│   ├── types.ts                  TypeScript interfaces
│   ├── session.ts                Anonymous session ID management
│   ├── supabase/                 Client and server Supabase clients
│   ├── ocr/                      Tesseract.js OCR pipeline
│   └── fraud/                    Duplicate detection logic
├── supabase/migrations/          SQL migration files (run in order on fresh installs)
├── docker/                       Kong config and template
├── docs/                         User and developer documentation
├── docker-compose.yml
├── Dockerfile
├── mishimenu.py                  Management CLI (Python 3)
├── mishimenu                     Linux/Mac launcher script
└── mishimenu.bat                 Windows launcher script
```

---

## License

MIT
