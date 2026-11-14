# Dashboard Top Header Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark left sidebar on all 4 UPT dashboard pages with a top header matching `monitoring.html`'s style (minus Hotline Giatja and the person icon, nav shifted right, logout button in the person icon's old spot), and remove the non-functional mock filter controls from `monitoring.html`'s hero banner.

**Architecture:** Same plain static HTML pattern as the rest of the project. `/assets/js/upt-dashboard.js`'s `renderSidebar()` is renamed to `renderHeader()` and retargeted at the new header's elements; all 4 dashboard pages get the same header markup (byte-identical across pages, same as the sidebar was) and drop their `ml-64` main-content offset since the header is `fixed` (out of document flow) rather than a flex sibling.

**Tech Stack:** HTML + Tailwind CDN + vanilla JS. No new dependencies.

## Global Constraints

- The 4 dashboard pages' header markup must stay byte-identical to each other except for `<title>` and which nav link is marked active — same rule that applied to the sidebar.
- `renderHeader()` replaces `renderSidebar()` everywhere — there must be zero remaining references to `renderSidebar` or `.sidebar-link` in the codebase after this plan.
- This project has no automated test runner — manual browser verification against the live Vercel deployment.

---

### Task 1: Rename and retarget the shared header-rendering helper

**Files:**
- Modify: `assets/js/upt-dashboard.js`

**Interfaces:**
- Produces: `function renderHeader(activePage, uptInfo)` — replaces `renderSidebar`. Same call signature and timing (called after `requireUptSession()` resolves). Looks for `#header-upt-nama` (text content), `.header-link[data-page=...]` (active-state class toggling), and `#header-logout-btn` (click handler) instead of the old sidebar element ids/classes.

- [ ] **Step 1: Replace `renderSidebar` with `renderHeader`**

Find this exact function in `assets/js/upt-dashboard.js`:

