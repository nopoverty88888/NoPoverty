# 權限矩陣 (Role-Based Access Control)

Implemented via Supabase RLS policies.

> **View surfaces** (still just two roles): mobile `M1–M11` (any logged-in user; 立心 acts as 代表 for its own NGO), admin `/admin/*` `W1–W8` (lixin only), and the shared desktop `/reports` (any logged-in user — RLS auto-scopes; the report views use `security_invoker`). The matrix below is enforced regardless of which surface issues the query.

## 角色

| Role | 描述 |
|---|---|
| `lixin` | 立心，admin 全域可見 **＋** 同時也是自家 NGO 的代表（建個案/店家、發券、月底回收、上傳收據） |
| `ngo_rep` | NGO 代表，只能看自己 NGO 的資料 |

### 立心的雙重身份 (重要)
立心基金會本身也是參與計畫的 NGO（有自己的店家/個案）。所以立心 user 同時擁有兩種能力：
- **Admin 能力**（透過 `role='lixin'`）：讀寫所有 NGO 的資料、建帳號、審核結算
- **NGO 代表能力**（透過 `ngo_id = 立心 NGO id`）：對自家 NGO 的個案/店家做 CRUD、發券、月底回收、上傳收據

實作上：立心 user 在 mobile app 看到的是「自家 NGO 的 NGO 代表畫面」（M3–M11），在 web admin 看到的是「全域 admin 畫面」（W3–W8）。同一個帳號可登入兩端。

## 權限矩陣

| Resource | lixin (立心) | ngo_rep (NGO 代表) |
|---|---|---|
| **ngos** | CRUD all | Read own only |
| **users** | CRUD all (含建立 ngo_rep 帳號) | Read self only |
| **cases** | Read all ＋ CRUD where `ngo_id = my ngo_id` (自家) | CRUD where `ngo_id = my ngo_id` |
| **stores** | Read all ＋ CRUD where `owner_ngo_rep_id = my user_id` (自家) | CRUD where `owner_ngo_rep_id = my user_id` |
| **monthly_demands** | Read all ＋ CRUD where `ngo_id = my ngo_id` (自家) | CRUD where `ngo_id = my ngo_id` |
| **voucher_assignments** | Read all ＋ CRUD where `assigned_by_id = my user_id` | CRUD where `assigned_by_id = my user_id` |
| **voucher_collections** | Read all ＋ CRUD where `scanned_by_id = my user_id` | CRUD where `scanned_by_id = my user_id` |
| **settlements** | Read all + Update status (審核) ＋ Read where `ngo_rep_id = my user_id` (自家) | Read where `ngo_rep_id = my user_id` |
| **settlement_store_breakdown** | Read all | Read where parent settlement is mine |
| **receipts** | Read all ＋ CRUD where `ngo_rep_id = my user_id` (自家) | CRUD where `ngo_rep_id = my user_id` |

**Note：** lixin user 的「CRUD 自家」能力是因為他們 `ngo_id` 指向立心 NGO，所以他們在系統上「也是一位 NGO 代表」。Write policy 的判斷條件 (e.g. `owner_ngo_rep_id = auth.uid()`) 對 lixin 跟 ngo_rep 都適用，所以 RLS 寫一條就同時涵蓋兩種角色。

## RLS Policy 範例 (Supabase SQL)

### `cases`
```sql
-- NGO 代表只能看自己 NGO 的個案
CREATE POLICY "ngo_rep_read_own_cases" ON cases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'ngo_rep'
        AND users.ngo_id = cases.ngo_id
    )
  );

-- NGO 代表只能寫自己 NGO 的個案
CREATE POLICY "ngo_rep_write_own_cases" ON cases
  FOR INSERT WITH CHECK (
    ngo_id = (SELECT ngo_id FROM users WHERE id = auth.uid())
  );

-- 立心可以讀所有
CREATE POLICY "lixin_read_all_cases" ON cases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'lixin'
    )
  );
```

### `stores`
```sql
-- NGO 代表只能讀自己的店家
CREATE POLICY "ngo_rep_read_own_stores" ON stores
  FOR SELECT
  USING (owner_ngo_rep_id = auth.uid());

-- NGO 代表只能新增/更新自己擁有的店家
CREATE POLICY "ngo_rep_write_own_stores" ON stores
  FOR ALL
  USING (owner_ngo_rep_id = auth.uid())
  WITH CHECK (owner_ngo_rep_id = auth.uid());

-- 立心可讀所有
CREATE POLICY "lixin_read_all_stores" ON stores
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'lixin'
  );
```

Repeat similar patterns for other tables.

## 帳號建立流程

NGO 代表不能自助註冊。流程：
1. 立心在 Web admin W3 填入：email、name、所屬 NGO
2. 後端呼叫 Supabase Admin API: `auth.admin.createUser({ email, password: <random>, email_confirm: false })`
3. 立心可以選擇：寄初始密碼信 / 寄重設密碼信
4. 後端同時在 `users` 表插入一筆：`{ id: auth.id, email, name, role: 'ngo_rep', ngo_id, created_by_id: lixin.id }`

立心帳號的建立應該在 deploy 階段透過 seed script 處理，不開放 UI。
