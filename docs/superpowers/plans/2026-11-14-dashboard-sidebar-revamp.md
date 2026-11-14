# Dashboard Sidebar Revamp + Product List/Delete + Catalog Units-Sold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single-page UPT dashboard (`input-produk.html`) into 4 sidebar-navigated pages (overview, produk, penjualan, profil), add a product list with deactivate/reactivate/delete, and show a "units sold" badge on the public catalog.

**Architecture:** Plain static HTML pages, no build step. A new shared JS file (`/assets/js/upt-dashboard.js`) centralizes the "require login, fetch my UPT info, render sidebar, wire logout" logic that all 4 dashboard pages need, loaded via `<script>` tag like every other shared script in this project. Each page keeps its own page-specific inline `<script>` for its own feature logic, consistent with how every other page in this project works.

**Tech Stack:** HTML + Tailwind CDN + vanilla JS, `@supabase/supabase-js@2.45.4` (CDN), Google Material Symbols font (for sidebar icons — new to these pages, already used elsewhere in the project), PapaParse `5.4.1` (CDN, already used for CSV).

## Global Constraints

- No new npm/build tooling — CDN `<script>` tags only, exactly as every existing page does.
- This project has no automated test runner. Every task's "test" step is a manual browser verification against the live Vercel deployment, not automated test code.
- RLS already covers everything this plan needs — no new SQL in this plan. `produk` already has working `update`/`delete` policies scoped to the logged-in UPT's own rows (from `docs/supabase-auth-setup.sql`), and `upt`/`transaksi_penjualan` read access is already public (existing policies). Do not add new SQL files for this plan.
- Every new page must call the shared `requireUptSession()` helper before rendering anything UPT-specific, and redirect to `/login` if there's no session — consistent with the existing pages' current behavior.
- Deleting a product does not delete its Storage image file — out of scope, documented in the spec.
- The "units sold" badge and all 4 KPI numbers are computed client-side from full table reads (no server-side aggregation) — acceptable at this project's current data scale, per the spec.

---

### Task 1: Shared sidebar/auth helper + Dashboard (ringkasan) page

**Files:**
- Create: `assets/js/upt-dashboard.js`
- Create: `dashboard.html`
- Modify: `login.html` (change post-login redirect target)

**Interfaces:**
- Produces: `async function requireUptSession()` — returns `{ uptId, nama, kode, whatsapp }` or `null` (and redirects to `/login` itself) if there's no session. `function renderSidebar(activePage, uptInfo)` — fills in the sidebar's UPT name/code, highlights the nav link matching `activePage` (one of `"dashboard"`, `"produk"`, `"penjualan"`, `"profil"`), and wires the logout button. Both are global functions (no modules/exports — plain script, consistent with the rest of this project) that every dashboard page in Tasks 2-4 calls the same way.
- Consumes: `supabaseClient` (global, from the already-existing `/assets/js/supabase-client.js`, loaded before this file on every page).

- [ ] **Step 1: Create the shared helper**

Write this exact content to `assets/js/upt-dashboard.js`:

```javascript
async function requireUptSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "/login";
    return null;
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("upt_id, upt:upt_id (nama, kode, whatsapp)")
    .eq("id", session.user.id)
    .single();

  if (error || !profile) {
    console.error("Gagal memuat profil UPT:", error);
    return null;
  }

  return {
    uptId: profile.upt_id,
    nama: profile.upt.nama,
    kode: profile.upt.kode,
    whatsapp: profile.upt.whatsapp,
  };
}

function renderSidebar(activePage, uptInfo) {
  const namaTop = document.getElementById("sidebar-upt-nama");
  const namaBottom = document.getElementById("sidebar-upt-nama-bawah");
  const kodeEl = document.getElementById("sidebar-upt-kode");

  if (namaTop) namaTop.textContent = uptInfo ? uptInfo.nama : "-";
  if (namaBottom) namaBottom.textContent = uptInfo ? uptInfo.nama : "-";
  if (kodeEl) kodeEl.textContent = uptInfo ? `Kode: ${uptInfo.kode}` : "-";

  document.querySelectorAll(".sidebar-link").forEach((link) => {
    if (link.dataset.page === activePage) {
      link.classList.add("bg-white/15", "text-white");
      link.classList.remove("text-blue-100");
    } else {
      link.classList.remove("bg-white/15", "text-white");
      link.classList.add("text-blue-100");
    }
  });

  const logoutBtn = document.getElementById("sidebar-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "/login";
    });
  }
}
```

- [ ] **Step 2: Create `dashboard.html`**

