# Desain: Modal Rincian Transaksi per UPT + Perbaikan Label Komoditas

**Tanggal:** 2026-11-15
**Status:** Disetujui, siap dikerjakan

## Latar belakang

Dua masalah ditemukan saat user mengecek `/monitoring` setelah honesty pass:

1. Tombol "Detail" di tiap baris tabel 33 UPT masih sisa mock dari prototype Stitch — tidak melakukan apa-apa saat diklik.
2. Kolom "Komoditas Unggulan" menampilkan "Belum ada penjualan" untuk dua kondisi yang berbeda, sehingga menyesatkan. Terkonfirmasi di data live: Lapas Subang menampilkan "Belum ada penjualan" padahal Volume 30 Unit dan Omzet Rp 5.600.000 — penyebabnya kedua transaksi punya `produk_id = null` karena produk yang dipakai saat input sudah dihapus permanen (konsekuensi yang memang sudah diperingatkan di dialog konfirmasi hapus produk).

## Bagian 1 — Modal rincian transaksi per UPT

Satu elemen modal di `monitoring.html`, tersembunyi secara default, diisi oleh JS saat tombol "Detail" pada baris UPT diklik.

**Struktur:**
- Backdrop gelap (`bg-black/50`) menutupi layar, modal di tengah.
- Header: nama UPT + kode Satker, tombol tutup (✕).
- Isi: tabel transaksi UPT tersebut — kolom **Tanggal, Produk, Jumlah, Total, Channel**. Diurutkan `tanggal_transaksi` terbaru di atas. Area tabel bisa di-scroll (`max-h`) kalau transaksinya banyak.
- Footer: ringkasan — jumlah transaksi, total unit, total omzet UPT itu.
- Kondisi kosong: "Belum ada transaksi tercatat untuk UPT ini".
- Produk yang sudah dihapus (`produk_id` null, atau id tidak ditemukan di daftar produk): kolom Produk menampilkan "Produk sudah dihapus" dengan gaya abu-abu miring, bukan dibiarkan kosong.

**Cara menutup:** tombol ✕, klik backdrop di luar kotak modal, atau tekan tombol Esc.

**Sumber data:** tidak ada query tambahan. `loadMonitoringAggregates()` sudah mem-fetch seluruh `transaksi_penjualan` dan `produk`; data itu disimpan di `window.__uptAggregateData` dan tinggal difilter per `upt_id` di browser saat modal dibuka. Nama UPT diambil dari daftar UPT yang sudah ter-render di tabel.

**Keamanan render:** semua nilai yang berasal dari data (nama produk, nama UPT, channel) di-escape dengan `escapeHtml()` yang sudah ada di file ini, konsisten dengan seluruh rendering lain di halaman ini.

## Bagian 2 — Perbaikan label kolom Komoditas Unggulan

`fillUptRowAggregates()` membedakan tiga kondisi:

| Kondisi | Label |
|---|---|
| Ada transaksi dan produk terlarisnya masih ada | Nama produk terlaris (perilaku sekarang, sudah benar) |
| Ada transaksi tapi tidak ada satu pun yang bisa dilacak ke produk yang masih ada | "Produk sudah dihapus" (abu-abu) |
| Tidak ada transaksi sama sekali | "Belum ada penjualan" (abu-abu) |

Pembeda teknisnya: `ownTransaksi.length === 0` → kondisi ketiga; selain itu kalau `topProdukNama` tetap `null` → kondisi kedua.

## Di luar scope

- Tidak ada perubahan skema database atau RLS — semua data sudah publicly readable.
- Modal ini hanya menampilkan (read-only), tidak ada aksi edit/hapus dari sini.
- Tidak membuat komponen modal yang bisa dipakai ulang lintas halaman — cukup satu modal khusus di `monitoring.html`, konsisten dengan pola "tiap halaman berdiri sendiri" di situs ini.

## Testing

- Klik "Detail" pada baris Lapas Subang (satu-satunya UPT yang punya transaksi saat ini): modal muncul, menampilkan 2 transaksi (10 unit via WhatsApp Rp 5.000.000, dan 20 unit via Tokopedia Rp 600.000), kolom Produk keduanya "Produk sudah dihapus", footer menunjukkan 2 transaksi / 30 unit / Rp 5.600.000.
- Klik "Detail" pada UPT mana pun yang belum ada transaksi: modal muncul dengan pesan "Belum ada transaksi tercatat untuk UPT ini".
- Tutup modal lewat ketiga cara (✕, klik backdrop, tombol Esc) — semuanya harus menutup.
- Kolom Komoditas Unggulan baris Lapas Subang berubah dari "Belum ada penjualan" jadi "Produk sudah dihapus"; baris UPT lain yang memang belum jualan tetap "Belum ada penjualan".
- Tambah produk baru lalu catat penjualannya dari dashboard UPT, refresh `/monitoring`: baris UPT itu harus menampilkan nama produk asli di Komoditas Unggulan, dan modal Detail-nya menampilkan nama produk itu (bukan "Produk sudah dihapus").
