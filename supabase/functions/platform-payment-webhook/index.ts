import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

async function sendLicenseEmail(resendApiKey: string, payerEmail: string, payerName: string, licenseKey: string, targetType: string, planName: string, durationMonths: number, amount: number) {
  const targetLabel = targetType === "club" ? "Clube" : "Organizador";
  const keyEmailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#0a0a0a;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:40px 20px;">
      <table role="presentation" style="max-width:600px;margin:0 auto;background-color:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
        <tr><td style="background:linear-gradient(135deg,#D32F2F 0%,#B71C1C 100%);padding:40px 30px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">Padel One</h1>
          <p style="margin:8px 0 0;color:#ffcdd2;font-size:14px;">Pagamento Confirmado</p>
        </td></tr>
        <tr><td style="padding:40px 30px;">
          <h2 style="margin:0 0 20px;color:#f5f5f5;font-size:22px;">Olá ${payerName}!</h2>
          <p style="margin:0 0 16px;color:#a0a0a0;font-size:16px;line-height:1.6;">O seu pagamento foi processado com sucesso. Abaixo encontra a sua chave de licença para ativar a subscrição.</p>
          <div style="background:#111;border:2px solid #D32F2F;border-radius:12px;padding:24px;margin:0 0 24px;text-align:center;">
            <p style="margin:0 0 8px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Chave de Licença</p>
            <p style="margin:0;color:#fff;font-size:28px;font-weight:700;font-family:monospace;letter-spacing:2px;">${licenseKey}</p>
          </div>
          <div style="background:#111;border-radius:12px;padding:20px;margin:0 0 24px;border:1px solid #2a2a2a;">
            <table role="presentation" style="width:100%;">
              <tr><td style="padding:8px 0;color:#666;font-size:14px;">Tipo:</td><td style="padding:8px 0;color:#f5f5f5;font-size:14px;font-weight:600;text-align:right;">${targetLabel}</td></tr>
              <tr><td style="padding:8px 0;color:#666;font-size:14px;">Plano:</td><td style="padding:8px 0;color:#f5f5f5;font-size:14px;font-weight:600;text-align:right;">${planName || "Standard"}</td></tr>
              <tr><td style="padding:8px 0;color:#666;font-size:14px;">Duração:</td><td style="padding:8px 0;color:#f5f5f5;font-size:14px;font-weight:600;text-align:right;">${durationMonths === 1 ? "Mensal (recorrente)" : durationMonths + " meses"}</td></tr>
              <tr><td style="padding:8px 0;color:#666;font-size:14px;">Valor:</td><td style="padding:8px 0;color:#f5f5f5;font-size:14px;font-weight:600;text-align:right;">${amount.toFixed(2)}€</td></tr>
            </table>
          </div>
          <div style="background:#0a1a0a;border-left:3px solid #22c55e;padding:16px;border-radius:4px;margin:0 0 24px;">
            <p style="margin:0;color:#86efac;font-size:13px;line-height:1.6;"><strong>Como ativar:</strong> Abra a aplicação Padel One, faça login e introduza esta chave no ecrã de ativação. A sua subscrição será ativada automaticamente.</p>
          </div>
        </td></tr>
        <tr><td style="background:#111;padding:24px 30px;text-align:center;border-top:1px solid #2a2a2a;">
          <p style="margin:0;color:#555;font-size:12px;">Padel One &copy; ${new Date().getFullYear()}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const emailResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendApiKey}` },
      body: JSON.stringify({
        from: "Padel One <noreply@boostpadel.store>",
        to: [payerEmail],
        subject: `Padel One — A sua Chave de Licença (${planName || "Subscrição"})`,
        html: keyEmailHtml,
      }),
    });
    const emailData = await emailResp.json();
    console.log(`[platform-webhook] License key email sent to ${payerEmail}:`, emailData.id || emailData);
  } catch (emailErr) {
    console.error("[platform-webhook] Failed to send license key email:", emailErr);
  }
}

function generateLicenseKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `PADEL-${seg()}-${seg()}-${seg()}`;
}

async function updateEntitySubscription(
  supabaseClient: ReturnType<typeof createClient>,
  targetType: string,
  targetEntityId: string,
  updates: Record<string, unknown>
) {
  const table = targetType === "club" ? "clubs" : "organizers";
  await supabaseClient.from(table).update(updates).eq("id", targetEntityId);
}

async function findTargetUser(
  supabaseClient: ReturnType<typeof createClient>,
  targetType: string,
  targetEntityId: string
): Promise<string | null> {
  if (targetType === "club") {
    const { data } = await supabaseClient.from("clubs").select("owner_id").eq("id", targetEntityId).maybeSingle();
    return data?.owner_id || null;
  } else if (targetType === "organizer") {
    const { data } = await supabaseClient.from("organizers").select("user_id").eq("id", targetEntityId).maybeSingle();
    return data?.user_id || null;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: config } = await supabaseClient
      .from("platform_stripe_config")
      .select("stripe_secret_key, webhook_secret")
      .limit(1)
      .maybeSingle();

    if (!config?.stripe_secret_key) {
      return new Response("Stripe not configured", { status: 500 });
    }

    const stripe = new Stripe(config.stripe_secret_key, { apiVersion: "2023-10-16" });
    const body = await req.text();

    let event: Stripe.Event;

    if (config.webhook_secret) {
      const sig = req.headers.get("stripe-signature");
      if (!sig) return new Response("Missing signature", { status: 400 });
      event = stripe.webhooks.constructEvent(body, sig, config.webhook_secret);
    } else {
      event = JSON.parse(body);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // ─── checkout.session.completed ───
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};

      if (meta.platform_payment !== "true") {
        return new Response(JSON.stringify({ received: true, skip: "not platform" }), { status: 200 });
      }

      const targetType = meta.target_type;
      const planName = meta.plan_name;
      const durationMonths = parseInt(meta.duration_months || "12");
      const targetEntityId = meta.target_entity_id || null;
      const billingInterval = meta.billing_interval || "year";
      const isMonthly = billingInterval === "month";

      const licenseKey = generateLicenseKey();
      const targetUserId = targetEntityId ? await findTargetUser(supabaseClient, targetType, targetEntityId) : null;

      const { data: keyData } = await supabaseClient.from("license_keys").insert({
        license_key: licenseKey,
        target_type: targetType,
        plan_name: planName,
        duration_months: durationMonths,
        target_user_id: targetUserId,
        target_entity_id: targetEntityId,
        stripe_payment_id: (session.payment_intent as string) || session.subscription as string || session.id,
        status: "active",
      }).select("id").maybeSingle();

      const amount = (session.amount_total || 0) / 100;
      await supabaseClient.from("platform_payments").insert({
        license_key_id: keyData?.id || null,
        stripe_session_id: session.id,
        stripe_payment_intent: (session.payment_intent as string) || null,
        amount,
        currency: session.currency || "eur",
        target_type: targetType,
        target_entity_id: targetEntityId,
        payer_email: session.customer_email || session.customer_details?.email || null,
        payer_name: session.customer_details?.name || null,
        status: "completed",
      });

      // For monthly subscriptions: store Stripe IDs and activate directly
      if (isMonthly && targetEntityId) {
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        const subUpdates: Record<string, unknown> = {
          stripe_customer_id: session.customer as string || null,
          stripe_subscription_id: session.subscription as string || null,
          billing_interval: "month",
          contract_start: now.toISOString(),
        };

        if (targetType === "club") {
          Object.assign(subUpdates, {
            contract_expires_at: expiresAt.toISOString(),
            plan_type: planName.toLowerCase(),
            status: "active",
            is_active: true,
          });
        } else {
          Object.assign(subUpdates, {
            subscription_expires_at: expiresAt.toISOString(),
            subscription_status: "active",
            is_active: true,
            organizer_tier: planName.toLowerCase(),
          });
        }

        await updateEntitySubscription(supabaseClient, targetType, targetEntityId, subUpdates);

        if (targetType === "organizer" && targetUserId) {
          await supabaseClient.from("user_logo_settings").upsert(
            { user_id: targetUserId, is_paid_organizer: true, role: "organizer" },
            { onConflict: "user_id" }
          );
        }
      }

      console.log(`[platform-webhook] ${isMonthly ? "Subscription" : "Payment"} processed: ${licenseKey} for ${targetType} (${planName}, ${durationMonths}m)`);

      // Send license key email
      const payerEmail = session.customer_email || session.customer_details?.email;
      if (payerEmail && resendApiKey) {
        await sendLicenseEmail(resendApiKey, payerEmail, session.customer_details?.name || "Cliente", licenseKey, targetType, planName, durationMonths, amount);
      }

      return new Response(
        JSON.stringify({ received: true, license_key: licenseKey }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ─── invoice.paid (recurring subscription renewal) ───
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;

      // Skip the first invoice (already handled in checkout.session.completed)
      if (invoice.billing_reason === "subscription_create") {
        console.log("[platform-webhook] Skipping first invoice (handled in checkout)");
        return new Response(JSON.stringify({ received: true, skip: "first_invoice" }), { status: 200 });
      }

      const subscriptionId = invoice.subscription as string;
      if (!subscriptionId) {
        return new Response(JSON.stringify({ received: true, skip: "no subscription" }), { status: 200 });
      }

      // Get subscription metadata
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const meta = subscription.metadata || {};

      if (meta.platform_payment !== "true") {
        return new Response(JSON.stringify({ received: true, skip: "not platform" }), { status: 200 });
      }

      const targetType = meta.target_type;
      const targetEntityId = meta.target_entity_id || null;

      if (!targetEntityId) {
        return new Response(JSON.stringify({ received: true, skip: "no entity" }), { status: 200 });
      }

      // Extend contract by 1 month
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const expiresField = targetType === "club" ? "contract_expires_at" : "subscription_expires_at";
      await updateEntitySubscription(supabaseClient, targetType, targetEntityId, {
        [expiresField]: expiresAt.toISOString(),
      });

      // Record payment
      const amount = (invoice.amount_paid || 0) / 100;
      await supabaseClient.from("platform_payments").insert({
        stripe_session_id: invoice.id,
        stripe_payment_intent: invoice.payment_intent as string || null,
        amount,
        currency: invoice.currency || "eur",
        target_type: targetType,
        target_entity_id: targetEntityId,
        payer_email: invoice.customer_email || null,
        payer_name: invoice.customer_name || null,
        status: "completed",
      });

      console.log(`[platform-webhook] Subscription renewed for ${targetType} ${targetEntityId}, expires: ${expiresAt.toISOString()}`);

      return new Response(
        JSON.stringify({ received: true, renewed: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ─── customer.subscription.deleted (cancelled) ───
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const meta = subscription.metadata || {};

      if (meta.platform_payment !== "true") {
        return new Response(JSON.stringify({ received: true, skip: "not platform" }), { status: 200 });
      }

      const targetType = meta.target_type;
      const targetEntityId = meta.target_entity_id || null;

      if (targetEntityId) {
        await updateEntitySubscription(supabaseClient, targetType, targetEntityId, {
          stripe_subscription_id: null,
          billing_interval: null,
        });

        console.log(`[platform-webhook] Subscription cancelled for ${targetType} ${targetEntityId} — will expire naturally`);
      }

      return new Response(
        JSON.stringify({ received: true, cancelled: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // All other events
    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("platform-payment-webhook error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