Write this exact content to `dashboard.html` (this is the sidebar shell every Task 2-4 page reuses verbatim, with only the `<main>` contents and the page-specific `<script>` differing — and with `data-page="dashboard"`'s link marked `aria-current` here only):

```html
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Dashboard - Panel UPT Karya WBP</title>
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
          primary: "#00102d",
          "primary-container": "#0f254a",
          "surface-canvas": "#F4F6FA",
          "surface-card": "#FFFFFF",
          "border-subtle": "#E2E8F0",
        },
        fontFamily: { sans: ["Plus Jakarta Sans", "sans-serif"] },
      },
    },
  };
</script>
<style>body { font-family: "Plus Jakarta Sans", sans-serif; }</style>
</head>
<body class="bg-surface-canvas text-primary min-h-screen">
<div class="min-h-screen flex">
  <aside class="w-64 bg-primary text-white flex flex-col fixed inset-y-0 left-0 z-40">
    <div class="p-5 border-b border-white/10">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-container flex items-center justify-center ring-1 ring-white/20 shrink-0">
          <span class="material-symbols-outlined text-amber-300 text-[20px]">verified</span>
        </div>
        <div class="min-w-0">
          <div class="font-bold text-sm leading-tight">Panel UPT</div>
          <div class="text-[11px] text-blue-200/80 truncate" id="sidebar-upt-nama">Memuat...</div>
        </div>
      </div>
    </div>
    <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-1">
      <a href="/dashboard" data-page="dashboard" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">dashboard</span>Dashboard
      </a>
      <a href="/dashboard-produk" data-page="produk" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">inventory_2</span>Produk
      </a>
      <a href="/dashboard-penjualan" data-page="penjualan" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">point_of_sale</span>Penjualan
      </a>
      <a href="/dashboard-profil" data-page="profil" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">storefront</span>Profil UPT
      </a>
    </nav>
    <div class="p-4 border-t border-white/10 space-y-3">
      <div class="text-xs">
        <div class="font-bold" id="sidebar-upt-nama-bawah">-</div>
        <div class="text-blue-200/70" id="sidebar-upt-kode">-</div>
      </div>
      <a href="/" class="flex items-center gap-2 text-xs font-semibold text-blue-200 hover:text-white transition">
        <span class="material-symbols-outlined text-[16px]">open_in_new</span>Lihat Katalog
      </a>
      <button id="sidebar-logout-btn" class="flex items-center gap-2 text-xs font-semibold text-blue-200 hover:text-white transition">
        <span class="material-symbols-outlined text-[16px]">logout</span>Keluar
      </button>
    </div>
  </aside>

  <main class="flex-1 ml-64 min-h-screen p-6 sm:p-8">
    <h1 class="font-extrabold text-xl text-primary mb-6">Ringkasan</h1>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <div class="bg-surface-card rounded-2xl p-5 shadow-sm border border-border-subtle">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Total Produk Aktif</span>
        <div class="text-2xl font-extrabold text-primary mt-2" id="kpi-produk-aktif">-</div>
      </div>
      <div class="bg-surface-card rounded-2xl p-5 shadow-sm border border-border-subtle">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Total Unit Terjual</span>
        <div class="text-2xl font-extrabold text-primary mt-2" id="kpi-unit-terjual">-</div>
      </div>
      <div class="bg-surface-card rounded-2xl p-5 shadow-sm border border-border-subtle">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Total Omzet</span>
        <div class="text-2xl font-extrabold text-primary mt-2" id="kpi-omzet">-</div>
      </div>
      <div class="bg-surface-card rounded-2xl p-5 shadow-sm border border-border-subtle">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Transaksi Bulan Ini</span>
        <div class="text-2xl font-extrabold text-primary mt-2" id="kpi-transaksi-bulan-ini">-</div>
      </div>
    </div>
  </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="/assets/js/supabase-client.js"></script>
<script src="/assets/js/upt-dashboard.js"></script>
<script>
  async function loadDashboardStats(uptId) {
    const [produkResult, transResult] = await Promise.all([
      supabaseClient.from("produk").select("id", { count: "exact", head: true }).eq("upt_id", uptId).eq("status", "aktif"),
      supabaseClient.from("transaksi_penjualan").select("jumlah, total_harga, tanggal_transaksi").eq("upt_id", uptId),
    ]);

    const totalProdukAktif = produkResult.count || 0;
    const transaksi = transResult.data || [];
    const totalUnitTerjual = transaksi.reduce((sum, t) => sum + (t.jumlah || 0), 0);
    const totalOmzet = transaksi.reduce((sum, t) => sum + Number(t.total_harga || 0), 0);

    const now = new Date();
    const bulanIni = transaksi.filter((t) => {
      const d = new Date(t.tanggal_transaksi + "T00:00:00");
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;

    document.getElementById("kpi-produk-aktif").textContent = totalProdukAktif;
    document.getElementById("kpi-unit-terjual").textContent = totalUnitTerjual.toLocaleString("id-ID");
    document.getElementById("kpi-omzet").textContent = "Rp " + totalOmzet.toLocaleString("id-ID");
    document.getElementById("kpi-transaksi-bulan-ini").textContent = bulanIni;
  }

  (async () => {
    const uptInfo = await requireUptSession();
    if (!uptInfo) return;
    renderSidebar("dashboard", uptInfo);
    loadDashboardStats(uptInfo.uptId);
  })();
</script>
</body>
</html>
```

- [ ] **Step 3: Update `login.html`'s post-login redirect**

`login.html` currently redirects to `/input-produk` in two places (once in the "already logged in" check, once after a successful sign-in). Find both occurrences of this exact string:

```javascript
window.location.href = "/input-produk";
```

Replace each with:

```javascript
window.location.href = "/dashboard";
```

(There are two separate occurrences in the file — one inside `supabaseClient.auth.getSession().then(...)`, one at the end of the form submit handler. Replace both.)

- [ ] **Step 4: Manual test**

1. Open `/login`, log in with a UPT account. Expected: redirected to `/dashboard` (not `/input-produk`).
2. On `/dashboard`, confirm the sidebar shows "Panel UPT" at top, the UPT's real name underneath, 4 nav links (Dashboard/Produk/Penjualan/Profil UPT) with the "Dashboard" link visually highlighted (different background than the other 3), and at the bottom the UPT's name + "Kode: ..." + "Lihat Katalog" + "Keluar".
3. Confirm the 4 KPI numbers render (not stuck on "-"). If this UPT has products/transactions from earlier testing, sanity-check the numbers look plausible (e.g. "Total Unit Terjual" should be at least as large as any single transaction's `jumlah` you know you entered earlier).
4. Click "Produk", "Penjualan", "Profil UPT" in the sidebar — expected: all three currently 404 (they don't exist yet, that's expected — Tasks 2-4 create them). This confirms the links point to the right future paths.
5. Click "Keluar". Expected: redirected to `/login`. Try opening `/dashboard` directly afterward — expected: redirected back to `/login` (no session).

- [ ] **Step 5: Commit**

```bash
git add assets/js/upt-dashboard.js dashboard.html login.html
git commit -m "Add shared UPT sidebar/auth helper and dashboard overview page"
```

---

### Task 2: Halaman Produk — pindahkan form + tambah daftar produk dengan nonaktifkan/hapus

**Files:**
- Create: `dashboard-produk.html`
- Read (for migration source, do not modify): `input-produk.html`

**Interfaces:**
- Consumes: `requireUptSession()`, `renderSidebar()` (Task 1).
- Produces: nothing new consumed by later tasks — Task 3 and Task 4 each create their own independent page, they don't call anything defined here.

- [ ] **Step 1: Read the current produk-form code to migrate**

Open `input-produk.html` and locate: the `<form id="produk-form">` markup (nama/kategori/harga/deskripsi/foto fields, submit button, message div), and in its `<script>` block: the `uploadFoto(file, uptId)` function and the `produk-form`'s submit event listener (the one that calls `supabaseClient.from("produk").insert({...})`). These are the pieces you're moving into the new page below — read them so you can confirm the new page's Step 2 markup and Step 3 script match the original behavior (same field names, same validation, same `status: "aktif"` on insert), adapting only the two things called out explicitly in Step 3 (using `uptInfo.uptId` instead of a module-level `currentUptId`, and calling `loadProdukList` instead of the old `loadProdukDropdown` after a successful save, since the sales dropdown now lives on a different page).

- [ ] **Step 2: Create `dashboard-produk.html`**

Write this exact content to `dashboard-produk.html` — note the `<head>`, `<aside>` sidebar block, and the `<script>` tags for Supabase/the shared helper are IDENTICAL to `dashboard.html` from Task 1 except for `<title>`, the active nav link gets highlighted via JS (not hardcoded), and everything inside `<main>` is new:

```html
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Produk - Panel UPT Karya WBP</title>
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
          primary: "#00102d",
          "primary-container": "#0f254a",
          "surface-canvas": "#F4F6FA",
          "surface-card": "#FFFFFF",
          "border-subtle": "#E2E8F0",
        },
        fontFamily: { sans: ["Plus Jakarta Sans", "sans-serif"] },
      },
    },
  };
</script>
<style>body { font-family: "Plus Jakarta Sans", sans-serif; }</style>
</head>
<body class="bg-surface-canvas text-primary min-h-screen">
<div class="min-h-screen flex">
  <aside class="w-64 bg-primary text-white flex flex-col fixed inset-y-0 left-0 z-40">
    <div class="p-5 border-b border-white/10">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-container flex items-center justify-center ring-1 ring-white/20 shrink-0">
          <span class="material-symbols-outlined text-amber-300 text-[20px]">verified</span>
        </div>
        <div class="min-w-0">
          <div class="font-bold text-sm leading-tight">Panel UPT</div>
          <div class="text-[11px] text-blue-200/80 truncate" id="sidebar-upt-nama">Memuat...</div>
        </div>
      </div>
    </div>
    <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-1">
      <a href="/dashboard" data-page="dashboard" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">dashboard</span>Dashboard
      </a>
      <a href="/dashboard-produk" data-page="produk" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">inventory_2</span>Produk
      </a>
      <a href="/dashboard-penjualan" data-page="penjualan" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">point_of_sale</span>Penjualan
      </a>
      <a href="/dashboard-profil" data-page="profil" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">storefront</span>Profil UPT
      </a>
    </nav>
    <div class="p-4 border-t border-white/10 space-y-3">
      <div class="text-xs">
        <div class="font-bold" id="sidebar-upt-nama-bawah">-</div>
        <div class="text-blue-200/70" id="sidebar-upt-kode">-</div>
      </div>
      <a href="/" class="flex items-center gap-2 text-xs font-semibold text-blue-200 hover:text-white transition">
        <span class="material-symbols-outlined text-[16px]">open_in_new</span>Lihat Katalog
      </a>
      <button id="sidebar-logout-btn" class="flex items-center gap-2 text-xs font-semibold text-blue-200 hover:text-white transition">
        <span class="material-symbols-outlined text-[16px]">logout</span>Keluar
      </button>
    </div>
  </aside>

  <main class="flex-1 ml-64 min-h-screen p-6 sm:p-8 max-w-2xl">
    <h1 class="font-extrabold text-xl text-primary mb-6">Produk</h1>

    <form id="produk-form" class="bg-white rounded-2xl shadow-sm border border-border-subtle p-6 space-y-5">
      <h2 class="font-bold text-base text-primary">Tambah Produk</h2>

      <div>
        <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="nama">Nama Produk *</label>
        <input id="nama" name="nama" type="text" required maxlength="150" placeholder="Misal: Kopi Robusta Tangkuban Parahu"
          class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="kategori">Kategori *</label>
          <select id="kategori" name="kategori" required
            class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
            <option value="" disabled selected>Pilih kategori</option>
            <option value="Kriya">Kriya</option>
            <option value="Tekstil">Tekstil</option>
            <option value="Kuliner">Kuliner</option>
            <option value="Mebel">Mebel</option>
            <option value="Pertanian">Pertanian</option>
            <option value="Jasa">Jasa</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="harga">Harga (Rp) *</label>
          <input id="harga" name="harga" type="number" min="0" step="500" required placeholder="50000"
            class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="deskripsi">Deskripsi</label>
        <textarea id="deskripsi" name="deskripsi" rows="3" maxlength="500" placeholder="Deskripsi singkat produk (opsional)"
          class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"></textarea>
      </div>

      <div>
        <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="foto">Foto Produk</label>
        <input id="foto" name="foto" type="file" accept="image/png,image/jpeg,image/webp"
          class="w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-semibold file:text-xs hover:file:bg-slate-200">
        <p class="text-[11px] text-slate-500 mt-1">Maks 2MB. Format: JPG, PNG, atau WebP.</p>
      </div>

      <div id="form-message" class="hidden text-sm font-semibold rounded-lg px-3 py-2"></div>

      <button type="submit" id="submit-btn"
        class="w-full py-3 rounded-lg bg-primary-container text-white font-bold text-sm hover:bg-primary transition disabled:opacity-50 disabled:cursor-not-allowed">
        Simpan Produk
      </button>
    </form>

    <section class="bg-white rounded-2xl shadow-sm border border-border-subtle p-6 mt-6">
      <h2 class="font-bold text-base text-primary mb-4">Daftar Produk</h2>
      <div id="produk-list" class="space-y-3">
        <p class="text-sm text-slate-400 text-center py-6">Memuat daftar produk...</p>
      </div>
    </section>
  </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="/assets/js/supabase-client.js"></script>
<script src="/assets/js/upt-dashboard.js"></script>
<script>
  let currentUptId = null;
  const form = document.getElementById("produk-form");
  const submitBtn = document.getElementById("submit-btn");
  const messageBox = document.getElementById("form-message");

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function formatRupiah(n) {
    return "Rp " + Number(n).toLocaleString("id-ID");
  }

  function showMessage(text, type) {
    messageBox.textContent = text;
    messageBox.className = "text-sm font-semibold rounded-lg px-3 py-2 " +
      (type === "error"
        ? "bg-red-50 text-red-700 border border-red-200"
        : "bg-emerald-50 text-emerald-700 border border-emerald-200");
    messageBox.classList.remove("hidden");
  }

  async function uploadFoto(file, uptId) {
    const ext = file.name.split(".").pop();
    const path = `${uptId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadError } = await supabaseClient.storage
      .from("produk-images")
      .upload(path, file);
    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseClient.storage.from("produk-images").getPublicUrl(path);
    return urlData.publicUrl;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = "Menyimpan...";
    messageBox.classList.add("hidden");

    try {
      const nama = document.getElementById("nama").value.trim();
      const kategori = document.getElementById("kategori").value;
      const harga = parseFloat(document.getElementById("harga").value);
      const deskripsi = document.getElementById("deskripsi").value.trim() || null;
      const fotoFile = document.getElementById("foto").files[0];

      let image_url = null;
      if (fotoFile) {
        if (fotoFile.size > 2 * 1024 * 1024) {
          throw new Error("Ukuran foto melebihi 2MB.");
        }
        image_url = await uploadFoto(fotoFile, currentUptId);
      }

      const { error: insertError } = await supabaseClient.from("produk").insert({
        upt_id: currentUptId,
        nama,
        kategori,
        harga,
        deskripsi,
        image_url,
        status: "aktif",
      });
      if (insertError) throw insertError;

      showMessage("Produk berhasil disimpan.", "success");
      form.reset();
      loadProdukList(currentUptId);
    } catch (err) {
      console.error(err);
      showMessage("Gagal menyimpan produk: " + (err.message || "terjadi kesalahan"), "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Simpan Produk";
    }
  });

  function renderProdukListItem(p) {
    const statusBadge = p.status === "aktif"
      ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Aktif</span>'
      : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Nonaktif</span>';
    const toggleLabel = p.status === "aktif" ? "Nonaktifkan" : "Aktifkan";
    const img = p.image_url
      ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.nama)}" class="w-12 h-12 rounded-lg object-cover border border-border-subtle">`
      : `<div class="w-12 h-12 rounded-lg bg-surface-canvas border border-border-subtle flex items-center justify-center text-[9px] text-slate-400 text-center">No Foto</div>`;

    return `
      <div class="flex items-center gap-3 p-3 border border-border-subtle rounded-xl">
        ${img}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-sm text-primary truncate">${escapeHtml(p.nama)}</span>
            ${statusBadge}
          </div>
          <div class="text-xs text-slate-500">${escapeHtml(p.kategori || "-")} &middot; ${formatRupiah(p.harga)}</div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button class="toggle-status-btn px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary text-xs font-bold transition border border-border-subtle" data-id="${p.id}" data-current-status="${p.status}">${toggleLabel}</button>
          <button class="delete-produk-btn px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition border border-red-200" data-id="${p.id}" data-nama="${escapeHtml(p.nama)}">Hapus</button>
        </div>
      </div>`;
  }

  async function loadProdukList(uptId) {
    const container = document.getElementById("produk-list");
    const { data, error } = await supabaseClient
      .from("produk")
      .select("id, nama, kategori, harga, image_url, status")
      .eq("upt_id", uptId)
      .order("created_at", { ascending: false });

    if (error) {
      container.innerHTML = '<p class="text-sm text-red-500 text-center py-6">Gagal memuat daftar produk.</p>';
      console.error(error);
      return;
    }

    if (!data || data.length === 0) {
      container.innerHTML = '<p class="text-sm text-slate-400 text-center py-6">Belum ada produk terdaftar.</p>';
      return;
    }

    container.innerHTML = data.map(renderProdukListItem).join("");

    container.querySelectorAll(".toggle-status-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const newStatus = btn.dataset.currentStatus === "aktif" ? "nonaktif" : "aktif";
        btn.disabled = true;
        const { error: updateError } = await supabaseClient.from("produk").update({ status: newStatus }).eq("id", id);
        if (updateError) {
          alert("Gagal mengubah status: " + updateError.message);
          btn.disabled = false;
          return;
        }
        loadProdukList(uptId);
      });
    });

    container.querySelectorAll(".delete-produk-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const nama = btn.dataset.nama;
        const confirmed = confirm(`Yakin hapus "${nama}"? Transaksi lama yang pernah pakai produk ini akan kehilangan nama produknya. Tindakan ini tidak bisa dibatalkan.`);
        if (!confirmed) return;
        btn.disabled = true;
        const { error: deleteError } = await supabaseClient.from("produk").delete().eq("id", id);
        if (deleteError) {
          alert("Gagal menghapus produk: " + deleteError.message);
          btn.disabled = false;
          return;
        }
        loadProdukList(uptId);
      });
    });
  }

  (async () => {
    const uptInfo = await requireUptSession();
    if (!uptInfo) return;
    currentUptId = uptInfo.uptId;
    renderSidebar("produk", uptInfo);
    loadProdukList(currentUptId);
  })();
