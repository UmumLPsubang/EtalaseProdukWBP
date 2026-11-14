-- ============================================
-- Seed data: upt (33 UPT Lapas/Rutan/LPKA se-Jawa Barat)
-- Sumber: data resmi "Monitoring Tutup Periode" (Kode Satker + Nama Satker),
-- BAPAS dikeluarkan karena bukan unit produksi/penjualan karya WBP.
-- ============================================

truncate table transaksi_penjualan, produk, upt restart identity cascade;

insert into upt (kode, nama, kelas, wilayah) values
  ('692078', 'Lapas Khusus Kelas IIB Sentul', 'IIB Khusus', 'Bogor'),
  ('692081', 'Lapas Kelas IIA Karawang', 'IIA', 'Karawang'),
  ('692082', 'Lapas Kelas IIA Bekasi', 'IIA', 'Bekasi'),
  ('692134', 'Lapas Kelas IIA Banceuy Bandung', 'IIA', 'Bandung'),
  ('692135', 'Lapas Kelas IIB Sumedang', 'IIB', 'Sumedang'),
  ('692136', 'Lapas Kelas IIA Garut', 'IIA', 'Garut'),
  ('692137', 'Lapas Kelas IIB Ciamis', 'IIB', 'Ciamis'),
  ('692138', 'Lapas Kelas IIB Tasikmalaya', 'IIB', 'Tasikmalaya'),
  ('692139', 'Lapas Kelas I Sukamiskin', 'I', 'Bandung'),
  ('692141', 'Lapas Kelas I Cirebon', 'I', 'Cirebon'),
  ('692142', 'Rutan Kelas I Cirebon', 'I', 'Cirebon'),
  ('692143', 'Lapas Kelas IIA Kuningan', 'IIA', 'Kuningan'),
  ('692144', 'Lapas Kelas IIB Majalengka', 'IIB', 'Majalengka'),
  ('692145', 'Lapas Kelas IIB Indramayu', 'IIB', 'Indramayu'),
  ('692147', 'Lapas Kelas IIA Bogor', 'IIA', 'Bogor'),
  ('692148', 'Lapas Kelas IIB Sukabumi', 'IIB', 'Sukabumi'),
  ('692149', 'Lapas Kelas IIB Cianjur', 'IIB', 'Cianjur'),
  ('692150', 'Lapas Kelas IIB Purwakarta', 'IIB', 'Purwakarta'),
  ('692151', 'Lapas Kelas IIA Subang', 'IIA', 'Subang'),
  ('692556', 'Rutan Perempuan Kelas IIA Bandung', 'IIA', 'Bandung'),
  ('692565', 'Lapas Kelas IIA Cibinong', 'IIA', 'Bogor'),
  ('692566', 'Lapas Perempuan Kelas IIA Bandung', 'IIA', 'Bandung'),
  ('692589', 'Rutan Kelas I Bandung', 'I', 'Bandung'),
  ('692672', 'Lapas Narkotika Kelas IIA Cirebon', 'IIA Narkotika', 'Cirebon'),
  ('692696', 'Lapas Narkotika Kelas IIA Bandung', 'IIA Narkotika', 'Bandung'),
  ('692751', 'Lapas Kelas IIA Warung Kiara', 'IIA', 'Sukabumi'),
  ('692758', 'Rutan Kelas IIB Garut', 'IIB', 'Garut'),
  ('692768', 'Lapas Narkotika Kelas IIA Gunung Sindur', 'IIA Narkotika', 'Bogor'),
  ('692769', 'Lapas Kelas IIA Cikarang', 'IIA', 'Cikarang'),
  ('692770', 'Lapas Kelas IIB Banjar', 'IIB', 'Kota Banjar'),
  ('692779', 'Lembaga Pembinaan Khusus Anak Kelas II Bandung', 'II LPKA', 'Bandung'),
  ('692782', 'Lapas Khusus Kelas IIA Gunung Sindur', 'IIA Khusus', 'Bogor'),
  ('692795', 'Rutan Kelas I Depok', 'I', 'Depok');
