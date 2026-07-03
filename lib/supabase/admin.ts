import "server-only";

import WebSocket from "ws";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

// supabase-js builds a realtime client that needs a global WebSocket; Node < 22
// has none. We never use realtime server-side, but the constructor requires it.
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

/**
 * Service-role Supabase client. BYPASSES Row-Level Security — use only in
 * trusted server code (admin Route Handlers, scripts). The `server-only`
 * import makes a build fail if this is ever imported into a Client Component,
 * preventing the service-role key from leaking into the browser bundle.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
