import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNgoAccountSchema } from "@/lib/schemas/ngo";

/**
 * POST /api/ngos — create an NGO account (W3). 立心-only.
 * Creates: ngos row + auth user + public.users row (role=ngo_rep), and returns
 * a one-time temporary password for 立心 to hand to the rep.
 */
export async function POST(request: Request) {
  const supabase = createClient();

  // AuthZ: caller must be a logged-in 立心 user.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  const { data: me } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "lixin") {
    return NextResponse.json({ error: "權限不足" }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createNgoAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "輸入錯誤" },
      { status: 400 },
    );
  }
  const { ngoName, repName, repEmail, password: providedPassword } = parsed.data;
  const generated = !providedPassword || providedPassword.length === 0;

  const admin = createAdminClient();

  // 1. NGO entity.
  const { data: ngo, error: ngoErr } = await admin
    .from("ngos")
    .insert({ name: ngoName })
    .select("id")
    .single();
  if (ngoErr || !ngo) {
    if (ngoErr?.code === "23505") {
      return NextResponse.json({ error: "NGO 名稱已存在" }, { status: 409 });
    }
    return NextResponse.json(
      { error: ngoErr?.message ?? "建立 NGO 失敗" },
      { status: 500 },
    );
  }

  // 2. Auth user (email confirmed so they can log in immediately).
  const password = generated
    ? randomBytes(9).toString("base64url")
    : providedPassword!;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: repEmail,
    password,
    email_confirm: true,
    user_metadata: { name: repName },
  });
  if (createErr || !created.user) {
    await admin.from("ngos").delete().eq("id", ngo.id); // rollback
    return NextResponse.json(
      { error: `建立登入帳號失敗：${createErr?.message ?? "未知錯誤"}` },
      { status: 500 },
    );
  }

  // 3. public.users row linking the auth user to the NGO as its 代表.
  const { error: userErr } = await admin.from("users").insert({
    id: created.user.id,
    email: repEmail,
    name: repName,
    role: "ngo_rep",
    ngo_id: ngo.id,
    created_by_id: user.id,
  });
  if (userErr) {
    await admin.auth.admin.deleteUser(created.user.id); // rollback
    await admin.from("ngos").delete().eq("id", ngo.id);
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  return NextResponse.json({ email: repEmail, password, generated });
}
