# Installation & First-Time Setup

This guide walks you through installing MishiMenu and getting it ready for your first day of service. No programming knowledge required.

---

## What you need

### The computer

MishiMenu runs on any computer that stays on during service hours. It does not need an internet connection once it is installed — everything runs on your local network.

| | Minimum | Recommended |
|---|---|---|
| RAM | 4 GB | 8 GB |
| Storage | 20 GB free | 50 GB free |
| System | Windows 10, macOS 12, Ubuntu 20 | Any of these |
| Connection | WiFi | Ethernet (more stable) |

A small dedicated mini-PC (Intel NUC, Beelink, or similar) works perfectly and costs less than a laptop.

### The network

Customers access MishiMenu from their phones by connecting to the **same WiFi network** as the computer.

- The computer gets a local address like `192.168.1.50`
- Customers open `http://192.168.1.50:3000` in their phone browser
- Nothing needs the internet during a service shift — only the initial install does

> **Tip:** Ask your router or internet provider to give the MishiMenu computer a fixed IP address. That way the URL never changes.

---

## Step 1 — Download MishiMenu

Open a terminal on the computer and run:

```bash
git clone https://github.com/youruser/mishimenu
cd mishimenu
```

If you don't have Git, download the ZIP from GitHub and extract it to a folder named `mishimenu`.

**Windows:** use Command Prompt or PowerShell and run all commands from the `mishimenu` folder.

---

## Step 2 — Run the install wizard

**Linux / Mac:**
```bash
./mishimenu install
```

**Windows:**
```
mishimenu install
```

The wizard walks you through two questions, then does everything automatically:

**Question 1 — App URL**
It shows a numbered list of your computer's IP addresses. Pick the one on your restaurant WiFi. If unsure, pick the first option.

**Question 2 — Owner email and password**
This is your admin login for the dashboard. Use a real email address you own. You will be asked to type the password twice to confirm it — the characters are hidden as you type.

After answering, the wizard:
- Downloads and installs Docker if needed (~5 min first time)
- Builds and starts all services
- Creates your database and owner account

When it finishes you will see something like:

```
✓ MishiMenu started.

  App:       http://192.168.1.50:3000
  Dashboard: http://192.168.1.50:3000/dashboard
  Studio:    http://192.168.1.50:3001
```

Open the Dashboard link in your browser and log in.

---

## Step 3 — Configure your restaurant

Go to **Settings** (⚙️ in the dashboard header).

### Restaurant name and contact

Fill in:
- **Nombre** — your restaurant name, shown at the top of the customer menu (required)
- **Dirección** — address (optional)
- **Teléfono** — phone number (optional)
- **RUC** — your tax ID (optional)

---

### Currency symbol

Choose the symbol that appears next to all prices.

