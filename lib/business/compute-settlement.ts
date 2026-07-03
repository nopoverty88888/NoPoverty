import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import { nextYearMonth } from "@/lib/schemas/demand";

const VOUCHER_PRICE = 100; // NT$ per voucher

export type StoreAmount = {
  storeId: string;
  storeName: string;
  prepay: number;
  compensation: number;
  total: number;
};
export type RepSettlement = {
  repId: string;
  ngoId: string;
  ngoName: string;
  prepay: number;
  compensation: number;
  total: number;
  stores: StoreAmount[];
};

/**
 * Live per-NGO settlement for a month, computed from source data on every read —
 * there is no snapshot / "generate" step. Per store:
 *   下月預付款 = 下個月(M+1)需求 × 100，本月他店補款 = 本月他店券 × 100。
 * RLS scopes the inputs automatically: 立心 sees all NGOs, an NGO 代表 sees only
 * their own stores/collections, so the same helper serves W5, W6, M11 and reports.
 */
export async function computeSettlements(
  supabase: SupabaseClient<Database>,
  yearMonth: string,
): Promise<RepSettlement[]> {
  const nextMonth = nextYearMonth(yearMonth);
  const [
    { data: stores },
    { data: demands },
    { data: cross },
    { data: users },
    { data: ngos },
  ] = await Promise.all([
    supabase.from("stores").select("id, name, owner_ngo_rep_id, deleted_at"),
    supabase
      .from("monthly_demands")
      .select("store_id, quantity")
      .eq("year_month", nextMonth),
    supabase
      .from("voucher_collections")
      .select("collected_at_store_id")
      .eq("year_month", yearMonth)
      .eq("is_cross_store", true),
    supabase.from("users").select("id, ngo_id"),
    supabase.from("ngos").select("id, name"),
  ]);

  const demandByStore = new Map<string, number>();
  for (const d of demands ?? []) demandByStore.set(d.store_id, d.quantity);
  const crossByStore = new Map<string, number>();
  for (const c of cross ?? []) {
    crossByStore.set(
      c.collected_at_store_id,
      (crossByStore.get(c.collected_at_store_id) ?? 0) + 1,
    );
  }
  const ngoName = new Map((ngos ?? []).map((n) => [n.id, n.name]));
  const userNgo = new Map((users ?? []).map((u) => [u.id, u.ngo_id]));

  const byRep = new Map<string, StoreAmount[]>();
  for (const s of stores ?? []) {
    const qty = demandByStore.get(s.id) ?? 0;
    const crossN = crossByStore.get(s.id) ?? 0;
    // Skip a soft-deleted store only if it has no activity this cycle.
    if (s.deleted_at && qty === 0 && crossN === 0) continue;
    const prepay = qty * VOUCHER_PRICE;
    const compensation = crossN * VOUCHER_PRICE;
    const list = byRep.get(s.owner_ngo_rep_id) ?? [];
    list.push({
      storeId: s.id,
      storeName: s.name,
      prepay,
      compensation,
      total: prepay + compensation,
    });
    byRep.set(s.owner_ngo_rep_id, list);
  }

  const result: RepSettlement[] = [];
  for (const [repId, storeList] of Array.from(byRep.entries())) {
    const prepay = storeList.reduce((a, x) => a + x.prepay, 0);
    const compensation = storeList.reduce((a, x) => a + x.compensation, 0);
    const ngoId = userNgo.get(repId) ?? "";
    result.push({
      repId,
      ngoId,
      ngoName: ngoName.get(ngoId) ?? "（NGO）",
      prepay,
      compensation,
      total: prepay + compensation,
      stores: storeList.sort((a, b) => a.storeName.localeCompare(b.storeName)),
    });
  }
  return result.sort((a, b) => a.ngoName.localeCompare(b.ngoName));
}
