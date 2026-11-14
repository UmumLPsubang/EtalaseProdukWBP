# Desain: Dashboard Super Admin Kanwil

**Tanggal:** 2026-11-15
**Status:** Disetujui, siap jadi implementation plan

## Latar belakang

Saat ini sistem hanya punya dua level akses: UPT (login per Lapas/Rutan, hanya bisa kelola data sendiri) dan publik (catalog + monitoring read-only). Tidak ada cara bagi Kanwil Kemenimipas Jawa Barat untuk mengelola data lintas 33 UPT. Ini jadi masalah nyata: data dummy/testing dari sesi pengembangan (misal transaksi Lapas Subang dengan `produk_id` null) tidak bisa dihapus karena tidak ada mekanisme admin yang bisa menulis ke UPT lain. Selain itu, Kanwil butuh gambaran performa 33 UPT yang lebih rinci dari monitoring publik (yang sengaja dibuat terbatas dan jujur-kosong untuk konsumsi publik).

## Bagian 1 — Autentikasi & Otorisasi

**Login terpisah:** Halaman baru `/admin-login`, terpisah total dari `/login` milik UPT. Form email + password. Setelah sukses, redirect ke `/super-admin-dashboard`. Logout mengembalikan ke `/admin-login`.

**Identitas:** Akun super admin adalah baris `profiles` dengan `role = 'super_admin'` — bukan akun salah satu UPT yang diberi privilege tambahan (ditolak saat brainstorming), dan bukan tabel `admins` terpisah (ditolak juga). Satu kolom `role` yang sudah ada di `profiles` cukup untuk membedakan `'upt'` vs `'super_admin'`.

**Guard halaman:** Skrip baru `assets/js/super-admin-dashboard.js` dengan `requireSuperAdminSession()` — mengecek sesi Supabase Auth ada, lalu fetch profile dan verifikasi `role === 'super_admin'`; kalau gagal (tidak ada sesi, atau role salah), sign out dan redirect ke `/admin-login`. Pola ini meniru `requireUptSession()` yang sudah ada di `assets/js/upt-dashboard.js`.

**RLS di Supabase:** Policy baru di setiap tabel (`upt`, `produk`, `transaksi_penjualan`) yang mengizinkan baris dengan `role = 'super_admin'` di `profiles` untuk SELECT/UPDATE/DELETE tanpa batasan `upt_id`, berdampingan dengan policy UPT yang sudah ada (yang tetap dibatasi `upt_id` milik sendiri). Tidak menghapus atau mengubah policy UPT yang sudah ada.

## Bagian 2 — Skema Database Baru

**Tabel `admin_activity_log`** (dibuat sekarang, tanpa UI — siap untuk Bagian 8 di masa depan):
```sql
create table admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references profiles(id),
  action text not null,        -- 'delete_transaction' | 'edit_upt' | 'reset_password' | 'lock_upt' | 'unlock_upt' | 'delete_product'
  target_type text not null,   -- 'upt' | 'produk' | 'transaksi_penjualan'
  target_id uuid,
  changes jsonb,                -- snapshot sebelum/sesudah, nullable
  created_at timestamptz not null default now()
);
```
RLS: hanya `role = 'super_admin'` yang bisa INSERT dan SELECT dari tabel ini.

**Kolom tambahan pada `upt`:** kolom `locked boolean not null default false` — dipakai tombol Lock/Unlock di Bagian 5. Saat `locked = true`, login UPT tetap sukses secara Auth tapi `requireUptSession()` harus ditambah pengecekan ini dan redirect ke halaman "Akun dikunci, hubungi Kanwil" (detail di Bagian 5).

Tidak ada perubahan skema lain — `produk` dan `transaksi_penjualan` sudah punya semua kolom yang dibutuhkan.

## Bagian 3 — Layout & Navigasi Dashboard

Satu halaman `super-admin-dashboard.html`:
- **Header** — identik gaya `monitoring.html` (logo kiri, nav kanan), tapi nav hanya berisi tombol Logout (tidak ada link publik).
- **Tab menu** di bawah header: `Overview | Kelola UPT | Transaksi | Analytics`. Klik tab mengganti konten tanpa reload (empat `<div>` section, toggle `hidden` class via JS — pola sederhana, konsisten dengan situs ini yang tanpa framework/router).
- **Responsif:** tab menu horizontal di desktop; di mobile, tab bisa di-scroll horizontal (`overflow-x-auto`), konsisten dengan pola scroll horizontal tabel yang sudah ada di `monitoring.html`.

