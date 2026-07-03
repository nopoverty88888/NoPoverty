-- =============================================================================
-- 萬華協力聯盟 · 待用券管理系統 — initial schema
-- 10 tables + 2 views, RLS enabled on every table.
-- See docs/data-model.md and docs/roles.md for the source of truth.
--
-- Deferred to later migrations (intentionally NOT here):
--   * is_cross_store computation trigger on voucher_collections
--   * settlement generation logic
--   * receipts Storage bucket + storage.objects policies
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tables  (created in FK-dependency order)
-- -----------------------------------------------------------------------------

-- NGO 單位 (e.g. 立心基金會、勵馨基金會). 立心建立.
create table public.ngos (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  contact_info  text,
  created_at    timestamptz not null default now()
);

-- 所有登入帳號. Mirrors auth.users; role + ngo_id are app-specific.
-- 立心 user: role='lixin' AND ngo_id -> 立心 NGO (dual identity).
create table public.users (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null unique,
  name           text not null,
  role           text not null check (role in ('lixin', 'ngo_rep')),
  ngo_id         uuid not null references public.ngos(id),
  created_at     timestamptz not null default now(),
  created_by_id  uuid references public.users(id)
);

-- 個案. NGO 代表自建. Soft delete. id_number = 身分證字號 (plaintext v1; TODO encrypt).
create table public.cases (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  id_number      text not null,
  ngo_id         uuid not null references public.ngos(id),
  created_by_id  uuid references public.users(id),
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (ngo_id, id_number)
);

