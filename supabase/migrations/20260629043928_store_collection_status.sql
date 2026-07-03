-- =============================================================================
-- 完成回收 (M8): marks a store's monthly collection as finished. This is the
-- signal the settlement generation (W5/W6) uses to know a rep is done collecting.
-- One row per (store, year_month); existence = completed.
-- =============================================================================

create table public.store_collection_status (
  id              uuid primary key default gen_random_uuid(),
  year_month      text not null check (year_month ~ '^\d{4}-\d{2}$'),
  store_id        uuid not null references public.stores(id),
  completed_by_id uuid references public.users(id),
  completed_at    timestamptz not null default now(),
  unique (year_month, store_id)
);

create index idx_scs_year_month on public.store_collection_status (year_month);

alter table public.store_collection_status enable row level security;

-- 立心 reads all; a rep reads/writes only their own stores' status.
create policy "scs_select_lixin" on public.store_collection_status
  for select to authenticated using (public.is_lixin());

create policy "scs_rw_own" on public.store_collection_status
  for all to authenticated
  using (
    store_id in (
      select id from public.stores where owner_ngo_rep_id = (select auth.uid())
    )
  )
  with check (
    store_id in (
      select id from public.stores where owner_ngo_rep_id = (select auth.uid())
    )
  );

revoke all on public.store_collection_status from anon;
grant select, insert, update, delete on public.store_collection_status to authenticated;
