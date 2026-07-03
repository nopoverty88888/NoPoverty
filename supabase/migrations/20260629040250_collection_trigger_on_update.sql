-- =============================================================================
-- Close a compensation-tampering hole found in adversarial review.
-- compute_voucher_collection() only fired BEFORE INSERT, but RLS allows UPDATE,
-- so a rep could PATCH their own collection row to set is_cross_store=true and
-- inflate the NT$100-per-cross-store 補款 that 立心 pays them. Recompute on
-- UPDATE too — the function reads NEW.* and works unchanged, so any update is
-- re-derived authoritatively from voucher_assignments (the client value is
-- always overwritten). The UI only inserts/deletes, so nothing legitimate breaks.
-- =============================================================================

drop trigger if exists trg_compute_voucher_collection on public.voucher_collections;

create trigger trg_compute_voucher_collection
  before insert or update on public.voucher_collections
  for each row
  execute function public.compute_voucher_collection();
