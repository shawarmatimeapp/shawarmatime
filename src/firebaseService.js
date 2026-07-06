import { defaultSiteData, loadSiteData, normalizeSiteDataCategories } from "./data.js";
import { firebaseConfig, firebaseEnabled } from "./firebaseConfig.js";
import { cloudinaryConfig, cloudinaryEnabled } from "./cloudinaryConfig.js";

const APP_URL = "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
const AUTH_URL = "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
const FIRESTORE_URL = "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const CONTENT_COLLECTION = "siteContent";
const CONTENT_DOC = "shawarmaTime";
const ADMIN_COLLECTION = "admins";
const ORDERS_COLLECTION = "orders";
const DEFAULT_USERNAME = "admin";
const DEFAULT_EMAIL = "admin@shawarma-time.local";
const OWNER_EMAIL = "mustafa.chanel@hotmail.com";
const DEFAULT_PASSWORD = "00000000";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CONFIG_ERROR = "Firebase is not configured. Add the existing project config in src/firebaseConfig.js.";

let firebasePromise;

export function isFirebaseConfigured() {
  return firebaseEnabled;
}

export function usernameToEmail(username) {
  const value = String(username || "").trim().toLowerCase();
  if (value.includes("@")) return value;
  if (value === DEFAULT_USERNAME) return DEFAULT_EMAIL;
  return `${value}@shawarma-time.local`;
}

export async function getFirebase() {
  if (!firebaseEnabled) return null;
  if (!firebasePromise) {
    firebasePromise = (async () => {
      const [{ initializeApp }, authMod, firestoreMod] = await Promise.all([
        import(/* @vite-ignore */ APP_URL),
        import(/* @vite-ignore */ AUTH_URL),
        import(/* @vite-ignore */ FIRESTORE_URL)
      ]);
      const app = initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);
      await authMod.setPersistence(auth, authMod.browserLocalPersistence);
      return {
        app,
        auth,
        db: firestoreMod.getFirestore(app),
        authMod,
        firestoreMod
      };
    })();
  }
  return firebasePromise;
}

export async function signInAdmin(username, password) {
  const firebase = await getFirebase();
  if (!firebase) {
    throw new Error(CONFIG_ERROR);
  }

  const email = usernameToEmail(username);
  try {
    const credential = await firebase.authMod.signInWithEmailAndPassword(firebase.auth, email, password);
    await ensureAdminDoc(credential.user.uid, username, email);
    return credential.user;
  } catch (error) {
    if (canBootstrapAdmin(username, email, password, error.code)) {
      const credential = await firebase.authMod.createUserWithEmailAndPassword(firebase.auth, email, password);
      await ensureAdminDoc(credential.user.uid, username, email);
      await ensureInitialContent();
      return credential.user;
    }
    throw new Error(authErrorMessage(error));
  }
}

export async function signOutAdmin() {
  const firebase = await getFirebase();
  if (firebase) await firebase.authMod.signOut(firebase.auth);
}

export async function getAdminSession() {
  const firebase = await getFirebase();
  if (!firebase) return null;
  await firebase.auth.authStateReady?.();
  const user = firebase.auth.currentUser;
  if (!user) return null;
  const admin = await getAdminDoc(user.uid);
  if (!admin?.active) {
    await firebase.authMod.signOut(firebase.auth);
    return null;
  }
  return { user, admin };
}

export async function onAdminAuthChange(callback) {
  const firebase = await getFirebase();
  if (!firebase) return () => {};
  return firebase.authMod.onAuthStateChanged(firebase.auth, callback);
}

export async function loadFirebaseSiteData() {
  const firebase = await getFirebase();
  if (!firebase) return loadSiteData();
  const ref = contentRef(firebase);
  const snap = await firebase.firestoreMod.getDoc(ref);
  if (!snap.exists()) {
    return normalizeSiteDataCategories(defaultSiteData);
  }
  return mergeSiteData(defaultSiteData, snap.data().data || {});
}

export async function saveFirebaseSiteData(siteData) {
  const firebase = await getFirebase();
  if (!firebase) {
    throw new Error(CONFIG_ERROR);
  }
  await firebase.firestoreMod.setDoc(contentRef(firebase), {
    data: normalizeSiteDataCategories(siteData),
    updatedAt: firebase.firestoreMod.serverTimestamp()
  }, { merge: true });
}

export async function subscribeFirebaseSiteData(callback) {
  const firebase = await getFirebase();
  if (!firebase) return () => {};
  return firebase.firestoreMod.onSnapshot(contentRef(firebase), (snap) => {
    if (snap.exists()) callback(mergeSiteData(defaultSiteData, snap.data().data || {}));
  });
}

