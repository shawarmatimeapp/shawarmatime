import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

initializeApp();

const MOLLIE_API = "https://api.mollie.com/v2";
const REGION = "europe-west1";
const MOLLIE_API_KEY = defineSecret("MOLLIE_API_KEY");
const ALLOWED_ORIGINS = new Set([
  "https://must66.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);

export const mollieConfigStatus = onRequest({ region: REGION, secrets: [MOLLIE_API_KEY] }, async (req, res) => {
  withCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
  const key = mollieKey();
  return sendJson(res, 200, {
    provider: "mollie",
    secretName: "MOLLIE_API_KEY",
    configured: Boolean(key),
    mode: key ? (key.startsWith("test_") ? "test" : "live") : "not-configured"
  });
});

export const createMolliePayment = onRequest({ region: REGION, secrets: [MOLLIE_API_KEY] }, async (req, res) => {
  withCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  const apiKey = mollieKey();
  if (!apiKey) {
    return sendJson(res, 503, {
      error: "Online payment is not configured yet.",
      missingSecret: "MOLLIE_API_KEY"
    });
  }

  try {
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const order = normalizeOrder(payload.order || {});
    const redirectUrl = safeUrl(payload.redirectUrl);
    const cancelUrl = safeUrl(payload.cancelUrl);
    const db = getFirestore();
    const checkoutRef = db.collection("mollieCheckouts").doc();
    const orderNumber = formatOrderNumber(checkoutRef.id);

    await checkoutRef.set({
      order,
      orderNumber,
      provider: "mollie",
      paymentStatus: "pending",
      status: "pending",
      source: "firebase-functions",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    const payment = await mollieRequest(apiKey, "POST", "/payments", {
      description: `Shawarma Time order ${orderNumber}`,
      amount: {
        currency: "EUR",
        value: order.subtotal.toFixed(2)
      },
      redirectUrl,
      cancelUrl,
      webhookUrl: functionsUrl("mollieWebhook"),
      locale: "nl_NL",
      metadata: {
        checkoutId: checkoutRef.id,
        orderNumber,
        source: "shawarma-time"
      }
    });

    await checkoutRef.set({
      molliePaymentId: payment.id,
      checkoutUrl: payment._links?.checkout?.href || "",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return sendJson(res, 200, {
      url: payment._links?.checkout?.href,
      checkoutId: checkoutRef.id,
      paymentId: payment.id,
      orderNumber
    });
  } catch (error) {
    console.error("createMolliePayment failed", error);
    return sendJson(res, 500, { error: "Could not create Mollie payment." });
  }
});

export const mollieWebhook = onRequest({ region: REGION, secrets: [MOLLIE_API_KEY] }, async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  const apiKey = mollieKey();
  if (!apiKey) return sendJson(res, 503, { error: "Mollie webhook is not configured." });

  try {
    const paymentId = webhookPaymentId(req);
    if (!paymentId) return sendJson(res, 400, { error: "Missing Mollie payment id." });
    const payment = await mollieRequest(apiKey, "GET", `/payments/${encodeURIComponent(paymentId)}`);
    const checkoutRef = await checkoutRefForPayment(payment);
    if (!checkoutRef) return sendJson(res, 200, { ok: true, ignored: "checkout-not-found" });

    await getFirestore().runTransaction(async (transaction) => {
      const checkoutSnap = await transaction.get(checkoutRef);
      if (!checkoutSnap.exists) return;
      const checkout = checkoutSnap.data();
      const checkoutUpdate = {
        molliePaymentId: payment.id,
        mollieStatus: payment.status,
        updatedAt: FieldValue.serverTimestamp()
      };

      if (payment.status === "paid") {
        if (checkout.orderId) {
          transaction.set(checkoutRef, {
            ...checkoutUpdate,
            status: "completed",
            paymentStatus: "paid",
            completedAt: FieldValue.serverTimestamp()
          }, { merge: true });
          return;
        }
        const orderRef = getFirestore().collection("orders").doc();
        const order = paidOrderFromCheckout(checkout, payment, checkoutRef.id);
        transaction.set(orderRef, order);
        transaction.set(checkoutRef, {
          ...checkoutUpdate,
          status: "completed",
          paymentStatus: "paid",
          orderId: orderRef.id,
          completedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        return;
      }

      if (["canceled", "expired", "failed"].includes(payment.status)) {
        transaction.set(checkoutRef, {
          ...checkoutUpdate,
          status: payment.status,
          paymentStatus: payment.status
        }, { merge: true });
        return;
      }

      transaction.set(checkoutRef, {
        ...checkoutUpdate,
        status: payment.status,
        paymentStatus: "pending"
      }, { merge: true });
    });

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("mollieWebhook failed", error);
    return sendJson(res, 500, { error: "Could not process Mollie webhook." });
  }
});

function withCors(req, res) {
  const origin = req.get("origin") || "";
  if (ALLOWED_ORIGINS.has(origin)) {
    res.set("access-control-allow-origin", origin);
  }
  res.set("vary", "Origin");
  res.set("access-control-allow-methods", "GET,POST,OPTIONS");
  res.set("access-control-allow-headers", "content-type");
}

function mollieKey() {
  try {
    return MOLLIE_API_KEY.value();
  } catch {
    return "";
  }
}

async function mollieRequest(apiKey, method, path, body) {
  const response = await fetch(`${MOLLIE_API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.title || `Mollie API error ${response.status}`);
  }
  return payload;
}

function normalizeOrder(order) {
  const items = Array.isArray(order.items) ? order.items.slice(0, 60).map((item) => ({
    id: String(item.id || "").slice(0, 120),
    name: String(item.name || "Shawarma Time item").slice(0, 180),
    price: String(item.price || "").slice(0, 40),
    priceValue: money(item.priceValue),
    quantity: Math.max(1, Math.min(99, Number(item.quantity || 1))),
    image: String(item.image || "").slice(0, 1000),
    options: Array.isArray(item.options) ? item.options.slice(0, 12).map((option) => String(option).slice(0, 60)) : []
  })) : [];
  if (!items.length) throw new Error("Order is missing items.");

  const customer = {
    name: String(order.customer?.name || "").trim().slice(0, 120),
    phone: String(order.customer?.phone || "").trim().slice(0, 80),
    email: String(order.customer?.email || "").trim().slice(0, 160),
    address: String(order.customer?.address || "").trim().slice(0, 240),
    fulfillment: ["pickup", "delivery"].includes(order.customer?.fulfillment) ? order.customer.fulfillment : "pickup",
    preferredTime: String(order.customer?.preferredTime || "").trim().slice(0, 40),
    notes: String(order.customer?.notes || "").trim().slice(0, 600)
  };
  if (!customer.name || !customer.phone) throw new Error("Customer name and phone are required.");

  const subtotal = money(order.subtotal || items.reduce((sum, item) => sum + item.priceValue * item.quantity, 0));
  if (!Number.isFinite(subtotal) || subtotal <= 0) throw new Error("Order total is invalid.");
  return {
    customer,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    currency: "EUR",
    paymentMethod: "mollie",
    paymentStatus: "pending",
    status: "pending",
    orderStatus: "pending",
    source: "mollie-checkout"
  };
}

function paidOrderFromCheckout(checkout, payment, checkoutId) {
  return {
    ...checkout.order,
    orderNumber: checkout.orderNumber || payment.metadata?.orderNumber || formatOrderNumber(checkoutId),
    paymentMethod: "mollie",
    paymentStatus: "paid",
    status: "new",
    orderStatus: "new",
    source: "mollie-checkout",
    checkoutId,
    molliePaymentId: payment.id,
    paidAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function checkoutRefForPayment(payment) {
  const db = getFirestore();
  const checkoutId = payment.metadata?.checkoutId;
  if (checkoutId) return db.collection("mollieCheckouts").doc(checkoutId);
  const snap = await db.collection("mollieCheckouts").where("molliePaymentId", "==", payment.id).limit(1).get();
  return snap.empty ? null : snap.docs[0].ref;
}

function webhookPaymentId(req) {
  if (typeof req.body === "string") return new URLSearchParams(req.body).get("id");
  if (req.body && typeof req.body === "object") return req.body.id || "";
  return "";
}

function safeUrl(value) {
  const url = new URL(String(value || ""));
  if (!ALLOWED_ORIGINS.has(url.origin)) throw new Error("Redirect origin is not allowed.");
  return url.toString();
}

function functionsUrl(functionName) {
  const config = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : {};
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || config.projectId;
  return `https://${REGION}-${projectId}.cloudfunctions.net/${functionName}`;
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function formatOrderNumber(value) {
  return `ST-${String(value || Date.now()).replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase()}`;
}

function sendJson(res, status, body) {
  return res.status(status).json(body);
}
