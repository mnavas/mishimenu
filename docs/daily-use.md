# Daily Use Guide

Everything you need to run MishiMenu during a normal day of service.

---

## Starting the day

MishiMenu starts automatically when the computer boots. You do not need to run any command.

Open the dashboard on any device on your network:
```
http://{your-ip}:3000/dashboard
```

If the page doesn't load, run `./mishimenu start` from the terminal. See [admin.md](admin.md) if you need to troubleshoot.

---

## What your customers see

**1. Customer scans the QR code at the table.**
They land on the menu showing your restaurant's name, categories, and dishes with photos, descriptions, and prices.

**2. Customer builds their order.**
They tap **+** on each dish, adjust quantities, then tap **Ver pedido** (the green button at the bottom) to review.

**3. Customer confirms the order.**
On the summary screen they choose:
- **Mesa** (dine-in) or **Para llevar** (takeout)
- Table number (for dine-in)
- Payment method

The total shown already includes all applicable taxes and service charges.

**4. Payment — digital methods (DeUna, Sipi, Transferencia).**
The customer sees:
- The exact amount to pay (copied to clipboard automatically)
- Your QR code or account details
- A 15-minute countdown timer

They complete the payment in their app, screenshot the confirmation, then return to MishiMenu and upload the screenshot.

**5. Payment — cash or card.**
No upload needed. The customer simply confirms the order, then comes to the counter to pay. Their order appears on your dashboard immediately.

**6. Order tracking.**
The customer sees a live status: Pendiente → Verificado → En cocina. The screen updates automatically when you verify their order.

---

## The owner dashboard

Open `/dashboard`. This is your main screen during service.

### Header

```
Mi Restaurante    [🔒 Pago anticipado]  [👨‍🍳 Cocina]  [🍽️ Carta]  [👥]  [⚙️]
Panel de órdenes
```

| Icon | What it opens |
|---|---|
| **Payment policy badge** | Shows current mode — tap to change in Settings |
| **👨‍🍳 Cocina** | Kitchen dashboard (visible only when kitchen is enabled) |
| **🍽️ Carta** | Menu editor |
| **👥** | User and team management (admin only) |
| **⚙️** | Settings (admin only) |

### Stats bar

| Card | What it shows |
|---|---|
| **Cobrado hoy** | Total value of orders you have verified today |
| **Por verificar** | Orders with a receipt waiting for your approval |
| **Alertas** | Orders flagged as potentially fraudulent |

These update in real time.

### Order queues — upfront payment mode

**Pendientes de verificación** — orders that need your action before the kitchen can start.
**En cocina** — orders you have verified; kitchen is preparing them.

### Order queues — at-end payment mode

**Órdenes activas** — all active orders for the session. Kitchen started when the order was placed; you collect payment when the customer finishes.

---

## Reading an order card

```
┌─ #42  Mesa 3  ·  12:34  ──────────────────────────────── 🟢 DeUna ─┐
│                                                                        │
│  2× Ceviche de camarón             $16.00                             │
│  1× Jugo de naranja                 $2.50                             │
│                                                                        │
│  Subtotal $18.50 · IVA $2.78 · Servicio $1.85 · Total $23.13         │
│                                                                        │
│  ✅ Comprobante recibido                                               │
│  OCR: $23.13 ✓ · TX: TXN-8471-B                                      │
│                                                                        │
│              [✕ Rechazar]              [✓ Verificar]                  │
└────────────────────────────────────────────────────────────────────────┘
```

**Left border color:**
- Grey — waiting for payment
- Amber — receipt received, needs your review
- Green — verified
- Red — rejected or fraud alert

**OCR line** (digital payments only):
- Amount the system read from the receipt image
- ✓ = matches the order total
- ⚠️ = doesn't match — check carefully before approving

---

## Verifying and rejecting orders

### When to verify

Verify when you are satisfied that payment was received:
- **Digital payments** — the receipt amount matches the total and the screenshot looks real
- **Cash** — you have the cash in your hand
- **Card** — the terminal approved the transaction

Click **✓ Verificar**. The order moves to "En cocina" and the customer's screen updates. If the kitchen dashboard is enabled, the order also appears there for your kitchen team.

### When to reject

Reject if:
- The timer expired and no payment arrived
- The receipt is clearly wrong (wrong restaurant, wrong amount, wrong date)
- You suspect fraud

Click **✕ Rechazar**. The order is removed from the queue and the customer can see it was rejected.

### In at-end mode