export async function uploadFirebaseImage(file, folder = "menu") {
  validateImage(file);
  if (!cloudinaryEnabled) {
    throw new Error("Cloudinary is not configured. Add cloudName and uploadPreset in src/cloudinaryConfig.js.");
  }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", cloudinaryConfig.uploadPreset);
  formData.append("folder", `${cloudinaryConfig.folder}/${folder}`);
  formData.append("tags", "shawarma-time,admin-upload");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
    method: "POST",
    body: formData
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || `Cloudinary upload failed with status ${response.status}.`);
  }
  return payload.secure_url;
}

export async function findFirebaseOrderByNumber(orderNumber) {
  const firebase = await getFirebase();
  if (!firebase) return null;
  const normalized = String(orderNumber || "").trim().toUpperCase();
  if (!normalized) return null;
  const queryRef = firebase.firestoreMod.query(
    firebase.firestoreMod.collection(firebase.db, ORDERS_COLLECTION),
    firebase.firestoreMod.where("orderNumber", "==", normalized),
    firebase.firestoreMod.limit(1)
  );
  const snap = await firebase.firestoreMod.getDocs(queryRef);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function createFirebaseOrder(orderPayload) {
  const firebase = await getFirebase();
  if (!firebase) throw new Error(CONFIG_ERROR);
  const orderNumber = formatOrderNumber();
  const order = {
    customer: sanitizeCustomer(orderPayload.customer),
    items: (orderPayload.items || []).map(sanitizeOrderItem),
    itemCount: (orderPayload.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0),
    subtotal: Number(Number(orderPayload.subtotal || 0).toFixed(2)),
    currency: "EUR",
    paymentMethod: "cash",
    paymentStatus: "pending",
    status: "new",
    orderStatus: "new",
    orderNumber,
    source: "web-checkout",
    createdAt: firebase.firestoreMod.serverTimestamp(),
    updatedAt: firebase.firestoreMod.serverTimestamp()
  };
  const docRef = await firebase.firestoreMod.addDoc(firebase.firestoreMod.collection(firebase.db, ORDERS_COLLECTION), order);
  return { id: docRef.id, ...order, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export const createFirebaseTestOrder = createFirebaseOrder;

export async function subscribeFirebaseOrderByNumber(orderNumber, callback, onError) {
  const firebase = await getFirebase();
  if (!firebase) return () => {};
  const normalized = String(orderNumber || "").trim().toUpperCase();
  if (!normalized) return () => {};
  const queryRef = firebase.firestoreMod.query(
    firebase.firestoreMod.collection(firebase.db, ORDERS_COLLECTION),
    firebase.firestoreMod.where("orderNumber", "==", normalized),
    firebase.firestoreMod.limit(1)
  );
  return firebase.firestoreMod.onSnapshot(
    queryRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback(null);
        return;
      }
      const doc = snapshot.docs[0];
      callback({ id: doc.id, ...doc.data() });
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function subscribeFirebaseOrders(callback, onError) {
  const firebase = await getFirebase();
  if (!firebase) return () => {};
  let initialized = false;
  const queryRef = firebase.firestoreMod.query(
    firebase.firestoreMod.collection(firebase.db, ORDERS_COLLECTION),
    firebase.firestoreMod.orderBy("createdAt", "desc"),
    firebase.firestoreMod.limit(80)
  );
  console.log("listener active");
  console.info("[OrderFlow] Admin listener connected", {
    collection: ORDERS_COLLECTION,
    query: "orderBy(createdAt, desc), limit(80)"
  });
  return firebase.firestoreMod.onSnapshot(
    queryRef,
    (snapshot) => {
      const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const addedOrders = [];
      console.log("snapshot size", snapshot.size);
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          console.log("added order", change.doc.id);
          addedOrders.push({ id: change.doc.id, ...change.doc.data() });
        }
      });
      console.info("[OrderFlow] Admin listener snapshot", {
        count: orders.length,
        added: addedOrders.length,
        initialized
      });
      callback(orders, {
        addedOrders,
        initialOrderIds: initialized ? [] : orders.map((order) => order.id),
        initialized
      });
      initialized = true;
    },
    (error) => {
      console.error("[OrderFlow] Admin listener failed", { message: error?.message || String(error) });
      if (onError) onError(error);
    }
  );
}

export async function updateFirebaseOrderStatus(orderId, status) {
  const firebase = await getFirebase();
  if (!firebase) {
    throw new Error(CONFIG_ERROR);
  }
  if (!["pending", "accepted", "preparing", "ready", "completed", "cancelled", "new", "confirmed", "out_for_delivery", "on_the_way", "delivered"].includes(status)) {
    throw new Error("Invalid order status.");
  }
  await firebase.firestoreMod.updateDoc(firebase.firestoreMod.doc(firebase.db, ORDERS_COLLECTION, orderId), {
    status: normalizeStatusForWrite(status),
    orderStatus: normalizeStatusForWrite(status),
    updatedAt: firebase.firestoreMod.serverTimestamp()
  });
}

async function ensureAdminDoc(uid, username, email) {
  const firebase = await getFirebase();
  const ref = firebase.firestoreMod.doc(firebase.db, ADMIN_COLLECTION, uid);
  const snap = await firebase.firestoreMod.getDoc(ref);
  if (snap.exists()) return;
  await firebase.firestoreMod.setDoc(ref, {
    username: adminUsername(username, email),
    email,
    role: "owner",
    active: true,
    createdAt: firebase.firestoreMod.serverTimestamp()
  });
}

function adminUsername(username, email) {
  const value = String(username || "").trim().toLowerCase();
  if (value && !value.includes("@")) return value;
  return String(email || "").split("@")[0].toLowerCase();
}

function canBootstrapAdmin(username, email, password, code) {
  if (code !== "auth/user-not-found") return false;
  if (String(username).trim().toLowerCase() === DEFAULT_USERNAME && password === DEFAULT_PASSWORD) return true;
  return email === OWNER_EMAIL && password === "00000000";
}

async function getAdminDoc(uid) {
  const firebase = await getFirebase();
  const snap = await firebase.firestoreMod.getDoc(firebase.firestoreMod.doc(firebase.db, ADMIN_COLLECTION, uid));
  return snap.exists() ? snap.data() : null;
}

async function ensureInitialContent() {
  const firebase = await getFirebase();
  const ref = contentRef(firebase);
  const snap = await firebase.firestoreMod.getDoc(ref);
  if (!snap.exists()) await saveFirebaseSiteData(defaultSiteData);
}

function contentRef(firebase) {
  return firebase.firestoreMod.doc(firebase.db, CONTENT_COLLECTION, CONTENT_DOC);
}

function validateImage(file) {
  if (!file) throw new Error("No image selected.");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("Only JPG, PNG and WEBP images are allowed.");
  if (file.size > MAX_IMAGE_SIZE) throw new Error("Image is too large. Maximum size is 5MB.");
}

function normalizeStatusForWrite(status) {
  const aliases = {
    new: "pending",
    confirmed: "accepted",
    out_for_delivery: "ready",
    on_the_way: "ready",
    delivered: "completed"
  };
  return aliases[status] || status;
}

function formatOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const random = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  return `ST-${stamp}${random}`;
}

