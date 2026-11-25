# Panduan Pemasangan Domain Kustom

Portal Karya WBP Jabar saat ini beralamat di `etalase-produk-wbp.vercel.app`. Dokumen ini adalah langkah demi langkah untuk menggantinya dengan domain sendiri (misalnya `namadomainanda.id`).

**Tidak ada downtime.** Alamat `.vercel.app` yang sekarang tetap hidup dan bisa diakses selama seluruh proses berlangsung. Domain baru baru akan menampilkan situs setelah semua langkah selesai, jadi tidak ada risiko portal mati di tengah jalan.

Perkiraan waktu: 15–30 menit mengerjakan, ditambah menunggu propagasi DNS yang bisa beberapa menit sampai beberapa jam.

---

## Sebelum mulai: catatan kepemilikan domain

Domain ini akan dibeli atas nama pribadi, sementara portalnya menampilkan logo Kementerian Imigrasi dan Pemasyarakatan serta menyebut Kanwil Jawa Barat. Dua risiko yang nyata:

1. Kalau domain lupa diperpanjang atau pemegang akunnya pindah tugas, portal resmi 33 UPT ikut mati — dan domain yang kedaluwarsa bisa dibeli pihak lain yang lalu memakai nama itu sambil membawa-bawa branding kementerian.
2. Aset digital instansi yang terdaftar atas nama perorangan sulit dipertanggungjawabkan secara administratif.

Tindakan minimum yang wajib dilakukan:

- [ ] Nyalakan **auto-renew** di registrar
- [ ] Catat kredensial akun registrar di tempat yang kantor bisa akses, bukan hanya di satu kepala
- [ ] Catat tanggal kedaluwarsa domain
- [ ] Agendakan pemindahan kepemilikan ke instansi kalau portal sudah berjalan mapan

---

## Langkah 1 — Beli domainnya saja, bukan hosting

Registrar adalah tempat jual-beli nama domain: Niagahoster, Rumahweb, Domainesia, Namecheap, Cloudflare, dan sejenisnya.

Yang dibeli **hanya nama domain**. Situsnya sudah di-hosting gratis oleh Vercel.

Saat proses pembelian, registrar hampir pasti menawarkan tambahan berikut. Sebagian besar tidak dibutuhkan:

| Tawaran | Perlu? | Alasan |
|---|---|---|
| Paket hosting / cPanel | Tidak | Situs sudah di-hosting Vercel |
| Sertifikat SSL berbayar | Tidak | Vercel menerbitkan SSL gratis secara otomatis |
| Jasa pembuatan website | Tidak | Situsnya sudah jadi |
| Email hosting | Opsional | Hanya kalau memang butuh email `@namadomainanda.id` |
| Domain privacy / WHOIS protection | Opsional | Menyembunyikan data pemilik dari pencarian publik |

Perhatikan juga harga **perpanjangan** tahun kedua, bukan hanya harga promo tahun pertama. Selisihnya sering jauh.

---

## Langkah 2 — Daftarkan domain di Vercel

