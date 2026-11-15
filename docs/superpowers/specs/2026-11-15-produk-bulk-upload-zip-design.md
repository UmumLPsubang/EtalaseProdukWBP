# Desain: Bulk Upload Produk via ZIP (CSV + Gambar)

**Tanggal:** 2026-11-15
**Status:** Disetujui, siap jadi implementation plan

## Latar belakang

Saat ini UPT hanya bisa menambah produk satu per satu lewat form manual di `dashboard-produk.html` (nama, kategori, harga, deskripsi, link marketplace, upload 1 foto). UPT yang punya banyak produk sekaligus (misal saat onboarding awal) harus mengisi form itu berulang kali. Halaman Penjualan sudah punya pola bulk upload CSV untuk mencatat banyak transaksi sekaligus — produk butuh pola serupa, tapi dengan tambahan: setiap produk butuh foto, dan foto tidak bisa dimasukkan ke dalam CSV. Solusinya: satu file ZIP berisi CSV data produk + file-file gambar yang dirujuk oleh CSV itu.

## Bagian 1 — Lokasi & Format Input

**Lokasi UI:** Section baru "Upload ZIP (Bulk)" di `dashboard-produk.html`, diletakkan di kolom kiri di bawah form "Tambah Produk" yang sudah ada (keduanya dibungkus satu `<div class="space-y-6">` sebagai kolom kiri grid, pola yang sama seperti kolom kiri di `dashboard-penjualan.html` yang berisi form manual + upload CSV bulk).

**Format ZIP:**
- Satu file ZIP, berisi:
  - Tepat satu file CSV bernama `produk.csv`, berada di root ZIP (tidak di dalam subfolder).
  - File-file gambar (jpg/jpeg/png/webp) juga di root ZIP, dengan nama yang persis sama dengan yang dirujuk di kolom `nama_file_gambar` pada `produk.csv` (case-sensitive exact match).

**Kolom CSV (`produk.csv`):**
| Kolom | Wajib? | Keterangan |
|---|---|---|
| `nama_produk` | Ya | Tidak boleh kosong |
| `kategori` | Ya | Harus salah satu dari: Kriya, Tekstil, Kuliner, Mebel, Pertanian, Jasa, Lainnya |
| `harga` | Ya | Angka, ≥ 0 |
| `deskripsi` | Tidak | Boleh kosong |
| `link_shopee` | Tidak | Boleh kosong; kalau diisi harus diawali `https://` dan mengandung domain shopee.co.id (sama seperti validasi form manual/skema `produk_shopee_link_format`) |
| `link_tokopedia` | Tidak | Boleh kosong; kalau diisi harus diawali `https://` dan mengandung domain tokopedia.com (sama seperti validasi form manual/skema `produk_tokopedia_link_format`) |
| `nama_file_gambar` | Ya | Nama file gambar persis seperti di dalam ZIP (misal `kayu.jpg`) |

**Tombol "Download Template CSV":** menghasilkan file `produk.csv` kosong berisi baris header saja (`nama_produk,kategori,harga,deskripsi,link_shopee,link_tokopedia,nama_file_gambar`), di-generate client-side sebagai Blob — pola yang sama seperti tombol Download Template CSV yang sudah ada di halaman Penjualan.

## Bagian 2 — Proses Teknis

**Library baru:** JSZip (dimuat via CDN `cdn.jsdelivr.net`, versi tertentu yang sudah ≥2 minggu dirilis) — belum pernah dipakai di proyek ini, dipakai untuk membaca isi file ZIP langsung di browser tanpa upload mentah ke server. PapaParse (sudah dimuat di `dashboard-penjualan.html`, ditambahkan juga ke `dashboard-produk.html`) dipakai untuk parse isi `produk.csv` setelah diekstrak dari ZIP.

