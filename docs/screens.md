# Screens — 畫面規格

**單一 Next.js PWA 應用**（不是兩個 app）。同一個網址 `app.wanhua-vouchers.org`，依登入身份顯示不同畫面：

- **Web admin 畫面 (W1–W8)** — `/admin/*`，僅 `role='lixin'` 可進入（帳號管理、結算審核、全域檢視）
- **工作區畫面 (M1–M11)** — `/app/(app)/...`，**桌面優先、響應式**，所有登入 user 可進入（立心也用此端做自家 NGO 的代表工作）。唯一真正需要手機的是 M7 月底回收的相機掃描。
- **共用報表電腦版 (Reports)** — `/reports`，所有登入 user 可進入；RLS 自動限定範圍（立心看全部 NGO、NGO 代表看自家）。含 CSV 下載。

**重要：立心人員同一帳號擁有雙重身份** — 同一個 Supabase 帳號，透過左側 sidebar 切換：
- **立心管理** 區（W1–W8）：帳號管理、結算審核、全域檢視（僅 `role=lixin` 顯示）
- **工作區**（M1–M11）：對自家「立心 NGO」的個案/店家做代表工作

全部畫面共用一個**桌面優先、響應式**的左側 sidebar（`components/shared/app-shell.tsx`）。NGO 代表 sidebar 只有「工作區 + 報表」；立心多一個「立心管理」。手機上 sidebar 收合成漢堡選單 + 抽屜。

**PWA install：** 可在桌面或手機用瀏覽器「加入主畫面」安裝（不上 App Store）。手機主要用於 M7 月底回收的相機掃描。

---

## Web (立心 admin)

### W1. 登入頁
- Email + Password
- Supabase Auth

### W2. Dashboard 首頁
- 本月狀態總覽：本月需求量、已發券數、已回收數、待結算金額
- 待審核項目：尚未審核的結算單、尚未審核的收據
- 快速連結：本月結算單、本月收據

### W3. NGO 帳號管理
**一個 NGO = 一個帳號**（NGO 實體與其 NGO 代表登入合併為單一管理單位；系統角色仍為 `ngo_rep`）。
- 列表：所有 NGO 帳號
- 新增 NGO 帳號（NGO name、contact、代表 email + name）→ 一步同時建立 NGO record + 其 Supabase Auth 代表帳號 + 寄初始密碼信
- 編輯、停用帳號

### W4. 月度需求總覽
- 篩選：年月
- 表格：列=店家、欄=各 NGO、值=該 NGO 對此店的需求量、總計欄
- 唯讀（NGO 代表填寫）

### W5. 月度結算單列表
- 篩選：年月、status (pending_review / approved / paid)
- 表格：年月、NGO 代表、prepay_amount、compensation_amount、total_amount、status、actions
- 點進去 → W6

### W6. 結算單詳情頁
- Header：年月、NGO 代表、總金額
- Breakdown 表（settlement_store_breakdown）：列=店家、欄=下月預付、本月補款、合計
- 補款明細：列=他店券流水號、原指派店家、現在收到的店家、原指派個案
- Actions：審核通過、退回 (附原因)、標記已匯款
- 下載 CSV 按鈕（按店家展開的明細表）

### W7. 收據檢視
- 篩選：年月、NGO 代表、店家
- 列表：每筆收據縮圖 + 金額 + 收到日期 + 對應結算單
- 點開：放大看照片
- 唯讀（立心不上傳）

### W8. 全域使用情況儀表板 (R2)
- 篩選：年月
- 各店家用量圖表（bar chart）
- 各 NGO 用量比較
- 「持續被跨店使用」的店家列表（提示重新分配需求）
- 個案使用次數 top 列表

---

## Mobile (NGO 代表)

### M1. 登入頁
- Email + Password
- 「忘記密碼」連結

### M2. 首頁 (我的 Dashboard)
- 顯示：當月已發券數、已回收數、待結算金額、本月剩餘待跑店家數
- 大按鈕：「發券給個案」、「月底回收」、「上傳收據」
- 下方：本月待辦事項列表（尚未跑的店家、未上傳的收據）

### M3. 個案管理
- 列表：我所屬 NGO 的個案（姓名、身分證後 4 碼）
- 新增個案：姓名、身分證字號 (full input)、備註
- 編輯、刪除（soft delete）

### M4. 店家管理
- 列表：我負責的店家（名稱、地址、本月發券數、本月回收數）
- 新增店家：名稱、地址、聯絡資訊
- 編輯、刪除（soft delete）