1. Masuk ke [vercel.com](https://vercel.com) dan buka proyek portal ini
2. Masuk ke **Settings → Domains**
3. Klik **Add Domain**, ketik nama domain yang sudah dibeli, lalu **Add**
4. Vercel akan menampilkan record DNS yang harus dipasang — biasanya dua baris:
   - satu record bertipe **A** untuk domain utama (`namadomainanda.id`)
   - satu record bertipe **CNAME** untuk versi www (`www.namadomainanda.id`)

> **Penting:** pakai nilai yang **persis ditampilkan di layar Vercel Anda**. Jangan menyalin alamat IP atau CNAME dari tutorial mana pun, termasuk dokumen ini — nilainya bisa berbeda antar proyek dan bisa berubah sewaktu-waktu. Menyalin angka usang adalah penyebab paling umum domain gagal tersambung.

Biarkan halaman ini terbuka; nilainya akan disalin di langkah berikutnya.

---

## Langkah 3 — Pasang record DNS di registrar

DNS adalah buku alamat internet: ia memberi tahu browser, server mana yang harus dihubungi ketika seseorang mengetik nama domain Anda. Memasang record DNS berarti menulis alamat Vercel ke dalam buku alamat itu.

Ada dua cara. Pilih salah satu, jangan keduanya.

### Cara A — Pasang record A dan CNAME (kontrol DNS tetap di registrar)

1. Di panel registrar, cari menu **DNS Management** (kadang bernama "Kelola DNS", "Zone Editor", atau "Pengaturan DNS")
2. Tambahkan record pertama sesuai yang ditampilkan Vercel:
   - Type: **A**
   - Name / Host: `@` (artinya domain utama tanpa awalan)
   - Value / Points to: alamat IP dari layar Vercel
3. Tambahkan record kedua:
   - Type: **CNAME**
   - Name / Host: `www`
   - Value / Points to: alamat dari layar Vercel
4. Simpan

**Kapan memilih cara ini:** kalau domain yang sama juga dipakai untuk hal lain, misalnya email kantor, dan Anda tidak ingin memindahkan seluruh pengaturannya.

### Cara B — Ganti nameserver ke Vercel (seluruh DNS diurus Vercel)

1. Di panel registrar, cari menu **Nameserver** (kadang "DNS Server" atau "Kelola Nameserver")
2. Pilih opsi nameserver kustom, lalu isi dengan nameserver yang ditampilkan Vercel
3. Simpan

**Kapan memilih cara ini:** kalau domain ini hanya dipakai untuk portal dan tidak ada keperluan lain. Lebih sedikit yang bisa salah. Konsekuensinya, semua pengaturan DNS domain tersebut — termasuk kalau nanti mau memasang email — harus dikelola dari dashboard Vercel, bukan dari registrar.

### Yang HARUS dihindari

> **Jangan memakai fitur "Web Forwarding", "URL Redirect", "Domain Forwarding", atau "Masking"** yang biasanya ditawarkan registrar sebagai cara cepat mengarahkan domain.
>
> Itu bukan cara yang benar. Akibatnya: alamat di address bar jadi kacau atau tetap menampilkan alamat lama, HTTPS tidak jalan sehingga browser menampilkan peringatan "tidak aman", dan login UPT maupun Super Admin bisa rusak karena sistem autentikasi membaca alamat yang tidak konsisten.
>
> Yang dipakai harus record DNS (Cara A) atau nameserver (Cara B).

---

## Langkah 4 — Tunggu propagasi DNS

Perubahan DNS butuh waktu menyebar ke seluruh internet. Umumnya beberapa menit, kadang sampai beberapa jam, dan pada kasus tertentu hingga 24 jam.

Cara mengeceknya: buka kembali **Vercel → Settings → Domains**. Kalau sudah benar, domain Anda ditandai **Valid Configuration**. Selama menunggu, situs di alamat lama tetap berjalan normal.

Kalau setelah beberapa jam masih belum valid, periksa ulang apakah nilai record yang dipasang sama persis dengan yang ditampilkan Vercel, termasuk ada atau tidaknya titik di akhir alamat.

---

## Langkah 5 — SSL (HTTPS) otomatis

Tidak perlu membeli sertifikat SSL. Begitu DNS valid, Vercel menerbitkan sertifikat HTTPS sendiri secara gratis dan memperpanjangnya otomatis.

Tandanya berhasil: muncul ikon gembok di address bar, dan alamat diawali `https://`.

---

## Langkah 6 — Perbarui pengaturan Supabase

**Ini langkah yang paling sering terlewat, dan akibatnya paling terasa.** Portal memakai Supabase untuk login dan penyimpanan data. Supabase menyimpan daftar alamat yang diizinkan, dan daftar itu masih berisi alamat lama.

1. Masuk ke [supabase.com](https://supabase.com), buka proyek portal ini
2. Masuk ke **Authentication → URL Configuration**
3. Ubah **Site URL** menjadi `https://namadomainanda.id`
4. Pada **Redirect URLs**, tambahkan `https://namadomainanda.id/**`
5. Biarkan alamat `.vercel.app` lama tetap ada di daftar Redirect URLs selama masa transisi
6. Simpan

**Kalau langkah ini dilewati:** login UPT dan Super Admin bisa terlempar balik ke alamat `.vercel.app` lama setelah berhasil masuk, dan fitur ganti password di `/dashboard-profil` bisa gagal.

---

## Langkah 7 — Alihkan alamat `.vercel.app` lama

Setelah domain baru aktif, alamat `.vercel.app` tetap bisa diakses dan tidak bisa dimatikan. Supaya tidak ada dua alamat yang beredar di brosur dan grup WhatsApp UPT, alamat lama sebaiknya dialihkan otomatis ke domain baru.

Caranya, tambahkan satu entri pada `redirects` di berkas `vercel.json`:

```json
{
  "source": "/(.*)",
  "has": [{ "type": "host", "value": "etalase-produk-wbp.vercel.app" }],
  "destination": "https://namadomainanda.id/$1",
  "permanent": true
}
```

Ganti `namadomainanda.id` dengan domain sebenarnya, lalu commit dan push. Vercel menerapkannya pada deploy berikutnya.

---

## Checklist verifikasi setelah migrasi

Kerjakan semuanya, jangan hanya membuka halaman depan:

- [ ] Buka `https://namadomainanda.id` — katalog produk muncul
- [ ] Ikon gembok HTTPS aktif, tanpa peringatan keamanan
- [ ] Foto produk tetap tampil (foto disimpan di Supabase Storage dengan alamat terpisah, jadi seharusnya tidak terpengaruh — tapi tetap dipastikan)
- [ ] Buka `/monitoring` — angka KPI, grafik, dan tabel 33 UPT muncul
- [ ] Login UPT di `/login` — berhasil masuk ke dashboard dan **tidak** terlempar ke alamat lama
- [ ] Buka `/dashboard-produk` — daftar produk milik UPT tersebut muncul
- [ ] Buka `/dashboard-penjualan` — riwayat transaksi dan distribusi wilayah muncul
- [ ] Coba ganti password di `/dashboard-profil` — berhasil, lalu login ulang dengan password baru
- [ ] Login Super Admin di `/admin-login` — berhasil, semua tab terbuka
- [ ] Buka alamat `.vercel.app` lama — dialihkan otomatis ke domain baru

Kalau ada satu saja yang gagal, periksa Langkah 6 lebih dulu — mayoritas masalah setelah ganti domain berasal dari pengaturan Supabase yang belum diperbarui.

---

## Yang perlu diperbarui setelah domain aktif

- **Manual book `Panduan-Dashboard-UPT-Karya-WBP-Jabar-Juara.docx` dan `.pptx`** — memuat alamat lama. Kedua berkas ini juga masih mencantumkan nomor telepon lama (022) 7208146, yang seharusnya **(021) 7214472**, jadi sekalian diperbaiki saat dibuat ulang.
- Materi cetak, brosur, dan postingan media sosial yang sudah beredar dengan alamat lama.
- Tautan di bio media sosial dan grup WhatsApp koordinasi UPT.

---

## Catatan teknis untuk yang penasaran

Pergantian domain ini nyaris tidak menyentuh kode, karena:

- Seluruh navigasi di situs memakai path relatif (`/monitoring`, `/dashboard`, `/admin-login`), bukan alamat lengkap, jadi otomatis mengikuti domain apa pun.
- `vercel.json` tidak mengunci domain mana pun.
- Edge Function `reset-upt-password` memakai CORS terbuka, jadi tidak perlu disesuaikan.

Satu-satunya titik di luar DNS yang benar-benar harus diubah adalah pengaturan Supabase di Langkah 6.
