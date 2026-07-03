import { createClient } from "@/lib/supabase/server";
import { currentYearMonth, isYearMonth } from "@/lib/schemas/demand";
import { formatNT } from "@/lib/settlement";
import { MonthNav } from "@/components/shared/month-nav";
import { BarChart } from "@/components/shared/bar-chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const COMPENSATION_PER_VOUCHER = 100;
const TOP_N = 12;

export default async function AdminInsightsPage({
  searchParams,
}: {
  searchParams: { ym?: string };
}) {
  const supabase = createClient();
  const yearMonth =
    searchParams.ym && isYearMonth(searchParams.ym)
      ? searchParams.ym
      : currentYearMonth(new Date());

  // 立心 reads all (RLS lixin read-all / security_invoker views).
  const [
    { data: collections },
    { data: usage },
    { data: stores },
    { data: users },
    { data: ngos },
  ] = await Promise.all([
    supabase
      .from("voucher_collections")
      .select("collected_at_store_id, is_cross_store")
      .eq("year_month", yearMonth),
    supabase.from("case_usage_view").select("case_name").eq("year_month", yearMonth),
    supabase.from("stores").select("id, name, owner_ngo_rep_id"),
    supabase.from("users").select("id, ngo_id"),
    supabase.from("ngos").select("id, name"),
  ]);

  const storeName = new Map((stores ?? []).map((s) => [s.id, s.name]));
  const storeOwner = new Map((stores ?? []).map((s) => [s.id, s.owner_ngo_rep_id]));
  const userNgo = new Map((users ?? []).map((u) => [u.id, u.ngo_id]));
  const ngoName = new Map((ngos ?? []).map((n) => [n.id, n.name]));

  // Per-store usage + cross counts; per-NGO usage.
  const storeStat = new Map<string, { count: number; cross: number }>();
  const ngoCount = new Map<string, number>();
  let totalCount = 0;
  let totalCross = 0;
  for (const c of collections ?? []) {
    totalCount += 1;
    if (c.is_cross_store) totalCross += 1;
    const st = storeStat.get(c.collected_at_store_id) ?? { count: 0, cross: 0 };
    st.count += 1;
    if (c.is_cross_store) st.cross += 1;
    storeStat.set(c.collected_at_store_id, st);

    const owner = storeOwner.get(c.collected_at_store_id);
    const ngoId = owner ? userNgo.get(owner) : undefined;
    if (ngoId) ngoCount.set(ngoId, (ngoCount.get(ngoId) ?? 0) + 1);
  }

  const storeBars = Array.from(storeStat.entries())
    .map(([id, s]) => ({ label: storeName.get(id) ?? "（店家）", value: s.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_N);

  const ngoBars = Array.from(ngoCount.entries())
    .map(([id, v]) => ({ label: ngoName.get(id) ?? "（NGO）", value: v }))
    .sort((a, b) => b.value - a.value);

  const crossStores = Array.from(storeStat.entries())
    .map(([id, s]) => ({ name: storeName.get(id) ?? "（店家）", ...s }))
    .filter((s) => s.cross > 0)
    .sort((a, b) => b.cross - a.cross)
    .slice(0, TOP_N);

  const caseCount = new Map<string, number>();
  for (const u of usage ?? []) {
    const name = u.case_name ?? "（個案）";
    caseCount.set(name, (caseCount.get(name) ?? 0) + 1);
  }
  const topCases = Array.from(caseCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">全域使用情況儀表板</h2>
      <MonthNav yearMonth={yearMonth} basePath="/admin/insights" />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="本月收券" value={`${totalCount} 張`} />
        <Stat label="他店券" value={`${totalCross} 張`} />
        <Stat
          label="補款總額"
          value={formatNT(totalCross * COMPENSATION_PER_VOUCHER)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">各店家收券量（前 {TOP_N}）</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={storeBars} emptyText="本月尚無收券" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">各 NGO 收券量</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={ngoBars} emptyText="本月尚無收券" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">持續被跨店使用的店家</CardTitle>
            <p className="text-xs text-muted-foreground">
              他店券較多者，可考慮調整下月需求分配。
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {crossStores.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                本月無他店券。
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>店家</TableHead>
                    <TableHead className="text-right">他店券</TableHead>
                    <TableHead className="text-right">收券總數</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crossStores.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right">{s.cross}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {s.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">個案使用次數 Top {TOP_N}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topCases.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                本月尚無使用紀錄。
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>個案</TableHead>
                    <TableHead className="text-right">使用次數</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCases.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right">{c.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
