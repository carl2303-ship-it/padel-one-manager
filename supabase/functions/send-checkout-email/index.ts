import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const { to_email, to_name, checkout_url, plan_name, target_type } = await req.json();

    if (!to_email || !checkout_url) {
      return new Response(
        JSON.stringify({ error: "to_email and checkout_url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetLabel = target_type === "club" ? "Clube" : "Organizador";
    const name = to_name || "Cliente";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 16px; overflow: hidden; border: 1px solid #2a2a2a;">
          <tr>
            <td style="background: linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Padel One</h1>
              <p style="margin: 8px 0 0; color: #ffcdd2; font-size: 14px;">Plataforma de Gestão de Padel</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #f5f5f5; font-size: 22px; font-weight: 600;">Olá ${name}!</h2>

              <p style="margin: 0 0 16px; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                A sua subscrição Padel One está pronta para ser ativada.
              </p>

              <div style="background-color: #111111; border-radius: 12px; padding: 20px; margin: 0 0 24px; border: 1px solid #2a2a2a;">
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Tipo:</td>
                    <td style="padding: 8px 0; color: #f5f5f5; font-size: 14px; font-weight: 600; text-align: right;">${targetLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Plano:</td>
                    <td style="padding: 8px 0; color: #f5f5f5; font-size: 14px; font-weight: 600; text-align: right;">${plan_name || "Standard"}</td>
                  </tr>
                </table>
              </div>

              <table role="presentation" style="width: 100%; margin: 0 0 30px;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${checkout_url}" style="display: inline-block; background-color: #D32F2F; color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-weight: 600; font-size: 16px;">Efetuar Pagamento</a>
                  </td>
                </tr>
              </table>

              <div style="background-color: #111111; border-radius: 8px; padding: 16px; margin: 0 0 24px; border: 1px solid #2a2a2a;">
                <p style="margin: 0 0 8px; color: #666; font-size: 12px;">Ou copie e cole este link no seu navegador:</p>
                <p style="margin: 0; color: #60a5fa; font-size: 13px; word-break: break-all; font-family: monospace;">${checkout_url}</p>
              </div>

              <div style="background-color: #1a1a0a; border-left: 3px solid #f59e0b; padding: 16px; border-radius: 4px; margin: 0 0 24px;">
                <p style="margin: 0; color: #fbbf24; font-size: 13px; line-height: 1.6;">
                  <strong>Após o pagamento</strong>, receberá um email com a sua chave de licença. Introduza essa chave na aplicação para ativar a sua subscrição.
                </p>
              </div>

              <p style="margin: 0; color: #666; font-size: 13px; line-height: 1.6;">
                Se não solicitou este email, pode ignorá-lo em segurança.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #111111; padding: 24px 30px; text-align: center; border-top: 1px solid #2a2a2a;">
              <p style="margin: 0; color: #555; font-size: 12px;">Padel One &copy; ${new Date().getFullYear()} &mdash; Todos os direitos reservados</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Padel One <noreply@boostpadel.store>",
        to: [to_email],
        subject: `Padel One — Link de Pagamento (${plan_name || "Subscrição"})`,
        html: emailHtml,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("[send-checkout-email] Resend error:", resendData);
      return new Response(
        JSON.stringify({ error: resendData.message || "Failed to send email", details: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-checkout-email] Email sent to", to_email, "Resend ID:", resendData.id);

    return new Response(
      JSON.stringify({ ok: true, emailId: resendData.id, sentTo: to_email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-checkout-email] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
