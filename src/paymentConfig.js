const hostname = typeof window === "undefined" ? "" : window.location.hostname;
const runtimeConfig = typeof window === "undefined" ? {} : window.SHAWARMA_TIME_CONFIG || {};
const defaultFirebaseFunctionsUrl = "https://europe-west1-shawarma-time-ca124.cloudfunctions.net";
const functionsBaseUrl = String(runtimeConfig.functionsBaseUrl || defaultFirebaseFunctionsUrl).replace(/\/$/, "");
const functionsAvailable = Boolean(functionsBaseUrl) || !hostname.endsWith("github.io");
const functionPath = (path) => {
  if (functionsBaseUrl) return `${functionsBaseUrl}${path}`;
  return functionsAvailable ? path : "";
};

export const paymentConfig = {
  onlinePaymentsEnabled: runtimeConfig.onlinePaymentsEnabled !== false,
  molliePaymentEndpoint: functionPath("/createMolliePayment"),
  mollieConfigStatusEndpoint: functionPath("/mollieConfigStatus")
};
