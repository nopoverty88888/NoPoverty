/**
 * Seeds the first 立心 (Lixin Foundation) admin account against the remote
 * Supabase project. Run AFTER the schema migration has been pushed:
 *
 *   pnpm seed:admin                       # create if missing (no-op if exists)
 *   pnpm reset:admin                      # also reset the password (random)
 *   ADMIN_PASSWORD='your-pass' pnpm reset:admin   # set a known password
 *
 * Uses the service-role key (bypasses RLS) to:
 *   1. ensure the 立心基金會 NGO row exists (fixed UUID),
 *   2. create the admin Auth user, or reset its password when --reset is passed,
 *   3. upsert the matching public.users row with role='lixin'.
 *
 * Idempotent. Prints a generated password ONCE (unless you supplied one via
 * ADMIN_PASSWORD). Always (re)confirms the email so login isn't blocked.
 */
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

// @supabase/supabase-js constructs a realtime client that needs a global
// WebSocket. Node < 22 has none, so polyfill it. (This script never uses
// realtime — it only needs the constructor not to throw.)
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

const LIXIN_NGO_ID = "00000000-0000-0000-0000-000000000001";
const LIXIN_NGO_NAME = "立心基金會";
const ADMIN_EMAIL = "katherine84522@gmail.com";
const ADMIN_NAME = "立心管理員";

// Options: `--reset` resets an existing user's password; ADMIN_PASSWORD lets
// you pick a known password (avoids copy-paste errors) instead of a random one.
const SHOULD_RESET = process.argv.includes("--reset");
const EXPLICIT_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || null;

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

function generatePassword(): string {
  // 24 url-safe chars — strong one-time initial password.
  return randomBytes(18).toString("base64url");
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`Failed to list auth users: ${error.message}`);
  const match = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  return match?.id ?? null;
}

async function main(): Promise<void> {
  // 1. Ensure the 立心 NGO exists.
  const { error: ngoErr } = await admin
    .from("ngos")
    .upsert({ id: LIXIN_NGO_ID, name: LIXIN_NGO_NAME }, { onConflict: "id" });
  if (ngoErr) throw new Error(`Failed to upsert 立心 NGO: ${ngoErr.message}`);
  console.log(`✓ 立心基金會 NGO ready (${LIXIN_NGO_ID})`);

  // 2. Create the admin Auth user, or reset its password when --reset is passed.
  let userId: string;
  let passwordToShow: string | null = null; // set => print it
  let passwordIsExplicit = false;

  const existingId = await findUserIdByEmail(ADMIN_EMAIL);
  if (existingId) {
    userId = existingId;
    if (SHOULD_RESET) {
      const password = EXPLICIT_PASSWORD ?? generatePassword();
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (error) throw new Error(`Failed to reset password: ${error.message}`);
      passwordToShow = password;
      passwordIsExplicit = EXPLICIT_PASSWORD !== null;
      console.log(`✓ Reset password for existing Auth user (${userId})`);
    } else {
      console.log(
        `✓ Auth user already exists (${userId}) — pass --reset to set a new password`,
      );
    }
  } else {
    const password = EXPLICIT_PASSWORD ?? generatePassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { name: ADMIN_NAME },
    });
    if (error || !data.user) {
      throw new Error(`Failed to create auth user: ${error?.message ?? "no user returned"}`);
    }
    userId = data.user.id;
    passwordToShow = password;
    passwordIsExplicit = EXPLICIT_PASSWORD !== null;
    console.log(`✓ Created Auth user ${ADMIN_EMAIL} (${userId})`);
  }

  // 3. Upsert the public.users row (role=lixin, ngo_id -> 立心).
  const { error: userErr } = await admin.from("users").upsert(
    {
      id: userId,
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: "lixin",
      ngo_id: LIXIN_NGO_ID,
    },
    { onConflict: "id" },
  );
  if (userErr) throw new Error(`Failed to upsert public.users: ${userErr.message}`);
  console.log("✓ public.users row ready (role=lixin)");

  console.log("\n──────────────────────────────────────────────");
  console.log(" 立心 admin seed complete");
  console.log(`   email:    ${ADMIN_EMAIL}`);
  if (passwordToShow && !passwordIsExplicit) {
    console.log(`   password: ${passwordToShow}`);
    console.log("   ^ shown ONCE — copy it now, then change it after first login.");
  } else if (passwordToShow && passwordIsExplicit) {
    console.log("   password: (set to the ADMIN_PASSWORD you provided)");
  } else {
    console.log("   password: (unchanged — run with --reset to set a new one)");
  }
  console.log("──────────────────────────────────────────────");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("\n✗ Seed failed:", message);
  process.exit(1);
});
