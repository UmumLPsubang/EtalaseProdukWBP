# Per-Product Marketplace Links + Product Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each product optionally carry a Shopee and/or Tokopedia link, show matching buttons on the public catalog alongside the existing WhatsApp button, and let UPT staff edit an existing product (not just add/deactivate/delete).

**Architecture:** Same plain static HTML + Supabase pattern as the rest of this project. The product form on `dashboard-produk.html` gains a dual mode (Add/Edit) driven by a module-level `editingProdukId` variable, reusing all existing fields rather than building a second form. The catalog's single WhatsApp-or-fallback button becomes a small multi-button renderer that shows 0-3 buttons based on which links/numbers exist on that product/UPT.

**Tech Stack:** HTML + Tailwind CDN + vanilla JS, `@supabase/supabase-js@2.45.4` (CDN). No new dependencies.

## Global Constraints

- Link fields are optional; empty is always valid. When filled, they must match `^https:\/\/.+` before the form submits — validated client-side before any Supabase call.
- Editing a product never changes its `upt_id` — there is no UI to reassign a product to a different UPT, and the existing RLS update policy already scopes this.
- If no new photo is chosen while editing, the existing `image_url` must be preserved (the update payload must not overwrite it with `null`).
- This project has no automated test runner — every task's "test" step is manual browser verification against the live Vercel deployment.
- No new npm/build tooling — CDN `<script>` tags only.

---

### Task 1: Database schema — Shopee/Tokopedia link columns

**Files:**
- Create: `docs/supabase-marketplace-links-schema.sql`

**Interfaces:**
- Produces: `produk.shopee_link` (text, nullable), `produk.tokopedia_link` (text, nullable). Tasks 2 and 3 both read/write these two columns by these exact names.

- [ ] **Step 1: Write the SQL file**

```sql
-- ============================================
-- Tambahan skema: link Shopee & Tokopedia per produk.
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query > Run).
-- ============================================

alter table produk add column if not exists shopee_link text;
alter table produk add column if not exists tokopedia_link text;
```

- [ ] **Step 2: Manual test — run it in Supabase**

1. Open Supabase dashboard → SQL Editor → New Query → paste the file content → Run.
2. Expected: no errors. Table Editor → `produk` → confirm `shopee_link` and `tokopedia_link` columns now exist (empty for all existing rows).

- [ ] **Step 3: Commit**

```bash
git add docs/supabase-marketplace-links-schema.sql
git commit -m "Add shopee_link and tokopedia_link columns to produk"
```

---

### Task 2: Dashboard Produk — link fields + Add/Edit dual-mode form

**Files:**
- Modify: `dashboard-produk.html`

