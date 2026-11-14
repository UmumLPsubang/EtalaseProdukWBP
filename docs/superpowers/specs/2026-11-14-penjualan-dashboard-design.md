# Desain: Catat Penjualan Multi-Channel + Nomor WA per-UPT

**Tanggal:** 2026-11-14
**Status:** Disetujui, siap jadi implementation plan

## Latar belakang

Dashboard login per-UPT (`input-produk.html`) sudah bisa input data produk. UPT menjual produknya lewat berbagai channel di luar website (WhatsApp, Shopee, Tokopedia, offline) dan perlu mencatat hasil penjualan itu ke sistem supaya nanti bisa diagregasi di dashboard monitoring (`monitoring.html`), yang saat ini KPI-nya masih kosong/placeholder karena belum ada data `transaksi_penjualan` asli.

Terpisah tapi terkait: katalog publik (`index.html`) punya tombol "Pesan via WhatsApp Langsung" di tiap kartu produk, tapi nomornya masih 1 nomor generik hardcode untuk semua 33 UPT. Harus jadi nomor WA asli milik tiap UPT.

## Bagian 1 — Perubahan skema database

```sql
alter table upt add column whatsapp text;
-- format: 62xxxxxxxxxx (tanpa + atau 0 di depan, standar wa.me)

alter table transaksi_penjualan add column channel text
  check (channel in ('WhatsApp', 'Shopee', 'Tokopedia', 'Offline', 'Lainnya'));

-- UPT yang login boleh update baris upt miliknya sendiri (buat isi nomor WA)
create policy "UPT bisa update profil upt sendiri" on upt
  for update
  to authenticated
  using (id = (select upt_id from profiles where id = auth.uid()))
  with check (id = (select upt_id from profiles where id = auth.uid()));
```

`status_pengiriman` yang sudah ada di `transaksi_penjualan` TIDAK dipakai di form baru ini — insert otomatis diisi `'selesai'` karena ini pencatatan transaksi yang sudah terjadi (laporan historis), bukan status order yang sedang berjalan.

## Bagian 2 — Struktur halaman `input-produk.html` (jadi "Dashboard UPT")

Satu halaman, satu akun login, 5 section berurutan (scroll, bukan tab terpisah):

1. **Header** — nama UPT + tombol keluar (sudah ada) + 1 input kecil nomor WhatsApp UPT yang bisa diedit & disimpan langsung dari situ.
2. **Input Produk** — form yang sudah ada, tidak berubah.
3. **Input Penjualan — Manual** (baru)
4. **Input Penjualan — Upload CSV** (baru)
5. **Riwayat Transaksi** (baru) — tabel transaksi milik UPT yang login, terbaru di atas, update otomatis tanpa reload setelah insert manual atau CSV.

## Bagian 3 — Form Input Penjualan (Manual)

Field:
- **Produk** — dropdown, isi dari `produk` milik UPT yang login saja (query `.eq('upt_id', currentUptId)`)
- **Jumlah** — number
- **Total Harga** — number (Rp)
- **Channel** — dropdown: WhatsApp / Shopee / Tokopedia / Offline / Lainnya
- **Tanggal Transaksi** — date input, default hari ini

Submit → insert ke `transaksi_penjualan` (`upt_id`, `produk_id`, `jumlah`, `total_harga`, `channel`, `tanggal_transaksi`, `status_pengiriman: 'selesai'`) → re-render tabel riwayat di bagian 5 tanpa reload halaman.

## Bagian 4 — Upload CSV (Bulk)

**Header CSV wajib:**
```
nama_produk,jumlah,total_harga,channel,tanggal
```

**Tombol "Download Template CSV"** — generate file berisi header + baris kosong untuk tiap nama produk UPT yang login (ambil dari `produk` mereka sendiri), supaya staf tinggal isi angka tanpa mengetik ulang nama produk.

**Alur upload:**
1. Parse CSV di browser (library ringan via CDN — PapaParse).
2. Tiap baris: cocokkan `nama_produk` ke daftar produk UPT yang login (exact match, case-insensitive, trim whitespace).
3. Validasi `channel` harus salah satu dari 5 nilai valid.
4. Validasi `jumlah` dan `total_harga` harus angka positif, `tanggal` harus format tanggal valid.
5. Baris valid → dikumpulkan jadi 1 batch insert ke `transaksi_penjualan`.
6. Baris tidak valid → TIDAK diinsert, dikumpulkan ke daftar error dengan alasan spesifik per baris (nomor baris + pesan: "produk tidak ditemukan", "channel tidak valid", "jumlah harus angka", dst).
7. Tampilkan ringkasan: "X baris berhasil disimpan, Y baris gagal" + tabel detail baris gagal (supaya bisa diperbaiki & upload ulang).
8. Baris berhasil langsung muncul di tabel Riwayat Transaksi (bagian 5).

## Bagian 5 — Katalog publik (`index.html`): produk dinamis + WA per-UPT

1. Ganti kartu produk statis/mock di katalog jadi fetch dari Supabase: `produk` join `upt` (ambil `nama`, `kategori`, `harga`, `image_url`, `deskripsi` dari produk; `whatsapp`, `nama` dari upt).
2. Render ulang `searchInput` filter supaya tetap berfungsi di atas data dinamis (filter client-side di array hasil fetch, bukan DOM statis lagi).
3. Tombol "Pesan via WhatsApp Langsung" per kartu:
   - Kalau `upt.whatsapp` terisi → link ke `https://wa.me/<nomor>?text=<pesan otomatis berisi nama produk & UPT>`
   - Kalau `upt.whatsapp` kosong → tombol diganti jadi teks non-link "Nomor WA belum tersedia, hubungi melalui [kontak Kanwil]" — tidak boleh pura-pura ada kontak kalau datanya belum diisi.
4. Produk dengan `status = 'nonaktif'` tidak ditampilkan di katalog.

## Di luar scope (sengaja tidak dikerjakan sekarang)

- Tracking status pengiriman real-time per transaksi (field `status_pengiriman` ada di skema tapi tidak dipakai UI sampai ada kebutuhan konkret).
- Mencatat kontak/nomor pembeli untuk follow-up (ditanyakan, bukan yang dimaksud user — fitur WA yang dimaksud adalah tombol order di katalog, bukan follow-up ke pembeli).
- Validasi CSV di server (saat ini semua logic di browser karena situs masih statis + Supabase langsung, konsisten dengan arsitektur yang sudah berjalan; kalau nanti pindah ke Next.js, validasi bisa dipindah ke API route).
- Template CSV sebagai file Excel (.xlsx) dengan dropdown bawaan — tetap pakai CSV polos sesuai keputusan di bagian 4.

## Testing

- Login sebagai 1 UPT, isi nomor WA, input produk, input transaksi manual, cek muncul di riwayat.
- Upload CSV campuran baris valid+invalid, pastikan baris valid masuk dan baris invalid dilaporkan dengan alasan benar, tidak ada yang diinsert diam-diam salah.
- Login UPT lain, pastikan tidak bisa melihat/mengubah produk atau transaksi UPT pertama (RLS enforced).
- Buka katalog publik, pastikan tombol WA per produk mengarah ke nomor UPT yang benar, dan produk tanpa nomor WA menampilkan pesan fallback, bukan link rusak.
