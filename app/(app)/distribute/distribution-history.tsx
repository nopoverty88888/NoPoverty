"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { collapseRanges, dateRangeLabel } from "./format";
import type { Assignment, StoreOption } from "./distribute-manager";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** "2026-07" → "2026年7月" */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  return `${y}年${Number(m)}月`;
}

/**
 * 發券紀錄 across all of the rep's stores, filterable by month.
 * The current month is rendered from the live in-memory ledger (so it reflects
 * edits made above without a refresh); other months are fetched on demand.
 */
export function DistributionHistory({
  currentMonth,
  availableMonths,
  stores,
  caseNames,
  liveAssignments,
}: {
  currentMonth: string;
  availableMonths: string[];
  stores: StoreOption[];
  caseNames: Map<string, string>;
  liveAssignments: Assignment[];
}) {
  const supabase = createClient();
  const [month, setMonth] = useState(currentMonth);
  const [remote, setRemote] = useState<Assignment[] | null>(null);
  const [loading, setLoading] = useState(false);

  const storeName = useMemo(
    () => new Map(stores.map((s) => [s.id, s.name])),
    [stores],
  );

  const isCurrent = month === currentMonth;

  useEffect(() => {
    if (month === currentMonth) {
      setRemote(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setRemote(null);
    setLoading(true);
    supabase
      .from("voucher_assignments")
      .select("serial_number, store_id, case_id, assigned_at")
      .eq("year_month", month)
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        setRemote(
          error
            ? []
            : (data ?? []).map((a) => ({
                serial: a.serial_number,
                storeId: a.store_id,
                caseId: a.case_id,
                assignedAt: a.assigned_at,
              })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [month, currentMonth, supabase]);

  const data = useMemo(
    () => (isCurrent ? liveAssignments : remote ?? []),
    [isCurrent, liveAssignments, remote],
  );

  const rows = useMemo(() => {
    const byKey = new Map<
      string,
      { storeId: string; caseId: string; serials: number[]; dates: string[] }
    >();
    for (const a of data) {
      const key = `${a.storeId}|${a.caseId}`;
      const entry =
        byKey.get(key) ??
        { storeId: a.storeId, caseId: a.caseId, serials: [], dates: [] };
      entry.serials.push(Number(a.serial));
      entry.dates.push(a.assignedAt);
      byKey.set(key, entry);
    }
    return Array.from(byKey.values())
      .map((e) => ({
        key: `${e.storeId}|${e.caseId}`,
        storeName: storeName.get(e.storeId) ?? "（未知店家）",
        caseName: caseNames.get(e.caseId) ?? "（已刪除個案）",
        serialsLabel: collapseRanges(e.serials),
        dateLabel: dateRangeLabel(e.dates),
        count: e.serials.length,
        min: Math.min(...e.serials),
      }))
      .sort(
        (a, b) => a.storeName.localeCompare(b.storeName) || a.min - b.min,
      );
  }, [data, storeName, caseNames]);

  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">發券紀錄（共 {total} 張）</CardTitle>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map((m) => (
              <SelectItem key={m} value={m}>
                {monthLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            載入中…
          </p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {monthLabel(month)}尚無發券紀錄。
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>店家</TableHead>
                  <TableHead>個案</TableHead>
                  <TableHead className="w-24">日期</TableHead>
                  <TableHead>流水號</TableHead>
                  <TableHead className="w-16 text-right">張數</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">
                      {row.storeName}
                    </TableCell>
                    <TableCell>{row.caseName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.dateLabel}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.serialsLabel}
                    </TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
