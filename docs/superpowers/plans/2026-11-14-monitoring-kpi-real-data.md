# Monitoring KPI Real Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4 hardcoded mock KPI cards on `monitoring.html` with real numbers computed from `produk` and `transaksi_penjualan`, and remove sub-stat lines that have no real data source behind them.

**Architecture:** Client-side aggregation — fetch `produk` and `transaksi_penjualan` (both already publicly readable), compute all 4 KPI values in the browser, write them into the existing KPI card markup via element ids. Same pattern already used by `dashboard.html`'s per-UPT KPIs and `index.html`'s units-sold badge.

**Tech Stack:** HTML + Tailwind CDN + vanilla JS, `@supabase/supabase-js@2.45.4` (CDN, already loaded on this page). No new dependencies.

## Global Constraints

- All computation is client-side; no new SQL/RLS needed — both tables are already public-read.
- The removed sub-stats (trend %, target ratio, lead time, WBP headcount, delivery success %) must be deleted from the markup entirely, not just hidden — no empty/dangling elements left behind.
- "Komoditas Teratas" must show "Belum ada data" (not an empty string or a category with 0 volume) when there are no transactions yet.
- The total UPT count (33) stays hardcoded in the markup, consistent with the seed data (`docs/supabase-seed.sql`) — this plan does not compute it dynamically.
- This project has no automated test runner — the test step is manual browser verification against the live Vercel deployment.

---

### Task 1: Wire the 4 KPI cards to real data

**Files:**
- Modify: `monitoring.html`

**Interfaces:**
- Produces: nothing consumed elsewhere — this is the only task in this plan.

- [ ] **Step 1: Replace the 4 KPI card markup**

Find this exact block (the whole KPI card grid, lines ~212-315 of the current file):

```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"><!-- KPI 1: Total Omzet Penjualan -->
<div class="bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all border border-border-subtle relative overflow-hidden group">
<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none"></div>
<div class="flex items-center justify-between mb-3">
<span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Total Omzet Penjualan</span>
<div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shadow-xs">
<span class="material-symbols-outlined text-[22px]">payments</span>
</div>
</div>
<div class="space-y-1 mb-3">
<div class="text-2xl lg:text-[28px] font-extrabold text-primary tracking-tight font-sans">
              Rp 482.750.000
            </div>
<div class="flex items-center gap-2">
<span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
<span class="material-symbols-outlined text-[14px]">trending_up</span>
                +14.8%
              </span>
<span class="text-xs text-on-surface-variant">vs bulan lalu</span>
</div>
</div>
<div class="pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
<span class="text-on-surface-variant font-medium">Rasio Capaian Target</span>
<span class="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">109.2% Target</span>
</div>
</div>
<!-- KPI 2: Volume Terjual -->
<div class="bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all border border-border-subtle relative overflow-hidden group">
<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none"></div>
<div class="flex items-center justify-between mb-3">
<span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Volume Produk Terjual</span>
<div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shadow-xs">
<span class="material-symbols-outlined text-[22px]">inventory_2</span>
</div>
</div>
<div class="space-y-1 mb-3">
<div class="text-2xl lg:text-[28px] font-extrabold text-primary tracking-tight">
              4.180 <span class="text-base font-normal text-on-surface-variant">Unit</span>
</div>
<div class="flex items-center gap-2">
<span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
<span class="material-symbols-outlined text-[14px]">trending_up</span>
                +8.2%
              </span>
<span class="text-xs text-on-surface-variant">pesanan diproses</span>
</div>
</div>
<div class="pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
<span class="text-on-surface-variant font-medium">Komoditas Teratas</span>
<span class="font-bold text-primary truncate max-w-[130px]">Kriya, Mebel, Kuliner</span>
</div>
</div>
<!-- KPI 3: Transaksi Selesai / Tersalurkan (Replaced Setoran PNBP) -->
<div class="bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all border border-border-subtle relative overflow-hidden group">
<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none"></div>
<div class="flex items-center justify-between mb-3">
<span class="text-xs font-extrabold uppercase tracking-wider text-primary">Pesanan Tersalurkan</span>
<div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shadow-xs border border-emerald-200">
<span class="material-symbols-outlined text-[22px]">task_alt</span>
</div>
</div>
<div class="space-y-1 mb-3">
<div class="text-2xl lg:text-[28px] font-extrabold text-primary tracking-tight">
              3.937 <span class="text-base font-normal text-on-surface-variant">Pesanan</span>
</div>
<div class="flex items-center gap-2">
<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
<span class="material-symbols-outlined text-[14px]">verified</span>
                94.2% Sukses Terkirim
              </span>
</div>
</div>
<div class="pt-3 border-t border-border-subtle space-y-1">
<div class="flex justify-between items-center text-xs">
<span class="text-on-surface-variant font-medium">Rata-rata Lead Time</span>
<span class="font-bold text-primary">6 Hari Kerja</span>
</div>
</div>
</div>
<!-- KPI 4: UPT Aktif Berproduksi (Replaced Premi Tabungan WBP) -->
<div class="bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all border border-border-subtle relative overflow-hidden group">
<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-50 rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none"></div>
<div class="flex items-center justify-between mb-3">
<span class="text-xs font-extrabold uppercase tracking-wider text-primary">UPT Aktif Berproduksi</span>
<div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shadow-xs border border-amber-200">
<span class="material-symbols-outlined text-[22px]">domain</span>
</div>
</div>
<div class="space-y-1 mb-3">
<div class="text-2xl lg:text-[28px] font-extrabold text-primary tracking-tight">
              33 / 33 <span class="text-base font-normal text-on-surface-variant">UPT</span>
</div>
<div class="flex items-center gap-2">
<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
<span class="material-symbols-outlined text-[14px]">check_circle</span>
                100% Partisipasi Giatja
              </span>
</div>
</div>
<div class="pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
<span class="text-on-surface-variant font-medium">Total WBP Diberdayakan</span>
<span class="font-bold text-primary bg-slate-100 px-2 py-0.5 rounded">2.500+ Tenaga Terampil</span>
</div>
</div></div>
```

