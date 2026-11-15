# Produk Bulk Upload via ZIP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a UPT add many products at once by uploading a single ZIP file containing `produk.csv` (product data) plus the image files it references, instead of adding products one at a time through the manual form.

**Architecture:** Plain static HTML + Tailwind CDN + vanilla JS, matching every other page in this repo. Two new CDN libraries: JSZip (read a ZIP file in the browser) and PapaParse (parse the CSV extracted from it — PapaParse is already used on `dashboard-penjualan.html`, now added here too). No new database schema, RPC, or Edge Function — this reuses the existing `produk` table and the existing `uploadFoto()`/insert pattern already in this file, just driven by a loop instead of a single form submission.

**Tech Stack:** JSZip (CDN), PapaParse 5.4.1 (CDN, same version already used on `dashboard-penjualan.html`), `@supabase/supabase-js@2.45.4` (already loaded), vanilla JS.

## Global Constraints

- No build step, no framework.
- CSV columns (exact names, this order in the template): `nama_produk,kategori,harga,deskripsi,link_shopee,link_tokopedia,nama_file_gambar`. `nama_produk`, `kategori`, `harga`, `nama_file_gambar` are required; `deskripsi`, `link_shopee`, `link_tokopedia` may be blank.
- Valid `kategori` values (exact list, same as the manual form's dropdown): Kriya, Tekstil, Kuliner, Mebel, Pertanian, Jasa, Lainnya.
- ZIP must contain a file named exactly `produk.csv` at the root (not inside a subfolder) — missing it aborts the whole upload with one error message, no rows processed.
- Image files referenced by `nama_file_gambar` must be at the ZIP root, exact case-sensitive name match, extension jpg/jpeg/png/webp, size ≤ 2MB (same limit as the manual single-upload form).
- A bad row (validation failure, missing image, oversized image, insert error) is skipped and recorded with its row number and reason; it must never stop the rest of the batch from processing.
- All user-facing messages in Bahasa Indonesia, matching the rest of this page.
- Reuse the existing `uploadFoto(file, uptId)`, `escapeHtml(str)`, `formatRupiah(n)`, `loadProdukList(uptId)`, and the module-level `currentUptId` variable already defined in `dashboard-produk.html` — do not redefine or duplicate them.

---

### Task 1: Bulk ZIP upload — markup, libraries, and processing logic

**Files:**
- Modify: `dashboard-produk.html` (markup around lines 76-155, script tags around line 157-159, script body around line 420-429)

**Interfaces:**
- Consumes: `uploadFoto(file, uptId)` (dashboard-produk.html:215-225), `escapeHtml(str)` (:196-200), `formatRupiah(n)` (:202-204), `loadProdukList(uptId)` (:347-420), module-level `currentUptId` (set at :425 inside the existing bootstrap IIFE).
- Produces: nothing consumed by other tasks — this plan has exactly one task.

- [ ] **Step 1: Read the current file in full**

Read `dashboard-produk.html` (155 lines of markup + ~280 lines of script, ~432 lines total) to confirm the exact current text around the areas you'll edit: the left-column wrapper div you added in an earlier commit (`<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">` directly followed by `<form id="produk-form" ...>`), the end of that form's closing `</form>` tag, the three existing `<script src="...">` CDN tags, and the final bootstrap IIFE at the bottom of the inline script.

- [ ] **Step 2: Wrap the existing form in a left-column div, and add the new bulk-upload section**

Find this existing structure (from an earlier commit in this project):
```html
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
    <form id="produk-form" class="bg-white rounded-2xl shadow-sm border border-border-subtle p-6 space-y-5">
```
Change it to:
```html
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
    <div class="space-y-6">
    <form id="produk-form" class="bg-white rounded-2xl shadow-sm border border-border-subtle p-6 space-y-5">
```
Then find the form's closing tag:
```html
    </form>
```
(the one immediately before the `<section>` that opens "Daftar Produk" is wrong — this file currently has the structure `</form>\n\n    <section ...>Daftar Produk...`; you want the one right after `Batal Edit` button's closing `</div>` and before the blank line that precedes `<section>`). Insert the new bulk-upload section's markup right after that `</form>` tag, then close the new left-column wrapper div right after this new section (before the `Daftar Produk` `<section>`):

```html
    </form>

    <section class="bg-white rounded-2xl shadow-sm border border-border-subtle p-6 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <h2 class="font-bold text-base text-primary">Upload ZIP (Bulk)</h2>
        <button id="download-zip-template-btn" type="button" class="text-xs font-bold text-primary-container hover:underline">Download Template CSV</button>
      </div>
      <p class="text-xs text-slate-500">
        Siapkan 1 file ZIP berisi file <code class="bg-slate-100 px-1 rounded">produk.csv</code> (nama file wajib persis itu) dan gambar-gambar produk, semua di root ZIP (tidak di dalam folder).
        Kolom CSV wajib: <code class="bg-slate-100 px-1 rounded">nama_produk,kategori,harga,deskripsi,link_shopee,link_tokopedia,nama_file_gambar</code>.
        Kategori harus salah satu dari: Kriya, Tekstil, Kuliner, Mebel, Pertanian, Jasa, Lainnya. Nama file gambar di kolom <code class="bg-slate-100 px-1 rounded">nama_file_gambar</code> harus persis sama dengan nama file gambar di dalam ZIP. Maks 2MB per gambar, format JPG/PNG/WebP.
      </p>
      <input id="zip-file-input" type="file" accept=".zip,application/zip"
        class="w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-semibold file:text-xs hover:file:bg-slate-200">
      <button id="zip-upload-btn" type="button"
        class="px-5 py-2.5 rounded-lg bg-primary-container text-white font-bold text-sm hover:bg-primary transition disabled:opacity-50">
        Proses Upload
      </button>
      <div id="zip-result" class="hidden text-sm space-y-2"></div>
    </section>
    </div>
```

- [ ] **Step 3: Add the two new CDN script tags**

Find the existing three script tags:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="/assets/js/supabase-client.js"></script>
<script src="/assets/js/upt-dashboard.js"></script>
```
Add JSZip and PapaParse before them (order doesn't matter relative to the Supabase ones, but both must load before the inline `<script>` block that uses them):
```html
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="/assets/js/supabase-client.js"></script>
<script src="/assets/js/upt-dashboard.js"></script>
```

- [ ] **Step 4: Write the row-processing function and the two button handlers**

Insert this new code inside the existing inline `<script>` block, right before the final bootstrap IIFE (`(async () => { const uptInfo = await requireUptSession(); ... })();` at the end of the file):

```javascript
  const VALID_KATEGORI = ["Kriya", "Tekstil", "Kuliner", "Mebel", "Pertanian", "Jasa", "Lainnya"];

  async function processProdukRow(row, rowIndex, zip) {
    const errors = [];

    const nama = (row.nama_produk || "").trim();
    if (!nama) errors.push("nama_produk kosong");

    const kategori = (row.kategori || "").trim();
    if (!VALID_KATEGORI.includes(kategori)) errors.push(`kategori "${kategori}" tidak valid`);

    const hargaRaw = (row.harga || "").trim();
    const harga = parseFloat(hargaRaw);
    if (hargaRaw === "" || isNaN(harga) || harga < 0) errors.push("harga harus angka >= 0");

    const deskripsi = (row.deskripsi || "").trim() || null;

    const shopeeLink = (row.link_shopee || "").trim();
    if (shopeeLink && !/^https:\/\/([a-z0-9-]+\.)*shopee\.co\.id\//.test(shopeeLink)) {
      errors.push("link_shopee harus diawali https:// dan domain shopee.co.id");
    }

    const tokopediaLink = (row.link_tokopedia || "").trim();
    if (tokopediaLink && !/^https:\/\/([a-z0-9-]+\.)*tokopedia\.com\//.test(tokopediaLink)) {
      errors.push("link_tokopedia harus diawali https:// dan domain tokopedia.com");
    }

    const fileName = (row.nama_file_gambar || "").trim();
    if (!fileName) errors.push("nama_file_gambar kosong");

    let blob = null;
    if (fileName) {
      const zipEntry = zip.file(fileName);
      if (!zipEntry) {
        errors.push(`file gambar "${fileName}" tidak ditemukan di dalam ZIP`);
      } else {
        const ext = fileName.split(".").pop().toLowerCase();
        if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
          errors.push("format gambar harus jpg/jpeg/png/webp");
        } else {
          blob = await zipEntry.async("blob");
          if (blob.size > 2 * 1024 * 1024) errors.push("ukuran gambar melebihi 2MB");
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, rowIndex, error: errors.join("; ") };
    }

    return {
      valid: true,
      rowIndex,
      nama,
      kategori,
      harga,
      deskripsi,
      shopee_link: shopeeLink || null,
      tokopedia_link: tokopediaLink || null,
      fileName,
      blob,
    };
  }

  document.getElementById("download-zip-template-btn").addEventListener("click", () => {
    const csv = "nama_produk,kategori,harga,deskripsi,link_shopee,link_tokopedia,nama_file_gambar\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "produk.csv";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("zip-upload-btn").addEventListener("click", async () => {
    const fileInput = document.getElementById("zip-file-input");
    const resultBox = document.getElementById("zip-result");
    const uploadBtn = document.getElementById("zip-upload-btn");
    const file = fileInput.files[0];

    if (!file) {
      alert("Pilih file ZIP terlebih dahulu.");
      return;
    }
    if (!currentUptId) {
      alert("Tunggu data akun selesai dimuat, lalu coba lagi.");
      return;
    }

    uploadBtn.disabled = true;
    uploadBtn.textContent = "Memproses...";
    resultBox.classList.add("hidden");

    try {
      const zip = await JSZip.loadAsync(file);
      const csvEntry = zip.file("produk.csv");
      if (!csvEntry) {
        throw new Error("File produk.csv tidak ditemukan di dalam ZIP.");
      }

      const csvText = await csvEntry.async("string");
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

      if (!parsed.data || parsed.data.length === 0) {
        throw new Error("Tidak ada baris produk untuk diproses.");
      }

      const validRows = [];
      const failedRows = [];

      for (let i = 0; i < parsed.data.length; i++) {
        const outcome = await processProdukRow(parsed.data[i], i + 2, zip);
        if (outcome.valid) validRows.push(outcome);
        else failedRows.push(outcome);
      }

      let insertedCount = 0;
      for (const row of validRows) {
        try {
          const image_url = await uploadFoto(new File([row.blob], row.fileName), currentUptId);
          const { error: insertError } = await supabaseClient.from("produk").insert({
            nama: row.nama,
            kategori: row.kategori,
            harga: row.harga,
            deskripsi: row.deskripsi,
            shopee_link: row.shopee_link,
            tokopedia_link: row.tokopedia_link,
            image_url,
            upt_id: currentUptId,
            status: "aktif",
          });
          if (insertError) throw insertError;
          insertedCount++;
        } catch (err) {
          failedRows.push({ rowIndex: row.rowIndex, error: err.message || "gagal menyimpan" });
        }
      }

      resultBox.classList.remove("hidden");
      let html = `<p class="font-bold ${insertedCount > 0 ? "text-emerald-700" : "text-slate-600"}">${insertedCount} produk berhasil ditambahkan, ${failedRows.length} baris gagal.</p>`;
      if (failedRows.length > 0) {
        html += `<table class="w-full text-xs border-collapse mt-2"><thead><tr class="text-left text-slate-500"><th class="py-1 pr-3">Baris</th><th class="py-1">Alasan</th></tr></thead><tbody>`;
        html += failedRows
          .map((f) => `<tr><td class="py-1 pr-3 font-semibold">${escapeHtml(String(f.rowIndex))}</td><td class="py-1 text-red-600">${escapeHtml(f.error)}</td></tr>`)
          .join("");
        html += `</tbody></table>`;
      }
      resultBox.innerHTML = html;

      if (insertedCount > 0) loadProdukList(currentUptId);
      fileInput.value = "";
    } catch (err) {
      resultBox.classList.remove("hidden");
      resultBox.innerHTML = `<p class="text-red-600 font-semibold">${escapeHtml(err.message || "Gagal memproses ZIP.")}</p>`;
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Proses Upload";
    }
  });
```

Note on `new File([row.blob], row.fileName)`: `uploadFoto(file, uptId)` (the existing function you're reusing) reads `file.name.split(".").pop()` to build the storage path extension — wrapping the raw `Blob` from JSZip in a `File` object gives it that `.name` property so `uploadFoto` works unmodified.

- [ ] **Step 5: Manual verification**

This project has no local dev server or browser automation — verification happens live after deploy. Re-read the whole file once after editing to confirm: div balance (every `<div class="space-y-6">` and `<div class="grid ...">` you touched has a matching close), the two new script tags load before the inline script that calls `JSZip`/`Papa`, and the new JS block's braces are balanced with no syntax errors. Note in the report that live testing is pending the human, covering the spec's Testing section:
- Download Template CSV → fill in a few valid rows, zip with matching images at root named `produk.csv` + the images → upload → all rows succeed, appear in Daftar Produk.
- One row with a typo'd `nama_file_gambar` (file not in the ZIP) among otherwise-valid rows → that row fails with a clear message, others still succeed.
- A row with an invalid `kategori` → that row fails, others continue.
- A row whose image exceeds 2MB → that row fails with a size message.
- A ZIP with no `produk.csv` inside → one clear error, nothing saved.
- Uploading a non-ZIP file (e.g. `.rar` or plain `.csv`) → a ZIP-invalid error.
- After a partially-successful upload, the Daftar Produk list on the right refreshes to show the new products.

- [ ] **Step 6: Commit**

```bash
git add dashboard-produk.html
git commit -m "Add bulk product upload via ZIP (CSV + images)"
```

---

## Spec Coverage Check

- Bagian 1 (lokasi UI, format ZIP, kolom CSV, tombol template) → Task 1 Steps 2, 3.
- Bagian 2 (alur teknis: JSZip, PapaParse, validasi per baris, upload gambar, insert produk) → Task 1 Step 4.
- Bagian 3 (error handling & pesan, tombol disabled saat proses) → Task 1 Step 4.
- Di luar scope items (tidak ada update massal, tidak ada cek duplikat, ZIP harus flat, tidak ada preview gambar) → correctly absent from the task; confirmed no step adds them.
- Testing section dari spec → Task 1 Step 5.
