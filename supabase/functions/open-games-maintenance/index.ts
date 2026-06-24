import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { deliverWebPushNotifications, type PushPayload } from "../_shared/deliverPush.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    const admin = createClient(supabaseUrl, serviceKey);

    let body: { action?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = { action: "alert_incomplete" };
    }

    const results: string[] = [];

    // Run cleanup of expired incomplete games on every maintenance call
    const { data: cleanupCount, error: cleanupErr } = await admin.rpc(
      "cleanup_expired_open_games",
    );
    if (cleanupErr) {
      console.error("[Maintenance] cleanup_expired_open_games error:", cleanupErr);
      results.push(`Cleanup error: ${cleanupErr.message}`);
    } else {
      results.push(`Cleanup processed ${cleanupCount ?? 0} games`);
    }

    // ================================================================
    // Alert creators when their open game lost court availability
    // ================================================================
    {
      const now = new Date();
      const { data: openGames, error: openGamesErr } = await admin
        .from("open_games")
        .select("id, court_id, scheduled_at, duration_minutes, creator_user_id, club_id")
        .eq("status", "open")
        .not("court_id", "is", null)
        .gte("scheduled_at", now.toISOString());

      if (openGamesErr) {
        console.error("[Maintenance] Error fetching open games:", openGamesErr);
        results.push(`Court check error: ${openGamesErr.message}`);
      } else if (openGames && openGames.length > 0) {
        for (const game of openGames) {
          const slotStart = new Date(game.scheduled_at);
          const slotEnd = new Date(
            slotStart.getTime() + (game.duration_minutes || 90) * 60000,
          );

          const { data: conflicts } = await admin
            .from("court_bookings")
            .select("id, notes, event_type")
            .eq("court_id", game.court_id)
            .eq("status", "confirmed")
            .lt("start_time", slotEnd.toISOString())
            .gt("end_time", slotStart.toISOString());

          const hasConflict = (conflicts || []).some((booking) => {
            if (booking.event_type === "open_game" && booking.notes?.includes(`ID: ${game.id}`)) {
              return false;
            }
            return true;
          });

          if (!hasConflict) continue;

          const { data: alreadySent } = await admin
            .from("open_game_notifications_sent")
            .select("id")
            .eq("game_id", game.id)
            .eq("notification_type", "court_unavailable")
            .maybeSingle();

          if (alreadySent) continue;

          const { data: creatorAccount } = await admin
            .from("player_accounts")
            .select("id")
            .eq("user_id", game.creator_user_id)
            .maybeSingle();

          if (creatorAccount?.id && vapidPublicKey && vapidPrivateKey) {
            const payload: PushPayload = {
              title: "Jogo vai ser cancelado ⚠️",
              body: "O campo já não está disponível nesse horário. O teu jogo aberto vai ser cancelado.",
              url: "/?screen=games",
              tag: `court-unavailable-${game.id}`,
            };

            try {
              await deliverWebPushNotifications(admin, {
                vapidPublicKey,
                vapidPrivateKey,
                playerAccountId: creatorAccount.id,
                payload,
                appSource: "player",
              });

              await admin.from("open_game_notifications_sent").insert({
                game_id: game.id,
                player_account_id: creatorAccount.id,
                notification_type: "court_unavailable",
              });

              results.push(`Court unavailable alert sent for game ${game.id}`);
            } catch (pushErr) {
              console.error(`[Maintenance] Court alert push error for ${game.id}:`, pushErr);
            }
          }

          await admin.from("open_game_players").delete().eq("game_id", game.id);
          await admin.from("open_games").delete().eq("id", game.id);
          results.push(`Cancelled open game ${game.id} due to court conflict`);
        }
      }
    }

    // ================================================================
    // Alert: games starting within 3 hours with < 3 confirmed players
    // ================================================================
    if (body.action === "alert_incomplete") {
      const now = new Date();
      const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);

      // Find open/full games starting within the next 3 hours
      const { data: upcomingGames, error: gamesErr } = await admin
        .from("open_games")
        .select(`
          id,
          club_id,
          court_id,
          scheduled_at,
          duration_minutes,
          game_type,
          status,
          creator_user_id
        `)
        .in("status", ["open"])
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", threeHoursLater.toISOString());

      if (gamesErr) {
        console.error("[Maintenance] Error fetching upcoming games:", gamesErr);
        throw gamesErr;
      }

      if (!upcomingGames || upcomingGames.length === 0) {
        results.push("No incomplete games found within 3 hours");
      } else {
        for (const game of upcomingGames) {
          // Count confirmed players
          const { count } = await admin
            .from("open_game_players")
            .select("id", { count: "exact", head: true })
            .eq("game_id", game.id)
            .eq("status", "confirmed");

          const playerCount = count || 0;

          if (playerCount >= 3) continue;

          // Get club info and owner
          const { data: club } = await admin
            .from("clubs")
            .select("id, name, owner_id")
            .eq("id", game.club_id)
            .maybeSingle();

          if (!club?.owner_id) continue;

          // Get court name
          const { data: court } = await admin
            .from("club_courts")
            .select("name")
            .eq("id", game.court_id)
            .maybeSingle();

          const gameDate = new Date(game.scheduled_at);
          const timeStr = `${gameDate.getHours().toString().padStart(2, "0")}:${gameDate.getMinutes().toString().padStart(2, "0")}`;

          // Check if we already sent this alert (avoid spam) using a simple time check
          // We use the tag to deduplicate on the client side
          const alertTag = `incomplete-game-${game.id}`;

          // Send push to club owner (Manager app)
          if (vapidPublicKey && vapidPrivateKey) {
            const payload: PushPayload = {
              title: `⚠️ Jogo com apenas ${playerCount} jogador${playerCount !== 1 ? "es" : ""}`,
              body: `${court?.name || "Campo"} às ${timeStr} — apenas ${playerCount}/4 jogadores confirmados. Considere cancelar para libertar o campo.`,
              url: "/",
              tag: alertTag,
            };

            try {
              await deliverWebPushNotifications(admin, {
                vapidPublicKey,
                vapidPrivateKey,
                userId: club.owner_id,
                payload,
                appSource: "manager",
              });
              results.push(`Alert sent to club ${club.name} owner for game ${game.id} (${playerCount}/4 players)`);
            } catch (pushErr) {
              console.error(`[Maintenance] Push error for game ${game.id}:`, pushErr);
              results.push(`Push error for game ${game.id}: ${pushErr}`);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Maintenance] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
