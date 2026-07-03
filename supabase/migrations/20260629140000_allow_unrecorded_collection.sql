-- =============================================================================
-- 月底回收: allow recording a collection whose 流水號 has NO distribution record
-- in ANY NGO. Previously compute_voucher_collection() raised P0001 and blocked
-- the insert; in practice a store can present a real voucher that was never
-- logged at 發券, and the rep needs to record it anyway (the UI warns + asks the
-- rep to confirm by pressing 加入 again).
--
-- New behaviour: when no assignment is found, originally_assigned_* stay NULL and
-- is_cross_store = false, so the collection is recorded but accrues NO
-- compensation (we don't know an origin store). When an assignment IS found the
-- cross-store computation is unchanged. Still SECURITY DEFINER so the lookup
-- spans all NGOs regardless of the caller's RLS scope.
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

  -- v_store / v_case are NULL when the serial was never assigned (any NGO).
  new.originally_assigned_store_id := v_store;
  new.originally_assigned_case_id  := v_case;
  new.is_cross_store :=
    (v_store is not null and v_store is distinct from new.collected_at_store_id);
  return new;
end;
$$;
