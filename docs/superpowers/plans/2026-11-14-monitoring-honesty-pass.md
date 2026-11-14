# Monitoring Honesty Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip every remaining fabricated number/claim from `monitoring.html` and wire real aggregates wherever the data already exists (per-UPT table columns, channel distribution, category composition, wilayah distribution), consistent with every other page on this site.

**Architecture:** Same client-side aggregation pattern as `loadKpiCards()`/`loadUptTable()` already in this file — fetch `produk`, `transaksi_penjualan`, `upt` once, compute everything in the browser, write results into markup via element ids.

**Tech Stack:** HTML + Tailwind CDN + vanilla JS, `@supabase/supabase-js@2.45.4` (already loaded). No new dependencies, no new SQL/RLS.

## Global Constraints

- Every number shown must come from a real query result — no hardcoded percentages, Rp figures, or counts anywhere touched by this plan.
- Where data genuinely doesn't exist yet (monthly history), show an honest "Belum ada data" message — never a plausible-looking placeholder number.
- A category/channel/wilayah with zero activity: channels and categories are simply omitted from their lists (per spec Bagian 4/5); wilayah is the one exception — it's always shown, even at Rp 0, so a reader can tell "not started" from "no data" (spec Bagian 6).
- This project has no automated test runner — manual browser verification against the live Vercel deployment.

---

### Task 1: Strip fabricated markup, add real-data shells

**Files:**
- Modify: `monitoring.html`

**Interfaces:**
- Produces: new/changed ids that Task 2's JS targets — `#chart-tren-placeholder` (monthly chart card body), `#kpi-pertumbuhan`, `#kpi-sebaran-upt` (the two "honest placeholder" boxes), `#wilayah-distribusi-list` (container for the real wilayah breakdown), `#channel-donut-svg` + `#channel-legend-list` (channel donut), `#kategori-komposisi-list` (category composition). Table header loses its Status column; `renderUptRow`'s cells for Komoditas/Volume/Omzet get ids so Task 2 can target them — this task passes per-row data attributes (`data-upt-id="${kode}"`-style isn't reliable since `kode` isn't the DB `upt_id`; instead this task changes `renderUptRow` to accept the UPT's real `id` field and stamps `data-upt-row="${upt.id}"` on the `<tr>`, which Task 2's aggregation function uses to find and fill each row after render).

- [ ] **Step 1: Remove the RKAKL target box, replace chart + the other two highlight boxes with honest placeholders, and lay the real-wilayah shell**

