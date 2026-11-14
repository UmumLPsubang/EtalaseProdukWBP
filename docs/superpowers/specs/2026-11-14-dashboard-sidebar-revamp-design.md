# Desain: Dashboard UPT jadi Sidebar Multi-Halaman + List/Hapus Produk + Jumlah Terjual di Katalog

**Tanggal:** 2026-11-14
**Status:** Disetujui, siap jadi implementation plan

## Latar belakang

`input-produk.html` saat ini 1 halaman panjang berisi semua: form produk, nomor WA, form penjualan manual, upload CSV, dan riwayat transaksi. User minta dipecah jadi beberapa menu terpisah dengan navigasi sidebar (referensi visual: sidebar navy gelap, icon + label, mirip panel admin lain yang pernah dilihat user — bukan menu-menu di referensi itu yang dipakai, cuma gaya layoutnya).

Juga ditambahkan 2 kebutuhan baru:
- Halaman Produk belum punya **daftar produk yang sudah terdaftar** dengan opsi nonaktifkan/hapus — selama ini cuma ada form tambah, tidak ada cara melihat/mengelola produk yang sudah diinput.
- Katalog publik (`index.html`) belum menampilkan **jumlah terjual** per produk, cuma harga.

## Bagian 1 — Struktur halaman & sidebar

4 halaman baru menggantikan `input-produk.html` (yang akan dihapus):

| File | Isi | Menjadi landing setelah login? |
|---|---|---|
| `dashboard.html` | Ringkasan 4 KPI | Ya |
| `dashboard-produk.html` | Form tambah produk (dipindah dari `input-produk.html`) + daftar produk + nonaktifkan/aktifkan + hapus | Tidak |
| `dashboard-penjualan.html` | Form manual + upload CSV + riwayat transaksi (dipindah apa adanya) | Tidak |
| `dashboard-profil.html` | Field nomor WhatsApp (dipindah apa adanya) | Tidak |

**Sidebar** (sama persis di 4 halaman, markup disalin tiap halaman — situs ini tidak punya sistem template/include, konsisten dengan pola yang sudah ada di seluruh situs):
- Header: ikon/logo + "Panel UPT" + nama UPT yang login
- 4 menu dengan ikon: Dashboard, Produk, Penjualan, Profil — menu yang sesuai halaman aktif di-highlight (background lebih terang)
- Bagian bawah sidebar: nama + kode UPT yang login, link "Lihat Katalog" (ke `/`), tombol "Keluar"
- Warna: navy gelap (`#00102d`/`#0f254a`, sudah dipakai di situs ini), teks putih/abu-abu muda, item aktif disorot kuning/amber (konsisten dengan aksen emas yang sudah dipakai di `monitoring.html`/`login.html`)

**Auth helper bersama** — `/assets/js/upt-dashboard.js` (file baru), menyediakan:
- `async function requireUptSession()` — cek sesi login via `supabaseClient.auth.getSession()`, kalau tidak ada redirect ke `/login`; kalau ada, fetch dari `profiles` join `upt` (nama, kode, whatsapp), lalu kembalikan `{ uptId, nama, kode, whatsapp }`. Dipanggil di awal tiap 4 halaman dashboard.
- `function renderSidebar(activePage, uptInfo)` — isi elemen sidebar yang sudah ada di markup HTML tiap halaman (nama UPT, highlight menu aktif) dan pasang event listener tombol "Keluar" (`supabaseClient.auth.signOut()` lalu redirect `/login`).

`login.html` diubah: redirect setelah login sukses dari `/input-produk` jadi `/dashboard`.

## Bagian 2 — Halaman Dashboard (ringkasan)

4 kartu KPI (gaya visual sama seperti KPI card di `monitoring.html`):

1. **Total Produk Aktif** — `count(*) from produk where upt_id = own and status = 'aktif'`
2. **Total Unit Terjual** — `sum(jumlah) from transaksi_penjualan where upt_id = own`
3. **Total Omzet** — `sum(total_harga) from transaksi_penjualan where upt_id = own`
4. **Transaksi Bulan Ini** — `count(*) from transaksi_penjualan where upt_id = own and tanggal_transaksi` di bulan & tahun berjalan (dibandingkan di JS setelah fetch, bukan filter SQL date-range yang rumit — cukup fetch semua milik UPT itu lalu filter tanggal di browser, karena jumlah transaksi per UPT masih kecil di tahap ini)

Tidak ada chart/tabel tambahan di halaman ini — murni 4 angka.

## Bagian 3 — Halaman Produk: list + nonaktifkan/aktifkan + hapus

Di bawah form tambah produk yang sudah ada (dipindah apa adanya dari `input-produk.html`, tanpa perubahan logika), tambah section baru "Daftar Produk":