Replace it with:

```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"><!-- KPI 1: Total Omzet Penjualan -->
<div class="bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all border border-border-subtle relative overflow-hidden group">
<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none"></div>
<div class="flex items-center justify-between mb-3">
<span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Total Omzet Penjualan</span>
<div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shadow-xs">
<span class="material-symbols-outlined text-[22px]">payments</span>
</div>
</div>
<div class="space-y-1 mb-3">
<div class="text-2xl lg:text-[28px] font-extrabold text-primary tracking-tight font-sans" id="kpi-omzet-total">
              Memuat...
            </div>
</div>
</div>
<!-- KPI 2: Volume Terjual -->
<div class="bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all border border-border-subtle relative overflow-hidden group">
<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none"></div>
<div class="flex items-center justify-between mb-3">
<span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Volume Produk Terjual</span>
<div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shadow-xs">
<span class="material-symbols-outlined text-[22px]">inventory_2</span>
</div>
</div>
<div class="space-y-1 mb-3">
<div class="text-2xl lg:text-[28px] font-extrabold text-primary tracking-tight">
              <span id="kpi-volume-terjual">Memuat...</span> <span class="text-base font-normal text-on-surface-variant">Unit</span>
</div>
</div>
<div class="pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
<span class="text-on-surface-variant font-medium">Komoditas Teratas</span>
<span class="font-bold text-primary truncate max-w-[130px]" id="kpi-komoditas-teratas">Memuat...</span>
</div>
</div>
<!-- KPI 3: Jumlah Transaksi -->
<div class="bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all border border-border-subtle relative overflow-hidden group">
<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none"></div>
<div class="flex items-center justify-between mb-3">
<span class="text-xs font-extrabold uppercase tracking-wider text-primary">Jumlah Transaksi</span>
<div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shadow-xs border border-emerald-200">
<span class="material-symbols-outlined text-[22px]">receipt_long</span>
</div>
</div>
<div class="space-y-1 mb-3">
<div class="text-2xl lg:text-[28px] font-extrabold text-primary tracking-tight">
              <span id="kpi-jumlah-transaksi">Memuat...</span> <span class="text-base font-normal text-on-surface-variant">Transaksi</span>
</div>
</div>
</div>
<!-- KPI 4: UPT Aktif Berproduksi -->
<div class="bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all border border-border-subtle relative overflow-hidden group">
<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-50 rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none"></div>
<div class="flex items-center justify-between mb-3">
<span class="text-xs font-extrabold uppercase tracking-wider text-primary">UPT Aktif Berproduksi</span>
<div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shadow-xs border border-amber-200">
<span class="material-symbols-outlined text-[22px]">domain</span>
</div>
</div>
<div class="space-y-1 mb-3">
<div class="text-2xl lg:text-[28px] font-extrabold text-primary tracking-tight">
              <span id="kpi-upt-aktif">Memuat...</span> <span class="text-base font-normal text-on-surface-variant">/ 33 UPT</span>
</div>
</div>
</div></div>
```

