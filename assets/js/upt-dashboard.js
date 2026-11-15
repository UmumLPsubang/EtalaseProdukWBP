async function requireUptSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "/login";
    return null;
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("upt_id, upt:upt_id (nama, kode, whatsapp, locked)")
    .eq("id", session.user.id)
    .single();

  if (error || !profile || !profile.upt) {
    console.error("Gagal memuat profil UPT:", error);
    alert("Akun ini belum terhubung ke UPT manapun. Hubungi admin, lalu login ulang.");
    await supabaseClient.auth.signOut();
    window.location.href = "/login";
    return null;
  }

  if (profile.upt.locked) {
    alert("Akun ini dikunci oleh Kanwil. Hubungi admin Kanwil untuk membuka kembali.");
    await supabaseClient.auth.signOut();
    window.location.href = "/login";
    return null;
  }

  return {
    uptId: profile.upt_id,
    nama: profile.upt.nama,
    kode: profile.upt.kode,
    whatsapp: profile.upt.whatsapp,
  };
}

function renderHeader(activePage, uptInfo) {
  const namaEl = document.getElementById("header-upt-nama");
  if (namaEl) namaEl.textContent = uptInfo ? `${uptInfo.nama} • Kode: ${uptInfo.kode}` : "-";

  document.querySelectorAll(".header-link").forEach((link) => {
    if (link.dataset.page === activePage) {
      link.classList.add("bg-primary-container", "text-white", "shadow-sm");
      link.classList.remove("text-on-surface-variant");
    } else {
      link.classList.remove("bg-primary-container", "text-white", "shadow-sm");
      link.classList.add("text-on-surface-variant");
    }
  });

  const logoutBtn = document.getElementById("header-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "/login";
    });
  }
}
