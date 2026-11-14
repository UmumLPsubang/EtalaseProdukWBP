-- ============================================
-- Tambahan skema: link Shopee & Tokopedia per produk.
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query > Run).
-- ============================================

alter table produk add column if not exists shopee_link text;
alter table produk add column if not exists tokopedia_link text;

alter table produk add constraint produk_shopee_link_format
  check (shopee_link is null or shopee_link ~ '^https://([a-z0-9-]+\.)*shopee\.co\.id/');

alter table produk add constraint produk_tokopedia_link_format
  check (tokopedia_link is null or tokopedia_link ~ '^https://([a-z0-9-]+\.)*tokopedia\.com/');
