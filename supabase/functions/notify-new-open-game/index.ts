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
  creatorName: string | null;
  levelMin: number;
  levelMax: number;
  gender: "all" | "male" | "female" | "mixed";
  scheduledAt: string;
  clubId: string;
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
      creatorName,
      levelMin,
      levelMax,
      gender,
      scheduledAt,
      clubId,
      clubName,
      gameType,
    } = body;

    if (!gameId || !creatorUserId) {
      return new Response(
        JSON.stringify({ error: "gameId and creatorUserId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Find ALL matching player_accounts by level
    //    No club filter — players see the club name in the notification and decide
    //    Wider level range: ±1.0 instead of ±0.5 to include more candidates
    const widerLevelMin = Math.max(0.5, levelMin - 0.5);
    const widerLevelMax = levelMax + 0.5;

    const { data: levelCandidates, error: queryErr } = await admin
      .from("player_accounts")
      .select("id, user_id, name, gender, level, player_category, preferred_time")
      .not("user_id", "is", null)
      .gte("level", widerLevelMin)
      .lte("level", widerLevelMax);

    const { data: nullLevelCandidates } = await admin
      .from("player_accounts")
      .select("id, user_id, name, gender, level, player_category, preferred_time")
      .not("user_id", "is", null)
      .is("level", null);

    if (queryErr) {
      console.error("[notify-new-open-game] Query error:", queryErr);
      throw queryErr;
    }

    const seenIds = new Set<string>();
    const candidates = [...(levelCandidates || []), ...(nullLevelCandidates || [])].filter((p) => {
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });

    console.log(`[notify-new-open-game] Level ${widerLevelMin}-${widerLevelMax}: ${levelCandidates?.length || 0} candidates, null-level: ${nullLevelCandidates?.length || 0}, total: ${candidates.length}`);

    if (candidates.length === 0) {
      console.log("[notify-new-open-game] No candidates found");
      return new Response(
        JSON.stringify({ ok: true, notified: 0, reason: "no_candidates" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Filter by gender (inclusive: players without gender data are included)
    const genderFiltered = candidates.filter((p) => {
      if (gender === "all" || gender === "mixed") return true;
      const playerGender =
        p.gender ||
        (p.player_category?.startsWith("M") ? "male" : null) ||
        (p.player_category?.startsWith("F") ? "female" : null);
      if (!playerGender) return true;
      if (gender === "male") return playerGender === "male";
      if (gender === "female") return playerGender === "female";
      return true;
    });

    console.log(`[notify-new-open-game] After gender filter: ${genderFiltered.length} players`);

    // 3. Filter by preferred_time using club timezone
    let clubTimezone = "Europe/Lisbon";
    if (clubId) {
      const { data: clubRow } = await admin
        .from("clubs")
        .select("timezone")
        .eq("id", clubId)
        .maybeSingle();
      if (clubRow?.timezone) clubTimezone = clubRow.timezone;
    }

    let gameLocalHour: number;
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: clubTimezone,
        hour: "numeric",
        hour12: false,
      });
      gameLocalHour = parseInt(formatter.format(new Date(scheduledAt)), 10);
    } catch {
      gameLocalHour = new Date(scheduledAt).getUTCHours();
    }

    const timeFiltered = genderFiltered.filter((p) => {
      if (!p.preferred_time || p.preferred_time === "all_day") return true;
      if (p.preferred_time === "morning" && gameLocalHour >= 6 && gameLocalHour < 13) return true;
      if (p.preferred_time === "afternoon" && gameLocalHour >= 13 && gameLocalHour < 19) return true;
      if (p.preferred_time === "evening" && (gameLocalHour >= 19 || gameLocalHour < 6)) return true;
      return false;
    });

    console.log(`[notify-new-open-game] After time filter: ${timeFiltered.length} players (gameLocalHour=${gameLocalHour}, tz=${clubTimezone})`);

    // 4. Exclude creator
    const filtered = timeFiltered.filter(
      (p) => p.user_id !== creatorUserId && p.id !== creatorPlayerAccountId,
    );

    console.log(`[notify-new-open-game] After excluding creator: ${filtered.length} players`);

    if (filtered.length === 0) {
      console.log("[notify-new-open-game] No players after filtering");
      return new Response(
        JSON.stringify({ ok: true, notified: 0, reason: "no_matching_players" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 5. Format notification using club local time
    let timeStr: string;
    let dateStr: string;
    try {
      const timeFmt = new Intl.DateTimeFormat("pt-PT", {
        timeZone: clubTimezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const dateFmt = new Intl.DateTimeFormat("pt-PT", {
        timeZone: clubTimezone,
        day: "2-digit",
        month: "2-digit",
      });
      timeStr = timeFmt.format(new Date(scheduledAt));
      dateStr = dateFmt.format(new Date(scheduledAt));
    } catch {
      const gameDate = new Date(scheduledAt);
      timeStr = `${gameDate.getUTCHours().toString().padStart(2, "0")}:${gameDate.getUTCMinutes().toString().padStart(2, "0")}`;
      dateStr = `${gameDate.getUTCDate().toString().padStart(2, "0")}/${(gameDate.getUTCMonth() + 1).toString().padStart(2, "0")}`;
    }

    const typeLabel = gameType === "competitive" ? "Competitivo" : "Amigável";
    const displayName = creatorName || "Um jogador";

    const payload = {
      title: `${displayName} abriu um jogo! Queres juntar-te?`,
      body: `${clubName} · ${dateStr} às ${timeStr} · ${typeLabel} · Nível ${levelMin.toFixed(1)}-${levelMax.toFixed(1)}`,
      url: "/?screen=findGame",
      tag: `new-game-${gameId}`,
    };

    // 6. Send to all matching players (cap at 200)
    const targets = filtered.slice(0, 200);
    console.log(`[notify-new-open-game] Sending push to ${targets.length} players`);

    let totalSent = 0;
    let totalSubs = 0;
    const results = await Promise.allSettled(
      targets.map(async (p) => {
        const r = await deliverWebPushNotifications(admin, {
          vapidPublicKey,
          vapidPrivateKey,
          playerAccountId: p.id,
          payload,
          appSource: "player",
        });
        return r;
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        totalSent += r.value.sentCount;
        totalSubs += r.value.totalSubscriptions;
      } else {
        console.error("[notify-new-open-game] Push delivery error:", r.reason);
      }
    }

    console.log(`[notify-new-open-game] Done: ${totalSent}/${totalSubs} push delivered to ${targets.length} targets`);

    return new Response(
      JSON.stringify({ ok: true, notified: targets.length, delivered: totalSent, totalSubscriptions: totalSubs }),
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
