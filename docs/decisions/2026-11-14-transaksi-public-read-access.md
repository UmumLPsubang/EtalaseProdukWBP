# Keputusan: Akses baca `transaksi_penjualan` tetap publik

**Tanggal:** 2026-11-14
**Status:** ~~Berlaku~~ **DICABUT 2026-11-26** — lihat [Keputusan pengganti](#keputusan-pengganti-2026-11-26) di bawah.

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

---

# Keputusan pengganti (2026-11-26)

**Status:** Berlaku

## Keputusan

Data penjualan **tidak lagi terbuka untuk publik**. Aturan barunya:

| Siapa | Boleh baca transaksi? |
|---|---|
| Pengunjung tanpa login | **Tidak**, sama sekali |
| Petugas UPT yang login | Ya, seluruh 33 UPT |
| Super Admin Kanwil | Ya, seluruh 33 UPT |

Menulis, mengubah, dan menghapus transaksi **tidak berubah** — tetap terbatas pada UPT pemiliknya.

Migrasi: `docs/supabase-transaksi-internal-only-schema.sql`

## Alasan

Permintaan user: angka penjualan adalah informasi internal, bukan konsumsi publik. Portal ini tetap jadi etalase produk untuk umum, tetapi kinerja penjualan hanya untuk kalangan petugas.

## Mengapa membaca lintas UPT tetap dibuka untuk sesama petugas

Sempat dipertimbangkan membatasi tiap UPT hanya ke datanya sendiri. Itu ditolak karena membuat tiga hal yang sudah berjalan jadi menyesatkan atau harus dibongkar:

- `monitoring.html` menampilkan KPI gabungan dan tabel peringkat 33 UPT. Kalau UPT hanya membaca datanya sendiri, halaman itu akan menampilkan angka satu UPT di bawah judul "se-Jawa Barat".
- Kartu "Distribusi Penjualan per Wilayah" di `/dashboard-penjualan` memang data lintas UPT, dan harus dihapus.
- Dashboard Super Admin tidak terpengaruh, tapi jadi satu-satunya tempat melihat rekap.

User memilih: sesama petugas boleh saling melihat. Yang ditutup adalah publik.

## Yang berubah di aplikasi

1. **`index.html`** — tautan "Monitoring Penjualan" di menu dan tombolnya di hero dihapus. Label "X terjual" pada kartu produk juga dihapus, dan **seluruh kode pembaca tabel transaksi dibuang dari halaman publik**, bukan sekadar disembunyikan.
2. **`monitoring.html`** — diberi penjaga `assets/js/require-login.js`; pengunjung tanpa sesi dialihkan ke `/login`.
3. **`produk` dan `upt` tidak diubah** — keduanya tetap publik karena itulah isi katalog.

## Catatan kejujuran soal batasan

Penjaga JavaScript di `monitoring.html` hanya mengurus tampilan dan bisa dilewati siapa pun yang paham teknis. **Yang benar-benar menutup datanya adalah RLS di database.** Keduanya dipasang bersama: RLS sebagai penjaga sebenarnya, penjaga JavaScript supaya pengunjung mendapat halaman login yang jelas alih-alih halaman penuh angka nol.

Konsekuensinya, selama migrasi SQL belum dijalankan, menghapus tautan saja **tidak menutup apa pun** — data masih bisa diambil lewat API.