</script>
</body>
</html>
```

- [ ] **Step 3: Manual test**

1. Log in, go to `/dashboard-produk` (via sidebar or URL). Confirm the "Produk" sidebar link is highlighted.
2. Add a new product with a photo. Expected: success message, form resets, and the new product appears at the top of "Daftar Produk" below with "Aktif" badge, correct category/price, and the photo thumbnail.
3. Click "Nonaktifkan" on that product. Expected: badge changes to "Nonaktif", button label changes to "Aktifkan", no page reload.
4. Click "Aktifkan" to toggle it back. Expected: badge returns to "Aktif".
5. Click "Hapus" on a product that has NO sales transactions linked to it (use a fresh test product, not "Kopi Robusta" from earlier testing which has real transaction history). Expected: a browser confirm dialog appears; cancelling it leaves the product untouched; confirming it removes the product from the list permanently.
6. Go to `/` (public catalog) in a new tab. Confirm a product you just deactivated no longer appears there, and reappears after you reactivate it from the dashboard and refresh the catalog tab.

- [ ] **Step 4: Commit**

```bash
git add dashboard-produk.html
git commit -m "Add Produk dashboard page: moved product form, added list with deactivate/delete"
```

---

### Task 3: Halaman Penjualan — pindahkan form manual + CSV + riwayat

**Files:**
- Create: `dashboard-penjualan.html`
- Read (for migration source, do not modify): `input-produk.html`

**Interfaces:**
- Consumes: `requireUptSession()`, `renderSidebar()` (Task 1).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Read the current sales code to migrate**

Open `input-produk.html` and locate, in order: the manual sales `<form id="penjualan-form">` markup and its submit handler; the CSV upload section markup (`#csv-file-input`, `#csv-upload-btn`, `#download-template-btn`, `#csv-result`) and its supporting code (`VALID_CHANNELS`, `generateTemplateCsv()`, `validateCsvRow()`, the `isBlankTemplateRow` check added in an earlier fix round, the `Number.isInteger` and calendar-date validation also added in that fix round, the click handlers for both buttons including the button-disable-during-processing logic); the "Riwayat Transaksi" `<section>` markup and its `renderRiwayatTransaksi()` function; and the shared `escapeHtml`/`formatRupiah` helpers. Confirm you've found all of these — you are moving ALL sales-related code from that file into the new page below, adapting only what Step 2/3 call out explicitly (using `uptInfo.uptId` in place of the old `currentUptId`/`loadAccountUpt()` pattern, and — the one real behavior change — the sales dropdown's query in `loadProdukDropdown()` must add `.eq("status", "aktif")` so deactivated products don't show up as sellable).

