import { createClient } from "@/lib/supabase/server";
import { currentYearMonth, isYearMonth } from "@/lib/schemas/demand";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MonthNav } from "@/components/shared/month-nav";
import { IssuanceControl } from "./issuance-control";

export default async function AdminDemandsPage({
  searchParams,
}: {
  searchParams: { ym?: string };
}) {
  const supabase = createClient();
  const yearMonth =
    searchParams.ym && isYearMonth(searchParams.ym)
      ? searchParams.ym
      : currentYearMonth(new Date());

  // 立心 reads all NGOs / submissions / demands / stores / issuances (RLS lixin read-all).
  const [
    { data: ngos },
    { data: subs },
    { data: demands },
    { data: stores },
    { data: issuances },
  ] = await Promise.all([
    supabase.from("ngos").select("id, name").order("name"),
    supabase
      .from("monthly_demand_submissions")
      .select("ngo_id, submitted_at")
      .eq("year_month", yearMonth),
    supabase
      .from("monthly_demands")
      .select("ngo_id, store_id, quantity")
      .eq("year_month", yearMonth),
    supabase.from("stores").select("id, name"),
    supabase
      .from("monthly_voucher_issuances")
      .select("ngo_id, issued_at")
      .eq("year_month", yearMonth),
  ]);

  const submittedAtByNgo = new Map(
    (subs ?? []).map((s) => [s.ngo_id, s.submitted_at]),
  );
  const issuedAtByNgo = new Map(
    (issuances ?? []).map((i) => [i.ngo_id, i.issued_at]),
  );
  const storeName = new Map((stores ?? []).map((s) => [s.id, s.name]));
  const demandsByNgo = new Map<string, { storeId: string; quantity: number }[]>();
  for (const d of demands ?? []) {
    const list = demandsByNgo.get(d.ngo_id) ?? [];
    list.push({ storeId: d.store_id, quantity: d.quantity });
    demandsByNgo.set(d.ngo_id, list);
  }

  const allNgos = ngos ?? [];
  const submittedCount = allNgos.filter((n) => submittedAtByNgo.has(n.id)).length;
  const issuedCount = allNgos.filter((n) => issuedAtByNgo.has(n.id)).length;
  const grandTotal = (demands ?? []).reduce((sum, d) => sum + d.quantity, 0);
  const pendingNgos = allNgos.filter((n) => !submittedAtByNgo.has(n.id));

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">月度需求總覽</h2>
      <MonthNav yearMonth={yearMonth} basePath="/admin/demands" />

      <Card>
        <CardContent className="grid grid-cols-3 gap-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">需求總計</p>
            <p className="text-2xl font-semibold">{grandTotal} 張</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">已提交</p>
            <p className="text-2xl font-semibold">
              {submittedCount} / {allNgos.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">已發券</p>
            <p className="text-2xl font-semibold">
              {issuedCount} / {allNgos.length}
            </p>
          </div>
        </CardContent>
      </Card>

      {pendingNgos.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span className="font-medium">尚未提交（{pendingNgos.length}）：</span>
          {pendingNgos.map((n) => n.name).join("、")}
        </div>
      ) : allNgos.length > 0 ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          所有 NGO 已提交本月需求 ✓
        </p>
      ) : null}

      <div className="space-y-3">
        {allNgos.map((ngo) => {
          const submittedAt = submittedAtByNgo.get(ngo.id);
          const issuedAt = issuedAtByNgo.get(ngo.id) ?? null;
          const items = demandsByNgo.get(ngo.id) ?? [];
          const total = items.reduce((sum, it) => sum + it.quantity, 0);
          return (
            <Card key={ngo.id}>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">{ngo.name}</CardTitle>
                <div className="flex items-center gap-2">
                  {submittedAt ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      已提交 {submittedAt.slice(0, 10)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      未提交
                    </span>
                  )}
                  <IssuanceControl
                    ngoId={ngo.id}
                    yearMonth={yearMonth}
                    issuedAt={issuedAt}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {items.length === 0 ? (
                  <p className="text-muted-foreground">尚無需求資料</p>
                ) : (
                  <>
                    {items.map((it) => (
                      <div key={it.storeId} className="flex justify-between">
                        <span className="text-muted-foreground">
                          {storeName.get(it.storeId) ?? "（店家）"}
                        </span>
                        <span>{it.quantity} 張</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-1 font-medium">
                      <span>總計</span>
                      <span>{total} 張</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
