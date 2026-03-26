import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/**
 * Notify matching players when a new class is created.
 * Matches on: level, gender
 * Called from Manager App when a professor opens a class.
 */

interface NotifyNewClassRequest {
  level: string | null;        // e.g. "2", "3-4", "all"
  gender: 'M' | 'F' | 'Misto' | null;
  clubName: string;
  className: string;
  coachName: string;
  scheduledAt: string;         // ISO date
}

function parseLevelRange(level: string | null): { min: number; max: number } | null {
  if (!level || level === 'all' || level === 'Todos') return null;

  // Handle ranges like "3-4", "2-3"
  const rangeMatch = level.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
  }

  // Handle single level like "3", "4.5"
  const singleMatch = level.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1]);
    return { min: val - 0.5, max: val + 0.5 };
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotifyNewClassRequest = await req.json();
    const { level, gender, clubName, className, coachName, scheduledAt } = body;

    if (!scheduledAt) {
      return new Response(
        JSON.stringify({ error: 'scheduledAt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse level range
    const levelRange = parseLevelRange(level);

    // Query matching player_accounts
    let query = supabase
      .from('player_accounts')
      .select('id, level, gender')
      .not('id', 'is', null);

    // Filter by level if specified
    if (levelRange) {
      query = query.gte('level', levelRange.min).lte('level', levelRange.max);
    }

    const { data: matchingPlayers, error: playersError } = await query;

    if (playersError || !matchingPlayers || matchingPlayers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No matching players found', notified: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter by gender
    let filtered = matchingPlayers;
    if (gender && gender !== 'Misto') {
      const targetGender = gender === 'M' ? 'male' : 'female';
      filtered = matchingPlayers.filter(p => !p.gender || p.gender === targetGender);
    }

    if (filtered.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No matching players after gender filter', notified: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format time
    const classDate = new Date(scheduledAt);
    const timeStr = `${classDate.getHours().toString().padStart(2, '0')}:${classDate.getMinutes().toString().padStart(2, '0')}`;
    const dateStr = `${classDate.getDate().toString().padStart(2, '0')}/${(classDate.getMonth() + 1).toString().padStart(2, '0')}`;

    const genderEmoji = gender === 'M' ? '♂️' : gender === 'F' ? '♀️' : '🎾';
    const levelLabel = level && level !== 'all' ? ` - Nível ${level}` : '';

    const payload = {
      title: `Nova Aula ${genderEmoji}${levelLabel}`,
      body: `${className} com ${coachName} em ${clubName} | ${dateStr} às ${timeStr}`,
      url: '/?screen=learn',
      tag: `new-class-${scheduledAt}`,
    };

    // Send to all matching players (limit 100)
    const targets = filtered.slice(0, 100);
    let notifiedCount = 0;
    const errors: string[] = [];

    for (const player of targets) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            playerAccountId: player.id,
            payload,
          }),
        });

        const result = await response.json();
        if (result.success || result.sentCount > 0) {
          notifiedCount++;
        }
      } catch (err) {
        errors.push(`Failed to notify ${player.id}: ${err}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        matchingPlayers: filtered.length,
        notified: notifiedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in notify-new-class:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
