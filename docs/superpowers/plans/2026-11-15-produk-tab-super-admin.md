# Produk Tab (Super Admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5th tab "Produk" to the Super Admin Kanwil dashboard so Kanwil can see every product registered across all 33 UPT in one table, deactivate/reactivate problem products, and replace a product's photo — without contacting the owning UPT.

**Architecture:** Plain static HTML + Tailwind CDN + vanilla JS, matching every other tab in this dashboard. A new Postgres `SECURITY DEFINER` RPC (`admin_update_produk`) handles privileged writes with audit logging, mirroring the existing `admin_update_upt` pattern. A new Storage RLS policy lets the `super_admin` role upload to any UPT's image folder (the existing policy restricts uploads to the uploader's own UPT folder).

**Tech Stack:** Supabase (Postgres + Storage), `@supabase/supabase-js@2.45.4` UMD via CDN, Tailwind CDN, vanilla JS.

## Global Constraints

- No build step, no framework — plain `<script src>` files, matching every existing page in this repo.
- Never put the Supabase secret/service-role key in any `.html` or `/assets/js/*.js` file.
- Every privileged write (status toggle, photo replace) must insert a row into `admin_activity_log` recording what changed — same rule as the rest of this dashboard.
- Follow existing UI conventions: `escapeHtml()`-wrap any DB value before injecting into `innerHTML`, `confirm()` browser dialog before the status-toggle action, Tailwind classes/colors matching the other tabs (`primary`/`primary-container`/`border-subtle`, status badges styled like Kelola UPT's).
- Do not modify or weaken any existing RLS/Storage policy for the `'upt'` role — only add new policy/RPC surface for `'super_admin'`.
- Scope is fixed per the approved spec: **view + activate/deactivate + replace photo only**. Do not add edit-other-fields or permanent-delete — those stay UPT-only.

---

## File Structure

**Modify:** `docs/supabase-super-admin-schema.sql` — append the new RPC and Storage policy to the existing migration file (it has not been superseded; the project runs migrations by re-pasting the whole file, confirmed idempotent by the earlier fix round, so appending here keeps one source of truth instead of creating a second migration file).

**Modify:** `super-admin-dashboard.html` — add a 5th tab button (`data-tab="produk"`), a 5th panel div (`data-panel="produk"`), a new script tag, and extend the existing `window.onTabActivated` function with an `if (tabName === "produk") loadProdukTab();` branch (ADD to the function body — Tasks in the prior plan already extended this function 3 times; do not overwrite it).

**Create:** `assets/js/super-admin-produk.js` — table load/filter/search/pagination, toggle-status action, change-photo modal + upload.

---

### Task 1: Database — admin_update_produk RPC + Storage policy for cross-UPT photo upload

**Files:**
- Modify: `docs/supabase-super-admin-schema.sql` (append to the end of the file)

**Interfaces:**
- Produces: RPC `admin_update_produk(p_produk_id uuid, p_status text, p_image_url text)` returning `void`.
- Produces: Storage policy allowing `authenticated` role to INSERT into bucket `produk-images` when `is_super_admin()` is true, independent of folder name (the existing UPT policy restricts by folder-equals-own-upt_id; this one has no folder restriction).

- [ ] **Step 1: Read the current end of the file**

Open `docs/supabase-super-admin-schema.sql` and read its last ~20 lines to confirm the exact final statement (it currently ends with `grant execute on function admin_delete_transaksi(uuid) to authenticated;` plus the fix-round additions — the not-found guard and the idempotency guards from the final review). Append after that, do not insert in the middle.

- [ ] **Step 2: Append the new SQL**

```sql

-- ============================================
-- Tambahan: Tab Produk Super Admin — toggle status + ganti foto lintas-UPT.
-- Ditambahkan ke file migrasi yang sama; jalankan ulang seluruh file ini
-- di Supabase SQL Editor (idempotent — aman dijalankan ulang).
-- ============================================

-- RPC: super admin mengubah status (aktif/nonaktif) dan/atau foto produk
-- milik UPT mana pun. Field lain (nama/harga/kategori/deskripsi) sengaja
-- TIDAK bisa diubah lewat RPC ini -- itu tetap wewenang UPT pemilik saja,
-- sesuai scope yang disetujui (lihat spec 2026-11-15-produk-tab-super-admin-design.md).
create or replace function admin_update_produk(
  p_produk_id uuid,
  p_status text,
  p_image_url text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if not is_super_admin() then
    raise exception 'Hanya super admin yang bisa mengubah produk';
  end if;

  select to_jsonb(p) into v_before from produk p where p.id = p_produk_id;

  if v_before is null then
    raise exception 'Produk tidak ditemukan';
  end if;

  update produk
  set status = p_status,
      image_url = p_image_url
  where id = p_produk_id;

  insert into admin_activity_log (admin_id, action, target_type, target_id, changes)
  values (
    auth.uid(), 'edit_produk', 'produk', p_produk_id,
    jsonb_build_object(
      'before', v_before,
      'after', jsonb_build_object('status', p_status, 'image_url', p_image_url)
    )
  );
end;
$$;

grant execute on function admin_update_produk(uuid, text, text) to authenticated;

-- Storage: super admin bisa upload foto ke folder UPT mana pun (bukan cuma
-- folder sendiri -- super admin tidak punya upt_id). Policy UPT yang sudah
-- ada (folder harus sama dengan upt_id pengunggah) tidak diubah atau
-- dipersempit oleh policy baru ini.
drop policy if exists "Super admin bisa upload foto ke folder UPT manapun" on storage.objects;

create policy "Super admin bisa upload foto ke folder UPT manapun" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'produk-images'
    and is_super_admin()
  );
```

- [ ] **Step 3: Relay to the human — run the SQL**

This SQL has never been executed against a live database and you have no Supabase credentials in this environment — you cannot run it. Note in your report that the project owner must paste the ENTIRE `docs/supabase-super-admin-schema.sql` file (not just the new appended part) into Supabase Dashboard → SQL Editor → New Query → Run. Because every statement in the file is idempotent (confirmed by an earlier fix round for the first half of the file, and this new append uses `create or replace function`, `drop policy if exists` + `create policy`, both safe to re-run), re-running the whole file is safe and simpler than asking the owner to paste just a fragment.

- [ ] **Step 4: Commit**

```bash
git add docs/supabase-super-admin-schema.sql
git commit -m "Add admin_update_produk RPC and cross-UPT photo upload policy"
```

---

### Task 2: Produk tab — table, filters, pagination, status toggle, change-photo modal

**Files:**
- Modify: `super-admin-dashboard.html` (add tab button, panel markup, script tag, extend `window.onTabActivated`)
- Create: `assets/js/super-admin-produk.js`

**Interfaces:**
- Consumes: `escapeHtml()`, `formatRupiah()` (from `assets/js/super-admin-dashboard.js`); `admin_update_produk` RPC (Task 1); Supabase Storage bucket `produk-images` (existing).
- Produces: `function loadProdukTab()` (called when the Produk tab is activated, resets pagination and re-fetches).

- [ ] **Step 1: Read current state before editing**

Read `super-admin-dashboard.html` in full to find: the existing tab-button `<nav>` block (4 buttons), the existing 4 panel `<div>`s, the existing script tags in order, and the current full body of the bootstrap script's `window.onTabActivated` function (it has 3 branches from earlier tasks: `kelola-upt`, `transaksi`, `analytics`, plus the unconditional `loadKelolaUptTable();` call added by the final review fix — do not remove or reorder any of this).

- [ ] **Step 2: Add the 5th tab button**

In the `<nav>` block containing the 4 existing `data-tab` buttons, add a 5th button after the "Analytics" one, matching the exact class list and markup pattern of its siblings:
```html
<button data-tab="produk" class="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all text-on-surface-variant hover:text-primary hover:bg-white">Produk</button>
```

- [ ] **Step 3: Add the 5th panel markup**

After the existing `<div id="panel-analytics" ...>` block's closing tag, add:
```html
<div id="panel-produk" data-panel="produk" class="space-y-6 hidden">
  <div class="bg-white rounded-2xl p-6 shadow-sm border border-border-subtle">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
      <h2 class="font-bold text-lg text-primary">Produk Seluruh UPT</h2>
      <div class="flex flex-wrap items-center gap-2">
        <input id="produk-search" type="text" placeholder="Cari produk/UPT..." class="bg-surface-container px-3 py-1.5 rounded-xl border border-border-subtle text-xs font-semibold outline-none w-48">
        <select id="produk-filter-upt" class="bg-surface-container px-3 py-1.5 rounded-xl border border-border-subtle text-xs font-semibold outline-none"><option value="">Semua UPT</option></select>
        <select id="produk-filter-kategori" class="bg-surface-container px-3 py-1.5 rounded-xl border border-border-subtle text-xs font-semibold outline-none"><option value="">Semua Kategori</option></select>
        <select id="produk-filter-status" class="bg-surface-container px-3 py-1.5 rounded-xl border border-border-subtle text-xs font-semibold outline-none">
          <option value="">Semua Status</option>
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
        </select>
      </div>
    </div>
    <div class="overflow-x-auto rounded-xl border border-border-subtle/80">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="bg-surface-container"><tr class="text-slate-700 font-extrabold uppercase tracking-wider text-[11px]">
          <th class="py-3 px-3.5">Foto</th><th class="py-3 px-3">Nama Produk</th><th class="py-3 px-3">UPT Pemilik</th>
          <th class="py-3 px-3">Kategori</th><th class="py-3 px-3 text-right">Harga</th><th class="py-3 px-3">Status</th><th class="py-3 px-3.5 text-center">Aksi</th>
        </tr></thead>
        <tbody id="produk-table-body" class="divide-y divide-border-subtle/70 bg-white"></tbody>
      </table>
    </div>
    <div class="flex justify-center mt-4">
      <button id="produk-load-more" class="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-sm">Muat lebih banyak</button>
    </div>
  </div>
</div>

<div id="ganti-foto-modal" class="hidden fixed inset-0 z-[100] items-center justify-center p-4">
  <div class="absolute inset-0 bg-black/50" onclick="document.getElementById('ganti-foto-modal').classList.add('hidden')"></div>
  <div class="relative bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
    <h3 class="font-bold text-base text-primary">Ganti Foto Produk</h3>
    <input type="hidden" id="ganti-foto-produk-id">
    <input type="hidden" id="ganti-foto-upt-id">
    <input id="ganti-foto-input" type="file" accept="image/*" class="w-full text-xs">
    <div id="ganti-foto-preview" class="hidden"><img class="w-full h-40 object-contain rounded-lg border border-border-subtle" alt="Preview"></div>
    <div id="ganti-foto-message" class="hidden text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"></div>
    <div class="flex gap-2 pt-2">
      <button type="button" onclick="document.getElementById('ganti-foto-modal').classList.add('hidden')" class="flex-1 py-2.5 rounded-lg bg-surface-container text-slate-700 font-bold text-sm">Batal</button>
      <button type="button" id="ganti-foto-submit" class="flex-1 py-2.5 rounded-lg bg-primary-container text-white font-bold text-sm">Upload</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Extend `window.onTabActivated` and add the script tag**

In the bootstrap script, add one more line inside the existing `window.onTabActivated` function body (do not touch its other branches):
```javascript
if (tabName === "produk") loadProdukTab();
```
Add `<script src="/assets/js/super-admin-produk.js"></script>` alongside the other tab script tags (after `super-admin-analytics.js`).

- [ ] **Step 5: Write `assets/js/super-admin-produk.js`**

```javascript
let __produkPage = 0;
const __produkPageSize = 50;
let __produkFilterOptionsLoaded = false;

async function loadProdukTab() {
  __produkPage = 0;
  document.getElementById("produk-table-body").innerHTML = "";

  if (!__produkFilterOptionsLoaded) {
    const [{ data: uptList }, { data: produkList }] = await Promise.all([
      supabaseClient.from("upt").select("id, nama").order("nama"),
      supabaseClient.from("produk").select("kategori"),
    ]);

    const uptSelect = document.getElementById("produk-filter-upt");
    (uptList || []).forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.nama;
      uptSelect.appendChild(opt);
    });

    const kategoriSet = new Set((produkList || []).map((p) => p.kategori).filter(Boolean));
    const kategoriSelect = document.getElementById("produk-filter-kategori");
    Array.from(kategoriSet).sort().forEach((kategori) => {
      const opt = document.createElement("option");
      opt.value = kategori;
      opt.textContent = kategori;
      kategoriSelect.appendChild(opt);
    });

    __produkFilterOptionsLoaded = true;
  }

  await loadProdukPage();
}

