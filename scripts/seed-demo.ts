/**
 * Seeds a full month-cycle of DEMO data against the remote Supabase project so
 * the whole flow (需求 → 發券 → 回收 → 完成 → 結算 → 收據 → 報表) can be tested
 * end-to-end. Run AFTER `pnpm seed:admin` (it needs the 立心 admin to exist):
 *
 *   pnpm seed:demo
 *   DEMO_PASSWORD='your-pass' pnpm seed:demo   # pick the demo reps' password
 *
 * Uses the service-role key (bypasses RLS) to create two NGO 代表 accounts and
 * populate three NGOs' worth of data:
 *   - 立心基金會  → the existing admin (acts as its own NGO 代表)
 *   - 勵馨基金會  → ngo-a@demo.wanhua.tw
 *   - 芒草心慈善協會 → ngo-b@demo.wanhua.tw
 *
 * Idempotent: demo accounts are reused by email; this cycle's transactional rows
 * (year_month 2026-06 / 2026-07) and demo receipts are purged and rebuilt each
 * run. Entity rows (ngos/cases/stores) use fixed UUIDs and are upserted.
 *
 * Cross-store usage is seeded on purpose (a case redeems an NGO's voucher at a
 * sibling store) so 補款 (compensation) shows up in settlements, W7 and W8.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

// supabase-js builds a realtime client needing a global WebSocket (Node < 22).
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- constants ----------------------------------------------------------
const LIXIN_NGO_ID = "00000000-0000-0000-0000-000000000001";
const LIXIN_EMAIL = "katherine84522@gmail.com";
const MONTH = "2026-06"; // cycle month M (= currentYearMonth default)
const NEXT = "2026-07"; // M+1, drives prepay
const RECEIVED_DATE = "2026-06-28";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD?.trim() || "demo-wanhua-2026";
const VOUCHER = 100; // NT$ per voucher

// Valid, stable UUIDs minted from an integer (version 4 / variant 8 nibbles).
const fixedUuid = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

// A 1x1 PNG used as a placeholder receipt photo (decoded to a Buffer on upload).
const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=",
  "base64",
);

type StoreCfg = {
  id: string;
  name: string;
  demandM: number; // serials assigned (= ordered) this month
  demandNext: number; // M+1 demand → prepay
  own: number; // of its serials, collected at itself
  cross: number; // of its serials, redeemed at the SIBLING store (補款)
  serials: string[]; // filled while seeding
};
type NgoCfg = {
  key: string;
  ngoName: string;
  ngoId: string;
  repEmail: string | null; // null = the existing 立心 admin
  repName: string;
  repId: string; // filled after resolving the auth user
  submitted: boolean; // submitted this month's demand to 立心?
  settlementId: string;
  cases: { id: string; name: string; idNumber: string; note: string | null }[];
  stores: StoreCfg[];
};

const NGOS: NgoCfg[] = [
  {
    key: "lixin",
    ngoName: "立心基金會",
    ngoId: LIXIN_NGO_ID,
    repEmail: null,
    repName: "立心管理員",
    repId: "",
    submitted: true,
    settlementId: fixedUuid(401),
    cases: [
      { id: fixedUuid(301), name: "王小明", idNumber: "A123456781", note: "獨居長者" },
      { id: fixedUuid(302), name: "林美麗", idNumber: "A223456782", note: null },
      { id: fixedUuid(303), name: "陳大華", idNumber: "A123456783", note: "低收入戶" },
    ],
    stores: [
      { id: fixedUuid(201), name: "立心便當", demandM: 10, demandNext: 10, own: 8, cross: 1, serials: [] },
      { id: fixedUuid(202), name: "立心小館", demandM: 6, demandNext: 8, own: 5, cross: 1, serials: [] },
    ],
  },
  {
    key: "a",
    ngoName: "勵馨基金會",
    ngoId: fixedUuid(101),
    repEmail: "ngo-a@demo.wanhua.tw",
    repName: "勵馨基金會代表",
    repId: "",
    submitted: true,
    settlementId: fixedUuid(402),
    cases: [
      { id: fixedUuid(311), name: "張淑芬", idNumber: "B201234561", note: "單親家庭" },
      { id: fixedUuid(312), name: "李志強", idNumber: "B101234562", note: null },
      { id: fixedUuid(313), name: "黃春嬌", idNumber: "B201234563", note: null },
    ],
    stores: [
      { id: fixedUuid(211), name: "幸福廚房", demandM: 12, demandNext: 14, own: 9, cross: 2, serials: [] },
      { id: fixedUuid(212), name: "暖心食堂", demandM: 8, demandNext: 4, own: 6, cross: 0, serials: [] },
    ],
  },
  {
    key: "b",
    ngoName: "芒草心慈善協會",
    ngoId: fixedUuid(102),
    repEmail: "ngo-b@demo.wanhua.tw",
    repName: "芒草心代表",
    repId: "",
    submitted: false, // left UNsubmitted on purpose → exercises W4 "未提交"
    settlementId: fixedUuid(403),
    cases: [
      { id: fixedUuid(321), name: "吳文雄", idNumber: "C101234561", note: "街友" },
      { id: fixedUuid(322), name: "周雅婷", idNumber: "C201234562", note: null },
      { id: fixedUuid(323), name: "鄭佳蓉", idNumber: "C201234563", note: null },
    ],
    stores: [
      { id: fixedUuid(221), name: "陽光餐館", demandM: 9, demandNext: 10, own: 7, cross: 1, serials: [] },
      { id: fixedUuid(222), name: "轉角飯館", demandM: 5, demandNext: 5, own: 5, cross: 0, serials: [] },
    ],
  },
];

function check(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function resolveAuthUser(
  email: string,
  name: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`list users: ${error.message}`);
  const existing = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (existing) {
    // Re-confirm + set the known demo password so login always works.
    const { error: upErr } = await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    check(`update ${email}`, upErr);
    return existing.id;
  }
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });
  if (cErr || !created.user) {
    throw new Error(`create ${email}: ${cErr?.message ?? "no user"}`);
  }
  return created.user.id;
}

async function main(): Promise<void> {
  // 1. Resolve the 立心 admin by email WITHOUT touching its password (seed:admin
  //    owns that). It must already exist.
  {
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
    const found = data?.users.find(
      (u) => u.email?.toLowerCase() === LIXIN_EMAIL.toLowerCase(),
    );
    if (!found) {
      console.error(
        "✗ 立心 admin not found. Run `pnpm seed:admin` first, then re-run.",
      );
      process.exit(1);
    }
    NGOS[0].repId = found.id;
  }

  // Demo reps (NGO A/B) are created or password-synced to the demo password.
  for (const ngo of NGOS) {
    if (ngo.repEmail) ngo.repId = await resolveAuthUser(ngo.repEmail, ngo.repName);
  }
  console.log("✓ rep accounts ready");

  // 2. Upsert NGOs + public.users + cases + stores (fixed UUIDs).
  check(
    "ngos",
    (
      await admin.from("ngos").upsert(
        NGOS.map((n) => ({ id: n.ngoId, name: n.ngoName })),
        { onConflict: "id" },
      )
    ).error,
  );
  check(
    "users",
    (
      await admin.from("users").upsert(
        NGOS.map((n) => ({
          id: n.repId,
          email: n.repEmail ?? LIXIN_EMAIL,
          name: n.repName,
          role: n.key === "lixin" ? "lixin" : "ngo_rep",
          ngo_id: n.ngoId,
          created_by_id: NGOS[0].repId,
        })),
        { onConflict: "id" },
      )
    ).error,
  );
  check(
    "cases",
    (
      await admin.from("cases").upsert(
        NGOS.flatMap((n) =>
          n.cases.map((c) => ({
            id: c.id,
            name: c.name,
            id_number: c.idNumber,
            note: c.note,
            ngo_id: n.ngoId,
            created_by_id: n.repId,
          })),
        ),
        { onConflict: "id" },
      )
    ).error,
  );
  check(
    "stores",
    (
      await admin.from("stores").upsert(
        NGOS.flatMap((n) =>
          n.stores.map((s) => ({
            id: s.id,
            name: s.name,
            owner_ngo_rep_id: n.repId,
          })),
        ),
        { onConflict: "id" },
      )
    ).error,
  );
  console.log("✓ NGOs / users / cases / stores upserted");

  // 3. Purge this cycle's transactional rows + demo receipts (FK-safe order).
  const allStoreIds = NGOS.flatMap((n) => n.stores.map((s) => s.id));
  const allNgoIds = NGOS.map((n) => n.ngoId);
  const repIds = NGOS.map((n) => n.repId);
  const demoRepIds = NGOS.filter((n) => n.key !== "lixin").map((n) => n.repId);

  // 3a. receipts (rows + storage files) before settlements (FK on settlement_id).
  for (const repId of demoRepIds) {
    const { data: files } = await admin.storage.from("receipts").list(repId);
    if (files && files.length) {
      await admin.storage
        .from("receipts")
        .remove(files.map((f) => `${repId}/${f.name}`));
    }
  }
  check(
    "purge receipts",
    (await admin.from("receipts").delete().in("ngo_rep_id", demoRepIds)).error,
  );
  // 3b. settlements (cascade breakdown) → status → collections → assignments →
  //     submissions → demands.
  check(
    "purge settlements",
    (
      await admin
        .from("settlements")
        .delete()
        .eq("year_month", MONTH)
        .in("ngo_rep_id", repIds)
    ).error,
  );
  check(
    "purge status",
    (
      await admin
        .from("store_collection_status")
        .delete()
        .eq("year_month", MONTH)
        .in("store_id", allStoreIds)
    ).error,
  );
  check(
    "purge collections",
    (
      await admin
        .from("voucher_collections")
        .delete()
        .eq("year_month", MONTH)
        .in("collected_at_store_id", allStoreIds)
    ).error,
  );
  check(
    "purge assignments",
    (
      await admin
        .from("voucher_assignments")
        .delete()
        .eq("year_month", MONTH)
        .in("store_id", allStoreIds)
    ).error,
  );
  check(
    "purge submissions",
    (
      await admin
        .from("monthly_demand_submissions")
        .delete()
        .in("year_month", [MONTH, NEXT])
        .in("ngo_id", allNgoIds)
    ).error,
  );
  check(
    "purge demands",
    (
      await admin
        .from("monthly_demands")
        .delete()
        .in("year_month", [MONTH, NEXT])
        .in("store_id", allStoreIds)
    ).error,
  );
  console.log("✓ previous cycle data purged");

  // 4. Monthly demands (M and M+1) + submissions.
  const demands: Record<string, unknown>[] = [];
  for (const n of NGOS) {
    for (const s of n.stores) {
      demands.push({ year_month: MONTH, ngo_id: n.ngoId, store_id: s.id, quantity: s.demandM, created_by_id: n.repId });
      demands.push({ year_month: NEXT, ngo_id: n.ngoId, store_id: s.id, quantity: s.demandNext, created_by_id: n.repId });
    }
  }
  check("demands", (await admin.from("monthly_demands").insert(demands)).error);
  const submissions = NGOS.filter((n) => n.submitted).map((n) => ({
    year_month: MONTH,
    ngo_id: n.ngoId,
    submitted_by_id: n.repId,
  }));
  check(
    "submissions",
    (await admin.from("monthly_demand_submissions").insert(submissions)).error,
  );
  console.log("✓ demands + submissions");

  // 5. 發券: allocate sequential serials per store, round-robin to NGO cases.
  let counter = 10001;
  const assignments: Record<string, unknown>[] = [];
  for (const n of NGOS) {
    for (const s of n.stores) {
      for (let i = 0; i < s.demandM; i++) {
        const serial = String(counter++).padStart(5, "0");
        s.serials.push(serial);
        assignments.push({
          serial_number: serial,
          store_id: s.id,
          case_id: n.cases[i % n.cases.length].id,
          year_month: MONTH,
          assigned_by_id: n.repId,
        });
      }
    }
  }
  check("assignments", (await admin.from("voucher_assignments").insert(assignments)).error);
  console.log(`✓ 發券 — ${assignments.length} 張`);

  // 6. 回收: own serials at own store; a few at the sibling store (cross-store).
  const collections: Record<string, unknown>[] = [];
  for (const n of NGOS) {
    const [s0, s1] = n.stores;
    const pairs: [StoreCfg, StoreCfg][] = [
      [s0, s1],
      [s1, s0],
    ];
    for (const [store, sibling] of pairs) {
      const ownSerials = store.serials.slice(0, store.own);
      const crossSerials = store.serials.slice(store.own, store.own + store.cross);
      for (const serial of ownSerials) {
        collections.push({ serial_number: serial, collected_at_store_id: store.id, year_month: MONTH, scanned_by_id: n.repId });
      }
      // redeemed at the sibling store → trigger marks is_cross_store=true,
      // compensation accrues to the sibling (where it was collected).
      for (const serial of crossSerials) {
        collections.push({ serial_number: serial, collected_at_store_id: sibling.id, year_month: MONTH, scanned_by_id: n.repId });
      }
    }
  }
  check("collections", (await admin.from("voucher_collections").insert(collections)).error);
  const crossCount = NGOS.reduce(
    (sum, n) => sum + n.stores.reduce((a, s) => a + s.cross, 0),
    0,
  );
  console.log(`✓ 回收 — ${collections.length} 張（含 ${crossCount} 張他店券）`);

  // 7. 完成回收 for every demo store.
  check(
    "status",
    (
      await admin.from("store_collection_status").insert(
        allStoreIds.map((id) => ({
          year_month: MONTH,
          store_id: id,
          completed_by_id: NGOS.find((n) => n.stores.some((s) => s.id === id))!.repId,
        })),
      )
    ).error,
  );
  console.log("✓ 完成回收");

  // 8. Settlements (M) + per-store breakdown. Mirrors generate_settlements():
  //    prepay = Σ M+1 demand×100; compensation = Σ 他店券 collected at the store×100.
  //    (立心 can re-run the W5 "產生結算單" button later — it reproduces these.)
  const settlements: Record<string, unknown>[] = [];
  const breakdown: Record<string, unknown>[] = [];
  for (const n of NGOS) {
    const [s0, s1] = n.stores;
    // 他店券 collected AT a store = the sibling's cross count.
    const crossAt = new Map<string, number>([
      [s0.id, s1.cross],
      [s1.id, s0.cross],
    ]);
    let prepay = 0;
    let comp = 0;
    for (const s of n.stores) {
      const sPrepay = s.demandNext * VOUCHER;
      const sComp = (crossAt.get(s.id) ?? 0) * VOUCHER;
      prepay += sPrepay;
      comp += sComp;
      breakdown.push({
        settlement_id: n.settlementId,
        store_id: s.id,
        prepay_amount: sPrepay,
        compensation_amount: sComp,
        total_amount: sPrepay + sComp,
      });
    }
    settlements.push({
      id: n.settlementId,
      year_month: MONTH,
      ngo_rep_id: n.repId,
      prepay_amount: prepay,
      compensation_amount: comp,
      total_amount: prepay + comp,
      status: "pending_review",
    });
  }
  check("settlements", (await admin.from("settlements").insert(settlements)).error);
  check(
    "breakdown",
    (await admin.from("settlement_store_breakdown").insert(breakdown)).error,
  );
  console.log("✓ 結算單 + 明細");

  // 9. Receipts for the two NGO reps (立心 doesn't upload to itself).
  for (const n of NGOS) {
    if (n.key === "lixin") continue;
    const store = n.stores[0];
    const path = `${n.repId}/${randomUUID()}.png`;
    const { error: upErr } = await admin.storage
      .from("receipts")
      .upload(path, PLACEHOLDER_PNG, { contentType: "image/png", upsert: true });
    check(`upload receipt ${n.key}`, upErr);
    check(
      `receipt ${n.key}`,
      (
        await admin.from("receipts").insert({
          photo_url: path,
          received_date: RECEIVED_DATE,
          store_id: store.id,
          ngo_rep_id: n.repId,
          amount: store.demandNext * VOUCHER,
          settlement_id: n.settlementId,
        })
      ).error,
    );
  }
  console.log("✓ 收據");

  // ---- summary ----------------------------------------------------------
  console.log("\n──────────────────────────────────────────────");
  console.log(` 萬華待用券 — 示範資料已建立（月份 ${MONTH}，預付來自 ${NEXT}）`);
  console.log("──────────────────────────────────────────────");
  console.log(" 登入帳號：");
  console.log(`   立心（管理員＋立心NGO）  ${LIXIN_EMAIL}  （沿用 seed:admin 密碼）`);
  for (const n of NGOS) {
    if (!n.repEmail) continue;
    console.log(`   ${n.ngoName}            ${n.repEmail}  /  ${DEMO_PASSWORD}`);
  }
  console.log("\n 已涵蓋：3 NGO · 9 個案 · 6 店家 · 需求(本月+下月) · 提交(芒草心未提交)");
  console.log(`          發券 ${assignments.length} 張 · 回收 ${collections.length} 張（他店券 ${crossCount}）· 完成回收 · 結算單 3 份 · 收據 2 張`);
  console.log("──────────────────────────────────────────────");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("\n✗ Demo seed failed:", message);
  process.exit(1);
});
