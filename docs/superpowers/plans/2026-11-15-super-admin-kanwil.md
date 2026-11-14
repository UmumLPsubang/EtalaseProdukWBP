# Super Admin Kanwil Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Kanwil Kemenimipas Jawa Barat a separate, role-gated dashboard that can manage all 33 UPT, clean up/audit transactions across UPT, and see cross-UPT analytics — solving the immediate problem that dummy/test transaction data cannot currently be deleted by anyone.

**Architecture:** Plain static HTML + Tailwind CDN + vanilla JS, matching the rest of the site — no build step, no framework. A new `role` column on `profiles` distinguishes `'super_admin'` from `'upt'`. Privileged writes (editing UPT, deleting transactions) go through Postgres `SECURITY DEFINER` RPC functions that check the caller's role server-side and log to `admin_activity_log`, rather than widening table/column grants (which would reopen a UPT self-edit hole fixed earlier in this project). Resetting a UPT's password needs the Supabase service-role key, which must never reach the browser, so it goes through one Supabase Edge Function.

**Tech Stack:** Supabase (Postgres + Auth + Edge Functions), `@supabase/supabase-js@2.45.4` UMD via CDN, Tailwind CDN, vanilla JS, Supabase CLI (for deploying the one Edge Function).

## Global Constraints

- No build step, no framework — every new page is a standalone `.html` file with inline `<script>` tags or a `/assets/js/*.js` file loaded via `<script src>`, matching every existing page in this repo.
- Never put the Supabase **secret/service-role key** in any `.html` or `/assets/js/*.js` file — it is only used server-side inside the Edge Function (where Supabase injects it automatically as an env var).
- All new Supabase writes from privileged RPCs/Edge Functions must insert a row into `admin_activity_log` recording what changed — this is required by the spec even though there is no UI to view the log yet.
- Follow existing UI conventions: colors `primary`/`primary-container`/`border-subtle` from the shared Tailwind config block (see `login.html:12-19`), `escapeHtml()`-wrap any DB value before injecting into `innerHTML`, `confirm()` browser dialog before destructive actions (pattern already used for product delete).
- Do not modify or weaken any existing RLS policy for the `'upt'` role — only add new policies/functions for `'super_admin'`.

---

## File Structure

**New SQL:** `docs/supabase-super-admin-schema.sql` — schema migration run once in Supabase SQL Editor (role column, upt columns, admin_activity_log table, two RPC functions, one new RLS policy).

**New pages:**
- `admin-login.html` — super admin login, separate from `/login`.
- `super-admin-dashboard.html` — single page, header + 4-tab shell. Tab panel markup lives in this file; each tab's *data* is rendered by its own JS module below.

**New JS modules** (loaded via `<script src>` in `super-admin-dashboard.html`, in this order):
- `assets/js/super-admin-dashboard.js` — `requireSuperAdminSession()`, tab switching, logout, shared `escapeHtml()`/`formatRupiah()` helpers used by every tab module below.
- `assets/js/monitoring-aggregates.js` — **extracted** from `monitoring.html`'s inline script (the KPI/donut/kategori/wilayah/UPT-table aggregation logic). Shared by both `monitoring.html` and `super-admin-dashboard.html` so the two pages never carry two copies of the same aggregation logic — the same pattern this repo already uses for `assets/js/upt-dashboard.js` across 4 UPT pages. Self-bootstraps on `DOMContentLoaded`; exposes an extension point `window.renderSuperAdminUptActions` that the admin dashboard fills in and the public page leaves undefined.
- `assets/js/super-admin-overview.js` — Tab Overview: defines `window.renderSuperAdminUptActions(upt)` (the Edit/Reset Password/Lock buttons + status badge appended to each UPT row's Aksi cell).
- `assets/js/super-admin-kelola-upt.js` — Tab Kelola UPT (edit modal, reset-password modal, lock/unlock) — also supplies the 3 action handlers the Overview tab's table buttons call.
- `assets/js/super-admin-transaksi.js` — Tab Transaksi (filterable, paginated, delete).
- `assets/js/super-admin-analytics.js` — Tab Analytics (ranking, wilayah, channel, kategori).

**New Edge Function:** `supabase/functions/reset-upt-password/index.ts` — the only code in this feature allowed to touch the service-role key.

**Modify:**
- `monitoring.html` — replace its inline `<script>` aggregation block with `<script src="/assets/js/monitoring-aggregates.js"></script>` (Task 5).
- `assets/js/upt-dashboard.js:1-28` (`requireUptSession`) — add a locked-account check so Lock/Unlock in Bagian 5 of the spec actually blocks login (Task 8).

No changes to `vercel.json` are needed — `cleanUrls: true` already maps `admin-login.html` → `/admin-login` and `super-admin-dashboard.html` → `/super-admin-dashboard` automatically, the same way `login.html` maps to `/login` today.

---

### Task 1: Database schema — role, UPT status/locked, admin_activity_log, RPCs

**Files:**
- Create: `docs/supabase-super-admin-schema.sql`

**Interfaces:**
- Produces: `profiles.role` (`'upt'` | `'super_admin'`), `upt.status` (`'aktif'` | `'nonaktif'`), `upt.locked` (boolean), table `admin_activity_log`, RPC `admin_update_upt(p_upt_id uuid, p_nama text, p_wilayah text, p_whatsapp text, p_status text, p_locked boolean)`, RPC `admin_delete_transaksi(p_transaksi_id uuid)`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- ============================================
-- Super Admin Kanwil: role, kolom UPT baru, activity log, RPC privileged writes.
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query > Run).
-- ============================================

-- 1. Bedakan akun UPT vs akun Super Admin Kanwil.
alter table profiles add column if not exists role text not null default 'upt'
  check (role in ('upt', 'super_admin'));

-- Akun super_admin tidak terhubung ke satu UPT manapun, jadi upt_id harus boleh null
-- untuk baris itu -- tapi akun 'upt' tetap wajib punya upt_id (dijaga oleh constraint di bawah).
alter table profiles alter column upt_id drop not null;

alter table profiles add constraint profiles_upt_wajib_untuk_role_upt
  check (role = 'super_admin' or upt_id is not null);

-- Super admin perlu baca profiles UPT lain untuk memetakan upt_id -> auth user id
-- saat reset password (lihat Task 6). Baris sendiri sudah bisa dibaca lewat policy
-- "User bisa baca profil sendiri" yang sudah ada -- subquery di bawah ini aman dari
-- rekursi karena bergantung pada policy itu untuk baris "me".
create policy "Super admin bisa baca semua profiles" on profiles
  for select
  to authenticated
  using (
    exists (select 1 from profiles me where me.id = auth.uid() and me.role = 'super_admin')
  );

-- 2. Kolom baru di upt: status (aktif/nonaktif) belum pernah ada sebelumnya, dan locked
-- untuk fitur Lock/Unlock akun UPT.
alter table upt add column if not exists status text not null default 'aktif'
  check (status in ('aktif', 'nonaktif'));
alter table upt add column if not exists locked boolean not null default false;

-- 3. Jejak audit setiap aksi tulis super admin. Tidak ada UI untuk melihatnya
-- pada fase ini (lihat spec Bagian 8) -- tabel ini hanya dituliskan, dibaca manual
-- lewat Supabase Table Editor kalau perlu verifikasi.
create table admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);

alter table admin_activity_log enable row level security;

create policy "Super admin bisa baca activity log" on admin_activity_log
  for select
  to authenticated
  using (
    exists (select 1 from profiles me where me.id = auth.uid() and me.role = 'super_admin')
  );

-- Tidak ada policy INSERT di sini dengan sengaja -- semua insert ke tabel ini
-- terjadi lewat fungsi SECURITY DEFINER di bawah (yang berjalan dengan privilese
-- pemilik fungsi, bukan privilese pemanggil) atau lewat Edge Function dengan
-- service role key, keduanya melewati RLS.