async function loadProdukPage() {
  let query = supabaseClient
    .from("produk")
    .select("id, nama, kategori, harga, status, image_url, upt_id, upt:upt_id (nama)")
    .order("nama")
    .range(__produkPage * __produkPageSize, __produkPage * __produkPageSize + __produkPageSize - 1);

  const uptId = document.getElementById("produk-filter-upt").value;
  const kategori = document.getElementById("produk-filter-kategori").value;
  const status = document.getElementById("produk-filter-status").value;

  if (uptId) query = query.eq("upt_id", uptId);
  if (kategori) query = query.eq("kategori", kategori);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("Gagal memuat produk:", error);
    return;
  }

  const search = (document.getElementById("produk-search").value || "").trim().toLowerCase();
  const filtered = search
    ? data.filter((p) => p.nama.toLowerCase().includes(search) || (p.upt?.nama || "").toLowerCase().includes(search))
    : data;

  const tbody = document.getElementById("produk-table-body");
  const rowsHtml = filtered.map((p) => {
    const imgHtml = p.image_url
      ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.nama)}" class="w-10 h-10 rounded-lg object-cover border border-border-subtle">`
      : `<div class="w-10 h-10 rounded-lg bg-surface-container border border-border-subtle flex items-center justify-center text-slate-400 text-[10px]">N/A</div>`;
    const statusLabel = p.status === "nonaktif" ? "Nonaktif" : "Aktif";
    const statusClass = p.status === "nonaktif" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-800";
    const toggleLabel = p.status === "nonaktif" ? "Aktifkan" : "Nonaktifkan";
    return `
      <tr>
        <td class="py-2.5 px-3.5">${imgHtml}</td>
        <td class="py-2.5 px-3">${escapeHtml(p.nama)}</td>
        <td class="py-2.5 px-3">${escapeHtml(p.upt?.nama || "-")}</td>
        <td class="py-2.5 px-3">${escapeHtml(p.kategori || "-")}</td>
        <td class="py-2.5 px-3 text-right font-bold">${formatRupiah(p.harga)}</td>
        <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${statusClass}">${statusLabel}</span></td>
        <td class="py-2.5 px-3.5 text-center space-x-1">
          <button class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 text-[11px] font-bold border border-rose-200" onclick="window.toggleProdukStatus('${p.id}', '${p.status}', '${(p.image_url || "").replace(/'/g, "\\'")}')">${toggleLabel}</button>
          <button class="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 text-[11px] font-bold border border-blue-200" onclick="window.openGantiFotoModal('${p.id}', '${p.upt_id}')">Ganti Foto</button>
        </td>
      </tr>`;
  }).join("") || `<tr><td colspan="7" class="py-6 text-center text-slate-400">Tidak ada produk yang cocok.</td></tr>`;

  if (__produkPage === 0) tbody.innerHTML = rowsHtml;
  else tbody.insertAdjacentHTML("beforeend", rowsHtml);

  document.getElementById("produk-load-more").style.display = data.length < __produkPageSize ? "none" : "inline-block";
}

