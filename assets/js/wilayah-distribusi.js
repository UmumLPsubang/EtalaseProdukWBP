// Distribusi omzet per wilayah UPT (agregat lintas 33 UPT).
// Dipakai bersama oleh dashboard Super Admin (lewat monitoring-aggregates.js,
// yang sudah punya datanya) dan halaman Penjualan UPT (lewat initWilayahDistribusi,
// yang mengambil datanya sendiri). Tidak dipakai di halaman publik.
//
// Bergantung pada escapeHtml() dan formatRupiah() yang sudah tersedia sebagai
// global di setiap halaman yang memuat file ini.

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

// Untuk halaman yang belum punya data agregat (mis. dashboard Penjualan UPT):
// ambil sendiri datanya, lalu render.
async function initWilayahDistribusi() {
  const container = document.getElementById("wilayah-distribusi-list");
  if (!container) return;

  const [transaksiResult, uptResult] = await Promise.all([
    supabaseClient.from("transaksi_penjualan").select("upt_id, total_harga"),
    supabaseClient.from("upt").select("id, wilayah"),
  ]);

  if (transaksiResult.error || uptResult.error) {
    console.error("Gagal memuat distribusi wilayah:", transaksiResult.error || uptResult.error);
    container.innerHTML = `<p class="col-span-full text-center text-slate-400 py-3">Gagal memuat distribusi wilayah.</p>`;
    return;
  }

  renderWilayahDistribusi(transaksiResult.data || [], uptResult.data || []);
}