-- 4. RPC: edit profil UPT + lock/unlock, hanya untuk super_admin.
-- SECURITY DEFINER dipakai alih-alih memperluas grant kolom pada tabel upt, karena
-- grant kolom berlaku untuk seluruh role 'authenticated' tanpa pandang baris --
-- itu persis bug yang pernah diperbaiki (UPT bisa ubah nama sendiri) kalau grant
-- diperluas langsung ke tabel.
create or replace function admin_update_upt(
  p_upt_id uuid,
  p_nama text,
  p_wilayah text,
  p_whatsapp text,
  p_status text,
  p_locked boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'super_admin') then
    raise exception 'Hanya super admin yang bisa mengubah data UPT';
  end if;

  select to_jsonb(u) into v_before from upt u where u.id = p_upt_id;

  update upt
  set nama = p_nama,
      wilayah = p_wilayah,
      whatsapp = p_whatsapp,
      status = p_status,
      locked = p_locked
  where id = p_upt_id;

  insert into admin_activity_log (admin_id, action, target_type, target_id, changes)
  values (
    auth.uid(), 'edit_upt', 'upt', p_upt_id,
    jsonb_build_object(
      'before', v_before,
      'after', jsonb_build_object(
        'nama', p_nama, 'wilayah', p_wilayah, 'whatsapp', p_whatsapp,
        'status', p_status, 'locked', p_locked
      )
    )
  );
end;
$$;

grant execute on function admin_update_upt(uuid, text, text, text, text, boolean) to authenticated;

-- 5. RPC: hapus transaksi, hanya untuk super_admin, dengan snapshot sebelum hapus
-- disimpan ke admin_activity_log (supaya ada rekam jejak meski barisnya sudah hilang).
create or replace function admin_delete_transaksi(p_transaksi_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'super_admin') then
    raise exception 'Hanya super admin yang bisa menghapus transaksi';
  end if;

  select to_jsonb(t) into v_snapshot from transaksi_penjualan t where t.id = p_transaksi_id;

  if v_snapshot is null then
    raise exception 'Transaksi tidak ditemukan';
  end if;

  delete from transaksi_penjualan where id = p_transaksi_id;

  insert into admin_activity_log (admin_id, action, target_type, target_id, changes)
  values (auth.uid(), 'delete_transaction', 'transaksi_penjualan', p_transaksi_id,
    jsonb_build_object('before', v_snapshot));
end;
$$;

grant execute on function admin_delete_transaksi(uuid) to authenticated;
```

- [ ] **Step 2: Run the SQL in Supabase SQL Editor**

User action (not the engineer's terminal): paste the full script into Supabase Dashboard → SQL Editor → New Query → Run. Expected: "Success. No rows returned."

- [ ] **Step 3: Create the super admin account**

User action in Supabase Dashboard:
1. Authentication → Users → Add User → enter the Kanwil's email + a password → Create.
2. Copy the new user's UUID from the Users list.
3. SQL Editor → run:
```sql
insert into profiles (id, role, upt_id, nama)
values ('<uuid-copied-above>', 'super_admin', null, 'Super Admin Kanwil Jabar');
```
4. Verify: `select id, role, upt_id from profiles where role = 'super_admin';` returns exactly one row with `upt_id` null.

- [ ] **Step 4: Verify existing UPT accounts still work**

Open `/login`, sign in with any existing UPT account, confirm dashboard loads normally (this migration must not break the existing `upt_id` NOT NULL assumption anywhere else in the code — it only drops the DB-level constraint, application code for UPT accounts is untouched).

- [ ] **Step 5: Commit**

```bash
git add docs/supabase-super-admin-schema.sql
git commit -m "Add super admin schema: role column, UPT status/locked, activity log, privileged RPCs"
```

---

### Task 2: Shared session guard + tab switching (`super-admin-dashboard.js`)

**Files:**
- Create: `assets/js/super-admin-dashboard.js`

**Interfaces:**
- Consumes: `supabaseClient` global from `assets/js/supabase-client.js` (already loaded by every page via `<script src="/assets/js/supabase-client.js">`).
- Produces: `async function requireSuperAdminSession()` → returns `{ adminId: string, email: string }` or redirects and returns `null`. `function escapeHtml(str)` → string. `function formatRupiah(num)` → `"Rp X.XXX.XXX"` string. `function initTabs()` → wires `[data-tab]` buttons to show/hide `[data-panel]` divs and calls `window.onTabActivated?.(tabName)` on every switch (later tasks hook into this to lazy-load each tab's data).

- [ ] **Step 1: Write the file**

```javascript
async function requireSuperAdminSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "/admin-login";
    return null;
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("role, nama")
    .eq("id", session.user.id)
    .single();

  if (error || !profile || profile.role !== "super_admin") {
    await supabaseClient.auth.signOut();
    window.location.href = "/admin-login";
    return null;
  }

  return { adminId: session.user.id, email: session.user.email, nama: profile.nama };
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRupiah(num) {
  const n = Number(num) || 0;
  return "Rp " + n.toLocaleString("id-ID");
}

function initTabs() {
  const buttons = document.querySelectorAll("[data-tab]");
  const panels = document.querySelectorAll("[data-panel]");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;

      buttons.forEach((b) => {
        b.classList.toggle("bg-primary-container", b === btn);
        b.classList.toggle("text-white", b === btn);
        b.classList.toggle("text-on-surface-variant", b !== btn);
      });

      panels.forEach((panel) => {
        panel.classList.toggle("hidden", panel.dataset.panel !== tabName);
      });

      if (typeof window.onTabActivated === "function") {
        window.onTabActivated(tabName);
      }
    });
  });

  const logoutBtn = document.getElementById("header-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "/admin-login";
    });
  }
}
```

- [ ] **Step 2: Manual verification (deferred)**

This file has no page to run against yet — verification happens in Task 4 once `super-admin-dashboard.html` exists and loads it. Skip to commit.

- [ ] **Step 3: Commit**

```bash
git add assets/js/super-admin-dashboard.js
git commit -m "Add super admin session guard and tab-switching shell"
```

---

### Task 3: Admin login page

**Files:**
- Create: `admin-login.html`

**Interfaces:**
- Consumes: `supabaseClient` from `assets/js/supabase-client.js`.

- [ ] **Step 1: Write the file**

```html
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Login Super Admin - Karya WBP Jabar Juara</title>
<link href="https://fonts.googleapis.com" rel="preconnect">
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: { primary: "#00102d", "primary-container": "#0f254a", "border-subtle": "#E2E8F0" },
        fontFamily: { sans: ["Plus Jakarta Sans", "sans-serif"] },
      },
    },
  };
</script>
<style>body { font-family: "Plus Jakarta Sans", sans-serif; }</style>
</head>
<body class="bg-primary min-h-screen flex items-center justify-center px-4">
<div class="w-full max-w-sm bg-white rounded-2xl shadow-xl p-7">
  <div class="text-center mb-6">
    <h1 class="font-extrabold text-xl text-primary">Login Super Admin</h1>
    <p class="text-xs text-slate-500 mt-1">Karya WBP Jabar Juara &middot; Kanwil Kemenimipas Jawa Barat</p>
  </div>

  <form id="login-form" class="space-y-4">
    <div>
      <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="email">Email</label>
      <input id="email" name="email" type="email" required autocomplete="username"
        class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
    </div>
    <div>
      <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="password">Password</label>
      <input id="password" name="password" type="password" required autocomplete="current-password"
        class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
    </div>

    <div id="login-message" class="hidden text-sm font-semibold rounded-lg px-3 py-2 bg-red-50 text-red-700 border border-red-200"></div>

    <button type="submit" id="login-btn"
      class="w-full py-3 rounded-lg bg-primary-container text-white font-bold text-sm hover:bg-primary transition disabled:opacity-50">
      Masuk
    </button>
  </form>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="/assets/js/supabase-client.js"></script>
