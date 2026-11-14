# Multi-Channel Sales Recording + Per-UPT WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each logged-in UPT record its own sales (manual entry or CSV bulk upload) tagged by channel (WhatsApp/Shopee/Tokopedia/Offline/Lainnya), set its own WhatsApp number, see a history of its transactions, and show real per-UPT WhatsApp order links + live product data on the public catalog.

**Architecture:** Plain static HTML pages, no build step, no server/API routes. All data access goes straight from browser JavaScript to Supabase via `supabaseClient` (already loaded in every page via `/assets/js/supabase-client.js`), protected by the Row Level Security policies already in place (`profiles` → `upt_id` scoping). No test runner exists in this project; every task's "test" step is a manual browser verification with exact clicks/values to check, not automated test code.

**Tech Stack:** HTML + Tailwind CDN + vanilla JS, `@supabase/supabase-js@2.45.4` (CDN), PapaParse `5.4.1` (CDN, new in this plan) for CSV parsing, Supabase Postgres + Storage + Auth + RLS.

## Global Constraints

- Every Supabase write must go through RLS — never bypass it by writing service-role logic into client-side pages.
- `status_pengiriman` on `transaksi_penjualan` is NOT exposed in any new UI — always insert `'selesai'` for rows created by this plan's forms/CSV.
- `channel` must be constrained to exactly: `WhatsApp`, `Shopee`, `Tokopedia`, `Offline`, `Lainnya` (matches the new DB check constraint — client-side validation must use the same list).
- WhatsApp numbers are stored as `62xxxxxxxxxx` (country code `62`, no leading `+` or `0`) — this is the format `wa.me/<number>` requires.
- No new npm/build tooling for the site itself — CDN `<script>` tags only, consistent with every existing page.
- All new SQL goes in a dedicated file under `docs/`, mirroring the existing `docs/supabase-*.sql` pattern (these are reference files the human runs manually in Supabase SQL Editor — they are not executed automatically by any task).

---

### Task 1: Database schema — WhatsApp number + sales channel

**Files:**
- Create: `docs/supabase-sales-schema.sql`

**Interfaces:**
- Produces: `upt.whatsapp` (text, nullable), `transaksi_penjualan.channel` (text, check-constrained), RLS policy `"UPT bisa update profil upt sendiri"` allowing an authenticated user to `UPDATE` only the `upt` row matching their own `profiles.upt_id`. All later tasks that write `whatsapp` or `channel` depend on this.

- [ ] **Step 1: Write the SQL file**

```sql
-- ============================================
-- Tambahan skema: nomor WhatsApp per-UPT + channel penjualan.
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query > Run).
-- ============================================

alter table upt add column if not exists whatsapp text;

alter table transaksi_penjualan add column if not exists channel text
  check (channel in ('WhatsApp', 'Shopee', 'Tokopedia', 'Offline', 'Lainnya'));

create policy "UPT bisa update profil upt sendiri" on upt
  for update
  to authenticated
  using (id = (select upt_id from profiles where id = auth.uid()))
  with check (id = (select upt_id from profiles where id = auth.uid()));
```

- [ ] **Step 2: Manual test — run it in Supabase**

1. Open Supabase dashboard → SQL Editor → New Query.
2. Paste the file content above, click Run.
3. Expected: no errors. Open Table Editor → `upt` table → confirm a new `whatsapp` column exists (empty for all rows). Open `transaksi_penjualan` table → confirm a new `channel` column exists.

- [ ] **Step 3: Commit**

```bash
git add docs/supabase-sales-schema.sql
git commit -m "Add whatsapp column, channel column, and upt self-update policy"
```

---

### Task 2: Per-UPT WhatsApp number field on the dashboard

**Files:**
- Modify: `input-produk.html`

**Interfaces:**
- Consumes: Task 1's `upt.whatsapp` column and update policy.
- Produces: on page load, `currentUptId` global (already existed) now also has the UPT's `whatsapp` value pre-filled into `#whatsapp-number`. Later tasks don't depend on anything new here except the page structure (new section exists between `</header>` and `<main>`).

