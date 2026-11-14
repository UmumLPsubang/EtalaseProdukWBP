# Desain: Dashboard UPT Pindah dari Sidebar ke Header Atas + Hapus Filter Mock di Monitoring

**Tanggal:** 2026-11-14
**Status:** Disetujui, siap jadi implementation plan

## Latar belakang

4 halaman dashboard UPT (`dashboard.html`, `dashboard-produk.html`, `dashboard-penjualan.html`, `dashboard-profil.html`) saat ini pakai sidebar kiri gelap. User minta diganti jadi header atas horizontal, meniru header yang sudah ada di `monitoring.html`/`index.html`, dengan 3 penyesuaian. Sekalian, filter Periode/UPT dan tombol "Unduh Rekap" di hero banner `monitoring.html` (mock, tidak fungsional) dihapus.

## Bagian 1 — Header baru untuk 4 halaman dashboard

Meniru struktur header `monitoring.html` (logo + "Karya WBP Jabar Juara" + badge "Resmi" + nav pills + badge "Portal Resmi Terverifikasi"), dengan perubahan:

- Subtitle di bawah nama brand diganti dari "Kanwil Kemenimipas Jawa Barat • 33 UPT Lapas & Rutan" jadi **nama UPT yang login** (diisi JS setelah `requireUptSession()` selesai, sama seperti sebelumnya di sidebar).
- Nav pills (tengah) isinya 4 menu: Dashboard / Produk / Penjualan / Profil UPT — digeser ke kanan (pakai `justify-end` pada container nav, atau `ml-auto`, bukan di tengah penuh seperti versi publik).
- Badge "Portal Resmi Terverifikasi" tetap ada di kanan.
- Tombol "Hotline Giatja" **dihapus**.
- Ikon person **dihapus**, diganti tombol **"Keluar"** (logout) di posisi yang sama (ujung kanan).
- `/assets/js/upt-dashboard.js`'s `renderSidebar(activePage, uptInfo)` diganti namanya jadi `renderHeader(activePage, uptInfo)` dan logikanya disesuaikan ke elemen-elemen baru (highlight nav pill yang aktif, isi nama UPT, pasang handler tombol Keluar) — fungsinya tetap dipanggil dengan pola yang sama (`requireUptSession()` lalu render).
- `<main>` di tiap halaman tidak lagi pakai `ml-64` (margin kiri untuk sidebar) — jadi full-width di bawah header (`pt-24` atau sejenisnya untuk clearance header yang fixed, konsisten dengan `monitoring.html`/`index.html` yang sudah pakai pola header fixed + `pt-20`).
- Sudah dicek: logo/brand di header asli `monitoring.html` TIDAK dibungkus link (cuma `<div>` statis). Supaya dashboard tetap punya jalan balik ke katalog publik (fungsi yang dulu dipegang link "Lihat Katalog" di sidebar), tambahkan 1 item kecil di nav pills: link "Lihat Katalog" ke "/", diletakkan di ujung kiri grup nav pills (sebelum Dashboard/Produk/Penjualan/Profil UPT), bergaya lebih netral (tanpa background pill aktif) supaya terlihat beda dari 4 menu dashboard itu sendiri.

## Bagian 2 — Hapus filter mock di `monitoring.html`

Hapus 3 elemen di hero banner `monitoring.html`: dropdown filter Periode ("Kuartal II 2025 (Berjalan)"), dropdown filter UPT ("Lapas Kelas I Sukamiskin"), dan tombol "Unduh Rekap" — ketiganya statis/tidak terhubung ke logika apa pun.

## Testing

- Login, cek semua 4 halaman dashboard tampil dengan header baru (bukan sidebar lagi), nama UPT muncul di subtitle, menu aktif ter-highlight sesuai halaman, tombol Keluar berfungsi.
- Cek `/monitoring` tidak lagi menampilkan 2 dropdown filter dan tombol Unduh Rekap.
- Cek responsif di layar kecil (header tidak pecah berantakan di mobile, konsisten dengan bagaimana `monitoring.html` menangani ini sekarang — nav disembunyikan di `md:` breakpoint kalau itu pola yang sudah ada).
