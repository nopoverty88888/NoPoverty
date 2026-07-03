"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, ChevronDown } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  HOME_ITEM,
  WORKSPACE_GROUP,
  ADMIN_GROUP,
  REPORTS_GROUP,
  type NavGroup,
} from "@/lib/nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Role = "lixin" | "ngo_rep";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupHasActive(pathname: string, group: NavGroup): boolean {
  return group.items.some((item) => isActive(pathname, item.href));
}

const navLinkClass =
  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

function SidebarBody({
  role,
  ngoName,
  pathname,
  onNavigate,
  onSignOut,
}: {
  role: Role;
  ngoName: string;
  pathname: string;
  onNavigate?: () => void;
  onSignOut: () => void;
}) {
  // 首頁 + the workspace items are flat top-level links; only 立心管理 / 報表 stay
  // as collapsible groups (at the same level as those flat links).
  const flatLinks = [HOME_ITEM, ...WORKSPACE_GROUP.items];
  // 立心: only 立心管理 (the shared reports are merged into it). NGO 代表: only 報表.
  const groups = useMemo<NavGroup[]>(
    () => (role === "lixin" ? [ADMIN_GROUP] : [REPORTS_GROUP]),
    [role],
  );

  // Expanded by default only for the group holding the current route, so the
  // rail stays short (首頁 + a few collapsed headers) until you drill in.
  const [openGroups, setOpenGroups] = useState<string[]>(() =>
    groups.filter((g) => groupHasActive(pathname, g)).map((g) => g.title),
  );
  const toggle = (title: string) =>
    setOpenGroups((prev) =>
      prev.includes(title)
        ? prev.filter((t) => t !== title)
        : [...prev, title],
    );

  // The desktop sidebar lives in the persistent layout, so SidebarBody re-renders
  // (new pathname) without remounting — the lazy initializer above runs only once.
  // Re-expand the active group on every navigation, preserving any the user opened.
  useEffect(() => {
    const active = groups
      .filter((g) => groupHasActive(pathname, g))
      .map((g) => g.title);
    if (active.length === 0) return;
    setOpenGroups((prev) => {
      const merged = new Set([...prev, ...active]);
      return merged.size === prev.length ? prev : Array.from(merged);
    });
  }, [pathname, groups]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-base">
          🍱
        </span>
        <p className="truncate text-sm font-semibold">
          {ngoName || "待用券系統"}
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {flatLinks.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                navLinkClass,
                active
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        {groups.map((group) => {
          const GroupIcon = group.icon;
          const open = openGroups.includes(group.title);
          const hasActive = groupHasActive(pathname, group);
          return (
            <div key={group.title}>
              <button
                type="button"
                onClick={() => toggle(group.title)}
                aria-expanded={open}
                className={cn(
                  navLinkClass,
                  "w-full hover:bg-muted",
                  hasActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <GroupIcon className="size-4 shrink-0" />
                <span className="flex-1 truncate text-left">{group.title}</span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 transition-transform",
                    open && "rotate-180",
                  )}
                />
              </button>

              {open ? (
                <div className="mt-0.5 ml-4 space-y-0.5 border-l pl-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          navLinkClass,
                          active
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSignOut}
          className="w-full justify-start"
        >
          <LogOut className="mr-2 size-4" /> 登出
        </Button>
      </div>
    </div>
  );
}

export function AppShell({
  role,
  ngoName,
  children,
}: {
  role: Role;
  ngoName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r bg-muted/20 md:block">
        <SidebarBody
          role={role}
          ngoName={ngoName}
          pathname={pathname}
          onSignOut={signOut}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar + drawer */}
        <header className="flex items-center gap-2 border-b bg-background p-3 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="選單">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">導覽選單</SheetTitle>
              <SidebarBody
                role={role}
                ngoName={ngoName}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
                onSignOut={signOut}
              />
            </SheetContent>
          </Sheet>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-base">
            🍱
          </span>
          <span className="truncate font-semibold">
            {ngoName || "待用券系統"}
          </span>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
