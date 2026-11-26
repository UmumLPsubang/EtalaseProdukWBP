# Panduan Pemasangan Domain

**Status: SUDAH TERPASANG.** Portal beralamat di **https://www.produkwbp-pasjabar.com** sejak 26 November 2026. Domain dibeli di Hostinger, situs di-hosting Vercel.

Dokumen ini menyimpan dua hal: catatan pengaturan yang sedang berlaku, dan langkah lengkapnya bila suatu saat domain harus dipindahkan, diganti, atau dipasang ulang.

---

## Bagian 1 — Pengaturan yang berlaku sekarang

### Alamat

| | |
|---|---|
| Alamat utama | `https://www.produkwbp-pasjabar.com` |
| Tanpa www | Dialihkan otomatis (308) ke alamat utama |
| Alamat lama | `etalase-produk-wbp.vercel.app` — masih hidup |

Alamat ber-www dipilih sebagai alamat utama, mengikuti anjuran Vercel. Konsekuensinya: setiap alamat absolut di kode (tag Open Graph, `canonical`) **harus memakai versi ber-www**. Memakai versi tanpa www membuat perayap melewati satu pengalihan lebih dahulu.

### Tempat pengelolaan

| Apa | Di mana |
|---|---|
| Kepemilikan domain & DNS | Hostinger (hPanel → Domains → DNS / Nameservers) |
| Hosting situs | Vercel (Settings → Domains) |
| Sertifikat HTTPS | Vercel, otomatis dan gratis |

Nameserver **tetap di Hostinger**. Yang diarahkan ke Vercel hanya dua record DNS.

### Record DNS yang terpasang di Hostinger

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | alamat IP dari layar Vercel | 300 |
| CNAME | `www` | subdomain `vercel-dns` dari layar Vercel | 300 |

Nilai persisnya sengaja tidak dicatat di sini. Vercel dapat mengubahnya, dan menyalin nilai usang dari dokumen adalah penyebab kegagalan paling umum. **Selalu baca dari Vercel → Settings → Domains.**

---

## Bagian 2 — Catatan kepemilikan

Domain terdaftar atas nama pribadi, sementara portal menampilkan logo kementerian. Tindakan minimum yang wajib dijaga:

- [ ] **Auto-renew menyala** di Hostinger
- [ ] Kredensial akun Hostinger tercatat di tempat yang kantor bisa akses, bukan hanya di satu kepala
- [ ] Tanggal kedaluwarsa domain tercatat
- [ ] Pemindahan kepemilikan ke instansi diagendakan

Bila domain kedaluwarsa, portal 33 UPT ikut mati — dan domain yang lepas bisa dibeli pihak lain yang lalu memakai nama itu sambil membawa branding kementerian.

---

## Bagian 3 — Langkah pemasangan (untuk pemasangan ulang di masa depan)

Perkiraan waktu: 15–30 menit, ditambah menunggu propagasi DNS. **Tidak ada downtime** — alamat lama tetap hidup sepanjang proses.

### Langkah 1 — Beli domainnya saja

Yang dibeli hanya nama domain. Situs sudah di-hosting gratis oleh Vercel. Registrar hampir pasti menawarkan tambahan berikut; sebagian besar tidak dibutuhkan:

| Tawaran | Perlu? | Alasan |
|---|---|---|
| Paket hosting / cPanel | Tidak | Situs sudah di-hosting Vercel |
| Sertifikat SSL berbayar | Tidak | Vercel menerbitkan HTTPS gratis otomatis |
| Jasa pembuatan website | Tidak | Situsnya sudah jadi |
| Email hosting | Opsional | Hanya bila butuh email `@domain` |

Periksa harga **perpanjangan tahun kedua**, bukan hanya promo tahun pertama. Selisihnya sering jauh.

### Langkah 2 — Daftarkan di Vercel

