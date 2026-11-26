-- ============================================
-- Tambahan skema:
--   1. Kolom stok pada produk
--   2. Izin UPT mengoreksi dan menghapus transaksi penjualannya sendiri
--
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query > Run).
-- Idempotent -- aman dijalankan ulang.
-- Tidak bergantung pada migrasi lain, boleh dijalankan kapan saja.
-- ============================================


-- --------------------------------------------
-- 1. Kolom stok
-- --------------------------------------------
-- Sengaja nullable, dan NULL punya arti tersendiri:
--   NULL  = UPT tidak melacak stok produk ini (perilaku lama, tetap berlaku
--           untuk semua produk yang sudah terlanjur ada)
--   0     = stok habis
--   > 0   = jumlah yang tersedia
--
-- Kalau dibuat NOT NULL DEFAULT 0, semua produk lama akan langsung tampil
-- "stok habis" di katalog publik padahal sebenarnya tersedia -- itu informasi
-- palsu yang muncul tanpa ada yang mengetiknya.
alter table produk add column if not exists stok integer;

do $$ begin
  alter table produk add constraint produk_stok_non_negatif
    check (stok is null or stok >= 0);
exception when duplicate_object then null;
end $$;


-- --------------------------------------------
-- 2. UPT boleh mengoreksi transaksinya sendiri
-- --------------------------------------------
-- Sebelum ini hanya ada policy INSERT, sehingga satu salah ketik angka
-- penjualan harus diperbaiki lewat Super Admin. Dengan 33 UPT, itu menjadi
-- beban Kanwil untuk kesalahan yang sepenuhnya milik UPT sendiri.
--
-- Catatan integritas: membolehkan UPT menghapus transaksinya sendiri tidak
-- membuka celah baru untuk mengecilkan angka penjualan, karena UPT memang
-- satu-satunya pihak yang mengetikkan data itu sejak awal -- kalau mau
-- menyembunyikan penjualan, cukup dengan tidak mencatatnya.

drop policy if exists "UPT bisa koreksi transaksi sendiri" on transaksi_penjualan;

create policy "UPT bisa koreksi transaksi sendiri" on transaksi_penjualan
  for update
  to authenticated
  using (
    upt_id = (select upt_id from profiles where id = auth.uid())
  )
  with check (
    -- USING memeriksa baris sebelum diubah, WITH CHECK memeriksa hasilnya.
    -- Keduanya diperlukan: tanpa WITH CHECK, UPT bisa memindahkan transaksinya
    -- menjadi milik UPT lain lewat panggilan API langsung.
    upt_id = (select upt_id from profiles where id = auth.uid())
    and exists (
      select 1 from produk p
      where p.id = produk_id
        and p.upt_id = (select upt_id from profiles where id = auth.uid())
    )
  );

drop policy if exists "UPT bisa hapus transaksi sendiri" on transaksi_penjualan;

create policy "UPT bisa hapus transaksi sendiri" on transaksi_penjualan
  for delete
  to authenticated
  using (
    upt_id = (select upt_id from profiles where id = auth.uid())
  );

-- Catatan: policy UPDATE di atas sengaja TIDAK mensyaratkan produk berstatus
-- 'aktif', berbeda dengan policy INSERT. Alasannya, transaksi lama atas produk
-- yang sudah dinonaktifkan tetap harus bisa dikoreksi kalau angkanya salah.
