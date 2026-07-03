import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./types";

/**
 * Server-side Supabase client for Server Components, Route Handlers and Server
 * Actions (anon key, RLS-scoped to the logged-in user via cookies).
 * Next.js 14: `cookies()` is synchronous.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component (cookies are read-only there) —
            // the session refresh is handled by middleware instead.
          }
        },
      },
    },
  );
}
