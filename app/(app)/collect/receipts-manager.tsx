"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { receiptInputSchema } from "@/lib/schemas/receipt";
import { formatNT } from "@/lib/settlement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type ReceiptRow = {
  id: string;
  storeId: string;
  amount: number;
  receivedDate: string;
  path: string;
  signedUrl: string | null;
};

/**
 * Receipt upload + list for ONE selected store (the store chosen on 店家結算).
 * Only rendered once a store is picked and its 回收 is complete — so there's no
 * separate store dropdown; uploads attach to the selected store.
 */
export function ReceiptsManager({
  userId,
  store,
  defaultDate,
  defaultAmount,
  receipts,
}: {
  userId: string;
  store: { id: string; name: string };
  defaultDate: string;
  defaultAmount: number;
  receipts: ReceiptRow[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [date, setDate] = useState(defaultDate);
  // Prefill with 應付店家 (this store's month payout); the rep can still edit.
  const [amount, setAmount] = useState(
    defaultAmount > 0 ? String(defaultAmount) : "",
  );
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit() {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("請選擇收據照片");
    const parsed = receiptInputSchema.safeParse({ received_date: date, amount });
    if (!parsed.success) {
      return toast.error(parsed.error.issues[0]?.message ?? "輸入錯誤");
    }

    setBusy(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("receipts")
      .upload(path, file, { upsert: false });
    if (upErr) {
      setBusy(false);
      return toast.error(`上傳失敗：${upErr.message}`);
    }

    const { error: insErr } = await supabase.from("receipts").insert({
      photo_url: path,
      received_date: parsed.data.received_date,
      store_id: store.id,
      ngo_rep_id: userId,
      amount: parsed.data.amount,
      settlement_id: null,
    });
    setBusy(false);
    if (insErr) {
      await supabase.storage.from("receipts").remove([path]); // rollback
      return toast.error((insErr as PostgrestError).message);
    }

    toast.success("收據已上傳");
    setAmount("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  async function remove(r: ReceiptRow) {
    const { error } = await supabase
      .from("receipts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("receipts").remove([r.path]);
    toast.success("已刪除收據");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">上傳收據 · {store.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-xl gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rdate">收到日期</Label>
            <Input
              id="rdate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ramount">金額</Label>
            <Input
              id="ramount"
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {defaultAmount > 0 ? (
              <p className="text-xs text-muted-foreground">已預填，可修改</p>
            ) : null}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rfile">收據照片</Label>
            <Input
              id="rfile"
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={onSubmit} disabled={busy}>
              {busy ? "上傳中…" : "上傳收據"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">已上傳收據</CardTitle>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              此店家尚無收據。
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {receipts.map((r) => (
                <li key={r.id} className="flex gap-3 rounded-md border p-3">
                  {r.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.signedUrl}
                      alt="收據"
                      className="size-16 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="size-16 shrink-0 rounded bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{formatNT(r.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.receivedDate}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="刪除收據"
                    onClick={() => remove(r)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
