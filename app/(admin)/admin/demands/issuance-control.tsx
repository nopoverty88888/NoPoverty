"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * 立心's 「已發券」 marker for one NGO in a month: records that 立心 has handed that
 * NGO the vouchers it requested. Toggle on/off; writes monthly_voucher_issuances.
 */
export function IssuanceControl({
  ngoId,
  yearMonth,
  issuedAt,
}: {
  ngoId: string;
  yearMonth: string;
  issuedAt: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    if (issuedAt) {
      const { error } = await supabase
        .from("monthly_voucher_issuances")
        .delete()
        .eq("year_month", yearMonth)
        .eq("ngo_id", ngoId);
      setBusy(false);
      if (error) return toast.error((error as PostgrestError).message);
      toast.success("已取消發券紀錄");
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("monthly_voucher_issuances").upsert(
        { year_month: yearMonth, ngo_id: ngoId, issued_by_id: user?.id ?? null },
        { onConflict: "year_month,ngo_id" },
      );
      setBusy(false);
      if (error) return toast.error((error as PostgrestError).message);
      toast.success("已標記發券給此 NGO");
    }
    router.refresh();
  }

  if (issuedAt) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
          ✓ 已發券 {issuedAt.slice(0, 10)}
        </span>
        <Button variant="ghost" size="sm" onClick={toggle} disabled={busy}>
          取消
        </Button>
      </div>
    );
  }
  return (
    <Button size="sm" onClick={toggle} disabled={busy}>
      {busy ? "處理中…" : "已發券"}
    </Button>
  );
}
