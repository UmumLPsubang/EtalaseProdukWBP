-- ============================================
-- Tambahan skema: nomor WhatsApp per-UPT + channel penjualan.
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query > Run).
-- ============================================

alter table upt add column if not exists whatsapp text;

alter table transaksi_penjualan add column if not exists channel text
  check (channel in ('WhatsApp', 'Shopee', 'Tokopedia', 'Offline', 'Lainnya'));

create policy "UPT bisa update profil upt sendiri" on upt
  for update
  to authenticated
  using (id = (select upt_id from profiles where id = auth.uid()))
  with check (id = (select upt_id from profiles where id = auth.uid()));

-- Row Level Security di atas membatasi BARIS mana yang bisa disentuh oleh UPDATE.
-- Grant/revoke kolom di bawah ini membatasi KOLOM mana yang bisa disentuh pada baris
-- itu -- UI hanya mengekspos field whatsapp, jadi akses API pun dibatasi sama.
revoke update on upt from authenticated;
grant update (whatsapp) on upt to authenticated;

-- Format nomor WhatsApp harus angka Indonesia (62...) agar tidak bisa diisi string
-- sembarangan lewat panggilan API langsung (bypass validasi regex di browser).
alter table upt add constraint upt_whatsapp_format
  check (whatsapp is null or whatsapp ~ '^62[0-9]{8,13}$');

-- Tanpa policy INSERT ini, UPT tidak bisa mencatat transaksi penjualan sama sekali
-- (manual maupun CSV bulk upload) karena RLS menolak semua insert secara default.
-- Klausa exists(...) mencegah UPT mencatat transaksi atas produk UPT lain lewat
-- panggilan API langsung (UI dropdown sudah membatasi ini, tapi API tidak).
create policy "UPT bisa catat transaksi sendiri" on transaksi_penjualan
  for insert
  to authenticated
  with check (
    upt_id = (select upt_id from profiles where id = auth.uid())
    and exists (
      select 1 from produk p
      where p.id = produk_id
        and p.upt_id = (select upt_id from profiles where id = auth.uid())
    )
  );
