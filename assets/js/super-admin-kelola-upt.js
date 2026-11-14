let __kelolaUptData = [];

async function loadKelolaUptTable() {
  const { data, error } = await supabaseClient
    .from("upt")
    .select("id, kode, nama, wilayah, whatsapp, status, locked")
    .order("nama");

  if (error) {
    console.error("Gagal memuat daftar UPT:", error);
    return;
  }

  __kelolaUptData = data;
  renderKelolaUptTable();
}

function renderKelolaUptTable() {
  const query = (document.getElementById("kelola-upt-search")?.value || "").trim().toLowerCase();
  const statusFilter = document.getElementById("kelola-upt-filter-status")?.value || "";
  const tbody = document.getElementById("kelola-upt-table-body");

  const filtered = __kelolaUptData.filter((upt) => {
    const matchesQuery = !query ||
      upt.nama.toLowerCase().includes(query) ||
      upt.kode.toLowerCase().includes(query) ||
      (upt.wilayah || "").toLowerCase().includes(query);
    const matchesStatus =
      !statusFilter ||
      (statusFilter === "locked" && upt.locked) ||
      (statusFilter !== "locked" && !upt.locked && upt.status === statusFilter);
    return matchesQuery && matchesStatus;
  });

  tbody.innerHTML = filtered.map((upt) => {
    const statusLabel = upt.locked ? "Terkunci" : (upt.status === "nonaktif" ? "Nonaktif" : "Aktif");
    const statusClass = upt.locked ? "bg-rose-100 text-rose-800" : (upt.status === "nonaktif" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-800");
    return `
      <tr>
        <td class="py-2.5 px-3.5 font-bold">${escapeHtml(upt.kode)}</td>
        <td class="py-2.5 px-3">${escapeHtml(upt.nama)}</td>
        <td class="py-2.5 px-3">${escapeHtml(upt.wilayah || "-")}</td>
        <td class="py-2.5 px-3">${escapeHtml(upt.whatsapp || "-")}</td>
        <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${statusClass}">${statusLabel}</span></td>
        <td class="py-2.5 px-3.5 text-center space-x-1">
          <button class="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 text-[11px] font-bold border border-blue-200" onclick="window.openEditUptModal('${upt.id}')">Edit</button>
          <button class="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 text-[11px] font-bold border border-amber-200" onclick="window.openResetPasswordModal('${upt.id}')">Reset Password</button>
          <button class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 text-[11px] font-bold border border-rose-200" onclick="window.toggleLockUpt('${upt.id}', ${upt.locked ? "true" : "false"})">${upt.locked ? "Unlock" : "Lock"}</button>
        </td>
      </tr>`;
  }).join("") || `<tr><td colspan="6" class="py-6 text-center text-slate-400">Tidak ada UPT yang cocok.</td></tr>`;
}

window.openEditUptModal = function (uptId) {
  const upt = __kelolaUptData.find((u) => u.id === uptId);
  if (!upt) return;
  document.getElementById("edit-upt-id").value = upt.id;
  document.getElementById("edit-upt-nama").value = upt.nama;
  document.getElementById("edit-upt-wilayah").value = upt.wilayah || "";
  document.getElementById("edit-upt-whatsapp").value = upt.whatsapp || "";
  document.getElementById("edit-upt-status").value = upt.status;
  document.getElementById("edit-upt-message").classList.add("hidden");
  document.getElementById("edit-upt-modal").classList.remove("hidden");
  document.getElementById("edit-upt-modal").classList.add("flex");
};

window.toggleLockUpt = async function (uptId, currentLocked) {
  const upt = __kelolaUptData.find((u) => u.id === uptId);
  if (!upt) return;
  const action = currentLocked ? "membuka kunci" : "mengunci";
  if (!confirm(`Yakin ingin ${action} akun ${upt.nama}?`)) return;

  const { error } = await supabaseClient.rpc("admin_update_upt", {
    p_upt_id: uptId, p_nama: upt.nama, p_wilayah: upt.wilayah, p_whatsapp: upt.whatsapp,
    p_status: upt.status, p_locked: !currentLocked,
  });

  if (error) {
    alert("Gagal mengubah status kunci: " + error.message);
    return;
  }
  await loadKelolaUptTable();
};

window.openResetPasswordModal = async function (uptId) {
  const upt = __kelolaUptData.find((u) => u.id === uptId);
  if (!upt) return;
  if (!confirm(`Reset password akun ${upt.nama}? Password lama akan tidak berlaku lagi.`)) return;

  const body = document.getElementById("reset-password-body");
  body.textContent = "Memproses...";
  document.getElementById("reset-password-modal").classList.remove("hidden");
  document.getElementById("reset-password-modal").classList.add("flex");

  const { data, error } = await supabaseClient.functions.invoke("reset-upt-password", { body: { upt_id: uptId } });

  if (error || !data?.password) {
    body.innerHTML = `<span class="text-red-700 font-semibold">Gagal reset password.</span>`;
    return;
  }

  body.innerHTML = `
    <p class="mb-2">Password baru untuk <b>${escapeHtml(upt.nama)}</b>:</p>
    <p class="font-mono text-lg font-bold bg-slate-100 rounded-lg py-2 px-3 select-all">${escapeHtml(data.password)}</p>
    <p class="text-xs text-slate-500 mt-2">Salin dan kirim ke UPT sekarang — password ini tidak akan ditampilkan lagi.</p>`;
};

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("kelola-upt-search");
  const statusFilter = document.getElementById("kelola-upt-filter-status");
  if (searchInput) searchInput.addEventListener("input", renderKelolaUptTable);
  if (statusFilter) statusFilter.addEventListener("change", renderKelolaUptTable);

  const editForm = document.getElementById("edit-upt-form");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const uptId = document.getElementById("edit-upt-id").value;
      const upt = __kelolaUptData.find((u) => u.id === uptId);
      const msg = document.getElementById("edit-upt-message");
      msg.classList.add("hidden");

      const whatsapp = document.getElementById("edit-upt-whatsapp").value.trim();
      if (whatsapp && !/^62[0-9]{8,13}$/.test(whatsapp)) {
        msg.textContent = "Nomor WhatsApp harus diawali 62 dan hanya berisi angka.";
        msg.classList.remove("hidden");
        return;
      }

      const { error } = await supabaseClient.rpc("admin_update_upt", {
        p_upt_id: uptId,
        p_nama: document.getElementById("edit-upt-nama").value.trim(),
        p_wilayah: document.getElementById("edit-upt-wilayah").value.trim(),
        p_whatsapp: whatsapp || null,
        p_status: document.getElementById("edit-upt-status").value,
        p_locked: upt.locked,
      });

      if (error) {
        msg.textContent = "Gagal menyimpan: " + error.message;
        msg.classList.remove("hidden");
        return;
      }

      document.getElementById("edit-upt-modal").classList.add("hidden");
      await loadKelolaUptTable();
    });
  }
});
