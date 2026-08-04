import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentYearMonth, isYearMonth } from "@/lib/schemas/demand";
import { MonthNav } from "@/components/shared/month-nav";
import { ReconcileManager, type ReconcileRow } from "./reconcile-manager";

/**
 * 月底未使用核對 — per case per month: how many vouchers were 發出 vs 已使用, and
 * how many went unused. The 代表 reviews and confirms (each org's responsibility,
 * agreed 2026-07-03). Visibility only; nothing is auto-deducted from settlement.
 */
export default async function ReconcilePage({
  searchParams,
}: {
  searchParams: { ym?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const currentMonth = currentYearMonth(new Date());
  const yearMonth =
    searchParams.ym && isYearMonth(searchParams.ym)
      ? searchParams.ym
      : currentMonth;
  const readOnly = yearMonth !== currentMonth;

  const [{ data: profile }, { data: reconRows }, { data: confRows }] =
    await Promise.all([
      supabase.from("users").select("ngo_id").eq("id", user.id).single(),
      supabase
        .from("case_monthly_reconciliation_view")
        .select(
          "case_id, case_name, case_type, assigned_count, collected_count, unused_count",
        )
        .eq("year_month", yearMonth),
      supabase
        .from("monthly_case_confirmations")
        .select("case_id, confirmed_at")
        .eq("year_month", yearMonth),
    ]);
  if (!profile) redirect("/login");

  const confirmedMap: Record<string, string> = {};
  for (const c of confRows ?? []) {
    if (c.case_id) confirmedMap[c.case_id] = c.confirmed_at;
  }

  const rows: ReconcileRow[] = (reconRows ?? [])
    .filter((r) => r.case_id !== null)
    .map((r) => ({
      caseId: r.case_id as string,
      caseName: r.case_name ?? "（個案）",
      caseType: r.case_type ?? "individual",
      assigned: r.assigned_count ?? 0,
      collected: r.collected_count ?? 0,
      unused: r.unused_count ?? 0,
    }))
    .sort(
      (a, b) => b.unused - a.unused || a.caseName.localeCompare(b.caseName),
    );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">未使用核對</h2>
        <p className="text-sm text-muted-foreground">
          核對每位個案本月發出與使用的張數，確認未使用情形。
        </p>
      </div>
      <MonthNav yearMonth={yearMonth} basePath="/reconcile" />
      {readOnly ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          歷史紀錄（{yearMonth}）· 唯讀
        </p>
      ) : null}
      <ReconcileManager
        key={yearMonth}
        ngoId={profile.ngo_id}
        userId={user.id}
        yearMonth={yearMonth}
        rows={rows}
        initialConfirmed={confirmedMap}
        readOnly={readOnly}
      />
    </section>
  );
}
