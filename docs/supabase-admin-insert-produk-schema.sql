-- ============================================
-- Tambahan skema: Super Admin boleh menambah produk atas nama UPT mana pun.
-- Dipakai oleh fitur "Unggah Produk untuk UPT" di dashboard Super Admin,
-- untuk UPT yang mengirim ZIP lewat jalur lain (WhatsApp/email) karena tidak
-- bisa mengunggah sendiri.
--
-- PRASYARAT: jalankan docs/supabase-grab-gofood-links-schema.sql LEBIH DULU.
-- Fungsi di bawah menulis ke kolom grab_link dan gofood_link; kalau kolom itu
-- belum ada, pembuatan fungsi ini akan gagal.
--
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query > Run).
-- Idempotent -- aman dijalankan ulang.
-- ============================================

-- Pola yang dipakai sama dengan admin_update_upt dan admin_update_produk yang
-- sudah ada: SECURITY DEFINER dengan penjagaan is_super_admin() di dalam fungsi,
-- BUKAN memperluas policy INSERT pada tabel produk. Alasannya sama seperti yang
-- didokumentasikan di supabase-super-admin-schema.sql -- policy yang diperluas
-- berlaku untuk seluruh role 'authenticated' tanpa pandang baris, dan itu bisa
-- membuka kembali celah UPT menulis data atas nama UPT lain.
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
  p_gofood_link text
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

  insert into produk (
    upt_id, nama, kategori, harga, deskripsi, image_url,
    shopee_link, tokopedia_link, grab_link, gofood_link, status
  )
  values (
    p_upt_id, v_nama, p_kategori, p_harga, p_deskripsi, p_image_url,
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
      'sumber', 'bulk_upload_super_admin'
    )
  );

  return v_produk_id;
end;
$$;

grant execute on function admin_insert_produk(
  uuid, text, text, numeric, text, text, text, text, text, text
) to authenticated;
