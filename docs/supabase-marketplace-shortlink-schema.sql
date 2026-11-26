-- ============================================
-- Perbaikan: izinkan tautan pendek resmi Shopee dan Tokopedia.
--
-- Masalah yang diperbaiki: aturan lama hanya menerima shopee.co.id, padahal
-- tombol "Bagikan" di aplikasi Shopee menghasilkan tautan pendek berdomain
-- shp.ee (contoh: https://id.shp.ee/7GUt9b2h). Petugas UPT yang menyalin
-- tautan langsung dari aplikasi -- cara yang paling wajar -- selalu ditolak
-- dengan pesan "violates check constraint produk_shopee_link_format".
--
-- Yang TIDAK berubah: daftar domain tetap dibatasi. Tujuannya mencegah
-- tautan ke situs sembarangan terpasang pada katalog resmi. Yang ditambahkan
-- hanya domain pemendek milik Shopee dan Tokopedia sendiri.
--
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query > Run).
-- Idempotent -- aman dijalankan ulang.
-- ============================================

-- Shopee: shopee.co.id (penuh) + shp.ee (tautan pendek, termasuk id.shp.ee)
alter table produk drop constraint if exists produk_shopee_link_format;
alter table produk add constraint produk_shopee_link_format
  check (
    shopee_link is null
    or shopee_link ~ '^https://(([a-z0-9-]+\.)*shopee\.co\.id|([a-z0-9-]+\.)*shp\.ee)/'
  );

-- Tokopedia: tokopedia.com (penuh, termasuk subdomain seperti tk.tokopedia.com)
-- + tokopedia.link (tautan pendek)
alter table produk drop constraint if exists produk_tokopedia_link_format;
alter table produk add constraint produk_tokopedia_link_format
  check (
    tokopedia_link is null
    or tokopedia_link ~ '^https://(([a-z0-9-]+\.)*tokopedia\.com|([a-z0-9-]+\.)*tokopedia\.link)/'
  );

-- Grab dan GoFood tidak diubah: grab.com sudah mencakup subdomain pemendeknya
-- (r.grab.com), dan gofood.link sudah masuk daftar sejak awal.