- [ ] **Step 2: Create `dashboard-penjualan.html`**

Write this exact content to `dashboard-penjualan.html`:

```html
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Penjualan - Panel UPT Karya WBP</title>
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
          primary: "#00102d",
          "primary-container": "#0f254a",
          "surface-canvas": "#F4F6FA",
          "surface-card": "#FFFFFF",
          "border-subtle": "#E2E8F0",
        },
        fontFamily: { sans: ["Plus Jakarta Sans", "sans-serif"] },
      },
    },
  };
</script>
<style>body { font-family: "Plus Jakarta Sans", sans-serif; }</style>
</head>
<body class="bg-surface-canvas text-primary min-h-screen">
<div class="min-h-screen flex">
  <aside class="w-64 bg-primary text-white flex flex-col fixed inset-y-0 left-0 z-40">
    <div class="p-5 border-b border-white/10">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-container flex items-center justify-center ring-1 ring-white/20 shrink-0">
          <span class="material-symbols-outlined text-amber-300 text-[20px]">verified</span>
        </div>
        <div class="min-w-0">
          <div class="font-bold text-sm leading-tight">Panel UPT</div>
          <div class="text-[11px] text-blue-200/80 truncate" id="sidebar-upt-nama">Memuat...</div>
        </div>
      </div>
    </div>
    <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-1">
      <a href="/dashboard" data-page="dashboard" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">dashboard</span>Dashboard
      </a>
      <a href="/dashboard-produk" data-page="produk" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">inventory_2</span>Produk
      </a>
      <a href="/dashboard-penjualan" data-page="penjualan" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">point_of_sale</span>Penjualan
      </a>
      <a href="/dashboard-profil" data-page="profil" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">storefront</span>Profil UPT
      </a>
    </nav>
    <div class="p-4 border-t border-white/10 space-y-3">
      <div class="text-xs">
        <div class="font-bold" id="sidebar-upt-nama-bawah">-</div>
        <div class="text-blue-200/70" id="sidebar-upt-kode">-</div>
      </div>
      <a href="/" class="flex items-center gap-2 text-xs font-semibold text-blue-200 hover:text-white transition">
        <span class="material-symbols-outlined text-[16px]">open_in_new</span>Lihat Katalog
      </a>
      <button id="sidebar-logout-btn" class="flex items-center gap-2 text-xs font-semibold text-blue-200 hover:text-white transition">
        <span class="material-symbols-outlined text-[16px]">logout</span>Keluar
      </button>
    </div>
  </aside>

  <main class="flex-1 ml-64 min-h-screen p-6 sm:p-8 max-w-2xl">
    <h1 class="font-extrabold text-xl text-primary mb-6">Penjualan</h1>

    <section class="bg-white rounded-2xl shadow-sm border border-border-subtle p-6 space-y-5">
      <h2 class="font-bold text-base text-primary">Input Penjualan - Manual</h2>
      <form id="penjualan-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="penjualan-produk">Produk *</label>
          <select id="penjualan-produk" required
            class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
            <option value="" disabled selected>Memuat produk...</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="penjualan-jumlah">Jumlah *</label>
            <input id="penjualan-jumlah" type="number" min="1" step="1" required
              class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="penjualan-total">Total Harga (Rp) *</label>
            <input id="penjualan-total" type="number" min="0" step="500" required
              class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="penjualan-channel">Channel *</label>
            <select id="penjualan-channel" required
              class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
              <option value="" disabled selected>Pilih channel</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Shopee">Shopee</option>
              <option value="Tokopedia">Tokopedia</option>
              <option value="Offline">Offline</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="penjualan-tanggal">Tanggal Transaksi *</label>
            <input id="penjualan-tanggal" type="date" required
              class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
          </div>
        </div>
        <div id="penjualan-message" class="hidden text-sm font-semibold rounded-lg px-3 py-2"></div>
        <button type="submit" id="penjualan-submit-btn"
          class="w-full py-3 rounded-lg bg-primary-container text-white font-bold text-sm hover:bg-primary transition disabled:opacity-50">
          Simpan Transaksi
        </button>
      </form>
    </section>

    <section class="bg-white rounded-2xl shadow-sm border border-border-subtle p-6 mt-6 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <h2 class="font-bold text-base text-primary">Input Penjualan - Upload CSV (Bulk)</h2>
        <button id="download-template-btn" type="button" class="text-xs font-bold text-primary-container hover:underline">Download Template CSV</button>
      </div>
      <p class="text-xs text-slate-500">
        Format kolom wajib: <code class="bg-slate-100 px-1 rounded">nama_produk,jumlah,total_harga,channel,tanggal</code>.
        Channel harus salah satu dari: WhatsApp, Shopee, Tokopedia, Offline, Lainnya. Tanggal format YYYY-MM-DD.
      </p>
      <input id="csv-file-input" type="file" accept=".csv,text/csv"
        class="w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-semibold file:text-xs hover:file:bg-slate-200">
      <button id="csv-upload-btn" type="button"
        class="px-5 py-2.5 rounded-lg bg-primary-container text-white font-bold text-sm hover:bg-primary transition disabled:opacity-50">
        Proses Upload
      </button>
      <div id="csv-result" class="hidden text-sm space-y-2"></div>
    </section>

    <section class="bg-white rounded-2xl shadow-sm border border-border-subtle p-6 mt-6">
      <h2 class="font-bold text-base text-primary mb-4">Riwayat Transaksi</h2>
      <div class="overflow-x-auto max-h-[400px] overflow-y-auto rounded-lg border border-border-subtle/80">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="sticky top-0 bg-surface-container">
            <tr class="text-slate-700 font-extrabold uppercase tracking-wider text-[10px]">
              <th class="py-2.5 px-3">Tanggal</th>
              <th class="py-2.5 px-3">Produk</th>
              <th class="py-2.5 px-3 text-right">Jumlah</th>
              <th class="py-2.5 px-3 text-right">Total</th>
              <th class="py-2.5 px-3">Channel</th>
            </tr>
          </thead>
          <tbody id="riwayat-table-body" class="divide-y divide-border-subtle/70 bg-white">
            <tr><td colspan="5" class="py-4 px-3 text-center text-slate-400">Memuat riwayat...</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
<script src="/assets/js/supabase-client.js"></script>
<script src="/assets/js/upt-dashboard.js"></script>
<script>
  let currentUptId = null;
  let ownProdukList = [];
  const VALID_CHANNELS = ["WhatsApp", "Shopee", "Tokopedia", "Offline", "Lainnya"];

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function formatRupiah(n) {
    return "Rp " + Number(n).toLocaleString("id-ID");
  }

  async function renderRiwayatTransaksi() {
    const tbody = document.getElementById("riwayat-table-body");
    const { data, error } = await supabaseClient
      .from("transaksi_penjualan")
      .select("tanggal_transaksi, jumlah, total_harga, channel, produk:produk_id (nama)")
      .eq("upt_id", currentUptId)
      .order("tanggal_transaksi", { ascending: false })
      .limit(100);

    if (error) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-4 px-3 text-center text-red-500">Gagal memuat riwayat.</td></tr>`;
      console.error(error);
      return;
    }

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-4 px-3 text-center text-slate-400">Belum ada transaksi.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map((t) => `
      <tr>
        <td class="py-2.5 px-3">${escapeHtml(t.tanggal_transaksi)}</td>
        <td class="py-2.5 px-3">${escapeHtml(t.produk ? t.produk.nama : "-")}</td>
        <td class="py-2.5 px-3 text-right">${escapeHtml(String(t.jumlah))}</td>
        <td class="py-2.5 px-3 text-right font-semibold">${escapeHtml(formatRupiah(t.total_harga))}</td>
        <td class="py-2.5 px-3">${escapeHtml(t.channel || "-")}</td>
      </tr>`).join("");
  }

  async function loadProdukDropdown() {
    const select = document.getElementById("penjualan-produk");
    const { data, error } = await supabaseClient
      .from("produk")
      .select("id, nama")
      .eq("upt_id", currentUptId)
      .eq("status", "aktif")
      .order("nama", { ascending: true });

    if (error || !data || data.length === 0) {
      select.innerHTML = '<option value="" disabled selected>Belum ada produk aktif</option>';
      ownProdukList = [];
      return;
    }

    ownProdukList = data;
    select.innerHTML =
      '<option value="" disabled selected>Pilih produk...</option>' +
      data.map((p) => `<option value="${p.id}">${escapeHtml(p.nama)}</option>`).join("");
  }

  document.getElementById("penjualan-tanggal").valueAsDate = new Date();

  document.getElementById("penjualan-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("penjualan-submit-btn");
    const msgEl = document.getElementById("penjualan-message");
    btn.disabled = true;
    msgEl.classList.add("hidden");

    const produk_id = document.getElementById("penjualan-produk").value;
    const jumlah = parseInt(document.getElementById("penjualan-jumlah").value, 10);
    const total_harga = parseFloat(document.getElementById("penjualan-total").value);
    const channel = document.getElementById("penjualan-channel").value;
    const tanggal_transaksi = document.getElementById("penjualan-tanggal").value;

    const { error } = await supabaseClient.from("transaksi_penjualan").insert({
      upt_id: currentUptId,
      produk_id,
      jumlah,
      total_harga,
      channel,
      tanggal_transaksi,
      status_pengiriman: "selesai",
    });

    msgEl.classList.remove("hidden");
    if (error) {
      msgEl.textContent = "Gagal menyimpan transaksi: " + error.message;
      msgEl.className = "text-sm font-semibold rounded-lg px-3 py-2 bg-red-50 text-red-700 border border-red-200";
    } else {
      msgEl.textContent = "Transaksi berhasil disimpan.";
      msgEl.className = "text-sm font-semibold rounded-lg px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200";
      e.target.reset();
      document.getElementById("penjualan-tanggal").valueAsDate = new Date();
      renderRiwayatTransaksi();
    }
    btn.disabled = false;
  });

  function generateTemplateCsv() {
    const header = "nama_produk,jumlah,total_harga,channel,tanggal\n";
    const rows = ownProdukList.map((p) => `"${p.nama.replace(/"/g, '""')}",,,,`).join("\n");
    return header + rows;
  }

  function isBlankTemplateRow(row) {
    return !row.jumlah?.trim() && !row.total_harga?.trim() && !row.channel?.trim() && !row.tanggal?.trim();
  }

  function validateCsvRow(row, rowIndex, produkByName) {
    const errors = [];
    const namaProduk = (row.nama_produk || "").trim();
    const produk = produkByName.get(namaProduk.toLowerCase());
    if (!namaProduk) errors.push("nama_produk kosong");
    else if (!produk) errors.push(`produk "${namaProduk}" tidak ditemukan`);

    const jumlahStr = (row.jumlah || "").trim();
    const jumlah = Number(jumlahStr);
    if (!jumlahStr || isNaN(jumlah) || jumlah <= 0) errors.push("jumlah harus angka positif");
    else if (!Number.isInteger(jumlah)) errors.push("jumlah harus bilangan bulat positif");

    const total = Number(row.total_harga);
    if (!row.total_harga || isNaN(total) || total < 0) errors.push("total_harga harus angka");

    const channel = (row.channel || "").trim();
    if (!VALID_CHANNELS.includes(channel)) errors.push(`channel "${channel}" tidak valid`);

    const tanggal = (row.tanggal || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      errors.push("tanggal harus format YYYY-MM-DD");
    } else {
      const [y, m, d] = tanggal.split("-").map(Number);
      const reconstructed = new Date(y, m - 1, d);
      const roundTrip = `${reconstructed.getFullYear()}-${String(reconstructed.getMonth() + 1).padStart(2, "0")}-${String(reconstructed.getDate()).padStart(2, "0")}`;
      if (roundTrip !== tanggal) errors.push("tanggal bukan tanggal kalender yang valid");
    }

    if (errors.length > 0) return { valid: false, rowIndex, error: errors.join("; ") };

    return {
      valid: true,
      data: {
        upt_id: currentUptId,
        produk_id: produk.id,
        jumlah,
        total_harga: total,
        channel,
        tanggal_transaksi: tanggal,
        status_pengiriman: "selesai",
      },
    };
  }

  document.getElementById("download-template-btn").addEventListener("click", () => {
    if (ownProdukList.length === 0) {
      alert("Belum ada produk terdaftar. Tambahkan produk dulu sebelum download template.");
      return;
    }
    const csv = generateTemplateCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-penjualan.csv";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("csv-upload-btn").addEventListener("click", () => {
    const fileInput = document.getElementById("csv-file-input");
    const resultBox = document.getElementById("csv-result");
    const uploadBtn = document.getElementById("csv-upload-btn");
    const file = fileInput.files[0];
    if (!file) {
      alert("Pilih file CSV terlebih dahulu.");
      return;
    }

    uploadBtn.disabled = true;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const produkByName = new Map(ownProdukList.map((p) => [p.nama.toLowerCase(), p]));
        const validRows = [];
        const failedRows = [];

        results.data.forEach((row, i) => {
          if (isBlankTemplateRow(row)) return;
          const outcome = validateCsvRow(row, i + 2, produkByName);
          if (outcome.valid) validRows.push(outcome.data);
          else failedRows.push(outcome);
        });

        let insertedCount = 0;
        if (validRows.length > 0) {
          const { error, data } = await supabaseClient.from("transaksi_penjualan").insert(validRows).select();
          if (error) {
            failedRows.push({ rowIndex: "-", error: "Gagal insert batch: " + error.message });
          } else {
            insertedCount = data.length;
          }
        }

        resultBox.classList.remove("hidden");
        let html = `<p class="font-bold ${insertedCount > 0 ? "text-emerald-700" : "text-slate-600"}">${insertedCount} baris berhasil disimpan, ${failedRows.length} baris gagal.</p>`;
        if (failedRows.length > 0) {
          html += `<table class="w-full text-xs border-collapse mt-2"><thead><tr class="text-left text-slate-500"><th class="py-1 pr-3">Baris</th><th class="py-1">Alasan</th></tr></thead><tbody>`;
          html += failedRows.map((f) => `<tr><td class="py-1 pr-3 font-semibold">${escapeHtml(String(f.rowIndex))}</td><td class="py-1 text-red-600">${escapeHtml(f.error)}</td></tr>`).join("");
          html += `</tbody></table>`;
        }
        resultBox.innerHTML = html;

        if (insertedCount > 0) renderRiwayatTransaksi();
        fileInput.value = "";
        uploadBtn.disabled = false;
      },
      error: (err) => {
        resultBox.classList.remove("hidden");
        resultBox.innerHTML = `<p class="text-red-600 font-semibold">Gagal membaca file CSV: ${escapeHtml(err.message)}</p>`;
        uploadBtn.disabled = false;
      },
    });
  });

  (async () => {
    const uptInfo = await requireUptSession();
    if (!uptInfo) return;
    currentUptId = uptInfo.uptId;
    renderSidebar("penjualan", uptInfo);
    renderRiwayatTransaksi();
    loadProdukDropdown();
  })();