- [ ] **Step 1: Add the WhatsApp number section markup**

Find this exact line in `input-produk.html`:

```html
</header>

<main class="max-w-2xl mx-auto px-4 sm:px-8 py-8">
```

Replace it with:

```html
</header>

<section class="max-w-2xl mx-auto px-4 sm:px-8 pt-6">
  <div class="bg-white rounded-2xl shadow-sm border border-border-subtle p-5 flex flex-col sm:flex-row sm:items-end gap-3">
    <div class="flex-1">
      <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="whatsapp-number">Nomor WhatsApp UPT (untuk tombol pesan di katalog)</label>
      <input id="whatsapp-number" type="text" placeholder="Contoh: 628123456789 (tanpa +/0 di depan)"
        class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
    </div>
    <button id="save-whatsapp-btn" type="button" class="px-5 py-2.5 rounded-lg bg-primary-container text-white font-bold text-sm hover:bg-primary transition shrink-0">Simpan Nomor WA</button>
  </div>
  <p id="whatsapp-message" class="hidden text-xs font-semibold mt-2 px-1"></p>
</section>

<main class="max-w-2xl mx-auto px-4 sm:px-8 py-8">
```

- [ ] **Step 2: Fetch and show the existing WhatsApp number**

Find this exact block:

```javascript
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("upt_id, upt:upt_id (nama, kode)")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profile) {
      uptLabel.textContent = "Akun ini belum terhubung ke UPT manapun. Hubungi admin.";
      submitBtn.disabled = true;
      console.error(profileError);
      return;
    }

    currentUptId = profile.upt_id;
    uptLabel.textContent = `Input produk untuk: ${profile.upt.nama} (${profile.upt.kode})`;
  }
```

Replace it with:

```javascript
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("upt_id, upt:upt_id (nama, kode, whatsapp)")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profile) {
      uptLabel.textContent = "Akun ini belum terhubung ke UPT manapun. Hubungi admin.";
      submitBtn.disabled = true;
      console.error(profileError);
      return;
    }

    currentUptId = profile.upt_id;
    uptLabel.textContent = `Input produk untuk: ${profile.upt.nama} (${profile.upt.kode})`;
    document.getElementById("whatsapp-number").value = profile.upt.whatsapp || "";
  }
```

- [ ] **Step 3: Add the save handler**

Find this exact block:

```javascript
  logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "/login";
  });
```

Replace it with:

```javascript
  logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "/login";
  });

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
```

- [ ] **Step 4: Manual test**

1. Open the live site's `/login` page, log in with one UPT account (e.g. kode `692151` / Lapas Subang from `scripts/output/upt-credentials.csv`).
2. On `/input-produk`, confirm the new "Nomor WhatsApp UPT" field appears below the header, empty.
3. Type `6281234567890`, click "Simpan Nomor WA". Expected: green message "Nomor WhatsApp berhasil disimpan."
4. Reload the page. Expected: the field still shows `6281234567890` (confirms it was actually persisted, not just shown locally).
5. Type `08123456` (invalid format) and click save. Expected: red error message, no request succeeds silently.

- [ ] **Step 5: Commit**

```bash
git add input-produk.html
git commit -m "Add per-UPT WhatsApp number field to dashboard"
```

---

### Task 3: Riwayat Transaksi (sales history table)

**Files:**
- Modify: `input-produk.html`

**Interfaces:**
- Consumes: `currentUptId` (set by `loadAccountUpt`, Task 2).
- Produces: `escapeHtml(str)` helper function, `formatRupiah(n)` helper function, `renderRiwayatTransaksi()` async function — Tasks 4 and 5 call `renderRiwayatTransaksi()` after every successful insert to refresh the table, and reuse `escapeHtml`.

- [ ] **Step 1: Add the history table markup**

