# 萬華協力聯盟 · 待用券管理系統

This file gives Claude Code the project-level context it needs to work on this codebase. Read `docs/spec.md`, `docs/data-model.md`, and `docs/screens.md` for full functional/data/UI specs.

## What this app does

A voucher management system for the Wanhua Cooperative Alliance (萬華協力聯盟). It coordinates 待用券 (pre-paid meal vouchers) distributed by NGOs to vulnerable people (個案), redeemable at partner restaurants. The app digitizes a monthly cycle that's currently done in spreadsheets.

Key actors:
- **立心 (Lixin Foundation)** — admin (sees everything) **AND** also one of the NGOs (has their own cases/stores). Lixin users have BOTH admin powers AND NGO 代表 capabilities for their own NGO. They can log into both the web admin AND the mobile app with the same account.
- **NGO 代表** — frontline worker, manages their own cases/stores/vouchers (desktop workspace; 月底回收 scan on phone), and views/downloads their own reports on the shared `/reports` (RLS-scoped to their NGO)

Three view surfaces, two roles (`lixin`, `ngo_rep`):
- **Workspace (M1–M11)** — **desktop-first, responsive**; any authenticated user (立心 acts as 代表 for its own NGO here). Only the 月底回收 camera voucher-scan really needs a phone.
- **Admin desktop (`/admin/*`, W1–W8)** — 立心 only: account management, settlement approval, global views.
- **Reports desktop (`/reports`)** — shared; RLS auto-scopes (立心 = all NGOs, 代表 = own). View + CSV download.

Key business rule: vouchers cost NT$100 each; if a case uses an NGO's voucher at the wrong store, the receiving store needs cash compensation. The system calculates this automatically.

## Tech stack

**Single Next.js 14 PWA — no native app, no app store.** One **desktop-first, responsive** app: a shared left-sidebar shell (`components/shared/app-shell.tsx`, role-aware) serves the NGO workspace, 立心 admin, and reports, gated by route group. It collapses to a hamburger + drawer on phones — and the 月底回收 camera voucher-scan is the one screen really meant for a phone. Installable via browser "Add to Home Screen".

- **Framework:** Next.js 14 App Router (React 18)
- **PWA:** `next-pwa` (service worker + manifest.json for "Add to Home Screen")
- **Backend + DB + Auth + Storage:** Supabase (PostgreSQL + RLS + Storage)
- **OCR:** `tesseract.js` (in-browser OCR, no AI API, works offline once cached)
- **Camera:** browser `getUserMedia` API + `<video>` element
- **CSV export:** `papaparse`
- **Styling:** Tailwind CSS + shadcn/ui for admin components
- **Forms:** `react-hook-form` + `zod`
- **Language:** TypeScript strict mode everywhere

Repo layout (single Next.js app, no monorepo needed):
```
/.github
  /workflows
    keep-alive.yml      # pings Supabase every 5 days to prevent free-tier pause
/app
  /(admin)/admin        # Web admin for 立心 (role=lixin only) — URLs are /admin/*
    /dashboard
    /ngos               # W3 NGO 帳號管理 — one NGO = one account (entity + its 代表 login together)
    /demands
    /settlements
    /receipts
    /insights           # W8 全域儀表板
  /(app)                # NGO workspace (desktop-first, responsive) — ANY authenticated user (incl. 立心 for its own NGO)
    /                   # M2 dashboard
    /cases
    /stores
    /demands
    /distribute         # M6 第一次上傳
    /collect            # M7 第二次上傳
    /receipts
    /usage              # M10 個案使用紀錄
    /settlement         # M11 我的結算單
  /reports              # Shared DESKTOP reports — ANY authenticated user; RLS-scoped
    /usage /settlement /stores /demands   # 立心 sees all NGOs, NGO 代表 sees own; each downloadable as CSV
  /login                # W1 / M1 login
  /api                  # Only for server-side ops (e.g. admin create user)
/components
  /ui                   # shadcn primitives
  /shared               # VoucherSerialInput, CameraScanner, etc.
/lib
  /supabase             # client + server helpers
  /schemas              # zod validation schemas
  /business             # settlement calculation, cross-store logic
/supabase
  /migrations           # SQL migration files
  /seed.sql             # seed lixin NGO + first admin user
/docs                   # spec.md, data-model.md, screens.md, roles.md
/public
  /manifest.json        # PWA manifest
  /icon-*.png           # PWA icons
```

## Build & run

```bash
# Install
pnpm install

# Run dev
pnpm dev

# Build
pnpm build

# DB migrations (Supabase CLI)
pnpm supabase start             # local supabase
pnpm supabase migration new <name>
pnpm supabase db push           # to production

# Generate TS types from DB
pnpm supabase gen types typescript --local > lib/supabase/types.ts

# Tests
pnpm test
```

## Supabase keep-alive (free tier)

