import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface NotifyRequest {
  userId: string;
  type: 'booking_created' | 'booking_cancelled' | 'class_enrollment' | 'class_cancellation';
  bookingId?: string;
  courtName?: string;
  playerName?: string;
  className?: string;
  classDate?: string;
  classTime?: string;
}

async function sendPushNotification(
  supabaseUrl: string,
  supabaseKey: string,
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ userId, payload }),
    });
    const data = await response.json();
    console.log('Push notification result:', data);
    return data;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotifyRequest = await req.json();
    const { userId, type, bookingId, courtName, playerName, className, classDate, classTime } = body;

    if (!userId || !type) {
      return new Response(
        JSON.stringify({ error: 'userId and type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let pushPayload: { title: string; body: string; url?: string; tag?: string };

    switch (type) {
      case 'booking_created':
        pushPayload = {
          title: 'Nova Reserva de Campo',
          body: `${playerName || 'Cliente'} reservou ${courtName || 'um campo'}`,
          url: '/bookings',
          tag: `booking-${bookingId || 'new'}`,
        };
        break;

      case 'booking_cancelled':
        pushPayload = {
          title: 'Reserva Cancelada',
          body: `${playerName || 'Cliente'} cancelou a reserva de ${courtName || 'um campo'}`,
          url: '/bookings',
          tag: `booking-cancelled-${bookingId || 'new'}`,
        };
        break;

      case 'class_enrollment':
        const classDateTime = classDate && classTime 
          ? `${new Date(classDate).toLocaleDateString('pt-PT')} às ${classTime}`
          : classDate 
            ? new Date(classDate).toLocaleDateString('pt-PT')
            : 'uma aula';
        pushPayload = {
          title: 'Nova Inscrição em Aula',
          body: `${playerName || 'Aluno'} inscreveu-se em ${className || 'uma aula'} (${classDateTime})`,
          url: '/academy',
          tag: `class-enrollment-${Date.now()}`,
        };
        break;

      case 'class_cancellation':
        const cancelDateTime = classDate && classTime 
          ? `${new Date(classDate).toLocaleDateString('pt-PT')} às ${classTime}`
          : classDate 
            ? new Date(classDate).toLocaleDateString('pt-PT')
            : 'uma aula';
        pushPayload = {
          title: 'Cancelamento de Inscrição',
          body: `${playerName || 'Aluno'} cancelou a inscrição em ${className || 'uma aula'} (${cancelDateTime})`,
          url: '/academy',
          tag: `class-cancellation-${Date.now()}`,
        };
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid notification type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const pushResult = await sendPushNotification(
      supabaseUrl,
      supabaseServiceKey,
      userId,
      pushPayload
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Manager notified',
        pushSent: pushResult?.success || false,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in notify-manager:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
