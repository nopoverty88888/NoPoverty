import {
  Home,
  Users,
  Store,
  ClipboardList,
  Send,
  PackageCheck,
  History,
  FileText,
  Building2,
  Wallet,
  BarChart3,
  ListChecks,
  LayoutGrid,
  ShieldCheck,
  FolderClosed,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
/** A collapsible top-level group in the sidebar. */
export type NavGroup = { title: string; icon: LucideIcon; items: NavItem[] };

/** NGO workspace (M1–M11) — every authenticated user. */
export const WORKSPACE_NAV: NavItem[] = [
  { href: "/", label: "首頁", icon: Home },
  { href: "/cases", label: "個案管理", icon: Users },
  { href: "/stores", label: "店家管理", icon: Store },
  { href: "/demands", label: "本月需求", icon: ClipboardList },
  { href: "/distribute", label: "發券給個案", icon: Send },
  { href: "/collect", label: "店家結算", icon: PackageCheck },
];

/**
 * 立心 admin (W1–W8) — role='lixin' only. The two shared reports (個案使用紀錄,
 * 店家收券摘要) are merged in here for 立心, so 立心 has no separate 報表 group;
 * 月度結算 is intentionally omitted (立心 uses 結算單 above). These report pages
 * are RLS-scoped, so 立心 sees all NGOs.
 */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/insights", label: "全域儀表板", icon: BarChart3 },
  { href: "/admin/ngos", label: "NGO 帳號管理", icon: Building2 },
  { href: "/admin/demands", label: "月度需求總覽", icon: ListChecks },
  { href: "/admin/settlements", label: "結算單", icon: Wallet },
  { href: "/reports/usage", label: "個案使用紀錄", icon: History },
  { href: "/reports/stores", label: "店家收券摘要", icon: Store },
];

/** Shared desktop reports — every authenticated user (RLS-scoped). */
export const REPORTS_NAV: NavItem[] = [
  { href: "/reports/usage", label: "個案使用紀錄", icon: History },
  { href: "/reports/settlement", label: "月度結算", icon: FileText },
  { href: "/reports/stores", label: "店家收券摘要", icon: Store },
];

/**
 * Sidebar structure: a single 首頁 quick link plus a few collapsible groups,
 * so the top level stays under five items (esp. for 立心, who sees all groups).
 */
export const HOME_ITEM: NavItem = WORKSPACE_NAV[0]; // 首頁

export const WORKSPACE_GROUP: NavGroup = {
  title: "我的工作區",
  icon: LayoutGrid,
  items: WORKSPACE_NAV.filter((item) => item.href !== "/"),
};

export const ADMIN_GROUP: NavGroup = {
  title: "立心管理",
  icon: ShieldCheck,
  items: ADMIN_NAV,
};

export const REPORTS_GROUP: NavGroup = {
  title: "報表",
  icon: FolderClosed,
  items: REPORTS_NAV,
};
