import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentYearMonth, isYearMonth } from "@/lib/schemas/demand";
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

export default async function ReportsUsagePage({
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

  const [{ data: me }, { data: usage }] = await Promise.all([
    supabase.from("users").select("role").eq("id", user.id).single(),
    supabase
      .from("case_usage_view")
      .select("case_name, used_at_store_name, serial_number, scanned_at")
      .eq("year_month", yearMonth),
  ]);
  const scope = me?.role === "lixin" ? "全部 NGO" : "我的 NGO";

  const rows = (usage ?? [])
    .map((u) => ({
      case: u.case_name ?? "",
      store: u.used_at_store_name ?? "",
      serial: u.serial_number ?? "",
      date: (u.scanned_at ?? "").slice(0, 10),
    }))
    .sort((a, b) => a.case.localeCompare(b.case) || a.serial.localeCompare(b.serial));
  const csvRows = rows.map((r) => ({
    個案: r.case,
    兌換店家: r.store,
    流水號: r.serial,
    兌換日期: r.date,
  }));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">個案使用紀錄</h2>
          <p className="text-sm text-muted-foreground">檢視範圍：{scope}</p>
        </div>
        {rows.length > 0 ? (
          <CsvButton filename={`個案使用紀錄_${yearMonth}.csv`} rows={csvRows} />
        ) : null}
      </div>
      <MonthNav yearMonth={yearMonth} basePath="/reports/usage" />

      {rows.length === 0 ? (
        <p className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {yearMonth} 尚無兌換紀錄。
        </p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>個案</TableHead>
                  <TableHead>兌換店家</TableHead>
                  <TableHead>流水號</TableHead>
                  <TableHead>兌換日期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.serial}-${i}`}>
                    <TableCell className="font-medium">{r.case}</TableCell>
                    <TableCell className="text-muted-foreground">{r.store}</TableCell>
                    <TableCell>{r.serial}</TableCell>
                    <TableCell className="text-muted-foreground">{r.date}</TableCell>
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
