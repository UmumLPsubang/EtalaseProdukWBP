# Keputusan: Akses baca `transaksi_penjualan` tetap publik

**Tanggal:** 2026-11-14
**Status:** Berlaku sampai ada keputusan baru

## Keputusan

Tabel `transaksi_penjualan` (data penjualan 33 UPT) **tetap bisa dibaca siapa saja** lewat API publik (anon key), termasuk tanpa login — konsisten dengan tujuan awal portal ini sebagai dashboard transparansi publik (lihat `monitoring.html`: "Transparansi Transaksi Penjualan... dari 33 Lapas & Rutan se-Jawa Barat").

Ini ditinjau ulang saat final code review fitur pencatatan penjualan (lihat `docs/superpowers/plans/2026-11-14-penjualan-dashboard.md`), yang menandai ini sebagai celah keamanan karena sekarang datanya **data penjualan asli**, bukan contoh. Pemilik produk (user) memutuskan: **tetap terbuka untuk saat ini**, dicatat di sini supaya bisa diubah nanti kalau keputusan berubah.

## Permintaan tambahan yang BELUM bisa dipenuhi sepenuhnya

User juga minta: data boleh dilihat publik, tapi **tidak boleh di-export/di-bulk-download**. Secara teknis ini **tidak bisa dijamin** selama tabel ini bisa dibaca langsung lewat REST API dengan anon key yang sama yang dipakai website (anon key itu terlihat di page source, publik oleh desain Supabase). Siapa pun bisa memanggil endpoint Supabase itu langsung (lewat curl/Postman/script), bukan cuma lewat tampilan website — jadi "lihat lewat website tapi tidak bisa di-dump" bukan sesuatu yang bisa dipaksakan di level database/RLS saat ini. Trik seperti disable klik-kanan atau sejenisnya **tidak dipasang** karena itu cuma kosmetik, gampang dilewati, dan bisa menyesatkan (membuat kesan ada proteksi padahal tidak ada).

## Kalau nanti mau dibatasi (opsi untuk masa depan)

Kalau keputusan ini berubah dan user memilih opsi "batasi, UPT hanya lihat transaksi sendiri":

1. Ganti policy SELECT di `transaksi_penjualan` dari `using (true)` jadi scoped ke `upt_id` milik akun yang login (mirip pola INSERT yang sudah ada).
2. Dashboard monitoring publik (`monitoring.html`) yang butuh **agregat semua UPT** untuk publik HARUS pindah dari query langsung ke tabel, ke sebuah **view atau RPC function** yang hanya mengembalikan angka teragregasi (total per UPT/bulan), bukan baris mentah per transaksi. Ini otomatis menutup celah "export data mentah" juga, karena yang terekspos publik cuma angka ringkasan, bukan daftar transaksi individual.
3. Ini perlu task/plan terpisah karena mengubah cara `monitoring.html` mengambil data.
