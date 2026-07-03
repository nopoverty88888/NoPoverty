import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentYearMonth, isYearMonth } from "@/lib/schemas/demand";
import { computeSettlements } from "@/lib/business/compute-settlement";
import { MonthNav } from "@/components/shared/month-nav";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SettlementRow, type ReceiptView } from "./settlement-row";

export default async function AdminSettlementsPage({
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

  // Month bounds for receipts (receipts are dated by received_date, no year_month).
  const [y, m] = yearMonth.split("-").map(Number);
  const nextFirst =
    m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  // Amounts are computed live from source data; the settlements table now only
  // carries the 已付款 status (created on demand when 立心 marks it paid).
  const [settlements, { data: statusRows }, { data: receipts }, { data: stores }] =
    await Promise.all([
      computeSettlements(supabase, yearMonth),
      supabase
        .from("settlements")
        .select("ngo_rep_id, status")
        .eq("year_month", yearMonth),
      supabase
        .from("receipts")
        .select("id, store_id, ngo_rep_id, amount, received_date, photo_url")
        .is("deleted_at", null)
        .gte("received_date", `${yearMonth}-01`)
        .lt("received_date", nextFirst)
        .order("received_date", { ascending: false }),
      supabase.from("stores").select("id, name"),
    ]);
  const statusByRep = new Map(
    (statusRows ?? []).map((s) => [s.ngo_rep_id, s.status]),
  );

  // Sign every receipt image once, then group receipts per NGO 代表.
  const storeName = new Map((stores ?? []).map((s) => [s.id, s.name]));
  const paths = (receipts ?? []).map((r) => r.photo_url);
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signedData } = await supabase.storage
      .from("receipts")
      .createSignedUrls(paths, 3600);
    for (const s of signedData ?? []) {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
  }
  const receiptsByRep = new Map<string, ReceiptView[]>();
  for (const r of receipts ?? []) {
    const list = receiptsByRep.get(r.ngo_rep_id) ?? [];
    list.push({
      id: r.id,
      storeName: storeName.get(r.store_id) ?? "（店家）",
      amount: r.amount,
      date: r.received_date,
      url: signed.get(r.photo_url) ?? null,
    });
    receiptsByRep.set(r.ngo_rep_id, list);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">月度結算單</h2>
        <p className="text-sm text-muted-foreground">
          依本月他店券回收與下月需求即時計算，無需手動產生。點一列展開各店家明細，或點 NGO 名稱開啟完整結算單。
        </p>
      </div>
      <MonthNav yearMonth={yearMonth} basePath="/admin/settlements" />

      {settlements.length === 0 ? (
        <p className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {yearMonth} 尚無可結算的店家資料。
        </p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NGO</TableHead>
                  <TableHead className="text-right">下月預付</TableHead>
                  <TableHead className="text-right">補款</TableHead>
                  <TableHead className="text-right">合計</TableHead>
                  <TableHead>收據</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map((s) => (
                  <SettlementRow
                    key={s.repId}
                    repId={s.repId}
                    yearMonth={yearMonth}
                    ngoName={s.ngoName}
                    prepay={s.prepay}
                    compensation={s.compensation}
                    total={s.total}
                    status={statusByRep.get(s.repId) ?? "pending_review"}
                    stores={s.stores}
                    userId={user.id}
                    receipts={receiptsByRep.get(s.repId) ?? []}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