</script>
</body>
</html>
```

- [ ] **Step 3: Manual test**

1. Log in, go to `/dashboard-penjualan`. Confirm "Penjualan" is highlighted in the sidebar, the product dropdown is populated, and "Riwayat Transaksi" shows this UPT's existing transactions from earlier testing sessions (if any).
2. On `/dashboard-produk`, deactivate one of this UPT's products. Go back to `/dashboard-penjualan` and reload the page. Expected: the deactivated product no longer appears in the "Produk" dropdown.
3. Submit a manual sale for a still-active product. Expected: success message, row appears in riwayat immediately.
4. Download the CSV template, fill in one valid row, upload it. Expected: "1 baris berhasil disimpan, 0 baris gagal", riwayat updates.
5. Try uploading the exact same CSV file twice in a row quickly (double-click "Proses Upload" if possible, or click once, wait for the result, then click again). Confirm the button is disabled while processing (visually grayed out / unclickable) so a double-click can't double-insert.

- [ ] **Step 4: Commit**

```bash
git add dashboard-penjualan.html
git commit -m "Add Penjualan dashboard page: moved manual/CSV sales forms and history, filter dropdown to active products"
```

---

### Task 4: Halaman Profil UPT — pindahkan field WhatsApp, hapus input-produk.html lama

**Files:**
- Create: `dashboard-profil.html`
- Delete: `input-produk.html`
- Read (for migration source before deleting): `input-produk.html`

**Interfaces:**
- Consumes: `requireUptSession()`, `renderSidebar()` (Task 1).
- Produces: nothing — this is the last dashboard page. After this task, `input-produk.html` no longer exists anywhere in the repo or is linked from any other page.

- [ ] **Step 1: Read the current WhatsApp field code to migrate**

Open `input-produk.html` and locate: the WhatsApp number `<section>` markup (`#whatsapp-number`, `#save-whatsapp-btn`, `#whatsapp-message`) and its save-button click handler (the one with the `/^62\d{8,13}$/` regex check and the `supabaseClient.from("upt").update({ whatsapp: value })` call). Confirm this is the only remaining unmigrated content in the file — Tasks 2 and 3 already moved the product form/list and the sales forms/history. After this task's Step 3 deletes the file, nothing should be left behind.

