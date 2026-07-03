-- =============================================================================
-- Harden settlement generation (adversarial-review fixes).
--
-- (1) BLOCKER: monthly_demands write policy only checked ngo_id, not that the
--     store belongs to the writer. A rep could insert a demand for ANOTHER
--     NGO's store; because UNIQUE is (year_month, ngo_id, store_id), two demand
--     rows for one store became possible — double-counting prepay and (via the
--     old JOIN) producing a duplicate breakdown row that violates the
--     (settlement_id, store_id) unique constraint and crashes the whole run.
--     Fix: require store_id ∈ own stores.
--
-- (2) generate_settlements rewritten with SCOPED SCALAR SUBQUERIES (at most one
--     demand per store, matched to the store-owner's NGO) so a stray demand can
--     never double-count; include soft-deleted stores that still have month-M
--     collections or month-(M+1) demand (so owed compensation isn't dropped);
--     and zero out any non-paid settlement whose rep no longer contributes, so
--     total_amount always equals Σ(breakdown.total_amount).
-- =============================================================================

drop policy "monthly_demands_rw_own" on public.monthly_demands;

create policy "monthly_demands_rw_own" on public.monthly_demands
  for all to authenticated
  using (ngo_id = public.current_user_ngo_id())
  with check (
    ngo_id = public.current_user_ngo_id()
    and store_id in (
      select id from public.stores where owner_ngo_rep_id = (select auth.uid())
    )
  );

create or replace function public.generate_settlements(p_year_month text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next  text;
  v_count integer;
begin
  if not public.is_lixin() then
    raise exception '僅限立心可產生結算單' using errcode = 'P0001';
  end if;
  if p_year_month !~ '^\d{4}-\d{2}$' then
    raise exception 'year_month 格式錯誤: %', p_year_month using errcode = 'P0001';
  end if;

  v_next := to_char(
    to_date(p_year_month || '-01', 'YYYY-MM-DD') + interval '1 month',
    'YYYY-MM'
  );

  -- One row per store (scalar subqueries => no double counting). Include stores
  -- that are active OR have this-cycle financial activity even if soft-deleted.
  create temporary table _store_amt on commit drop as
  select
    s.id               as store_id,
    s.owner_ngo_rep_id as rep_id,
    coalesce((
      select md.quantity
      from public.monthly_demands md
      join public.users u on u.id = s.owner_ngo_rep_id
      where md.store_id = s.id
        and md.year_month = v_next
        and md.ngo_id = u.ngo_id
    ), 0) * 100 as prepay_amount,
    coalesce((
      select count(*)
      from public.voucher_collections vc
      where vc.collected_at_store_id = s.id
        and vc.year_month = p_year_month
        and vc.is_cross_store
    ), 0) * 100 as compensation_amount
  from public.stores s
  where s.deleted_at is null
     or exists (
       select 1 from public.voucher_collections vc
       where vc.collected_at_store_id = s.id and vc.year_month = p_year_month
     )
     or exists (
       select 1 from public.monthly_demands md
       where md.store_id = s.id and md.year_month = v_next
     );

  insert into public.settlements (
    year_month, ngo_rep_id, prepay_amount, compensation_amount, total_amount, status
  )
  select
    p_year_month,
    rep_id,
    sum(prepay_amount),
    sum(compensation_amount),
    sum(prepay_amount) + sum(compensation_amount),
    'pending_review'
  from _store_amt
  group by rep_id
  on conflict (year_month, ngo_rep_id) do update set
    prepay_amount       = excluded.prepay_amount,
    compensation_amount = excluded.compensation_amount,
    total_amount        = excluded.total_amount,
    status              = 'pending_review',
    approved_by_id      = null,
    approved_at         = null
  where public.settlements.status <> 'paid';

  get diagnostics v_count = row_count;

  -- Orphans: non-paid settlements whose rep no longer contributes → zero out so
  -- total_amount stays consistent with the (about-to-be-empty) breakdown.
  update public.settlements st set
    prepay_amount       = 0,
    compensation_amount = 0,
    total_amount        = 0,
    status              = 'pending_review',
    approved_by_id      = null,
    approved_at         = null
  where st.year_month = p_year_month
    and st.status <> 'paid'
    and not exists (select 1 from _store_amt a where a.rep_id = st.ngo_rep_id);

  -- Rebuild breakdown for this month's non-paid settlements.
  delete from public.settlement_store_breakdown b
  using public.settlements st
  where b.settlement_id = st.id
    and st.year_month = p_year_month
    and st.status <> 'paid';

  insert into public.settlement_store_breakdown (
    settlement_id, store_id, prepay_amount, compensation_amount, total_amount
  )
  select
    st.id, a.store_id, a.prepay_amount, a.compensation_amount,
    a.prepay_amount + a.compensation_amount
  from _store_amt a
  join public.settlements st
    on st.year_month = p_year_month
   and st.ngo_rep_id = a.rep_id
   and st.status <> 'paid';

  return v_count;
end;
$$;
