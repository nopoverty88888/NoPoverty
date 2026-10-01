/**
 * Authorization check for Vercel Cron invocations.
 *
 * When the `CRON_SECRET` environment variable is set on the Vercel project,
 * every scheduled invocation carries `Authorization: Bearer <CRON_SECRET>`.
 * Anything else (no secret configured, missing header, wrong value) is
 * rejected so cron endpoints can't be hammered by strangers.
 */
export function isAuthorizedCronRequest(
  authorizationHeader: string | null,
  cronSecret: string | undefined,
): boolean {
  if (!cronSecret) return false;
  return authorizationHeader === `Bearer ${cronSecret}`;
}
