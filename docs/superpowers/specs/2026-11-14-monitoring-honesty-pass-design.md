# Desain: Monitoring.html Honesty Pass — Hapus Fiktif, Jadikan Real yang Bisa

**Tanggal:** 2026-11-14
**Status:** Disetujui, siap jadi implementation plan

## Latar belakang

Setelah KPI card utama di `monitoring.html` dijadikan data real, sisa halaman ini masih punya banyak konten fiktif peninggalan mock Stitch: target RKAKL yang tidak ada basisnya, klaim integrasi perbankan yang tidak pernah dibangun, status pengiriman yang tidak pernah dilacak, dan beberapa chart/breakdown yang sebenarnya **bisa** dihitung dari data asli (channel, kategori, wilayah) tapi masih pakai angka karangan. Revisi ini membereskan keduanya: hapus yang tidak punya basis data sama sekali, jadikan real yang datanya sudah ada.

## Bagian 1 — Hapus total

- Kotak "Rasio Capaian Target 109.2% Tercapai" + "+9.2% Melampaui RKAKL" (di bawah chart tren bulanan).
- Card "Status Pemenuhan Pesanan" (94.2% Terkirim / 4.5% Pengerjaan / 1.3% Verifikasi, dengan jumlah SPK) — tidak ada tracking status pengiriman per transaksi di sistem ini.
- Teks klaim "Terkoneksi Virtual Account Perbankan BUMN (BNI & BRI)" di bawah donut Distribusi Kanal Transaksi — tidak ada payment gateway, semua transaksi dicatat manual/direct.
- Kolom "Status SIMPONI" di tabel 33 UPT — dihapus total (tidak diganti kolom lain), karena PNBP dibayarkan masing-masing UPT secara mandiri, bukan terpusat lewat 1 akun yang bisa dipantau sistem ini.

## Bagian 2 — Honest placeholder untuk chart tren bulanan

Chart batang "Performa Penjualan & Target Bulanan" (SVG Jan-Jun) dan 2 kotak ringkasan di sampingnya ("Rata-rata Pertumbuhan +11.4%/bln", "Sebaran Performa 33 UPT: 28 dari 33 UPT") — kartu/section-nya **tetap ada** di halaman, tapi seluruh angka fiktifnya diganti pesan jujur: **"Belum ada data histori bulanan"** (chart area) dan kotak-kotak ringkasan ditiadakan isinya atau diganti pesan serupa. Ini belum dihitung dari data asli karena sistem belum pernah menyimpan rekap/snapshot bulanan — baru sebatas transaksi individual dengan tanggal. Menghitung tren bulanan "asli" (revisi lanjutan di luar scope ini) perlu agregasi per bulan dari `tanggal_transaksi`, yang teknisnya mungkin, tapi user minta ditunda ke revisi terpisah — untuk sekarang cukup jujur kosong.

## Bagian 3 — Tabel 33 UPT: kolom jadi real, kolom Status dihapus

Untuk tiap baris UPT di tabel, tambah agregasi per `upt_id`:
- **Komoditas Unggulan** — nama produk (bukan kategori) dengan `jumlah` terjual tertinggi di antara produk-produk UPT itu. Kalau UPT itu belum pernah ada transaksi sama sekali: "Belum ada penjualan".
- **Volume** — `sum(jumlah)` dari semua transaksi UPT itu.
- **Total Omzet** — `sum(total_harga)` dari semua transaksi UPT itu.
- Kolom Status SIMPONI dihapus dari header dan tiap baris (lihat Bagian 1).

## Bagian 4 — Distribusi Kanal Transaksi (real)

Donut SVG + daftar channel dihitung dari **total omzet per channel** (`sum(total_harga)` dikelompokkan per `channel`, dari SELURUH `transaksi_penjualan`), persentase terhadap omzet keseluruhan. Channel yang belum pernah dipakai sama sekali (0 transaksi) **tidak ditampilkan** di legend (bukan dipaksa tampil dengan 0%) — supaya legend tidak penuh entri kosong kalau baru ada 1-2 channel yang pernah dipakai. Label marketing lama ("WhatsApp SPK/Dinas", "Tokopedia Official Giatja", dst — istilah yang menyiratkan kemitraan resmi yang tidak ada) diganti nama channel polos sesuai nilai kolom `channel` (WhatsApp/Shopee/Tokopedia/Offline/Lainnya).

## Bagian 5 — Komposisi Kategori Produk (real)

Dihitung dari **jumlah produk berstatus aktif** per `kategori` (`count(*) from produk where status='aktif' group by kategori`), persentase terhadap total produk aktif se-Jabar. Kategori yang belum punya produk tidak ditampilkan.

## Bagian 6 — Distribusi Penjualan per Wilayah (real, pengganti yang fiktif)

Mengganti "Komparasi Distribusi Penjualan 4 Zona Wilayah Jabar" yang lama (4 zona hardcode: Bandung Raya/Cirebon & Pantura/Bogor Depok Bekasi/Priangan Timur). Versi baru: kelompokkan **total omzet** (`sum(total_harga)` transaksi, join ke `upt.wilayah` lewat `upt_id`) per nilai `wilayah` yang **benar-benar ada** di tabel `upt` (bukan 4 zona hardcode — pakai apa pun nilai wilayah yang sudah diisi di seed data 33 UPT, berapa pun jumlah variasinya), tampilkan nama wilayah + persentase + Rp + jumlah UPT di wilayah itu (dari total UPT yang terdaftar di wilayah itu, bukan cuma yang sudah jualan). Wilayah yang belum ada penjualan sama sekali tetap ditampilkan dengan Rp 0 / 0% (beda dari Bagian 4 yang menyembunyikan channel kosong) — supaya pembaca tahu wilayah mana yang belum mulai jualan, bukan dikira tidak ada datanya.

## Di luar scope

- Tren bulanan "asli" (agregasi per bulan dari `tanggal_transaksi`) — ditunda ke revisi terpisah.
- Tidak ada perubahan skema database — semua perhitungan dari kolom yang sudah ada (`channel`, `kategori`, `wilayah`, `jumlah`, `total_harga`, `status`).

## Testing

- Buka `/monitoring`, pastikan: tidak ada lagi kotak Rasio Capaian Target, card Status Pemenuhan Pesanan, dan klaim virtual account — semuanya hilang total dari halaman.
- Chart tren bulanan menampilkan pesan "Belum ada data histori bulanan" (bukan angka Jan-Jun fiktif).
- Tabel 33 UPT: kolom Status SIMPONI sudah tidak ada; kolom Komoditas Unggulan/Volume/Total Omzet menunjukkan data benar untuk UPT yang sudah pernah dites (misal Lapas Subang dengan "Kopi Robusta").
- Donut Distribusi Kanal Transaksi menunjukkan channel yang benar-benar pernah dipakai (dari sesi testing sebelumnya, minimal WhatsApp & Tokopedia harus muncul), dengan persentase omzet yang masuk akal.
- Komposisi Kategori Produk menunjukkan kategori yang benar-benar ada di tabel produk (misal "Kuliner" untuk Kopi Robusta).
- Distribusi per Wilayah menampilkan nama-nama wilayah asli dari data 33 UPT (bukan "Bandung Raya/Cirebon & Pantura/dst" yang 4 zona lama), termasuk yang omzetnya masih Rp 0.
