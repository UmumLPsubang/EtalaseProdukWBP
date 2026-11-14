-- ============================================
-- Setup login per-UPT: tiap akun Supabase Auth terhubung ke 1 UPT
-- lewat tabel profiles. Produk hanya bisa ditambah/diubah/dihapus
-- oleh akun yang login, dan dibatasi untuk upt_id miliknya sendiri.
-- ============================================

-- Hapus kebijakan lama yang masih terbuka ke publik
drop policy if exists "Publik bisa tambah produk" on produk;
drop policy if exists "Publik bisa upload foto produk" on storage.objects;

-- Tabel profil: 1 baris per akun login, terhubung ke 1 UPT
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  upt_id uuid not null references upt(id),
  nama text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "User bisa baca profil sendiri" on profiles
  for select
  using (auth.uid() = id);

-- Produk: insert/update/delete hanya untuk upt_id milik akun yang login
create policy "UPT bisa tambah produk sendiri" on produk
  for insert
  to authenticated
  with check (
    upt_id = (select upt_id from profiles where id = auth.uid())
  );

create policy "UPT bisa ubah produk sendiri" on produk
  for update
  to authenticated
  using (upt_id = (select upt_id from profiles where id = auth.uid()))
  with check (upt_id = (select upt_id from profiles where id = auth.uid()));

create policy "UPT bisa hapus produk sendiri" on produk
  for delete
  to authenticated
  using (upt_id = (select upt_id from profiles where id = auth.uid()));

-- Storage: upload foto hanya untuk user login, dan harus di folder
-- bernama sesuai upt_id miliknya sendiri (mencegah upload ke folder UPT lain)
create policy "UPT bisa upload foto produk sendiri" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'produk-images'
    and (storage.foldername(name))[1] = (select upt_id::text from profiles where id = auth.uid())
  );
