import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { deliverWebPushNotifications } from "../_shared/deliverPush.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  gameId: string;
  creatorUserId: string;
  creatorPlayerAccountId: string | null;
  levelMin: number;
  levelMax: number;
  gender: "all" | "male" | "female" | "mixed";
  scheduledAt: string;
  clubName: string;
  gameType: "competitive" | "friendly";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ ok: true, message: "VAPID not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body: RequestBody = await req.json();
    const {
      gameId,
      creatorUserId,
      creatorPlayerAccountId,
      levelMin,
      levelMax,
      gender,
      scheduledAt,
      clubName,
      gameType,
    } = body;

    if (!gameId || !creatorUserId) {
      return new Response(
        JSON.stringify({ error: "gameId and creatorUserId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Find matching player_accounts by level
    const { data: candidates, error: queryErr } = await admin
      .from("player_accounts")
      .select("id, user_id, name, gender, level, player_category")
      .not("user_id", "is", null)
      .gte("level", levelMin)
      .lte("level", levelMax);

    if (queryErr) {
      console.error("[notify-new-open-game] Query error:", queryErr);
      throw queryErr;
    }

    if (!candidates || candidates.length === 0) {
      console.log("[notify-new-open-game] No candidates found for level range", levelMin, "-", levelMax);
      return new Response(
        JSON.stringify({ ok: true, notified: 0, reason: "no_candidates" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Filter by gender
    const genderFiltered = candidates.filter((p) => {
      if (gender === "all" || gender === "mixed") return true;

      const playerGender =
        p.gender ||
        (p.player_category?.startsWith("M") ? "male" : null) ||
        (p.player_category?.startsWith("F") ? "female" : null);

      if (gender === "male") return playerGender === "male";
      if (gender === "female") return playerGender === "female";
      return true;
    });

    // 3. Exclude creator (by user_id AND player_account_id)
    const filtered = genderFiltered.filter(
      (p) => p.user_id !== creatorUserId && p.id !== creatorPlayerAccountId,
    );

    if (filtered.length === 0) {
      console.log("[notify-new-open-game] No players after filtering");
      return new Response(
        JSON.stringify({ ok: true, notified: 0, reason: "no_matching_players" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Format notification
    const gameDate = new Date(scheduledAt);
    const timeStr = `${gameDate.getHours().toString().padStart(2, "0")}:${gameDate.getMinutes().toString().padStart(2, "0")}`;
    const dateStr = `${gameDate.getDate().toString().padStart(2, "0")}/${(gameDate.getMonth() + 1).toString().padStart(2, "0")}`;

    const genderEmoji =
      gender === "male" ? "♂️" : gender === "female" ? "♀️" : "🎾";
    const typeLabel = gameType === "competitive" ? "Competitivo" : "Amigável";

    const payload = {
      title: `Novo Jogo ${genderEmoji} - Nível ${levelMin.toFixed(1)}-${levelMax.toFixed(1)}`,
      body: `${clubName} ${dateStr} às ${timeStr} (${typeLabel}). Junta-te!`,
      url: "/?screen=findGame",
      tag: `new-game-${gameId}`,
    };

    // 5. Send to all matching players (cap at 100)
    const targets = filtered.slice(0, 100);
    console.log(`[notify-new-open-game] Sending to ${targets.length} players`);

    let totalSent = 0;
    const results = await Promise.allSettled(
      targets.map(async (p) => {
        const r = await deliverWebPushNotifications(admin, {
          vapidPublicKey,
          vapidPrivateKey,
          playerAccountId: p.id,
          payload,
        });
        return r.sentCount;
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled") totalSent += r.value;
    }

    console.log(`[notify-new-open-game] Done: ${totalSent} push notifications delivered`);

    return new Response(
      JSON.stringify({ ok: true, notified: targets.length, delivered: totalSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[notify-new-open-game] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