| Button | Use for |
|---|---|
| **$** | Ecuador, USA, and most of Latin America |
| **S/** | Peru (soles) |
| **Q** | Guatemala (quetzales) |
| **€** | Europe |

If your currency isn't listed, type it in the "Otro" field (up to 3 characters).

---

### IVA (sales tax)

Choose one of three options that describes how your restaurant handles IVA:

**No cobro IVA**
You do not charge sales tax. Prices are final. Choose this if you are exempt from IVA.

**Los precios del menú ya incluyen el IVA**
The prices you enter already have IVA baked in. The customer pays exactly what the menu says — no extra charge at checkout. You then enter the IVA rate (Ecuador: 15%) so the system can inform customers.

**El IVA se suma al precio final**
The prices on the menu are before tax. The system adds IVA on top when the customer places their order. Example: a dish priced at $8.70 with 15% IVA becomes $10.00 at checkout.

---

### Service charge (Cargo por servicio)

Choose the type of service charge you want to add to each order:

**Sin cargo de servicio**
No extra charge. The customer pays only what the items cost.

**Porcentaje sobre el subtotal**
A percentage of the order total. Example: 10% on a $20.00 order = $2.00 charge. Common in Ecuadorian restaurants.

**Tarifa fija por pedido**
A flat amount added to every order, regardless of size. Example: $1.00 per order.

**Porcentaje + tarifa fija**
Both: a percentage and a flat amount applied together.

---

### Live price preview

As you adjust the IVA and service charge options, a preview at the bottom of the section shows exactly what a customer would pay for a $10.00 dish. Use this to confirm your settings are correct before saving.

---

### Show price breakdown to customers

When this is **on** (default): customers see a line-by-line breakdown at checkout — subtotal, IVA, service charge, and total.

When this is **off**: customers only see the final total. Useful if you prefer not to show the breakdown, or if you charge IVA-included prices and the split would confuse customers.

---

### Kitchen dashboard

When this is **on**: a separate screen for your kitchen team is available at `/dashboard/kitchen`. Staff can see incoming verified orders and mark them as done. See [daily-use.md](daily-use.md) for how the kitchen screen works.

Turn this on only if you have a screen in the kitchen (a tablet or monitor works well).

---

### Payment policy

| Option | How it works |
|---|---|
| **🔒 Pago anticipado** | Customer pays before the kitchen starts cooking. The order appears in the kitchen only after you verify payment. Best for busy or takeout restaurants. |
| **🍽️ Pago al final** | Kitchen starts immediately when the order is placed. Customer pays when they finish eating. Best for sit-down service. |

---

### Payment methods

Enable each method your restaurant accepts. After checking the box, extra fields appear for any method that needs configuration.

**DeUna** (Banco Pichincha wallet)
- Check the box, then enter:
  - **URL del QR** — open DeUna on your phone → Cobrar → Copy link
  - **Nombre de cuenta** — the name on your account

**Sipi** — same setup as DeUna.

**Transferencia bancaria**
- Enter your bank name, account number, and account holder name.

**Efectivo** (cash) and **Tarjeta** (card) — no extra setup needed.

Click **Guardar cambios** when done.

---

## Step 4 — Build your menu

Click **🍽️ Carta** in the dashboard header.

### Add categories first

Click **+ Categoría**, type the name (e.g. "Entradas"), press Enter. Add one per section of your menu:

> Entradas · Sopas · Platos fuertes · Mariscos · Postres · Bebidas

### Add dishes

Click **+ Añadir plato** inside a category.

| Field | Notes |
|---|---|
| Emoji | One emoji shown next to the dish. Optional but friendly. |
| Nombre | Required. Keep it short. |
| Precio | The price customers see, in your chosen currency. |
| Descripción | One line. Optional. |
| Disponible | Green pill = visible on menu. Grey = hidden. |

Save the dish first, then click ✏️ to reopen it and add a photo.

### Add photos (optional but recommended)

Good photos increase orders. Recommended: square, in natural light, under 3 MB.

1. Save the dish first
2. Click ✏️ to edit it
3. Click **📷 Subir imagen**
4. Choose a photo from your phone or computer
5. The photo appears immediately on the customer menu

### Temporarily hide a dish

If a dish sells out, tap the **Activo** pill — it turns grey ("Oculto") and disappears from the customer menu instantly. Tap again to show it.

---

## Step 5 — Create the QR codes for tables

Customers scan a QR code at the table to open the menu.

1. Run `./mishimenu hostname` to see your URL
2. Go to a free QR generator (qr-code-generator.com or similar)
3. Enter `http://192.168.1.50:3000`
4. Download and print — one QR per table

> **Tip:** Create a separate QR per table that includes the table number in the URL: `http://192.168.1.50:3000?mesa=5`. The order form will pre-fill the table number.

---

## Step 6 — Set up your team (optional)

If you have staff who will verify payments, manage the menu, or work in the kitchen, you can create individual logins for each person.

Click **👥** in the dashboard header → **+ Añadir usuario**.

Each staff member gets their own email and password, and you assign them access to the sections they need:
- **Menú** — can edit items and prices
- **Pagos** — can verify and reject orders in the dashboard
- **Cocina** — can see and complete orders in the kitchen screen

See [admin.md](admin.md) for a full walkthrough of user management.

---

## Step 7 — Test before opening

Do a dry run before your first real service:

1. Open the customer URL on your phone
2. Browse the menu, add items to the cart
3. Place an order with your payment method
4. Check the dashboard — the order should appear
5. If using DeUna or Sipi: complete a test payment and upload the confirmation screenshot
6. Verify the order from the dashboard
7. If the kitchen screen is enabled: confirm the order appears there, mark it as done

If anything doesn't work, see [admin.md](admin.md) for troubleshooting.

---

## Auto-start on boot

MishiMenu restarts automatically when the computer reboots. You do not need to run any command after a power outage. Wait about 2 minutes after the computer turns on, then check if the app is accessible.
