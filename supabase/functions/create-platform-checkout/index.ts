import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      target_type,
      plan_name,
      duration_months,
      target_entity_id,
      custom_price,
      payer_email,
      success_url,
      cancel_url,
      billing_interval, // "month" | "year"
    } = await req.json();

    if (!target_type || !plan_name) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isMonthly = billing_interval === "month";
    const effectiveDuration = isMonthly ? 1 : (duration_months || 12);

    const { data: config } = await supabaseClient
      .from("platform_stripe_config")
      .select("stripe_secret_key")
      .limit(1)
      .maybeSingle();

    if (!config?.stripe_secret_key) {
      return new Response(
        JSON.stringify({ ok: false, error: "Stripe credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let amount = custom_price;
    if (!amount) {
      const { data: plan } = await supabaseClient
        .from("platform_plans")
        .select("price_monthly, price_annual")
        .eq("name", plan_name)
        .eq("target_type", target_type)
        .eq("is_active", true)
        .maybeSingle();

      if (plan) {
        if (isMonthly) {
          amount = plan.price_monthly ?? (plan.price_annual ? Math.round(plan.price_annual / 12) : null);
        } else {
          amount = plan.price_annual ?? (plan.price_monthly ? plan.price_monthly * 12 : null);
        }
      }
    }

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "Could not determine price" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(config.stripe_secret_key, { apiVersion: "2023-10-16" });
    const targetLabel = target_type === "club" ? "Clube" : "Organizador";

    const metadata: Record<string, string> = {
      platform_payment: "true",
      target_type,
      plan_name,
      duration_months: String(effectiveDuration),
      target_entity_id: target_entity_id || "",
      billing_interval: isMonthly ? "month" : "year",
    };

    let session: Stripe.Checkout.Session;

    if (isMonthly) {
      // Recurring subscription
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        customer_email: payer_email || undefined,
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: `Padel One - ${plan_name} (${targetLabel})`,
                description: "Subscrição mensal",
              },
              unit_amount: Math.round(amount * 100),
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        subscription_data: { metadata },
        metadata,
        success_url: success_url || `${Deno.env.get("SUPABASE_URL") || ""}/?payment=success`,
        cancel_url: cancel_url || `${Deno.env.get("SUPABASE_URL") || ""}/?payment=cancelled`,
      });
    } else {
      // One-time annual payment
      const durationLabel = effectiveDuration === 12 ? "anual" : `${effectiveDuration} meses`;
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: payer_email || undefined,
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: `Padel One - ${plan_name} (${targetLabel})`,
                description: `Licença ${durationLabel}`,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        metadata,
        success_url: success_url || `${Deno.env.get("SUPABASE_URL") || ""}/?payment=success`,
        cancel_url: cancel_url || `${Deno.env.get("SUPABASE_URL") || ""}/?payment=cancelled`,
      });
    }

    console.log(`[create-checkout] Created ${isMonthly ? "subscription" : "payment"} session for ${targetLabel} (${plan_name}, ${amount}€)`);

    return new Response(
      JSON.stringify({ ok: true, url: session.url, session_id: session.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("create-platform-checkout error:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
