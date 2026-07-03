import { createClient } from "@/lib/supabase/server";
import { NgosManager, type NgoWithMembers } from "./ngos-manager";

export default async function AdminNgosPage() {
  const supabase = createClient();

  const [{ data: ngos }, { data: users }] = await Promise.all([
    supabase.from("ngos").select("id, name").order("name"),
    supabase.from("users").select("name, email, role, ngo_id"),
  ]);

  const membersByNgo = new Map<
    string,
    { name: string; email: string; role: string }[]
  >();
  for (const u of users ?? []) {
    const list = membersByNgo.get(u.ngo_id) ?? [];
    list.push({ name: u.name, email: u.email, role: u.role });
    membersByNgo.set(u.ngo_id, list);
  }

  const data: NgoWithMembers[] = (ngos ?? []).map((n) => ({
    id: n.id,
    name: n.name,
    members: membersByNgo.get(n.id) ?? [],
  }));

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">NGO 帳號管理</h2>
      <p className="text-sm text-muted-foreground">
        一個 NGO = 一個帳號。新增時會一併建立該 NGO 的代表登入。
      </p>
      <NgosManager ngos={data} />
    </section>
  );
}
