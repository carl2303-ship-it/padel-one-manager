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
    const { email, password, mode } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const emailLower = email.toLowerCase().trim();

    // Mode "lookup" — just find the user by email without creating
    if (mode === "lookup") {
      const { data: authUser } = await supabaseAdmin.rpc("get_user_id_by_email", {
        lookup_email: emailLower,
      });

      // Fallback: query auth.users directly via SQL if RPC doesn't exist
      if (authUser) {
        return new Response(
          JSON.stringify({ user_id: authUser, found: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try listing with pagination as second fallback
      let page = 1;
      const perPage = 100;
      while (true) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        const users = listData?.users ?? [];
        const found = users.find((u) => u.email?.toLowerCase() === emailLower);
        if (found) {
          return new Response(
            JSON.stringify({ user_id: found.id, found: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (users.length < perPage) break;
        page++;
      }

      return new Response(
        JSON.stringify({ user_id: null, found: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode "create" (default) — create user or find existing
    if (!password) {
      return new Response(
        JSON.stringify({ error: "Password é obrigatória para criar conta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to create the user first
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: emailLower,
        password,
        email_confirm: true,
      });

    if (!createError && newUser?.user?.id) {
      const userId = newUser.user.id;

      const { data: existingRole } = await supabaseAdmin
        .from("user_logo_settings")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingRole) {
        await supabaseAdmin
          .from("user_logo_settings")
          .insert({ user_id: userId, role: "club_owner", logo_url: null });
      }

      return new Response(
        JSON.stringify({ user_id: userId, is_new: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Creation failed — user likely exists. Search with pagination.
    let page = 1;
    const perPage = 100;
    while (true) {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      const users = listData?.users ?? [];
      const found = users.find((u) => u.email?.toLowerCase() === emailLower);
      if (found) {
        return new Response(
          JSON.stringify({ user_id: found.id, is_new: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (users.length < perPage) break;
      page++;
    }

    return new Response(
      JSON.stringify({ error: createError?.message || "Não foi possível criar nem encontrar o utilizador" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
