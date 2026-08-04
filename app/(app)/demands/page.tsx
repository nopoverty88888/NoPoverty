import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  currentYearMonth,
  isYearMonth,
  prevYearMonth,
} from "@/lib/schemas/demand";
import { DemandsManager, type DemandStore } from "./demands-manager";

export default async function DemandsPage({
  searchParams,
}: {
  searchParams: { ym?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("ngo_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const yearMonth =
    searchParams.ym && isYearMonth(searchParams.ym)
      ? searchParams.ym
      : currentYearMonth(new Date());

  // 上月結轉：上月需求 − 上月已回收（用掉）= 上月未使用，可折抵本月要買的量。
  // 以實體券張數（筆數）計，與需求同單位（2026-07-03 立心 meeting）。
  const prevMonth = prevYearMonth(yearMonth);

  // My stores + demand saved for this month + submission marker + last month's
  // demand & collections (RLS scopes everything to own NGO / own stores).
  const [
    { data: storeRows },
    { data: demandRows },
    { data: submission },
    { data: prevDemandRows },
    { data: prevCollectionRows },
  ] = await Promise.all([
    supabase
      .from("stores")
      .select("id, name")
      .eq("owner_ngo_rep_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("monthly_demands")
      .select("store_id, quantity")
      .eq("year_month", yearMonth),
    supabase
      .from("monthly_demand_submissions")
      .select("submitted_at")
      .eq("year_month", yearMonth)
      .eq("ngo_id", profile.ngo_id)
      .maybeSingle(),
    supabase
      .from("monthly_demands")
      .select("store_id, quantity")
      .eq("year_month", prevMonth),
    supabase
      .from("voucher_collections")
      .select("collected_at_store_id")
      .eq("year_month", prevMonth),
  ]);

  const quantityByStore = new Map(
    (demandRows ?? []).map((d) => [d.store_id, d.quantity]),
  );
  const prevDemandByStore = new Map(
    (prevDemandRows ?? []).map((d) => [d.store_id, d.quantity]),
  );
  const prevCollectedByStore = new Map<string, number>();
  for (const c of prevCollectionRows ?? []) {
    prevCollectedByStore.set(
      c.collected_at_store_id,
      (prevCollectedByStore.get(c.collected_at_store_id) ?? 0) + 1,
    );
  }

  const stores: DemandStore[] = (storeRows ?? []).map((s) => {
    const prevDemand = prevDemandByStore.get(s.id) ?? 0;
    const prevCollected = prevCollectedByStore.get(s.id) ?? 0;
    return {
      storeId: s.id,
      name: s.name,
      quantity: quantityByStore.get(s.id) ?? 0,
      // 上月未使用（折抵本月）— never negative.
      lastUnused: Math.max(0, prevDemand - prevCollected),
    };
  });

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">月度需求表</h2>
      <DemandsManager
        ngoId={profile.ngo_id}
        userId={user.id}
        yearMonth={yearMonth}
        prevMonth={prevMonth}
        stores={stores}
        submittedAt={submission?.submitted_at ?? null}
      />
    </section>
  );
}
