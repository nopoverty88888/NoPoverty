import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentYearMonth, isYearMonth } from "@/lib/schemas/demand";
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

  // My stores + any demand already saved for this month + this month's submission
  // marker (RLS scopes to own NGO).
  const [{ data: storeRows }, { data: demandRows }, { data: submission }] =
    await Promise.all([
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
    ]);

  const quantityByStore = new Map(
    (demandRows ?? []).map((d) => [d.store_id, d.quantity]),
  );
  const stores: DemandStore[] = (storeRows ?? []).map((s) => ({
    storeId: s.id,
    name: s.name,
    quantity: quantityByStore.get(s.id) ?? 0,
  }));

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">月度需求表</h2>
      <DemandsManager
        ngoId={profile.ngo_id}
        userId={user.id}
        yearMonth={yearMonth}
        stores={stores}
        submittedAt={submission?.submitted_at ?? null}
      />
    </section>
  );
}