Find this exact block (the closing of the produk form's `</main>` section — note this is the LAST line of the file before the closing scripts):

```html
  </form>
</main>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
```

Replace it with:

```html
  </form>

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

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
```

- [ ] **Step 2: Add the helper functions and render function**

Find this exact block:

```javascript
  let currentUptId = null;

  function showMessage(text, type) {
```

Replace it with:

```javascript
  let currentUptId = null;

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

  function showMessage(text, type) {
```

- [ ] **Step 3: Call it on page load**

Find this exact line (the last line of the `<script>` block):

```javascript
  loadAccountUpt();
</script>
```

Replace it with:

```javascript
  loadAccountUpt().then(() => {
    if (currentUptId) renderRiwayatTransaksi();
  });
</script>
```

- [ ] **Step 4: Manual test**

1. Log in on `/login` with a UPT account that already has at least one product saved (from earlier testing).
2. On `/input-produk`, scroll to the bottom. Expected: a "Riwayat Transaksi" card showing "Belum ada transaksi." (since no `transaksi_penjualan` rows exist yet for this UPT).
3. Open Supabase Table Editor → `transaksi_penjualan` → manually insert one test row for this UPT's `upt_id` and any `produk_id` belonging to it (fill `channel` as `'WhatsApp'`, `tanggal_transaksi` as today). Reload the dashboard page. Expected: that row now appears in the table with the correct product name, formatted Rupiah, and channel.
4. Delete that manual test row from Supabase afterward (it was only for verifying the query/render works).

- [ ] **Step 5: Commit**

```bash
git add input-produk.html
git commit -m "Add sales history table to UPT dashboard"
```

---

### Task 4: Manual sales entry form

**Files:**
- Modify: `input-produk.html`

**Interfaces:**
- Consumes: `currentUptId`, `escapeHtml`, `renderRiwayatTransaksi()` (Task 3).
- Produces: `ownProdukList` global array of `{id, nama}` (own UPT's products), `loadProdukDropdown()` async function — Task 5's CSV upload reuses both to validate/match rows by product name.

- [ ] **Step 1: Add the manual sales form markup**

Find this exact block:

```html
  </form>

  <section class="bg-white rounded-2xl shadow-sm border border-border-subtle p-6 mt-6">
    <h2 class="font-bold text-base text-primary mb-4">Riwayat Transaksi</h2>
```

Replace it with:

```html
  </form>

  <section class="bg-white rounded-2xl shadow-sm border border-border-subtle p-6 mt-6 space-y-5">
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

  <section class="bg-white rounded-2xl shadow-sm border border-border-subtle p-6 mt-6">
    <h2 class="font-bold text-base text-primary mb-4">Riwayat Transaksi</h2>
```

- [ ] **Step 2: Add `ownProdukList`, `loadProdukDropdown()`, and the submit handler**

Find this exact block:

```javascript
  async function renderRiwayatTransaksi() {
```

Replace it with:

```javascript
  let ownProdukList = [];

  async function loadProdukDropdown() {
    const select = document.getElementById("penjualan-produk");
    const { data, error } = await supabaseClient
      .from("produk")
      .select("id, nama")
      .eq("upt_id", currentUptId)
      .order("nama", { ascending: true });

    if (error || !data || data.length === 0) {
      select.innerHTML = '<option value="" disabled selected>Belum ada produk terdaftar</option>';
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

  async function renderRiwayatTransaksi() {
```

- [ ] **Step 3: Load the dropdown on page load**

Find this exact block:

```javascript
  loadAccountUpt().then(() => {
    if (currentUptId) renderRiwayatTransaksi();
  });
</script>
```

Replace it with:

```javascript
  loadAccountUpt().then(() => {
    if (currentUptId) {
      renderRiwayatTransaksi();
      loadProdukDropdown();
    }
  });
</script>
```

- [ ] **Step 4: Refresh the dropdown after a new product is saved**

Find this exact block (the existing produk-form success path):

```javascript
      showMessage("Produk berhasil disimpan.", "success");
      messageBox.classList.remove("hidden");
      form.reset();
```

Replace it with:

```javascript
      showMessage("Produk berhasil disimpan.", "success");
      messageBox.classList.remove("hidden");
      form.reset();
      loadProdukDropdown();
```

- [ ] **Step 5: Manual test**

1. Log in on `/input-produk` with a UPT account that has at least 1 product saved.
2. Scroll to "Input Penjualan - Manual". Expected: the "Produk" dropdown lists that UPT's own products only (not other UPTs' products).
3. Fill jumlah=`5`, total harga=`100000`, channel=`WhatsApp`, tanggal=today (should be pre-filled). Click "Simpan Transaksi". Expected: green success message, form resets, and the new row immediately appears at the top of "Riwayat Transaksi" below without reloading the page.
4. Add a new product via "Input Produk" above. Expected: without reloading, the "Produk" dropdown in the sales form now includes the new product too.

- [ ] **Step 6: Commit**

```bash
git add input-produk.html
git commit -m "Add manual sales entry form to UPT dashboard"
```

---

### Task 5: CSV bulk upload for sales

**Files:**
- Modify: `input-produk.html`

**Interfaces:**
- Consumes: `currentUptId`, `escapeHtml`, `ownProdukList`, `renderRiwayatTransaksi()` (Tasks 3-4). Adds PapaParse (`window.Papa`) as a new CDN dependency.
- Produces: nothing consumed by later tasks (this is the last dashboard feature in the plan).

- [ ] **Step 1: Load PapaParse**

Find this exact line:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
```

Replace it with:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
```

- [ ] **Step 2: Add the CSV upload section markup**

Find this exact block:

```html
    </form>
  </section>

  <section class="bg-white rounded-2xl shadow-sm border border-border-subtle p-6 mt-6">
    <h2 class="font-bold text-base text-primary mb-4">Riwayat Transaksi</h2>
```

Replace it with:

```html
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
```

- [ ] **Step 3: Add the template download and CSV processing logic**

Find this exact block:

```javascript
  function escapeHtml(str) {
```

Insert BEFORE it (keep `escapeHtml` itself unchanged right after):

```javascript
  const VALID_CHANNELS = ["WhatsApp", "Shopee", "Tokopedia", "Offline", "Lainnya"];

  function generateTemplateCsv() {
    const header = "nama_produk,jumlah,total_harga,channel,tanggal\n";
    const rows = ownProdukList.map((p) => `"${p.nama.replace(/"/g, '""')}",,,,`).join("\n");
    return header + rows;
  }

  function validateCsvRow(row, rowIndex, produkByName) {
    const errors = [];
    const namaProduk = (row.nama_produk || "").trim();
    const produk = produkByName.get(namaProduk.toLowerCase());
    if (!namaProduk) errors.push("nama_produk kosong");
    else if (!produk) errors.push(`produk "${namaProduk}" tidak ditemukan`);

    const jumlah = Number(row.jumlah);
    if (!row.jumlah || isNaN(jumlah) || jumlah <= 0) errors.push("jumlah harus angka positif");

    const total = Number(row.total_harga);
    if (!row.total_harga || isNaN(total) || total < 0) errors.push("total_harga harus angka");

    const channel = (row.channel || "").trim();
    if (!VALID_CHANNELS.includes(channel)) errors.push(`channel "${channel}" tidak valid`);

    const tanggal = (row.tanggal || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) errors.push("tanggal harus format YYYY-MM-DD");

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

  function escapeHtml(str) {
```

Then, right after `ownProdukList` and `loadProdukDropdown()` are defined (find this exact block):

```javascript
    ownProdukList = data;
    select.innerHTML =
      '<option value="" disabled selected>Pilih produk...</option>' +
      data.map((p) => `<option value="${p.id}">${escapeHtml(p.nama)}</option>`).join("");
  }
```

Insert AFTER it:

```javascript

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
    const file = fileInput.files[0];
    if (!file) {
      alert("Pilih file CSV terlebih dahulu.");
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const produkByName = new Map(ownProdukList.map((p) => [p.nama.toLowerCase(), p]));
        const validRows = [];
        const failedRows = [];

        results.data.forEach((row, i) => {
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
      },
      error: (err) => {
        resultBox.classList.remove("hidden");
        resultBox.innerHTML = `<p class="text-red-600 font-semibold">Gagal membaca file CSV: ${escapeHtml(err.message)}</p>`;
      },
    });
  });
