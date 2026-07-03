import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getAppContext } from "@/lib/app-context";
import { AppShell } from "@/components/shared/app-shell";

// 立心 admin (W1–W8) under /admin/*. Only role='lixin' may enter.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "lixin") redirect("/");

  return (
    <AppShell role={ctx.role} ngoName={ctx.ngoName}>
      {children}
    </AppShell>
  );
}