1. Vercel → proyek portal → **Settings → Domains → Add Domain**
2. Masukkan domainnya
3. Biarkan **"Redirect apex domains to www"** tercentang bila ingin alamat ber-www jadi alamat utama. Bila centang dihapus, **www harus didaftarkan terpisah** pada kolom "Add Another Domain" — kalau tidak, pengunjung yang mengetik "www" akan mendapat halaman error.
4. Biarkan **Connect to an environment → Production**. Jangan pilih "Redirect to Another Domain".
5. Klik **Add Domain**

Status akan merah **Invalid Configuration**. Itu normal: artinya DNS-nya memang belum dipasang.

### Langkah 3 — Buka DNS Zone Editor di Hostinger

hPanel → **Domains** → pilih domain → **DNS / Nameservers** → tab **DNS Records**.

### Langkah 4 — Hapus record bawaan lebih dulu ⚠️

**Ini yang paling sering terlewat.** Hostinger otomatis membuat record yang mengarahkan domain ke hosting atau halaman parkir mereka. Bila tidak dihapus, record itu bentrok dan domain kadang menampilkan halaman Hostinger, bukan portal.

Hapus atau ubah:

| Type | Name |
|---|---|
| A | `@` |
| CNAME | `www` |

**Jangan sentuh** record MX (email), TXT, atau NS.

Lebih aman **mengubah** record A yang sudah ada daripada menambah record baru. Dua record A dengan IP berbeda akan bersaing, dan domain kadang sampai ke Vercel, kadang ke Hostinger.

### Langkah 5 — Masukkan record dari Vercel

Buka tiap baris domain di Vercel (klik tanda panah di label "Invalid Configuration") untuk melihat record yang dibutuhkan. **Masing-masing domain punya record sendiri** — baris www menampilkan CNAME, baris tanpa www menampilkan A. Keduanya harus dipasang.

**Catatan praktis dari pemasangan 26 November 2026:**

- **Pakai tombol salin** di sebelah nilai, jangan diketik ulang. Nilai CNAME Vercel mengandung string acak panjang; satu huruf salah membuatnya gagal tanpa petunjuk yang jelas.
- **Titik di akhir nilai** (`...vercel-dns-017.com.`) adalah notasi standar DNS, bukan bagian dari alamat. Bila Hostinger menolak isian, hapus titik terakhirnya.
- **TTL minimum Hostinger adalah 60**, maksimum 86400. Isi **300** saat memasang: bila ada yang salah, perbaikannya menyebar ulang dalam 5 menit, bukan 4 jam seperti nilai bawaan 14400.

### Langkah 6 — Tunggu dan periksa

Kembali ke Vercel, klik ikon ⟳ di sebelah kanan tiap baris domain. Biasanya 5–30 menit sampai berubah jadi **Valid Configuration**. Sertifikat HTTPS menyusul otomatis setelahnya.

Bila setelah satu jam masih merah, periksa ulang Langkah 4 — hampir selalu karena record lama yang belum terhapus.

### Langkah 7 — Perbarui Supabase

**Langkah yang paling sering dilupakan, dan akibatnya paling terasa.**

Supabase → **Authentication → URL Configuration**:

1. **Site URL** → `https://www.produkwbp-pasjabar.com`
2. **Redirect URLs** → tambahkan `https://www.produkwbp-pasjabar.com/**`
3. Biarkan alamat `.vercel.app` lama tetap ada selama masa transisi

Bila dilewati: login UPT dan Super Admin bisa terlempar balik ke alamat lama, dan fitur ganti password gagal.

### Langkah 8 — Perbarui alamat absolut di kode

Sebagian besar kode memakai path relatif (`/monitoring`, `/dashboard`) dan ikut domain apa pun secara otomatis. Yang **tidak** otomatis adalah alamat absolut di `<head>` halaman depan:

- `<link rel="canonical">`
- `og:url`
- `og:image` dan `twitter:image`

Keempatnya ada di `index.html` dan harus memakai alamat utama yang berlaku.

### Langkah 9 — Alihkan alamat lama

Alamat `.vercel.app` tetap hidup dan tidak bisa dimatikan. Supaya tidak ada dua alamat beredar, tambahkan satu entri pada `redirects` di `vercel.json`:

