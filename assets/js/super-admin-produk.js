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
          <button class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 text-[11px] font-bold border border-rose-200" onclick="window.toggleProdukStatus('${p.id}', '${p.status}')">${toggleLabel}</button>
          <button class="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 text-[11px] font-bold border border-blue-200" onclick="window.openGantiFotoModal('${p.id}', '${p.upt_id}')">Ganti Foto</button>
        </td>
      </tr>`;
  }).join("") || `<tr><td colspan="7" class="py-6 text-center text-slate-400">Tidak ada produk yang cocok.</td></tr>`;

  if (__produkPage === 0) tbody.innerHTML = rowsHtml;
  else tbody.insertAdjacentHTML("beforeend", rowsHtml);

  document.getElementById("produk-load-more").style.display = data.length < __produkPageSize ? "none" : "inline-block";
}

window.toggleProdukStatus = async function (produkId, currentStatus) {
  const newStatus = currentStatus === "nonaktif" ? "aktif" : "nonaktif";
  if (!confirm(`Yakin ingin mengubah status produk ini jadi "${newStatus}"?`)) return;

  const { data: currentProduk, error: fetchError } = await supabaseClient.from("produk").select("image_url").eq("id", produkId).single();
  if (fetchError) {
    alert("Gagal memuat data produk terbaru: " + fetchError.message);
    return;
  }

  const { error } = await supabaseClient.rpc("admin_update_produk", {
    p_produk_id: produkId,
    p_status: newStatus,
    p_image_url: currentProduk.image_url,
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

        const { data: currentProduk } = await supabaseClient.from("produk").select("status").eq("id", produkId).single();

        const { error: rpcError } = await supabaseClient.rpc("admin_update_produk", {
          p_produk_id: produkId,
          p_status: currentProduk.status,
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
