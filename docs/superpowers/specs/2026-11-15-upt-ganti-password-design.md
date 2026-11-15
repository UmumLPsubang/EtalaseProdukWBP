# Desain: Ganti Password Sendiri — Halaman Profil UPT

**Tanggal:** 2026-11-15
**Status:** Disetujui, siap jadi implementation plan

## Latar belakang

Akun UPT saat ini tidak punya cara mengganti password sendiri — satu-satunya cara reset password adalah lewat Super Admin Kanwil (fitur Reset Password di dashboard super admin). UPT yang ingin mengganti password sendiri (misal setelah pertama kali diberi password oleh admin, atau rutin ganti password) tidak punya jalan lain selain minta tolong Kanwil.

## Desain

**Lokasi:** Kartu baru di `dashboard-profil.html`, diletakkan di bawah kartu "Nomor WhatsApp UPT" yang sudah ada, dengan pola visual yang sama (kartu putih, border, padding, tombol Simpan).

**Form — 2 field:**
- Password Baru (`type="password"`)
- Konfirmasi Password Baru (`type="password"`)

**Validasi di browser sebelum submit:**
- Kedua field tidak boleh kosong.
- Panjang password baru minimal 6 karakter (batas minimum default Supabase Auth — mengirim password lebih pendek akan ditolak Supabase dengan error, jadi divalidasi dulu di klien supaya pesan errornya jelas dalam Bahasa Indonesia).
- Password Baru dan Konfirmasi harus identik.

**Tidak meminta password lama** — session yang sedang login (`supabaseClient.auth.getSession()`) sudah cukup untuk Supabase Auth mengizinkan user mengganti password miliknya sendiri lewat `supabaseClient.auth.updateUser({ password: newPassword })`. Ini fungsi bawaan Supabase Auth untuk akun yang sedang login mengubah passwordnya sendiri — bukan privileged action lintas-akun, jadi tidak perlu RPC atau Edge Function baru (beda dari fitur Reset Password super admin yang memang butuh service-role key untuk mereset password akun ORANG LAIN).

**Alur:**
1. User isi kedua field, klik "Ubah Password".
2. Validasi klien (lihat di atas) — gagal → pesan merah di bawah form, tidak lanjut ke Supabase.
3. Lolos validasi → panggil `supabaseClient.auth.updateUser({ password: newPasswordValue })`.
4. Sukses → pesan hijau "Password berhasil diubah.", kedua field dikosongkan.
5. Gagal (misal Supabase menolak karena alasan lain) → pesan merah menampilkan `error.message` dari Supabase, field tidak dikosongkan supaya user bisa coba lagi tanpa mengetik ulang.

Tombol dinonaktifkan selama proses berlangsung (`disabled` + teks "Menyimpan..."), konsisten dengan pola tombol Simpan Nomor WA yang sudah ada di halaman yang sama.

## Di luar scope

- Tidak ada verifikasi password lama — sudah diputuskan tidak diperlukan karena session login sudah menjadi bukti kepemilikan akun.
- Tidak ada kebijakan kompleksitas password (huruf besar/kecil/angka/simbol) — hanya panjang minimum 6 karakter, mengikuti batas default Supabase.
- Tidak mengubah apa pun pada fitur Reset Password super admin yang sudah ada — keduanya tetap berdampingan sebagai dua jalan berbeda (user ganti sendiri vs admin mereset untuk orang lain).

## Testing

- Buka `/dashboard-profil`, isi Password Baru dengan < 6 karakter → pesan error muncul, tidak ada panggilan ke Supabase.
- Isi Password Baru dan Konfirmasi dengan nilai berbeda → pesan error "tidak cocok", tidak ada panggilan ke Supabase.
- Isi keduanya dengan nilai sama, ≥ 6 karakter → berhasil, pesan hijau muncul, field kosong kembali.
- Logout, lalu login ulang dengan password baru itu → berhasil masuk.
- Coba ganti password lagi dengan nilai baru yang berbeda → berhasil juga (memastikan fitur ini bisa dipakai berulang kali, bukan sekali pakai).
