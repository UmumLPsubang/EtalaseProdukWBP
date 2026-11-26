// Penjaga halaman: hanya boleh dibuka oleh pengguna yang sudah login,
// UPT mana pun maupun Super Admin.
//
// Dipakai di /monitoring, yang isinya rekap penjualan seluruh 33 UPT dan
// sejak Nov 2026 bukan lagi informasi publik.
//
// Penjaga ini hanya mengatur tampilan. Yang benar-benar menutup datanya
// adalah RLS di database (docs/supabase-transaksi-internal-only-schema.sql):
// tanpa login, kueri transaksi mengembalikan kosong walau pun seseorang
// mematikan JavaScript atau memanggil API langsung.
//
// Harus dimuat SETELAH supabase-client.js dan SEBELUM skrip yang mengambil
// data, supaya pengalihan terjadi sedini mungkin.

(async function () {
  "use strict";

  // Disembunyikan lebih dulu supaya isi halaman tidak sempat berkedip
  // sebelum pengalihan. Dikembalikan lagi kalau sesinya valid.
  const root = document.documentElement;
  const tampilanAwal = root.style.visibility;
  root.style.visibility = "hidden";

  function keLogin() {
    // replace(), bukan href: supaya tombol Back tidak memantulkan pengguna
    // kembali ke halaman yang baru saja ditolak.
    window.location.replace("/login");
  }

  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      // Gagal memastikan sesi diperlakukan sebagai tidak berhak, bukan
      // sebaliknya. Untuk halaman yang memuat data internal, menutup saat
      // ragu lebih aman daripada membuka.
      console.error("Gagal memeriksa sesi:", error);
      keLogin();
      return;
    }

    if (!data || !data.session) {
      keLogin();
      return;
    }

    root.style.visibility = tampilanAwal;
  } catch (err) {
    console.error("Gagal memeriksa sesi:", err);
    keLogin();
  }
})();
