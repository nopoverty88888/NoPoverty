-- =============================================================================
-- Tighten voucher_assignments write policy.
-- Previously WITH CHECK only verified assigned_by_id = auth.uid(), so a crafted
-- client could attach a serial to ANOTHER NGO's store/case (FK checks only
-- prove existence, and run with elevated privilege bypassing RLS). Since
-- voucher_assignments is the per-month compensation source-of-truth, require
-- that the store and case both belong to the writer's own NGO.
--
-- The subqueries filter explicitly (owner_ngo_rep_id / ngo_id), so they stay
-- own-scoped even for 立心 (whose read-all RLS would otherwise widen them).
-- =============================================================================

drop policy "voucher_assignments_rw_own" on public.voucher_assignments;

create policy "voucher_assignments_rw_own" on public.voucher_assignments
  for all to authenticated
  using (assigned_by_id = (select auth.uid()))
  with check (
    assigned_by_id = (select auth.uid())
    and store_id in (
      select id from public.stores
      where owner_ngo_rep_id = (select auth.uid())
    )
    and case_id in (
      select id from public.cases
      where ngo_id = public.current_user_ngo_id()
    )
  );
