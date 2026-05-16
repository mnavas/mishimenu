-- ── Restaurant feature toggles ───────────────────────────────────────────────
ALTER TABLE restaurant
  ADD COLUMN IF NOT EXISTS show_price_breakdown BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS kitchen_enabled      BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Staff profiles ────────────────────────────────────────────────────────────
-- Links to GoTrue auth.users by user_id (no FK to avoid auth schema dep at migration time).
-- Users with no row here are treated as admin (backwards compatible with install users).
CREATE TABLE IF NOT EXISTS staff_profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL UNIQUE,
  name        TEXT NOT NULL DEFAULT '',
  can_menu    BOOLEAN NOT NULL DEFAULT FALSE,
  can_payment BOOLEAN NOT NULL DEFAULT FALSE,
  can_kitchen BOOLEAN NOT NULL DEFAULT FALSE,
  is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
GRANT ALL ON staff_profiles TO service_role;

-- ── Payment attribution ───────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS verified_by UUID;

-- ── Extend orders.status to include 'completed' (kitchen done) ────────────────
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending_payment',
    'receipt_received',
    'ocr_processing',
    'verified',
    'rejected',
    'expired',
    'completed'
  ));
