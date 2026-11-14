function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function initialsFromKode(kode) {
  return kode ? kode.slice(-3) : "UPT";
}

function renderUptRow(upt, index) {
  const nama = escapeHtml(upt.nama);
  const wilayah = escapeHtml(upt.wilayah || "-");
  const kode = escapeHtml(upt.kode || "");
  const adminActionsHtml = (typeof window.renderSuperAdminUptActions === "function")
    ? window.renderSuperAdminUptActions(upt)
    : "";
  return `
    <tr class="hover:bg-blue-50/40 transition-colors group" data-upt-row="${upt.id}" data-order="${index}" data-omzet="0">
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
        <button class="detail-upt-btn px-2.5 py-1 rounded-lg bg-surface-container hover:bg-primary hover:text-white text-slate-700 text-[11px] font-bold transition border border-border-subtle" data-upt-id="${upt.id}" data-upt-nama="${nama}" data-upt-kode="${kode}">Detail</button>${adminActionsHtml}
      </td>
    </tr>`;
}

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
  const tbody = document.getElementById("upt-table-body");
  if (!tbody) return;
  const { data, error } = await supabaseClient
    .from("upt")
    .select("id, kode, nama, kelas, wilayah, status, locked")
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
    supabaseClient.from("transaksi_penjualan").select("upt_id, produk_id, jumlah, total_harga, channel, tanggal_transaksi"),
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
  window.__uptAggregateData = { produkList, transaksiList };
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
      if (topProdukNama) {
        komoditasCell.innerHTML = `<span class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-800 border border-slate-200">${escapeHtml(topProdukNama)}</span>`;
      } else if (ownTransaksi.length > 0) {
        komoditasCell.innerHTML = `<span class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-500 italic border border-slate-200">Produk sudah dihapus</span>`;
      } else {
        komoditasCell.innerHTML = `<span class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-500 border border-slate-200">Belum ada penjualan</span>`;
      }
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

    row.dataset.omzet = String(omzet);
  });

  applyUptTableView();
}

let sortByOmzet = false;

function applyUptTableView() {
  const tbody = document.getElementById("upt-table-body");
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll("tr[data-upt-row]"));
  if (rows.length === 0) return;

  rows.sort((a, b) =>
    sortByOmzet
      ? Number(b.dataset.omzet || 0) - Number(a.dataset.omzet || 0)
      : Number(a.dataset.order || 0) - Number(b.dataset.order || 0)
  );
  rows.forEach((row) => tbody.appendChild(row));

  const query = (document.getElementById("upt-search-input")?.value || "").trim().toLowerCase();
  let visibleCount = 0;
  rows.forEach((row) => {
    const match = !query || row.textContent.toLowerCase().includes(query);
    row.style.display = match ? "" : "none";
    if (match) visibleCount++;
  });

  let emptyRow = tbody.querySelector("tr[data-empty-state]");
  if (visibleCount === 0) {
    if (!emptyRow) {
      emptyRow = document.createElement("tr");
      emptyRow.setAttribute("data-empty-state", "true");
      emptyRow.innerHTML = '<td colspan="5" class="py-6 px-3 text-center text-slate-400">Tidak ada UPT yang cocok dengan pencarian.</td>';
      tbody.appendChild(emptyRow);
    }
    emptyRow.style.display = "";
  } else if (emptyRow) {
    emptyRow.style.display = "none";
  }
}

