async function loadAnalyticsTab() {
  const [{ data: uptList }, { data: transaksi }, { data: produk }] = await Promise.all([
    supabaseClient.from("upt").select("id, nama, wilayah"),
    supabaseClient.from("transaksi_penjualan").select("upt_id, produk_id, jumlah, total_harga"),
    supabaseClient.from("produk").select("id, kategori, status"),
  ]);

  if (!uptList || !transaksi || !produk) return;

  const produkById = new Map(produk.map((p) => [p.id, p]));

  const perUpt = new Map();
  uptList.forEach((u) => perUpt.set(u.id, { nama: u.nama, wilayah: u.wilayah, omzet: 0, volume: 0 }));
  transaksi.forEach((t) => {
    const entry = perUpt.get(t.upt_id);
    if (!entry) return;
    entry.omzet += Number(t.total_harga) || 0;
    entry.volume += Number(t.jumlah) || 0;
  });

  const ranking = Array.from(perUpt.values()).sort((a, b) => b.omzet - a.omzet);
  document.getElementById("analytics-ranking-body").innerHTML = ranking.map((u, i) => `
    <tr><td class="py-2 font-bold">${i + 1}</td><td class="py-2">${escapeHtml(u.nama)}</td><td class="py-2 text-right font-bold">${formatRupiah(u.omzet)}</td><td class="py-2 text-right">${u.volume}</td></tr>
  `).join("");

  const perWilayah = new Map();
  uptList.forEach((u) => {
    const key = u.wilayah || "Tanpa Wilayah";
    if (!perWilayah.has(key)) perWilayah.set(key, { omzet: 0, jumlahUpt: 0 });
    perWilayah.get(key).jumlahUpt += 1;
  });
  transaksi.forEach((t) => {
    const u = perUpt.get(t.upt_id);
    if (!u) return;
    const key = u.wilayah || "Tanpa Wilayah";
    perWilayah.get(key).omzet += Number(t.total_harga) || 0;
  });
  document.getElementById("analytics-wilayah-body").innerHTML = Array.from(perWilayah.entries())
    .sort((a, b) => b[1].omzet - a[1].omzet)
    .map(([wilayah, data]) => `<tr><td class="py-2">${escapeHtml(wilayah)}</td><td class="py-2 text-right font-bold">${formatRupiah(data.omzet)}</td><td class="py-2 text-right">${data.jumlahUpt}</td></tr>`)
    .join("");

  const perKategori = new Map();
  transaksi.forEach((t) => {
    const p = produkById.get(t.produk_id);
    const kategori = p?.kategori || "Tanpa Kategori";
    if (!perKategori.has(kategori)) perKategori.set(kategori, { volume: 0, omzet: 0 });
    perKategori.get(kategori).volume += Number(t.jumlah) || 0;
    perKategori.get(kategori).omzet += Number(t.total_harga) || 0;
  });
  document.getElementById("analytics-kategori-body").innerHTML = Array.from(perKategori.entries())
    .sort((a, b) => b[1].omzet - a[1].omzet)
    .map(([kategori, data]) => `<tr><td class="py-2">${escapeHtml(kategori)}</td><td class="py-2 text-right">${data.volume}</td><td class="py-2 text-right font-bold">${formatRupiah(data.omzet)}</td></tr>`)
    .join("");
}
