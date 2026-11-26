// Pengelompokan UPT ke dalam 6 Koordinator Wilayah (Korwil) Jawa Barat.
//
// Kolom `upt.wilayah` di database berisi nama kabupaten/kota (19 nilai
// berbeda), bukan korwil. Pemetaan ini mengelompokkannya menjadi 6 korwil
// yang dipakai dalam koordinasi Kanwil.
//
// Disimpan sebagai pemetaan di sisi tampilan, bukan kolom baru di database,
// supaya tidak menambah migrasi SQL yang harus dijalankan lebih dulu. Kalau
// suatu saat korwil perlu dipakai untuk kueri atau laporan di sisi server,
// pemetaan ini tinggal dipindahkan menjadi kolom `upt.korwil`.

window.Korwil = (function () {
  "use strict";

  // Urutan tampilan mengikuti urutan yang dipakai Kanwil dalam surat koordinasi.
  const DAFTAR = [
    "Bandung Raya",
    "Priangan Timur",
    "Ciayumajakuning",
    "Cipurwabesuka",
    "Bogor Raya",
    "Suci Raya",
  ];

  const PETA = {
    // Bandung Raya
    "bandung": "Bandung Raya",
    "sumedang": "Bandung Raya",
    // Priangan Timur
    "garut": "Priangan Timur",
    "tasikmalaya": "Priangan Timur",
    "ciamis": "Priangan Timur",
    "kota banjar": "Priangan Timur",
    "banjar": "Priangan Timur",
    // Ciayumajakuning
    "cirebon": "Ciayumajakuning",
    "indramayu": "Ciayumajakuning",
    "majalengka": "Ciayumajakuning",
    "kuningan": "Ciayumajakuning",
    // Cipurwabesuka
    "cikarang": "Cipurwabesuka",
    "purwakarta": "Cipurwabesuka",
    "bekasi": "Cipurwabesuka",
    "subang": "Cipurwabesuka",
    "karawang": "Cipurwabesuka",
    // Bogor Raya
    "bogor": "Bogor Raya",
    "depok": "Bogor Raya",
    // Suci Raya
    "sukabumi": "Suci Raya",
    "cianjur": "Suci Raya",
  };

  // Mengembalikan nama korwil, atau null kalau nilai wilayahnya tidak dikenal.
  // null sengaja tidak diubah menjadi "Lainnya": UPT yang wilayahnya belum
  // diisi atau diketik dengan ejaan lain sebaiknya terlihat sebagai data yang
  // perlu dibereskan, bukan disembunyikan dalam kelompok serba-ada.
  function dari(wilayah) {
    if (!wilayah) return null;
    return PETA[String(wilayah).trim().toLowerCase()] || null;
  }

  return { DAFTAR, dari };
})();
