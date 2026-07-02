# Mollie setup for Shawarma Time

This project is prepared for Mollie through Firebase Functions. The Mollie API key is never used in the frontend and must never be committed to GitHub.

## What is already in the code

- Frontend checkout keeps using the current cash/test Firestore flow while Mollie is not configured.
- Firebase Function `createMolliePayment` creates Mollie payments server-side.
- Firebase Function `mollieWebhook` receives Mollie payment updates.
- Firebase Function `mollieConfigStatus` tells the frontend whether Mollie is configured, without exposing the key.
- Mollie pending checkout data is stored in Firestore collection `mollieCheckouts`.
- A final document is created in Firestore collection `orders` only after Mollie reports `paid`.
- Admin dashboard continues to listen to `orders`, so paid Mollie orders appear like normal orders.

## Firebase Secret

The API key must be stored in Firebase Secret Manager with this exact name:

```txt
MOLLIE_API_KEY
```

Use the same secret name for both test and live keys. Switching from test to live is only replacing the secret value; no code change is needed.

## Add the Mollie test API key

Run this from the repo folder after Firebase CLI login:

```powershell
.\.codex-tools\firebase.exe functions:secrets:set MOLLIE_API_KEY
```

Paste the Mollie **Test API Key** from Mollie Dashboard when prompted.

Then deploy Functions:

```powershell
.\.codex-tools\firebase.exe deploy --only functions
```

The frontend checks:

```txt
https://europe-west1-shawarma-time-ca124.cloudfunctions.net/mollieConfigStatus
```

If the secret exists, online payment can become available. If the secret is missing, the site stays on cash/test checkout.

## Switch later to the Mollie live API key

When test payments work:

1. Open Mollie Dashboard.
2. Copy the **Live API Key**.
3. Run:

```powershell
.\.codex-tools\firebase.exe functions:secrets:set MOLLIE_API_KEY
```

4. Paste the live key.
5. Redeploy Functions:

```powershell
.\.codex-tools\firebase.exe deploy --only functions
```

No frontend code change is required.

## Webhook URL

Configure this webhook URL in Mollie if you need to enter it manually:

```txt
https://europe-west1-shawarma-time-ca124.cloudfunctions.net/mollieWebhook
```

The create-payment function also sends this webhook URL to Mollie automatically for each payment.

## Payment flow

1. Customer submits checkout.
2. Frontend calls `createMolliePayment`.
3. Function validates and stores a pending `mollieCheckouts` document.
4. Function creates a Mollie payment using `MOLLIE_API_KEY`.
5. Customer is redirected to Mollie Checkout.
6. Mollie calls `mollieWebhook`.
7. Webhook fetches payment status from Mollie.
8. If status is `paid`, webhook creates the final Firestore `orders` document with:
   - `paymentMethod: "mollie"`
   - `paymentStatus: "paid"`
   - `orderStatus: "new"`
   - `status: "new"`
9. Admin dashboard receives the new order through the existing Firestore realtime listener.

## Security notes

- `MOLLIE_API_KEY` is a Firebase Secret, not frontend config.
- Firestore clients cannot read or write `mollieCheckouts`.
- Public customers can only create validated cash/test orders directly.
- Mollie paid orders are created by Firebase Admin SDK inside Functions, bypassing client write rules.
- Admin users remain the only clients allowed to read/update `orders`.