function openDetailModal(uptId, uptNama, uptKode) {
  const modal = document.getElementById("detail-modal");
  const body = document.getElementById("detail-modal-body");
  const footer = document.getElementById("detail-modal-footer");
  if (!modal || !body) return;

  document.getElementById("detail-modal-nama").textContent = uptNama;
  document.getElementById("detail-modal-kode").textContent = uptKode ? `Kode Satker ${uptKode}` : "-";

  modal.classList.remove("hidden");
  modal.classList.add("flex");

  const data = window.__uptAggregateData;
  if (!data) {
    body.innerHTML = '<p class="text-sm text-slate-400 text-center py-6">Memuat data transaksi...</p>';
    footer.innerHTML = "";
    setTimeout(() => {
      if (!modal.classList.contains("hidden")) openDetailModal(uptId, uptNama, uptKode);
    }, 300);
    return;
  }

  const { produkList, transaksiList } = data;
  const namaProdukById = new Map(produkList.map((p) => [p.id, p.nama]));
  const rows = transaksiList
    .filter((t) => t.upt_id === uptId)
    .sort((a, b) => String(b.tanggal_transaksi || "").localeCompare(String(a.tanggal_transaksi || "")));

  if (rows.length === 0) {
    body.innerHTML = '<p class="text-sm text-slate-400 text-center py-6">Belum ada transaksi tercatat untuk UPT ini.</p>';
    footer.innerHTML = "";
    return;
  }

  body.innerHTML = `
    <table class="w-full text-left text-xs border-collapse">
      <thead class="sticky top-0 bg-white">
        <tr class="text-slate-500 font-extrabold uppercase tracking-wider text-[10px] border-b border-border-subtle">
          <th class="py-2 pr-3">Tanggal</th>
          <th class="py-2 pr-3">Produk</th>
          <th class="py-2 pr-3 text-right">Jumlah</th>
          <th class="py-2 pr-3 text-right">Total</th>
          <th class="py-2">Channel</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border-subtle/70">
        ${rows.map((t) => {
          const namaProduk = t.produk_id ? namaProdukById.get(t.produk_id) : null;
          const produkCell = namaProduk
            ? escapeHtml(namaProduk)
            : '<span class="text-slate-400 italic">Produk sudah dihapus</span>';
          return `
            <tr>
              <td class="py-2.5 pr-3 whitespace-nowrap">${escapeHtml(t.tanggal_transaksi || "-")}</td>
              <td class="py-2.5 pr-3">${produkCell}</td>
              <td class="py-2.5 pr-3 text-right">${Number(t.jumlah || 0).toLocaleString("id-ID")}</td>
              <td class="py-2.5 pr-3 text-right font-semibold text-primary">${formatRupiah(t.total_harga || 0)}</td>
              <td class="py-2.5">${escapeHtml(t.channel || "-")}</td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>`;

  const totalUnit = rows.reduce((sum, t) => sum + Number(t.jumlah || 0), 0);
  const totalOmzet = rows.reduce((sum, t) => sum + Number(t.total_harga || 0), 0);
  footer.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-slate-600">${rows.length.toLocaleString("id-ID")} transaksi &middot; ${totalUnit.toLocaleString("id-ID")} unit</span>
      <span class="font-extrabold text-primary">${formatRupiah(totalOmzet)}</span>
    </div>`;
}

function closeDetailModal() {
  const modal = document.getElementById("detail-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("upt-search-input")?.addEventListener("input", applyUptTableView);

  document.getElementById("upt-sort-btn")?.addEventListener("click", () => {
    sortByOmzet = !sortByOmzet;
    const btn = document.getElementById("upt-sort-btn");
    const label = document.getElementById("upt-sort-label");
    if (label) label.textContent = sortByOmzet ? "Urutan Nama" : "Omzet Tertinggi";
    if (btn) {
      btn.classList.toggle("bg-primary", sortByOmzet);
      btn.classList.toggle("text-white", sortByOmzet);
      btn.classList.toggle("bg-surface-container", !sortByOmzet);
      btn.classList.toggle("text-primary", !sortByOmzet);
    }
    applyUptTableView();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".detail-upt-btn");
    if (btn) {
      openDetailModal(btn.dataset.uptId, btn.dataset.uptNama, btn.dataset.uptKode);
      return;
    }
    if (e.target.closest("#detail-modal-close") || e.target.id === "detail-modal-backdrop") {
      closeDetailModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetailModal();
  });

  loadKpiCards();
  loadUptTable();
  loadMonitoringAggregates();
});
