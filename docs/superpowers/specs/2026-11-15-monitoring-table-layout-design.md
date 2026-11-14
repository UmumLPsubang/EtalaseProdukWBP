# Desain: Tata Letak Tabel UPT Lebar Penuh + Search/Sort Fungsional

**Tanggal:** 2026-11-15
**Status:** Disetujui, siap dikerjakan

## Latar belakang

User melaporkan tampilan `/monitoring` "tidak enak dilihat". Penyebabnya: tabel 5 kolom dipaksa muat di kolom kiri grid 12 (`lg:col-span-7` ≈ 58% lebar), sehingga judul kartu membungkus 3 baris dengan ikon mengambang di tengah teks, header kolom "Komoditas Unggulan" dan "Total Omzet" ikut membungkus, dan kontrol search/sort berdesakan di sebelah judul.

Selain itu masih tersisa 3 kontrol mock non-fungsional di header tabel (search, sort, 5 filter tab dengan angka hardcode), dan subtitle masih menyebut "status pencatatan aktif" padahal kolom Status SIMPONI sudah dihapus pada revisi sebelumnya.

## Bagian 1 — Tabel dipindah ke baris sendiri, lebar penuh

Struktur sekarang: satu `<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">` berisi dua kolom — kiri `lg:col-span-7` (kartu chart tren + kartu tabel UPT), kanan `lg:col-span-5` (kartu donut kanal + kartu komposisi kategori).

Struktur baru:
- **Baris 1** — grid 12 kolom seperti sekarang, tapi kolom kiri hanya berisi kartu chart tren (termasuk kotak "belum ada data histori" dan distribusi wilayah di dalamnya). Kolom kanan tidak berubah.
- **Baris 2** — kartu tabel 33 UPT dikeluarkan dari grid, diletakkan sebagai elemen sendiri selebar kontainer induk (`space-y-6` dari pembungkus di atasnya sudah memberi jarak antar baris).

Tidak ada perubahan isi/kolom tabel — murni pemindahan posisi supaya dapat lebar penuh.

## Bagian 2 — Header kartu tabel dirapikan

- Judul "Tabel Performa Penjualan Seluruh UPT Se-Jawa Barat" + ikon sejajar dalam satu baris; kontrol search & sort di sisi kanan judul (muat karena lebar penuh).
- Subtitle diganti jadi: "Rincian komoditas unggulan, volume, dan capaian omzet dari 33 UPT Lapas & Rutan se-Jawa Barat." — menghapus frasa "status pencatatan aktif" yang merujuk kolom yang sudah tidak ada.
- Blok 5 filter tab (`Semua (33)`, `Lapas Kelas I & IIA (18)`, `Lapas Kelas IIB (6)`, `LPP / LPKA Khusus (3)`, `Rutan (6)`) **dihapus seluruhnya** — angkanya hardcode, tidak cocok dengan data asli, dan tidak memfilter apa pun.

## Bagian 3 — Search & sort difungsikan

**Search** (`<input>` yang sudah ada, diberi id `upt-search-input`):
- Mengetik memfilter baris tabel secara langsung (event `input`), case-insensitive.
- Yang dicocokkan: seluruh teks baris — mencakup nama UPT, wilayah, kode Satker, dan nama komoditas unggulan.
- Baris yang tidak cocok disembunyikan (`style.display = "none"`).
- Jika tidak ada satu pun baris cocok, tampilkan satu baris pesan "Tidak ada UPT yang cocok dengan pencarian." di dalam tabel; pesan hilang begitu ada yang cocok lagi.

**Sort** (tombol yang sudah ada, diberi id `upt-sort-btn`):
- Tombol toggle dua mode: urutan nama A-Z (default, sesuai urutan hasil query) ↔ omzet tertinggi ke terendah.
- Label tombol mengikuti mode berikutnya yang akan diterapkan: default menampilkan "Omzet Tertinggi"; setelah diklik berubah jadi "Urutan Nama", dan tombol diberi gaya aktif (latar gelap) supaya jelas sedang dalam mode urut omzet.
- Nilai omzet tiap baris disimpan sebagai atribut `data-omzet` pada elemen `<tr>` saat `fillUptRowAggregates()` mengisi data agregat — jadi pengurutan cukup menyusun ulang elemen `<tr>` yang sudah ada, tanpa query ulang ke Supabase.
- Urutan nama dipulihkan dengan menyimpan urutan asli lewat atribut `data-order` (indeks hasil query) yang di-stamp saat baris dirender.

Search dan sort bekerja independen: mengurutkan tidak menghapus filter pencarian yang sedang aktif, dan sebaliknya.

## Di luar scope

- Tidak ada perubahan data, skema, atau query Supabase — semua murni tampilan dan interaksi di browser.
- Tidak menambah paginasi tabel (33 baris masih nyaman di-scroll dalam kontainer `max-h` yang sudah ada).

## Testing

- Buka `/monitoring` di layar lebar: tabel berada di baris sendiri selebar halaman, judul satu baris dengan ikon di sebelahnya (tidak mengambang), header "Komoditas Unggulan" dan "Total Omzet" tidak membungkus.
- Blok filter tab sudah tidak ada; subtitle tidak lagi menyebut "status pencatatan".
- Ketik "subang" di kotak pencarian → hanya baris Lapas Kelas IIA Subang (dan UPT lain yang mengandung kata itu) yang tampil. Kosongkan → semua 33 baris kembali.
- Ketik teks acak yang tidak ada → muncul pesan "Tidak ada UPT yang cocok dengan pencarian."
- Klik tombol sort → baris dengan omzet tertinggi (Lapas Subang, Rp 5.600.000) naik ke paling atas, label tombol berubah jadi "Urutan Nama" dan tombol tersorot. Klik lagi → kembali urut nama A-Z.
- Lakukan pencarian lalu klik sort (dan sebaliknya) → keduanya tetap berlaku bersamaan, tidak saling membatalkan.
- Cek di layar kecil (mobile): tabel tetap bisa di-scroll horizontal, kontrol search/sort tidak menumpuk berantakan.