window.toggleProdukStatus = async function (produkId, currentStatus, currentImageUrl) {
  const newStatus = currentStatus === "nonaktif" ? "aktif" : "nonaktif";
  if (!confirm(`Yakin ingin mengubah status produk ini jadi "${newStatus}"?`)) return;

  const { error } = await supabaseClient.rpc("admin_update_produk", {
    p_produk_id: produkId,
    p_status: newStatus,
    p_image_url: currentImageUrl || null,
  });

  if (error) {
    alert("Gagal mengubah status: " + error.message);
    return;
  }
  __produkPage = 0;
  await loadProdukPage();
};

window.openGantiFotoModal = function (produkId, uptId) {
  document.getElementById("ganti-foto-produk-id").value = produkId;
  document.getElementById("ganti-foto-upt-id").value = uptId;
  document.getElementById("ganti-foto-input").value = "";
  document.getElementById("ganti-foto-preview").classList.add("hidden");
  document.getElementById("ganti-foto-message").classList.add("hidden");
  document.getElementById("ganti-foto-modal").classList.remove("hidden");
  document.getElementById("ganti-foto-modal").classList.add("flex");
};

document.addEventListener("DOMContentLoaded", () => {
  ["produk-filter-upt", "produk-filter-kategori", "produk-filter-status"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => { __produkPage = 0; loadProdukPage(); });
  });
  document.getElementById("produk-search")?.addEventListener("input", () => { __produkPage = 0; loadProdukPage(); });
  document.getElementById("produk-load-more")?.addEventListener("click", () => { __produkPage += 1; loadProdukPage(); });

  const fotoInput = document.getElementById("ganti-foto-input");
  if (fotoInput) {
    fotoInput.addEventListener("change", () => {
      const file = fotoInput.files[0];
      const preview = document.getElementById("ganti-foto-preview");
      if (!file) { preview.classList.add("hidden"); return; }
      preview.querySelector("img").src = URL.createObjectURL(file);
      preview.classList.remove("hidden");
    });
  }

  const submitBtn = document.getElementById("ganti-foto-submit");
  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      const file = document.getElementById("ganti-foto-input").files[0];
      const msg = document.getElementById("ganti-foto-message");
      msg.classList.add("hidden");

      if (!file) {
        msg.textContent = "Pilih file foto terlebih dahulu.";
        msg.classList.remove("hidden");
        return;
      }
      if (!file.type.startsWith("image/")) {
        msg.textContent = "File harus berupa gambar.";
        msg.classList.remove("hidden");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Mengupload...";

      try {
        const produkId = document.getElementById("ganti-foto-produk-id").value;
        const uptId = document.getElementById("ganti-foto-upt-id").value;
        const ext = file.name.split(".").pop();
        const path = `${uptId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: uploadError } = await supabaseClient.storage.from("produk-images").upload(path, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseClient.storage.from("produk-images").getPublicUrl(path);

        const { error: rpcError } = await supabaseClient.rpc("admin_update_produk", {
          p_produk_id: produkId,
          p_status: null,
          p_image_url: urlData.publicUrl,
        });
        if (rpcError) throw rpcError;

        document.getElementById("ganti-foto-modal").classList.add("hidden");
        __produkPage = 0;
        await loadProdukPage();
      } catch (err) {
        msg.textContent = "Gagal upload: " + err.message;
        msg.classList.remove("hidden");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Upload";
      }
    });
  }
});
```

**Note on `p_status: null` in the photo-upload path:** `admin_update_produk`'s SQL does an unconditional `set status = p_status`, so passing `null` would wipe the product's status. Before writing the upload handler, fix this: the RPC call inside the `submitBtn` click handler above must pass the product's CURRENT status, not `null`. Since the client doesn't have the current row cached at this point (only `produkId`/`uptId` are stored on the modal), fetch it first: replace the `p_status: null` line with a tiny lookup —
```javascript
const { data: currentProduk } = await supabaseClient.from("produk").select("status").eq("id", produkId).single();
```
placed right before the `supabaseClient.rpc("admin_update_produk", ...)` call, and use `p_status: currentProduk.status` in the RPC call instead of `p_status: null`. Apply this correction when writing the file — do not ship the `p_status: null` version.

- [ ] **Step 6: Manual verification**

This project has no local dev server or browser automation — manual verification happens live after deploy, by the project owner. Re-read both modified/created files once after writing them to confirm: HTML is well-formed, the `onTabActivated` function still has all 4 prior branches plus the new one, and the JS has no syntax errors (balanced braces, the `p_status` correction from Step 5 applied). Note in your report that live testing (clicking Produk tab, toggling a status, uploading a photo) is pending the human after the Task 1 migration is re-run.

- [ ] **Step 7: Commit**

```bash
git add super-admin-dashboard.html assets/js/super-admin-produk.js
git commit -m "Add Produk tab: cross-UPT product table, status toggle, photo replace"
```

---

## Spec Coverage Check

- Bagian 1 (Kemampuan & Arsitektur: RPC + Storage policy, scope limited to view/toggle/photo) → Task 1, Task 2.
- Bagian 2 (Tampilan: filters, kolom, aksi, paginasi) → Task 2.
- Di luar scope items (no edit-other-fields, no permanent delete, no old-photo cleanup) → correctly absent from both tasks; confirmed no task adds them.
- Testing section of spec → covered by Task 2 Step 6's note (live verification pending human) plus the end-to-end checklist the human runs after deploy (filter combos, toggle + activity log + public catalog effect, photo replace + activity log, non-admin RPC rejection, pagination).