Find this exact block (the "Monthly Performance Chart Card" — chart title through the end of its "Chart Key Highlights" row, i.e. from `<!-- Monthly Performance Chart Card -->` through the closing of that whole card's outer `<div>`):

```html
<!-- Monthly Performance Chart Card -->
<div class="bg-white rounded-2xl p-6 shadow-sm border border-border-subtle">
<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
<div>
<div class="flex items-center gap-2">
<div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center">
<span class="material-symbols-outlined text-[20px]">bar_chart</span>
</div>
<h2 class="font-bold text-lg text-primary">Performa Penjualan &amp; Target Bulanan</h2>
</div>
<p class="text-xs text-on-surface-variant mt-0.5">Akumulasi Komparasi Realisasi terhadap Target RKAKL Gabungan 33 UPT Lapas &amp; Rutan se-Jawa Barat (Semester I 2025)</p>
</div>
<!-- Legend -->
<div class="flex items-center gap-4 text-xs font-semibold self-start sm:self-auto bg-surface-container px-3 py-1.5 rounded-xl border border-border-subtle">
<div class="flex items-center gap-1.5">
<span class="w-3 h-3 rounded bg-[#0f254a]"></span>
<span class="text-primary">Realisasi (Juta Rp)</span>
</div>
<div class="flex items-center gap-1.5">
<span class="w-3 h-3 rounded bg-amber-400"></span>
<span class="text-amber-900">Target (Juta Rp)</span>
</div>
</div>
</div>
<!-- Styled SVG Bar Chart -->
<div class="w-full bg-gradient-to-b from-slate-50 to-surface-container/60 rounded-xl p-4 border border-border-subtle">
<svg class="w-full h-60" fill="none" preserveAspectRatio="none" viewBox="0 0 540 200">
<defs>
<linearGradient id="barReal" x1="0" x2="0" y1="0" y2="1">
<stop offset="0%" stop-color="#001C4D"></stop>
<stop offset="100%" stop-color="#0f254a"></stop>
</linearGradient>
<linearGradient id="barTarget" x1="0" x2="0" y1="0" y2="1">
<stop offset="0%" stop-color="#F59E0B"></stop>
<stop offset="100%" stop-color="#D97706"></stop>
</linearGradient>
<linearGradient id="gridGlow" x1="0" x2="1" y1="0" y2="0">
<stop offset="0%" stop-color="#CBD5E1" stop-opacity="0.3"></stop>
<stop offset="100%" stop-color="#CBD5E1" stop-opacity="0.8"></stop>
</linearGradient>
</defs>
<!-- Horizontal Reference Lines -->
<line stroke="#E2E8F0" stroke-dasharray="4 4" stroke-width="1" x1="45" x2="520" y1="25" y2="25"></line>
<line stroke="#E2E8F0" stroke-dasharray="4 4" stroke-width="1" x1="45" x2="520" y1="65" y2="65"></line>
<line stroke="#E2E8F0" stroke-dasharray="4 4" stroke-width="1" x1="45" x2="520" y1="105" y2="105"></line>
<line stroke="#CBD5E1" stroke-width="1.5" x1="45" x2="520" y1="145" y2="145"></line>
<!-- Y Axis Labels -->
<text class="text-[10px] fill-slate-400 font-mono font-medium" text-anchor="end" x="38" y="29">100M</text>
<text class="text-[10px] fill-slate-400 font-mono font-medium" text-anchor="end" x="38" y="69">75M</text>
<text class="text-[10px] fill-slate-400 font-mono font-medium" text-anchor="end" x="38" y="109">50M</text>
<text class="text-[10px] fill-slate-400 font-mono font-medium" text-anchor="end" x="38" y="148">0</text>
<!-- Month 1: Jan (Target 60, Real 65) -->
<rect fill="url(#barTarget)" height="72" rx="4" width="16" x="75" y="73"></rect>
<rect fill="url(#barReal)" filter="drop-shadow(0 2px 4px rgba(15,37,74,0.15))" height="78" rx="4" width="16" x="95" y="67"></rect>
<text class="text-[11px] fill-slate-700 font-bold" text-anchor="middle" x="93" y="166">Jan</text>
<!-- Month 2: Feb (Target 65, Real 68) -->
<rect fill="url(#barTarget)" height="78" rx="4" width="16" x="150" y="67"></rect>
<rect fill="url(#barReal)" filter="drop-shadow(0 2px 4px rgba(15,37,74,0.15))" height="82" rx="4" width="16" x="170" y="63"></rect>
<text class="text-[11px] fill-slate-700 font-bold" text-anchor="middle" x="168" y="166">Feb</text>
<!-- Month 3: Mar (Target 70, Real 76) -->
<rect fill="url(#barTarget)" height="84" rx="4" width="16" x="225" y="61"></rect>
<rect fill="url(#barReal)" filter="drop-shadow(0 2px 4px rgba(15,37,74,0.15))" height="91" rx="4" width="16" x="245" y="54"></rect>
<text class="text-[11px] fill-slate-700 font-bold" text-anchor="middle" x="243" y="166">Mar</text>
<!-- Month 4: Apr (Target 75, Real 82) -->
<rect fill="url(#barTarget)" height="90" rx="4" width="16" x="300" y="55"></rect>
<rect fill="url(#barReal)" filter="drop-shadow(0 2px 4px rgba(15,37,74,0.15))" height="98" rx="4" width="16" x="320" y="47"></rect>
<text class="text-[11px] fill-slate-700 font-bold" text-anchor="middle" x="318" y="166">Apr</text>
<!-- Month 5: Mei (Target 80, Real 92) -->
<rect fill="url(#barTarget)" height="96" rx="4" width="16" x="375" y="49"></rect>
<rect fill="url(#barReal)" filter="drop-shadow(0 2px 4px rgba(15,37,74,0.15))" height="110" rx="4" width="16" x="395" y="35"></rect>
<text class="text-[11px] fill-slate-700 font-bold" text-anchor="middle" x="393" y="166">Mei</text>
<!-- Month 6: Jun (Target 85, Real 99 - Projected) -->
<rect fill="url(#barTarget)" height="102" rx="4" width="16" x="450" y="43"></rect>
<rect fill="url(#barReal)" filter="drop-shadow(0 2px 4px rgba(15,37,74,0.15))" height="119" rx="4" width="16" x="470" y="26"></rect>
<text class="text-[11px] fill-slate-700 font-bold" text-anchor="middle" x="468" y="166">Jun (Est)</text>
</svg>
</div>
<!-- Chart Key Highlights -->
<div class="mt-4 space-y-4"><div class="grid grid-cols-1 sm:grid-cols-3 gap-3"><div class="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center"><span class="text-[11px] font-semibold text-on-surface-variant block uppercase tracking-wide">Rata-rata Pertumbuhan</span><span class="text-base font-extrabold text-emerald-700">+11.4% / bln</span><span class="text-[10px] text-slate-500 block mt-0.5">Agregat Seluruh Wilayah</span></div><div class="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center"><span class="text-[11px] font-semibold text-on-surface-variant block uppercase tracking-wide">Rasio Capaian Target</span><span class="text-base font-extrabold text-primary">109.2% Tercapai</span><span class="text-[10px] text-emerald-700 font-bold block mt-0.5">+9.2% Melampaui RKAKL</span></div><div class="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl text-center"><span class="text-[11px] font-semibold text-blue-900 block uppercase tracking-wide">Sebaran Performa 33 UPT</span><span class="text-base font-extrabold text-blue-950">28 dari 33 UPT</span><span class="text-[10px] text-blue-800 font-bold block mt-0.5">85% Lampaui Target (Rata-rata Rp 14,6 Jt/UPT)</span></div></div><div class="p-3.5 bg-slate-50/80 rounded-xl border border-border-subtle"><div class="flex items-center justify-between mb-2"><div class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-primary">map</span><span class="text-xs font-bold text-primary">Komparasi Distribusi Penjualan 4 Zona Wilayah Jabar</span></div><span class="text-[10px] font-semibold text-slate-500">Akumulasi 33 Lapas &amp; Rutan</span></div><div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs"><div class="p-2 bg-white rounded-lg border border-slate-200"><div class="flex justify-between items-center"><span class="text-[11px] font-bold text-slate-700">Wilayah Bandung Raya</span><span class="text-[10px] font-extrabold text-primary">38.8%</span></div><span class="text-xs font-extrabold text-primary block mt-0.5">Rp 187,4 Jt</span><span class="text-[10px] text-slate-500">6 UPT Lapas/Rutan/LPKA</span></div><div class="p-2 bg-white rounded-lg border border-slate-200"><div class="flex justify-between items-center"><span class="text-[11px] font-bold text-slate-700">Cirebon &amp; Pantura</span><span class="text-[10px] font-extrabold text-primary">29.2%</span></div><span class="text-xs font-extrabold text-primary block mt-0.5">Rp 140,8 Jt</span><span class="text-[10px] text-slate-500">8 UPT Lapas &amp; Rutan</span></div><div class="p-2 bg-white rounded-lg border border-slate-200"><div class="flex justify-between items-center"><span class="text-[11px] font-bold text-slate-700">Bogor, Depok &amp; Bekasi</span><span class="text-[10px] font-extrabold text-primary">19.6%</span></div><span class="text-xs font-extrabold text-primary block mt-0.5">Rp 94,8 Jt</span><span class="text-[10px] text-slate-500">9 UPT Lapas &amp; Rutan</span></div><div class="p-2 bg-white rounded-lg border border-slate-200"><div class="flex justify-between items-center"><span class="text-[11px] font-bold text-slate-700">Priangan Timur</span><span class="text-[10px] font-extrabold text-primary">12.4%</span></div><span class="text-xs font-extrabold text-primary block mt-0.5">Rp 59,75 Jt</span><span class="text-[10px] text-slate-500">10 UPT Lapas &amp; Rutan</span></div></div></div></div>
</div>
```

Replace it with:

```html
<!-- Monthly Performance Chart Card -->
<div class="bg-white rounded-2xl p-6 shadow-sm border border-border-subtle">
<div class="flex items-center gap-2 mb-5">
<div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center">
<span class="material-symbols-outlined text-[20px]">bar_chart</span>
</div>
<h2 class="font-bold text-lg text-primary">Performa Penjualan Bulanan</h2>
</div>
<div id="chart-tren-placeholder" class="w-full bg-gradient-to-b from-slate-50 to-surface-container/60 rounded-xl p-8 border border-border-subtle flex flex-col items-center justify-center text-center gap-2 min-h-[200px]">
<span class="material-symbols-outlined text-slate-300 text-[40px]">bar_chart</span>
<p class="text-sm font-semibold text-slate-500">Belum ada data histori bulanan</p>
<p class="text-xs text-slate-400 max-w-sm">Grafik tren akan muncul setelah sistem mengumpulkan data transaksi selama beberapa bulan berjalan.</p>
</div>
<div class="mt-4 space-y-4">
<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div class="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center" id="kpi-pertumbuhan">
<span class="text-[11px] font-semibold text-on-surface-variant block uppercase tracking-wide">Rata-rata Pertumbuhan</span>
<span class="text-sm font-bold text-slate-400 block mt-1">Belum ada data histori</span>
</div>
<div class="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center" id="kpi-sebaran-upt">
<span class="text-[11px] font-semibold text-on-surface-variant block uppercase tracking-wide">Sebaran Performa 33 UPT</span>
<span class="text-sm font-bold text-slate-400 block mt-1">Belum ada data histori</span>
</div>
</div>
<div class="p-3.5 bg-slate-50/80 rounded-xl border border-border-subtle">
<div class="flex items-center justify-between mb-2">
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-[16px] text-primary">map</span>
<span class="text-xs font-bold text-primary">Distribusi Penjualan per Wilayah</span>
</div>
<span class="text-[10px] font-semibold text-slate-500">Akumulasi 33 Lapas &amp; Rutan</span>
</div>
<div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs" id="wilayah-distribusi-list">
<p class="col-span-full text-center text-slate-400 py-3">Memuat...</p>
</div>
</div>
</div>
</div>
```

- [ ] **Step 2: Remove the Status column from the table header**

Find:

```html
        <th class="py-3 px-3 text-right">Total Omzet</th>
        <th class="py-3 px-3 text-center">Status SIMPONI</th>
        <th class="py-3 px-3.5 text-center">Aksi</th>
```

Replace with:

```html
        <th class="py-3 px-3 text-right">Total Omzet</th>
        <th class="py-3 px-3.5 text-center">Aksi</th>
```

- [ ] **Step 3: Remove the Status cell from every static fallback row**

Find this exact block (it repeats 22 times, once per fallback row, byte-identical every time) and use `replace_all` to remove ALL occurrences in one pass:

```html
        <td class="py-3 px-3 text-center">
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Tersinkron Lunas
          </span>
        </td>
```

Replace every occurrence with nothing (empty string).

- [ ] **Step 4: Update `renderUptRow` to drop the Status cell and expose a row id for Task 2**

Find:

```javascript
  function renderUptRow(upt) {
    const nama = escapeHtml(upt.nama);
    const wilayah = escapeHtml(upt.wilayah || "-");
    const kode = escapeHtml(upt.kode || "");
    return `
      <tr class="hover:bg-blue-50/40 transition-colors group">
        <td class="py-3 px-3.5">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 font-extrabold flex items-center justify-center shrink-0 text-xs">${escapeHtml(initialsFromKode(upt.kode))}</div>
            <div>
              <div class="font-bold text-primary group-hover:text-blue-900 text-sm">${nama}</div>
              <span class="text-[11px] text-slate-500">${wilayah} • Kode Satker ${kode}</span>
            </div>
          </div>
        </td>
        <td class="py-3 px-3">
          <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-500 border border-slate-200">Belum ada data produk</span>
        </td>
        <td class="py-3 px-3 text-right font-bold text-slate-400">-</td>
        <td class="py-3 px-3 text-right font-extrabold text-slate-400">-</td>
        <td class="py-3 px-3 text-center">
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold text-[11px] border border-slate-200">
            <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Belum Ada Transaksi
          </span>
        </td>
        <td class="py-3 px-3.5 text-center">
          <button class="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-primary hover:text-white text-slate-700 text-[11px] font-bold transition border border-border-subtle">Detail</button>
        </td>
      </tr>`;
  }
```

Replace with:

```javascript
  function renderUptRow(upt) {
    const nama = escapeHtml(upt.nama);
    const wilayah = escapeHtml(upt.wilayah || "-");
    const kode = escapeHtml(upt.kode || "");
    return `
      <tr class="hover:bg-blue-50/40 transition-colors group" data-upt-row="${upt.id}">
        <td class="py-3 px-3.5">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 font-extrabold flex items-center justify-center shrink-0 text-xs">${escapeHtml(initialsFromKode(upt.kode))}</div>
            <div>
              <div class="font-bold text-primary group-hover:text-blue-900 text-sm">${nama}</div>
              <span class="text-[11px] text-slate-500">${wilayah} • Kode Satker ${kode}</span>
            </div>
          </div>
        </td>
        <td class="py-3 px-3" data-cell="komoditas">
          <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-500 border border-slate-200">Memuat...</span>
        </td>
        <td class="py-3 px-3 text-right font-bold text-slate-400" data-cell="volume">-</td>
        <td class="py-3 px-3 text-right font-extrabold text-slate-400" data-cell="omzet">-</td>
        <td class="py-3 px-3.5 text-center">
          <button class="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-primary hover:text-white text-slate-700 text-[11px] font-bold transition border border-border-subtle">Detail</button>
        </td>
      </tr>`;
  }
```

Note: this requires `loadUptTable()`'s query (Step 5 below) to also select `id`, so `upt.id` is available here.

- [ ] **Step 5: Update `loadUptTable()`'s query to select `id`**

Find:

```javascript
    const { data, error } = await supabaseClient
      .from("upt")
      .select("kode, nama, kelas, wilayah")
      .order("nama", { ascending: true });
```

Replace with:

```javascript
    const { data, error } = await supabaseClient
      .from("upt")
      .select("id, kode, nama, kelas, wilayah")
      .order("nama", { ascending: true });
```

- [ ] **Step 6: Remove the virtual-account bank claim and give the channel donut dynamic ids**

Find this exact block (the whole "Card 1: Distribusi Kanal Transaksi" card):

```html
<!-- Card 1: Distribusi Kanal Transaksi (Refined SVG Donut Chart) -->
<div class="bg-white rounded-2xl p-6 shadow-sm border border-border-subtle">
<div class="flex items-center justify-between mb-4">
<div>
<h3 class="font-bold text-base text-primary">Distribusi Kanal Transaksi</h3>
<p class="text-xs text-on-surface-variant">Sumber arus perputaran penjualan karya</p>
</div>
<div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
<span class="material-symbols-outlined text-[20px]">pie_chart</span>
</div>
</div>
<!-- Donut SVG + Channel Breakdown -->
<div class="flex flex-col sm:flex-row items-center gap-5 my-2">
<!-- Multi-layered SVG Donut Chart -->
<div class="relative w-36 h-36 shrink-0 flex items-center justify-center">
<svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
<!-- Base Track -->
<circle cx="18" cy="18" fill="none" r="15.9155" stroke="#F1F5F9" stroke-width="4.2"></circle>
<!-- Segment 1: WhatsApp SPK (46%) -->
<circle cx="18" cy="18" fill="none" r="15.9155" stroke="#00102d" stroke-dasharray="46 54" stroke-dashoffset="0" stroke-width="4.2"></circle>
<!-- Segment 2: Tokopedia (32%) -->
<circle cx="18" cy="18" fill="none" r="15.9155" stroke="#F59E0B" stroke-dasharray="32 68" stroke-dashoffset="-46" stroke-width="4.2"></circle>
<!-- Segment 3: Shopee (22%) -->
<circle cx="18" cy="18" fill="none" r="15.9155" stroke="#10B981" stroke-dasharray="22 78" stroke-dashoffset="-78" stroke-width="4.2"></circle>
</svg>
<div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
<span class="text-xl font-extrabold text-primary leading-none">100%</span>
<span class="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Multi-Kanal</span>
</div>
</div>
<!-- Channel Detail Items -->
<div class="flex flex-col gap-2.5 w-full">
<!-- Channel 1: WhatsApp SPK -->
<div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
<div class="flex items-center gap-2">
<div class="w-2.5 h-2.5 rounded-full bg-[#00102d]"></div>
<div>
<span class="text-xs font-bold text-primary block">WhatsApp SPK / Dinas</span>
<span class="text-[10px] text-slate-500">B2B &amp; Pengadaan Pemda</span>
</div>
</div>
<div class="text-right">
<span class="text-xs font-extrabold text-primary block">46%</span>
<span class="text-[10px] font-medium text-slate-500">Rp 222,0 M</span>
</div>
</div>
<!-- Channel 2: Tokopedia Official -->
<div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
<div class="flex items-center gap-2">
<div class="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
<div>
<span class="text-xs font-bold text-primary block">Tokopedia Official Giatja</span>
<span class="text-[10px] text-slate-500">Retail Marketplace</span>
</div>
</div>
<div class="text-right">
<span class="text-xs font-extrabold text-amber-800 block">32%</span>
<span class="text-[10px] font-medium text-slate-500">Rp 154,5 M</span>
</div>
</div>
<!-- Channel 3: Shopee Official -->
<div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
<div class="flex items-center gap-2">
<div class="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
<div>
<span class="text-xs font-bold text-primary block">Shopee Official Jabar</span>
<span class="text-[10px] text-slate-500">Konsumen Publik</span>
</div>
</div>
<div class="text-right">
<span class="text-xs font-extrabold text-emerald-800 block">22%</span>
<span class="text-[10px] font-medium text-slate-500">Rp 106,2 M</span>
</div>
</div>
</div>
</div>
<div class="mt-3 text-center bg-blue-50/60 p-2.5 rounded-xl border border-blue-200/60 flex items-center justify-center gap-1.5">
<span class="material-symbols-outlined text-[16px] text-blue-700">credit_card</span>
<span class="text-[11px] font-semibold text-blue-900">
                Terkoneksi Virtual Account Perbankan BUMN (BNI &amp; BRI)
              </span>
</div>
</div>
```

Replace it with:

```html
<!-- Card 1: Distribusi Kanal Transaksi -->
<div class="bg-white rounded-2xl p-6 shadow-sm border border-border-subtle">
<div class="flex items-center justify-between mb-4">
<div>
<h3 class="font-bold text-base text-primary">Distribusi Kanal Transaksi</h3>
<p class="text-xs text-on-surface-variant">Sumber arus perputaran penjualan karya (berdasarkan omzet)</p>
</div>
<div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
<span class="material-symbols-outlined text-[20px]">pie_chart</span>
</div>
</div>
<div class="flex flex-col sm:flex-row items-center gap-5 my-2">
<div class="relative w-36 h-36 shrink-0 flex items-center justify-center">
<svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36" id="channel-donut-svg">
<circle cx="18" cy="18" fill="none" r="15.9155" stroke="#F1F5F9" stroke-width="4.2"></circle>
</svg>
<div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
<span class="text-xl font-extrabold text-primary leading-none" id="channel-donut-center">-</span>
<span class="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Multi-Kanal</span>
</div>
</div>
<div class="flex flex-col gap-2.5 w-full" id="channel-legend-list">
<p class="text-xs text-slate-400 text-center py-4">Memuat...</p>
</div>
</div>
</div>
```

- [ ] **Step 7: Make the category composition card dynamic**

Find this exact block (the whole "Card 2: Alokasi & Tata Kelola Keuangan Giatja" card):

```html
<!-- Card 2: Alokasi & Tata Kelola Keuangan Giatja (Regulasi Resmi) -->
<div class="bg-white rounded-2xl p-6 shadow-sm border border-border-subtle relative overflow-hidden">
<div class="flex items-center justify-between mb-4">
<div>
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-primary text-[20px]">category</span>
<h3 class="font-bold text-base text-primary">Komposisi Kategori Produk</h3>
</div>
<p class="text-xs text-on-surface-variant">Distribusi sektor produksi karya narapidana se-Jawa Barat</p>
</div>
<span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[10px] font-extrabold uppercase border border-slate-200">
                5 Sektor Utama
              </span>
</div>
<div class="space-y-3.5">
<!-- Category 1: Kriya & Kerajinan Tangan -->
<div>
<div class="flex justify-between items-center mb-1 text-xs">
<span class="font-semibold text-slate-800 flex items-center gap-1.5">
<span class="w-2.5 h-2.5 rounded-full bg-primary"></span>
                    Kriya Kayu, Kulit &amp; Kerajinan
                  </span>
<span class="font-extrabold text-primary">42% <span class="font-medium text-slate-500">(Rp 202,7 Jt)</span></span>
</div>
<div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
<div class="bg-primary h-2 rounded-full" style="width: 42%"></div>
</div>
</div>
<!-- Category 2: Agribisnis & Olahan Pangan -->
<div>
<div class="flex justify-between items-center mb-1 text-xs">
<span class="font-semibold text-slate-800 flex items-center gap-1.5">
<span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    Agribisnis, Kopi &amp; Olahan Pangan
                  </span>
<span class="font-extrabold text-amber-900">28% <span class="font-medium text-slate-500">(Rp 135,1 Jt)</span></span>
</div>
<div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
<div class="bg-amber-500 h-2 rounded-full" style="width: 28%"></div>
</div>
</div>
<!-- Category 3: Tekstil & Rajut Mode -->
<div>
<div class="flex justify-between items-center mb-1 text-xs">
<span class="font-semibold text-slate-800 flex items-center gap-1.5">
<span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    Tekstil, Batik &amp; Rajut Wanita
                  </span>
<span class="font-extrabold text-emerald-800">18% <span class="font-medium text-slate-500">(Rp 86,9 Jt)</span></span>
</div>
<div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
<div class="bg-emerald-500 h-2 rounded-full" style="width: 18%"></div>
</div>
</div>
<!-- Category 4: Manufaktur & Jasa Las -->
<div>
<div class="flex justify-between items-center mb-1 text-xs">
<span class="font-semibold text-slate-800 flex items-center gap-1.5">
<span class="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                    Manufaktur Logam, Las &amp; Jasa
                  </span>
<span class="font-extrabold text-slate-800">12% <span class="font-medium text-slate-500">(Rp 57,9 Jt)</span></span>
</div>
<div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
<div class="bg-slate-500 h-2 rounded-full" style="width: 12%"></div>
</div>
</div>
</div>
<div class="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
<span class="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">verified</span>
<p class="text-xs text-slate-700 leading-relaxed font-medium">
                Seluruh alokasi biaya produksi, upah premi, dan kewajiban pendapatan negara ditetapkan mandiri oleh masing-masing SK Kepala UPT sesuai komoditas dan pangsa pasar setempat.
              </p>
</div>
</div>
```

Replace it with:

```html
<!-- Card 2: Komposisi Kategori Produk -->
<div class="bg-white rounded-2xl p-6 shadow-sm border border-border-subtle relative overflow-hidden">
<div class="flex items-center justify-between mb-4">
<div>
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-primary text-[20px]">category</span>
<h3 class="font-bold text-base text-primary">Komposisi Kategori Produk</h3>
</div>
<p class="text-xs text-on-surface-variant">Distribusi kategori produk aktif se-Jawa Barat</p>
</div>
<span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[10px] font-extrabold uppercase border border-slate-200" id="kategori-sektor-count">
                - Sektor
              </span>
</div>
<div class="space-y-3.5" id="kategori-komposisi-list">
<p class="text-xs text-slate-400 text-center py-4">Memuat...</p>
</div>
</div>
```

- [ ] **Step 8: Remove the entire "Status Pemenuhan Pesanan" card**

Find this exact block:

```html
<!-- Card 3: Status Pemenuhan Pesanan (Fulfillment Status) -->
<div class="bg-white rounded-2xl p-6 shadow-sm border border-border-subtle">
<div class="flex items-center justify-between mb-4">
<div>
<h3 class="font-bold text-base text-primary">Status Pemenuhan Pesanan</h3>
<p class="text-xs text-on-surface-variant">SLA logistik dan produksi bimbingan kerja</p>
</div>
<div class="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
<span class="material-symbols-outlined text-[20px]">local_shipping</span>
</div>
</div>
<div class="grid grid-cols-3 gap-3 mb-4">
<!-- Status 1 -->
<div class="bg-emerald-50/80 border border-emerald-200/80 p-3 rounded-xl text-center flex flex-col items-center">
<span class="material-symbols-outlined text-emerald-600 text-[22px] mb-1">task_alt</span>
<span class="text-lg font-extrabold text-emerald-800">94.2%</span>
<span class="text-[10px] font-bold text-emerald-900 uppercase mt-0.5">Terkirim</span>
<span class="text-[10px] text-slate-500 mt-0.5">3.937 Transaksi</span>
</div>
<!-- Status 2 -->
<div class="bg-amber-50/80 border border-amber-200/80 p-3 rounded-xl text-center flex flex-col items-center">
<span class="material-symbols-outlined text-amber-600 text-[22px] mb-1">precision_manufacturing</span>
<span class="text-lg font-extrabold text-amber-900">4.5%</span>
<span class="text-[10px] font-bold text-amber-900 uppercase mt-0.5">Pengerjaan</span>
<span class="text-[10px] text-slate-500 mt-0.5">188 SPK Khusus</span>
</div>
<!-- Status 3 -->
<div class="bg-slate-100 border border-slate-200 p-3 rounded-xl text-center flex flex-col items-center">
<span class="material-symbols-outlined text-slate-600 text-[22px] mb-1">hourglass_top</span>
<span class="text-lg font-extrabold text-slate-800">1.3%</span>
<span class="text-[10px] font-bold text-slate-700 uppercase mt-0.5">Verifikasi</span>
<span class="text-[10px] text-slate-500 mt-0.5">55 Pesanan Baru</span>
</div>
</div>
<div class="flex items-center justify-between text-xs text-on-surface-variant bg-surface-container px-3 py-2 rounded-xl border border-border-subtle">
<span>Rata-rata Lead Time Produksi Kustom:</span>
<span class="font-extrabold text-primary">6 Hari Kerja</span>
</div>
</div>
```

Delete it entirely (replace with nothing) — leave the surrounding right-column wrapper `<div>` (which also holds Cards 1 and 2) otherwise untouched.

- [ ] **Step 9: Manual test**

1. Open `/monitoring` and confirm the RKAKL target box, the "Status Pemenuhan Pesanan" card, and the virtual-account bank claim text are completely gone from the page.
2. Confirm the monthly chart area shows "Belum ada data histori bulanan" instead of a bar chart, and the two boxes beside it say "Belum ada data histori" instead of percentages.
3. Confirm the table header no longer has a "Status SIMPONI" column, and no row (real or fallback) shows a status badge.
4. Confirm the channel donut and category composition cards show "Memuat..." placeholders (they'll be filled by Task 2) rather than the old fake percentages.
5. Confirm the page doesn't look visually broken (no empty gaps where cards used to be, no overlapping elements) — open browser dev tools console and check there are no new JS errors (the removed `renderUptRow`/`loadUptTable` changes should still run without errors even before Task 2 adds the new aggregation function, since Task 2 hasn't run yet at this checkpoint — the `data-cell` cells will just stay on "Memuat..."/"-" which is fine/honest).

- [ ] **Step 10: Commit**

```bash
git add monitoring.html
git commit -m "Strip fabricated RKAKL/fulfillment/bank-integration content from monitoring.html, add real-data shells"
```

---

### Task 2: Compute and render all the real aggregates

**Files:**
- Modify: `monitoring.html`

**Interfaces:**
- Consumes: the ids Task 1 created (`#chart-tren-placeholder` stays as-is, no JS needed for it — it's static honest text); `#kpi-pertumbuhan`/`#kpi-sebaran-upt` also stay static (no real computation exists for these per spec Bagian 2, they're permanently "Belum ada data histori" until a future monthly-snapshot feature exists — Task 2 does NOT touch these two ids, they need no JS); `#wilayah-distribusi-list`, `#channel-donut-svg` + `#channel-donut-center` + `#channel-legend-list`, `#kategori-komposisi-list` + `#kategori-sektor-count`, and each table row's `[data-upt-row]` + `[data-cell="komoditas|volume|omzet"]` cells.
- Produces: nothing — last task in this plan.

- [ ] **Step 1: Fetch everything once, in one new function**

Find this exact block (the end of the script, right before the two bootstrap calls):

```javascript
  async function loadUptTable() {
    const tbody = document.getElementById("upt-table-body");
    if (!tbody) return;
    const { data, error } = await supabaseClient
      .from("upt")
      .select("id, kode, nama, kelas, wilayah")
      .order("nama", { ascending: true });

    if (error) {
      console.error("Gagal memuat data UPT dari Supabase:", error);
      return; // biarkan baris fallback statis tampil
    }
    if (!data || data.length === 0) return;

    tbody.innerHTML = data.map(renderUptRow).join("");
    tbody.removeAttribute("data-loading");
  }

  loadKpiCards();
  loadUptTable();
</script>
```

Replace it with:

```javascript
  async function loadUptTable() {
    const tbody = document.getElementById("upt-table-body");
    if (!tbody) return;
    const { data, error } = await supabaseClient
      .from("upt")
      .select("id, kode, nama, kelas, wilayah")
      .order("nama", { ascending: true });

    if (error) {
      console.error("Gagal memuat data UPT dari Supabase:", error);
      return; // biarkan baris fallback statis tampil
    }
    if (!data || data.length === 0) return;

    tbody.innerHTML = data.map(renderUptRow).join("");
    tbody.removeAttribute("data-loading");
    fillUptRowAggregates(data);
  }

  const CHANNEL_COLORS = {
    WhatsApp: "#25D366",
    Shopee: "#EE4D2D",
    Tokopedia: "#03AC0E",
    Offline: "#475569",
    Lainnya: "#94A3B8",
  };

  const KATEGORI_COLORS = ["#0f254a", "#F59E0B", "#10B981", "#64748B", "#8B5CF6", "#EC4899", "#06B6D4"];

  async function loadMonitoringAggregates() {
    const [produkResult, transaksiResult, uptResult] = await Promise.all([
      supabaseClient.from("produk").select("id, upt_id, nama, kategori, status"),
      supabaseClient.from("transaksi_penjualan").select("upt_id, produk_id, jumlah, total_harga, channel"),
      supabaseClient.from("upt").select("id, nama, wilayah"),
    ]);

    if (produkResult.error) console.error("Gagal memuat produk:", produkResult.error);
    if (transaksiResult.error) console.error("Gagal memuat transaksi:", transaksiResult.error);
    if (uptResult.error) console.error("Gagal memuat UPT:", uptResult.error);

    const produkList = produkResult.data || [];
    const transaksiList = transaksiResult.data || [];
    const uptList = uptResult.data || [];

    renderChannelDonut(transaksiList);
    renderKategoriKomposisi(produkList);
    renderWilayahDistribusi(transaksiList, uptList);
    window.__uptAggregateData = { produkList, transaksiList }; // consumed by fillUptRowAggregates once the table has rendered
  }

  function renderChannelDonut(transaksiList) {
    const svg = document.getElementById("channel-donut-svg");
    const centerLabel = document.getElementById("channel-donut-center");
    const legendList = document.getElementById("channel-legend-list");
    if (!svg || !legendList) return;

    const omzetByChannel = new Map();
    let totalOmzet = 0;
    transaksiList.forEach((t) => {
      const channel = t.channel || "Lainnya";
      const nilai = Number(t.total_harga || 0);
      omzetByChannel.set(channel, (omzetByChannel.get(channel) || 0) + nilai);
      totalOmzet += nilai;
    });

    if (totalOmzet === 0) {
      legendList.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Belum ada transaksi.</p>';
      if (centerLabel) centerLabel.textContent = "-";
      return;
    }

    const entries = Array.from(omzetByChannel.entries())
      .filter(([, nilai]) => nilai > 0)
      .sort((a, b) => b[1] - a[1]);

    let offset = 0;
    const circles = entries.map(([channel, nilai]) => {
      const pct = (nilai / totalOmzet) * 100;
      const color = CHANNEL_COLORS[channel] || CHANNEL_COLORS.Lainnya;
      const circle = `<circle cx="18" cy="18" fill="none" r="15.9155" stroke="${color}" stroke-dasharray="${pct.toFixed(2)} ${(100 - pct).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" stroke-width="4.2"></circle>`;
      offset += pct;
      return circle;
    });

    svg.innerHTML = '<circle cx="18" cy="18" fill="none" r="15.9155" stroke="#F1F5F9" stroke-width="4.2"></circle>' + circles.join("");
    if (centerLabel) centerLabel.textContent = entries.length.toString();

    legendList.innerHTML = entries.map(([channel, nilai]) => {
      const pct = ((nilai / totalOmzet) * 100).toFixed(1);
      const color = CHANNEL_COLORS[channel] || CHANNEL_COLORS.Lainnya;
      return `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full" style="background-color: ${color}"></div>
            <span class="text-xs font-bold text-primary block">${escapeHtml(channel)}</span>
          </div>
          <div class="text-right">
            <span class="text-xs font-extrabold text-primary block">${pct}%</span>
            <span class="text-[10px] font-medium text-slate-500">${formatRupiah(nilai)}</span>
          </div>
        </div>`;
    }).join("");
  }

  function renderKategoriKomposisi(produkList) {
    const container = document.getElementById("kategori-komposisi-list");
    const sektorCountEl = document.getElementById("kategori-sektor-count");
    if (!container) return;

    const aktifList = produkList.filter((p) => p.status === "aktif");
    const countByKategori = new Map();
    aktifList.forEach((p) => {
      const kategori = p.kategori || "Lainnya";
      countByKategori.set(kategori, (countByKategori.get(kategori) || 0) + 1);
    });

    if (aktifList.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Belum ada produk aktif.</p>';
      if (sektorCountEl) sektorCountEl.textContent = "0 Sektor";
      return;
    }

    const entries = Array.from(countByKategori.entries()).sort((a, b) => b[1] - a[1]);
    if (sektorCountEl) sektorCountEl.textContent = `${entries.length} Sektor`;

    container.innerHTML = entries.map(([kategori, count], i) => {
      const pct = ((count / aktifList.length) * 100).toFixed(0);
      const color = KATEGORI_COLORS[i % KATEGORI_COLORS.length];
      return `
        <div>
          <div class="flex justify-between items-center mb-1 text-xs">
            <span class="font-semibold text-slate-800 flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${color}"></span>
              ${escapeHtml(kategori)}
            </span>
            <span class="font-extrabold" style="color: ${color}">${pct}% <span class="font-medium text-slate-500">(${count} produk)</span></span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div class="h-2 rounded-full" style="width: ${pct}%; background-color: ${color}"></div>
          </div>
        </div>`;
    }).join("");
  }

  function renderWilayahDistribusi(transaksiList, uptList) {
    const container = document.getElementById("wilayah-distribusi-list");
    if (!container) return;

    const wilayahByUptId = new Map(uptList.map((u) => [u.id, u.wilayah || "Belum Ditentukan"]));
    const uptCountByWilayah = new Map();
    uptList.forEach((u) => {
      const wilayah = u.wilayah || "Belum Ditentukan";
      uptCountByWilayah.set(wilayah, (uptCountByWilayah.get(wilayah) || 0) + 1);
    });

    const omzetByWilayah = new Map();
    let totalOmzet = 0;
    transaksiList.forEach((t) => {
      const wilayah = wilayahByUptId.get(t.upt_id) || "Belum Ditentukan";
      const nilai = Number(t.total_harga || 0);
      omzetByWilayah.set(wilayah, (omzetByWilayah.get(wilayah) || 0) + nilai);
      totalOmzet += nilai;
    });

    const allWilayah = Array.from(uptCountByWilayah.keys()).sort();
    container.innerHTML = allWilayah.map((wilayah) => {
      const omzet = omzetByWilayah.get(wilayah) || 0;
      const pct = totalOmzet > 0 ? ((omzet / totalOmzet) * 100).toFixed(1) : "0.0";
      const jumlahUpt = uptCountByWilayah.get(wilayah);
      return `
        <div class="p-2 bg-white rounded-lg border border-slate-200">
          <div class="flex justify-between items-center">
            <span class="text-[11px] font-bold text-slate-700">${escapeHtml(wilayah)}</span>
            <span class="text-[10px] font-extrabold text-primary">${pct}%</span>
          </div>
          <span class="text-xs font-extrabold text-primary block mt-0.5">${formatRupiah(omzet)}</span>
          <span class="text-[10px] text-slate-500">${jumlahUpt} UPT</span>
        </div>`;
    }).join("");
  }

  function fillUptRowAggregates(uptRows) {
    const data = window.__uptAggregateData;
    if (!data) {
      // Aggregates haven't loaded yet — try again shortly once loadMonitoringAggregates resolves.
      setTimeout(() => fillUptRowAggregates(uptRows), 300);
      return;
    }
    const { produkList, transaksiList } = data;

    uptRows.forEach((upt) => {
      const row = document.querySelector(`[data-upt-row="${upt.id}"]`);
      if (!row) return;

      const ownProduk = produkList.filter((p) => p.upt_id === upt.id);
      const ownProdukIds = new Set(ownProduk.map((p) => p.id));
      const ownTransaksi = transaksiList.filter((t) => t.upt_id === upt.id);

      const volume = ownTransaksi.reduce((sum, t) => sum + Number(t.jumlah || 0), 0);
      const omzet = ownTransaksi.reduce((sum, t) => sum + Number(t.total_harga || 0), 0);

      const volumeByProduk = new Map();
      ownTransaksi.forEach((t) => {
        if (!ownProdukIds.has(t.produk_id)) return;
        volumeByProduk.set(t.produk_id, (volumeByProduk.get(t.produk_id) || 0) + Number(t.jumlah || 0));
      });

      let topProdukNama = null;
      let topVolume = 0;
      volumeByProduk.forEach((vol, produkId) => {
        if (vol > topVolume) {
          topVolume = vol;
          const produk = ownProduk.find((p) => p.id === produkId);
          topProdukNama = produk ? produk.nama : null;
        }
      });

      const komoditasCell = row.querySelector('[data-cell="komoditas"]');
      const volumeCell = row.querySelector('[data-cell="volume"]');
      const omzetCell = row.querySelector('[data-cell="omzet"]');

      if (komoditasCell) {
        komoditasCell.innerHTML = topProdukNama
          ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-800 border border-slate-200">${escapeHtml(topProdukNama)}</span>`
          : `<span class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-500 border border-slate-200">Belum ada penjualan</span>`;
      }
      if (volumeCell) {
        volumeCell.textContent = volume > 0 ? `${volume.toLocaleString("id-ID")} Unit` : "-";
        volumeCell.classList.toggle("text-slate-400", volume === 0);
        volumeCell.classList.toggle("text-slate-800", volume > 0);
      }
      if (omzetCell) {
        omzetCell.textContent = omzet > 0 ? formatRupiah(omzet) : "-";
        omzetCell.classList.toggle("text-slate-400", omzet === 0);
        omzetCell.classList.toggle("text-primary", omzet > 0);
      }
    });
  }

  loadKpiCards();
  loadUptTable();
  loadMonitoringAggregates();
