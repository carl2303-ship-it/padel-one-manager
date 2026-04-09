import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) throw new Error("Missing auth token");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) throw new Error("Unauthorized");
    const userId = authData.user.id;

    const { gameId } = await req.json();
    if (!gameId) throw new Error("Missing gameId");

    const { data: game, error: gameErr } = await admin
      .from("open_games")
      .select("id, creator_user_id, club_id")
      .eq("id", gameId)
      .maybeSingle();
    if (gameErr || !game) throw new Error("Open game not found");

    const isCreator = game.creator_user_id === userId;
    let isClubOwner = false;
    if (!isCreator && game.club_id) {
      const { data: club } = await admin
        .from("clubs")
        .select("owner_id")
        .eq("id", game.club_id)
        .maybeSingle();
      isClubOwner = club?.owner_id === userId;
    }
    if (!isCreator && !isClubOwner) throw new Error("Forbidden");

    const { data: updatedRows, error: bookingErr } = await admin
      .from("court_bookings")
      .update({ status: "cancelled" })
      .eq("event_type", "open_game")
      .ilike("notes", `%ID: ${gameId}%`)
      .neq("status", "cancelled")
      .select("id");
    if (bookingErr) throw bookingErr;

    return new Response(
      JSON.stringify({
        success: true,
        gameId,
        cancelledBookings: (updatedRows || []).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

