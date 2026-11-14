# Desain: KPI Dashboard Monitoring Jadi Data Asli

**Tanggal:** 2026-11-14
**Status:** Disetujui, siap jadi implementation plan

## Latar belakang

`monitoring.html` punya 4 kartu KPI di bagian atas (Total Omzet Penjualan, Volume Produk Terjual, Pesanan Tersalurkan, UPT Aktif Berproduksi) yang sejak awal masih hardcode dari export Stitch — belum pernah diganti ke data asli, padahal tabel `produk` dan `transaksi_penjualan` sudah terisi data nyata sejak fitur pencatatan penjualan dibangun.

## Bagian 1 — 4 Kartu KPI jadi real + sub-teks fiktif dihapus

Data diambil client-side (fetch `produk` + `transaksi_penjualan`, kedua tabel sudah publicly-readable sesuai `docs/decisions/2026-11-14-transaksi-public-read-access.md`), dihitung di browser — pola yang sama dengan KPI dashboard per-UPT (`dashboard.html`) dan badge "terjual" di katalog (`index.html`).

1. **Total Omzet Penjualan** — `sum(total_harga)` dari SELURUH baris `transaksi_penjualan` (gabungan 33 UPT, bukan per-UPT). Sub-teks "+14.8% vs bulan lalu" dan "Rasio Capaian Target 109.2%" dihapus — keduanya tidak punya basis data (tidak ada baseline bulan lalu yang tercatat, tidak ada konsep "target RKAKL" di skema manapun).
2. **Volume Produk Terjual** — `sum(jumlah)` dari seluruh transaksi. Sub-teks "+8.2% pesanan diproses" dihapus (alasan sama: tidak ada baseline historis). "Komoditas Teratas" (sub-teks lain di kartu ini) diganti jadi **nyata**: kategori produk (`produk.kategori`) dengan total `jumlah` terjual tertinggi, dihitung dengan menjumlahkan `jumlah` transaksi per `produk_id`, lalu dikelompokkan ke `kategori` produk itu via join `produk_id → produk.kategori`. Kalau belum ada transaksi sama sekali, tampilkan "Belum ada data" alih-alih nama kategori kosong.
3. **Jumlah Transaksi** (ganti nama dari "Pesanan Tersalurkan") — `count(*)` baris `transaksi_penjualan`. Sub-teks "94.2% Sukses Terkirim" dan "Rata-rata Lead Time 6 Hari Kerja" dihapus — keduanya mengasumsikan ada tracking status pengiriman per transaksi, yang sengaja tidak dibangun (`status_pengiriman` selalu `'selesai'` otomatis saat insert, bukan status yang berubah seiring waktu) dan tidak ada koneksi ke API publik Shopee/marketplace manapun untuk melacak pengiriman riil.
4. **UPT Aktif Berproduksi** — jumlah UPT unik (dari 33) yang punya minimal 1 baris `produk` dengan `status = 'aktif'`. Dihitung dengan ambil semua `produk.upt_id` berstatus aktif, lalu hitung `Set` unik dari `upt_id` itu (`.size`), dibandingkan dengan total 33 UPT (hardcode angka 33, konsisten dengan seed data `docs/supabase-seed.sql` yang memang berisi 33 UPT resmi). Sub-teks "100% Partisipasi Giatja" dan "Total WBP Diberdayakan 2.500+ Tenaga Terampil" dihapus — tidak ada data jumlah WBP per UPT di skema manapun.

Markup kartu yang sudah ada (4 `<div>` KPI card) dipakai ulang — cukup ganti teks statisnya jadi placeholder yang diisi JS saat fetch selesai, dan hapus baris sub-teks yang dibuang (bukan cuma disembunyikan, dihapus dari markup supaya tidak ada elemen kosong/menggantung).

## Di luar scope

- Tidak ada server-side aggregate/view — perhitungan tetap di browser (client-side), konsisten dengan keputusan arsitektur yang sudah berjalan di seluruh proyek ini untuk skala data saat ini.
- Tidak membangun ulang konsep "target RKAKL" atau tracking status pengiriman — kedua itu sengaja dihapus, bukan ditunda untuk nanti dibangun di plan ini.
- Chart batang "Performa Penjualan & Target Bulanan" dan tabel 33 UPT di bawahnya **tidak disentuh** di plan ini (tabel 33 UPT sudah pernah diperbaiki jadi data real di pekerjaan sebelumnya; chart masih mock, tapi itu di luar scope revisi KPI card kali ini).

## Testing

- Buka `/monitoring` (publik, tanpa login), pastikan 4 angka KPI muncul dan masuk akal dibandingkan data yang sudah pernah diinput selama sesi testing sebelumnya (produk "Kopi Robusta" dkk).
- Pastikan tidak ada sub-teks sisa (target/lead time/WBP) yang masih tampil di kartu manapun.
- "Komoditas Teratas" harus menunjukkan kategori yang benar-benar paling banyak terjual (cek manual: kategori apa yang unit terjualnya paling tinggi dari semua transaksi yang ada).
- "UPT Aktif Berproduksi" harus menunjukkan hitungan UPT unik yang benar (bukan jumlah baris produk), dari total 33.
