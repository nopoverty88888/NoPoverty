import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getAppContext } from "@/lib/app-context";
import { AppShell } from "@/components/shared/app-shell";

// Shared desktop reports — any authenticated user; RLS scopes the data.
export default async function ReportsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");

  return (
    <AppShell role={ctx.role} ngoName={ctx.ngoName}>
      {children}
    </AppShell>
  );
}