- [ ] **Step 2: Create `dashboard-profil.html`**

Write this exact content to `dashboard-profil.html`:

```html
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Profil UPT - Panel UPT Karya WBP</title>
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
          primary: "#00102d",
          "primary-container": "#0f254a",
          "surface-canvas": "#F4F6FA",
          "surface-card": "#FFFFFF",
          "border-subtle": "#E2E8F0",
        },
        fontFamily: { sans: ["Plus Jakarta Sans", "sans-serif"] },
      },
    },
  };
</script>
<style>body { font-family: "Plus Jakarta Sans", sans-serif; }</style>
</head>
<body class="bg-surface-canvas text-primary min-h-screen">
<div class="min-h-screen flex">
  <aside class="w-64 bg-primary text-white flex flex-col fixed inset-y-0 left-0 z-40">
    <div class="p-5 border-b border-white/10">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-container flex items-center justify-center ring-1 ring-white/20 shrink-0">
          <span class="material-symbols-outlined text-amber-300 text-[20px]">verified</span>
        </div>
        <div class="min-w-0">
          <div class="font-bold text-sm leading-tight">Panel UPT</div>
          <div class="text-[11px] text-blue-200/80 truncate" id="sidebar-upt-nama">Memuat...</div>
        </div>
      </div>
    </div>
    <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-1">
      <a href="/dashboard" data-page="dashboard" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">dashboard</span>Dashboard
      </a>
      <a href="/dashboard-produk" data-page="produk" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">inventory_2</span>Produk
      </a>
      <a href="/dashboard-penjualan" data-page="penjualan" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">point_of_sale</span>Penjualan
      </a>
      <a href="/dashboard-profil" data-page="profil" class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-100 hover:bg-white/10 transition">
        <span class="material-symbols-outlined text-[20px]">storefront</span>Profil UPT
      </a>
    </nav>
    <div class="p-4 border-t border-white/10 space-y-3">
      <div class="text-xs">
        <div class="font-bold" id="sidebar-upt-nama-bawah">-</div>
        <div class="text-blue-200/70" id="sidebar-upt-kode">-</div>
      </div>
      <a href="/" class="flex items-center gap-2 text-xs font-semibold text-blue-200 hover:text-white transition">
        <span class="material-symbols-outlined text-[16px]">open_in_new</span>Lihat Katalog
      </a>
      <button id="sidebar-logout-btn" class="flex items-center gap-2 text-xs font-semibold text-blue-200 hover:text-white transition">
        <span class="material-symbols-outlined text-[16px]">logout</span>Keluar
      </button>
    </div>
  </aside>

  <main class="flex-1 ml-64 min-h-screen p-6 sm:p-8 max-w-2xl">
    <h1 class="font-extrabold text-xl text-primary mb-6">Profil UPT</h1>

    <div class="bg-white rounded-2xl shadow-sm border border-border-subtle p-5 flex flex-col sm:flex-row sm:items-end gap-3">
      <div class="flex-1">
        <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="whatsapp-number">Nomor WhatsApp UPT (untuk tombol pesan di katalog)</label>
        <input id="whatsapp-number" type="text" placeholder="Contoh: 628123456789 (tanpa +/0 di depan)"
          class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
      </div>
      <button id="save-whatsapp-btn" type="button" class="px-5 py-2.5 rounded-lg bg-primary-container text-white font-bold text-sm hover:bg-primary transition shrink-0">Simpan Nomor WA</button>
    </div>
    <p id="whatsapp-message" class="hidden text-xs font-semibold mt-2 px-1"></p>
  </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="/assets/js/supabase-client.js"></script>
<script src="/assets/js/upt-dashboard.js"></script>
<script>
  let currentUptId = null;

  document.getElementById("save-whatsapp-btn").addEventListener("click", async () => {
    const msgEl = document.getElementById("whatsapp-message");
    const value = document.getElementById("whatsapp-number").value.trim();

    if (!currentUptId) {
      msgEl.textContent = "Tunggu data akun selesai dimuat, lalu coba lagi.";
      msgEl.className = "text-xs font-semibold mt-2 px-1 text-red-600";
      msgEl.classList.remove("hidden");
      return;
    }

    if (!/^62\d{8,13}$/.test(value)) {
      msgEl.textContent = "Format nomor salah. Gunakan format 62xxxxxxxxxx (tanpa +/0 di depan).";
      msgEl.className = "text-xs font-semibold mt-2 px-1 text-red-600";
      msgEl.classList.remove("hidden");
      return;
    }

    const { error } = await supabaseClient.from("upt").update({ whatsapp: value }).eq("id", currentUptId);
    msgEl.classList.remove("hidden");
    if (error) {
      msgEl.textContent = "Gagal menyimpan: " + error.message;
      msgEl.className = "text-xs font-semibold mt-2 px-1 text-red-600";
    } else {
      msgEl.textContent = "Nomor WhatsApp berhasil disimpan.";
      msgEl.className = "text-xs font-semibold mt-2 px-1 text-emerald-600";
    }
  });

  (async () => {
    const uptInfo = await requireUptSession();
    if (!uptInfo) return;
    currentUptId = uptInfo.uptId;
    renderSidebar("profil", uptInfo);
    document.getElementById("whatsapp-number").value = uptInfo.whatsapp || "";
  })();
</script>
</body>
</html>
```

