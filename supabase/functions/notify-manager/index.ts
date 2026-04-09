import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface NotifyRequest {
  userId: string;
  type: 'booking_created' | 'booking_cancelled' | 'class_enrollment' | 'class_cancellation' | 'qr_order';
  bookingId?: string;
  courtName?: string;
  playerName?: string;
  playerNames?: string[];
  className?: string;
  classDate?: string;
  classTime?: string;
  scheduledAt?: string;
  endAt?: string;
}

function formatPtDateTime(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function sendBookingEmailToManager(params: {
  resendApiKey: string;
  recipientEmails: string[];
  managerName?: string;
  clubName?: string;
  type: 'booking_created' | 'booking_cancelled';
  bookingId?: string;
  courtName?: string;
  playerNames?: string[];
  scheduledAt?: string;
  endAt?: string;
}) {
  const playerNames = (params.playerNames || []).filter(Boolean);
  const namesText = playerNames.length ? playerNames.join(', ') : 'Cliente';
  const isCreated = params.type === 'booking_created';
  const subject = isCreated
    ? `Nova reserva de campo${params.clubName ? ` - ${params.clubName}` : ''}`
    : `Reserva de campo cancelada${params.clubName ? ` - ${params.clubName}` : ''}`;
  const startLabel = formatPtDateTime(params.scheduledAt);
  const endLabel = formatPtDateTime(params.endAt);
  const dateTimeLabel = endLabel !== '-' ? `${startLabel} - ${endLabel}` : startLabel;
  const statusLabel = isCreated ? 'Nova reserva' : 'Reserva cancelada';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px;">${subject}</h2>
      ${params.clubName ? `<p style="margin: 0 0 8px; color:#6b7280;"><strong>Clube:</strong> ${params.clubName}</p>` : ''}
      <p style="margin-top: 0;">Olá ${params.managerName || 'Manager'},</p>
      <p>Recebeste uma atualização de reserva no teu clube.</p>
      <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Estado</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${statusLabel}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Jogadores</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${namesText}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Data/Hora</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${dateTimeLabel}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Campo</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${params.courtName || 'Campo'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>ID Reserva</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${params.bookingId || '-'}</td></tr>
      </table>
    </div>
  `;

  const emailResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.resendApiKey}`,
    },
    body: JSON.stringify({
      from: 'Padel One <noreply@boostpadel.store>',
      to: params.recipientEmails,
      subject,
      html,
    }),
  });

  if (!emailResp.ok) {
    const errPayload = await emailResp.text().catch(() => '');
    throw new Error(`Failed sending manager booking email: ${emailResp.status} ${errPayload}`);
  }
}

async function sendPushNotification(
  supabaseUrl: string,
  supabaseKey: string,
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
  appSource: string = 'manager'
) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ userId, payload, appSource }),
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
    const {
      userId,
      type,
      bookingId,
      courtName,
      playerName,
      playerNames,
      className,
      classDate,
      classTime,
      scheduledAt,
      endAt,
    } = body;

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

      case 'qr_order':
        pushPayload = {
          title: '🔔 Novo Pedido QR!',
          body: `${courtName || 'Mesa'} — ${playerName || 'Cliente'} fez um novo pedido`,
          url: '/',
          tag: `qr-order-${bookingId || Date.now()}`,
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

    let bookingEmailSent = false;
    let bookingEmailError: string | null = null;
    let bookingEmailRecipients = 0;
    if (type === 'booking_created' || type === 'booking_cancelled') {
      try {
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

        const { data: managerUser, error: managerUserErr } = await supabase.auth.admin.getUserById(userId);
        if (managerUserErr || !managerUser.user?.email) {
          throw new Error('Manager email not found');
        }

        const { data: club } = await supabase
          .from('clubs')
          .select('name, email')
          .eq('owner_id', userId)
          .maybeSingle();

        const { data: staffRows } = await supabase
          .from('club_staff')
          .select('email, is_active, perm_bookings, role')
          .eq('club_owner_id', userId)
          .eq('is_active', true);

        const recipientSet = new Set<string>();
        for (const s of staffRows || []) {
          const row = s as {
            email?: string | null;
            perm_bookings?: boolean | null;
            role?: string | null;
          };
          const canManageBookings = row.perm_bookings === true || row.role === 'admin';
          if (!canManageBookings) continue;
          if (row.email) recipientSet.add(String(row.email).trim().toLowerCase());
        }

        // Fallback de segurança: se não existir nenhum staff elegível, envia ao owner.
        if (!recipientSet.size && managerUser.user?.email) {
          recipientSet.add(managerUser.user.email.trim().toLowerCase());
        }

        const recipientEmails = Array.from(recipientSet).filter((e) => e.includes('@'));
        if (!recipientEmails.length) throw new Error('No valid email recipients found');

        await sendBookingEmailToManager({
          resendApiKey,
          recipientEmails,
          managerName: managerUser.user.user_metadata?.name,
          clubName: club?.name || undefined,
          type,
          bookingId,
          courtName,
          playerNames: playerNames && playerNames.length > 0 ? playerNames : [playerName || 'Cliente'],
          scheduledAt,
          endAt,
        });
        bookingEmailSent = true;
        bookingEmailRecipients = recipientEmails.length;
      } catch (mailErr) {
        bookingEmailError = mailErr instanceof Error ? mailErr.message : String(mailErr);
        console.error('Error sending booking email:', bookingEmailError);
      }
    }

    // For QR orders, also notify bar_staff and kitchen staff
    if (type === 'qr_order') {
      try {
        const { data: staffMembers } = await supabase
          .from('club_staff')
          .select('user_id, role')
          .eq('club_owner_id', userId)
          .eq('is_active', true)
          .in('role', ['bar_staff', 'kitchen', 'admin']);

        if (staffMembers && staffMembers.length > 0) {
          for (const staff of staffMembers) {
            if (staff.user_id) {
              const staffPayload = staff.role === 'kitchen'
                ? { 
                    title: '👨‍🍳 Novo Pedido (Cozinha)!',
                    body: `${courtName || 'Mesa'} — Novo pedido com comida`,
                    url: '/',
                    tag: `kitchen-order-${bookingId || Date.now()}`
                  }
                : pushPayload;
              
              await sendPushNotification(supabaseUrl, supabaseServiceKey, staff.user_id, staffPayload);
            }
          }
        }
      } catch (staffErr) {
        console.warn('Error notifying staff:', staffErr);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Manager notified',
        pushSent: pushResult?.success || false,
        bookingEmailSent,
        bookingEmailError,
        bookingEmailRecipients,
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