<script>
  const form = document.getElementById("login-form");
  const btn = document.getElementById("login-btn");
  const msg = document.getElementById("login-message");

  async function redirectIfSuperAdmin() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();
    if (profile && profile.role === "super_admin") {
      window.location.href = "/super-admin-dashboard";
    }
  }
  redirectIfSuperAdmin();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = "Memproses...";
    msg.classList.add("hidden");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (signInError) {
      msg.textContent = "Login gagal: email atau password salah.";
      msg.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Masuk";
      return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (!profile || profile.role !== "super_admin") {
      await supabaseClient.auth.signOut();
      msg.textContent = "Akun ini bukan akun Super Admin.";
      msg.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Masuk";
      return;
    }

    window.location.href = "/super-admin-dashboard";
  });
</script>
</body>
</html>
```

- [ ] **Step 2: Manual verification**

Deploy/serve locally, open `/admin-login`. Log in with a UPT account's email/password (created in earlier work) → expect message "Akun ini bukan akun Super Admin." and no redirect. Log in with the super admin account from Task 1 Step 3 → expect redirect to `/super-admin-dashboard` (404 is fine for now, that page doesn't exist until Task 4).

- [ ] **Step 3: Commit**

```bash
git add admin-login.html
git commit -m "Add separate admin login page for super admin role"
```

---

### Task 4: Dashboard shell (header + tabs)

**Files:**
- Create: `super-admin-dashboard.html`

**Interfaces:**
- Consumes: `requireSuperAdminSession()`, `initTabs()` from Task 2.
- Produces: DOM containers later tasks render into — `#panel-overview` (`data-panel="overview"`), `#panel-kelola-upt` (`data-panel="kelola-upt"`), `#panel-transaksi` (`data-panel="transaksi"`), `#panel-analytics` (`data-panel="analytics"`); header shows `#header-admin-nama`.

- [ ] **Step 1: Write the file**

```html
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Dashboard Super Admin - Karya WBP Jabar Juara</title>
<link href="https://fonts.googleapis.com" rel="preconnect">
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          primary: "#00102d", "primary-container": "#0f254a",
          "surface-canvas": "#F4F6FA", "surface-container": "#F1F5F9", "surface-container-high": "#E2E8F0",
          "on-surface": "#0F172A", "on-surface-variant": "#475569",
          "border-subtle": "#E2E8F0",
        },
        fontFamily: { sans: ["Plus Jakarta Sans", "sans-serif"] },
      },
    },
  };
</script>
<style>body { font-family: "Plus Jakarta Sans", sans-serif; }</style>
</head>
<body class="bg-surface-canvas text-on-surface min-h-screen">
<header class="fixed top-0 left-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-border-subtle shadow-sm">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
    <div class="flex items-center gap-3.5">
      <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-container text-white flex items-center justify-center shadow-md">
        <span class="material-symbols-outlined text-[26px]">admin_panel_settings</span>
      </div>
      <div class="flex flex-col">
        <span class="font-bold text-lg text-primary tracking-tight leading-tight">Super Admin Kanwil</span>
        <span class="text-xs font-medium text-on-surface-variant leading-normal" id="header-admin-nama">Memuat...</span>
      </div>
    </div>
    <button id="header-logout-btn" class="px-4 py-2 rounded-lg text-sm font-semibold bg-surface-container hover:bg-surface-container-high text-primary transition">Logout</button>
  </div>
</header>

<main class="w-full pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
  <nav class="flex items-center gap-1.5 p-1 bg-surface-container rounded-xl border border-border-subtle/80 mb-6 overflow-x-auto w-fit max-w-full">
    <button data-tab="overview" class="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all bg-primary-container text-white">Overview</button>
    <button data-tab="kelola-upt" class="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all text-on-surface-variant hover:text-primary hover:bg-white">Kelola UPT</button>
    <button data-tab="transaksi" class="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all text-on-surface-variant hover:text-primary hover:bg-white">Transaksi</button>
    <button data-tab="analytics" class="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all text-on-surface-variant hover:text-primary hover:bg-white">Analytics</button>
  </nav>

  <div id="panel-overview" data-panel="overview" class="space-y-6"></div>
  <div id="panel-kelola-upt" data-panel="kelola-upt" class="space-y-6 hidden"></div>
  <div id="panel-transaksi" data-panel="transaksi" class="space-y-6 hidden"></div>
  <div id="panel-analytics" data-panel="analytics" class="space-y-6 hidden"></div>
</main>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="/assets/js/supabase-client.js"></script>
<script src="/assets/js/super-admin-dashboard.js"></script>
<script>
  (async function bootstrap() {
    const admin = await requireSuperAdminSession();
    if (!admin) return;
    document.getElementById("header-admin-nama").textContent = admin.nama || admin.email;
    initTabs();
  })();
</script>
</body>
</html>
```

- [ ] **Step 2: Manual verification**

Open `/admin-login`, sign in as super admin → lands on `/super-admin-dashboard`, header shows the admin's name, 4 tabs visible, clicking each tab switches the active-tab highlight (panels are still empty — that's expected until Tasks 5/7/9/10 run). Open `/super-admin-dashboard` directly while logged out → redirected to `/admin-login`.

- [ ] **Step 3: Commit**

```bash
git add super-admin-dashboard.html
git commit -m "Add super admin dashboard shell with header and tab navigation"
```

---

### Task 5: Extract monitoring-aggregates.js, then build Tab Overview on top of it

**Files:**
- Create: `assets/js/monitoring-aggregates.js`
- Create: `assets/js/super-admin-overview.js`
- Modify: `monitoring.html` (replace inline script with `<script src>`, add `status`/`locked` to the UPT select)
- Modify: `super-admin-dashboard.html` (add script tags + panel markup)

**Interfaces:**
- Produces (in `monitoring-aggregates.js`): `escapeHtml()`, `formatRupiah()`, `initialsFromKode()`, `loadKpiCards()`, `loadUptTable()`, `loadMonitoringAggregates()`, `renderUptRow(upt, index)`, `fillUptRowAggregates()`, `applyUptTableView()`, `openDetailModal()`, `closeDetailModal()`. All self-wire on `DOMContentLoaded` — neither host page needs to call anything explicitly, just load the script tag. `renderUptRow` calls `window.renderSuperAdminUptActions(upt)` if that global function exists, and appends its return value (a string of extra HTML) into the row's Aksi cell; on the public `monitoring.html` that global is never defined, so the row renders exactly as it does today.
- Produces (in `super-admin-overview.js`): `window.renderSuperAdminUptActions(upt)` — returns an HTML string with a status badge plus Edit/Reset Password/Lock buttons calling `window.openEditUptModal(uptId)`, `window.openResetPasswordModal(uptId)`, `window.toggleLockUpt(uptId, currentLocked)` (defined in Task 7 — calling them before Task 7 exists throws `ReferenceError` in the console, expected at this point in the plan).
- Consumes: none of Task 2's helpers are needed here — `monitoring-aggregates.js` carries its own `escapeHtml`/`formatRupiah` (identical implementations to Task 2's; this duplication between `super-admin-dashboard.js` and `monitoring-aggregates.js` is small, isolated to two 6-line utility functions, and acceptable — it is the one DRY trade-off this task keeps, versus extracting a third shared-utilities file for two functions).

- [ ] **Step 1: Read the source to extract**

Open `monitoring.html` and read lines 236–808 (the 4-row analytics markup) and lines 940–1422 (the `<script>` block: `loadKpiCards`, `loadMonitoringAggregates`, `renderChannelDonut`, `renderKategoriKomposisi`, `renderWilayahDistribusi`, `renderUptRow`, `fillUptRowAggregates`, `applyUptTableView`, `openDetailModal`/`closeDetailModal`, `initialsFromKode`, and the search-input/sort-button/modal-close event-listener wiring, plus the bootstrap calls at the very end). This whole script block moves into the new file in Step 2 — do not re-derive it from scratch.

