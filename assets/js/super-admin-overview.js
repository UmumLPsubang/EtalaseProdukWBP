window.renderSuperAdminUptActions = function (upt) {
  const statusLabel = upt.locked ? "Terkunci" : (upt.status === "nonaktif" ? "Nonaktif" : "Aktif");
  const statusClass = upt.locked
    ? "bg-rose-100 text-rose-800"
    : (upt.status === "nonaktif" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-800");
  return `
    <div class="flex flex-col items-center gap-1 mt-1.5">
      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClass}">${statusLabel}</span>
      <div class="flex gap-1">
        <button class="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 text-[11px] font-bold transition border border-blue-200" onclick="window.openEditUptModal('${upt.id}')">Edit</button>
        <button class="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 text-[11px] font-bold transition border border-amber-200" onclick="window.openResetPasswordModal('${upt.id}')">Reset</button>
        <button class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 text-[11px] font-bold transition border border-rose-200" onclick="window.toggleLockUpt('${upt.id}', ${upt.locked ? "true" : "false"})">${upt.locked ? "Unlock" : "Lock"}</button>
      </div>
    </div>`;
};
