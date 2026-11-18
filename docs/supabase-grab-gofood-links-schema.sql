-- ============================================
-- Tambahan skema: link Grab Food & GoFood per produk.
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query > Run).
-- Idempotent -- aman dijalankan ulang.
-- ============================================

alter table produk add column if not exists grab_link text;
alter table produk add column if not exists gofood_link text;

-- Grab Food Indonesia: food.grab.com atau grab.com (cover semua subdomain Grab Food)
do $$ begin
  alter table produk add constraint produk_grab_link_format
    check (grab_link is null or grab_link ~ '^https://([a-z0-9-]+\.)*grab\.com/');
exception when duplicate_object then null;
end $$;

-- GoFood: gofood.co.id atau gofood.link (kedua domain resmi Gojek untuk GoFood)
do $$ begin
  alter table produk add constraint produk_gofood_link_format
    check (gofood_link is null or gofood_link ~ '^https://([a-z0-9-]+\.)*(gofood\.co\.id|gofood\.link)/');
exception when duplicate_object then null;
end $$;
