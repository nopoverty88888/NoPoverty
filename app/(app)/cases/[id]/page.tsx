import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { CASE_TYPE_LABELS } from "@/lib/schemas/case";
import { Badge } from "@/components/ui/badge";
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

/**
 * M10 — a single case's full, cross-month voucher usage history. Each NGO can
 * open this for its own cases (2026-07-03 立心 meeting). All queries run through
 * RLS-scoped views (my_cases / *_view are own-NGO for a 代表, all for 立心), so a
 * 代表 can never open another NGO's case here.
 */
export default async function CaseHistoryPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: theCase }, { data: usage }, { data: recon }] =
    await Promise.all([
      supabase
        .from("my_cases")
        .select("id, name, case_type, id_number_last4")
        .eq("id", params.id)
        .maybeSingle(),
      supabase
        .from("case_usage_view")
        .select("used_at_store_name, serial_number, year_month, scanned_at, quantity")
        .eq("case_id", params.id),
      supabase
        .from("case_monthly_reconciliation_view")
        .select("year_month, assigned_count, collected_count, unused_count")
        .eq("case_id", params.id),
    ]);

  if (!theCase) notFound();

  const caseType = theCase.case_type ?? "individual";
  const usageRows = (usage ?? [])
    .map((u) => ({
      store: u.used_at_store_name ?? "",
      serial: u.serial_number ?? "",
      ym: u.year_month ?? "",
      date: (u.scanned_at ?? "").slice(0, 10),
      qty: u.quantity ?? 1,
    }))
    .sort(
      (a, b) => b.ym.localeCompare(a.ym) || b.date.localeCompare(a.date),
    );
  const reconRows = (recon ?? [])
    .map((r) => ({
      ym: r.year_month ?? "",
      assigned: r.assigned_count ?? 0,
      collected: r.collected_count ?? 0,
      unused: r.unused_count ?? 0,
    }))
    .sort((a, b) => b.ym.localeCompare(a.ym));

  // 累計使用以張數加總（一張紙代表多張的券也計入真實張數）。
  const totalUsed = usageRows.reduce((a, r) => a + r.qty, 0);

  return (
    <section className="space-y-4">
      <Link
        href="/cases"
        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        ← 個案管理
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold">{theCase.name}</h2>
        {caseType === "individual" ? (
          theCase.id_number_last4 ? (
            <Badge variant="secondary">身分證 ****{theCase.id_number_last4}</Badge>
          ) : null
        ) : (
          <Badge variant="secondary">
            {(CASE_TYPE_LABELS as Record<string, string>)[caseType] ?? caseType}
          </Badge>
        )}
        <span className="text-sm text-muted-foreground">
          · 累計使用 {totalUsed} 張
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">每月發出／使用核對</CardTitle>
          <p className="text-xs text-muted-foreground">
            未使用 = 已發出但當月未回收的張數。
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {reconRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              尚無發券紀錄。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>月份</TableHead>
                  <TableHead className="text-right">發出</TableHead>
                  <TableHead className="text-right">已使用</TableHead>
                  <TableHead className="text-right">未使用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconRows.map((r) => (
                  <TableRow key={r.ym}>
                    <TableCell className="font-medium">{r.ym}</TableCell>
                    <TableCell className="text-right">{r.assigned}</TableCell>
                    <TableCell className="text-right">{r.collected}</TableCell>
                    <TableCell className="text-right">
                      {r.unused > 0 ? (
                        <span className="font-medium text-amber-700">
                          {r.unused}
                        </span>
                      ) : (
                        r.unused
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">使用明細</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {usageRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              尚無兌換紀錄。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>月份</TableHead>
                  <TableHead>兌換店家</TableHead>
                  <TableHead>流水號</TableHead>
                  <TableHead className="text-right">張數</TableHead>
                  <TableHead>兌換日期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageRows.map((r, i) => (
                  <TableRow key={`${r.serial}-${i}`}>
                    <TableCell className="font-medium">{r.ym}</TableCell>
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
          )}
        </CardContent>
      </Card>
    </section>
  );
}
