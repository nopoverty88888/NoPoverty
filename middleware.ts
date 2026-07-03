import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image files, so the
     * session is refreshed on every page/route navigation. The PWA assets
     * (manifest, service worker, Workbox runtime) must stay public — they are
     * fetched on /login before auth, so they are excluded here too; otherwise
     * the auth redirect would 307 them to /login and break install + SW.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|workbox-|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
