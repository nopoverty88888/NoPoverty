# 資料模型 (Schema)

## ER 概覽

```
ngos ──┬─< users (role=ngo_rep)
       └─< cases
           
users (ngo_rep) ──< stores
                ──< monthly_demands
                ──< voucher_assignments ──> cases
                ──< voucher_collections
                ──< receipts
                ──< settlements

stores ──< voucher_assignments
       ──< voucher_collections
       ──< receipts
```

---

## Tables

### `ngos`
NGO 單位 (e.g. 立心基金會、勵馨基金會)。立心建立。
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | unique |
| contact_info | text | optional |
| created_at | timestamptz default now() | |

### `users`
所有登入帳號。立心建立 (含 NGO 代表帳號)。Supabase Auth 對應。
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | matches auth.users.id |
| email | text NOT NULL unique | |
| name | text NOT NULL | |
| role | text NOT NULL | enum: 'lixin', 'ngo_rep' |
| ngo_id | uuid FK → ngos.id NOT NULL | **always required** — even lixin users 指向立心 NGO 那筆 |
| created_at | timestamptz default now() | |
| created_by_id | uuid FK → users.id | who created this account |

Constraint: `ngo_id IS NOT NULL` (所有 user 都隸屬某個 NGO，包括立心)。

**重要：立心是雙重身份**
立心人員的 user record：`role = 'lixin'` 且 `ngo_id = 立心 NGO 的 id`。
RLS 上他們：
- 因為 `role='lixin'` → 可讀寫所有 NGO 的資料（admin）
- 因為 `ngo_id = 立心 NGO` → 自家的個案/店家/發券/回收都歸他們所有

**Seed data：** 系統初始化時要先建立立心的 NGO record，再用該 ngo_id 建立第一位立心 admin 帳號。

### `cases` (個案)
NGO 代表自建。
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| id_number | text NOT NULL | 身分證字號，明碼儲存 (v1)；UI 顯示後 4 碼 |
| ngo_id | uuid FK → ngos.id NOT NULL | |
| created_by_id | uuid FK → users.id | |
| created_at | timestamptz default now() | |

Unique: `(ngo_id, id_number)`

### `stores` (店家)
NGO 代表自建。一個店家屬於一位 NGO 代表 (per 「不輪替」設定)。
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| address | text | optional |
| contact | text | optional |
| owner_ngo_rep_id | uuid FK → users.id NOT NULL | role 必須是 ngo_rep |
| created_at | timestamptz default now() | |

### `monthly_demands` (月度需求表)
NGO 代表每月填寫對各店家的需求量。
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| year_month | text NOT NULL | format 'YYYY-MM' |
| ngo_id | uuid FK → ngos.id NOT NULL | |
| store_id | uuid FK → stores.id NOT NULL | |
| quantity | int NOT NULL | 張數 |
| created_by_id | uuid FK → users.id | |
| created_at | timestamptz default now() | |

Unique: `(year_month, ngo_id, store_id)`

### `voucher_assignments` (流水號發放紀錄 — 第一次上傳)
NGO 代表發券給個案前上傳。Source of truth for "which store does this voucher belong to."
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| serial_number | text NOT NULL | 5 位純數字 (e.g. "27031") |
| store_id | uuid FK → stores.id NOT NULL | 預期由哪家店兌換 |
| case_id | uuid FK → cases.id NOT NULL | 發給哪個個案 |
| year_month | text NOT NULL | format 'YYYY-MM' |
| assigned_by_id | uuid FK → users.id | NGO 代表 |
| assigned_at | timestamptz default now() | |

Unique: `(year_month, serial_number)` — 同月份的流水號不能重複指派

### `voucher_collections` (月底回收紀錄 — 第二次上傳)
NGO 代表月底到店家收券後上傳的每張券紀錄。
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| serial_number | text NOT NULL | |
| collected_at_store_id | uuid FK → stores.id NOT NULL | NGO 代表掃描時所在的店家 |
| year_month | text NOT NULL | format 'YYYY-MM' |
| scanned_by_id | uuid FK → users.id | NGO 代表 |
| scanned_at | timestamptz default now() | |
| is_cross_store | boolean | computed at insert: 比對 voucher_assignments 的 store_id ≠ collected_at_store_id |
| originally_assigned_store_id | uuid FK → stores.id | 從 voucher_assignments lookup 來的 (cache) |
| originally_assigned_case_id | uuid FK → cases.id | 從 voucher_assignments lookup 來的 (cache) |