```

- [ ] **Step 4: Manual test**

1. Log in with a UPT that has at least 2 products saved. Click "Download Template CSV". Expected: a `template-penjualan.csv` downloads with the header row plus one blank row per that UPT's product names.
2. Open the downloaded file, fill in 2 valid rows (correct product names copied exactly, valid channel, valid date) and 1 intentionally broken row (misspelled product name). Save it.
3. Upload that file via "Proses Upload". Expected: "2 baris berhasil disimpan, 1 baris gagal." with a table showing the failed row's line number and the reason (`produk "..." tidak ditemukan`).
4. Check "Riwayat Transaksi" below. Expected: the 2 valid rows now appear without a page reload.
5. Log in as a *different* UPT and try uploading a CSV naming the first UPT's product names. Expected: all rows fail with "produk tidak ditemukan" (confirms cross-UPT product names are correctly rejected, not just names in general).

- [ ] **Step 5: Commit**

```bash
git add input-produk.html
git commit -m "Add CSV bulk upload for sales transactions"
```

---

### Task 6: Dynamic product catalog + per-UPT WhatsApp order links on `index.html`

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `produk` and `upt` tables (public read, already allowed by existing RLS policies from `docs/supabase-schema.sql`), and `upt.whatsapp` from Task 1.
- Produces: nothing consumed by other tasks — this is the last task in the plan.

- [ ] **Step 0: Investigate current structure (required before editing — do not guess)**

`index.html` is large and partially minified (long single lines per section), so read it fully before touching it:

```
Read index.html with allow_react: true (or allow_large: true) to see the whole file.
```

Locate these three things exactly as they appear in the live file (use these as search anchors, since line numbers may have shifted after earlier tasks):
1. The container `<div>` that holds the static mock product `<article class="product-card ...">` blocks — it sits inside `<main ... id="katalog-produk-section">`, right after the search input (`id="searchInput"`) and right before `id="noResultsState"`.
2. The `<div id="noResultsState" ...>` block itself (keep this — it's reused for the "no results" empty state).
3. The existing search filter `<script>` block that does `document.querySelectorAll('.product-card')` near the end of the file.

- [ ] **Step 1: Replace the static product grid with an empty dynamic container**

Replace the entire static grid `<div>` (the one from point 1 above, containing all the hardcoded `<article class="product-card ...">` blocks) with:

```html
<div class="grid grid-cols-1 md:grid-cols-3 gap-space-lg" id="productGrid">
  <p class="col-span-full text-center text-outline py-12">Memuat produk...</p>
