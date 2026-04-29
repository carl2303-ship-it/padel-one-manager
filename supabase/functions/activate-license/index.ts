import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { license_key, user_id } = await req.json();

    if (!license_key || !user_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "license_key and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedKey = license_key.trim().toUpperCase();

    const { data: keyData, error: keyError } = await supabaseClient
      .from("license_keys")
      .select("*")
      .eq("license_key", normalizedKey)
      .maybeSingle();

    if (keyError || !keyData) {
      return new Response(
        JSON.stringify({ ok: false, error: "Chave não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (keyData.status !== "active") {
      const msg =
        keyData.status === "used" ? "Esta chave já foi utilizada" :
        keyData.status === "expired" ? "Esta chave expirou" :
        "Esta chave foi revogada";
      return new Response(
        JSON.stringify({ ok: false, error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (keyData.target_user_id && keyData.target_user_id !== user_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Esta chave não é válida para este utilizador" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + keyData.duration_months);

    // Mark key as used
    await supabaseClient
      .from("license_keys")
      .update({
        status: "used",
        activated_at: now.toISOString(),
        activated_by: user_id,
      })
      .eq("id", keyData.id);

    let entityName = "";

    if (keyData.target_type === "club") {
      if (keyData.target_entity_id) {
        const { data: club } = await supabaseClient
          .from("clubs")
          .update({
            contract_start: now.toISOString(),
            contract_expires_at: expiresAt.toISOString(),
            plan_type: keyData.plan_name.toLowerCase(),
            status: "active",
            is_active: true,
          })
          .eq("id", keyData.target_entity_id)
          .select("name")
          .maybeSingle();
        entityName = club?.name || "Clube";
      }
    } else if (keyData.target_type === "organizer") {
      if (keyData.target_entity_id) {
        const { data: org } = await supabaseClient
          .from("organizers")
          .update({
            contract_start: now.toISOString(),
            subscription_expires_at: expiresAt.toISOString(),
            subscription_status: "active",
            is_active: true,
            organizer_tier: keyData.plan_name.toLowerCase(),
          })
          .eq("id", keyData.target_entity_id)
          .select("name")
          .maybeSingle();
        entityName = org?.name || "Organizador";
      }

      // Also update user_logo_settings
      await supabaseClient.from("user_logo_settings").upsert(
        { user_id, is_paid_organizer: true, role: "organizer" },
        { onConflict: "user_id" }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        plan: keyData.plan_name,
        duration_months: keyData.duration_months,
        contract_start: now.toISOString(),
        contract_expires_at: expiresAt.toISOString(),
        entity_name: entityName,
        target_type: keyData.target_type,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