- [ ] **Step 2: Create `monitoring-aggregates.js` by moving the script out of `monitoring.html`**

Cut the entire contents of `monitoring.html`'s `<script>` block (lines 940–1422) into the new file `assets/js/monitoring-aggregates.js`, then apply these edits inside the new file:
- Find the bootstrap calls at the very end of the moved code (the bare `loadKpiCards(); loadUptTable(); loadMonitoringAggregates();` and any `document.addEventListener(...)` wiring for the search input / sort button / modal close / Escape key). Wrap all of it in:
```javascript
document.addEventListener("DOMContentLoaded", () => {
  loadKpiCards();
  loadUptTable();
  loadMonitoringAggregates();
  // ...the existing search-input/sort-button/modal-close/Escape-key listener wiring goes here, unchanged...
});
```
- In `renderUptRow(upt, index)`, find where it builds the Aksi `<td>` (the single `<button>Detail</button>`). Change it to also append a second piece of HTML:
```javascript
const adminActionsHtml = (typeof window.renderSuperAdminUptActions === "function")
  ? window.renderSuperAdminUptActions(upt)
  : "";
```
and concatenate `adminActionsHtml` after the existing Detail button inside that `<td>`. The Detail button's markup, classes, and `data-upt-id`/`data-nama`/`data-kode` attributes are unchanged.
- In `loadUptTable()`, find the `.select(...)` call that fetches UPT rows and add `status, locked` to the selected columns (needed by `window.renderSuperAdminUptActions` later; harmless for the public page, which simply doesn't render them).

- [ ] **Step 3: Update `monitoring.html` to load the extracted file**

Replace the entire `<script>...</script>` block that used to span lines 940–1422 with:
```html
<script src="/assets/js/monitoring-aggregates.js"></script>
```
Leave every other part of `monitoring.html` (the HTML markup, the `detail-modal` structure) untouched.

- [ ] **Step 4: Manual verification of the extraction alone**

Before building anything admin-specific, open public `/monitoring` and confirm it behaves exactly as before this task: KPI cards populate, donut/kategori/wilayah render, UPT table populates with Detail buttons that open the modal, search and sort both work. This proves the extraction didn't change public-page behavior before admin-specific code is layered on top.

- [ ] **Step 5: Insert the Overview panel markup in `super-admin-dashboard.html`**

Replace `<div id="panel-overview" data-panel="overview" class="space-y-6"></div>` with a `<div id="panel-overview" data-panel="overview" class="space-y-6">` wrapping a copy of `monitoring.html`'s KPI cards block (lines 172-235) and ROW 1–4 blocks (lines 236-808) as they exist *after* Task 3's extraction (i.e. plain markup, no inline script), plus the `detail-modal` markup (lines 919-934). Drop the "OFFICIAL VALIDATION BANNER" section (lines 810-839) — that's public-facing content, not relevant to an internal admin tool.

- [ ] **Step 6: Write `super-admin-overview.js`**

```javascript
window.renderSuperAdminUptActions = function (upt) {
  const statusLabel = upt.locked ? "Terkunci" : (upt.status === "nonaktif" ? "Nonaktif" : "Aktif");
  const statusClass = upt.locked
    ? "bg-rose-100 text-rose-800"
    : (upt.status === "nonaktif" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-800");
  return `
    <div class="flex flex-col items-center gap-1 mt-1.5">
      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClass}">${statusLabel}</span>
      <div class="flex gap-1">
        <button class="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 text-[11px] font-bold transition border border-blue-200" onclick="window.openEditUptModal('${upt.id}')">Edit</button>
        <button class="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 text-[11px] font-bold transition border border-amber-200" onclick="window.openResetPasswordModal('${upt.id}')">Reset</button>
        <button class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 text-[11px] font-bold transition border border-rose-200" onclick="window.toggleLockUpt('${upt.id}', ${upt.locked ? "true" : "false"})">${upt.locked ? "Unlock" : "Lock"}</button>
      </div>
    </div>`;
};
```

- [ ] **Step 7: Wire the script tags**

In `super-admin-dashboard.html`, add both `<script src="/assets/js/monitoring-aggregates.js"></script>` and `<script src="/assets/js/super-admin-overview.js"></script>` before the existing bootstrap `<script>` block (order between these two doesn't matter — `window.renderSuperAdminUptActions` is assigned synchronously at parse time, before `monitoring-aggregates.js`'s `DOMContentLoaded` handler can fire).

- [ ] **Step 8: Manual verification**

Reload `/super-admin-dashboard`. Overview tab shows the same KPI cards / donut / kategori / wilayah / table as public `/monitoring`, but each UPT row now has a status badge plus Edit/Reset/Lock buttons under the Detail button. Clicking Detail opens the same transaction-detail modal as on `/monitoring`. Clicking Edit/Reset/Lock throws a console error (expected — Task 7 defines those). Re-check `/monitoring` once more here too — it must still work unchanged.

- [ ] **Step 9: Commit**

```bash
git add monitoring.html super-admin-dashboard.html assets/js/monitoring-aggregates.js assets/js/super-admin-overview.js
git commit -m "Extract monitoring aggregation logic into shared module; add Overview tab actions"
```

---

### Task 6: Edge Function — reset UPT password

**Files:**
- Create: `supabase/functions/reset-upt-password/index.ts`

**Interfaces:**
- Consumes: invoked from browser via `supabaseClient.functions.invoke('reset-upt-password', { body: { upt_id } })` (used in Task 7).
- Produces: on success, JSON `{ password: string }`; on failure, JSON `{ error: string }` with a non-200 status.

- [ ] **Step 1: Write the function**

```typescript
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Tidak terautentikasi" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (callerProfile?.role !== "super_admin") {
    return new Response(JSON.stringify({ error: "Hanya super admin yang bisa reset password" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { upt_id } = await req.json();
  if (!upt_id) {
    return new Response(JSON.stringify({ error: "upt_id wajib diisi" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: targetProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("upt_id", upt_id)
    .eq("role", "upt")
    .single();

  if (profileError || !targetProfile) {
    return new Response(JSON.stringify({ error: "Akun UPT tidak ditemukan" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const newPassword = Array.from(crypto.getRandomValues(new Uint8Array(9)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 12);

  const { error: updateError } = await adminClient.auth.admin.updateUserById(targetProfile.id, {
    password: newPassword,
  });

  if (updateError) {
    return new Response(JSON.stringify({ error: "Gagal reset password: " + updateError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await adminClient.from("admin_activity_log").insert({
    admin_id: userData.user.id,
    action: "reset_password",
    target_type: "upt",
    target_id: upt_id,
  });

  return new Response(JSON.stringify({ password: newPassword }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Deploy the function**

User/engineer runs in the project root (requires Node, already installed per `scripts/` usage earlier in this project):
```bash
npx supabase login
npx supabase link --project-ref ajcbklvimafrrpbucrii
npx supabase functions deploy reset-upt-password
```
`npx supabase login` opens a browser for one-time auth; `link` only needs to run once per machine. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` are injected automatically by Supabase into every Edge Function's runtime — do not set them manually, and never paste the service-role key into this repo.

- [ ] **Step 3: Manual verification**

