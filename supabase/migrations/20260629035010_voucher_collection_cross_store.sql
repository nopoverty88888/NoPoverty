-- =============================================================================
-- 月底回收 (voucher_collections / STEP 4): compute is_cross_store authoritatively.
--
-- On insert, look up the serial's original assignment (voucher_assignments) and
-- set originally_assigned_store_id / originally_assigned_case_id and
-- is_cross_store = (assigned store != the store it was collected at). Computed
-- in the DB (not the client) so the compensation source-of-truth can't be
-- tampered with. SECURITY DEFINER so the lookup isn't limited by RLS (and is
-- future-proof for cross-NGO). If the serial was never assigned this month, the
-- insert is rejected ("未發放紀錄").
-- =============================================================================

create or replace function public.compute_voucher_collection()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store uuid;
  v_case  uuid;
begin
  select store_id, case_id
    into v_store, v_case
    from public.voucher_assignments
   where year_month = new.year_month
     and serial_number = new.serial_number;

  if v_store is null then
    raise exception '此流水號（%）本月無發放紀錄', new.serial_number
      using errcode = 'P0001';
  end if;

  new.originally_assigned_store_id := v_store;
  new.originally_assigned_case_id  := v_case;
  new.is_cross_store := (v_store is distinct from new.collected_at_store_id);
  return new;
end;
$$;

create trigger trg_compute_voucher_collection
  before insert on public.voucher_collections
  for each row
  execute function public.compute_voucher_collection();

-- Tighten the write policy: a rep may only record collections at THEIR OWN store
-- (mirrors the voucher_assignments ownership fix). originally_* / is_cross_store
-- are set by the trigger above, so they need no client-side RLS guard.
drop policy "voucher_collections_rw_own" on public.voucher_collections;

create policy "voucher_collections_rw_own" on public.voucher_collections
  for all to authenticated
  using (scanned_by_id = (select auth.uid()))
  with check (
    scanned_by_id = (select auth.uid())
    and collected_at_store_id in (
      select id from public.stores
      where owner_ngo_rep_id = (select auth.uid())
    )
  );