Unique: `(year_month, serial_number)` — 同張券不會被掃兩次

### `settlements` (立心月度結算單)
系統在月底回收完成後產生。每位 NGO 代表一筆。
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| year_month | text NOT NULL | format 'YYYY-MM' |
| ngo_rep_id | uuid FK → users.id NOT NULL | role = 'ngo_rep' |
| prepay_amount | int NOT NULL | 下月預付 = Σ stores 的下月需求量 × 100 |
| compensation_amount | int NOT NULL | 補款 = Σ stores 收到的他店券張數 × 100 |
| total_amount | int NOT NULL | = prepay_amount + compensation_amount |
| status | text NOT NULL | enum: 'pending_review', 'approved', 'paid' |
| approved_by_id | uuid FK → users.id | 立心 |
| approved_at | timestamptz | |
| paid_at | timestamptz | 立心匯款日 |

Unique: `(year_month, ngo_rep_id)`

### `settlement_store_breakdown` (結算單明細 — 給 NGO 代表看的清單)
讓 NGO 代表帶現金到店家時知道每家店要給多少。
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| settlement_id | uuid FK → settlements.id NOT NULL | |
| store_id | uuid FK → stores.id NOT NULL | |
| prepay_amount | int NOT NULL | 該店下月預付 |
| compensation_amount | int NOT NULL | 該店本月補款 |
| total_amount | int NOT NULL | |

Unique: `(settlement_id, store_id)`

### `receipts` (收據上傳紀錄)
NGO 代表把現金交付店家後拍照上傳。
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| photo_url | text NOT NULL | Supabase Storage URL |
| received_date | date NOT NULL | 收到收據的日期 |
| store_id | uuid FK → stores.id NOT NULL | |
| ngo_rep_id | uuid FK → users.id NOT NULL | |
| amount | int NOT NULL | 該收據金額 |
| settlement_id | uuid FK → settlements.id | 對應到哪期結算 |
| uploaded_at | timestamptz default now() | |

---

## Computed views

### `case_usage_view` (個案使用紀錄表 — 新功能 1)
```sql
SELECT
  c.id AS case_id,
  c.name AS case_name,
  c.ngo_id,
  s.name AS used_at_store_name,
  vc.serial_number,
  vc.year_month,
  vc.scanned_at
FROM voucher_collections vc
JOIN voucher_assignments va
  ON vc.serial_number = va.serial_number
  AND vc.year_month = va.year_month
JOIN cases c ON va.case_id = c.id
JOIN stores s ON vc.collected_at_store_id = s.id;
```

### `store_monthly_summary_view` (店家月度收券摘要)
```sql
SELECT
  s.id AS store_id,
  s.name AS store_name,
  vc.year_month,
  COUNT(*) AS total_vouchers_received,
  COUNT(*) FILTER (WHERE vc.is_cross_store) AS cross_store_count,
  COUNT(*) FILTER (WHERE vc.is_cross_store) * 100 AS compensation_owed
FROM voucher_collections vc
JOIN stores s ON vc.collected_at_store_id = s.id
GROUP BY s.id, s.name, vc.year_month;
```

---

## Key business rules

1. **`is_cross_store` 在第二次上傳時計算**: insert voucher_collections 時，trigger 或 application code 去 lookup `voucher_assignments`，比對 `store_id` 是否相等。
2. **流水號的 source of truth 是 voucher_assignments**: 沒上傳過的流水號 = 系統未知 = 不存在。
3. **每個月份獨立**: voucher 跨月不通用 (per 「當月使用」決定)。所以 unique constraints 都帶 year_month。
4. **settlement 是系統產生的**: NGO 代表完成所有負責店家的第二次上傳後，自動 (或手動觸發) 產生該月結算單。
5. **deletion 應該是 soft delete** (對 cases, stores, receipts)，避免歷史紀錄消失。

---

## 索引建議

```sql
CREATE INDEX idx_voucher_assignments_lookup ON voucher_assignments (year_month, serial_number);
CREATE INDEX idx_voucher_collections_lookup ON voucher_collections (year_month, serial_number);
CREATE INDEX idx_voucher_collections_store_month ON voucher_collections (collected_at_store_id, year_month);
CREATE INDEX idx_settlements_lookup ON settlements (year_month, ngo_rep_id);
CREATE INDEX idx_receipts_settlement ON receipts (settlement_id);
```
