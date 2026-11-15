# Desain: Tab Produk — Dashboard Super Admin Kanwil

**Tanggal:** 2026-11-15
**Status:** Disetujui, siap jadi implementation plan

## Latar belakang

Dashboard Super Admin Kanwil (dibangun sebelumnya: Overview, Kelola UPT, Transaksi, Analytics) belum punya cara melihat produk-produk yang sudah didaftarkan oleh seluruh 33 UPT dalam satu tempat. Kanwil perlu bisa memantau produk lintas-UPT dan menonaktifkan produk bermasalah (misal salah input, foto tidak layak) tanpa harus menghubungi UPT yang bersangkutan satu per satu.

## Bagian 1 — Kemampuan & Arsitektur

Tab baru **"Produk"** ditambahkan sebagai tab ke-5 di `super-admin-dashboard.html`, sejajar dengan Overview/Kelola UPT/Transaksi/Analytics.

**Kemampuan Super Admin di tab ini (scope final, setelah revisi dari draf awal):**
- Melihat semua produk dari 33 UPT dalam satu tabel.
- Mengaktifkan/menonaktifkan produk (toggle `status`).
- Mengganti foto produk.
- **Di luar scope:** edit nama/harga/kategori/deskripsi, dan hapus permanen — kedua hal itu tetap hanya bisa dilakukan oleh UPT pemilik produk dari dashboard mereka sendiri.

**RPC baru:** `admin_update_produk(p_produk_id uuid, p_status text, p_image_url text)` — pola `SECURITY DEFINER` yang sama dengan `admin_update_upt` (migrasi sebelumnya):
- Mengecek `is_super_admin()` (helper yang sudah ada) sebelum menulis.
- Mengambil snapshot produk sebelum update, lalu insert ke `admin_activity_log` dengan `action = 'edit_produk'`, `target_type = 'produk'`, before/after snapshot.
- Dipanggil untuk kedua jenis perubahan (toggle status saja, atau ganti foto saja) — parameter yang tidak berubah dikirim dengan nilai existing-nya dari cache di browser (pola yang sama seperti `admin_update_upt` dipanggil dari `toggleLockUpt`).

**Storage — policy baru untuk ganti foto:** Policy upload foto yang sudah ada (`"UPT bisa upload foto produk sendiri"`) membatasi folder tujuan sama dengan `upt_id` milik pengunggah. Super admin perlu upload ke folder UPT mana pun. Ditambahkan policy baru:
```sql
create policy "Super admin bisa upload foto ke folder UPT manapun" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'produk-images'
    and is_super_admin()
  );
```
Ini tidak mengubah atau mempersempit policy UPT yang sudah ada — hanya menambah izin baru yang berlaku saat `is_super_admin()` benar.

**Alur ganti foto (client-side):** pilih file baru di modal → upload ke Storage di path `produk-images/<upt_id milik produk>/<nama file>` (pola path yang sama seperti UPT sendiri upload) → ambil public URL hasil upload → panggil RPC `admin_update_produk` dengan `p_image_url` baru (dan `p_status` tetap nilai lama) → refresh tabel.

Foto lama di Storage **tidak dihapus otomatis** saat diganti — konsisten dengan keterbatasan yang sudah diketahui sebelumnya di proyek ini (foto produk yang dihapus permanen juga meninggalkan file yatim di Storage; dirapikan secara manual kalau diperlukan, di luar scope ini).

## Bagian 2 — Tampilan & Interaksi Tabel

**Header tab:** judul "Produk Seluruh UPT" + baris kontrol filter:
- Input search bebas (cocokkan nama produk ATAU nama UPT pemilik, client-side terhadap data yang sudah ter-fetch — pola yang sama seperti tab Transaksi)
- Dropdown filter UPT (opsi "Semua UPT" + 33 nama UPT) — server-side (`.eq("upt_id", ...)`)
- Dropdown filter Kategori (opsi "Semua Kategori" + daftar kategori unik yang benar-benar ada di data produk) — server-side
- Dropdown filter Status (Semua/Aktif/Nonaktif) — server-side

Ketiga filter dropdown dan search bekerja bersamaan (AND) — pola yang sama seperti tab Kelola UPT dan Transaksi.

**Kolom tabel:** Foto (thumbnail kecil `w-10 h-10 object-cover rounded`, placeholder ikon kalau `image_url` kosong), Nama Produk, UPT Pemilik, Kategori, Harga (format Rupiah), Status (badge warna), Aksi.

**Aksi per baris:**
- Tombol **Aktifkan** / **Nonaktifkan** (label berganti sesuai status saat ini) — `confirm()` lalu panggil `admin_update_produk` dengan `p_status` dibalik, `p_image_url` tetap nilai lama.
- Tombol **Ganti Foto** — membuka modal kecil berisi `<input type="file" accept="image/*">` + tombol Upload. Validasi tipe file `image/*` di sisi klien sebelum upload (pola yang sama seperti form tambah produk UPT yang sudah ada). Saat upload berhasil, modal menampilkan preview foto baru lalu menutup otomatis dan me-refresh tabel.

**Paginasi:** 50 baris per halaman + tombol "Muat lebih banyak" di bawah tabel, pola yang identik dengan tab Transaksi. Mengubah filter/search mereset ke halaman pertama dan mengganti (bukan menambah) isi tabel; "Muat lebih banyak" menambah baris ke bawah.

## Di luar scope

- Edit nama/harga/kategori/deskripsi produk oleh super admin — tetap hanya UPT pemilik yang bisa.
- Hapus permanen produk oleh super admin — tetap hanya UPT pemilik yang bisa.
- Pembersihan otomatis foto lama di Storage saat foto diganti atau produk dihapus — keterbatasan yang sudah ada sebelumnya di proyek ini, tidak diperluas atau diperbaiki di sini.
- Perubahan pada RLS/policy UPT yang sudah ada untuk tabel `produk` atau `storage.objects` — hanya menambah policy baru untuk `super_admin`.

## Testing

- Buka tab Produk: tabel menampilkan produk dari berbagai UPT, dengan foto, kategori, harga, status yang benar.
- Filter per UPT → hanya produk UPT itu yang tampil. Filter per kategori → hanya kategori itu. Filter status → sesuai. Kombinasi filter + search bekerja bersamaan.
- Klik Nonaktifkan pada satu produk aktif → status berubah jadi Nonaktif, `admin_activity_log` mencatat `edit_produk` dengan before/after. Refresh halaman produk publik (`index.html`) → produk itu hilang dari katalog publik (karena hanya produk `status = 'aktif'` yang ditampilkan di sana, perilaku yang sudah ada).
- Klik Ganti Foto pada satu produk → pilih file baru → upload berhasil → foto di tabel berubah, `admin_activity_log` mencatat perubahan `image_url`.
- Login sebagai UPT biasa, coba panggil `admin_update_produk` lewat API langsung (bukan lewat UI) → ditolak karena bukan super admin.
- 50+ baris produk → "Muat lebih banyak" menambah baris tanpa duplikasi/lompat data.
