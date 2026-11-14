-- ============================================
-- Etalase Produk WBP - Supabase Schema
-- ============================================

-- 1. Tabel UPT (33 Lapas & Rutan se-Jawa Barat)
create table upt (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,           -- misal 'CRB', 'SKM', 'SBG'
  nama text not null,                  -- misal 'Lapas Kelas I Cirebon'
  kelas text,                          -- 'I', 'IIA', 'IIB', 'LPP', 'LPKA', 'Rutan'
  wilayah text,                        -- 'Bandung Raya', 'Cirebon & Pantura', dst
  created_at timestamptz default now()
);

-- 2. Tabel Produk (etalase, bisa banyak per UPT)
create table produk (
  id uuid primary key default gen_random_uuid(),
  upt_id uuid references upt(id) on delete cascade,
  nama text not null,
  kategori text,                       -- 'Kriya', 'Tekstil', 'Kuliner', 'Mebel', dll
  harga numeric(12,2),
  deskripsi text,
  image_url text,                      -- URL dari Supabase Storage
  status text default 'aktif' check (status in ('aktif', 'nonaktif')),
  created_at timestamptz default now()
);

-- 3. Tabel Transaksi Penjualan (dasar untuk KPI & chart dashboard)
create table transaksi_penjualan (
  id uuid primary key default gen_random_uuid(),
  upt_id uuid references upt(id) on delete set null,
  produk_id uuid references produk(id) on delete set null,
  jumlah integer not null default 1,
  total_harga numeric(14,2) not null,
  status_pengiriman text default 'diproses' check (status_pengiriman in ('diproses', 'terkirim', 'selesai')),
  tanggal_transaksi date default current_date,
  created_at timestamptz default now()
);

-- ============================================
-- Row Level Security: publik boleh BACA (untuk dashboard & katalog),
-- tulis/insert nanti dibatasi setelah ada sistem login UPT.
-- ============================================
alter table upt enable row level security;
alter table produk enable row level security;
alter table transaksi_penjualan enable row level security;

create policy "Publik bisa baca upt" on upt for select using (true);
create policy "Publik bisa baca produk" on produk for select using (true);
create policy "Publik bisa baca transaksi" on transaksi_penjualan for select using (true);

-- ============================================
-- Index untuk query dashboard (agregasi per UPT/periode)
-- ============================================
create index idx_produk_upt on produk(upt_id);
create index idx_transaksi_upt on transaksi_penjualan(upt_id);
create index idx_transaksi_tanggal on transaksi_penjualan(tanggal_transaksi);
