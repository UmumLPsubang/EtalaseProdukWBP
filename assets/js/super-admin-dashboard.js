async function requireSuperAdminSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "/admin-login";
    return null;
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("role, nama")
    .eq("id", session.user.id)
    .single();

  if (error || !profile || profile.role !== "super_admin") {
    await supabaseClient.auth.signOut();
    window.location.href = "/admin-login";
    return null;
  }

  return { adminId: session.user.id, email: session.user.email, nama: profile.nama };
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRupiah(num) {
  const n = Number(num) || 0;
  return "Rp " + n.toLocaleString("id-ID");
}

function initTabs() {
  const buttons = document.querySelectorAll("[data-tab]");
  const panels = document.querySelectorAll("[data-panel]");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;

      buttons.forEach((b) => {
        b.classList.toggle("bg-primary-container", b === btn);
        b.classList.toggle("text-white", b === btn);
        b.classList.toggle("text-on-surface-variant", b !== btn);
      });

      panels.forEach((panel) => {
        panel.classList.toggle("hidden", panel.dataset.panel !== tabName);
      });

      if (typeof window.onTabActivated === "function") {
        window.onTabActivated(tabName);
      }
    });
  });

  const logoutBtn = document.getElementById("header-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "/admin-login";
    });
  }
}
