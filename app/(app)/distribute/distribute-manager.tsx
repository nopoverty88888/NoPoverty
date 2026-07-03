"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Trash2 } from "lucide-react";
import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { serialNumberSchema } from "@/lib/schemas/voucher";
import { cn } from "@/lib/utils";
import { pad5, collapseRanges, dateRangeLabel } from "./format";
import { DistributionHistory } from "./distribution-history";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type StoreOption = { id: string; name: string };
export type CaseOption = { id: string; name: string };
export type Assignment = {
  serial: string;
  storeId: string;
  caseId: string;
  assignedAt: string;
};

const MAX_SERIAL = 99999;

export function DistributeManager({
  userId,
  yearMonth,
  stores,
  cases,
  initialAssignments,
  availableMonths,
}: {
  userId: string;
  yearMonth: string;
  stores: StoreOption[];
  cases: CaseOption[];
  initialAssignments: Assignment[];
  availableMonths: string[];
}) {
  const supabase = createClient();

  const [assignments, setAssignments] =
    useState<Assignment[]>(initialAssignments);
  const [storeId, setStoreId] = useState(stores.length === 1 ? stores[0].id : "");
  const [caseId, setCaseId] = useState("");
  const [caseOpen, setCaseOpen] = useState(false);
  const [startInput, setStartInput] = useState("");
  const [countInput, setCountInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<{ caseId: string; name: string } | null>(
    null,
  );

  const caseName = useMemo(
    () => new Map(cases.map((c) => [c.id, c.name])),
    [cases],
  );

  // All serials used this month (any store) — global uniqueness guard.
  const usedSerials = useMemo(() => {
    const m = new Map<string, string>(); // serial -> case name
    for (const a of assignments) {
      m.set(a.serial, caseName.get(a.caseId) ?? "其他個案");
    }
    return m;
  }, [assignments, caseName]);

  function nextStartFor(targetStore: string): string {
    const serials = assignments
      .filter((a) => a.storeId === targetStore)
      .map((a) => Number(a.serial));
    if (serials.length === 0) return "";
    return pad5(Math.max(...serials) + 1);
  }

  function onStoreChange(value: string) {
    setStoreId(value);
    setStartInput(nextStartFor(value));
    setCaseId("");
    setError(null);
  }

  // Rows for the selected store, grouped by case.
  const storeRows = useMemo(() => {
    const byCase = new Map<string, { serials: number[]; dates: string[] }>();
    for (const a of assignments) {
      if (a.storeId !== storeId) continue;
      const entry = byCase.get(a.caseId) ?? { serials: [], dates: [] };
      entry.serials.push(Number(a.serial));
      entry.dates.push(a.assignedAt);
      byCase.set(a.caseId, entry);
    }
    return Array.from(byCase.entries())
      .map(([cid, { serials, dates }]) => ({
        caseId: cid,
        name: caseName.get(cid) ?? "（已刪除個案）",
        serials,
        count: serials.length,
        min: Math.min(...serials),
        dateLabel: dateRangeLabel(dates),
      }))
      .sort((a, b) => a.min - b.min);
  }, [assignments, storeId, caseName]);

  const storeTotal = storeRows.reduce((sum, r) => sum + r.count, 0);

  async function addAllocation() {
    setError(null);
    if (!storeId || !caseId) {
      setError("請先選擇店家與個案");
      return;
    }
    const startParsed = serialNumberSchema.safeParse(startInput);
    if (!startParsed.success) {
      setError("起始流水號須為 5 位數字");
      return;
    }
    const count = Number(countInput);
    if (!Number.isInteger(count) || count < 1) {
      setError("張數須為 1 以上的整數");
      return;
    }
    const startNum = Number(startParsed.data);
    const endNum = startNum + count - 1;
    if (endNum > MAX_SERIAL) {
      setError(`流水號超過上限（最大 ${MAX_SERIAL}）`);
      return;
    }
    const serials = Array.from({ length: count }, (_, i) => pad5(startNum + i));
    const conflict = serials.find((s) => usedSerials.has(s));
    if (conflict) {
      setError(`流水號 ${conflict} 本月已指派給 ${usedSerials.get(conflict)}`);
      return;
    }

    setBusy(true);
    const rows = serials.map((serial) => ({
      serial_number: serial,
      store_id: storeId,
      case_id: caseId,
      year_month: yearMonth,
      assigned_by_id: userId,
    }));
    const { error: insertError } = await supabase
      .from("voucher_assignments")
      .insert(rows);
    setBusy(false);

    if (insertError) {
      const pg = insertError as PostgrestError;
      toast.error(
        pg.code === "23505"
          ? "部分流水號本月已被指派，請重新整理後再試"
          : pg.message,
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const added: Assignment[] = serials.map((serial) => ({
      serial,
      storeId,
      caseId,
      assignedAt: nowIso,
    }));
    const updated = [...assignments, ...added];
    setAssignments(updated);
    toast.success(`已記錄 ${count} 張給 ${caseName.get(caseId) ?? "個案"}`);
    // advance to the next serial; ready for the next case
    setStartInput(pad5(endNum + 1));
    setCountInput("");
    setCaseId("");
    setError(null);
  }

  function onCountKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void addAllocation();
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    const target = removing;
    const { error: delError } = await supabase
      .from("voucher_assignments")
      .delete()
      .eq("year_month", yearMonth)
      .eq("store_id", storeId)
      .eq("case_id", target.caseId);
    if (delError) {
      toast.error((delError as PostgrestError).message);
      return;
    }
    setAssignments((prev) =>
      prev.filter(
        (a) => !(a.storeId === storeId && a.caseId === target.caseId),
      ),
    );
    setRemoving(null);
    setStartInput(nextStartFor(storeId));
    toast.success(`已移除 ${target.name} 的紀錄`);
  }

  if (stores.length === 0 || cases.length === 0) {
    return (
      <p className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        {stores.length === 0
          ? "尚無店家，請先到「店家管理」新增。"
          : "尚無個案，請先到「個案管理」新增。"}
      </p>
    );
  }

  const selectedCase = cases.find((c) => c.id === caseId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">選擇店家</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={storeId} onValueChange={onStoreChange}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="選擇店家" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {storeId ? (
        <>
          {/* Quick add */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">發券紀錄</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem_7rem_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label>個案</Label>
                  <Popover open={caseOpen} onOpenChange={setCaseOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={caseOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedCase ? selectedCase.name : "選擇個案"}
                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="搜尋個案姓名…" />
                        <CommandList>
                          <CommandEmpty>查無個案</CommandEmpty>
                          <CommandGroup>
                            {cases.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.name}
                                onSelect={() => {
                                  setCaseId(c.id);
                                  setCaseOpen(false);
                                  setError(null);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 size-4",
                                    caseId === c.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                {c.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="start">起始流水號</Label>
                  <Input
                    id="start"
                    value={startInput}
                    onChange={(e) => {
                      setStartInput(e.target.value);
                      if (error) setError(null);
                    }}
                    inputMode="numeric"
                    maxLength={5}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="count">張數</Label>
                  <Input
                    id="count"
                    value={countInput}
                    onChange={(e) => {
                      setCountInput(e.target.value);
                      if (error) setError(null);
                    }}
                    onKeyDown={onCountKeyDown}
                    inputMode="numeric"
                  />
                </div>

                <Button onClick={addAllocation} disabled={busy}>
                  {busy ? "記錄中…" : "加入"}
                </Button>
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  輸入起始流水號與張數，系統會依序記錄（起始流水號會自動帶下一號）。
                </p>
              )}
            </CardContent>
          </Card>

          {/* Ledger */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                本月發券紀錄（共 {storeTotal} 張）
              </CardTitle>
            </CardHeader>
            <CardContent>
              {storeRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  此店家本月尚無發券紀錄。
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>個案</TableHead>
                        <TableHead className="w-24">日期</TableHead>
                        <TableHead>流水號</TableHead>
                        <TableHead className="w-16 text-right">張數</TableHead>
                        <TableHead className="w-16 text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {storeRows.map((row) => (
                        <TableRow key={row.caseId}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.dateLabel}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {collapseRanges(row.serials)}
                          </TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`移除 ${row.name} 的紀錄`}
                              onClick={() =>
                                setRemoving({ caseId: row.caseId, name: row.name })
                              }
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          請先選擇店家。
        </p>
      )}

      <DistributionHistory
        currentMonth={yearMonth}
        availableMonths={availableMonths}
        stores={stores}
        caseNames={caseName}
        liveAssignments={assignments}
      />

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移除發券紀錄？</AlertDialogTitle>
            <AlertDialogDescription>
              將移除「{removing?.name}」在此店家本月的所有發券紀錄。可重新輸入。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>移除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
