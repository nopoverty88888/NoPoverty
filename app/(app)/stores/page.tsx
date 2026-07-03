import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { StoresManager, type StoreRow } from "./stores-manager";

export default async function StoresPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // "我負責的店家" — stores owned by this rep. Filtered explicitly by owner so a
  // 立心 user sees only its OWN stores here (lixin's read-all RLS would otherwise
  // return every NGO's stores).
  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, address, contact")
    .eq("owner_ngo_rep_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">店家管理</h2>
      <StoresManager userId={user.id} initialStores={(stores ?? []) as StoreRow[]} />
    </section>
  );
}
