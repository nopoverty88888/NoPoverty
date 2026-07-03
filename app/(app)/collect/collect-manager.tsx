"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { serialNumberSchema } from "@/lib/schemas/voucher";
import { SerialScanner } from "@/components/shared/serial-scanner";
import { ReceiptsManager, type ReceiptRow } from "./receipts-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

export type StoreOption = { id: string; name: string };
export type Collection = {
  serial: string;
  collectedStoreId: string;
  isCrossStore: boolean;
};

const VOUCHER_PRICE = 100; // NT$ per voucher — the unit for both prepay & compensation

/** One row the rep is entering: a serial + whether they marked it 他店券. */
type Draft = { key: string; serial: string; cross: boolean };

export function CollectManager({
  userId,
  yearMonth,
  nextMonth,
  stores,
  initialCollections,
  completedByStore,
  nextDemandByStore,
  receipts,
  receiptDefaultDate,
  readOnly = false,
}: {
  userId: string;
  yearMonth: string;
  nextMonth: string;
  stores: StoreOption[];
  initialCollections: Collection[];
  completedByStore: Record<string, string>;
  nextDemandByStore: Record<string, number>;
  receipts: ReceiptRow[];
  receiptDefaultDate: string | null;
  readOnly?: boolean;
}) {
  const supabase = createClient();

  const [storeId, setStoreId] = useState(stores.length === 1 ? stores[0].id : "");
  const [drafts, setDrafts] = useState<Draft[]>([
    { key: "row-0", serial: "", cross: false },
  ]);
  const draftsRef = useRef<Draft[]>(drafts);
  const keySeq = useRef(0);
  const [batchBusy, setBatchBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [collections, setCollections] =
    useState<Collection[]>(initialCollections);
  const [completed, setCompleted] =
    useState<Record<string, string>>(completedByStore);
  const [busyComplete, setBusyComplete] = useState(false);

  const storeName = useMemo(
    () => new Map(stores.map((s) => [s.id, s.name])),
    [stores],
  );

  const rows = useMemo(
    () => collections.filter((c) => c.collectedStoreId === storeId),
    [collections, storeId],
  );
  const crossCount = rows.filter((c) => c.isCrossStore).length;
  const ownCount = rows.length - crossCount;
  const filledCount = drafts.filter((d) => d.serial.trim()).length;

  // 應付店家 = 下月預付款（下月需求×100）+ 本月他店補款（他店券×100）.
  const nextQty = nextDemandByStore[storeId] ?? 0;
  const prepay = nextQty * VOUCHER_PRICE;
  const compensation = crossCount * VOUCHER_PRICE;
  const storePayout = prepay + compensation;

  // Soft validation (non-blocking): serials repeated across the rows, and serials
  // already recorded this month. Flagged live so the rep can catch typos.
  const duplicatesInBatch = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of drafts) {
      const s = d.serial.trim();
      if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return Array.from(counts.entries()).filter(([, n]) => n > 1);
  }, [drafts]);
  const alreadyThisMonth = useMemo(() => {
    const recorded = new Set(collections.map((c) => c.serial));
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of drafts) {
      const s = d.serial.trim();
      if (s && recorded.has(s) && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
    return out;
  }, [drafts, collections]);

  // draftsRef mirrors drafts so async handlers (the scanner staging serials one
  // after another) always see the latest list.
  function commitDrafts(next: Draft[]) {
    draftsRef.current = next;
    setDrafts(next);
  }
  function newKey() {
    keySeq.current += 1;
    return `row-${keySeq.current}`;
  }
  function addDraft(serial = "", cross = false) {
    commitDrafts([...draftsRef.current, { key: newKey(), serial, cross }]);
  }
  function updateDraft(key: string, patch: Partial<Draft>) {
    commitDrafts(
      draftsRef.current.map((d) => (d.key === key ? { ...d, ...patch } : d)),
    );
  }
  function removeDraft(key: string) {
    const next = draftsRef.current.filter((d) => d.key !== key);
    commitDrafts(next.length ? next : [{ key: newKey(), serial: "", cross: false }]);
  }

  // A scanned serial becomes a new row (default 本店券; the rep can flip it).
  async function stageSerial(rawSerial: string): Promise<{
    ok: boolean;
    message: string;
  }> {
    const parsed = serialNumberSchema.safeParse(rawSerial);
    if (!parsed.success) return { ok: false, message: "流水號格式錯誤" };
    const serial = parsed.data;
    if (collections.some((c) => c.serial === serial)) {
      return { ok: false, message: "此券本月已記錄" };
    }
    if (draftsRef.current.some((d) => d.serial.trim() === serial)) {
      return { ok: false, message: "已在清單中" };
    }
    const empty = draftsRef.current.find((d) => !d.serial.trim());
    if (empty) updateDraft(empty.key, { serial });
    else addDraft(serial, false);
    return { ok: true, message: "已加入清單（預設本店券）" };
  }

  async function runBatch() {
    if (!storeId) {
      toast.error("請先選擇店家");
      return;
    }
    setBatchBusy(true);
    setSummary(null);

    const recorded = new Set(collections.map((c) => c.serial));
    const seen = new Set<string>();
    const invalid: string[] = [];
    const already: string[] = [];
    const dupes: string[] = [];
    const eligible: { serial: string; cross: boolean }[] = [];
    for (const d of draftsRef.current) {
      const s = d.serial.trim();
      if (!s) continue;
      if (!serialNumberSchema.safeParse(s).success) invalid.push(s);
      else if (recorded.has(s)) already.push(s);
      else if (seen.has(s)) dupes.push(s);
      else {
        seen.add(s);
        eligible.push({ serial: s, cross: d.cross });
      }
    }
    if (eligible.length === 0 && invalid.length === 0) {
      setBatchBusy(false);
      toast.error("請先輸入流水號");
      return;
    }

    type Row = { serial_number: string; is_cross_store: boolean | null };
    const insertedRows: Row[] = [];
    const failed: string[] = [];
    const newRow = (e: { serial: string; cross: boolean }) => ({
      serial_number: e.serial,
      collected_at_store_id: storeId,
      year_month: yearMonth,
      scanned_by_id: userId,
      is_cross_store: e.cross, // the rep's declaration; trigger respects it
    });
    const cols = "serial_number, is_cross_store";

    if (eligible.length > 0) {
      const { data, error } = await supabase
        .from("voucher_collections")
        .insert(eligible.map(newRow))
        .select(cols);
      if (error) {
        // One bad row fails the whole transaction — retry per row to isolate.
        for (const e of eligible) {
          const { data: d, error: er } = await supabase
            .from("voucher_collections")
            .insert(newRow(e))
            .select(cols)
            .single();
          if (er || !d) failed.push(e.serial);
          else insertedRows.push(d as Row);
        }
      } else {
        insertedRows.push(...((data as Row[] | null) ?? []));
      }
    }

    if (insertedRows.length > 0) {
      setCollections((prev) => [
        ...prev,
        ...insertedRows.map((r) => ({
          serial: r.serial_number,
          collectedStoreId: storeId,
          isCrossStore: r.is_cross_store ?? false,
        })),
      ]);
    }

    const own = insertedRows.filter((r) => !r.is_cross_store).length;
    const cross = insertedRows.filter((r) => r.is_cross_store).length;

    // Keep only rows still needing attention (bad format / failed); drop recorded.
    const recordedAfter = new Set([
      ...Array.from(recorded),
      ...insertedRows.map((r) => r.serial_number),
    ]);
    const keep = draftsRef.current.filter((d) => {
      const s = d.serial.trim();
      return s && !recordedAfter.has(s);
    });
    commitDrafts(keep.length ? keep : [{ key: newKey(), serial: "", cross: false }]);

    const parts = [`已記錄 ${insertedRows.length} 張`];
    if (insertedRows.length > 0) parts.push(`（本店 ${own}／他店 ${cross}）`);
    const skips: string[] = [];
    if (dupes.length) skips.push(`重複 ${dupes.length}`);
    if (already.length) skips.push(`本月已記錄 ${already.length}`);
    if (invalid.length) skips.push(`格式錯誤 ${invalid.length}`);
    if (failed.length) skips.push(`失敗 ${failed.length}`);
    const msg = parts.join("") + (skips.length ? `；略過 ${skips.join("、")}` : "");
    setSummary(msg);
    if (insertedRows.length > 0) toast.success(msg);
    else toast.error(msg);
    setBatchBusy(false);
  }

  async function removeCollection(serial: string) {
    const { error: delError } = await supabase
      .from("voucher_collections")
      .delete()
      .eq("year_month", yearMonth)
      .eq("serial_number", serial);
    if (delError) {
      toast.error((delError as PostgrestError).message);
      return;
    }
    setCollections((prev) => prev.filter((c) => c.serial !== serial));
  }

  async function markComplete() {
    if (!storeId) return;
    setBusyComplete(true);
    const { error: upError } = await supabase
      .from("store_collection_status")
      .upsert(
        { year_month: yearMonth, store_id: storeId, completed_by_id: userId },
        { onConflict: "year_month,store_id" },
      );
    setBusyComplete(false);
    if (upError) {
      toast.error((upError as PostgrestError).message);
      return;
    }
    setCompleted((prev) => ({ ...prev, [storeId]: new Date().toISOString() }));
    toast.success("已標記付款給店家");
  }

  async function unmarkComplete() {
    if (!storeId) return;
    setBusyComplete(true);
    const { error: delError } = await supabase
      .from("store_collection_status")
      .delete()
      .eq("year_month", yearMonth)
      .eq("store_id", storeId);
    setBusyComplete(false);
    if (delError) {
      toast.error((delError as PostgrestError).message);
      return;
    }
    setCompleted((prev) => {
      const next = { ...prev };
      delete next[storeId];
      return next;
    });
    toast.success("已取消付款");
  }

  if (stores.length === 0) {
    return (
      <p className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        尚無店家，請先到「店家管理」新增。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Store picker */}
      <Select
        value={storeId}
        onValueChange={(v) => {
          setStoreId(v);
          setSummary(null);
        }}
      >
        <SelectTrigger className="max-w-sm">
          <SelectValue placeholder="選擇收券店家" />
        </SelectTrigger>
        <SelectContent>
          {stores.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {storeId ? (
        <>
          {!readOnly ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">回收登錄</CardTitle>
                <p className="text-xs text-muted-foreground">
                  他店的券請改選「他店券」（才計補款）。
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  {drafts.map((d) => (
                    <div key={d.key} className="flex items-center gap-2">
                      <Input
                        value={d.serial}
                        onChange={(e) =>
                          updateDraft(d.key, { serial: e.target.value })
                        }
                        disabled={batchBusy}
                        inputMode="numeric"
                        maxLength={5}
                        placeholder="流水號"
                        aria-label="流水號"
                        className="w-36"
                      />
                      <Select
                        value={d.cross ? "cross" : "own"}
                        onValueChange={(v) =>
                          updateDraft(d.key, { cross: v === "cross" })
                        }
                        disabled={batchBusy}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="own">本店券</SelectItem>
                          <SelectItem value="cross">他店券</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="移除此列"
                        onClick={() => removeDraft(d.key)}
                        disabled={batchBusy}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addDraft()}
                    disabled={batchBusy}
                  >
                    <Plus className="mr-1 size-4" /> 新增一列
                  </Button>
                  <SerialScanner
                    onDetect={stageSerial}
                    buttonLabel="相機掃描"
                    disabled={batchBusy}
                  />
                  <Button
                    onClick={runBatch}
                    disabled={batchBusy || filledCount === 0}
                  >
                    {batchBusy ? "記錄中…" : `加入 ${filledCount} 張`}
                  </Button>
                </div>

                {duplicatesInBatch.length > 0 ? (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    ⚠️ 清單中有重複：
                    {duplicatesInBatch.map(([s, n]) => `${s}×${n}`).join("、")}
                  </p>
                ) : null}
                {alreadyThisMonth.length > 0 ? (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    ⚠️ 本月已記錄，將略過：{alreadyThisMonth.join("、")}
                  </p>
                ) : null}
                {summary ? (
                  <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                    {summary}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* 應付店家 = 下月預付 + 他店補款；含付款動作 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">應付店家</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <PayRow
                label={`下月預付（${nextMonth}·${nextQty} 張）`}
                value={prepay}
              />
              {nextQty === 0 ? (
                <p className="text-xs text-amber-700">
                  尚未填寫 {nextMonth} 需求，預付以 0 計。
                </p>
              ) : null}
              <PayRow label={`他店補款（${crossCount} 張）`} value={compensation} />
              <div className="border-t pt-2">
                <PayRow label="應付總額" value={storePayout} emphasis />
              </div>

              <div className="flex items-center justify-between gap-3 border-t pt-3">
                {completed[storeId] ? (
                  <span className="text-xs">
                    <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
                      ✓ 已付款
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {completed[storeId].slice(0, 10)}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">尚未付款</span>
                )}
                {!readOnly ? (
                  completed[storeId] ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={unmarkComplete}
                      disabled={busyComplete}
                    >
                      取消付款
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={markComplete}
                      disabled={busyComplete}
                    >
                      標記已付款
                    </Button>
                  )
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* 回收明細（張數摘要放標題） */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">回收明細</CardTitle>
              <p className="text-xs text-muted-foreground">
                共 {rows.length} 張　·　本店 {ownCount}　·　他店 {crossCount}
              </p>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  尚無回收紀錄。
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>流水號</TableHead>
                        <TableHead>類型</TableHead>
                        {!readOnly ? (
                          <TableHead className="w-16 text-right">操作</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...rows].reverse().map((c) => (
                        <TableRow key={c.serial}>
                          <TableCell className="font-medium">{c.serial}</TableCell>
                          <TableCell>
                            {c.isCrossStore ? (
                              <Badge variant="destructive">他店券</Badge>
                            ) : (
                              <Badge variant="secondary">本店券</Badge>
                            )}
                          </TableCell>
                          {!readOnly ? (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`移除 ${c.serial}`}
                                onClick={() => removeCollection(c.serial)}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {receiptDefaultDate && completed[storeId] ? (
            <ReceiptsManager
              key={storeId}
              userId={userId}
              store={{ id: storeId, name: storeName.get(storeId) ?? "" }}
              defaultDate={receiptDefaultDate}
              defaultAmount={storePayout}
              receipts={receipts.filter((r) => r.storeId === storeId)}
            />
          ) : receiptDefaultDate ? (
            <p className="text-sm text-muted-foreground">付款後可上傳收據。</p>
          ) : null}
        </>
      ) : (
        <p className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          請先選擇店家。
        </p>
      )}
    </div>
  );
}

function PayRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className={emphasis ? "font-medium" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={emphasis ? "text-lg font-semibold" : "font-medium"}>
        NT$ {value.toLocaleString()}
      </span>
    </div>
  );
}