- [ ] **Step 3: Delete the old single-page dashboard**

```bash
rm input-produk.html
```

Search the rest of the repo for any remaining reference to it and confirm there are none left (Task 1 already updated `login.html`'s redirect target, so this should come back empty):

```bash
grep -rn "input-produk" --include="*.html" .
```

Expected: no output.

- [ ] **Step 4: Manual test**

1. Log in, go to `/dashboard-profil`. Confirm "Profil UPT" is highlighted, and the WhatsApp field is pre-filled with the number saved earlier (from the original feature's testing).
2. Change the number, save, reload the page — confirm it persists.
3. Open `/input-produk` directly in the browser. Expected: 404 (file no longer exists).
4. Click through all 4 sidebar links from each of the 4 pages at least once, confirming navigation works both ways between every pair and the active-page highlight always matches the current page.

- [ ] **Step 5: Commit**

```bash
git add dashboard-profil.html
git rm input-produk.html
git commit -m "Add Profil UPT dashboard page, remove old single-page input-produk.html"
```

---

### Task 5: Katalog publik — badge jumlah terjual

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `produk`/`upt`/`transaksi_penjualan` tables (all public-read, unchanged RLS). Consumes the existing `renderProdukCard(p)`, `loadKatalogProduk()`, `escapeHtml`, `formatRupiah` functions already in `index.html` from earlier work.
- Produces: nothing consumed by other tasks — last task in this plan.

- [ ] **Step 1: Fetch total units sold per product**

In `index.html`, find this exact block (the `loadKatalogProduk` function's Supabase query and the lines immediately following it):

```javascript
  async function loadKatalogProduk() {
    const grid = document.getElementById("productGrid");
    const { data, error } = await supabaseClient
      .from("produk")
      .select("id, nama, kategori, harga, deskripsi, image_url, upt:upt_id (nama, whatsapp)")
      .eq("status", "aktif")
      .order("created_at", { ascending: false });

    if (error) {
      grid.innerHTML = `<p class="col-span-full text-center text-red-500 py-12">Gagal memuat produk.</p>`;
      console.error(error);
      return;
    }

    allProduk = data || [];
    if (allProduk.length === 0) {
      grid.innerHTML = `<p class="col-span-full text-center text-outline py-12">Belum ada produk yang terdaftar.</p>`;
      return;
    }

    grid.innerHTML = allProduk.map(renderProdukCard).join("");
    attachSearchFilter();
  }
```

Replace it with:

```javascript
  let unitsSoldByProduk = new Map();

  async function loadUnitsSold() {
    const { data, error } = await supabaseClient
      .from("transaksi_penjualan")
      .select("produk_id, jumlah");

    if (error) {
      console.error("Gagal memuat data penjualan:", error);
      return new Map();
    }

    const totals = new Map();
    (data || []).forEach((t) => {
      if (!t.produk_id) return;
      totals.set(t.produk_id, (totals.get(t.produk_id) || 0) + (t.jumlah || 0));
    });
    return totals;
  }

  async function loadKatalogProduk() {
    const grid = document.getElementById("productGrid");
    const [produkResult, unitsSold] = await Promise.all([
      supabaseClient
        .from("produk")
        .select("id, nama, kategori, harga, deskripsi, image_url, upt:upt_id (nama, whatsapp)")
        .eq("status", "aktif")
        .order("created_at", { ascending: false }),
      loadUnitsSold(),
    ]);

    const { data, error } = produkResult;
    unitsSoldByProduk = unitsSold;

    if (error) {
      grid.innerHTML = `<p class="col-span-full text-center text-red-500 py-12">Gagal memuat produk.</p>`;
      console.error(error);
      return;
    }

    allProduk = data || [];
    if (allProduk.length === 0) {
      grid.innerHTML = `<p class="col-span-full text-center text-outline py-12">Belum ada produk yang terdaftar.</p>`;
      return;
    }

    grid.innerHTML = allProduk.map(renderProdukCard).join("");
    attachSearchFilter();
  }
```

- [ ] **Step 2: Render the badge in each card**

Find this exact line in `renderProdukCard(p)`:

```javascript
          <p class="font-extrabold text-primary">${formatRupiah(p.harga)}</p>
```

Replace it with:

```javascript
          <p class="font-extrabold text-primary">${formatRupiah(p.harga)}</p>
          ${(() => {
            const terjual = unitsSoldByProduk.get(p.id) || 0;
            return terjual > 0
              ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">${terjual.toLocaleString("id-ID")} terjual</span>`
              : `<span class="text-[11px] text-outline italic">Belum ada penjualan</span>`;
          })()}
```

- [ ] **Step 3: Manual test**

1. Open `/` (public catalog). Confirm "Kopi Robusta" (or whichever product has sales from earlier testing sessions in this project) now shows a green "X terjual" badge under its price, where X matches the sum of `jumlah` across all its transactions (you can cross-check this against the "Total Unit Terjual" KPI on `/dashboard` if it's the only product that UPT has sold).
2. Confirm a product with zero transactions shows "Belum ada penjualan" instead of a badge with "0".
3. Confirm the page still loads correctly and the search filter still works (this change doesn't touch `attachSearchFilter`, but verify nothing broke).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Add units-sold badge to public catalog product cards"
```

---

## Final Verification (after all 5 tasks)

- [ ] Log in as two different UPT accounts in separate browser sessions. Confirm each sees only its own products (in both the Produk list and the Penjualan dropdown) and its own transaction history, and that deactivating/deleting a product on one account never affects the other's data.
- [ ] Push all commits: `git push origin main`, confirm Vercel redeploys and the live site reflects every change in this plan.