## Bagian 4 — Tab Overview

Re-use penuh logika agregasi dari `monitoring.html` (`loadKpiCards`, `loadMonitoringAggregates`, `renderChannelDonut`, `renderKategoriKomposisi`, `renderWilayahDistribusi`) — sama persis 4 baris (KPI cards → donut+kategori sejajar → wilayah full width → tabel 33 UPT full width), dipindah/disalin ke `super-admin-dashboard.js` tanpa pembatasan filter (semua 33 UPT selalu tampil, tidak ada mock filter tab).

**Perbedaan dari monitoring publik:** kolom tambahan **Aksi** di tabel UPT dengan 4 tombol: `Detail` (modal sama seperti monitoring publik), `Edit`, `Reset Password`, `Lock/Unlock` — ketiga tombol baru membuka/menjalankan aksi dari Bagian 5 langsung dari baris ini (shortcut), tanpa harus pindah tab ke "Kelola UPT".

## Bagian 5 — Tab Kelola UPT

Tabel 33 UPT dengan kolom: Kode Satker, Nama, Wilayah, WhatsApp, Status (Aktif/Nonaktif/Locked), Aksi.

**Search & filter:** input search (cocokkan nama/kode/wilayah, pola sama seperti `upt-search-input` di monitoring), filter dropdown Status (Semua/Aktif/Nonaktif/Locked).

**Aksi per baris:**
- **Edit** → modal form dengan field Nama, Wilayah, WhatsApp, toggle Status Aktif/Nonaktif. Submit → `update upt set ... where id = ...`, insert log ke `admin_activity_log` dengan `changes` berisi `{before: {...}, after: {...}}`.
- **Reset Password** → panggil `supabase.auth.admin.resetPasswordForEmail` **tidak bisa dipakai dari client** (butuh service role) — jadi ini butuh satu **Supabase Edge Function** (`reset-upt-password`) yang menerima `upt_id`, generate password acak baru, panggil Admin API dengan service role key (server-side, aman), kembalikan password baru ke client untuk ditampilkan sekali di modal ("Password baru: `xxxxx` — salin dan kirim ke UPT, tidak akan ditampilkan lagi"). Insert log ke `admin_activity_log`.
- **Lock/Unlock** → toggle kolom `upt.locked`. Saat locked, `requireUptSession()` di `upt-dashboard.js` ditambah pengecekan: fetch `upt.locked` dari profile UPT yang login, kalau `true` → sign out + alert "Akun dikunci oleh Kanwil, hubungi admin" + redirect ke `/login`. Insert log.
- **Delete (soft-delete)** → set `upt.status = 'nonaktif'` (bukan hard delete row — UPT tidak pernah dihapus permanen, hanya dinonaktifkan, supaya riwayat transaksi tetap valid secara referensial). Ini sebenarnya sama dengan toggle status di tombol Edit — tombol Delete terpisah dihapus dari scope untuk menghindari duplikasi aksi; soft-delete dilakukan via toggle Status di modal Edit.

*(Catatan scope: bulk action yang disebut saat brainstorming didrop dari fase ini — 33 baris masih nyaman dikelola satu-satu, dan bulk action menambah kompleksitas UI yang belum perlu.)*

## Bagian 6 — Tab Transaksi

Tabel semua transaksi dari 33 UPT, urut `tanggal_transaksi` terbaru dulu. Kolom: Tanggal, UPT, Produk (dengan label "Produk sudah dihapus" untuk `produk_id` null, konsisten dengan pola di `monitoring.html`), Jumlah, Total Harga, Channel, Aksi.

**Filter:** dropdown UPT (Semua + 33 nama), dropdown Channel (Semua/WhatsApp/Shopee/Tokopedia/Offline/Lainnya), date range (dari–sampai, pakai `<input type="date">` native). Search bebas (cocokkan nama UPT/nama produk).

**Paginasi:** 50 baris per halaman, tombol "Muat lebih banyak" di bawah tabel (bukan numbered pagination — lebih sederhana untuk data yang terus bertambah).