</div>
```

Keep the `id="noResultsState"` block immediately after it completely unchanged.

- [ ] **Step 2: Replace the search filter script with data-driven rendering**

Replace the entire existing search filter `<script>` block (the one using `querySelectorAll('.product-card')`, found in point 3 above) with:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="/assets/js/supabase-client.js"></script>
<script>
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function formatRupiah(n) {
    return "Rp " + Number(n).toLocaleString("id-ID");
  }

  let allProduk = [];

  function waLink(produk) {
    const nomor = produk.upt && produk.upt.whatsapp;
    if (!nomor) return null;
    const pesan = encodeURIComponent(`Halo Admin ${produk.upt.nama}, saya tertarik memesan ${produk.nama}`);
    return `https://wa.me/${nomor}?text=${pesan}`;
  }

  function renderProdukCard(p) {
    const link = waLink(p);
    const waButton = link
      ? `<a class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-white text-sm font-bold transition-all shadow-sm" href="${link}" rel="noopener noreferrer" target="_blank">Pesan via WhatsApp Langsung</a>`
      : `<p class="text-xs text-outline italic px-1">Nomor WA belum tersedia, hubungi Divisi Pemasyarakatan Kanwil Jabar.</p>`;

    const img = p.image_url
      ? `<img alt="${escapeHtml(p.nama)}" class="w-full h-44 object-cover" src="${p.image_url}">`
      : `<div class="w-full h-44 bg-surface-canvas flex items-center justify-center text-outline text-xs">Tidak ada foto</div>`;

    return `
      <article class="product-card flex flex-col bg-surface-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
        data-nama="${escapeHtml(p.nama.toLowerCase())}" data-kategori="${escapeHtml((p.kategori || "").toLowerCase())}" data-upt="${escapeHtml((p.upt ? p.upt.nama : "").toLowerCase())}">
        ${img}
        <div class="p-space-md flex flex-col gap-2 flex-1">
          <span class="text-[11px] font-bold uppercase tracking-wide text-outline">${escapeHtml(p.kategori || "Lainnya")} &middot; ${escapeHtml(p.upt ? p.upt.nama : "-")}</span>
          <h3 class="font-bold text-title-md text-on-surface">${escapeHtml(p.nama)}</h3>
          <p class="text-sm text-on-surface-variant flex-1">${escapeHtml(p.deskripsi || "")}</p>
          <p class="font-extrabold text-primary">${formatRupiah(p.harga)}</p>
          ${waButton}
        </div>
      </article>`;
  }

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

  function attachSearchFilter() {
    const searchInput = document.getElementById("searchInput");
    const noResultsState = document.getElementById("noResultsState");
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
      const query = searchInput.value.trim().toLowerCase();
      const cards = document.querySelectorAll(".product-card");
      let visibleCount = 0;

      cards.forEach((card) => {
        const haystack = card.dataset.nama + " " + card.dataset.kategori + " " + card.dataset.upt;
        const match = haystack.includes(query);
        card.style.display = match ? "" : "none";
        if (match) visibleCount++;
      });

      if (noResultsState) {
        noResultsState.classList.toggle("hidden", visibleCount !== 0);
        noResultsState.classList.toggle("flex", visibleCount === 0);
      }
    });
  }

  loadKatalogProduk();
