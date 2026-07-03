-- =============================================================================
-- 月底回收: let the collecting rep DECLARE 本店券/他店券 per voucher (they can tell
-- by looking at the physical voucher). Previously compute_voucher_collection()
-- always overwrote is_cross_store from the 發券 (voucher_assignments) log; now it
-- RESPECTS a client-provided is_cross_store and only auto-computes when it's left
-- NULL (backward compatible). The assignment origin is still recorded
-- (originally_assigned_*) for 立心 audit / discrepancy review.
--
-- Trade-off: is_cross_store is no longer tamper-proof server-side. That's
-- intentional — the rep classifies their own collections and 立心 reviews the
-- settlement (W5/W6) before paying. The originally_assigned_* columns let 立心
-- spot a declaration that disagrees with the distribution log.
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

  -- Audit: what 發券 recorded (may be NULL if never distributed).
  new.originally_assigned_store_id := v_store;
  new.originally_assigned_case_id  := v_case;

  -- Respect the rep's declaration; only auto-compute when not provided.
  if new.is_cross_store is null then
    new.is_cross_store :=
      (v_store is not null and v_store is distinct from new.collected_at_store_id);
  end if;

  return new;
end;
$$;
