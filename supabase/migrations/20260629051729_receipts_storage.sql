-- =============================================================================
-- 收據 (M9/W7): private Storage bucket for receipt photos + access policies.
-- Path convention: '{auth.uid}/{uuid}.{ext}' so the first folder = the owner.
-- A rep may upload/read/delete only their own folder; 立心 may read all (W7).
-- Also tighten the receipts table write policy to the rep's own stores.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_obj_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "receipts_obj_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_lixin()
    )
  );

create policy "receipts_obj_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Tighten the receipts table: a rep may only write receipts for their own stores
-- (mirrors the voucher_assignments / voucher_collections ownership fixes).
drop policy "receipts_rw_own" on public.receipts;

create policy "receipts_rw_own" on public.receipts
  for all to authenticated
  using (ngo_rep_id = (select auth.uid()))
  with check (
    ngo_rep_id = (select auth.uid())
    and store_id in (
      select id from public.stores where owner_ngo_rep_id = (select auth.uid())
    )
  );
