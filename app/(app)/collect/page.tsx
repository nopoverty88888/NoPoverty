import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentYearMonth, isYearMonth, nextYearMonth } from "@/lib/schemas/demand";
import { MonthNav } from "@/components/shared/month-nav";
import {
  CollectManager,
  type StoreOption,
  type Collection,
} from "./collect-manager";
import { type ReceiptRow } from "./receipts-manager";

function taipeiToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function CollectPage({
  searchParams,
}: {
  searchParams: { ym?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const currentMonth = currentYearMonth(new Date());
  const yearMonth =
    searchParams.ym && isYearMonth(searchParams.ym)
      ? searchParams.ym
      : currentMonth;
  const readOnly = yearMonth !== currentMonth;
  const nextMonth = nextYearMonth(yearMonth);

  const [
    { data: profile },
    { data: storeRows },
    { data: collectionRows },
    { data: statusRows },
    { data: nextDemandRows },
    { data: receiptRows },
  ] = await Promise.all([
    supabase.from("users").select("role").eq("id", user.id).single(),
    supabase
      .from("stores")
      .select("id, name")
      .eq("owner_ngo_rep_id", user.id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("voucher_collections")
      .select("serial_number, collected_at_store_id, is_cross_store")
      .eq("year_month", yearMonth),
    supabase
      .from("store_collection_status")
      .select("store_id, completed_at")
      .eq("year_month", yearMonth),
    // Next month's demand per store → the prepayment part of the store payout.
    supabase
      .from("monthly_demands")
      .select("store_id, quantity")
      .eq("year_month", nextMonth),
    supabase
      .from("receipts")
      .select("id, store_id, amount, received_date, photo_url")
      .eq("ngo_rep_id", user.id)
      .is("deleted_at", null)
      .order("received_date", { ascending: false }),
  ]);

  const stores: StoreOption[] = (storeRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
  }));

  const initialCollections: Collection[] = (collectionRows ?? []).map((c) => ({
    serial: c.serial_number,
    collectedStoreId: c.collected_at_store_id,
    isCrossStore: c.is_cross_store ?? false,
  }));

  const completedByStore: Record<string, string> = {};
  for (const s of statusRows ?? []) {
    completedByStore[s.store_id] = s.completed_at;
  }

  const nextDemandByStore: Record<string, number> = {};
  for (const d of nextDemandRows ?? []) {
    nextDemandByStore[d.store_id] = d.quantity;
  }

  // 上傳收據 — merged into 店家結算 (NGO 代表 only; 立心 doesn't pay itself). Current
  // month only; the receipt form appears per-store after that store's 回收 is done.
  const showReceipts = profile?.role !== "lixin" && !readOnly;
  let initialReceipts: ReceiptRow[] = [];
  if (showReceipts) {
    const paths = (receiptRows ?? []).map((r) => r.photo_url);
    const signed = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signedData } = await supabase.storage
        .from("receipts")
        .createSignedUrls(paths, 3600);
      for (const s of signedData ?? []) {
        if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
      }
    }
    initialReceipts = (receiptRows ?? []).map((r) => ({
      id: r.id,
      storeId: r.store_id,
      amount: r.amount,
      receivedDate: r.received_date,
      path: r.photo_url,
      signedUrl: signed.get(r.photo_url) ?? null,
    }));
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">店家結算</h2>
        <p className="text-sm text-muted-foreground">
          掃描或輸入回收的流水號，系統自動算出應付店家的款項。
        </p>
      </div>
      <MonthNav yearMonth={yearMonth} basePath="/collect" />
      {readOnly ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          歷史紀錄（{yearMonth}）· 唯讀
        </p>
      ) : null}
      <CollectManager
        key={yearMonth}
        userId={user.id}
        yearMonth={yearMonth}
        nextMonth={nextMonth}
        stores={stores}
        initialCollections={initialCollections}
        completedByStore={completedByStore}
        nextDemandByStore={nextDemandByStore}
        receipts={initialReceipts}
        receiptDefaultDate={showReceipts ? taipeiToday() : null}
        readOnly={readOnly}
      />
    </section>
  );
}
