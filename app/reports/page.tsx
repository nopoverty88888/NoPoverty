import { getAppContext } from "@/lib/app-context";

export default async function ReportsIndexPage() {
  const ctx = await getAppContext();
  const scope = ctx?.role === "lixin" ? "全部 NGO" : "我的 NGO";

  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">報表中心</h2>
      <p className="text-sm text-muted-foreground">
        從左側選擇報表。每張報表皆可下載 CSV。
      </p>
      <p className="text-sm">
        檢視範圍：<span className="font-medium">{scope}</span>
      </p>
    </section>
  );
}