</script>
```

(If `index.html` already had its own `<script src=".../supabase-js...">` and `<script src="/assets/js/supabase-client.js">` tags elsewhere in the file from earlier work, do not duplicate them — merge this block so each CDN script tag appears only once.)

- [ ] **Step 3: Manual test**

1. Make sure at least 2 products exist across at least 2 different UPTs (from Task 4/5 testing or earlier manual testing), and at least one of those UPTs has saved a WhatsApp number (Task 2).
2. Open `/` (the catalog). Expected: real products render (not the old mock ones), each showing its real UPT name and category.
3. For the product whose UPT has a WhatsApp number set: expected a green "Pesan via WhatsApp Langsung" button that, when clicked, opens `wa.me/<that UPT's number>` with a pre-filled message naming that exact product.
4. For a product whose UPT has NOT set a WhatsApp number: expected the fallback text "Nomor WA belum tersedia..." instead of a broken/generic link.
5. Type into the search box a product name, a category, and a UPT name (one at a time). Expected: the grid filters correctly for all three in each case, and the "no results" message appears when the query matches nothing.
6. Mark a product as `status = 'nonaktif'` directly in Supabase Table Editor, reload. Expected: that product no longer appears in the catalog.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Wire catalog to live Supabase product data with per-UPT WhatsApp links"
```

---

## Final Verification (after all 6 tasks)

- [ ] Log in as two different UPT accounts in two separate browser profiles/incognito windows. Confirm neither can see the other's products, transactions, or edit the other's WhatsApp number (RLS enforcement end-to-end).
- [ ] Push all commits: `git push origin main`, confirm Vercel redeploys successfully and the live site reflects all of the above.
