-- =============================================================================
-- 店家負責人姓名 (stores.manager_name): the 2026-07-03 立心 meeting listed a store
-- as "address, contact, and the responsible shopkeeper's name". We had address +
-- contact but no dedicated 負責人 field. Optional free text; existing rows stay
-- null. No RLS change — inherits the stores policies.
-- =============================================================================

alter table public.stores
  add column manager_name text;
