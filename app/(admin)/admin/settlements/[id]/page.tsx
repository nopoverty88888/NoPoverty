import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { currentYearMonth, isYearMonth } from "@/lib/schemas/demand";
import { computeSettlements } from "@/lib/business/compute-settlement";
import { formatNT, settlementStatusLabel } from "@/lib/settlement";
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
import { CsvButton } from "@/components/shared/csv-button";
import { SettlementStatusActions } from "./settlement-actions";

export default async function SettlementDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ym?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const repId = params.id; // the NGO 代表's user id
  const ym =
    searchParams.ym && isYearMonth(searchParams.ym)
      ? searchParams.ym
      : currentYearMonth(new Date());

  const [
    all,
    { data: statusRow },
    { data: stores },
    { data: cases },
    { data: crossCollections },
  ] = await Promise.all([
    computeSettlements(supabase, ym),
    supabase
      .from("settlements")
      .select("status")
      .eq("ngo_rep_id", repId)
      .eq("year_month", ym)
      .maybeSingle(),
    supabase.from("stores").select("id, name, owner_ngo_rep_id"),
    supabase.from("cases").select("id, name"),
    supabase
      .from("voucher_collections")
      .select(
        "serial_number, collected_at_store_id, originally_assigned_store_id, originally_assigned_case_id",
      )
      .eq("year_month", ym)
      .eq("is_cross_store", true),
  ]);

  const settlement = all.find((s) => s.repId === repId);
  if (!settlement) notFound();
  const status = statusRow?.status ?? "pending_review";

  const storeName = new Map((stores ?? []).map((s) => [s.id, s.name]));
  const caseName = new Map((cases ?? []).map((c) => [c.id, c.name]));
  const repStoreIds = new Set(
    (stores ?? [])
      .filter((s) => s.owner_ngo_rep_id === repId)
      .map((s) => s.id),
  );
  const repCross = (crossCollections ?? []).filter((c) =>
    repStoreIds.has(c.collected_at_store_id),
  );

  const csvRows = settlement.stores.map((b) => ({
    店家: b.storeName,
    下月預付: b.prepay,
    補款: b.compensation,
    合計: b.total,
  }));

  return (
    <section className="space-y-4">
      <Link
        href={`/admin/settlements?ym=${ym}`}
        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        ← 結算單列表
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {settlement.ngoName} · {ym}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="下月預付" value={formatNT(settlement.prepay)} />
            <Stat label="補款" value={formatNT(settlement.compensation)} />
            <Stat label="合計" value={formatNT(settlement.total)} emphasis />
            <Stat label="狀態" value={settlementStatusLabel(status)} />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <SettlementStatusActions
              repId={repId}
              yearMonth={ym}
              status={status}
              userId={user.id}
            />
            <CsvButton
              filename={`結算單_${settlement.ngoName}_${ym}.csv`}
              rows={csvRows}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">各店家明細（帶現金分發）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>店家</TableHead>
                <TableHead className="text-right">下月預付</TableHead>
                <TableHead className="text-right">補款</TableHead>
                <TableHead className="text-right">合計</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlement.stores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    無明細
                  </TableCell>
                </TableRow>
              ) : (
                settlement.stores.map((b) => (
                  <TableRow key={b.storeId}>
                    <TableCell className="font-medium">{b.storeName}</TableCell>
                    <TableCell className="text-right">
                      {formatNT(b.prepay)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNT(b.compensation)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNT(b.total)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            他店券明細（補款來源 · {repCross.length} 張）
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>流水號</TableHead>
                <TableHead>收券店家</TableHead>
                <TableHead>原指派店家</TableHead>
                <TableHead>原指派個案</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repCross.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    本月無他店券
                  </TableCell>
                </TableRow>
              ) : (
                repCross.map((c) => (
                  <TableRow key={c.serial_number}>
                    <TableCell className="font-medium">
                      {c.serial_number}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {storeName.get(c.collected_at_store_id) ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {storeName.get(c.originally_assigned_store_id ?? "") ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {caseName.get(c.originally_assigned_case_id ?? "") ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
