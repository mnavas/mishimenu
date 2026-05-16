# Menu Management & Pricing

This guide explains how to manage your menu and how MishiMenu calculates the final price customers pay.

---

## Managing the menu

Go to **🍽️ Carta** in the dashboard header. You need either admin access or the Menú role to edit the menu.

### Categories

Categories are the sections of your menu (e.g. Entradas, Platos fuertes, Bebidas).

| Action | How |
|---|---|
| Add a category | Click **+ Categoría**, type the name, press Enter |
| Rename a category | Click ✏️ next to its name |
| Delete a category | Click 🗑️ — dishes in that category are moved to "Sin categoría", not deleted |
| Reorder | Drag (if enabled) or edit `sort_order` via Supabase Studio |

### Dishes

| Action | How |
|---|---|
| Add a dish | Click **+ Añadir plato** inside a category |
| Edit name, price, or description | Click ✏️ on the dish row |
| Hide a dish temporarily | Click the **Activo** pill → it turns grey ("Oculto"). The dish disappears from the customer menu instantly. Click again to restore. |
| Add a photo | Edit the dish (✏️) → click **📷 Subir imagen** |
| Change a photo | Same — uploading a new image replaces the old one |
| Remove a photo | Edit the dish → click **Quitar imagen** |
| Delete a dish permanently | Click 🗑️ on the dish row |

### Photos

Good photos significantly increase orders. Recommendations:
- Square images, natural lighting
- Under 3 MB
- JPEG, PNG, or WebP format

The photo is shown at 80 × 80 px in the customer menu card. Save the dish first, then edit it to upload a photo.

### Availability during service

If a dish sells out mid-service, tap **Activo** to hide it instantly — no restart needed. The dish disappears from the customer menu immediately and reappears when you tap again.

---

## How prices are calculated

The price a customer pays is calculated at the moment they confirm their order. The formula depends on your tax and service fee settings.

### The formula

```
Subtotal          = sum of (dish price × quantity)
IVA               = if IVA is "added on top": subtotal × IVA rate
                    if IVA is "included" or "off": $0.00
Service fee       = (subtotal × service fee %) + service fee flat amount
Total             = subtotal + IVA + service fee
```

The calculated amounts are saved permanently with each order. If you change your tax or service fee settings later, existing orders are not affected.

### Example — IVA included, 10% service fee

Settings: IVA 15% included in prices, service fee 10%.

```
Customer orders:
  2× Ceviche @ $10.00 = $20.00
  1× Jugo    @  $2.50 =  $2.50
─────────────────────────────────
Subtotal:              $22.50
IVA (included):         $0.00  ← already inside the menu price
Service fee 10%:        $2.25
─────────────────────────────────
Total:                 $24.75
```

### Example — IVA added on top, no service fee

Settings: IVA 15% added at checkout, no service fee.

```
Customer orders:
  1× Seco de pollo @ $8.70
─────────────────────────────────
Subtotal:             $8.70
IVA 15%:              $1.30
Service fee:          $0.00
─────────────────────────────────
Total:               $10.00
```

### Example — fixed service fee + percentage

Settings: no IVA, service fee 5% + $0.50 flat per order.

```
Customer orders: $12.00
─────────────────────────────────
Subtotal:        $12.00
IVA:              $0.00
Service 5%:       $0.60
Service flat:     $0.50
─────────────────────────────────
Total:           $13.10
```

---

## Configuring tax and service fees

Go to **⚙️ → Impuestos y cargos**. (Requires admin access.)

### IVA

Choose one of three options:

**No cobro IVA**
No tax is charged or shown. The menu price is the final price.

**Los precios del menú ya incluyen el IVA**
The prices you enter already include IVA. No extra charge is added at checkout. Enter the IVA rate (15% in Ecuador) so the system can show customers the correct label on the menu.

**El IVA se suma al precio final**
The menu prices are before tax. IVA is calculated and added at checkout. Enter the IVA rate.

### Service fee

**Sin cargo de servicio**
No additional charge.

**Porcentaje sobre el subtotal**
A percentage of the order total. Enter it as a whole number (e.g., `10` for 10%).

**Tarifa fija por pedido**
A flat amount charged per order regardless of size (e.g., `$1.00`).

**Porcentaje + tarifa fija**
Both apply: a percentage and a flat amount are added together.

### Live preview

The preview box below the settings shows the exact breakdown for a $10.00 dish using your current configuration. It updates as you type so you can verify the result before saving.

---

## Showing or hiding the price breakdown

In **⚙️ → Opciones**, you can toggle "Mostrar desglose de precios al cliente":

- **On (default):** customers see subtotal, IVA, and service fee as separate lines at checkout
- **Off:** customers only see the final total

Choose "off" if:
- Your prices are already all-inclusive and you prefer a simpler checkout screen
- You don't want customers to see the service fee broken out separately

The actual calculation and total charged are the same either way.

---

## Currency symbol

In **⚙️ → Moneda**, pick the symbol that appears next to all prices: `$`, `S/`, `Q`, `€`, or type your own (up to 3 characters). This affects every price display in the app — menu, cart, dashboard, and payment screens.

---

## Tax label on the menu

When "Mostrar desglose" is on and you have a non-zero IVA rate, each dish shows a small label:

| IVA setting | Label shown |
|---|---|
| IVA included in price | `IVA incl.` |
| IVA added at checkout | `+15% IVA` (or whatever rate you set) |
| No IVA | No label |

When "Mostrar desglose" is off, no label is shown on any dish.
