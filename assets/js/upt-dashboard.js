async function requireUptSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "/login";
    return null;
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("upt_id, upt:upt_id (nama, kode, whatsapp)")
    .eq("id", session.user.id)
    .single();

  if (error || !profile) {
    console.error("Gagal memuat profil UPT:", error);
    return null;
  }

  return {
    uptId: profile.upt_id,
    nama: profile.upt.nama,
    kode: profile.upt.kode,
    whatsapp: profile.upt.whatsapp,
  };
}

function renderSidebar(activePage, uptInfo) {
  const namaTop = document.getElementById("sidebar-upt-nama");
  const namaBottom = document.getElementById("sidebar-upt-nama-bawah");
  const kodeEl = document.getElementById("sidebar-upt-kode");

  if (namaTop) namaTop.textContent = uptInfo ? uptInfo.nama : "-";
  if (namaBottom) namaBottom.textContent = uptInfo ? uptInfo.nama : "-";
  if (kodeEl) kodeEl.textContent = uptInfo ? `Kode: ${uptInfo.kode}` : "-";

  document.querySelectorAll(".sidebar-link").forEach((link) => {
    if (link.dataset.page === activePage) {
      link.classList.add("bg-white/15", "text-white");
      link.classList.remove("text-blue-100");
    } else {
      link.classList.remove("bg-white/15", "text-white");
      link.classList.add("text-blue-100");
    }
  });

  const logoutBtn = document.getElementById("sidebar-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "/login";
    });
  }
}