### M5. 月度需求表 (本月)
- 顯示：本月年月、我負責的各店家列表
- 每個店家一個輸入欄：需要的張數
- 上方提示：上月實際使用量 (R2)
- 儲存按鈕 → 寫入 monthly_demands

### M6. ★ 第一次上傳：發券給個案 (核心畫面)
**這是 STEP 2 的核心 UI。**

Flow:
1. 選擇店家（從我的店家清單）
2. 選擇個案（從我的個案清單，可搜尋姓名）
3. 輸入發給此個案的流水號：
   - R1: 手動輸入（單一輸入框，可連續輸入多個）
   - R2: CSV 上傳（一張試算表 N 行）
   - R2: 相機掃描（連續掃多張）
4. 預覽指派列表：流水號 + 店家 + 個案
5. 確認送出 → 寫入 voucher_assignments

Errors:
- 流水號當月已被指派過 → 紅字提示「此流水號本月已指派給 [個案 X]」
- 流水號格式錯誤（非 5 位數字）→ 提示

### M7. ★ 第二次上傳：月底回收 (核心畫面)
**這是 STEP 4 的核心 UI。**

Flow:
1. 選擇今天要去的店家
2. 進入掃描/輸入畫面：
   - R1: 手動輸入流水號（連續）
   - R2: 相機掃描（連續掃多張，每張識別 → 顯示 → 確認）
3. 即時顯示：
   - 已掃張數
   - 其中本店券 X 張、他店券 Y 張
   - 目前累計補款金額 = Y × 100
4. 完成按鈕 → 寫入 voucher_collections
5. 結算頁（M8）

Errors:
- 流水號未在 voucher_assignments 找到 → 紅字「此流水號未發放紀錄，請確認」
- 同一張券已掃過 → 提示

### M8. 該店家結算頁
完成 M7 後或從 M2 進入。
- 顯示：該店家本月收到 X 張券、其中他店券 Y 張、補款金額 Z 元
- 他店券明細列表：流水號 + 原指派店家 + 原指派個案
- 按鈕：完成回收（標記此店此月完成）

### M9. 上傳收據
- 選擇店家（已完成本月回收的店家才出現）
- 拍照 / 從相簿選 → 顯示縮圖
- 收到日期：date picker (default 今天)
- 金額：text input
- 送出 → 寫入 receipts，連結到本月該 NGO 代表的 settlement

### M10. 個案使用紀錄 (新功能 1 對應)
- 篩選：年月（default 本月）
- 列表：我的個案 × 使用了哪些券 × 在哪家店
- 可匯出 CSV

### M11. 我的本月結算單
- 顯示：本月年月、總金額、status
- Breakdown 表：每家店要分多少現金（下月預付 + 補款）
- 「列印 / 寄送 PDF」按鈕（讓代表帶到店家時對帳用）

---

## Reports（共用報表電腦版 · `/reports`）

所有登入 user 皆可進入；RLS 自動限定範圍（立心＝全部 NGO、NGO 代表＝自家）。每張報表含年月篩選與 CSV 下載。

- **個案使用紀錄** (`/reports/usage`) — 來源 `case_usage_view`
- **月度結算單** (`/reports/settlement`) — 來源 `settlements` + `settlement_store_breakdown`
- **店家月度收券摘要** (`/reports/stores`) — 來源 `store_monthly_summary_view`
- **月度需求總覽** (`/reports/demands`) — 來源 `monthly_demands`

## 共用元件

- **VoucherSerialInput** — 5 位數字輸入，自動 trim，整合 OCR (R2)
- **CaseSearchSelect** — 個案搜尋下拉
- **StoreSelect** — 店家下拉
- **PhotoUploader** — 拍照 / 從相簿，上傳到 Supabase Storage
- **MonthPicker** — 'YYYY-MM' 選擇器

---

## Navigation

### Web (立心)
```
首頁 (W2)
├ 帳號管理 (W3)
├ 月度需求 (W4)
├ 結算單 (W5 → W6)
├ 收據 (W7)
└ 儀表板 (W8) [R2]
```

### Mobile (NGO 代表)
```
首頁 (M2)
├ 個案管理 (M3)
├ 店家管理 (M4)
├ 本月需求 (M5)
├ 發券 (M6) ★
├ 月底回收 (M7 → M8) ★
├ 上傳收據 (M9)
├ 個案使用紀錄 (M10)
└ 我的結算單 (M11)
```
