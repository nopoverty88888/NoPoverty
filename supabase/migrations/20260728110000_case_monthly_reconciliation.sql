-- =============================================================================
-- 個案月度核對 (未使用追蹤) — from the 2026-07-03 立心 meeting: NGOs want to see,
-- per case per month, how many vouchers were 發出 (assigned) vs 回收 (used), so
-- they can spot which cases did NOT use their allocation, and press a button to
-- confirm they've reviewed it. Confirmation is each org's responsibility (agreed
-- in the meeting); the system does not notify.
--
-- NOTE: this is visibility/record-keeping only. Per docs + CLAUDE.md the system
-- never tracks physical inventory, so 未使用 is NOT auto-deducted from any
-- settlement — that money rule is left to 立心 to decide.
-- =============================================================================

-- 1. Per (case, month) reconciliation. security_invoker so RLS on the underlying
--    tables scopes rows to the caller (立心 = all, NGO 代表 = own). unused_count =
--    assigned serials with no matching collection in the same month.
--    (Assumes the assigning + collecting rep are the same person / NGO, which is
--    the normal one-rep-per-NGO flow.)
create view public.case_monthly_reconciliation_view
with (security_invoker = true) as
  select
    va.case_id,
    c.name       as case_name,
    c.ngo_id,
    c.case_type,
    va.year_month,
    count(*)                              as assigned_count,
    count(vc.serial_number)               as collected_count,
    count(*) - count(vc.serial_number)    as unused_count
  from public.voucher_assignments va
  join public.cases c on c.id = va.case_id
  left join public.voucher_collections vc
    on vc.serial_number = va.serial_number
   and vc.year_month    = va.year_month
  group by va.case_id, c.name, c.ngo_id, c.case_type, va.year_month;

revoke all on public.case_monthly_reconciliation_view from anon;
grant select on public.case_monthly_reconciliation_view to authenticated;

-- 2. Confirmation record: a NGO 代表 has reviewed a case's usage for a month.
--    Snapshots the counts at confirmation time so the record is self-contained.
create table public.monthly_case_confirmations (
  id               uuid primary key default gen_random_uuid(),
  ngo_id           uuid not null references public.ngos(id),
  case_id          uuid not null references public.cases(id),
  year_month       text not null check (year_month ~ '^\d{4}-\d{2}$'),
  assigned_count   integer not null default 0 check (assigned_count >= 0),
  collected_count  integer not null default 0 check (collected_count >= 0),
  unused_count     integer not null default 0 check (unused_count >= 0),
  confirmed_by_id  uuid references public.users(id),
  confirmed_at     timestamptz not null default now(),
  unique (case_id, year_month)
);

create index idx_mcc_ngo_month
  on public.monthly_case_confirmations (ngo_id, year_month);

alter table public.monthly_case_confirmations enable row level security;

-- lixin read all; ngo_rep read/write own NGO (same pattern as cases/demands).
create policy "mcc_select_lixin" on public.monthly_case_confirmations
  for select to authenticated using (public.is_lixin());
create policy "mcc_rw_own" on public.monthly_case_confirmations
  for all to authenticated
  using (ngo_id = public.current_user_ngo_id())
  with check (ngo_id = public.current_user_ngo_id());

revoke all on public.monthly_case_confirmations from anon;
grant select, insert, update, delete
  on public.monthly_case_confirmations to authenticated;
