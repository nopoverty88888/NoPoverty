"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";

type SettlementInsert = Database["public"]["Tables"]["settlements"]["Insert"];

/**
 * 立心's 已付款 status for one NGO's month. Amounts are computed live, so this only
 * persists status — the settlements row is created on demand (upsert by
 * year_month + ngo_rep_id) the first time 立心 marks it paid. Single toggle:
 * 已付款 / 取消付款.
 */
export function SettlementStatusActions({
  repId,
  yearMonth,
  status,
  userId,
}: {
  repId: string;
  yearMonth: string;
  status: string;
  userId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(patch: Partial<SettlementInsert>, message: string) {
    setBusy(true);
    const row: SettlementInsert = {
      year_month: yearMonth,
      ngo_rep_id: repId,
      ...patch,
    };
    const { error } = await createClient()
      .from("settlements")
      .upsert(row, { onConflict: "year_month,ngo_rep_id" });
    setBusy(false);
    if (error) {
      toast.error((error as PostgrestError).message);
      return;
    }
    toast.success(message);
    router.refresh();
  }

  if (status === "paid") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-green-600">已付款 ✓</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() =>
            setStatus(
              {
                status: "pending_review",
                approved_by_id: null,
                approved_at: null,
                paid_at: null,
              },
              "已取消付款",
            )
          }
        >
          取消
        </Button>
      </div>
    );
  }

  return (
    <Button
      disabled={busy}
      onClick={() =>
        setStatus(
          {
            status: "paid",
            approved_by_id: userId,
            approved_at: new Date().toISOString(),
            paid_at: new Date().toISOString(),
          },
          "已標記付款",
        )
      }
    >
      已付款
    </Button>
  );
}
