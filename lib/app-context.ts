import { createClient } from "@/lib/supabase/server";

export type AppContext = {
  userId: string;
  role: "lixin" | "ngo_rep";
  ngoName: string;
};

/**
 * Shared layout context: the current user's id, role and NGO name.
 * Returns null when unauthenticated — callers should redirect to /login.
 * Centralizes the getUser → users(role,ngo_id) → ngos(name) lookups that
 * every authenticated layout needs.
 */
export async function getAppContext(): Promise<AppContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role, ngo_id")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  const { data: ngo } = await supabase
    .from("ngos")
    .select("name")
    .eq("id", profile.ngo_id)
    .single();

  return {
    userId: user.id,
    role: profile.role === "lixin" ? "lixin" : "ngo_rep",
    ngoName: ngo?.name ?? "",
  };
}
