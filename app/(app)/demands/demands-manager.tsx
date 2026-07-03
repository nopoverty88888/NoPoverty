"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { demandQuantitySchema } from "@/lib/schemas/demand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type DemandStore = {
  storeId: string;
  name: string;
  quantity: number;
};

type DemandRow = {
  year_month: string;
  ngo_id: string;
  store_id: string;
  quantity: number;
  created_by_id: string;
};

export function DemandsManager({
  ngoId,
  userId,
  yearMonth,
  stores,
  submittedAt,
}: {
  ngoId: string;
  userId: string;
  yearMonth: string;
  stores: DemandStore[];
  submittedAt: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(stores.map((s) => [s.storeId, String(s.quantity)])),
  );
  const [busy, setBusy] = useState(false);

  function onMonthChange(event: ChangeEvent<HTMLInputElement>) {
    const ym = event.target.value;
    if (ym) router.push(`/demands?ym=${ym}`);
  }

  function setQuantity(storeId: string, value: string) {
    setQuantities((prev) => ({ ...prev, [storeId]: value }));
  }

  /** Validate every input; returns rows to upsert, or null (after a toast). */
  function buildRows(): DemandRow[] | null {
    const rows: DemandRow[] = [];
    for (const store of stores) {
      const parsed = demandQuantitySchema.safeParse(quantities[store.storeId]);
      if (!parsed.success) {
        toast.error(`${store.name}：${parsed.error.issues[0]?.message ?? "數量錯誤"}`);
        return null;
      }
      rows.push({
        year_month: yearMonth,
        ngo_id: ngoId,
        store_id: store.storeId,
        quantity: parsed.data,
        created_by_id: userId,
      });
    }
    return rows;
  }

  async function saveQuantities(rows: DemandRow[]): Promise<boolean> {
    const { error } = await supabase
      .from("monthly_demands")
      .upsert(rows, { onConflict: "year_month,ngo_id,store_id" });
    if (error) {
      toast.error((error as PostgrestError).message);
      return false;
    }
    return true;
  }

  async function onSaveDraft() {
    const rows = buildRows();
    if (!rows) return;
    setBusy(true);
    const ok = await saveQuantities(rows);
    setBusy(false);
    if (ok) {
      toast.success("已儲存草稿");
      router.refresh();
    }
  }

  async function onSubmit() {
    const rows = buildRows();
    if (!rows) return;
    setBusy(true);
    if (!(await saveQuantities(rows))) {
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("monthly_demand_submissions").upsert(
      {
        year_month: yearMonth,
        ngo_id: ngoId,
        submitted_by_id: userId,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "year_month,ngo_id" },
    );
    setBusy(false);
    if (error) {
      toast.error((error as PostgrestError).message);
      return;
    }
    toast.success("已送出給立心");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="ym">月份</Label>
        <Input
          id="ym"
          type="month"
          value={yearMonth}
          onChange={onMonthChange}
          className="w-44"
        />
      </div>

      {submittedAt ? (
        <p className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-2 text-sm">
          <CheckCircle2 className="size-4 text-green-600" />
          已於 {submittedAt.slice(0, 10)} 送出給立心（可修改後再次送出）
        </p>
      ) : (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          尚未送出給立心
        </p>
      )}

      {stores.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          尚無店家，請先到「店家」新增。
        </p>
      ) : (
        <>
          <ul className="divide-y rounded-md border">
            {stores.map((store) => (
              <li
                key={store.storeId}
                className="flex items-center justify-between gap-3 p-3"
              >
                <span className="min-w-0 truncate">{store.name}</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={`${store.name} 需求張數`}
                  value={quantities[store.storeId] ?? ""}
                  onChange={(e) => setQuantity(store.storeId, e.target.value)}
                  className="w-24 text-right"
                />
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={busy}
              className="flex-1"
            >
              儲存草稿
            </Button>
            <Button onClick={onSubmit} disabled={busy} className="flex-1">
              {busy ? "處理中…" : "送出給立心"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
