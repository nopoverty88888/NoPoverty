-- =============================================================================
-- 個案類型 (case_type): support non-standard cases that are NOT tied to a person
-- with a 身分證字號 — e.g. 活動採購 (event purchases) or 便當外送 (lunch-box
-- delivery). Discussed in the 2026-07-03 立心 meeting.
--
--   individual    — a real person (身分證字號 required, as before)
--   event         — bulk purchase for an event (no id_number)
--   meal_delivery — lunch-box / meal delivery (no id_number)
--
-- For non-individual types id_number is optional, so we (1) drop the NOT NULL and
-- (2) replace the table-level unique(ngo_id, id_number) with a PARTIAL unique
-- index that only enforces uniqueness for non-null ids. (Postgres already treats
-- NULLs as distinct, so many id-less cases coexist; the partial index just makes
-- the intent explicit.)
-- =============================================================================

alter table public.cases
  add column case_type text not null default 'individual'
    check (case_type in ('individual', 'event', 'meal_delivery'));

alter table public.cases alter column id_number drop not null;

alter table public.cases drop constraint if exists cases_ngo_id_id_number_key;
create unique index cases_ngo_id_number_unique
  on public.cases (ngo_id, id_number)
  where id_number is not null;

-- Recreate the own-NGO masked view to expose case_type. CREATE OR REPLACE VIEW
-- keeps existing grants + the column-level REVOKE on id_number, but requires the
-- original columns to stay in the SAME order — so case_type is appended LAST.
create or replace view public.my_cases as
  select
    c.id,
    c.name,
    c.note,
    c.ngo_id,
    c.created_by_id,
    c.created_at,
    right(c.id_number, 4) as id_number_last4,
    c.case_type
  from public.cases c
  where c.ngo_id = public.current_user_ngo_id()
    and c.deleted_at is null;