**Alur:**
1. User pilih 1 file `.zip`, klik tombol "Proses Upload".
2. JSZip membuka file ZIP di memori browser.
3. Cari file bernama persis `produk.csv` di root ZIP. Tidak ketemu → tampilkan pesan error, berhenti (tidak ada yang diproses).
4. Parse isi `produk.csv` dengan PapaParse (header: true).
5. Untuk setiap baris (dengan nomor baris dicatat untuk pelaporan):
   - Validasi `nama_produk` tidak kosong, `kategori` termasuk 7 pilihan valid, `harga` adalah angka ≥ 0, `link_shopee`/`link_tokopedia` (jika diisi) sesuai format domain yang benar.
   - Cari file gambar dengan nama persis `nama_file_gambar` di dalam ZIP (root level). Tidak ketemu → baris gagal, lanjut ke baris berikutnya.
   - Ambil ukuran file gambar itu dari ZIP entry — kalau > 2MB, baris gagal (konsisten dengan batas upload manual "Maks 2MB").
   - Ambil ekstensi dari nama file gambar, validasi harus salah satu dari jpg/jpeg/png/webp — kalau bukan, baris gagal.
   - Lolos semua validasi → ambil Blob gambar dari JSZip (`zipEntry.async("blob")`), upload ke Supabase Storage bucket `produk-images` dengan path `${uptId}/${Date.now()}-${random}.${ext}` (pola sama seperti `uploadFoto()` yang sudah ada di form manual), dapatkan public URL.
   - Insert baris baru ke tabel `produk` dengan `upt_id` milik UPT yang sedang login, `status: 'aktif'`, dan field-field dari CSV + `image_url` hasil upload.
   - Baris gagal di langkah manapun (validasi, gambar tidak ketemu, upload gagal, insert gagal) dicatat sebagai `{ baris: N, alasan: "..." }` dan TIDAK menghentikan pemrosesan baris-baris berikutnya.
6. Setelah semua baris diproses, tampilkan ringkasan: "X produk berhasil ditambahkan, Y baris gagal" + daftar detail baris gagal beserta alasannya (pola sama seperti `csv-result` di halaman Penjualan).
7. Refresh daftar produk (`Daftar Produk` di kolom kanan) supaya produk-produk baru langsung terlihat.

**Batas ukuran file ZIP keseluruhan:** tidak ada batas eksplisit baru di luar batas 2MB per gambar — ZIP dengan banyak gambar otomatis terbatas secara wajar karena tiap gambarnya sendiri dibatasi 2MB. Tidak perlu validasi ukuran total ZIP terpisah.

## Bagian 3 — Error Handling & Pesan

- ZIP tidak valid / rusak / bukan file zip → pesan error jelas, tidak ada yang diproses.
- `produk.csv` tidak ditemukan di dalam ZIP → pesan error spesifik ("File produk.csv tidak ditemukan di dalam ZIP"), tidak ada yang diproses.
- CSV kosong (tidak ada baris data selain header) → pesan "Tidak ada baris produk untuk diproses."
- Semua pesan dalam Bahasa Indonesia, konsisten dengan seluruh UI lain di proyek ini.
- Tombol "Proses Upload" dinonaktifkan selama proses berjalan (bisa makan waktu karena upload banyak gambar satu per satu), dengan teks "Memproses..." — konsisten dengan pola tombol lain di proyek ini.

## Di luar scope

- Tidak ada dukungan update/edit massal produk yang sudah ada lewat ZIP ini — ZIP ini murni untuk menambah produk baru. Mengedit produk existing tetap lewat form manual satu per satu.
- Tidak ada validasi duplikat nama produk antar baris atau terhadap produk yang sudah ada di database — kalau UPT upload produk dengan nama yang sama berkali-kali, akan tercatat sebagai baris-baris produk terpisah (perilaku yang sama seperti form manual sekarang, yang juga tidak mengecek duplikat).
- Tidak ada folder/struktur bersarang di dalam ZIP — gambar dan CSV harus flat di root ZIP.
- Tidak ada preview gambar sebelum upload selama proses bulk berjalan — hanya ringkasan hasil di akhir.

## Testing

- Download Template CSV → isi beberapa baris produk valid, siapkan gambar-gambar sesuai nama di kolom `nama_file_gambar`, zip jadi 1 file dengan `produk.csv` + gambar-gambar itu di root → upload → semua baris berhasil, muncul di Daftar Produk.
- ZIP dengan 1 baris yang `nama_file_gambar`-nya salah ketik (file tidak ada di ZIP) di antara baris-baris valid lainnya → baris itu gagal dengan pesan jelas, baris-baris lain tetap berhasil tersimpan.
- ZIP dengan `kategori` yang bukan dari 7 pilihan valid → baris itu gagal, baris lain lanjut.
- ZIP dengan file gambar > 2MB → baris itu gagal dengan pesan ukuran file.
- ZIP tanpa `produk.csv` di dalamnya → pesan error, tidak ada yang tersimpan.
- Upload file yang bukan ZIP (misal .rar atau .csv biasa) → pesan error ZIP tidak valid.
- Setelah upload sukses sebagian, Daftar Produk di kolom kanan ter-refresh otomatis menampilkan produk-produk baru yang berhasil.
