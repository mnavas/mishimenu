-- MishiMenu migration 002 — Tax and service fee support
-- Run once on existing installations:
--   docker exec mishimenu-db-1 psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/002_pricing.sql
-- New installations: applied automatically from /docker-entrypoint-initdb.d/

-- ─────────────────────────────────────────────
-- Restaurant: pricing configuration
-- ─────────────────────────────────────────────

ALTER TABLE restaurant
  ADD COLUMN IF NOT EXISTS tax_rate         NUMERIC(5,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_included     BOOLEAN      NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS service_fee_rate NUMERIC(5,4) NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────
-- Orders: store snapshot of tax/fee amounts
-- Snapshotting at order time ensures historical accuracy
-- even if the restaurant later changes its rates.
-- ─────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tax_amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