```json
{
  "source": "/(.*)",
  "has": [{ "type": "host", "value": "etalase-produk-wbp.vercel.app" }],
  "destination": "https://www.produkwbp-pasjabar.com/$1",
  "permanent": true
}
```

> Catatan: per 26 November 2026 pengalihan ini **belum dipasang**. Kedua alamat masih hidup bersamaan.

---

## Bagian 4 — Pratinjau saat link dibagikan

Supaya link yang dibagikan di WhatsApp menampilkan nama situs dan logo, bukan alamat mentah, `index.html` memuat tag Open Graph di `<head>`: `og:title`, `og:description`, `og:image`, `og:url`, ditambah padanan `twitter:` dan `<meta name="description">`.

Gambar pratinjaunya: `assets/img/og-cover.png`, ukuran 1200×630, sekitar 78 KB.

**Dua aturan yang tidak boleh dilanggar:**

1. **Alamat `og:image` harus absolut dan lengkap** (`https://...`). Perayap tidak punya konteks halaman untuk menebak alamat relatif — alamat relatif berarti pratinjaunya tidak bergambar.
2. **Pakai alamat utama** (ber-www). Memakai versi tanpa www memaksa perayap melewati satu pengalihan lebih dahulu.

### Pratinjau tidak berubah setelah diperbaiki?

**WhatsApp dan Facebook menyimpan hasil pembacaan sebuah alamat selama berhari-hari.** Ini sering disalahartikan sebagai perbaikan yang gagal. Tiga cara mengatasinya:

1. **Tunggu deploy selesai dulu** sebelum menguji. Bila perayap membaca halaman sebelum Vercel selesai, ia menyimpan versi lama yang masih polos.
2. **Uji dengan alamat yang sedikit berbeda**, misalnya `https://www.produkwbp-pasjabar.com/?v=1`. Perayap menganggapnya alamat baru dan membaca ulang.
3. **Paksa segarkan** lewat `developers.facebook.com/tools/debug` — tempel alamatnya, klik **Scrape Again**. WhatsApp memakai perayap yang sama dengan Facebook, jadi sekali scrape membersihkan keduanya.

---

## Bagian 5 — Daftar periksa setelah migrasi

- [ ] Buka alamat utama — katalog produk muncul
- [ ] Ikon gembok HTTPS aktif, tanpa peringatan keamanan
- [ ] Buka alamat tanpa www — dialihkan ke alamat utama
- [ ] Ikon situs (favicon) muncul di tab browser
- [ ] Bagikan link ke diri sendiri di WhatsApp — muncul nama situs dan gambar, bukan alamat mentah
- [ ] Foto produk tetap tampil (disimpan di Supabase Storage, alamatnya terpisah)
- [ ] Login UPT di `/login` — masuk ke dashboard, **tidak** terlempar ke alamat lama
- [ ] Buka `/dashboard-produk` — daftar produk muncul
- [ ] Buka `/dashboard-penjualan` — riwayat transaksi muncul
- [ ] Ganti password di `/dashboard-profil` — berhasil, lalu login ulang dengan password baru
- [ ] Login Super Admin di `/admin-login` — semua tab terbuka
- [ ] Buka `/monitoring` tanpa login (jendela penyamaran) — dialihkan ke halaman login

Bila ada yang gagal, periksa Langkah 7 lebih dulu — mayoritas masalah setelah ganti domain berasal dari pengaturan Supabase yang belum diperbarui.

---

## Bagian 6 — Yang masih perlu diperbarui

- [ ] Pengalihan `.vercel.app` → domain baru di `vercel.json` (Langkah 9)
- [ ] Manual book `Panduan-Dashboard-UPT-Karya-WBP-Jabar-Juara.docx` dan `.pptx` — masih memuat alamat `.vercel.app` dan nomor telepon lama (022) 7208146, yang seharusnya **(021) 7214472**
- [ ] Materi cetak, brosur, dan postingan media sosial yang terlanjur memakai alamat lama
