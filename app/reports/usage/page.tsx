import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentYearMonth, isYearMonth } from "@/lib/schemas/demand";
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
      .select("case_name, used_at_store_name, serial_number, scanned_at, quantity")
      .eq("year_month", yearMonth),
  ]);
  const scope = me?.role === "lixin" ? "全部 NGO" : "我的 NGO";

  const rows = (usage ?? [])
    .map((u) => ({
      case: u.case_name ?? "",
      store: u.used_at_store_name ?? "",
      serial: u.serial_number ?? "",
      date: (u.scanned_at ?? "").slice(0, 10),
      qty: u.quantity ?? 1,
    }))
    .sort((a, b) => a.case.localeCompare(b.case) || a.serial.localeCompare(b.serial));
  const csvRows = rows.map((r) => ({
    個案: r.case,
    兌換店家: r.store,
    流水號: r.serial,
    張數: r.qty,
    兌換日期: r.date,
  }));

  // 總張數 = Σ張數（含手寫多張的券）；筆數 = 回收的實體券張數。
  const totalQty = rows.reduce((a, r) => a + r.qty, 0);

  // 個案別兌換張數統計（by case）— RLS 已限定範圍（我的 NGO / 全部）。以張數加總，
  // 活動採購／便當外送等一張紙代表多張的券也能反映真實兌換量。
  const caseCounts = new Map<string, number>();
  for (const r of rows) caseCounts.set(r.case, (caseCounts.get(r.case) ?? 0) + r.qty);
  const caseSummary = Array.from(caseCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

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
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="本月兌換總張數" value={`${totalQty} 張`} />
            <Stat label="回收筆數" value={`${rows.length} 筆`} />
            <Stat label="使用個案數" value={`${caseSummary.length}`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">個案別兌換張數</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>個案</TableHead>
                    <TableHead className="text-right">兌換張數</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {caseSummary.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right">{c.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">使用明細</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>個案</TableHead>
                    <TableHead>兌換店家</TableHead>
                    <TableHead>流水號</TableHead>
                    <TableHead className="text-right">張數</TableHead>
                    <TableHead>兌換日期</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={`${r.serial}-${i}`}>
                      <TableCell className="font-medium">{r.case}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.store}
                      </TableCell>
                      <TableCell>{r.serial}</TableCell>
                      <TableCell className="text-right">
                        {r.qty > 1 ? (
                          <span className="font-medium">{r.qty}</span>
                        ) : (
                          <span className="text-muted-foreground">1</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.date}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
