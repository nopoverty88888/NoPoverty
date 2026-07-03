import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentYearMonth, isYearMonth } from "@/lib/schemas/demand";
import { formatNT } from "@/lib/settlement";
import { MonthNav } from "@/components/shared/month-nav";
import { CsvButton } from "@/components/shared/csv-button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ReportsStoresPage({
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

  const [{ data: me }, { data: summary }] = await Promise.all([
    supabase.from("users").select("role").eq("id", user.id).single(),
    supabase
      .from("store_monthly_summary_view")
      .select(
        "store_name, total_vouchers_received, cross_store_count, compensation_owed",
      )
      .eq("year_month", yearMonth),
  ]);
  const scope = me?.role === "lixin" ? "全部 NGO" : "我的 NGO";

  const rows = (summary ?? [])
    .map((s) => ({
      store: s.store_name ?? "",
      total: Number(s.total_vouchers_received ?? 0),
      cross: Number(s.cross_store_count ?? 0),
      comp: Number(s.compensation_owed ?? 0),
    }))
    .sort((a, b) => a.store.localeCompare(b.store));
  const csvRows = rows.map((r) => ({
    店家: r.store,
    收券數: r.total,
    他店券: r.cross,
    補款: r.comp,
  }));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">店家月度收券摘要</h2>
          <p className="text-sm text-muted-foreground">檢視範圍：{scope}</p>
        </div>
        {rows.length > 0 ? (
          <CsvButton filename={`店家收券摘要_${yearMonth}.csv`} rows={csvRows} />
        ) : null}
      </div>
      <MonthNav yearMonth={yearMonth} basePath="/reports/stores" />

      {rows.length === 0 ? (
        <p className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {yearMonth} 尚無收券紀錄。
        </p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>店家</TableHead>
                  <TableHead className="text-right">收券數</TableHead>
                  <TableHead className="text-right">他店券</TableHead>
                  <TableHead className="text-right">補款</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.store}-${i}`}>
                    <TableCell className="font-medium">{r.store}</TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-right">{r.cross}</TableCell>
                    <TableCell className="text-right">{formatNT(r.comp)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