function sanitizeCustomer(customer = {}) {
  return {
    name: String(customer.name || "").trim().slice(0, 120),
    phone: String(customer.phone || "").trim().slice(0, 80),
    email: String(customer.email || "").trim().slice(0, 160),
    address: String(customer.address || "").trim().slice(0, 240),
    fulfillment: ["pickup", "delivery"].includes(customer.fulfillment) ? customer.fulfillment : "pickup",
    preferredTime: String(customer.preferredTime || "").trim().slice(0, 40),
    notes: String(customer.notes || "").trim().slice(0, 600)
  };
}

function sanitizeOrderItem(item = {}) {
  return {
    id: String(item.id || "").slice(0, 120),
    name: String(item.name || "Shawarma Time item").slice(0, 180),
    price: String(item.price || "").slice(0, 40),
    priceValue: Number(item.priceValue || 0),
    quantity: Math.max(1, Math.min(99, Number(item.quantity || 1))),
    image: String(item.image || "").slice(0, 1000),
    options: Array.isArray(item.options) ? item.options.slice(0, 12).map((option) => String(option).slice(0, 60)) : [],
    notes: String(item.notes || "").trim().slice(0, 300),
    ingredients: String(item.ingredients || "").trim().slice(0, 500)
  };
}

function authErrorMessage(error) {
  const messages = {
    "auth/invalid-credential": "Username or password is incorrect.",
    "auth/wrong-password": "Username or password is incorrect.",
    "auth/user-not-found": "Admin user was not found.",
    "auth/operation-not-allowed": "Enable Email/Password sign-in in Firebase Authentication.",
    "auth/network-request-failed": "Could not reach Firebase. Check your connection and Firebase project config."
  };
  return messages[error?.code] || error?.message || "Login failed.";
}

function mergeSiteData(base, stored) {
  const merged = { ...structuredClone(base), ...stored };
  merged.settings = { ...base.settings, ...stored.settings };
  merged.design = { ...base.design, ...stored.design };
  merged.homepage = { ...base.homepage, ...stored.homepage };
  merged.sectionText = { ...base.sectionText, ...stored.sectionText };
  return normalizeSiteDataCategories(merged);
}
