import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

/** Browser/Client-Component Supabase client (anon key, RLS-scoped to the user). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
