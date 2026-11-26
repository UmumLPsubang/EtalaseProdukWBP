// Unggah produk massal atas nama UPT lain, dari dashboard Super Admin.
//
// Jalur cadangan untuk UPT yang mengirim ZIP lewat WhatsApp/email karena tidak
// bisa mengunggah sendiri. Format ZIP-nya persis sama dengan yang dipakai UPT
// di /dashboard-produk, sehingga tidak ada template kedua yang harus diurus.
//
// Parsing dan validasi memakai window.ProdukBulk (assets/js/produk-bulk-upload.js).
// Yang berbeda hanya cara menyimpan: di sini lewat RPC admin_insert_produk,
// karena RLS tidak mengizinkan menulis baris produk milik UPT lain secara langsung.

// Dua penanda terpisah dengan sengaja. Listener hanya boleh dipasang sekali
// seumur halaman (kalau dua kali, satu klik memproses ZIP dua kali), sedangkan
// pemuatan daftar UPT boleh diulang kalau sebelumnya gagal.
let __bulkProdukListenersAttached = false;
let __bulkProdukUptLoaded = false;

async function initSuperAdminBulkProduk() {
  const uptSelect = document.getElementById("bulk-produk-upt");
  if (!uptSelect) return;

  if (!__bulkProdukListenersAttached) {
    __bulkProdukListenersAttached = true;
    document.getElementById("bulk-produk-template-btn").addEventListener("click", () => {
      ProdukBulk.downloadTemplate();
    });
    document.getElementById("bulk-produk-upload-btn").addEventListener("click", prosesBulkProduk);
  }

  if (__bulkProdukUptLoaded) return;

  const { data: uptList, error } = await supabaseClient
    .from("upt")
    .select("id, nama")
    .order("nama");

  if (error) {
    // Tidak ditandai selesai, supaya membuka ulang tab Produk mencoba lagi.
    // Tanpa ini, satu kegagalan jaringan mematikan bagian ini sampai halaman
    // di-refresh.
    console.error("Gagal memuat daftar UPT untuk unggah massal:", error);
    uptSelect.innerHTML = `<option value="">Gagal memuat daftar UPT — buka ulang tab ini untuk mencoba lagi</option>`;
    return;
  }

  // Ditulis ulang dari nol, bukan ditambahkan, supaya percobaan kedua setelah
  // gagal tidak menyisakan opsi error atau menggandakan daftar UPT.
  uptSelect.innerHTML = `<option value="">Pilih UPT...</option>`;
  (uptList || []).forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.nama;
    uptSelect.appendChild(opt);
  });

  __bulkProdukUptLoaded = true;
}

async function prosesBulkProduk() {
  const uptSelect = document.getElementById("bulk-produk-upt");
  const fileInput = document.getElementById("bulk-produk-file");
  const uploadBtn = document.getElementById("bulk-produk-upload-btn");
  const resultBox = document.getElementById("bulk-produk-result");

  const uptId = uptSelect.value;
  const uptNama = uptSelect.options[uptSelect.selectedIndex]?.textContent || "";
  const file = fileInput.files[0];

  if (!uptId) {
    alert("Pilih UPT tujuan terlebih dahulu.");
    return;
  }
  if (!file) {
    alert("Pilih file ZIP terlebih dahulu.");
    return;
  }

  // Produk akan tercatat atas nama UPT lain dan langsung tayang di katalog
  // publik, jadi UPT tujuan dikonfirmasi dulu secara eksplisit.
  if (!confirm(`Semua produk di dalam ZIP ini akan ditambahkan atas nama:\n\n${uptNama}\n\nProduk langsung tayang di katalog publik. Lanjutkan?`)) {
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Memproses...";
  resultBox.classList.add("hidden");

  try {
    const { rows: validRows, failed: failedRows } = await ProdukBulk.parseZip(file);

    let insertedCount = 0;
    for (const row of validRows) {
      try {
        const image_url = await ProdukBulk.uploadRowImage(row, uptId);
        const { error: rpcError } = await supabaseClient.rpc("admin_insert_produk", {
          p_upt_id: uptId,
          p_nama: row.nama,
          p_kategori: row.kategori,
          p_harga: row.harga,
          p_deskripsi: row.deskripsi,
          p_image_url: image_url,
          p_shopee_link: row.shopee_link,
          p_tokopedia_link: row.tokopedia_link,
          p_grab_link: row.grab_link,
          p_gofood_link: row.gofood_link,
        });
        if (rpcError) throw rpcError;
        insertedCount++;
      } catch (err) {
        failedRows.push({ rowIndex: row.rowIndex, error: err.message || "gagal menyimpan" });
      }
    }

    resultBox.classList.remove("hidden");
    resultBox.innerHTML = ProdukBulk.resultHtml(insertedCount, failedRows);

    if (insertedCount > 0) {
      fileInput.value = "";
      if (typeof loadProdukTab === "function") loadProdukTab();
    }
  } catch (err) {
    console.error(err);
    resultBox.classList.remove("hidden");
    resultBox.innerHTML = `<p class="text-red-600 font-semibold">${String(err.message || "Gagal memproses ZIP.").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))}</p>`;
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Proses Upload";
  }
}
