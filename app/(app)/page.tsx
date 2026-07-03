import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, Store, Send } from "lucide-react";

import { getAppContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { currentYearMonth } from "@/lib/schemas/demand";
import { WORKSPACE_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

// Quick-launch cards (workspace nav minus 首頁, 個案管理, 店家管理).
const HIDDEN_TILES = new Set(["/", "/cases", "/stores"]);
const TILES = WORKSPACE_NAV.filter((item) => !HIDDEN_TILES.has(item.href));

// A soft accent colour per action tile so the home isn't monochrome.
const TILE_ACCENT: Record<string, string> = {
  "/demands": "bg-sky-100 text-sky-700",
  "/distribute": "bg-emerald-100 text-emerald-700",
  "/collect": "bg-orange-100 text-orange-700",
};

export default async function AppHome() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");

  const supabase = createClient();
  const month = currentYearMonth(new Date());
  const [{ count: caseCount }, { count: storeCount }, { count: distributed }] =
    await Promise.all([
      supabase.from("my_cases").select("id", { count: "exact", head: true }),
      supabase
        .from("stores")
        .select("id", { count: "exact", head: true })
        .eq("owner_ngo_rep_id", ctx.userId)
        .is("deleted_at", null),
      supabase
        .from("voucher_assignments")
        .select("serial_number", { count: "exact", head: true })
        .eq("year_month", month),
    ]);

  const stats = [
    { icon: Users, label: "個案", value: caseCount ?? 0, tint: "text-sky-600" },
    { icon: Store, label: "店家", value: storeCount ?? 0, tint: "text-emerald-600" },
    {
      icon: Send,
      label: "本月發券",
      value: distributed ?? 0,
      tint: "text-orange-600",
    },
  ];

  return (
    <section className="space-y-6">
      {/* Warm hero */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-amber-100/50 to-emerald-50 p-6">
        <p className="text-sm font-medium text-primary">歡迎回來 👋</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">
          {ctx.ngoName || "我的 NGO"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          選擇下方功能，開始今天的工作。
        </p>
      </div>

      {/* Lean at-a-glance stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <s.icon className={cn("size-5", s.tint)} />
            <p className="mt-2 text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Colourful action tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TILES.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-xl",
                  TILE_ACCENT[href] ?? "bg-muted text-foreground",
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="font-medium">{label}</span>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
