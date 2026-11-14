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
