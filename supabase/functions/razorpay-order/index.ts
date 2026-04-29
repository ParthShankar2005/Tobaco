const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });

const normalizeNotes = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!key) continue;
    result[key] = String(raw ?? "");
  }
  return result;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed. Use POST." });
  }

  const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim() || "";
  const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim() || "";
  if (!razorpayKeyId || !razorpayKeySecret) {
    return json(500, {
      error: "Razorpay server keys are not configured in function secrets.",
    });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "Invalid JSON payload." });
  }

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return json(400, { error: "amount must be a positive number in paise." });
  }

  const receipt = String(payload.receipt ?? "").trim();
  const currency = String(payload.currency ?? "INR").trim().toUpperCase() || "INR";
  const notes = normalizeNotes(payload.notes);

  const authorization = `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`;
  const upstream = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(amount),
      currency,
      receipt: receipt || `rcpt-${Date.now()}`,
      notes,
    }),
  });

  const text = await upstream.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { raw: text };
  }

  if (!upstream.ok) {
    return json(upstream.status, {
      error: "Unable to create Razorpay order.",
      details: data,
    });
  }

  const orderId = String(data.id ?? "");
  if (!orderId) {
    return json(500, { error: "Razorpay order id missing in API response.", details: data });
  }

  return json(200, {
    orderId,
    id: orderId,
  });
});
