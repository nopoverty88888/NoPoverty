-- =============================================================================
-- 回收券張數 (voucher_collections.quantity): a single PHYSICAL voucher can stand
-- for more than NT$100. When an NGO uses its own vouchers for bulk purchases
-- (活動採購 / 便當外送), it hands the store ONE paper voucher with a handwritten
-- count on it — e.g. "20" meaning 20 × NT$100 = NT$2,000 of food. At month-end
-- 回收 the rep records that one serial with 張數 = 20. Discussed 2026-07-03.
--
-- Scope (per 立心): 張數 > 1 only ever happens for the NGO's OWN use, never for a
-- 個案's 他店券, so this does NOT touch cross-store compensation (他店補款 stays
-- 他店券筆數 × 100). quantity is a recording / usage-visibility field only.
--
-- Still ONE physical voucher = ONE row = ONE serial: unique(year_month,
-- serial_number) is unchanged. default 1 backfills every existing row to 1 張,
-- so nothing about current behaviour changes.
-- =============================================================================

alter table public.voucher_collections
  add column quantity integer not null default 1 check (quantity >= 1);

-- Expose 張數 in 個案使用紀錄 so reports / a case's history reflect true
-- consumption. CREATE OR REPLACE VIEW keeps grants + security_invoker but needs
-- the original columns in the SAME order, so quantity is appended LAST.
create or replace view public.case_usage_view
with (security_invoker = true) as
  select
    c.id            as case_id,
    c.name          as case_name,
    c.ngo_id,
    s.name          as used_at_store_name,
    vc.serial_number,
    vc.year_month,
    vc.scanned_at,
    vc.quantity
  from public.voucher_collections vc
  join public.voucher_assignments va
    on vc.serial_number = va.serial_number
   and vc.year_month   = va.year_month
  join public.cases  c on va.case_id = c.id
  join public.stores s on vc.collected_at_store_id = s.id;
