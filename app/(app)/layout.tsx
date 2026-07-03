import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getAppContext } from "@/lib/app-context";
import { AppShell } from "@/components/shared/app-shell";

// NGO workspace (M1–M11). Any authenticated user (incl. 立心 for its own NGO).
export default async function AppLayout({
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
