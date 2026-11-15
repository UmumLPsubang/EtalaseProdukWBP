let __transaksiPage = 0;
const __transaksiPageSize = 50;
let __transaksiUptOptionsLoaded = false;

async function loadTransaksiTab() {
  __transaksiPage = 0;
  document.getElementById("transaksi-table-body").innerHTML = "";

  if (!__transaksiUptOptionsLoaded) {
    const { data: uptList } = await supabaseClient.from("upt").select("id, nama").order("nama");
    const select = document.getElementById("transaksi-filter-upt");
    (uptList || []).forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.nama;
      select.appendChild(opt);
    });
    __transaksiUptOptionsLoaded = true;
  }

  await loadTransaksiPage();
}

async function loadTransaksiPage() {
  let query = supabaseClient
    .from("transaksi_penjualan")
    .select("id, tanggal_transaksi, jumlah, total_harga, channel, upt_id, produk_id, upt:upt_id (nama), produk:produk_id (nama)")
    .order("tanggal_transaksi", { ascending: false })
    .range(__transaksiPage * __transaksiPageSize, __transaksiPage * __transaksiPageSize + __transaksiPageSize - 1);

  const uptId = document.getElementById("transaksi-filter-upt").value;
  const channel = document.getElementById("transaksi-filter-channel").value;
  const dari = document.getElementById("transaksi-filter-dari").value;
  const sampai = document.getElementById("transaksi-filter-sampai").value;

  if (uptId) query = query.eq("upt_id", uptId);
  if (channel) query = query.eq("channel", channel);
  if (dari) query = query.gte("tanggal_transaksi", dari);
  if (sampai) query = query.lte("tanggal_transaksi", sampai);

  const { data, error } = await query;
  if (error) {
    console.error("Gagal memuat transaksi:", error);
    return;
  }

  const search = (document.getElementById("transaksi-search").value || "").trim().toLowerCase();
  const filtered = search
    ? data.filter((t) => (t.upt?.nama || "").toLowerCase().includes(search) || (t.produk?.nama || "").toLowerCase().includes(search))
    : data;

  const tbody = document.getElementById("transaksi-table-body");
  const rowsHtml = filtered.map((t) => {
    const produkLabel = t.produk?.nama
      ? escapeHtml(t.produk.nama)
      : `<span class="italic text-slate-400">Produk sudah dihapus</span>`;
    return `
      <tr>
        <td class="py-2.5 px-3.5">${escapeHtml(t.tanggal_transaksi)}</td>
        <td class="py-2.5 px-3">${escapeHtml(t.upt?.nama || "-")}</td>
        <td class="py-2.5 px-3">${produkLabel}</td>
        <td class="py-2.5 px-3 text-right">${t.jumlah}</td>
        <td class="py-2.5 px-3 text-right font-bold">${formatRupiah(t.total_harga)}</td>
        <td class="py-2.5 px-3">${escapeHtml(t.channel || "-")}</td>
        <td class="py-2.5 px-3.5 text-center">
          <button class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 text-[11px] font-bold border border-rose-200" onclick="window.deleteTransaksi('${t.id}')">Hapus</button>
        </td>
      </tr>`;
  }).join("");

  if (__transaksiPage === 0) tbody.innerHTML = rowsHtml;
  else tbody.insertAdjacentHTML("beforeend", rowsHtml);

  document.getElementById("transaksi-load-more").style.display = data.length < __transaksiPageSize ? "none" : "inline-block";
}

window.deleteTransaksi = async function (transaksiId) {
  if (!confirm("Hapus transaksi ini secara permanen? Aksi ini dicatat di log admin.")) return;
  const { error } = await supabaseClient.rpc("admin_delete_transaksi", { p_transaksi_id: transaksiId });
  if (error) {
    alert("Gagal menghapus: " + error.message);
    return;
  }
  __transaksiPage = 0;
  await loadTransaksiPage();
};

document.addEventListener("DOMContentLoaded", () => {
  ["transaksi-filter-upt", "transaksi-filter-channel", "transaksi-filter-dari", "transaksi-filter-sampai"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => { __transaksiPage = 0; loadTransaksiPage(); });
  });
  document.getElementById("transaksi-search")?.addEventListener("input", () => { __transaksiPage = 0; loadTransaksiPage(); });
  document.getElementById("transaksi-load-more")?.addEventListener("click", () => { __transaksiPage += 1; loadTransaksiPage(); });
});