The Supabase free tier pauses a project after 7 days of no API requests. To prevent this, this repo includes a GitHub Action that pings the Supabase REST API every 5 days.

**File:** `.github/workflows/keep-alive.yml`

```yaml
name: Keep Supabase Alive
on:
  schedule:
    - cron: '0 12 */5 * *'   # every 5 days at 12:00 UTC
  workflow_dispatch:           # also runnable manually

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase REST API
        run: |
          curl --fail \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            "${{ secrets.SUPABASE_URL }}/rest/v1/?select=*"
```

**Required GitHub secrets** (Settings → Secrets and variables → Actions):
- `SUPABASE_URL` — e.g. `https://xxxxx.supabase.co`
- `SUPABASE_ANON_KEY` — the `anon public` key

This action is **essential during development and quiet months** (e.g. when no NGO 代表 is actively using the system). Once the app is in daily production use, this can be removed.

## PWA install flow

When NGO 代表 first visits `https://app.wanhua-vouchers.org` on phone:
- iOS Safari: Share → Add to Home Screen
- Android Chrome: shows "Install" prompt automatically (via manifest)
- After install: opens fullscreen, looks like a native app

No App Store submission, no Play Store submission, no Apple Developer fee.

## Browser support

- Chrome 90+ (Android)
- Safari 14+ (iOS) — verify `getUserMedia` works in PWA mode
- Edge / Chrome on desktop (for 立心 admin)

## Coding conventions

- **TypeScript strict mode** — no `any` unless explicitly justified
- **Validation:** zod schemas in `/packages/shared/schemas`, used by both web & mobile
- **Date format in DB:** `year_month` as `YYYY-MM` string (e.g. "2026-07")
- **Money:** always NT$, stored as integer (no decimals — vouchers are always 100)
- **Naming:** snake_case in DB, camelCase in TS, kebab-case in URLs
- **API:** use Supabase client directly from frontend; only add Next.js API routes if RLS isn't enough
- **Auth:** Supabase Auth (email + password). 立心 creates NGO 代表 accounts via admin API.

## Permission model — IMPORTANT

This app uses Supabase Row-Level Security (RLS). Every table must have RLS policies. See `docs/roles.md` for the full matrix.

Quick rules:
- `users.role = 'lixin'` → can read/write everything
- `users.role = 'ngo_rep'` → can only read/write rows where the row's owning NGO matches `auth.uid()`'s NGO

## How to work on this codebase

**Don't try to build the whole app at once.** Work in this order:

1. Schema + auth + RLS first (`/supabase/migrations`)
2. Generate TS types
3. Build zod schemas for each entity (`/lib/schemas`)
4. Auth + role-based layout shell (`/app/(admin)` redirects to login if not lixin, `/app/(app)` requires any logged-in user) — shared `components/shared/app-shell.tsx`
5. Build mobile flows first (M3 cases, M4 stores, M5 demands, M6 first upload) — this is the most critical UX, get it right
6. Build M7 second upload (manual entry first, then add Tesseract.js)
7. Build M9 receipts, M10 case usage
8. Build M11 my settlement (read-only for NGO 代表)
9. Build web admin (W3 users, W4 demands, W5+W6 settlements, W7 receipts, W8 dashboard)
10. PWA manifest + service worker + install prompt
11. Test the full month cycle end-to-end with seed data

For each screen, follow this sequence:
- Read `docs/screens.md` for that screen's spec
- Look at `docs/wireframes.html` for visual reference
- Write zod schema for any new input shape
- Build the data fetching (Supabase query, often directly from client component)
- Build the UI (use shadcn/ui where possible)
- Write at least one happy-path test

## Things to be careful about

- **流水號 serial numbers have no encoding** — you cannot derive store from serial. Always look it up via `voucher_assignments` table.
- **`year_month` matters** — vouchers are scoped to a month. Always filter.
- **The system never tracks physical inventory** — only what's been uploaded. Don't add "remaining stock" features.
- **OCR runs in the browser via Tesseract.js** — no API keys for vision models. Don't suggest GPT-4V, Google Vision, etc. Cache the wasm + worker on first load for offline reuse.
- **Camera access:** must request `getUserMedia({ video: { facingMode: 'environment' } })`. Handle permission denial gracefully — provide manual entry fallback.
- **PWA quirks on iOS:** `getUserMedia` works in standalone PWA mode on iOS 14.5+ but test carefully. Service worker has 50MB cache limit by default — keep Tesseract.js wasm under this.
- **Receipts are uploaded by NGO 代表**, not 立心. 立心 has read-only view.
- **個案 has 身分證字號 stored as plaintext (v1 decision)** — flag in code comments for future encryption.

## What's out of scope for v1

- Push notifications
- Multi-language UI (Chinese only)
- Offline mode beyond the OCR step
- Analytics beyond the basic dashboards in screens.md
- Cross-NGO voucher usage (assumed not to happen)
- Per-case quota logic (NGO 代表 decides how many vouchers each case gets)
