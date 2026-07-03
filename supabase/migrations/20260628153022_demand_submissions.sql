-- =============================================================================
-- 月度需求提交 (monthly demand submissions)
-- Records when an NGO "送出" its month's demands to 立心. One row per NGO per
-- month; 立心 reads all (to see who has/hasn't submitted), each NGO writes its
-- own. The demand quantities themselves stay in monthly_demands; this table is
-- the submit/notify marker.
-- =============================================================================

create table public.monthly_demand_submissions (
  id              uuid primary key default gen_random_uuid(),
  year_month      text not null check (year_month ~ '^\d{4}-\d{2}$'),
  ngo_id          uuid not null references public.ngos(id),
  submitted_by_id uuid references public.users(id),
  submitted_at    timestamptz not null default now(),
  unique (year_month, ngo_id)
);

create index idx_mds_year_month on public.monthly_demand_submissions (year_month);

alter table public.monthly_demand_submissions enable row level security;

-- 立心 reads all submissions; each NGO reads/writes only its own.
create policy "mds_select_lixin" on public.monthly_demand_submissions
  for select to authenticated using (public.is_lixin());
create policy "mds_rw_own" on public.monthly_demand_submissions
  for all to authenticated
  using (ngo_id = public.current_user_ngo_id())
  with check (ngo_id = public.current_user_ngo_id());

revoke all on public.monthly_demand_submissions from anon;
grant select, insert, update, delete on public.monthly_demand_submissions to authenticated;
