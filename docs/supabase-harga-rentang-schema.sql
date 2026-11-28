-- ============================================
-- Tambahan skema: harga berentang (harga minimum - harga maksimum).
--
-- Latar belakang: katalog cetak "UMKM PAS JABAR" menunjukkan 13% produk
-- (20 dari 153, tersebar di 8 UPT) dijual dengan rentang harga, bukan satu
-- angka -- kerajinan tangan dengan ukuran dan tingkat kerumitan berbeda.
-- Pada sebagian UPT justru mayoritas produknya begitu (Lapas Khusus Sentul
-- 5 dari 7, Rutan Perempuan Bandung 5 dari 6).
--
-- Tanpa kolom ini, tiap UPT menyiasatinya sendiri: menulis rentang di nama
-- produk, mengisi batas bawahnya saja, atau memecah jadi dua produk. Yang
-- paling merugikan adalah yang kedua, karena batas atasnya hilang permanen
-- dan tidak bisa dipulihkan tanpa bertanya ulang ke UPT.
--
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query > Run).
-- Idempotent -- aman dijalankan ulang.
-- PRASYARAT: docs/supabase-admin-insert-produk-schema.sql sudah dijalankan.
-- ============================================


-- --------------------------------------------
-- 1. Kolom harga_maks
-- --------------------------------------------
-- NULL berarti harga tunggal -- perilaku lama, berlaku untuk semua produk
-- yang sudah ada. Terisi berarti rentang, dan kartu katalog menampilkan
-- "Rp 15.000 - Rp 20.000".
alter table produk add column if not exists harga_maks numeric(12,2);

-- Harus benar-benar lebih besar, bukan sekadar lebih besar atau sama.
-- harga_maks yang sama dengan harga bukanlah rentang; itu harga tunggal yang
-- kolomnya seharusnya dikosongkan. Membiarkannya sama akan membuat kartu
-- menampilkan "Rp 15.000 - Rp 15.000".
do $$ begin
  alter table produk add constraint produk_harga_maks_wajar
    check (harga_maks is null or (harga is not null and harga_maks > harga));
exception when duplicate_object then null;
end $$;


-- --------------------------------------------
-- 2. admin_insert_produk ikut menerima harga_maks
-- --------------------------------------------
-- Tanda tangan fungsinya berubah, jadi versi lama dihapus lebih dulu.
-- Tanpa ini, PostgreSQL membuat fungsi KEDUA dengan nama sama (overload),
-- dan pemanggilan dari dashboard bisa jatuh ke versi yang keliru.
drop function if exists admin_insert_produk(
  uuid, text, text, numeric, text, text, text, text, text, text
);

create or replace function admin_insert_produk(
  p_upt_id uuid,
  p_nama text,
  p_kategori text,
  p_harga numeric,
  p_deskripsi text,
  p_image_url text,
  p_shopee_link text,
  p_tokopedia_link text,
  p_grab_link text,
  p_gofood_link text,
  p_harga_maks numeric default null,
  p_stok integer default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_produk_id uuid;
  v_nama text;
begin
  if not is_super_admin() then
    raise exception 'Hanya super admin yang bisa menambah produk untuk UPT lain';
  end if;

  if not exists (select 1 from upt where id = p_upt_id) then
    raise exception 'UPT tidak ditemukan';
  end if;

  v_nama := trim(coalesce(p_nama, ''));
  if v_nama = '' then
    raise exception 'Nama produk wajib diisi';
  end if;

  if p_harga is null or p_harga < 0 then
    raise exception 'Harga tidak valid';
  end if;

  if p_harga_maks is not null and p_harga_maks <= p_harga then
    raise exception 'Harga maksimum harus lebih besar dari harga minimum';
  end if;

  insert into produk (
    upt_id, nama, kategori, harga, harga_maks, stok, deskripsi, image_url,
    shopee_link, tokopedia_link, grab_link, gofood_link, status
  )
  values (
    p_upt_id, v_nama, p_kategori, p_harga, p_harga_maks, p_stok, p_deskripsi, p_image_url,
    p_shopee_link, p_tokopedia_link, p_grab_link, p_gofood_link, 'aktif'
  )
  returning id into v_produk_id;

  insert into admin_activity_log (admin_id, action, target_type, target_id, changes)
  values (
    auth.uid(), 'tambah_produk', 'produk', v_produk_id,
    jsonb_build_object(
      'upt_id', p_upt_id,
      'nama', v_nama,
      'kategori', p_kategori,
      'harga', p_harga,
      'harga_maks', p_harga_maks,
      'sumber', 'bulk_upload_super_admin'
    )
  );

  return v_produk_id;
end;
$$;

grant execute on function admin_insert_produk(
  uuid, text, text, numeric, text, text, text, text, text, text, numeric, integer
) to authenticated;