</script>
```

- [ ] **Step 2: Manual test**

1. Open `/monitoring`. Confirm the channel donut renders real segments (not the "Memuat..." placeholder) matching the channels actually used in earlier testing (at least WhatsApp and Tokopedia should appear, from the "Kopi Robusta" transactions recorded earlier in this project).
2. Confirm "Komposisi Kategori Produk" shows real categories (e.g. "Kuliner") with a real product count, and the "X Sektor" badge matches how many distinct categories actually exist among active products.
3. Confirm "Distribusi Penjualan per Wilayah" shows the real wilayah names from the 33-UPT seed data (not "Bandung Raya/Cirebon & Pantura/Bogor Depok Bekasi/Priangan Timur"), and that a wilayah with zero sales still appears in the list showing "Rp 0" / "0.0%" rather than being hidden.
4. Scroll to the UPT table and confirm the row for the UPT used in earlier testing (Lapas Subang / kode `692151`) shows "Kopi Robusta" (or whichever product had the most volume) in Komoditas Unggulan, and real Volume/Omzet numbers — not "Memuat..." stuck forever.
5. Confirm a UPT row with no sales at all shows "Belum ada penjualan" / "-" / "-" rather than an error or blank cells.
6. Check the browser console for errors — there should be none.

- [ ] **Step 3: Commit**

```bash
git add monitoring.html
git commit -m "Wire real channel/category/wilayah aggregates and per-UPT table columns on monitoring.html"
```

---

## Final Verification (after both tasks)

- [ ] Push all commits: `git push origin main`, confirm Vercel redeploys and the live site reflects every change in this plan.
- [ ] Re-read the whole `monitoring.html` page end to end once more and confirm no other fabricated number slipped through unnoticed (this plan covers everything identified during the honesty review in this session, but a final skim is cheap insurance).
