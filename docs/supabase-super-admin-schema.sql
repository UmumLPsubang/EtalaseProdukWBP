-- ============================================
-- Super Admin Kanwil: role, kolom UPT baru, activity log, RPC privileged writes.
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query > Run).
-- ============================================

-- 1. Bedakan akun UPT vs akun Super Admin Kanwil.
alter table profiles add column if not exists role text not null default 'upt'
  check (role in ('upt', 'super_admin'));

-- Akun super_admin tidak terhubung ke satu UPT manapun, jadi upt_id harus boleh null
-- untuk baris itu -- tapi akun 'upt' tetap wajib punya upt_id (dijaga oleh constraint di bawah).
alter table profiles alter column upt_id drop not null;

alter table profiles add constraint profiles_upt_wajib_untuk_role_upt
  check (role = 'super_admin' or upt_id is not null);

-- Helper SECURITY DEFINER: mengecek role pemanggil tanpa memicu RLS pada
-- profiles lagi. Sebuah policy RLS pada tabel profiles yang query ulang
-- profiles di dalam USING-nya sendiri akan memicu "infinite recursion
-- detected in policy for relation profiles" di Postgres -- fungsi ini
-- berjalan dengan privilese pemilik (bypass RLS), jadi aman dipakai di
-- dalam policy pada tabel yang sama.
create or replace function is_super_admin() returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'super_admin');
$$;

-- Super admin perlu baca profiles UPT lain untuk memetakan upt_id -> auth user id
-- saat reset password (lihat Task 6). Baris sendiri sudah bisa dibaca lewat policy
-- "User bisa baca profil sendiri" yang sudah ada.
create policy "Super admin bisa baca semua profiles" on profiles
  for select
  to authenticated
  using (is_super_admin());

-- 2. Kolom baru di upt: status (aktif/nonaktif) belum pernah ada sebelumnya, dan locked
-- untuk fitur Lock/Unlock akun UPT.
alter table upt add column if not exists status text not null default 'aktif'
  check (status in ('aktif', 'nonaktif'));
alter table upt add column if not exists locked boolean not null default false;

-- 3. Jejak audit setiap aksi tulis super admin. Tidak ada UI untuk melihatnya
-- pada fase ini (lihat spec Bagian 8) -- tabel ini hanya dituliskan, dibaca manual
-- lewat Supabase Table Editor kalau perlu verifikasi.
create table admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);

alter table admin_activity_log enable row level security;

create policy "Super admin bisa baca activity log" on admin_activity_log
  for select
  to authenticated
  using (is_super_admin());

-- Tidak ada policy INSERT di sini dengan sengaja -- semua insert ke tabel ini
-- terjadi lewat fungsi SECURITY DEFINER di bawah (yang berjalan dengan privilese
-- pemilik fungsi, bukan privilese pemanggil) atau lewat Edge Function dengan
-- service role key, keduanya melewati RLS.

-- 4. RPC: edit profil UPT + lock/unlock, hanya untuk super_admin.
-- SECURITY DEFINER dipakai alih-alih memperluas grant kolom pada tabel upt, karena
-- grant kolom berlaku untuk seluruh role 'authenticated' tanpa pandang baris --
-- itu persis bug yang pernah diperbaiki (UPT bisa ubah nama sendiri) kalau grant
-- diperluas langsung ke tabel.
create or replace function admin_update_upt(
  p_upt_id uuid,
  p_nama text,
  p_wilayah text,
  p_whatsapp text,
  p_status text,
  p_locked boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if not is_super_admin() then
    raise exception 'Hanya super admin yang bisa mengubah data UPT';
  end if;

  select to_jsonb(u) into v_before from upt u where u.id = p_upt_id;
  if v_before is null then
    raise exception 'UPT tidak ditemukan';
  end if;

  update upt
  set nama = p_nama,
      wilayah = p_wilayah,
      whatsapp = p_whatsapp,
      status = p_status,
      locked = p_locked
  where id = p_upt_id;

  insert into admin_activity_log (admin_id, action, target_type, target_id, changes)
  values (
    auth.uid(), 'edit_upt', 'upt', p_upt_id,
    jsonb_build_object(
      'before', v_before,
      'after', jsonb_build_object(
        'nama', p_nama, 'wilayah', p_wilayah, 'whatsapp', p_whatsapp,
        'status', p_status, 'locked', p_locked
      )
    )
  );
end;
$$;

grant execute on function admin_update_upt(uuid, text, text, text, text, boolean) to authenticated;

-- 5. RPC: hapus transaksi, hanya untuk super_admin, dengan snapshot sebelum hapus
-- disimpan ke admin_activity_log (supaya ada rekam jejak meski barisnya sudah hilang).
create or replace function admin_delete_transaksi(p_transaksi_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot jsonb;
begin
  if not is_super_admin() then
    raise exception 'Hanya super admin yang bisa menghapus transaksi';
  end if;

  select to_jsonb(t) into v_snapshot from transaksi_penjualan t where t.id = p_transaksi_id;

  if v_snapshot is null then
    raise exception 'Transaksi tidak ditemukan';
  end if;

  delete from transaksi_penjualan where id = p_transaksi_id;

  insert into admin_activity_log (admin_id, action, target_type, target_id, changes)
  values (auth.uid(), 'delete_transaction', 'transaksi_penjualan', p_transaksi_id,
    jsonb_build_object('before', v_snapshot));
end;
$$;

grant execute on function admin_delete_transaksi(uuid) to authenticated;
