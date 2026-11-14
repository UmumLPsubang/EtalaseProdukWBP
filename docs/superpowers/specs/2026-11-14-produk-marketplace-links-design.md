# Desain: Link Shopee/Tokopedia per Produk + Edit Produk

**Tanggal:** 2026-11-14
**Status:** Disetujui, siap jadi implementation plan

## Latar belakang

Produk WBP sering dijual juga lewat marketplace (Shopee, Tokopedia), bukan cuma WhatsApp. User minta tiap produk bisa punya link toko online-nya sendiri, ditampilkan sebagai tombol di katalog publik berdampingan dengan tombol WhatsApp yang sudah ada (yang sumbernya dari nomor WA per-UPT, bukan per-produk).

Sekalian dengan ini, user juga minta kemampuan **edit produk** ditambahkan — sebelumnya produk cuma bisa ditambah, dinonaktifkan, atau dihapus permanen, tidak bisa diubah field-nya (nama/harga/kategori/dll) setelah tersimpan.

## Bagian 1 — Skema database

```sql
alter table produk add column if not exists shopee_link text;
alter table produk add column if not exists tokopedia_link text;
```

Tidak ada constraint format di level database (validasi `https://` cukup di sisi form/browser, konsisten dengan pendekatan validasi field lain di proyek ini seperti nomor WhatsApp UPT).

## Bagian 2 — Form Produk: tambah 2 field + jadi mode ganda (Tambah/Edit)

**Field baru** (keduanya opsional):
- Link Shopee — placeholder `https://shopee.co.id/...`
- Link Tokopedia — placeholder `https://www.tokopedia.com/...`

**Validasi**: kalau field diisi (tidak kosong), nilainya harus cocok pola `^https:\/\/.+` sebelum form bisa di-submit. Field kosong selalu valid (opsional).

**Mode ganda** — form yang sama di `dashboard-produk.html` dipakai untuk dua keperluan:
- **Mode Tambah** (default): judul "Tambah Produk", tombol "Simpan Produk", submit → `insert` ke tabel `produk` (perilaku tidak berubah dari sekarang, ditambah 2 field baru).
- **Mode Edit**: diaktifkan dengan klik tombol "Edit" pada salah satu baris di Daftar Produk (Bagian 3). Saat aktif:
  - Halaman otomatis scroll ke form di atas.
  - Semua field form (nama, kategori, harga, deskripsi, link Shopee, link Tokopedia) terisi otomatis dari data produk yang diklik.
  - Field foto **tetap kosong** (tidak bisa "mengisi ulang" input file dari browser) — kalau user tidak memilih foto baru, `image_url` lama dipertahankan; kalau memilih foto baru, upload & ganti seperti alur tambah produk.
  - Judul form berubah jadi "Edit Produk", tombol submit jadi "Simpan Perubahan".
  - Muncul tombol kecil "Batal Edit" di sebelah tombol submit, untuk keluar dari mode edit dan kembali ke form kosong mode Tambah tanpa menyimpan apa pun.
  - Submit di mode ini melakukan `update` (bukan `insert`) ke baris produk yang sedang diedit, lalu kembali ke mode Tambah (form kosong) dan refresh Daftar Produk.

## Bagian 3 — Daftar Produk: tombol Edit

Tiap baris di Daftar Produk (`dashboard-produk.html`) dapat tombol tambahan **"Edit"**, diletakkan di antara tombol Nonaktifkan/Aktifkan dan Hapus yang sudah ada. Klik tombol ini memicu mode Edit pada Bagian 2.

## Bagian 4 — Katalog publik: tombol Shopee/Tokopedia

Di `renderProdukCard(p)`, area tombol aksi (yang sekarang cuma render 1 tombol WhatsApp atau 1 teks fallback) diganti jadi bisa merender **sampai 3 tombol berdampingan**, tiap tombol muncul independen berdasarkan data yang tersedia:

- **WhatsApp** — logika tidak berubah dari sekarang (hijau `#25D366`, muncul kalau `produk.upt.whatsapp` terisi).
- **Shopee** — oranye (`#EE4D2D`), teks "Beli di Shopee", `href` = `p.shopee_link`, `target="_blank"`, muncul kalau `p.shopee_link` terisi.
- **Tokopedia** — hijau tua (`#03AC0E`), teks "Beli di Tokopedia", `href` = `p.tokopedia_link`, `target="_blank"`, muncul kalau `p.tokopedia_link` terisi.

Kalau ketiganya tidak ada satu pun yang terisi, tampilkan teks fallback yang sudah ada sekarang ("Nomor WA belum tersedia, hubungi Divisi Pemasyarakatan Kanwil Jabar."). Kalau minimal satu ada, render tombol-tombol yang datanya ada saja (berdampingan/wrap, tidak perlu grid kaku 3 kolom).

## Di luar scope

- Tidak ada validasi bahwa link Shopee/Tokopedia benar-benar domain shopee.co.id/tokopedia.com — cukup cek awalan `https://`.
- Tidak ada preview/scraping data dari link marketplace (harga/rating dari Shopee, dll) — murni link statis yang diisi manual.
- Edit produk tidak mencakup pindah kepemilikan UPT (produk tetap terikat `upt_id` yang sama, tidak ada field untuk mengubahnya, dan RLS yang ada sudah membatasi update hanya untuk UPT pemilik).

## Testing

- Tambah produk baru dengan link Shopee saja (tanpa Tokopedia) → cek di katalog cuma tombol Shopee yang muncul (+ WA kalau ada).
- Edit produk itu, tambahkan juga link Tokopedia → cek kedua tombol muncul di katalog.
- Coba isi link tanpa `https://` (misal `shopee.co.id/toko`) → submit harus ditolak dengan pesan error jelas, sebelum sempat kirim ke database.
- Klik "Edit" pada 1 produk, lalu klik "Batal Edit" tanpa submit → pastikan tidak ada perubahan tersimpan, form kembali ke mode Tambah kosong.
- Edit produk tanpa memilih foto baru → pastikan foto lama tetap tampil (tidak hilang/kosong) setelah disimpan.
