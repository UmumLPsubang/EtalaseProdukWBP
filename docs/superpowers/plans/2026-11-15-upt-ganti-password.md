# UPT Ganti Password Sendiri Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in UPT account change its own password from `dashboard-profil.html`, without needing Super Admin assistance.

**Architecture:** Plain static HTML + vanilla JS, matching the rest of this page. Uses Supabase Auth's built-in `updateUser({ password })` call for the currently-authenticated session — no new database table, RPC, or Edge Function needed, since this is a user changing their own credential, not a privileged cross-account action (unlike the Super Admin's Reset Password feature, which needs the service-role key).

**Tech Stack:** `@supabase/supabase-js@2.45.4` (already loaded on this page), vanilla JS.

## Global Constraints

- No build step, no framework — inline `<script>` in the existing page, matching the WhatsApp-save code already there.
- No password-lama field — the logged-in session itself is the authorization, per the approved spec.
- Client-side validation before any Supabase call: both fields non-empty, new password ≥ 6 characters, both fields match exactly.
- Follow the existing visual/structural pattern on this page (white card, `border-border-subtle`, same label/input/button classes as the WhatsApp card, same message-paragraph pattern for success/error feedback).

---

### Task 1: Ganti Password card on dashboard-profil.html

**Files:**
- Modify: `dashboard-profil.html:76-85` (insert a new card after the existing WhatsApp card) and `:90-128` (extend the bootstrap script)

**Interfaces:**
- Consumes: `supabaseClient` (global, already loaded via `assets/js/supabase-client.js`), `supabaseClient.auth.updateUser({ password })` (Supabase SDK built-in).
- Produces: nothing consumed by other tasks — this plan has exactly one task.

- [ ] **Step 1: Read the current file to confirm exact surrounding text**

Read `dashboard-profil.html` in full (it is 132 lines) to confirm the WhatsApp card's exact markup (lines 76-85) and the bootstrap script's exact current content (lines 90-128), since this edit inserts right after the former and extends the latter.

- [ ] **Step 2: Insert the new card's markup**

Right after the closing `</div>` of the WhatsApp card block and its `<p id="whatsapp-message">` line (i.e., right before the closing `</main>` tag), insert:

```html
    <div class="bg-white rounded-2xl shadow-sm border border-border-subtle p-5 mt-5">
      <h2 class="font-bold text-sm text-primary mb-3">Ganti Password</h2>
      <div class="flex flex-col sm:flex-row sm:items-end gap-3">
        <div class="flex-1">
          <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="new-password">Password Baru</label>
          <input id="new-password" type="password" placeholder="Minimal 6 karakter"
            class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
        </div>
        <div class="flex-1">
          <label class="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5" for="confirm-password">Konfirmasi Password Baru</label>
          <input id="confirm-password" type="password" placeholder="Ulangi password baru"
            class="w-full px-3 py-2.5 rounded-lg border border-border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
        </div>
        <button id="change-password-btn" type="button" class="px-5 py-2.5 rounded-lg bg-primary-container text-white font-bold text-sm hover:bg-primary transition shrink-0 disabled:opacity-50">Ubah Password</button>
      </div>
      <p id="password-message" class="hidden text-xs font-semibold mt-2 px-1"></p>
    </div>
```

- [ ] **Step 3: Extend the bootstrap script with the change-password handler**

Add this block inside the existing `<script>` tag (the one that already has the `save-whatsapp-btn` click listener), right after that existing listener's closing `});` and before the final `(async () => { ... })();` IIFE:

```javascript
  document.getElementById("change-password-btn").addEventListener("click", async () => {
    const btn = document.getElementById("change-password-btn");
    const msgEl = document.getElementById("password-message");
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    function showPasswordMessage(text, isError) {
      msgEl.textContent = text;
      msgEl.className = "text-xs font-semibold mt-2 px-1 " + (isError ? "text-red-600" : "text-emerald-600");
      msgEl.classList.remove("hidden");
    }

    if (!newPassword || !confirmPassword) {
      showPasswordMessage("Isi kedua field password terlebih dahulu.", true);
      return;
    }

    if (newPassword.length < 6) {
      showPasswordMessage("Password baru minimal 6 karakter.", true);
      return;
    }

    if (newPassword !== confirmPassword) {
      showPasswordMessage("Password baru dan konfirmasi tidak cocok.", true);
      return;
    }

    btn.disabled = true;
    btn.textContent = "Menyimpan...";

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

    btn.disabled = false;
    btn.textContent = "Ubah Password";

    if (error) {
      showPasswordMessage("Gagal mengubah password: " + error.message, true);
      return;
    }

    showPasswordMessage("Password berhasil diubah.", false);
    document.getElementById("new-password").value = "";
    document.getElementById("confirm-password").value = "";
  });
```

- [ ] **Step 4: Manual verification**

This project has no local dev server or browser automation — verification happens live after deploy. Re-read the full file once after editing to confirm: the new card's HTML is well-formed and sits between the WhatsApp card and `</main>`, the new script block is syntactically valid and placed between the existing `save-whatsapp-btn` listener and the final bootstrap IIFE (not inside either of them), and no `id` collides with any existing element on the page. Note in the report that live testing (actually changing a password and logging in with it) is pending the human, matching the spec's Testing section:
- New password < 6 chars → red error, no Supabase call.
- Mismatched confirmation → red error, no Supabase call.
- Matching, valid password → green success message, fields clear.
- Log out, log back in with the new password → succeeds.
- Change the password again to a different value → succeeds again (not a one-time-use flow).

- [ ] **Step 5: Commit**

```bash
git add dashboard-profil.html
git commit -m "Add self-service password change to UPT profile page"
```

---

## Spec Coverage Check

- Lokasi & pola visual kartu → Task 1 Step 2.
- Form 2 field, tanpa password lama → Task 1 Step 2.
- Validasi klien (kosong, panjang minimum, kecocokan) → Task 1 Step 3.
- Panggilan `supabaseClient.auth.updateUser` tanpa RPC/Edge Function baru → Task 1 Step 3.
- Pesan sukses/gagal + pengosongan field saat sukses → Task 1 Step 3.
- Tombol disabled selama proses → Task 1 Step 3.
- Testing section dari spec → Task 1 Step 4.
