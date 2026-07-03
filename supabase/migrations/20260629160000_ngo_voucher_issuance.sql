-- =============================================================================
-- 立心 發券給 NGO：after an NGO submits its monthly demand, 立心 hands that NGO the
-- physical vouchers, then marks 「已發券」 here. One row per (year_month, ngo_id);
-- existence = 立心 has issued this NGO's vouchers for the month. Mirrors the
-- monthly_demand_submissions marker pattern. (The NGO → 個案 distribution is the
-- separate /distribute ledger; this is the upstream 立心 → NGO step.)
-- =============================================================================

create table public.monthly_voucher_issuances (
  id            uuid primary key default gen_random_uuid(),
  year_month    text not null check (year_month ~ '^\d{4}-\d{2}$'),
  ngo_id        uuid not null references public.ngos(id),
  issued_by_id  uuid references public.users(id),
  issued_at     timestamptz not null default now(),
  unique (year_month, ngo_id)
);

create index idx_mvi_year_month on public.monthly_voucher_issuances (year_month);

alter table public.monthly_voucher_issuances enable row level security;

-- 立心 CRUD all; each NGO may read its own row (to know 立心 has issued to them).
create policy "mvi_select" on public.monthly_voucher_issuances
  for select to authenticated
  using (public.is_lixin() or ngo_id = public.current_user_ngo_id());
create policy "mvi_lixin_write" on public.monthly_voucher_issuances
  for all to authenticated
  using (public.is_lixin()) with check (public.is_lixin());

revoke all on public.monthly_voucher_issuances from anon;
grant select, insert, update, delete on public.monthly_voucher_issuances to authenticated;
