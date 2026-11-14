-- ============================================
-- Izinkan insert data produk + upload foto ke bucket produk-images.
-- CATATAN KEAMANAN: kebijakan ini masih TERBUKA (siapa pun yang tahu
-- URL form bisa menambah produk) karena belum ada sistem login per-UPT.
-- Ini sengaja untuk tahap awal supaya staf UPT bisa langsung input tanpa
-- setup auth dulu. Sebelum dipakai serius/produksi, tambahkan Supabase
-- Auth (misal 1 akun per UPT) dan ganti `with check (true)` di bawah
-- menjadi pengecekan upt_id milik user yang login.
-- ============================================

create policy "Publik bisa tambah produk" on produk
  for insert
  with check (true);

create policy "Publik bisa upload foto produk" on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'produk-images');
