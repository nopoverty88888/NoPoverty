-- =============================================================================
-- 個案 (cases): add 備註 (note), and lock down 身分證字號 (id_number) so it is
-- visible ONLY to the owning NGO.
--
-- Requirement: even 立心 (global admin) must NOT see another NGO's id_number,
-- and no NGO may see another NGO's id_number. Since 立心 is not a separate
-- Postgres role (every logged-in user is the `authenticated` role; the app role
-- lives in public.users.role), a column-level REVOKE on `authenticated` covers
-- 立心 too. The owning NGO reads only the masked last-4 via the `my_cases` view.
-- =============================================================================

-- 1. 備註 (note)
alter table public.cases add column note text;

-- 2. No client may SELECT the raw id_number column. INSERT/UPDATE on it stay
--    granted (still gated by the cases RLS WITH CHECK to the writer's own NGO),
--    so creating a case keeps working. The full value is therefore write-only
--    from any client's perspective.
revoke select (id_number) on public.cases from authenticated;

-- 3. Own-NGO case list with a MASKED id (last 4 only). A plain (SECURITY DEFINER)
--    view owned by postgres: it may compute right(id_number, 4), but its WHERE
--    clause scopes every row to the caller's own NGO via current_user_ngo_id(),
--    so no caller can reach another NGO's rows — and the full id_number is never
--    selected by anyone. Soft-deleted rows are excluded.
create view public.my_cases as
  select
    c.id,
    c.name,
    c.note,
    c.ngo_id,
    c.created_by_id,
    c.created_at,
    right(c.id_number, 4) as id_number_last4
  from public.cases c
  where c.ngo_id = public.current_user_ngo_id()
    and c.deleted_at is null;

revoke all on public.my_cases from anon;
grant select on public.my_cases to authenticated;