-- 店家. NGO 代表自建. One store belongs to one NGO 代表 (no rotation). Soft delete.
create table public.stores (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  address           text,
  contact           text,
  owner_ngo_rep_id  uuid not null references public.users(id),
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

-- 月度需求表. NGO 代表每月填寫對各店家的需求量.
create table public.monthly_demands (
  id             uuid primary key default gen_random_uuid(),
  year_month     text not null check (year_month ~ '^\d{4}-\d{2}$'),
  ngo_id         uuid not null references public.ngos(id),
  store_id       uuid not null references public.stores(id),
  quantity       integer not null check (quantity >= 0),
  created_by_id  uuid references public.users(id),
  created_at     timestamptz not null default now(),
  unique (year_month, ngo_id, store_id)
);

-- 流水號發放紀錄 (第一次上傳). Source of truth for which store a voucher belongs to.
create table public.voucher_assignments (
  id              uuid primary key default gen_random_uuid(),
  serial_number   text not null check (serial_number ~ '^\d{5}$'),
  store_id        uuid not null references public.stores(id),
  case_id         uuid not null references public.cases(id),
  year_month      text not null check (year_month ~ '^\d{4}-\d{2}$'),
  assigned_by_id  uuid references public.users(id),
  assigned_at     timestamptz not null default now(),
  unique (year_month, serial_number)
);

-- 月底回收紀錄 (第二次上傳). is_cross_store/originally_* are computed at insert (later migration).
create table public.voucher_collections (
  id                            uuid primary key default gen_random_uuid(),
  serial_number                 text not null check (serial_number ~ '^\d{5}$'),
  collected_at_store_id         uuid not null references public.stores(id),
  year_month                    text not null check (year_month ~ '^\d{4}-\d{2}$'),
  scanned_by_id                 uuid references public.users(id),
  scanned_at                    timestamptz not null default now(),
  is_cross_store                boolean,
  originally_assigned_store_id  uuid references public.stores(id),
  originally_assigned_case_id   uuid references public.cases(id),
  unique (year_month, serial_number)
);

-- 立心月度結算單. One row per NGO 代表 per month. System-generated.
create table public.settlements (
  id                   uuid primary key default gen_random_uuid(),
  year_month           text not null check (year_month ~ '^\d{4}-\d{2}$'),
  ngo_rep_id           uuid not null references public.users(id),
  prepay_amount        integer not null default 0 check (prepay_amount >= 0),
  compensation_amount  integer not null default 0 check (compensation_amount >= 0),
  total_amount         integer not null default 0 check (total_amount >= 0),
  status               text not null default 'pending_review'
                         check (status in ('pending_review', 'approved', 'paid')),
  approved_by_id       uuid references public.users(id),
  approved_at          timestamptz,
  paid_at              timestamptz,
  unique (year_month, ngo_rep_id)
);

-- 結算單明細 (per store) — what each store should receive in cash.
create table public.settlement_store_breakdown (
  id                   uuid primary key default gen_random_uuid(),
  settlement_id        uuid not null references public.settlements(id) on delete cascade,
  store_id             uuid not null references public.stores(id),
  prepay_amount        integer not null default 0 check (prepay_amount >= 0),
  compensation_amount  integer not null default 0 check (compensation_amount >= 0),
  total_amount         integer not null default 0 check (total_amount >= 0),
  unique (settlement_id, store_id)
);

-- 收據上傳紀錄. NGO 代表 uploads; 立心 reads all + CRUD its own. Soft delete.
create table public.receipts (
  id             uuid primary key default gen_random_uuid(),
  photo_url      text not null,
  received_date  date not null,
  store_id       uuid not null references public.stores(id),
  ngo_rep_id     uuid not null references public.users(id),
  amount         integer not null check (amount >= 0),
  settlement_id  uuid references public.settlements(id),
  uploaded_at    timestamptz not null default now(),
  deleted_at     timestamptz
);

-- -----------------------------------------------------------------------------
-- 2. RLS helper functions
--    SECURITY DEFINER so they bypass RLS on public.users — this prevents
--    infinite recursion (policies on users can call these too) and avoids a
--    per-row RLS re-check. STABLE + locked search_path.
-- -----------------------------------------------------------------------------

create or replace function public.current_user_ngo_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ngo_id from public.users where id = (select auth.uid());
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.users where id = (select auth.uid());
$$;

create or replace function public.is_lixin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.users
    where id = (select auth.uid()) and role = 'lixin'
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. Indexes
--    (year_month,serial_number) / (year_month,ngo_rep_id) lookups are already
--    backed by the UNIQUE constraints above; below are the remaining hot paths
--    plus FK columns used by RLS ownership checks.
-- -----------------------------------------------------------------------------

create index idx_voucher_collections_store_month on public.voucher_collections (collected_at_store_id, year_month);
create index idx_receipts_settlement             on public.receipts (settlement_id);
create index idx_cases_ngo                        on public.cases (ngo_id);
create index idx_stores_owner                     on public.stores (owner_ngo_rep_id);
create index idx_monthly_demands_ngo              on public.monthly_demands (ngo_id);
create index idx_voucher_assignments_assigned_by  on public.voucher_assignments (assigned_by_id);
create index idx_voucher_collections_scanned_by   on public.voucher_collections (scanned_by_id);
create index idx_receipts_ngo_rep                 on public.receipts (ngo_rep_id);

-- -----------------------------------------------------------------------------
-- 4. Enable Row-Level Security on every table
-- -----------------------------------------------------------------------------

alter table public.ngos                        enable row level security;
alter table public.users                       enable row level security;
alter table public.cases                       enable row level security;
alter table public.stores                      enable row level security;
alter table public.monthly_demands             enable row level security;
alter table public.voucher_assignments         enable row level security;
alter table public.voucher_collections         enable row level security;
alter table public.settlements                 enable row level security;
alter table public.settlement_store_breakdown  enable row level security;
alter table public.receipts                    enable row level security;

-- -----------------------------------------------------------------------------
-- 5. Policies  (all TO authenticated; this app has no anonymous access)
--    Pattern: a "lixin reads all" SELECT policy + a single ownership FOR ALL
--    policy that serves BOTH roles. Because a 立心 user's ngo_id points to the
--    立心 NGO, the ownership policy lets them write only their own NGO's rows —
--    exactly matching docs/roles.md (lixin = read all + CRUD own).
-- -----------------------------------------------------------------------------

-- ngos: lixin CRUD all; ngo_rep read own only.
create policy "ngos_select" on public.ngos
  for select to authenticated
  using (public.is_lixin() or id = public.current_user_ngo_id());
create policy "ngos_lixin_write" on public.ngos
  for all to authenticated
  using (public.is_lixin()) with check (public.is_lixin());

-- users: lixin CRUD all; ngo_rep read self only.
create policy "users_select_self" on public.users
  for select to authenticated
  using (id = (select auth.uid()));
create policy "users_lixin_all" on public.users
  for all to authenticated
  using (public.is_lixin()) with check (public.is_lixin());

-- cases: lixin read all + CRUD own NGO; ngo_rep CRUD own NGO.
create policy "cases_select_lixin" on public.cases
  for select to authenticated using (public.is_lixin());
create policy "cases_rw_own" on public.cases
  for all to authenticated
  using (ngo_id = public.current_user_ngo_id())
  with check (ngo_id = public.current_user_ngo_id());

-- stores: lixin read all + CRUD own; ngo_rep CRUD own (owner).
create policy "stores_select_lixin" on public.stores
  for select to authenticated using (public.is_lixin());
create policy "stores_rw_own" on public.stores
  for all to authenticated
  using (owner_ngo_rep_id = (select auth.uid()))
  with check (owner_ngo_rep_id = (select auth.uid()));

-- monthly_demands: lixin read all + CRUD own NGO; ngo_rep CRUD own NGO.
create policy "monthly_demands_select_lixin" on public.monthly_demands
  for select to authenticated using (public.is_lixin());
create policy "monthly_demands_rw_own" on public.monthly_demands
  for all to authenticated
  using (ngo_id = public.current_user_ngo_id())
  with check (ngo_id = public.current_user_ngo_id());

-- voucher_assignments: lixin read all + CRUD own; ngo_rep CRUD own.
create policy "voucher_assignments_select_lixin" on public.voucher_assignments
  for select to authenticated using (public.is_lixin());
create policy "voucher_assignments_rw_own" on public.voucher_assignments
  for all to authenticated
  using (assigned_by_id = (select auth.uid()))
  with check (assigned_by_id = (select auth.uid()));

-- voucher_collections: lixin read all + CRUD own; ngo_rep CRUD own.
create policy "voucher_collections_select_lixin" on public.voucher_collections
  for select to authenticated using (public.is_lixin());
create policy "voucher_collections_rw_own" on public.voucher_collections
  for all to authenticated
  using (scanned_by_id = (select auth.uid()))
  with check (scanned_by_id = (select auth.uid()));

-- settlements: lixin read all + write (generate / approve / mark paid);
-- ngo_rep read own only (read-only).
create policy "settlements_select" on public.settlements
  for select to authenticated
  using (public.is_lixin() or ngo_rep_id = (select auth.uid()));
create policy "settlements_lixin_write" on public.settlements
  for all to authenticated
  using (public.is_lixin()) with check (public.is_lixin());

-- settlement_store_breakdown: lixin read all + write; ngo_rep read where the
-- parent settlement is theirs.
create policy "ssb_select" on public.settlement_store_breakdown
  for select to authenticated
  using (
    public.is_lixin()
    or exists (
      select 1 from public.settlements s
      where s.id = settlement_id and s.ngo_rep_id = (select auth.uid())
    )
  );
create policy "ssb_lixin_write" on public.settlement_store_breakdown
  for all to authenticated
  using (public.is_lixin()) with check (public.is_lixin());

-- receipts: lixin read all + CRUD own; ngo_rep CRUD own.
create policy "receipts_select_lixin" on public.receipts
  for select to authenticated using (public.is_lixin());
create policy "receipts_rw_own" on public.receipts
  for all to authenticated
  using (ngo_rep_id = (select auth.uid()))
  with check (ngo_rep_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 6. Computed views  (security_invoker so the querying user's RLS applies —
--    without this a NGO 代表 could read every NGO's data through the view)
-- -----------------------------------------------------------------------------

-- 個案使用紀錄表 (新功能 1)
create view public.case_usage_view
with (security_invoker = true) as
  select
    c.id            as case_id,
    c.name          as case_name,
    c.ngo_id,
    s.name          as used_at_store_name,
    vc.serial_number,
    vc.year_month,
    vc.scanned_at
  from public.voucher_collections vc
  join public.voucher_assignments va
    on vc.serial_number = va.serial_number
   and vc.year_month   = va.year_month
  join public.cases  c on va.case_id = c.id
  join public.stores s on vc.collected_at_store_id = s.id;

-- 店家月度收券摘要
create view public.store_monthly_summary_view
with (security_invoker = true) as
  select
    s.id    as store_id,
    s.name  as store_name,
    vc.year_month,
    count(*)                                        as total_vouchers_received,
    count(*) filter (where vc.is_cross_store)       as cross_store_count,
    count(*) filter (where vc.is_cross_store) * 100 as compensation_owed
  from public.voucher_collections vc
  join public.stores s on vc.collected_at_store_id = s.id
  group by s.id, s.name, vc.year_month;

-- -----------------------------------------------------------------------------
-- 7. Grants  (no anonymous access; authenticated DML is still gated by RLS)
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Helper functions: EXECUTE defaults to PUBLIC, so lock down then expose
-- only to authenticated users (defense-in-depth).
revoke execute on function public.current_user_ngo_id() from public;
revoke execute on function public.current_user_role()   from public;
revoke execute on function public.is_lixin()            from public;
grant execute on function public.current_user_ngo_id() to authenticated;
grant execute on function public.current_user_role()   to authenticated;
grant execute on function public.is_lixin()            to authenticated;