From a browser console on any page that already loads `supabase-client.js` (e.g. `/admin-login`), while logged in as super admin, run:
```javascript
supabaseClient.functions.invoke('reset-upt-password', { body: { upt_id: '<a real upt id>' } }).then(console.log)
```
Expected: `{ data: { password: "..." }, error: null }`. Then verify the UPT can log in at `/login` with that new password. Repeat while logged in as a non-super-admin UPT account → expect `{ data: null, error: ... }` with a 403.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/reset-upt-password/index.ts
git commit -m "Add reset-upt-password Edge Function for super admin"
```

---

### Task 7: Tab Kelola UPT (edit, reset password, lock/unlock)

**Files:**
- Create: `assets/js/super-admin-kelola-upt.js`
- Modify: `super-admin-dashboard.html` (panel markup + script tag + `window.onTabActivated` hook)

**Interfaces:**
- Consumes: `escapeHtml()` from Task 2; `admin_update_upt` RPC and `reset-upt-password` Edge Function from Tasks 1 & 6.
- Produces: `window.openEditUptModal(uptId)`, `window.openResetPasswordModal(uptId)`, `window.toggleLockUpt(uptId, currentLocked)` (all referenced by Task 5's table buttons), `function loadKelolaUptTable()` (called when this tab is activated).

- [ ] **Step 1: Add panel markup**

Replace the empty Kelola UPT panel div in `super-admin-dashboard.html` with:
```html
<div id="panel-kelola-upt" data-panel="kelola-upt" class="space-y-6 hidden">
  <div class="bg-white rounded-2xl p-6 shadow-sm border border-border-subtle">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
      <h2 class="font-bold text-lg text-primary">Kelola 33 UPT</h2>
      <div class="flex items-center gap-2">
        <input id="kelola-upt-search" type="text" placeholder="Cari UPT..." class="bg-surface-container px-3 py-1.5 rounded-xl border border-border-subtle text-xs font-semibold outline-none w-56">
        <select id="kelola-upt-filter-status" class="bg-surface-container px-3 py-1.5 rounded-xl border border-border-subtle text-xs font-semibold outline-none">
          <option value="">Semua Status</option>
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
          <option value="locked">Terkunci</option>
        </select>
      </div>
    </div>
    <div class="overflow-x-auto max-h-[560px] overflow-y-auto rounded-xl border border-border-subtle/80">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="sticky top-0 z-10 bg-surface-container">
          <tr class="text-slate-700 font-extrabold uppercase tracking-wider text-[11px]">
            <th class="py-3 px-3.5">Kode</th><th class="py-3 px-3">Nama</th><th class="py-3 px-3">Wilayah</th>
            <th class="py-3 px-3">WhatsApp</th><th class="py-3 px-3">Status</th><th class="py-3 px-3.5 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody id="kelola-upt-table-body" class="divide-y divide-border-subtle/70 bg-white"></tbody>
      </table>
    </div>
  </div>
</div>

<div id="edit-upt-modal" class="hidden fixed inset-0 z-[100] items-center justify-center p-4">
  <div class="absolute inset-0 bg-black/50" onclick="document.getElementById('edit-upt-modal').classList.add('hidden')"></div>
  <div class="relative bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
    <h3 class="font-bold text-base text-primary">Edit UPT</h3>
    <form id="edit-upt-form" class="space-y-3">
      <input type="hidden" id="edit-upt-id">
      <div><label class="block text-xs font-bold text-slate-600 mb-1">Nama</label><input id="edit-upt-nama" required class="w-full px-3 py-2 rounded-lg border border-border-subtle text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-600 mb-1">Wilayah</label><input id="edit-upt-wilayah" class="w-full px-3 py-2 rounded-lg border border-border-subtle text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-600 mb-1">WhatsApp (62...)</label><input id="edit-upt-whatsapp" class="w-full px-3 py-2 rounded-lg border border-border-subtle text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-600 mb-1">Status</label>
        <select id="edit-upt-status" class="w-full px-3 py-2 rounded-lg border border-border-subtle text-sm">
          <option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option>
        </select>
      </div>
      <div id="edit-upt-message" class="hidden text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="document.getElementById('edit-upt-modal').classList.add('hidden')" class="flex-1 py-2.5 rounded-lg bg-surface-container text-slate-700 font-bold text-sm">Batal</button>
        <button type="submit" id="edit-upt-submit" class="flex-1 py-2.5 rounded-lg bg-primary-container text-white font-bold text-sm">Simpan</button>
      </div>
    </form>
  </div>
</div>

<div id="reset-password-modal" class="hidden fixed inset-0 z-[100] items-center justify-center p-4">
  <div class="absolute inset-0 bg-black/50" onclick="document.getElementById('reset-password-modal').classList.add('hidden')"></div>
  <div class="relative bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 text-center">
    <h3 class="font-bold text-base text-primary">Reset Password</h3>
    <div id="reset-password-body" class="text-sm text-slate-600"></div>
    <button onclick="document.getElementById('reset-password-modal').classList.add('hidden')" class="w-full py-2.5 rounded-lg bg-primary-container text-white font-bold text-sm">Tutup</button>
  </div>
</div>
```

- [ ] **Step 2: Write `super-admin-kelola-upt.js`**

```javascript
let __kelolaUptData = [];

async function loadKelolaUptTable() {
  const { data, error } = await supabaseClient
    .from("upt")
    .select("id, kode, nama, wilayah, whatsapp, status, locked")
    .order("nama");

  if (error) {
    console.error("Gagal memuat daftar UPT:", error);
    return;
  }

  __kelolaUptData = data;
  renderKelolaUptTable();
}

