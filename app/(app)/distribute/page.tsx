import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentYearMonth } from "@/lib/schemas/demand";
import {
  DistributeManager,
  type StoreOption,
  type CaseOption,
  type Assignment,
} from "./distribute-manager";

export default async function DistributePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const yearMonth = currentYearMonth(new Date());

  const [
    { data: storeRows },
    { data: caseRows },
    { data: assignmentRows },
    { data: monthRows },
  ] = await Promise.all([
    supabase
      .from("stores")
      .select("id, name")
      .eq("owner_ngo_rep_id", user.id)
      .is("deleted_at", null)
      .order("name"),
    supabase.from("my_cases").select("id, name").order("name"),
    supabase
      .from("voucher_assignments")
      .select("serial_number, store_id, case_id, assigned_at")
      .eq("year_month", yearMonth),
    // Distinct months that have 發券 records (for the history filter).
    supabase.from("voucher_assignments").select("year_month"),
  ]);

  const stores: StoreOption[] = (storeRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
  }));
  const cases: CaseOption[] = (caseRows ?? [])
    .filter((c) => c.id !== null && c.name !== null)
    .map((c) => ({ id: c.id as string, name: c.name as string }));
  const initialAssignments: Assignment[] = (assignmentRows ?? []).map((a) => ({
    serial: a.serial_number,
    storeId: a.store_id,
    caseId: a.case_id,
    assignedAt: a.assigned_at,
  }));

  // Months with records + always the current month, newest first.
  const monthSet = new Set((monthRows ?? []).map((m) => m.year_month));
  monthSet.add(yearMonth);
  const availableMonths = Array.from(monthSet).sort().reverse();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">發券給個案</h2>
        <p className="text-sm text-muted-foreground">
          月份 {yearMonth} · 記錄你發出的待用券（哪些流水號給了哪位個案）。邊發邊記，會即時存檔，不需另外送出。
        </p>
      </div>
      <DistributeManager
        userId={user.id}
        yearMonth={yearMonth}
        stores={stores}
        cases={cases}
        initialAssignments={initialAssignments}
        availableMonths={availableMonths}
      />
    </section>
  );
}
