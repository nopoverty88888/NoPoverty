"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { CASE_TYPE_LABELS } from "@/lib/schemas/case";
import { Button } from "@/components/ui/button";
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

export type ReconcileRow = {
  caseId: string;
  caseName: string;
  caseType: string;
  assigned: number;
  collected: number;
  unused: number;
};

export function ReconcileManager({
  ngoId,
  userId,
  yearMonth,
  rows,
  initialConfirmed,
  readOnly = false,
}: {
  ngoId: string;
  userId: string;
  yearMonth: string;
  rows: ReconcileRow[];
  initialConfirmed: Record<string, string>;
  readOnly?: boolean;
}) {
  const supabase = createClient();
  const [confirmed, setConfirmed] =
    useState<Record<string, string>>(initialConfirmed);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const totals = useMemo(() => {
    const unused = rows.reduce((a, r) => a + r.unused, 0);
    const confirmedCount = rows.filter((r) => confirmed[r.caseId]).length;
    return { cases: rows.length, unused, confirmedCount };
  }, [rows, confirmed]);

  function rowFor(row: ReconcileRow) {
    return {
      ngo_id: ngoId,
      case_id: row.caseId,
      year_month: yearMonth,
      assigned_count: row.assigned,
      collected_count: row.collected,
      unused_count: row.unused,
      confirmed_by_id: userId,
      confirmed_at: new Date().toISOString(),
    };
  }

  async function confirmCase(row: ReconcileRow) {
    setBusy(row.caseId);
    const { data, error } = await supabase
      .from("monthly_case_confirmations")
      .upsert(rowFor(row), { onConflict: "case_id,year_month" })
      .select("confirmed_at")
      .single();
    setBusy(null);
    if (error || !data) {
      toast.error((error as PostgrestError)?.message ?? "確認失敗");
      return;
    }
    setConfirmed((prev) => ({ ...prev, [row.caseId]: data.confirmed_at }));
  }

  async function unconfirm(caseId: string) {
    setBusy(caseId);
    const { error } = await supabase
      .from("monthly_case_confirmations")
      .delete()
      .eq("year_month", yearMonth)
      .eq("case_id", caseId);
    setBusy(null);
    if (error) {
      toast.error((error as PostgrestError).message);
      return;
    }
    setConfirmed((prev) => {
      const next = { ...prev };
      delete next[caseId];
      return next;
    });
  }

  async function confirmAll() {
    const pending = rows.filter((r) => !confirmed[r.caseId]);
    if (pending.length === 0) return;
    setBulkBusy(true);
    const { data, error } = await supabase
      .from("monthly_case_confirmations")
      .upsert(
        pending.map(rowFor),
        { onConflict: "case_id,year_month" },
      )
      .select("case_id, confirmed_at");
    setBulkBusy(false);
    if (error || !data) {
      toast.error((error as PostgrestError)?.message ?? "確認失敗");
      return;
    }
    setConfirmed((prev) => {
      const next = { ...prev };
      for (const r of data) if (r.case_id) next[r.case_id] = r.confirmed_at;
      return next;
    });
    toast.success(`已確認 ${data.length} 位個案`);
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        {yearMonth} 尚無發券紀錄可核對。
      </p>
    );
  }

  const allConfirmed = totals.confirmedCount === totals.cases;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="個案數" value={`${totals.cases}`} />
        <Stat label="未使用張數" value={`${totals.unused}`} />
        <Stat
          label="已確認"
          value={`${totals.confirmedCount}/${totals.cases}`}
        />
      </div>

      {!readOnly ? (
        <Button onClick={confirmAll} disabled={bulkBusy || allConfirmed}>
          <CheckCircle2 className="mr-1 size-4" />
          {allConfirmed
            ? "已全部確認"
            : bulkBusy
              ? "確認中…"
              : "全部確認未使用情形"}
        </Button>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">個案發出／使用核對</CardTitle>
          <p className="text-xs text-muted-foreground">
            未使用 = 本月發出但尚未回收的張數；確認後代表已核對。
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>個案</TableHead>
                <TableHead className="text-right">發出</TableHead>
                <TableHead className="text-right">已使用</TableHead>
                <TableHead className="text-right">未使用</TableHead>
                <TableHead className="text-right">確認</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const at = confirmed[r.caseId];
                return (
                  <TableRow key={r.caseId}>
                    <TableCell className="font-medium">
                      {r.caseName}
                      {r.caseType !== "individual" ? (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {(CASE_TYPE_LABELS as Record<string, string>)[
                            r.caseType
                          ] ?? r.caseType}
                        </Badge>
                      ) : null}
                    </TableCell>
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
                    <TableCell className="text-right">
                      {at ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            ✓ 已確認
                          </span>
                          {!readOnly ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => unconfirm(r.caseId)}
                              disabled={busy === r.caseId}
                            >
                              取消
                            </Button>
                          ) : null}
                        </div>
                      ) : readOnly ? (
                        <span className="text-xs text-muted-foreground">
                          未確認
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmCase(r)}
                          disabled={busy === r.caseId}
                        >
                          確認
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
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