- Fetch **semua** produk milik UPT yang login (aktif maupun nonaktif) — beda dari katalog publik yang cuma fetch yang aktif.
- Render sebagai list/card kecil per produk: thumbnail foto (atau placeholder kalau tidak ada), nama, kategori, harga, badge status berwarna (hijau "Aktif" / abu-abu "Nonaktif").
- 2 tombol per item:
  - **Nonaktifkan/Aktifkan** (teks tombol berubah sesuai status saat ini) — `update produk set status = <kebalikannya> where id = ...`. Tidak perlu SQL baru — policy `"UPT bisa ubah produk sendiri"` di `docs/supabase-auth-setup.sql` sudah mengizinkan ini.
  - **Hapus Permanen** — tampilkan `confirm()` dialog browser dulu ("Yakin hapus [nama produk]? Transaksi lama yang pernah pakai produk ini akan kehilangan nama produknya. Tindakan ini tidak bisa dibatalkan.") sebelum `delete from produk where id = ...`. Policy `"UPT bisa hapus produk sendiri"` sudah ada, tidak perlu SQL baru.
- Setelah nonaktifkan/aktifkan/hapus, daftar di-refresh otomatis tanpa reload halaman. Daftar produk juga di-refresh setelah form tambah produk baru berhasil submit (pola yang sama seperti refresh dropdown penjualan yang sudah ada).
- Foto produk yang dihapus **tidak** ikut dihapus dari Supabase Storage (di luar scope — file jadi "yatim" di storage, biaya penyimpanannya kecil, bisa dibersihkan manual nanti kalau perlu).

## Bagian 4 — Halaman Penjualan

Pemindahan murni dari `input-produk.html`: form manual (dropdown produk, jumlah, total harga, channel, tanggal), upload CSV (download template, proses upload, ringkasan hasil), dan tabel riwayat transaksi. Tidak ada perubahan logika — hanya lokasi file dan penggunaan `requireUptSession()`/`renderSidebar()` dari helper bersama menggantikan kode auth yang sebelumnya inline.

Catatan: dropdown produk di form manual sekarang HARUS hanya menampilkan produk berstatus **aktif** milik UPT ini (sebelumnya menampilkan semua produk tanpa filter status — belum relevan karena belum ada konsep nonaktif). Produk yang baru dinonaktifkan di halaman Produk otomatis hilang dari dropdown ini kalau halaman di-reload (tidak perlu sinkronisasi real-time antar tab/halaman, cukup di-fetch ulang tiap halaman penjualan dibuka).

## Bagian 5 — Halaman Profil UPT

Pemindahan murni field nomor WhatsApp dari `input-produk.html`, logika validasi format (`^62\d{8,13}$`) dan simpan ke `upt.whatsapp` tidak berubah.

## Bagian 6 — Katalog publik (`index.html`): jumlah terjual

Di `renderProdukCard(p)`, tambah badge di bawah harga:
- Hitung total `jumlah` dari `transaksi_penjualan` untuk `produk_id` itu, semua channel, sepanjang waktu.
- Kalau total > 0: badge "`<total>` terjual" (gaya badge kecil, misal hijau muda, konsisten dengan badge lain di situs).
- Kalau total = 0 (belum ada transaksi apa pun): tampil teks "Belum ada penjualan" (bukan "0 terjual").

Cara ambil data: di `loadKatalogProduk()`, setelah fetch `produk`, fetch juga `transaksi_penjualan` (`select produk_id, jumlah`) — ini tabel yang publicly readable (`docs/decisions/2026-11-14-transaksi-public-read-access.md`). Jumlahkan per `produk_id` jadi sebuah `Map` di JavaScript, lalu dipakai saat render tiap kartu.

## Di luar scope (sengaja tidak dikerjakan sekarang)

- Membersihkan file foto di Supabase Storage saat produk dihapus.
- Sinkronisasi real-time dropdown produk antar tab yang terbuka bersamaan.
- Halaman Dashboard ringkasan tidak punya chart/tren, cuma 4 angka.
- "Jumlah terjual" di katalog bukan agregat server-side (view/RPC) — masih dihitung di browser dari seluruh baris `transaksi_penjualan`. Cukup untuk skala saat ini (33 UPT, data masih sedikit); kalau nanti data membengkak, perlu dipindah ke agregat server-side.

## Testing

- Login 1 UPT, cek 4 halaman dashboard bisa diakses lewat sidebar, menu aktif ter-highlight sesuai halaman.
- Di halaman Produk: tambah produk baru, cek muncul di daftar; nonaktifkan, cek hilang dari katalog publik DAN dari dropdown di halaman Penjualan; aktifkan lagi, cek muncul lagi di keduanya; hapus permanen 1 produk yang tidak punya riwayat transaksi, cek hilang dari daftar.
- Di halaman Dashboard: cocokkan 4 angka KPI dengan data yang sebenarnya ada (hitung manual, bandingkan).
- Di katalog publik: cek badge "X terjual" muncul benar sesuai total transaksi yang sudah diinput sebelumnya di sesi testing fitur penjualan (dari percakapan sebelumnya, sudah ada beberapa transaksi tersimpan untuk produk "Kopi Robusta").
- Logout dari salah satu halaman dashboard, pastikan ke-4 halaman redirect ke `/login` kalau diakses tanpa sesi.
