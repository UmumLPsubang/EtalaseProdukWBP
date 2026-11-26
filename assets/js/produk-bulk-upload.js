// Logika bersama untuk unggah produk massal lewat ZIP (CSV + gambar).
//
// Dipakai oleh dua halaman dengan cara menyimpan yang berbeda:
//   - dashboard-produk.html  : UPT mengunggah untuk dirinya sendiri (insert biasa,
//                              dibatasi RLS ke upt_id miliknya)
//   - super-admin-dashboard  : Super Admin mengunggah atas nama UPT lain
//                              (lewat RPC admin_insert_produk)
//
// Modul ini sengaja TIDAK menyimpan ke database. Ia hanya membaca ZIP,
// memvalidasi tiap baris, dan mengunggah gambar ke Storage. Penyimpanan baris
// produk diserahkan ke pemanggil, karena jalur izinnya memang berbeda.
//
// Semua dibungkus dalam namespace window.ProdukBulk supaya tidak bertabrakan
// dengan fungsi global bernama sama di halaman pemanggil (escapeHtml pernah
// bentrok seperti itu dan menyebabkan bug yang sulit dilacak).

window.ProdukBulk = (function () {
  "use strict";

  const VALID_KATEGORI = ["Kriya", "Tekstil", "Kuliner", "Mebel", "Pertanian", "Jasa", "Lainnya"];
  const CSV_HEADER = "nama_produk,kategori,harga,deskripsi,link_shopee,link_tokopedia,link_grab,link_gofood,nama_file_gambar";
  const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
  const VALID_EXT = ["jpg", "jpeg", "png", "webp"];

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // Content-Type harus diisi eksplisit. new File([blob], nama) menghasilkan type
  // kosong, dan Storage lalu menyimpannya sebagai application/octet-stream --
  // gambarnya ter-download alih-alih tampil di browser.
  function mimeTypeForExt(ext) {
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
    return "application/octet-stream";
  }

  async function processRow(row, rowIndex, zip) {
    const errors = [];

    const nama = (row.nama_produk || "").trim();
    if (!nama) errors.push("nama_produk kosong");

    const kategori = (row.kategori || "").trim();
    if (!VALID_KATEGORI.includes(kategori)) errors.push(`kategori "${kategori}" tidak valid`);

    // Dicek sebagai string lebih dulu: parseFloat("10.000") menghasilkan 10,
    // jadi pemisah ribuan gaya Indonesia pernah membuat produk tersimpan
    // dengan harga Rp 10 tanpa peringatan apa pun.
    const hargaRaw = (row.harga || "").trim();
    if (!/^\d+$/.test(hargaRaw)) errors.push("harga harus angka bulat tanpa titik/koma, mis. 10000");
    const harga = Number(hargaRaw);

    const deskripsi = (row.deskripsi || "").trim() || null;

    const shopeeLink = (row.link_shopee || "").trim();
    if (shopeeLink && !/^https:\/\/([a-z0-9-]+\.)*shopee\.co\.id\//.test(shopeeLink)) {
      errors.push("link_shopee harus diawali https:// dan domain shopee.co.id");
    }

    const tokopediaLink = (row.link_tokopedia || "").trim();
    if (tokopediaLink && !/^https:\/\/([a-z0-9-]+\.)*tokopedia\.com\//.test(tokopediaLink)) {
      errors.push("link_tokopedia harus diawali https:// dan domain tokopedia.com");
    }

    const grabLink = (row.link_grab || "").trim();
    if (grabLink && !/^https:\/\/([a-z0-9-]+\.)*grab\.com\//.test(grabLink)) {
      errors.push("link_grab harus diawali https:// dan domain grab.com");
    }

    const gofoodLink = (row.link_gofood || "").trim();
    if (gofoodLink && !/^https:\/\/([a-z0-9-]+\.)*(gofood\.co\.id|gofood\.link)\//.test(gofoodLink)) {
      errors.push("link_gofood harus diawali https:// dan domain gofood.co.id atau gofood.link");
    }

    const fileName = (row.nama_file_gambar || "").trim();
    if (!fileName) errors.push("nama_file_gambar kosong");

    let blob = null;
    let ext = null;
    if (fileName) {
      const zipEntry = zip.file(fileName);
      if (!zipEntry) {
        errors.push(`file gambar "${fileName}" tidak ditemukan di dalam ZIP`);
      } else {
        ext = fileName.split(".").pop().toLowerCase();
        if (!VALID_EXT.includes(ext)) {
          errors.push("format gambar harus jpg/jpeg/png/webp");
        } else {
          blob = await zipEntry.async("blob");
          if (blob.size > MAX_IMAGE_BYTES) errors.push("ukuran gambar melebihi 2MB");
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, rowIndex, error: errors.join("; ") };
    }

    return {
      valid: true,
      rowIndex,
      nama,
      kategori,
      harga,
      deskripsi,
      shopee_link: shopeeLink || null,
      tokopedia_link: tokopediaLink || null,
      grab_link: grabLink || null,
      gofood_link: gofoodLink || null,
      fileName,
      blob,
      ext,
    };
  }

  // Membaca ZIP dan memvalidasi semua barisnya. Melempar Error kalau ZIP-nya
  // sendiri tidak bisa dibaca; baris yang bermasalah dikembalikan di `failed`
  // supaya satu baris rusak tidak membatalkan seluruh batch.
  async function parseZip(file) {
    const zip = await JSZip.loadAsync(file);
    const csvEntry = zip.file("produk.csv");
    if (!csvEntry) {
      throw new Error("File produk.csv tidak ditemukan di dalam ZIP.");
    }

    const csvText = await csvEntry.async("string");
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: false });

    if (!parsed.data || parsed.data.length === 0) {
      throw new Error("Tidak ada baris produk untuk diproses.");
    }

    const rows = [];
    const failed = [];

    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      const isBlankRow = Object.values(row).every((v) => !v || !String(v).trim());
      if (isBlankRow) continue;
      try {
        // rowIndex = i + 2 karena baris 1 adalah header, dan pengguna membaca
        // nomor baris dari aplikasi spreadsheet yang mulai dari 1.
        const outcome = await processRow(row, i + 2, zip);
        if (outcome.valid) rows.push(outcome);
        else failed.push(outcome);
      } catch (err) {
        failed.push({
          rowIndex: i + 2,
          error: err.message || "gagal memproses baris (ZIP entry mungkin rusak)",
        });
      }
    }

    return { rows, failed };
  }

  async function uploadFoto(file, uptId) {
    const ext = file.name.split(".").pop();
    const path = `${uptId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadError } = await supabaseClient.storage
      .from("produk-images")
      .upload(path, file);
    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseClient.storage.from("produk-images").getPublicUrl(path);
    return urlData.publicUrl;
  }

  // Mengunggah gambar satu baris hasil parseZip ke folder UPT tujuan.
  async function uploadRowImage(row, uptId) {
    const file = new File([row.blob], row.fileName, { type: mimeTypeForExt(row.ext) });
    return uploadFoto(file, uptId);
  }

  function resultHtml(insertedCount, failedRows) {
    let html = `<p class="font-bold ${insertedCount > 0 ? "text-emerald-700" : "text-slate-600"}">${insertedCount} produk berhasil ditambahkan, ${failedRows.length} baris gagal.</p>`;
    if (failedRows.length > 0) {
      html += `<table class="w-full text-xs border-collapse mt-2"><thead><tr class="text-left text-slate-500"><th class="py-1 pr-3">Baris</th><th class="py-1">Alasan</th></tr></thead><tbody>`;
      html += failedRows
        .map((f) => `<tr><td class="py-1 pr-3 font-semibold">${escapeHtml(String(f.rowIndex))}</td><td class="py-1 text-red-600">${escapeHtml(f.error)}</td></tr>`)
        .join("");
      html += `</tbody></table>`;
    }
    return html;
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_HEADER + "\n"], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "produk.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    VALID_KATEGORI,
    CSV_HEADER,
    mimeTypeForExt,
    processRow,
    parseZip,
    uploadFoto,
    uploadRowImage,
    resultHtml,
    downloadTemplate,
  };
})();
