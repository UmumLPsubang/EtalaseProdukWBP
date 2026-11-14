import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Tidak terautentikasi" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (callerProfile?.role !== "super_admin") {
    return new Response(JSON.stringify({ error: "Hanya super admin yang bisa reset password" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { upt_id } = await req.json();
  if (!upt_id) {
    return new Response(JSON.stringify({ error: "upt_id wajib diisi" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: targetProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("upt_id", upt_id)
    .eq("role", "upt")
    .single();

  if (profileError || !targetProfile) {
    return new Response(JSON.stringify({ error: "Akun UPT tidak ditemukan" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const newPassword = Array.from(crypto.getRandomValues(new Uint8Array(9)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 12);

  const { error: updateError } = await adminClient.auth.admin.updateUserById(targetProfile.id, {
    password: newPassword,
  });

  if (updateError) {
    return new Response(JSON.stringify({ error: "Gagal reset password: " + updateError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await adminClient.from("admin_activity_log").insert({
    admin_id: userData.user.id,
    action: "reset_password",
    target_type: "upt",
    target_id: upt_id,
  });

  return new Response(JSON.stringify({ password: newPassword }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