- [ ] **Step 2: Add the `loadKpiCards()` function**

Find this exact block:

```javascript
  async function loadUptTable() {
```

Insert BEFORE it (keep `loadUptTable` itself unchanged, right after this new function):

```javascript
  function formatRupiah(n) {
    return "Rp " + Number(n).toLocaleString("id-ID");
  }

  async function loadKpiCards() {
    const [produkResult, transaksiResult] = await Promise.all([
      supabaseClient.from("produk").select("id, upt_id, kategori, status"),
      supabaseClient.from("transaksi_penjualan").select("produk_id, jumlah, total_harga"),
    ]);

    if (produkResult.error) console.error("Gagal memuat data produk:", produkResult.error);
    if (transaksiResult.error) console.error("Gagal memuat data transaksi:", transaksiResult.error);

    const produkList = produkResult.data || [];
    const transaksiList = transaksiResult.data || [];

    const totalOmzet = transaksiList.reduce((sum, t) => sum + Number(t.total_harga || 0), 0);
    const totalVolume = transaksiList.reduce((sum, t) => sum + Number(t.jumlah || 0), 0);
    const totalTransaksi = transaksiList.length;

    const uptAktifSet = new Set(
      produkList.filter((p) => p.status === "aktif").map((p) => p.upt_id)
    );

    const kategoriById = new Map(produkList.map((p) => [p.id, p.kategori || "Lainnya"]));
    const volumeByKategori = new Map();
    transaksiList.forEach((t) => {
      const kategori = kategoriById.get(t.produk_id);
      if (!kategori) return;
      volumeByKategori.set(kategori, (volumeByKategori.get(kategori) || 0) + Number(t.jumlah || 0));
    });

    let topKategori = "Belum ada data";
    let topVolume = 0;
    volumeByKategori.forEach((vol, kategori) => {
      if (vol > topVolume) {
        topVolume = vol;
        topKategori = kategori;
      }
    });

    document.getElementById("kpi-omzet-total").textContent = formatRupiah(totalOmzet);
    document.getElementById("kpi-volume-terjual").textContent = totalVolume.toLocaleString("id-ID");
    document.getElementById("kpi-komoditas-teratas").textContent = topKategori;
    document.getElementById("kpi-jumlah-transaksi").textContent = totalTransaksi.toLocaleString("id-ID");
    document.getElementById("kpi-upt-aktif").textContent = uptAktifSet.size;
  }

  async function loadUptTable() {
```

- [ ] **Step 3: Call it on page load**

Find this exact line:

```javascript
  loadUptTable();
</script>
```

Replace it with:

```javascript
  loadKpiCards();
  loadUptTable();
</script>
```

- [ ] **Step 4: Manual test**

1. Open `/monitoring` (public, no login required). Expected: all 4 KPI cards show real numbers within a second or two (not stuck on "Memuat...").
2. Confirm no card shows any of the removed sub-stats (no "%", no "Target", no "Lead Time", no "Partisipasi Giatja", no "Tenaga Terampil" anywhere on the 4 cards).
3. Cross-check "Total Omzet Penjualan" and "Volume Produk Terjual" against the numbers you already know exist from earlier testing sessions (e.g. the "Kopi Robusta" transactions recorded for Lapas Subang) — they should be at least that large, since this page sums across ALL UPT.
4. Check "Komoditas Teratas" shows a real category name (e.g. "Kuliner" if that's what Kopi Robusta is categorized as) — not "Kriya, Mebel, Kuliner" (the old mock) and not blank.
5. Check "UPT Aktif Berproduksi" shows a number ≤ 33, matching how many distinct UPT currently have at least one active product (cross-check against the UPT table further down this same page, which lists all 33 with their product data).
6. Check "Jumlah Transaksi" shows a plain count, with the label "Transaksi" next to it (not "Pesanan").

- [ ] **Step 5: Commit**

```bash
git add monitoring.html
git commit -m "Wire monitoring.html KPI cards to real aggregated data, remove unmeasurable mock sub-stats"
```