**Aksi:**
- **Detail** → modal baca-saja menampilkan seluruh kolom transaksi itu.
- **Delete** → konfirmasi (`confirm()` dialog browser, pola yang sudah dipakai di situs ini untuk hapus produk) → `delete from transaksi_penjualan where id = ...` → insert log dengan `changes` berisi snapshot baris yang dihapus (supaya `admin_activity_log` tetap punya rekam jejak meski baris aslinya sudah hilang).

## Bagian 7 — Tab Analytics

Lima section, semua dihitung dari data yang sudah di-fetch Bagian 4 (`window.__uptAggregateData` — tidak ada query Supabase tambahan):

1. **Top UPT Ranking** — tabel Rank/Nama/Omzet/Volume/Growth%, sortable (klik header kolom). *Growth % vs bulan lalu: ditandai sebagai honest-placeholder "Belum ada data histori bulanan" sampai agregasi bulanan "asli" dibangun (sama seperti chart tren di monitoring publik — ini keterbatasan data yang sudah diketahui, bukan baru).* Sort by Omzet dan Volume tetap berfungsi penuh sekarang.
2. **Performa per Wilayah** — tabel Wilayah/Total Omzet/Jumlah UPT/Rata-rata Omzet per UPT/Status — reuse data dari `renderWilayahDistribusi`.
3. **Channel Distribution** — reuse `renderChannelDonut` persis.
4. **Product Performance** — tabel Kategori/Jumlah Produk Aktif/Total Volume/Total Omzet — reuse data dari `renderKategoriKomposisi`, ditambah kolom volume & omzet per kategori (perhitungan baru: `sum(jumlah)`/`sum(total_harga)` transaksi yang produknya masuk kategori itu).
5. **Monthly Trend** — honest placeholder sama seperti di monitoring publik, sampai agregasi bulanan dibangun.

## Bagian 8 — Activity Logging (dibangun sekarang, UI ditunda)

Tabel `admin_activity_log` (Bagian 2) dan insert log di setiap aksi tulis (Bagian 5 & 6) dibangun di fase ini. **Tidak ada tab "Activity Log" di UI pada fase ini** — itu ditunda ke revisi terpisah setelah sistem berjalan dan kanwil benar-benar butuh melihat riwayatnya. Keputusan ini supaya data log sudah terkumpul sejak hari pertama, meski belum ada tempat melihatnya.

## Di luar scope

- Tab "Activity Log" UI — ditunda, hanya logging backend yang dibangun.
- Bulk action (lock/unlock massal, dsb.) di tabel Kelola UPT.
- Tombol Delete UPT permanen (hard delete) — hanya soft-delete via toggle status.
- Growth % bulanan "asli" dan chart tren bulanan — masih honest-placeholder, menunggu fitur agregasi bulanan terpisah (sudah tercatat sebagai item tertunda sejak revisi monitoring sebelumnya).
- Perubahan pada RLS/akses UPT yang sudah ada — hanya menambah policy baru untuk `super_admin`, tidak menyentuh policy UPT.
- Multi-kanwil / multi-tenant di atas level kanwil — sistem ini dibangun untuk satu Kanwil Jawa Barat dan 33 UPT-nya saja.

## Testing

- Login ke `/admin-login` dengan akun `role = 'super_admin'` → berhasil masuk ke `/super-admin-dashboard`. Login dengan akun UPT biasa di halaman ini → ditolak.
- Tab Overview: 33 UPT tampil semua, KPI/donut/kategori/wilayah sama dengan monitoring publik tapi tabel punya kolom Aksi dengan 4 tombol berfungsi.
- Tab Kelola UPT: edit nama Lapas Subang → tersimpan, muncul di `admin_activity_log`. Reset password → password baru tampil sekali, UPT bisa login dengan password baru itu. Lock UPT → UPT itu gagal akses dashboard dan diarahkan ke pesan terkunci; Unlock → UPT bisa masuk lagi.
- Tab Transaksi: hapus transaksi dummy (produk_id null milik Lapas Subang) → baris hilang dari tabel ini dan dari Overview; `admin_activity_log` mencatat snapshot data yang dihapus. Filter by UPT/Channel/tanggal bekerja gabungan.
- Tab Analytics: Top UPT Ranking terurut benar by omzet; Performa Wilayah/Channel/Product Performance menunjukkan angka yang konsisten dengan Tab Overview.
- `admin_activity_log` terisi untuk setiap aksi tulis (edit UPT, reset password, lock/unlock, delete transaksi) — belum ada UI untuk melihatnya, verifikasi lewat Supabase Table Editor.
