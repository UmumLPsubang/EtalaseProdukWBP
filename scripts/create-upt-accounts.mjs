// One-time admin script: creates 1 login account per UPT in Supabase Auth,
// links each account to its upt_id in the `profiles` table, and writes the
// generated email/password list to a local CSV for distribution to each UPT.
//
// Run from the scripts/ folder:
//   npm install
//   npm run create-upt-accounts
//
// Requires scripts/.env.local with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// This script and its output CSV must never be committed (see .gitignore).

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { writeFileSync, mkdirSync } from "fs";
import { randomBytes } from "crypto";

dotenv.config({ path: new URL("./.env.local", import.meta.url) });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in scripts/.env.local");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generatePassword() {
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "x") + "!9";
}

function emailForKode(kode) {
  return `upt${kode}@login.etalasewbp.id`;
}

async function main() {
  const { data: uptList, error: uptError } = await supabaseAdmin
    .from("upt")
    .select("id, kode, nama")
    .order("kode", { ascending: true });

  if (uptError) {
    console.error("Failed to load UPT list:", uptError.message);
    process.exit(1);
  }

  console.log(`Found ${uptList.length} UPT. Creating accounts...\n`);

  const results = [];

  for (const upt of uptList) {
    const email = emailForKode(upt.kode);
    const password = generatePassword();

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      console.error(`[SKIP] ${upt.kode} - ${upt.nama}: ${createError.message}`);
      results.push({ kode: upt.kode, nama: upt.nama, email, password: "", status: `GAGAL: ${createError.message}` });
      continue;
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userData.user.id,
      upt_id: upt.id,
      nama: upt.nama,
    });

    if (profileError) {
      console.error(`[PARTIAL] ${upt.kode} - akun dibuat tapi gagal link ke profil: ${profileError.message}`);
      results.push({ kode: upt.kode, nama: upt.nama, email, password, status: `AKUN DIBUAT, GAGAL LINK PROFIL: ${profileError.message}` });
      continue;
    }

    console.log(`[OK] ${upt.kode} - ${upt.nama}`);
    results.push({ kode: upt.kode, nama: upt.nama, email, password, status: "OK" });
  }

  mkdirSync(new URL("./output", import.meta.url), { recursive: true });
  const csvPath = new URL("./output/upt-credentials.csv", import.meta.url);
  const header = "kode,nama,email,password,status\n";
  const rows = results
    .map((r) => [r.kode, r.nama, r.email, r.password, r.status].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  writeFileSync(csvPath, header + rows, "utf-8");

  console.log(`\nSelesai. Hasil disimpan di scripts/output/upt-credentials.csv (${results.length} baris).`);
  console.log("JANGAN commit file ini. Bagikan kredensial ke tiap UPT lewat jalur aman (bukan email terbuka/chat publik).");
}

main();
