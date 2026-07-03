import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentYearMonth, isYearMonth } from "@/lib/schemas/demand";
import { computeSettlements } from "@/lib/business/compute-settlement";
import { formatNT } from "@/lib/settlement";
import { MonthNav } from "@/components/shared/month-nav";
import { CsvButton } from "@/components/shared/csv-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  label: string;
  demand: number;
  prepay: number;
  comp: number;
  total: number;
  paid: boolean;
};

export default async function ReportsSettlementPage({
  searchParams,
}: {
  searchParams: { ym?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const yearMonth =
    searchParams.ym && isYearMonth(searchParams.ym)
      ? searchParams.ym
      : currentYearMonth(new Date());

  const [
    { data: me },
    settlements,
    { data: demandRows },
    { data: statusRows },
    { data: paidRows },
  ] = await Promise.all([
    supabase.from("users").select("role").eq("id", user.id).single(),
    // Live per-NGO settlement (下月預付 + 本月他店補款), RLS-scoped.
    computeSettlements(supabase, yearMonth),
    // This month's demand per store (the 本月需求 column).
    supabase
      .from("monthly_demands")
      .select("store_id, quantity")
      .eq("year_month", yearMonth),
    // 立心→NGO paid status.
    supabase
      .from("settlements")
      .select("ngo_rep_id, status")
      .eq("year_month", yearMonth),
    // NGO→store paid status (「已付款給店家」).
    supabase
      .from("store_collection_status")
      .select("store_id")
      .eq("year_month", yearMonth),
  ]);

  const isLixin = me?.role === "lixin";
  const demandByStore = new Map<string, number>();
  for (const d of demandRows ?? []) demandByStore.set(d.store_id, d.quantity);
  const paidStores = new Set((paidRows ?? []).map((r) => r.store_id));
  const paidReps = new Set(
    (statusRows ?? []).filter((s) => s.status === "paid").map((s) => s.ngo_rep_id),
  );

  const labelHeader = isLixin ? "NGO" : "店家";
  let rows: Row[];
  if (isLixin) {
    // One row per NGO; 本月需求 summed over the NGO's stores.
    rows = settlements
      .map((s) => ({
        label: s.ngoName,
        demand: s.stores.reduce(
          (sum, st) => sum + (demandByStore.get(st.storeId) ?? 0),
          0,
        ),
        prepay: s.prepay,
        comp: s.compensation,
        total: s.total,
        paid: paidReps.has(s.repId),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } else {
    // One row per store for the rep's own NGO.
    const own = settlements.find((s) => s.repId === user.id);
    rows = (own?.stores ?? [])
      .map((st) => ({
        label: st.storeName,
        demand: demandByStore.get(st.storeId) ?? 0,
        prepay: st.prepay,
        comp: st.compensation,
        total: st.total,
        paid: paidStores.has(st.storeId),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  const totals = rows.reduce(
    (acc, r) => ({
      demand: acc.demand + r.demand,
      prepay: acc.prepay + r.prepay,
      comp: acc.comp + r.comp,
      total: acc.total + r.total,
    }),
    { demand: 0, prepay: 0, comp: 0, total: 0 },
  );

  const csvRows = rows.map((r) => ({
    [labelHeader]: r.label,
    本月需求: r.demand,
    下月預付: r.prepay,
    本月補款: r.comp,
    應付合計: r.total,
    狀態: r.paid ? "已付款" : "未付款",
  }));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">月度結算</h2>
          <p className="text-sm text-muted-foreground">
            {isLixin
              ? "各 NGO 本月需求與應付款（下月預付 + 本月他店補款）"
              : "各店家本月需求與應付款（下月預付 + 本月他店補款）"}
          </p>
        </div>
        {rows.length > 0 ? (
          <CsvButton filename={`月度結算_${yearMonth}.csv`} rows={csvRows} />
        ) : null}
      </div>
      <MonthNav yearMonth={yearMonth} basePath="/reports/settlement" />

      {rows.length === 0 ? (
        <p className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {yearMonth} 尚無結算資料。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="本月需求" value={`${totals.demand} 張`} />
            <Stat label="下月預付款" value={formatNT(totals.prepay)} />
            <Stat label="本月補款" value={formatNT(totals.comp)} />
            <Stat label="應付總額" value={formatNT(totals.total)} emphasis />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isLixin ? "各 NGO 應付款" : "各店家應付款"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{labelHeader}</TableHead>
                    <TableHead className="text-right">本月需求</TableHead>
                    <TableHead className="text-right">下月預付</TableHead>
                    <TableHead className="text-right">本月補款</TableHead>
                    <TableHead className="text-right">應付合計</TableHead>
                    <TableHead>狀態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={`${r.label}-${i}`}>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell className="text-right">{r.demand} 張</TableCell>
                      <TableCell className="text-right">
                        {formatNT(r.prepay)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNT(r.comp)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNT(r.total)}
                      </TableCell>
                      <TableCell>
                        {r.paid ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            已付款
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            未付款
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={emphasis ? "text-lg font-semibold" : "text-lg"}>{value}</p>
    </div>
  );
}