```javascript
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

Replace it with:

```javascript
function renderHeader(activePage, uptInfo) {
  const namaEl = document.getElementById("header-upt-nama");
  if (namaEl) namaEl.textContent = uptInfo ? `${uptInfo.nama} • Kode: ${uptInfo.kode}` : "-";

  document.querySelectorAll(".header-link").forEach((link) => {
    if (link.dataset.page === activePage) {
      link.classList.add("bg-primary-container", "text-white", "shadow-sm");
      link.classList.remove("text-on-surface-variant");
    } else {
      link.classList.remove("bg-primary-container", "text-white", "shadow-sm");
      link.classList.add("text-on-surface-variant");
    }
  });

  const logoutBtn = document.getElementById("header-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "/login";
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/js/upt-dashboard.js
git commit -m "Rename renderSidebar to renderHeader for the new top-header dashboard layout"
```

---

### Task 2: Replace the sidebar with a top header on all 4 dashboard pages

**Files:**
- Modify: `dashboard.html`
- Modify: `dashboard-produk.html`
- Modify: `dashboard-penjualan.html`
- Modify: `dashboard-profil.html`

**Interfaces:**
- Consumes: `renderHeader(activePage, uptInfo)` from Task 1 — each page's bootstrap call changes from `renderSidebar("<page>", uptInfo)` to `renderHeader("<page>", uptInfo)`.

- [ ] **Step 1: For EACH of the 4 files, replace the opening wrapper + sidebar + main-open tag**

All 4 files currently start their `<body>` with this exact block (confirmed byte-identical across all 4 pages except nothing in this particular span differs):

```html
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

  <main class="flex-1 ml-64 min-h-screen p-6 sm:p-8
```

(Note: this block ends mid-tag, right before the `<main>` element's class list continues with page-specific classes — `dashboard.html` and the other 3 pages each have slightly different trailing classes on that same `<main ...>` tag, e.g. `dashboard.html` has just `p-6 sm:p-8` while the others may add more. Match up through `ml-64 min-h-screen p-6 sm:p-8` exactly as shown — that substring is identical across all 4 files — and leave whatever comes after it on that same opening `<main ...>` tag untouched.)

Replace that matched span with:

```html
<header class="fixed top-0 left-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-border-subtle shadow-sm transition-all">
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
<div class="flex items-center gap-3.5 shrink-0">
<div class="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-container text-white flex items-center justify-center shadow-md shadow-primary/20 ring-1 ring-white/20">
<span class="material-symbols-outlined text-amber-300 text-[26px]">verified</span>
</div>
<div class="flex flex-col min-w-0">
<div class="flex items-center gap-2">
<span class="font-bold text-lg text-primary tracking-tight leading-tight">Karya WBP Jabar Juara</span>
<span class="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300">Resmi</span>
</div>
<span class="text-xs font-medium text-on-surface-variant leading-normal truncate" id="header-upt-nama">Memuat...</span>
</div>
</div>
<nav class="hidden md:flex items-center gap-1.5 p-1 bg-surface-container rounded-xl border border-border-subtle/80 ml-auto">
<a class="px-4 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:text-primary hover:bg-white transition-all" href="/">Lihat Katalog</a>
<a href="/dashboard" data-page="dashboard" class="header-link px-4 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:text-primary hover:bg-white transition-all flex items-center gap-1.5">
<span class="material-symbols-outlined text-[18px]">dashboard</span>Dashboard
</a>
<a href="/dashboard-produk" data-page="produk" class="header-link px-4 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:text-primary hover:bg-white transition-all flex items-center gap-1.5">
<span class="material-symbols-outlined text-[18px]">inventory_2</span>Produk
</a>
<a href="/dashboard-penjualan" data-page="penjualan" class="header-link px-4 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:text-primary hover:bg-white transition-all flex items-center gap-1.5">
<span class="material-symbols-outlined text-[18px]">point_of_sale</span>Penjualan
</a>
<a href="/dashboard-profil" data-page="profil" class="header-link px-4 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:text-primary hover:bg-white transition-all flex items-center gap-1.5">
<span class="material-symbols-outlined text-[18px]">storefront</span>Profil UPT
</a>
</nav>
<div class="flex items-center gap-3 shrink-0">
<div class="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 shadow-xs">
<span class="material-symbols-outlined text-amber-700 text-[18px]">verified_user</span>
<span class="text-xs font-bold text-amber-900 tracking-wide uppercase">Portal Resmi Terverifikasi</span>
</div>
<button id="header-logout-btn" class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-semibold text-xs tracking-wide transition-colors border border-border-subtle">
<span class="material-symbols-outlined text-primary text-[18px]">logout</span>
<span>Keluar</span>
</button>
</div>
</div>
</header>

<main class="min-h-screen pt-24
```

So, for example, if a given file's original opening `<main>` tag was:
```html
  <main class="flex-1 ml-64 min-h-screen p-6 sm:p-8">
```
it becomes:
```html
<main class="min-h-screen pt-24 p-6 sm:p-8">
```
— i.e. `flex-1 ml-64` is dropped and `pt-24` is added, while whatever page-specific classes followed `p-6 sm:p-8` (if any — check each file, some may have `max-w-2xl` or similar appended) are kept exactly as they were, just appended after `pt-24 p-6 sm:p-8` in the same tag.

- [ ] **Step 2: For EACH of the 4 files, remove the leftover wrapper `</div>` and update the bootstrap call**

Since the opening `<div class="min-h-screen flex">` wrapper from Step 1 no longer exists, its matching closing `</div>` (which sits right after this page's closing `</main>` tag, before the `<script>` tags) must also be removed. Find, in each file:

```html
  </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
```

Replace with:

```html
  </main>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
```

(Only the stray `</div>` line between `</main>` and the script tag is removed — nothing else on those lines changes. If a file's CSV `<script>` tag for PapaParse comes before the Supabase one, as in `dashboard-penjualan.html`, match on whichever script tag actually comes first in that file instead of assuming it's the Supabase one — the only thing that matters is: find `</main>` followed by a stray `</div>` on its own line, and delete that `</div>` line.)

Then, in each file's bottom `<script>` block, find the bootstrap call that currently reads `renderSidebar("<page>", uptInfo);` (with `<page>` being `"dashboard"`, `"produk"`, `"penjualan"`, or `"profil"` depending on the file) and change `renderSidebar` to `renderHeader`, keeping the same arguments:
- `dashboard.html`: `renderSidebar("dashboard", uptInfo);` → `renderHeader("dashboard", uptInfo);`
- `dashboard-produk.html`: `renderSidebar("produk", uptInfo);` → `renderHeader("produk", uptInfo);`
- `dashboard-penjualan.html`: `renderSidebar("penjualan", uptInfo);` → `renderHeader("penjualan", uptInfo);`
- `dashboard-profil.html`: `renderSidebar("profil", uptInfo);` → `renderHeader("profil", uptInfo);`

- [ ] **Step 3: Verify no leftovers**

```bash
grep -rn "renderSidebar\|sidebar-link\|sidebar-upt\|sidebar-logout" --include="*.html" --include="*.js" .
```

Expected: no output. If anything remains, it was missed in Step 1 or 2 of one of the 4 files — fix it before moving on.

- [ ] **Step 4: Manual test**

1. Log in, confirm `/dashboard` shows the new top header (not a sidebar), with "Dashboard" visually highlighted among the nav pills (different background than Produk/Penjualan/Profil UPT), the subtitle under the brand name showing the logged-in UPT's name and kode, no Hotline Giatja button, no person icon, and a "Keluar" button in that spot instead.
2. Click "Produk", "Penjualan", "Profil UPT" in the nav — confirm each page loads with the correct one highlighted, and the "Lihat Katalog" pill is present but never highlighted (it's not one of the 4 dashboard pages).
3. Click "Lihat Katalog" — confirm it goes to `/` (the public catalog).
4. Click "Keluar" from any of the 4 pages — confirm redirect to `/login`, and that visiting any dashboard URL directly afterward bounces back to `/login`.
5. Resize the browser narrow (or check on a phone) — confirm the nav pills hide below the `md` breakpoint (same behavior `monitoring.html`/`index.html` already have) rather than overlapping/breaking, and that the page content below the header is still usable (not hidden behind the fixed header).

- [ ] **Step 5: Commit**

```bash
git add dashboard.html dashboard-produk.html dashboard-penjualan.html dashboard-profil.html
git commit -m "Replace dashboard sidebar with top header matching monitoring.html style"
```

---

### Task 3: Remove mock filter controls from monitoring.html's hero banner

**Files:**
- Modify: `monitoring.html`

**Interfaces:**
- Produces: nothing consumed elsewhere — independent of Tasks 1-2.

- [ ] **Step 1: Remove the filter block**

Find this exact block:

```html
<!-- Glassmorphism Filter Controls -->
<div class="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-2xl shrink-0">
<!-- Filter Periode -->
<div class="relative flex items-center bg-[#071735]/80 hover:bg-[#071735] transition rounded-xl px-3 py-2 border border-white/15">
<span class="material-symbols-outlined text-amber-400 text-[18px] mr-2">calendar_month</span>
<select class="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer pr-4 appearance-none">
<option class="bg-slate-900 text-white" value="bulan-ini">Bulan Ini (Juni 2025)</option>
<option class="bg-slate-900 text-white" value="q1-2025">Kuartal II 2025 (Berjalan)</option>
<option class="bg-slate-900 text-white" value="tahun-2024">Tahun Anggaran 2024</option>
<option class="bg-slate-900 text-white" value="custom">Kustomisasi Periode...</option>
</select>
<span class="material-symbols-outlined text-blue-200 text-[16px] pointer-events-none">expand_more</span>
</div>
<!-- Filter UPT -->
<div class="relative flex items-center bg-[#071735]/80 hover:bg-[#071735] transition rounded-xl px-3 py-2 border border-white/15">
<span class="material-symbols-outlined text-blue-300 text-[18px] mr-2">domain</span>
<select class="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer pr-4 appearance-none max-w-[170px] truncate">
<option class="bg-slate-900 text-white" value="all">Semua 33 UPT Lapas &amp; Rutan</option>
<option class="bg-slate-900 text-white" value="sukamiskin">Lapas Kelas I Sukamiskin</option>
<option class="bg-slate-900 text-white" value="cirebon">Lapas Kelas I Cirebon</option>
<option class="bg-slate-900 text-white" value="subang">Lapas Kelas IIA Subang</option>
<option class="bg-slate-900 text-white" value="lpp-bdg">LPP Kelas IIA Bandung</option>
<option class="bg-slate-900 text-white" value="garut">Lapas Kelas IIB Garut</option>
<option class="bg-slate-900 text-white" value="banceuy">Lapas Kelas IIA Banceuy</option>
</select>
<span class="material-symbols-outlined text-blue-200 text-[16px] pointer-events-none">expand_more</span>
</div>
<!-- Download Button with Gold Accent -->
<button class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs tracking-wide shadow-md transition-all active:scale-[0.98]">
<span class="material-symbols-outlined text-[18px]">download</span>
<span class="whitespace-nowrap">Unduh Rekap</span>
</button>
</div>
```

Delete it entirely (all of it, including the two inner comments) — leave the surrounding `<div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pt-2">...</div>` wrapper and its other child (the headline/description block) untouched.

- [ ] **Step 2: Manual test**

1. Open `/monitoring`. Confirm the hero banner no longer shows the Periode dropdown, UPT dropdown, or "Unduh Rekap" button.
2. Confirm the headline and description text in that banner still display normally (not broken/missing).

- [ ] **Step 3: Commit**

```bash
git add monitoring.html
git commit -m "Remove non-functional mock filter controls from monitoring.html hero banner"
```

---

## Final Verification (after all 3 tasks)

- [ ] Push all commits: `git push origin main`, confirm Vercel redeploys and the live site reflects every change in this plan.