function renderKelolaUptTable() {
  const query = (document.getElementById("kelola-upt-search")?.value || "").trim().toLowerCase();
  const statusFilter = document.getElementById("kelola-upt-filter-status")?.value || "";
  const tbody = document.getElementById("kelola-upt-table-body");

  const filtered = __kelolaUptData.filter((upt) => {
    const matchesQuery = !query ||
      upt.nama.toLowerCase().includes(query) ||
      upt.kode.toLowerCase().includes(query) ||
      (upt.wilayah || "").toLowerCase().includes(query);
    const matchesStatus =
      !statusFilter ||
      (statusFilter === "locked" && upt.locked) ||
      (statusFilter !== "locked" && !upt.locked && upt.status === statusFilter);
    return matchesQuery && matchesStatus;
  });

  tbody.innerHTML = filtered.map((upt) => {
    const statusLabel = upt.locked ? "Terkunci" : (upt.status === "nonaktif" ? "Nonaktif" : "Aktif");
    const statusClass = upt.locked ? "bg-rose-100 text-rose-800" : (upt.status === "nonaktif" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-800");
    return `
      <tr>
        <td class="py-2.5 px-3.5 font-bold">${escapeHtml(upt.kode)}</td>
        <td class="py-2.5 px-3">${escapeHtml(upt.nama)}</td>
        <td class="py-2.5 px-3">${escapeHtml(upt.wilayah || "-")}</td>
        <td class="py-2.5 px-3">${escapeHtml(upt.whatsapp || "-")}</td>
        <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${statusClass}">${statusLabel}</span></td>
        <td class="py-2.5 px-3.5 text-center space-x-1">
          <button class="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 text-[11px] font-bold border border-blue-200" onclick="window.openEditUptModal('${upt.id}')">Edit</button>
          <button class="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 text-[11px] font-bold border border-amber-200" onclick="window.openResetPasswordModal('${upt.id}')">Reset Password</button>
          <button class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 text-[11px] font-bold border border-rose-200" onclick="window.toggleLockUpt('${upt.id}', ${upt.locked ? "true" : "false"})">${upt.locked ? "Unlock" : "Lock"}</button>
        </td>
      </tr>`;
  }).join("") || `<tr><td colspan="6" class="py-6 text-center text-slate-400">Tidak ada UPT yang cocok.</td></tr>`;
}

window.openEditUptModal = function (uptId) {
  const upt = __kelolaUptData.find((u) => u.id === uptId);
  if (!upt) return;
  document.getElementById("edit-upt-id").value = upt.id;
  document.getElementById("edit-upt-nama").value = upt.nama;
  document.getElementById("edit-upt-wilayah").value = upt.wilayah || "";
  document.getElementById("edit-upt-whatsapp").value = upt.whatsapp || "";
  document.getElementById("edit-upt-status").value = upt.status;
  document.getElementById("edit-upt-message").classList.add("hidden");
  document.getElementById("edit-upt-modal").classList.remove("hidden");
  document.getElementById("edit-upt-modal").classList.add("flex");
};

window.toggleLockUpt = async function (uptId, currentLocked) {
  const upt = __kelolaUptData.find((u) => u.id === uptId);
  if (!upt) return;
  const action = currentLocked ? "membuka kunci" : "mengunci";
  if (!confirm(`Yakin ingin ${action} akun ${upt.nama}?`)) return;

  const { error } = await supabaseClient.rpc("admin_update_upt", {
    p_upt_id: uptId, p_nama: upt.nama, p_wilayah: upt.wilayah, p_whatsapp: upt.whatsapp,
    p_status: upt.status, p_locked: !currentLocked,
  });

  if (error) {
    alert("Gagal mengubah status kunci: " + error.message);
    return;
  }
  await loadKelolaUptTable();
};

window.openResetPasswordModal = async function (uptId) {
  const upt = __kelolaUptData.find((u) => u.id === uptId);
  if (!upt) return;
  if (!confirm(`Reset password akun ${upt.nama}? Password lama akan tidak berlaku lagi.`)) return;

  const body = document.getElementById("reset-password-body");
  body.textContent = "Memproses...";
  document.getElementById("reset-password-modal").classList.remove("hidden");
  document.getElementById("reset-password-modal").classList.add("flex");

  const { data, error } = await supabaseClient.functions.invoke("reset-upt-password", { body: { upt_id: uptId } });

  if (error || !data?.password) {
    body.innerHTML = `<span class="text-red-700 font-semibold">Gagal reset password.</span>`;
    return;
  }

  body.innerHTML = `
    <p class="mb-2">Password baru untuk <b>${escapeHtml(upt.nama)}</b>:</p>
    <p class="font-mono text-lg font-bold bg-slate-100 rounded-lg py-2 px-3 select-all">${escapeHtml(data.password)}</p>
    <p class="text-xs text-slate-500 mt-2">Salin dan kirim ke UPT sekarang — password ini tidak akan ditampilkan lagi.</p>`;
};

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("kelola-upt-search");
  const statusFilter = document.getElementById("kelola-upt-filter-status");
  if (searchInput) searchInput.addEventListener("input", renderKelolaUptTable);
  if (statusFilter) statusFilter.addEventListener("change", renderKelolaUptTable);

  const editForm = document.getElementById("edit-upt-form");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const uptId = document.getElementById("edit-upt-id").value;
      const upt = __kelolaUptData.find((u) => u.id === uptId);
      const msg = document.getElementById("edit-upt-message");
      msg.classList.add("hidden");

      const whatsapp = document.getElementById("edit-upt-whatsapp").value.trim();
      if (whatsapp && !/^62[0-9]{8,13}$/.test(whatsapp)) {
        msg.textContent = "Nomor WhatsApp harus diawali 62 dan hanya berisi angka.";
        msg.classList.remove("hidden");
        return;
      }

      const { error } = await supabaseClient.rpc("admin_update_upt", {
        p_upt_id: uptId,
        p_nama: document.getElementById("edit-upt-nama").value.trim(),
        p_wilayah: document.getElementById("edit-upt-wilayah").value.trim(),
        p_whatsapp: whatsapp || null,
        p_status: document.getElementById("edit-upt-status").value,
        p_locked: upt.locked,
      });

      if (error) {
        msg.textContent = "Gagal menyimpan: " + error.message;
        msg.classList.remove("hidden");
        return;
      }

      document.getElementById("edit-upt-modal").classList.add("hidden");
      await loadKelolaUptTable();
    });
  }
});
```

- [ ] **Step 3: Wire tab activation**

In `super-admin-dashboard.html`'s bootstrap script, add before `initTabs()`:
```javascript
window.onTabActivated = function (tabName) {
  if (tabName === "kelola-upt") loadKelolaUptTable();
};
```
Add `<script src="/assets/js/super-admin-kelola-upt.js"></script>` alongside the other script tags.

- [ ] **Step 4: Manual verification**

Reload dashboard. Click Kelola UPT tab → table of 33 UPT loads. Edit a UPT's nama/wilayah/whatsapp → Simpan → table refreshes with new values; check Supabase Table Editor, `admin_activity_log` has a new `edit_upt` row. Click Lock on one UPT → confirm dialog → status badge changes to "Terkunci"; that UPT's `/login` must now be blocked (verified fully in Task 8). Click Reset Password → modal shows a 12-character password; copy it and confirm that UPT can log in with it at `/login`.

- [ ] **Step 5: Commit**

```bash
git add super-admin-dashboard.html assets/js/super-admin-kelola-upt.js
git commit -m "Add Kelola UPT tab: edit, reset password, lock/unlock"
```

---

### Task 8: Enforce UPT account lock at login

**Files:**
- Modify: `assets/js/upt-dashboard.js:1-28`

**Interfaces:**
- Produces: `requireUptSession()` now also redirects+signs-out if `upt.locked === true`.

- [ ] **Step 1: Edit `requireUptSession`**

Change the `.select(...)` call and add a lock check:
```javascript
async function requireUptSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "/login";
    return null;
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("upt_id, upt:upt_id (nama, kode, whatsapp, locked)")
    .eq("id", session.user.id)
    .single();

  if (error || !profile) {
    console.error("Gagal memuat profil UPT:", error);
    alert("Akun ini belum terhubung ke UPT manapun. Hubungi admin, lalu login ulang.");
    await supabaseClient.auth.signOut();
    window.location.href = "/login";
    return null;
  }

  if (profile.upt.locked) {
    alert("Akun ini dikunci oleh Kanwil. Hubungi admin Kanwil untuk membuka kembali.");
    await supabaseClient.auth.signOut();
    window.location.href = "/login";
    return null;
  }

  return {
    uptId: profile.upt_id,
    nama: profile.upt.nama,
    kode: profile.upt.kode,
    whatsapp: profile.upt.whatsapp,
  };
}
```

- [ ] **Step 2: Manual verification**

With a UPT locked via Task 7's Lock button, log in as that UPT at `/login` → expect the alert and redirect back to `/login`. Unlock it from the super admin dashboard → that UPT can log in normally again.

- [ ] **Step 3: Commit**

```bash
git add assets/js/upt-dashboard.js
git commit -m "Block dashboard access for UPT accounts locked by super admin"
```

---

### Task 9: Tab Transaksi

**Files:**
- Create: `assets/js/super-admin-transaksi.js`
- Modify: `super-admin-dashboard.html`

**Interfaces:**
- Consumes: `escapeHtml()`, `formatRupiah()` from Task 2; `admin_delete_transaksi` RPC from Task 1.
- Produces: `function loadTransaksiTab()` (called on tab activation — resets pagination and re-fetches).

- [ ] **Step 1: Add panel markup**

```html
<div id="panel-transaksi" data-panel="transaksi" class="space-y-6 hidden">
  <div class="bg-white rounded-2xl p-6 shadow-sm border border-border-subtle">
    <h2 class="font-bold text-lg text-primary mb-4">Transaksi Seluruh UPT</h2>
    <div class="flex flex-wrap gap-2 mb-4">
      <select id="transaksi-filter-upt" class="bg-surface-container px-3 py-1.5 rounded-xl border border-border-subtle text-xs font-semibold outline-none"><option value="">Semua UPT</option></select>
      <select id="transaksi-filter-channel" class="bg-surface-container px-3 py-1.5 rounded-xl border border-border-subtle text-xs font-semibold outline-none">
        <option value="">Semua Channel</option>
        <option value="WhatsApp">WhatsApp</option><option value="Shopee">Shopee</option>
        <option value="Tokopedia">Tokopedia</option><option value="Offline">Offline</option><option value="Lainnya">Lainnya</option>
      </select>
      <input id="transaksi-filter-dari" type="date" class="bg-surface-container px-3 py-1.5 rounded-xl border border-border-subtle text-xs font-semibold outline-none">
      <input id="transaksi-filter-sampai" type="date" class="bg-surface-container px-3 py-1.5 rounded-xl border border-border-subtle text-xs font-semibold outline-none">
      <input id="transaksi-search" type="text" placeholder="Cari produk/UPT..." class="bg-surface-container px-3 py-1.5 rounded-xl border border-border-subtle text-xs font-semibold outline-none flex-1 min-w-[160px]">
    </div>
    <div class="overflow-x-auto rounded-xl border border-border-subtle/80">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="bg-surface-container"><tr class="text-slate-700 font-extrabold uppercase tracking-wider text-[11px]">
          <th class="py-3 px-3.5">Tanggal</th><th class="py-3 px-3">UPT</th><th class="py-3 px-3">Produk</th>
          <th class="py-3 px-3 text-right">Jumlah</th><th class="py-3 px-3 text-right">Total</th><th class="py-3 px-3">Channel</th><th class="py-3 px-3.5 text-center">Aksi</th>
        </tr></thead>
        <tbody id="transaksi-table-body" class="divide-y divide-border-subtle/70 bg-white"></tbody>
      </table>
    </div>
    <div class="flex justify-center mt-4">
      <button id="transaksi-load-more" class="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-sm">Muat lebih banyak</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Write `super-admin-transaksi.js`**

