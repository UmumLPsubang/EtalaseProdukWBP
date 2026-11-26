-- ============================================
-- Perubahan skema: data transaksi penjualan tidak lagi terbuka untuk publik.
--
-- Sebelumnya transaksi_penjualan bisa dibaca siapa pun tanpa login, termasuk
-- lewat panggilan API langsung memakai publishable key yang memang tertanam
-- di kode halaman. Keputusan itu didokumentasikan di
-- docs/decisions/2026-11-14-transaksi-public-read-access.md dan kini dicabut.
--
-- Aturan baru:
--   - Tanpa login (anon)  : tidak bisa membaca transaksi sama sekali
--   - Sudah login         : bisa membaca seluruh transaksi 33 UPT
--   - Menulis/mengubah    : tidak berubah, tetap terbatas pada UPT pemiliknya
--
-- Membaca lintas UPT tetap dibuka untuk sesama petugas yang login karena
-- halaman /monitoring, kartu Distribusi per Wilayah, dan dashboard Super Admin
-- memang menampilkan rekap seluruh Jawa Barat.
--
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query > Run).
-- Idempotent -- aman dijalankan ulang.
-- ============================================

-- Policy lama memakai `using (true)` tanpa klausa `to`, sehingga berlaku untuk
-- role anon juga. Diganti, bukan ditambahi: policy RLS bersifat permisif dan
-- saling menjumlahkan, jadi membiarkan policy lama tetap ada akan membuat
-- policy baru tidak berpengaruh sama sekali.
drop policy if exists "Publik bisa baca transaksi" on transaksi_penjualan;
drop policy if exists "Pengguna login bisa baca transaksi" on transaksi_penjualan;

create policy "Pengguna login bisa baca transaksi" on transaksi_penjualan
  for select
  to authenticated
  using (true);

-- Catatan: tabel `produk` dan `upt` sengaja TIDAK diubah. Keduanya harus tetap
-- bisa dibaca publik karena itulah isi katalog di halaman depan. Yang ditutup
-- hanya angka penjualannya.
