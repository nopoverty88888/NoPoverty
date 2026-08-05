import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CasesManager, type CaseRow } from "./cases-manager";

export default async function CasesPage() {
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

  // `my_cases` is the own-NGO, non-deleted view with the id_number masked to its
  // last 4 — the raw id_number is not readable by any client (privacy).
  const { data: rows } = await supabase
    .from("my_cases")
    .select("id, name, note, id_number_last4")
    .order("created_at", { ascending: false });

  const cases: CaseRow[] = (rows ?? [])
    .filter((r) => r.id !== null && r.name !== null)
    .map((r) => ({
      id: r.id as string,
      name: r.name as string,
      note: r.note,
      idLast4: r.id_number_last4 ?? "",
    }));

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">個案管理</h2>
      <CasesManager
        ngoId={profile.ngo_id}
        userId={user.id}
        initialCases={cases}
      />
    </section>
  );
}
