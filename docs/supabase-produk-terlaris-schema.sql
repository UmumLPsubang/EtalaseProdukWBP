-- ============================================
-- Fungsi: daftar produk terlaris untuk halaman depan.
--
-- Dipakai bagian "Produk Terlaris" di index.html. Dibuat sebagai fungsi
-- SECURITY DEFINER, BUKAN dengan membuka kembali tabel transaksi_penjualan
-- ke publik, supaya yang terekspos benar-benar hanya yang dikehendaki:
--
--   Yang DIBUKA  : id produk dan jumlah unit terjual
--   Yang DITUTUP : nilai rupiah, nama pembeli, tanggal, channel, baris
--                  transaksi mentah, dan perbandingan omzet antar UPT
--
-- Dengan kata lain publik bisa tahu produk apa yang laris dan berapa unit,
-- tetapi tidak bisa tahu uangnya berapa dan tidak bisa mengunduh data
-- transaksi. Ini melengkapi, bukan membatalkan,
-- docs/supabase-transaksi-internal-only-schema.sql.
--
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query > Run).
-- Idempotent -- aman dijalankan ulang.
-- ============================================

create or replace function produk_terlaris(p_limit integer default 8)
returns table (
  produk_id uuid,
  total_terjual bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    t.produk_id,
    sum(t.jumlah)::bigint as total_terjual
  from transaksi_penjualan t
  join produk p on p.id = t.produk_id
  where p.status = 'aktif'          -- produk nonaktif tidak boleh muncul di katalog
    and t.produk_id is not null
  group by t.produk_id
  having sum(t.jumlah) > 0
  order by total_terjual desc, t.produk_id
  -- Dibatasi keras di sisi server. Tanpa ini, pemanggil bisa meminta
  -- p_limit yang sangat besar dan mendapat jumlah terjual SETIAP produk --
  -- itu sama saja membuka seluruh rekap penjualan lewat pintu belakang.
  limit greatest(1, least(coalesce(p_limit, 8), 12));
$$;

-- Sengaja diberikan ke anon juga: inilah satu-satunya celah penjualan yang
-- memang dibuka untuk publik, dan bentuknya sudah dibatasi oleh definisi
-- fungsi di atas.
grant execute on function produk_terlaris(integer) to anon, authenticated;
