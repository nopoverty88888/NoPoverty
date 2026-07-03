"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";

type SettlementInsert = Database["public"]["Tables"]["settlements"]["Insert"];

/**
 * Compact 立心→NGO 已付款 toggle for the settlement list row. Amounts are
 * computed live, so this only persists status — the settlements row is created
 * on demand (upsert by year_month + ngo_rep_id) the first time it's paid.
 * Stops click propagation so it doesn't also toggle the row's expand.
 */
export function SettlementPayButton({
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
  const paid = status === "paid";

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

  function onClick(e: MouseEvent) {
    e.stopPropagation(); // don't toggle the row's store breakdown
    if (paid) {
      void setStatus(
        {
          status: "pending_review",
          approved_by_id: null,
          approved_at: null,
          paid_at: null,
        },
        "已取消付款",
      );
    } else {
      const now = new Date().toISOString();
      void setStatus(
        {
          status: "paid",
          approved_by_id: userId,
          approved_at: now,
          paid_at: now,
        },
        "已標記付款",
      );
    }
  }

  return (
    <Button
      variant={paid ? "ghost" : "default"}
      size="sm"
      disabled={busy}
      onClick={onClick}
    >
      {busy ? "…" : paid ? "取消付款" : "已付款"}
    </Button>
  );
}
