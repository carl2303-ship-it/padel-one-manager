import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { assertClubModule } from "../_shared/modules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotifyRequest {
  club_id?: string;
  organizer_user_id?: string;
  channel?: string;
  customer_name?: string;
  customer_phone?: string;
  message?: string;
  intent?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as NotifyRequest;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (body.club_id) {
      const modError = await assertClubModule(body.club_id, "ai_light");
      if (modError) {
        return new Response(JSON.stringify({ error: modError }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: club } = await supabase
        .from("clubs")
        .select("owner_id, name, email")
        .eq("id", body.club_id)
        .maybeSingle();

      if (club?.owner_id) {
        await supabase.from("push_subscriptions").select("id").limit(1);
        // Notify via edge function if available
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              user_id: club.owner_id,
              title: "Pedido de reserva (AI Light)",
              body: `${body.customer_name || "Cliente"}: ${body.message || body.intent || "Pedido de disponibilidade"}`,
              appSource: "manager",
            }),
          });
        } catch { /* push optional */ }
      }
    } else if (body.organizer_user_id) {
      const { data: hasLight } = await supabase.rpc("has_module", {
        p_entity_type: "organizer",
        p_entity_id: body.organizer_user_id,
        p_module_code: "ai_light",
      });
      if (!hasLight) {
        return new Response(JSON.stringify({ error: "ai_light module not active" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "club_id or organizer_user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, notified: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
