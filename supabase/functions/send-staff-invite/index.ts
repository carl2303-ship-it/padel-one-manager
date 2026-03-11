import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface StaffInviteRequest {
  staffId: string;
  clubName?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    console.log('[send-staff-invite] Starting...');
    console.log('[send-staff-invite] RESEND_API_KEY configured:', !!resendApiKey);
    console.log('[send-staff-invite] RESEND_API_KEY length:', resendApiKey?.length || 0);

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[send-staff-invite] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-staff-invite] Authenticated user:', user.id, user.email);

    const body: StaffInviteRequest = await req.json();
    const { staffId, clubName } = body;
    console.log('[send-staff-invite] Request body:', { staffId, clubName });

    if (!staffId) {
      return new Response(
        JSON.stringify({ error: 'staffId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: staff, error: staffError } = await supabase
      .from('club_staff')
      .select('*')
      .eq('id', staffId)
      .eq('club_owner_id', user.id)
      .maybeSingle();

    if (staffError) {
      console.error('[send-staff-invite] Error fetching staff:', staffError);
      return new Response(
        JSON.stringify({ error: 'Staff member not found', details: staffError.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!staff) {
      console.error('[send-staff-invite] No staff found for id:', staffId, 'owner:', user.id);
      return new Response(
        JSON.stringify({ error: 'Staff member not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-staff-invite] Staff found:', { id: staff.id, name: staff.name, email: staff.email, role: staff.role });

    if (!staff.email) {
      return new Response(
        JSON.stringify({ error: 'Staff member has no email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(staff.email)) {
      console.error('[send-staff-invite] Invalid email format:', staff.email);
      return new Response(
        JSON.stringify({ error: `Invalid email format: ${staff.email}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const inviteToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: updateError } = await supabase
      .from('club_staff')
      .update({
        invite_token: inviteToken,
        invite_sent_at: new Date().toISOString(),
        invite_expires_at: expiresAt.toISOString(),
      })
      .eq('id', staffId);

    if (updateError) {
      console.error('[send-staff-invite] Error saving invite token:', updateError);
      throw new Error('Failed to save invite token');
    }

    console.log('[send-staff-invite] Invite token saved, expires:', expiresAt.toISOString());

    // Get app URL from environment or use default
    const appUrl = Deno.env.get('MANAGER_APP_URL') || 'https://padelclubmanagement.netlify.app';
    // Remove trailing slash if present
    const cleanAppUrl = appUrl.replace(/\/$/, '');
    const inviteUrl = `${cleanAppUrl}?staff-invite=${encodeURIComponent(inviteToken)}`;

    console.log('[send-staff-invite] Invite URL:', inviteUrl);

    // Also get the club name from the clubs table if not provided
    let finalClubName = clubName;
    if (!finalClubName || finalClubName === 'PADEL ONE Manager') {
      const { data: clubData } = await supabase
        .from('clubs')
        .select('name')
        .eq('owner_id', user.id)
        .maybeSingle();
      
      if (clubData?.name) {
        finalClubName = clubData.name;
        console.log('[send-staff-invite] Club name from DB:', finalClubName);
      }
    }

    const roleLabels: Record<string, string> = {
      admin: 'Administrador',
      bar_staff: 'Staff do Bar',
      coach: 'Treinador',
      receptionist: 'Rececionista',
      other: 'Staff',
    };

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite para Staff</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Convite para Staff</h1>
              ${finalClubName ? `<p style="margin: 10px 0 0; color: #d1fae5; font-size: 16px;">${finalClubName}</p>` : ''}
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 22px; font-weight: 600;">Olá ${staff.name}!</h2>

              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Foi convidado para fazer parte da equipa ${finalClubName ? `de <strong style="color: #1f2937;">${finalClubName}</strong>` : ''} como <strong style="color: #1f2937;">${roleLabels[staff.role] || staff.role}</strong>.
              </p>

              <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Clique no botão abaixo para criar a sua conta e aceder ao sistema de gestão.
              </p>

              <table role="presentation" style="margin: 0 auto 30px;">
                <tr>
                  <td>
                    <a href="${inviteUrl}" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">Aceitar Convite</a>
                  </td>
                </tr>
              </table>

              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 0 0 20px;">
                <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                  Ou copie e cole este link no seu navegador:
                </p>
                <p style="margin: 0; color: #1f2937; font-size: 14px; word-break: break-all; font-family: 'Courier New', monospace;">
                  ${inviteUrl}
                </p>
              </div>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin: 0 0 20px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                  <strong>Importante:</strong> Este convite expira em 7 dias. Se o link expirar, contacte o administrador para enviar um novo convite.
                </p>
              </div>

              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Se não solicitou este convite, pode ignorar este email.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                Este email foi enviado porque foi adicionado como membro do staff.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailPayload = {
      from: 'Padel Club <noreply@boostpadel.store>',
      to: [staff.email],
      subject: `Convite para Staff${finalClubName ? ` - ${finalClubName}` : ''}`,
      html: emailHtml,
      reply_to: user.email || undefined,
    };

    console.log('[send-staff-invite] Sending email via Resend...');
    console.log('[send-staff-invite] From:', emailPayload.from);
    console.log('[send-staff-invite] To:', emailPayload.to);
    console.log('[send-staff-invite] Subject:', emailPayload.subject);
    console.log('[send-staff-invite] Reply-To:', emailPayload.reply_to);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(emailPayload),
    });

    const resendData = await resendResponse.json();
    console.log('[send-staff-invite] Resend response status:', resendResponse.status);
    console.log('[send-staff-invite] Resend response data:', JSON.stringify(resendData));

    if (!resendResponse.ok) {
      console.error('[send-staff-invite] Resend API error:', resendResponse.status, JSON.stringify(resendData));
      
      // Return detailed error to client
      return new Response(
        JSON.stringify({
          error: `Erro ao enviar email: ${resendData.message || resendData.name || JSON.stringify(resendData)}`,
          resendStatus: resendResponse.status,
          resendError: resendData,
          sentTo: staff.email,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[send-staff-invite] Email sent successfully! Resend ID:', resendData.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invite email sent successfully',
        emailId: resendData.id,
        sentTo: staff.email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[send-staff-invite] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
