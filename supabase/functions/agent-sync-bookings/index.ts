import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Agent-Key",
};

interface BookingPayload {
  court_id: string;
  start_time: string;
  end_time: string;
  booked_by_name?: string;
  booked_by_phone?: string;
  player1_name?: string;
  player1_phone?: string;
  player2_name?: string;
  player2_phone?: string;
  player3_name?: string;
  player3_phone?: string;
  player4_name?: string;
  player4_phone?: string;
  status?: string;
  price?: number;
  payment_status?: string;
  notes?: string;
  event_type?: string;
}

function validateBooking(b: BookingPayload): string | null {
  if (!b.court_id) return "court_id is required";
  if (!b.start_time) return "start_time is required (ISO 8601)";
  if (!b.end_time) return "end_time is required (ISO 8601)";
  const start = new Date(b.start_time);
  const end = new Date(b.end_time);
  if (isNaN(start.getTime())) return "start_time is not a valid date";
  if (isNaN(end.getTime())) return "end_time is not a valid date";
  if (end <= start) return "end_time must be after start_time";
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const agentKey = req.headers.get("X-Agent-Key") || req.headers.get("x-agent-key");
    const expectedKey = Deno.env.get("AGENT_API_KEY");

    if (!expectedKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server misconfigured: AGENT_API_KEY not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!agentKey || agentKey !== expectedKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: invalid or missing X-Agent-Key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const action = body.action as string;

    // ─── GET COURTS ───
    if (action === "get_courts") {
      const clubId = body.club_id as string | undefined;
      let q = admin.from("club_courts").select("id, name, type, user_id, is_active, hourly_rate");
      if (clubId) {
        const { data: club } = await admin.from("clubs").select("owner_id").eq("id", clubId).maybeSingle();
        if (club?.owner_id) q = q.eq("user_id", club.owner_id);
      }
      const { data: courts, error } = await q.eq("is_active", true);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, courts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── GET BOOKINGS ───
    if (action === "get_bookings") {
      const courtId = body.court_id as string | undefined;
      const dateFrom = body.date_from as string | undefined;
      const dateTo = body.date_to as string | undefined;
      let q = admin.from("court_bookings").select("*").neq("status", "cancelled");
      if (courtId) q = q.eq("court_id", courtId);
      if (dateFrom) q = q.gte("start_time", dateFrom);
      if (dateTo) q = q.lte("start_time", dateTo);
      q = q.order("start_time", { ascending: true }).limit(500);
      const { data: bookings, error } = await q;
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, bookings }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── CREATE BOOKING ───
    if (action === "create_booking") {
      const booking = body.booking as BookingPayload;
      if (!booking) throw new Error("Missing 'booking' object");
      const validationError = validateBooking(booking);
      if (validationError) throw new Error(validationError);

      const { data: court } = await admin.from("club_courts").select("id").eq("id", booking.court_id).maybeSingle();
      if (!court) throw new Error(`Court ${booking.court_id} not found`);

      const { data: overlap } = await admin
        .from("court_bookings")
        .select("id")
        .eq("court_id", booking.court_id)
        .neq("status", "cancelled")
        .lt("start_time", booking.end_time)
        .gt("end_time", booking.start_time)
        .limit(1);
      if (overlap && overlap.length > 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Time slot overlaps with an existing booking", overlapping_id: overlap[0].id }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const insertData: Record<string, unknown> = {
        court_id: booking.court_id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        booked_by_name: booking.booked_by_name || booking.player1_name || null,
        booked_by_phone: booking.booked_by_phone || booking.player1_phone || null,
        player1_name: booking.player1_name || null,
        player1_phone: booking.player1_phone || null,
        player2_name: booking.player2_name || null,
        player2_phone: booking.player2_phone || null,
        player3_name: booking.player3_name || null,
        player3_phone: booking.player3_phone || null,
        player4_name: booking.player4_name || null,
        player4_phone: booking.player4_phone || null,
        status: booking.status || "confirmed",
        price: booking.price ?? 0,
        payment_status: booking.payment_status || "pending",
        notes: booking.notes || "Synced via agent",
        event_type: booking.event_type || "match",
      };

      const { data: created, error } = await admin.from("court_bookings").insert(insertData).select("id, start_time, end_time").single();
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, booking: created }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── CREATE BOOKINGS (BULK) ───
    if (action === "create_bookings") {
      const bookings = body.bookings as BookingPayload[];
      if (!Array.isArray(bookings) || bookings.length === 0) throw new Error("Missing 'bookings' array");
      if (bookings.length > 50) throw new Error("Maximum 50 bookings per request");

      const results: { index: number; success: boolean; id?: string; error?: string }[] = [];

      for (let i = 0; i < bookings.length; i++) {
        const b = bookings[i];
        const validationError = validateBooking(b);
        if (validationError) {
          results.push({ index: i, success: false, error: validationError });
          continue;
        }

        const { data: overlap } = await admin
          .from("court_bookings")
          .select("id")
          .eq("court_id", b.court_id)
          .neq("status", "cancelled")
          .lt("start_time", b.end_time)
          .gt("end_time", b.start_time)
          .limit(1);
        if (overlap && overlap.length > 0) {
          results.push({ index: i, success: false, error: "Overlapping booking" });
          continue;
        }

        const { data: created, error } = await admin
          .from("court_bookings")
          .insert({
            court_id: b.court_id,
            start_time: b.start_time,
            end_time: b.end_time,
            booked_by_name: b.booked_by_name || b.player1_name || null,
            booked_by_phone: b.booked_by_phone || b.player1_phone || null,
            player1_name: b.player1_name || null,
            player1_phone: b.player1_phone || null,
            player2_name: b.player2_name || null,
            player2_phone: b.player2_phone || null,
            player3_name: b.player3_name || null,
            player3_phone: b.player3_phone || null,
            player4_name: b.player4_name || null,
            player4_phone: b.player4_phone || null,
            status: b.status || "confirmed",
            price: b.price ?? 0,
            payment_status: b.payment_status || "pending",
            notes: b.notes || "Synced via agent",
            event_type: b.event_type || "match",
          })
          .select("id")
          .single();

        if (error) {
          results.push({ index: i, success: false, error: error.message });
        } else {
          results.push({ index: i, success: true, id: created?.id });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      return new Response(
        JSON.stringify({ success: true, total: bookings.length, created: successCount, results }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── CANCEL BOOKING ───
    if (action === "cancel_booking") {
      const bookingId = body.booking_id as string;
      if (!bookingId) throw new Error("Missing booking_id");
      const { error } = await admin.from("court_bookings").update({ status: "cancelled" }).eq("id", bookingId);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, cancelled: bookingId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    throw new Error(`Unknown action: ${action}. Supported: get_courts, get_bookings, create_booking, create_bookings, cancel_booking`);
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
