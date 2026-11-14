-- ============================================
-- Tambahan skema: link Shopee & Tokopedia per produk.
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query > Run).
-- ============================================

alter table produk add column if not exists shopee_link text;
alter table produk add column if not exists tokopedia_link text;
