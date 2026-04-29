declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

export interface RazorpayCheckoutSuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutFailure {
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  };
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
    confirm_close?: boolean;
    escape?: boolean;
  };
  handler?: (response: RazorpayCheckoutSuccess) => void;
}

interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: "payment.failed", callback: (payload: RazorpayCheckoutFailure) => void) => void;
}

export interface CreateRazorpayOrderResponse {
  orderId: string;
}

const CHECKOUT_SCRIPT_ID = "razorpay-checkout-script";
const CHECKOUT_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

export const razorpayKeyId = (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined)?.trim() || "";
export const razorpayOrderEndpoint =
  (import.meta.env.VITE_RAZORPAY_ORDER_ENDPOINT as string | undefined)?.trim() || "";

export const loadRazorpayCheckout = async () => {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;

  const existing = document.getElementById(CHECKOUT_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise<boolean>((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      window.setTimeout(() => resolve(Boolean(window.Razorpay)), 5000);
    });
  }

  return new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.id = CHECKOUT_SCRIPT_ID;
    script.src = CHECKOUT_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const createRazorpayOrder = async (input: {
  amountInPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}) => {
  if (!razorpayOrderEndpoint) {
    throw new Error("Razorpay order endpoint is not configured.");
  }

  const response = await fetch(razorpayOrderEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: input.amountInPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to create Razorpay order.");
  }

  const data = (await response.json()) as
    | { id?: string; orderId?: string; order_id?: string }
    | null;
  const orderId = data?.orderId || data?.order_id || data?.id;
  if (!orderId) throw new Error("Razorpay order id missing from server response.");
  return { orderId } as CreateRazorpayOrderResponse;
};

export const openRazorpayCheckout = (input: {
  orderId: string;
  amountInPaise: number;
  name: string;
  description: string;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  onSuccess: (response: RazorpayCheckoutSuccess) => void;
  onFailure?: (message: string) => void;
  onDismiss?: () => void;
}) => {
  if (!window.Razorpay || !razorpayKeyId) return false;

  const instance = new window.Razorpay({
    key: razorpayKeyId,
    amount: input.amountInPaise,
    currency: "INR",
    order_id: input.orderId,
    name: input.name,
    description: input.description,
    image: input.image,
    prefill: input.prefill,
    notes: input.notes,
    theme: { color: "#6b1f3d" },
    modal: {
      confirm_close: true,
      ondismiss: input.onDismiss,
    },
    handler: input.onSuccess,
  });

  instance.on("payment.failed", (payload) => {
    const message = payload.error?.description || payload.error?.reason || "Online payment failed.";
    if (input.onFailure) input.onFailure(message);
  });

  instance.open();
  return true;
};