**Interfaces:**
- Consumes: Task 1's `shopee_link`/`tokopedia_link` columns.
- Produces: nothing new consumed by Task 3 (Task 3 only reads the columns directly from Supabase, independent of this page's UI).

- [ ] **Step 1: Investigate the current file before editing**

`dashboard-produk.html` has been modified by several prior rounds (initial creation, then a fix-wave commit that added a `!currentUptId` guard to the submit handler and `.select()` + empty-result checks to the toggle/delete handlers). Read the full current file before making any edit. Locate these exact pieces by name/anchor (the literal surrounding text may differ slightly from what's shown below if a prior fix changed nearby lines — if a "Find this exact block" snippet in a later step doesn't match verbatim, use the closest accurate anchor you can find from this list and proceed, since the renaming/restructuring described in each step is unambiguous about WHAT to change even if the exact surrounding whitespace differs):

1. The `<form id="produk-form">` element and the `<h2>` immediately inside it that currently reads "Tambah Produk".
2. The `<div>` wrapping the `nama` field, so you can find the `deskripsi` field's wrapping `<div>` that comes after it (new link fields go between `deskripsi` and `foto`).
3. The submit button: `<button type="submit" id="submit-btn" ...>Simpan Produk</button>`, including its wrapping element.
4. In the `<script>`: `let currentUptId = null;`, the `loadProdukList(uptId)` function (its Supabase `.select(...)` call, its `renderProdukListItem` mapping, and its two `querySelectorAll` blocks for `.toggle-status-btn` and `.delete-produk-btn`), the `renderProdukListItem(p)` function, and the full `form.addEventListener("submit", ...)` handler.

- [ ] **Step 2: Add the two link fields to the form**

Find the `deskripsi` field's wrapping `<div>` (it contains a `<textarea id="deskripsi" ...>`) and the `foto` field's wrapping `<div>` that comes immediately after it. Insert this new block BETWEEN them (after the `deskripsi` div closes, before the `foto` div opens):

```html
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="shopee-link">Link Shopee (opsional)</label>
          <input id="shopee-link" type="url" placeholder="https://shopee.co.id/..."
            class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="tokopedia-link">Link Tokopedia (opsional)</label>
          <input id="tokopedia-link" type="url" placeholder="https://www.tokopedia.com/..."
            class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
        </div>
      </div>
```

- [ ] **Step 3: Add an id to the form title, and add a "Batal Edit" button next to Submit**

Find the form's `<h2>Tambah Produk</h2>` (the one directly inside `<form id="produk-form">`, not any other `<h2>` on the page) and give it an id:

```html
      <h2 class="font-bold text-base text-primary" id="produk-form-title">Tambah Produk</h2>
```

Find the submit button:

```html
      <button type="submit" id="submit-btn"
        class="w-full py-3 rounded-lg bg-primary-container text-white font-bold text-sm hover:bg-primary transition disabled:opacity-50 disabled:cursor-not-allowed">
        Simpan Produk
      </button>
```

Replace it (change `w-full` to `flex-1` and wrap both buttons in a flex row):

```html
      <div class="flex gap-3">
        <button type="submit" id="submit-btn"
          class="flex-1 py-3 rounded-lg bg-primary-container text-white font-bold text-sm hover:bg-primary transition disabled:opacity-50 disabled:cursor-not-allowed">
          Simpan Produk
        </button>
        <button type="button" id="cancel-edit-btn"
          class="hidden px-5 py-3 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition">
          Batal Edit
        </button>
      </div>
```

- [ ] **Step 4: Add edit-mode state and functions**

Find `let currentUptId = null;` in the `<script>` block and add this immediately after it:

```javascript
  let editingProdukId = null;
  let produkListCache = [];

  function enterEditMode(p) {
    editingProdukId = p.id;
    document.getElementById("produk-form-title").textContent = "Edit Produk";
    submitBtn.textContent = "Simpan Perubahan";
    document.getElementById("cancel-edit-btn").classList.remove("hidden");

    document.getElementById("nama").value = p.nama;
    document.getElementById("kategori").value = p.kategori || "";
    document.getElementById("harga").value = p.harga;
    document.getElementById("deskripsi").value = p.deskripsi || "";
    document.getElementById("shopee-link").value = p.shopee_link || "";
    document.getElementById("tokopedia-link").value = p.tokopedia_link || "";
    document.getElementById("foto").value = "";

    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exitEditMode() {
    editingProdukId = null;
    document.getElementById("produk-form-title").textContent = "Tambah Produk";
    submitBtn.textContent = "Simpan Produk";
    document.getElementById("cancel-edit-btn").classList.add("hidden");
    form.reset();
  }

  document.getElementById("cancel-edit-btn").addEventListener("click", exitEditMode);
```

(`form` and `submitBtn` already exist as variables earlier in this script, from the original page creation — do not redeclare them.)

- [ ] **Step 5: Update `loadProdukList` to fetch the new fields and cache the list**

Find the `loadProdukList(uptId)` function's Supabase query:

```javascript
    const { data, error } = await supabaseClient
      .from("produk")
      .select("id, nama, kategori, harga, image_url, status")
      .eq("upt_id", uptId)
      .order("created_at", { ascending: false });
```

Replace the `.select(...)` argument so it also fetches `deskripsi`, `shopee_link`, and `tokopedia_link` (needed to prefill the edit form) — keep everything else in the function the same:

```javascript
    const { data, error } = await supabaseClient
      .from("produk")
      .select("id, nama, kategori, harga, deskripsi, image_url, status, shopee_link, tokopedia_link")
      .eq("upt_id", uptId)
      .order("created_at", { ascending: false });
```

Immediately after the existing empty-check block (`if (!data || data.length === 0) { ... return; }`), and before the line that sets `container.innerHTML = data.map(renderProdukListItem).join("");`, add one line to cache the fetched list:

```javascript
    produkListCache = data;
```

- [ ] **Step 6: Add the Edit button to each list item and wire its click handler**

Find `renderProdukListItem(p)`'s returned template — specifically the `<div class="flex items-center gap-2 shrink-0">` that currently contains the toggle-status button and the delete button. Add a new Edit button BETWEEN them:

```html
          <button class="edit-produk-btn px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary text-xs font-bold transition border border-border-subtle" data-id="${p.id}">Edit</button>
```

Then, inside `loadProdukList`, find where the existing `.toggle-status-btn` and `.delete-produk-btn` click handlers are wired (the two `container.querySelectorAll(...)` blocks), and add a third block for the new Edit buttons, placed before, between, or after them (order doesn't matter):

```javascript
    container.querySelectorAll(".edit-produk-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const produk = produkListCache.find((item) => item.id === btn.dataset.id);
        if (produk) enterEditMode(produk);
      });
    });
```

- [ ] **Step 7: Rewrite the submit handler to validate links and branch insert/update**

Find the entire `form.addEventListener("submit", async (e) => { ... });` block (it currently has: `e.preventDefault()`, disable/relabel the submit button, the `!currentUptId` guard added in an earlier fix round, a `try` block that reads form fields, optionally uploads a photo, inserts into `produk`, shows a success message, resets the form, and calls `loadProdukList`, a `catch` that shows an error message, and a `finally` that re-enables the button). Replace the ENTIRE handler with this version:

```javascript
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = editingProdukId ? "Menyimpan..." : "Menyimpan...";
    messageBox.classList.add("hidden");

    if (!currentUptId) {
      showMessage("Tunggu data akun selesai dimuat, lalu coba lagi.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = editingProdukId ? "Simpan Perubahan" : "Simpan Produk";
      return;
    }

    const shopeeLink = document.getElementById("shopee-link").value.trim();
    const tokopediaLink = document.getElementById("tokopedia-link").value.trim();
    const urlPattern = /^https:\/\/.+/;

    if (shopeeLink && !urlPattern.test(shopeeLink)) {
      showMessage("Link Shopee harus diawali https://", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = editingProdukId ? "Simpan Perubahan" : "Simpan Produk";
      return;
    }
    if (tokopediaLink && !urlPattern.test(tokopediaLink)) {
      showMessage("Link Tokopedia harus diawali https://", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = editingProdukId ? "Simpan Perubahan" : "Simpan Produk";
      return;
    }

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

      const payload = {
        nama,
        kategori,
        harga,
        deskripsi,
        shopee_link: shopeeLink || null,
        tokopedia_link: tokopediaLink || null,
      };
      if (image_url) payload.image_url = image_url;

      if (editingProdukId) {
        const { error: updateError } = await supabaseClient
          .from("produk")
          .update(payload)
          .eq("id", editingProdukId);
        if (updateError) throw updateError;
        showMessage("Perubahan berhasil disimpan.", "success");
        exitEditMode();
      } else {
        const { error: insertError } = await supabaseClient.from("produk").insert({
          ...payload,
          upt_id: currentUptId,
          status: "aktif",
        });
        if (insertError) throw insertError;
        showMessage("Produk berhasil disimpan.", "success");
        form.reset();
      }

      loadProdukList(currentUptId);
    } catch (err) {
      console.error(err);
      showMessage("Gagal menyimpan produk: " + (err.message || "terjadi kesalahan"), "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = editingProdukId ? "Simpan Perubahan" : "Simpan Produk";
    }
  });
```

- [ ] **Step 8: Manual test**

1. Log in, go to `/dashboard-produk`. Add a new product with a Shopee link (e.g. `https://shopee.co.id/test`) and no Tokopedia link. Expected: saves successfully, appears in the list.
2. Try adding another product with Shopee link `shopee.co.id/test` (missing `https://`). Expected: red error "Link Shopee harus diawali https://" BEFORE any network call — the product must NOT be saved (check by reloading the list, it shouldn't appear).
3. Click "Edit" on the product from step 1. Expected: page scrolls to the form, title becomes "Edit Produk", all fields (including the Shopee link) are pre-filled, submit button says "Simpan Perubahan", a "Batal Edit" button appears next to it.
4. Add a Tokopedia link in the now-pre-filled form, change nothing else (don't pick a new photo), click "Simpan Perubahan". Expected: success message, form returns to "Tambah Produk" mode (empty), the edited product in the list still shows its ORIGINAL photo (not blank/broken) and now has both links saved (verify by clicking "Edit" on it again — both link fields should be pre-filled this time).
5. Click "Edit" on any product, then click "Batal Edit" without submitting. Expected: form clears and returns to "Tambah Produk" mode, and the product's data is unchanged (re-open "Edit" on it to confirm nothing was altered).

- [ ] **Step 9: Commit**

```bash
git add dashboard-produk.html
git commit -m "Add Shopee/Tokopedia link fields and product edit mode to dashboard-produk.html"
```

---

### Task 3: Katalog publik — tombol Shopee/Tokopedia berdampingan

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: Task 1's `produk.shopee_link`/`produk.tokopedia_link` columns. Consumes the existing `escapeHtml`, `waLink(produk)`, `renderProdukCard(p)`, `loadKatalogProduk()` functions already in `index.html`.
- Produces: nothing — last task in this plan.

- [ ] **Step 1: Fetch the new columns**

Find the `loadKatalogProduk()` function's Supabase `.select(...)` call:

```javascript
      supabaseClient
        .from("produk")
        .select("id, nama, kategori, harga, deskripsi, image_url, upt:upt_id (nama, whatsapp)")
        .eq("status", "aktif")
        .order("created_at", { ascending: false }),
```

Replace the column list so it also includes `shopee_link, tokopedia_link` (keep everything else the same):

```javascript
      supabaseClient
        .from("produk")
        .select("id, nama, kategori, harga, deskripsi, image_url, shopee_link, tokopedia_link, upt:upt_id (nama, whatsapp)")
        .eq("status", "aktif")
        .order("created_at", { ascending: false }),
```

(This is inside a `Promise.all([...])` call alongside a `loadUnitsSold()` call from earlier work — only change the `produk` query's select list, leave the rest of that `Promise.all` untouched.)

- [ ] **Step 2: Replace the single WhatsApp-or-fallback button with a multi-button renderer**

Find `renderProdukCard(p)`. It currently computes a `waButton` variable (a WhatsApp link or a fallback `<p>`) and interpolates `${waButton}` into the returned template. Find this exact block:

```javascript
  function renderProdukCard(p) {
    const link = waLink(p);
    const waButton = link
      ? `<a class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-white text-sm font-bold transition-all shadow-sm" href="${escapeHtml(link)}" rel="noopener noreferrer" target="_blank">Pesan via WhatsApp Langsung</a>`
      : `<p class="text-xs text-outline italic px-1">Nomor WA belum tersedia, hubungi Divisi Pemasyarakatan Kanwil Jabar.</p>`;
```

Replace it with:

```javascript
  function renderActionButtons(p) {
    const buttons = [];
    const waUrl = waLink(p);
    if (waUrl) {
      buttons.push(`<a class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-white text-sm font-bold transition-all shadow-sm" href="${escapeHtml(waUrl)}" rel="noopener noreferrer" target="_blank">Pesan via WhatsApp Langsung</a>`);
    }
    if (p.shopee_link) {
      buttons.push(`<a class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#EE4D2D] hover:bg-[#d8431f] text-white text-sm font-bold transition-all shadow-sm" href="${escapeHtml(p.shopee_link)}" rel="noopener noreferrer" target="_blank">Beli di Shopee</a>`);
    }
    if (p.tokopedia_link) {
      buttons.push(`<a class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#03AC0E] hover:bg-[#029a0c] text-white text-sm font-bold transition-all shadow-sm" href="${escapeHtml(p.tokopedia_link)}" rel="noopener noreferrer" target="_blank">Beli di Tokopedia</a>`);
    }

    if (buttons.length === 0) {
      return `<p class="text-xs text-outline italic px-1">Nomor WA belum tersedia, hubungi Divisi Pemasyarakatan Kanwil Jabar.</p>`;
    }
    return `<div class="flex flex-col gap-2">${buttons.join("")}</div>`;
  }

  function renderProdukCard(p) {
    const actionButtons = renderActionButtons(p);
```

Then find where the old `${waButton}` was interpolated further down in the same function's returned template string, and change it to `${actionButtons}`.

- [ ] **Step 3: Manual test**

1. Open `/` (public catalog). Confirm the product edited in Task 2 (which now has both a Shopee and a Tokopedia link, plus possibly a WhatsApp number from its UPT) shows up to 3 buttons stacked vertically: WhatsApp (green), Shopee (orange, "Beli di Shopee"), Tokopedia (dark green, "Beli di Tokopedia").
2. Click the Shopee button. Expected: opens the exact URL you entered, in a new tab.
3. Click the Tokopedia button. Expected: same, opens that exact URL in a new tab.
4. Find or create a product with NONE of the three (no UPT WhatsApp number, no Shopee link, no Tokopedia link). Expected: shows the fallback text, no buttons, no broken/empty button shells.
5. Find a product with exactly one of the three set. Expected: exactly one button shows, not three with two disabled/greyed out.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Show per-product Shopee/Tokopedia buttons on public catalog alongside WhatsApp"
```

---

## Final Verification (after all 3 tasks)

- [ ] Log in as a UPT, add a product with only a Tokopedia link, confirm it appears correctly in the catalog with just that one button. Edit it to add a Shopee link too, confirm the catalog now shows both.
- [ ] Push all commits: `git push origin main`, confirm Vercel redeploys and the live site reflects every change in this plan.