```javascript
let __transaksiPage = 0;
const __transaksiPageSize = 50;
let __transaksiUptOptionsLoaded = false;

async function loadTransaksiTab() {
  __transaksiPage = 0;
  document.getElementById("transaksi-table-body").innerHTML = "";

  if (!__transaksiUptOptionsLoaded) {
    const { data: uptList } = await supabaseClient.from("upt").select("id, nama").order("nama");
    const select = document.getElementById("transaksi-filter-upt");
    (uptList || []).forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.nama;
      select.appendChild(opt);
    });
    __transaksiUptOptionsLoaded = true;
  }

  await loadTransaksiPage();
}

async function loadTransaksiPage() {
  let query = supabaseClient
    .from("transaksi_penjualan")
    .select("id, tanggal_transaksi, jumlah, total_harga, channel, upt_id, produk_id, upt:upt_id (nama), produk:produk_id (nama)")
    .order("tanggal_transaksi", { ascending: false })
    .range(__transaksiPage * __transaksiPageSize, __transaksiPage * __transaksiPageSize + __transaksiPageSize - 1);

  const uptId = document.getElementById("transaksi-filter-upt").value;
  const channel = document.getElementById("transaksi-filter-channel").value;
  const dari = document.getElementById("transaksi-filter-dari").value;
  const sampai = document.getElementById("transaksi-filter-sampai").value;

  if (uptId) query = query.eq("upt_id", uptId);
  if (channel) query = query.eq("channel", channel);
  if (dari) query = query.gte("tanggal_transaksi", dari);
  if (sampai) query = query.lte("tanggal_transaksi", sampai);

  const { data, error } = await query;
  if (error) {
    console.error("Gagal memuat transaksi:", error);
    return;
  }

  const search = (document.getElementById("transaksi-search").value || "").trim().toLowerCase();
  const filtered = search
    ? data.filter((t) => (t.upt?.nama || "").toLowerCase().includes(search) || (t.produk?.nama || "").toLowerCase().includes(search))
    : data;

  const tbody = document.getElementById("transaksi-table-body");
  const rowsHtml = filtered.map((t) => {
    const produkLabel = t.produk?.nama
      ? escapeHtml(t.produk.nama)
      : `<span class="italic text-slate-400">Produk sudah dihapus</span>`;
    return `
      <tr>
        <td class="py-2.5 px-3.5">${escapeHtml(t.tanggal_transaksi)}</td>
        <td class="py-2.5 px-3">${escapeHtml(t.upt?.nama || "-")}</td>
        <td class="py-2.5 px-3">${produkLabel}</td>
        <td class="py-2.5 px-3 text-right">${t.jumlah}</td>
        <td class="py-2.5 px-3 text-right font-bold">${formatRupiah(t.total_harga)}</td>
        <td class="py-2.5 px-3">${escapeHtml(t.channel || "-")}</td>
        <td class="py-2.5 px-3.5 text-center">
          <button class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 text-[11px] font-bold border border-rose-200" onclick="window.deleteTransaksi('${t.id}')">Hapus</button>
        </td>
      </tr>`;
  }).join("");

  if (__transaksiPage === 0) tbody.innerHTML = rowsHtml;
  else tbody.insertAdjacentHTML("beforeend", rowsHtml);

  document.getElementById("transaksi-load-more").style.display = data.length < __transaksiPageSize ? "none" : "inline-block";
}

window.deleteTransaksi = async function (transaksiId) {
  if (!confirm("Hapus transaksi ini secara permanen? Aksi ini dicatat di log admin.")) return;
  const { error } = await supabaseClient.rpc("admin_delete_transaksi", { p_transaksi_id: transaksiId });
  if (error) {
    alert("Gagal menghapus: " + error.message);
    return;
  }
  __transaksiPage = 0;
  await loadTransaksiPage();
};

document.addEventListener("DOMContentLoaded", () => {
  ["transaksi-filter-upt", "transaksi-filter-channel", "transaksi-filter-dari", "transaksi-filter-sampai"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => { __transaksiPage = 0; loadTransaksiPage(); });
  });
  document.getElementById("transaksi-search")?.addEventListener("input", () => { __transaksiPage = 0; loadTransaksiPage(); });
  document.getElementById("transaksi-load-more")?.addEventListener("click", () => { __transaksiPage += 1; loadTransaksiPage(); });
});
```

- [ ] **Step 3: Wire tab activation and script tag**

In `super-admin-dashboard.html`, extend `window.onTabActivated`:
```javascript
window.onTabActivated = function (tabName) {
  if (tabName === "kelola-upt") loadKelolaUptTable();
  if (tabName === "transaksi") loadTransaksiTab();
};
```
Add `<script src="/assets/js/super-admin-transaksi.js"></script>`.

- [ ] **Step 4: Manual verification**

Click Transaksi tab → transactions load, newest first. Filter by the UPT that has the known dummy transactions (from the earlier summary: Lapas Subang, `produk_id` null) → rows show "Produk sudah dihapus". Click Hapus on one of those dummy rows → confirm → row disappears, re-check `/monitoring` and super admin Overview tab — that UPT's Volume/Omzet drop accordingly. Check `admin_activity_log` has a `delete_transaction` row with `changes.before` containing the deleted row's data.

- [ ] **Step 5: Commit**

```bash
git add super-admin-dashboard.html assets/js/super-admin-transaksi.js
git commit -m "Add Transaksi tab: filterable, paginated, delete with audit log"
```

---

### Task 10: Tab Analytics

**Files:**
- Create: `assets/js/super-admin-analytics.js`
- Modify: `super-admin-dashboard.html`

**Interfaces:**
- Consumes: `escapeHtml()`, `formatRupiah()` from Task 2.
- Produces: `function loadAnalyticsTab()` (called on tab activation).

- [ ] **Step 1: Add panel markup**

