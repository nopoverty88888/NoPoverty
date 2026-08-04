/**
 * Renames the 立心 admin account's email (Auth user + public.users row) without
 * touching its password or role. Same Supabase project the app points at.
 *
 *   pnpm rename:admin                          # katherine84522@ → nopoverty88888@
 *   tsx scripts/rename-admin.ts OLD@x NEW@y     # explicit override
 *
 * Uses the service-role key (bypasses RLS).
 */
import { config } from "dotenv";
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

const OLD_EMAIL = (process.argv[2] ?? "katherine84522@gmail.com").trim();
const NEW_EMAIL = (process.argv[3] ?? "nopoverty88888@gmail.com").trim();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`Failed to list auth users: ${error.message}`);
  const match = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  return match?.id ?? null;
}

async function main(): Promise<void> {
  const id = await findUserIdByEmail(OLD_EMAIL);
  if (!id) throw new Error(`No Auth user found with email ${OLD_EMAIL}`);

  const taken = await findUserIdByEmail(NEW_EMAIL);
  if (taken && taken !== id) {
    throw new Error(`${NEW_EMAIL} is already used by another account`);
  }

  // 1. Auth user email (email_confirm so login isn't blocked by verification).
  const { error: authErr } = await admin.auth.admin.updateUserById(id, {
    email: NEW_EMAIL,
    email_confirm: true,
  });
  if (authErr) throw new Error(`Failed to update Auth email: ${authErr.message}`);

  // 2. public.users mirror row.
  const { error: rowErr } = await admin
    .from("users")
    .update({ email: NEW_EMAIL })
    .eq("id", id);
  if (rowErr) throw new Error(`Failed to update public.users: ${rowErr.message}`);

  console.log("──────────────────────────────────────────────");
  console.log(" 立心 admin email changed");
  console.log(`   was: ${OLD_EMAIL}`);
  console.log(`   now: ${NEW_EMAIL}`);
  console.log(`   id:  ${id}`);
  console.log("   password: unchanged");
  console.log("──────────────────────────────────────────────");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("\n✗ Rename failed:", message);
  process.exit(1);
});
