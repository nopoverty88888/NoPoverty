-- Seed the 立心基金會 NGO with a fixed UUID so other code can reference it.
-- Idempotent: safe to run repeatedly and on `supabase db reset`.
--
-- NOTE: the first 立心 admin AUTH account (auth.users + password) is created by
-- `scripts/seed-admin.ts` using the service-role key — auth users cannot be
-- seeded reliably from raw SQL, and `supabase db push` does not run this file.
-- That script also upserts this same NGO row, so the remote path is covered too.

insert into public.ngos (id, name, contact_info)
values ('00000000-0000-0000-0000-000000000001', '立心基金會', null)
on conflict (id) do nothing;