```html
<div id="panel-analytics" data-panel="analytics" class="space-y-6 hidden">
  <div class="bg-white rounded-2xl p-6 shadow-sm border border-border-subtle">
    <h2 class="font-bold text-lg text-primary mb-4">Top UPT Ranking</h2>
    <table class="w-full text-left text-xs border-collapse">
      <thead><tr class="text-slate-700 font-extrabold uppercase text-[11px]"><th class="py-2">Rank</th><th class="py-2">UPT</th><th class="py-2 text-right">Omzet</th><th class="py-2 text-right">Volume</th></tr></thead>
      <tbody id="analytics-ranking-body"></tbody>
    </table>
  </div>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="bg-white rounded-2xl p-6 shadow-sm border border-border-subtle">
      <h3 class="font-bold text-base text-primary mb-3">Performa per Wilayah</h3>
      <table class="w-full text-left text-xs border-collapse">
        <thead><tr class="text-slate-700 font-extrabold uppercase text-[11px]"><th class="py-2">Wilayah</th><th class="py-2 text-right">Omzet</th><th class="py-2 text-right">UPT</th></tr></thead>
        <tbody id="analytics-wilayah-body"></tbody>
      </table>
    </div>
    <div class="bg-white rounded-2xl p-6 shadow-sm border border-border-subtle">
      <h3 class="font-bold text-base text-primary mb-3">Performa Kategori Produk</h3>
      <table class="w-full text-left text-xs border-collapse">
        <thead><tr class="text-slate-700 font-extrabold uppercase text-[11px]"><th class="py-2">Kategori</th><th class="py-2 text-right">Volume</th><th class="py-2 text-right">Omzet</th></tr></thead>
        <tbody id="analytics-kategori-body"></tbody>
      </table>
    </div>
  </div>
  <div class="bg-white rounded-2xl p-6 shadow-sm border border-border-subtle text-center">
    <p class="text-sm font-semibold text-slate-500">Tren bulanan belum tersedia</p>
    <p class="text-xs text-slate-400">Growth % dan grafik tren memerlukan agregasi data bulanan yang belum dibangun.</p>
  </div>
</div>
```

- [ ] **Step 2: Write `super-admin-analytics.js`**

```javascript
async function loadAnalyticsTab() {
  const [{ data: uptList }, { data: transaksi }, { data: produk }] = await Promise.all([
    supabaseClient.from("upt").select("id, nama, wilayah"),
    supabaseClient.from("transaksi_penjualan").select("upt_id, produk_id, jumlah, total_harga"),
    supabaseClient.from("produk").select("id, kategori, status"),
  ]);

  if (!uptList || !transaksi || !produk) return;

  const produkById = new Map(produk.map((p) => [p.id, p]));

  const perUpt = new Map();
  uptList.forEach((u) => perUpt.set(u.id, { nama: u.nama, wilayah: u.wilayah, omzet: 0, volume: 0 }));
  transaksi.forEach((t) => {
    const entry = perUpt.get(t.upt_id);
    if (!entry) return;
    entry.omzet += Number(t.total_harga) || 0;
    entry.volume += Number(t.jumlah) || 0;
  });

  const ranking = Array.from(perUpt.values()).sort((a, b) => b.omzet - a.omzet);
  document.getElementById("analytics-ranking-body").innerHTML = ranking.map((u, i) => `
    <tr><td class="py-2 font-bold">${i + 1}</td><td class="py-2">${escapeHtml(u.nama)}</td><td class="py-2 text-right font-bold">${formatRupiah(u.omzet)}</td><td class="py-2 text-right">${u.volume}</td></tr>
  `).join("");

  const perWilayah = new Map();
  uptList.forEach((u) => {
    const key = u.wilayah || "Tanpa Wilayah";
    if (!perWilayah.has(key)) perWilayah.set(key, { omzet: 0, jumlahUpt: 0 });
    perWilayah.get(key).jumlahUpt += 1;
  });
  transaksi.forEach((t) => {
    const u = perUpt.get(t.upt_id);
    if (!u) return;
    const key = u.wilayah || "Tanpa Wilayah";
    perWilayah.get(key).omzet += Number(t.total_harga) || 0;
  });
  document.getElementById("analytics-wilayah-body").innerHTML = Array.from(perWilayah.entries())
    .sort((a, b) => b[1].omzet - a[1].omzet)
    .map(([wilayah, data]) => `<tr><td class="py-2">${escapeHtml(wilayah)}</td><td class="py-2 text-right font-bold">${formatRupiah(data.omzet)}</td><td class="py-2 text-right">${data.jumlahUpt}</td></tr>`)
    .join("");

  const perKategori = new Map();
  transaksi.forEach((t) => {
    const p = produkById.get(t.produk_id);
    const kategori = p?.kategori || "Tanpa Kategori";
    if (!perKategori.has(kategori)) perKategori.set(kategori, { volume: 0, omzet: 0 });
    perKategori.get(kategori).volume += Number(t.jumlah) || 0;
    perKategori.get(kategori).omzet += Number(t.total_harga) || 0;
  });
  document.getElementById("analytics-kategori-body").innerHTML = Array.from(perKategori.entries())
    .sort((a, b) => b[1].omzet - a[1].omzet)
    .map(([kategori, data]) => `<tr><td class="py-2">${escapeHtml(kategori)}</td><td class="py-2 text-right">${data.volume}</td><td class="py-2 text-right font-bold">${formatRupiah(data.omzet)}</td></tr>`)
    .join("");
}
```

- [ ] **Step 3: Wire tab activation and script tag**

```javascript
window.onTabActivated = function (tabName) {
  if (tabName === "kelola-upt") loadKelolaUptTable();
  if (tabName === "transaksi") loadTransaksiTab();
  if (tabName === "analytics") loadAnalyticsTab();
};
```
Add `<script src="/assets/js/super-admin-analytics.js"></script>`.

- [ ] **Step 4: Manual verification**

Click Analytics tab → ranking table sorted by omzet descending (Lapas Subang near top from earlier test data), Wilayah table shows real wilayah names with correct totals (cross-check against `/monitoring`'s Distribusi Wilayah numbers — they must match), Kategori table shows "Produk sudah dihapus" transactions folded into "Tanpa Kategori" bucket since `produk_id` is null for those.

- [ ] **Step 5: Commit**

```bash
git add super-admin-dashboard.html assets/js/super-admin-analytics.js
git commit -m "Add Analytics tab: UPT ranking, wilayah, and category performance"
```

---

### Task 11: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full flow test**

1. `/admin-login` with super admin credentials → dashboard loads.
2. Overview tab: all 33 UPT in table, KPI/donut/kategori/wilayah match `/monitoring` exactly.
3. Kelola UPT: edit a UPT, reset a password, lock then unlock a UPT — each persists and is reflected on reload.
4. Transaksi: delete the known dummy transaction(s) on Lapas Subang; confirm they're gone from Overview/Transaksi/public `/monitoring` afterward.
5. Analytics: numbers are internally consistent with Overview tab after the deletion above.
6. Log out → redirected to `/admin-login`; `/super-admin-dashboard` directly while logged out redirects back.
7. Attempt `/admin-login` with a UPT account's credentials → rejected with the "bukan akun Super Admin" message; that account can still log in normally at `/login`.
8. Lock a UPT from the dashboard, then try that UPT's `/login` → blocked with the lock message; unlock and retry → succeeds.

- [ ] **Step 2: Push the branch**

```bash
git push origin main
```

(Only after the user confirms every check above passed.)

---

## Spec Coverage Check

- Bagian 1 (Auth & Otorisasi) → Tasks 1, 3, 4.
- Bagian 2 (Skema baru) → Task 1.
- Bagian 3 (Layout & navigasi) → Task 4.
- Bagian 4 (Tab Overview) → Task 5.
- Bagian 5 (Tab Kelola UPT) → Tasks 6, 7, 8.
- Bagian 6 (Tab Transaksi) → Task 9.
- Bagian 7 (Tab Analytics) → Task 10.
- Bagian 8 (Activity logging, backend only) → embedded in Tasks 1, 6, 7, 9 (every privileged write logs).
- Testing section of spec → Task 11.