In at-end mode, the kitchen already started when the order was placed. Rejecting records it in the system but the food is likely already prepared — handle it in person.

---

## The kitchen dashboard

If you have enabled the kitchen screen in Settings, your kitchen team can open it at:
```
http://{your-ip}:3000/dashboard/kitchen
```

They log in with their own account (needs Kitchen access). The screen is designed for a tablet and shows a dark background that's easy to read in a busy kitchen.

**What the kitchen team sees:**
- One card per verified order, sorted oldest first
- Order number, table, and how long ago the order came in
- The full list of items to prepare
- A **✓ Listo** button

**When kitchen taps "Listo":**
- The card disappears from the kitchen screen
- The order moves to "Completado" and disappears from the owner dashboard too
- The customer's status screen is updated

New orders appear automatically on the kitchen screen as you verify them — no manual refreshing needed.

---

## Fraud detection

MishiMenu checks every uploaded receipt automatically for two types of fraud:

### 1. Same image uploaded twice
A customer tries to use one screenshot to pay for two orders. The system computes a fingerprint of every image. If the same file is uploaded again, the order is flagged.

### 2. Same transaction ID used twice
The system reads the transaction ID from the receipt text. If that ID has already been used on a previous order, the order is flagged.

### What you see

A red banner at the top of the dashboard:
```
⚠️ 1 alerta de comprobante duplicado
Última: Orden #47 — comprobante ya usado anteriormente
[Ver orden #47]
```

The order card also gets a red left border.

### How to handle it

1. Click "Ver orden #47" to jump to the card
2. Look at the receipt image
3. Compare with the previous order that used the same receipt
4. **If fraud:** click ✕ Rechazar
5. **If it's a genuine mistake** (e.g. customer accidentally re-submitted): click ✓ Verificar — a field appears asking you to write a short reason why you are approving despite the alert. Write it and confirm.

The reason is saved in the database along with your name, so there is a record of who approved it and why.

---

## Managing the menu during service

Go to **🍽️ Carta** at any time.

### Hide a dish that sold out
Find the dish, click the **Activo** pill — it turns grey ("Oculto") and disappears from the customer menu instantly. Click again to bring it back.

### Change a price
Click ✏️ on the dish → change the price → click **Guardar**.
The new price applies to all new orders immediately. Orders already placed keep the old price.

### Add a dish mid-service
Click **+ Añadir plato**, fill in the details, save. It appears on the customer menu right away.

---

## Payment methods in detail

### DeUna / Sipi

```
Customer taps "Pagar" →
Amount + QR + 15-min timer shown →
Customer completes payment in their app →
Customer uploads confirmation screenshot →
Dashboard shows receipt received + OCR result →
You verify → kitchen starts (or kitchen is already started in at-end mode)
```

### Transferencia bancaria

Same as DeUna/Sipi but the customer makes a bank transfer and uploads the transfer confirmation.

### Efectivo (cash)

```
Customer confirms order (no payment screen shown) →
Order appears in dashboard: "Efectivo pendiente" →
Customer comes to the counter and pays →
You click ✓ Verificar
```

### Tarjeta (card)

```
Customer confirms order →
Order appears: "Tarjeta pendiente" →
Customer comes to counter →
You run the card on your terminal →
You click ✓ Verificar
```

---

## End-of-day tasks

1. **Check the stats bar** — "Cobrado hoy" shows total verified orders for the day.

2. **Back up the database:**
```bash
./mishimenu backup
```
This saves a backup file in the `backups/` folder. Do this every day before closing. See [admin.md](admin.md) for details on storing backups safely.

3. **Hide sold-out dishes** before the next day if you don't want them showing up (or leave them hidden until restocked).

---

## Quick reference — situations you'll hit

| Situation | What to do |
|---|---|
| A dish sold out | Tap **Activo** in Carta → it shows "Oculto" |
| Customer paid cash but the order timer expired | Reject it; take a new order if needed |
| Receipt OCR read the wrong amount | If you confirmed payment yourself, click Verificar — you don't need OCR to match |
| Customer says they paid but no receipt appears | Ask them to screenshot their payment confirmation and upload it again via the payment page |
| Kitchen screen shows an old order | It was never marked done — tap ✓ Listo to clear it |
| Dashboard is not updating in real time | Refresh the page; check the WiFi connection |
| App not loading on a customer's phone | Confirm they are on the same WiFi as the server |
| Order verified by mistake | The status change cannot be undone in the UI — reject it manually and note the reason |
