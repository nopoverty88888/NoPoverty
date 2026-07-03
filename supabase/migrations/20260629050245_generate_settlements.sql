-- =============================================================================
-- Settlement generation (W5/W6). 立心 runs this for a month M; it (re)builds
-- one settlement per NGO 代表 (= per NGO, one account each) plus the per-store
-- breakdown:
--   prepay_amount       = Σ stores' demand for NEXT month (M+1) × 100  ("下月預付")
--   compensation_amount = Σ 他店券 collected at the rep's stores in M  × 100
--   total_amount        = prepay + compensation
-- Computed in SQL (SECURITY DEFINER) so the figures 立心 pays can't be fudged
-- client-side. Re-runnable: already-PAID settlements are left untouched; others
-- are recomputed and reset to 'pending_review'.
-- =============================================================================

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

  -- Per-store amounts for the cycle (prepay from M+1 demand, compensation from
  -- this month's cross-store collections).
  create temporary table _store_amt on commit drop as
  select
    s.id                                  as store_id,
    s.owner_ngo_rep_id                    as rep_id,
    coalesce(md.quantity, 0) * 100        as prepay_amount,
    coalesce(cc.cross_count, 0) * 100     as compensation_amount
  from public.stores s
  left join public.monthly_demands md
    on md.store_id = s.id and md.year_month = v_next
  left join (
    select collected_at_store_id, count(*) as cross_count
    from public.voucher_collections
    where year_month = p_year_month and is_cross_store
    group by collected_at_store_id
  ) cc on cc.collected_at_store_id = s.id
  where s.deleted_at is null;

  -- One settlement per rep (skip those already paid).
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

  -- Rebuild the per-store breakdown for this month's non-paid settlements.
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

revoke all on function public.generate_settlements(text) from public;
grant execute on function public.generate_settlements(text) to authenticated;
