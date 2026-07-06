import { badgeOptions, defaultSiteData, loadSiteData, normalizeCategoryOrder, saveSiteData, ui } from "./data.js";
import {
  isFirebaseConfigured,
  loadFirebaseSiteData,
  saveFirebaseSiteData,
  getAdminSession,
  signOutAdmin,
  signInAdmin,
  subscribeFirebaseOrders,
  updateFirebaseOrderStatus,
  uploadFirebaseImage
} from "./firebaseService.js?v=20260706-restaurant-ready";

const $ = (selector) => document.querySelector(selector);
const langs = ["nl", "ar", "de", "en"];
const imageAccept = ".jpg,.jpeg,.png,.webp";
const adminLangKey = "shawarma-time-admin-lang";
const temporaryAdminCredentials = {
  username: "admin",
  password: "00000000"
};

let siteData = loadSiteData();
let adminLang = localStorage.getItem(adminLangKey) || "nl";
if (!["nl", "ar", "de"].includes(adminLang)) adminLang = "nl";
let currentSession;
let orders = [];
let unsubscribeOrders = null;
let ordersError = "";
let knownOrderIds = new Set();
let orderSearch = "";
let orderStatusFilter = "all";
let notificationPermissionRequested = false;
let orderAudioContext = null;
let orderAlertAudio = null;
let orderAlertAudioLoaded = false;
let orderAlertAudioError = "";
const readOrdersKey = "shawarma-time-read-orders";
const orderAlertSoundUrl = new URL("../admin-order-alert.wav?v=20260618-admin-listener-audit", import.meta.url).href;

const adminText = {
  nl: {
    brandAdmin: "Beheer",
    brandCms: "Firebase CMS",
    loginTitle: "Veilige admin login",
    username: "Gebruikersnaam",
    password: "Wachtwoord",
    login: "Inloggen",
    logout: "Uitloggen",
    navDashboard: "Dashboard",
    navOrders: "Bestellingen",
    navHome: "Home",
    navMenu: "Menu",
    navOffers: "Aanbiedingen",
    navReviews: "Reviews",
    navBanners: "Banners",
    navGallery: "Galerij",
    navContact: "Contact",
    navHours: "Openingstijden",
    navSettings: "Instellingen",
    navNotifications: "Meldingen",
    navCategories: "Categorieen",
    protectedDashboard: "Beveiligd dashboard",
    viewWebsite: "Website bekijken",
    dashboardTitle: "Dashboard",
    homeTitle: "Homepagina banners",
    ordersTitle: "Bestellingen",
    ordersNote: "Nieuwe bestellingen verschijnen hier automatisch.",
    ordersError: "Bestellingen konden niet worden geladen:",
    noOrders: "Nog geen bestellingen.",
    orderCustomer: "Klant",
    orderPhone: "Telefoon",
    orderNotes: "Opmerking",
    orderItems: "Items",
    orderTotal: "Totaal",
    orderStatus: "Status",
    paymentMethod: "Betaalmethode",
    paymentStatus: "Betaalstatus",
    paymentCash: "Contant",
    paymentRestaurant: "In restaurant",
    paymentStripe: "Stripe",
    paymentMollie: "Mollie",
    paymentPaid: "Betaald",
    paymentPending: "In afwachting",
    paymentUnpaid: "Niet betaald",
    orderNew: "Nieuw",
    orderPreparing: "In bereiding",
    orderCompleted: "Afgerond",
    menuTitle: "Menu-items",
    offersTitle: "Aanbiedingen",
    reviewsTitle: "Reviews",
    bannersTitle: "Banners",
    galleryTitle: "Galerij",
    contactTitle: "Restaurantinformatie",
    hoursTitle: "Openingstijden",
    settingsTitle: "Instellingen",
    notificationsTitle: "Meldingen",
    categoriesTitle: "Categorieen",
    notificationsNote: "Opslaan, verwijderen en uploaden tonen meldingen rechtsboven.",
    saveHome: "Home opslaan",
    saveContact: "Contact opslaan",
    saveSettings: "Instellingen opslaan",
    saveHours: "Openingstijden opslaan",
    addItem: "Item toevoegen",
    addOffer: "Aanbieding toevoegen",
    addBanner: "Banner toevoegen",
    addPhoto: "Foto toevoegen",
    addReview: "Review toevoegen",
    addCategory: "Categorie toevoegen",
    categorySlug: "Categorie code",
    role: "Rol",
    title: "Titel",
    slogan: "Slogan",
    intro: "Intro",
    about: "Over ons",
    heroImage: "Hero-afbeelding",
    phone: "Telefoon",
    address: "Adres",
    whatsappMessage: "WhatsApp-bericht",
    instagramUrl: "Instagram URL",
    tiktokUrl: "TikTok URL",
    facebookUrl: "Facebook URL",
    category: "Categorie",
    available: "Beschikbaar",
    badge: "Badge",
    none: "Geen",
    type: "Type",
    price: "Prijs",
    rating: "Beoordeling",
    name: "Naam",
    description: "Beschrijving",
    bannerText: "Bannertekst",
    uploadImage: "Afbeelding uploaden",
    uploadHint: "Sleep een afbeelding hierheen of tik om te kiezen. JPG, PNG, WEBP - max 5MB",
    save: "Opslaan",
    delete: "Verwijderen",
    saved: "Opgeslagen",
    saveFailed: "Opslaan mislukt",
    homepageSaved: "Homepagina opgeslagen",
    contactSaved: "Restaurantinformatie opgeslagen",
    hoursSaved: "Openingstijden opgeslagen",
    deleted: "Verwijderd",
    imageUploaded: "Afbeelding geupload",
    uploadFailed: "Upload mislukt",
    cloudinaryMissing: "Cloudinary is niet geconfigureerd. Voeg cloudName en uploadPreset toe in src/cloudinaryConfig.js.",
    loggedOut: "Uitgelogd.",
    loginFailed: "Inloggen mislukt.",
    firebaseMissing: "Firebase-configuratie ontbreekt. Voeg de bestaande Firebase projectconfiguratie toe voordat je inlogt."
  },
  ar: {
    brandAdmin: "الإدارة",
    brandCms: "نظام Firebase",
    loginTitle: "تسجيل دخول آمن للإدارة",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    login: "تسجيل الدخول",
    logout: "تسجيل الخروج",
    navDashboard: "لوحة التحكم",
    navOrders: "الطلبات",
    navHome: "الرئيسية",
    navMenu: "القائمة",
    navOffers: "العروض",
    navReviews: "التقييمات",
    navBanners: "البنرات",
    navGallery: "المعرض",
    navContact: "التواصل",
    navHours: "ساعات العمل",
    navSettings: "الإعدادات",
    navNotifications: "الإشعارات",
    navCategories: "التصنيفات",
    protectedDashboard: "لوحة إدارة محمية",
    viewWebsite: "عرض الموقع",
    dashboardTitle: "لوحة التحكم",
    homeTitle: "بنرات الصفحة الرئيسية",
    ordersTitle: "الطلبات",
    ordersNote: "الطلبات الجديدة تظهر هنا تلقائياً.",
    ordersError: "تعذر تحميل الطلبات:",
    noOrders: "لا توجد طلبات بعد.",
    orderCustomer: "الزبون",
    orderPhone: "الهاتف",
    orderNotes: "ملاحظة",
    orderItems: "الأصناف",
    orderTotal: "المجموع",
    orderStatus: "الحالة",
    paymentMethod: "طريقة الدفع",
    paymentStatus: "حالة الدفع",
    paymentCash: "نقداً",
    paymentRestaurant: "في المطعم",
    paymentStripe: "Stripe",
    paymentMollie: "Mollie",
    paymentPaid: "مدفوع",
    paymentPending: "قيد الانتظار",
    paymentUnpaid: "غير مدفوع",
    orderNew: "جديد",
    orderPreparing: "قيد التحضير",
    orderCompleted: "مكتمل",
    menuTitle: "عناصر القائمة",
    offersTitle: "العروض والخصومات",
    reviewsTitle: "التقييمات",
    bannersTitle: "البنرات",
    galleryTitle: "معرض الصور",
    contactTitle: "معلومات المطعم",
    hoursTitle: "ساعات العمل",
    settingsTitle: "الإعدادات",
    notificationsTitle: "الإشعارات",
    categoriesTitle: "التصنيفات",
    notificationsNote: "عمليات الحفظ والحذف ورفع الصور تعرض إشعارات في أعلى الصفحة.",
    saveHome: "حفظ الرئيسية",
    saveContact: "حفظ التواصل",
    saveSettings: "حفظ الإعدادات",
    saveHours: "حفظ ساعات العمل",
    addItem: "إضافة صنف",
    addOffer: "إضافة عرض",
    addBanner: "إضافة بنر",
    addPhoto: "إضافة صورة",
    addReview: "إضافة تقييم",
    addCategory: "إضافة تصنيف",
    categorySlug: "رمز التصنيف",
    role: "الدور",
    title: "العنوان",
    slogan: "الشعار",
    intro: "المقدمة",
    about: "من نحن",
    heroImage: "صورة الواجهة",
    phone: "الهاتف",
    address: "العنوان",
    whatsappMessage: "رسالة واتساب",
    instagramUrl: "رابط إنستغرام",
    tiktokUrl: "رابط تيك توك",
    facebookUrl: "رابط فيسبوك",
    category: "التصنيف",
    available: "متاح",
    badge: "الشارة",
    none: "بدون",
    type: "النوع",
    price: "السعر",
    rating: "التقييم",
    name: "الاسم",
    description: "الوصف",
    bannerText: "نص البنر",
    uploadImage: "رفع صورة",
    uploadHint: "اسحب الصورة هنا أو اضغط للاختيار. JPG و PNG و WEBP - الحد الأقصى 5MB",
    save: "حفظ",
    delete: "حذف",
    saved: "تم الحفظ",
    saveFailed: "فشل الحفظ",
    homepageSaved: "تم حفظ الصفحة الرئيسية",
    contactSaved: "تم حفظ معلومات المطعم",
    hoursSaved: "تم حفظ ساعات العمل",
    deleted: "تم الحذف",
    imageUploaded: "تم رفع الصورة",
    uploadFailed: "فشل رفع الصورة",
    cloudinaryMissing: "لم يتم إعداد Cloudinary. أضف cloudName و uploadPreset في src/cloudinaryConfig.js.",
    loggedOut: "تم تسجيل الخروج.",
    loginFailed: "فشل تسجيل الدخول.",
    firebaseMissing: "إعدادات Firebase غير موجودة. أضف إعدادات مشروع Firebase قبل تسجيل الدخول."
  },
  de: {
    brandAdmin: "Admin",
    brandCms: "Firebase CMS",
    loginTitle: "Sicherer Admin-Login",
    username: "Benutzername",
    password: "Passwort",
    login: "Einloggen",
    logout: "Ausloggen",
    navDashboard: "Dashboard",
    navOrders: "Bestellungen",
    navHome: "Start",
    navMenu: "Menü",
    navOffers: "Angebote",
    navReviews: "Bewertungen",
    navBanners: "Banner",
    navGallery: "Galerie",
    navContact: "Kontakt",
    navHours: "Öffnungszeiten",
    navSettings: "Einstellungen",
    navNotifications: "Benachrichtigungen",
    navCategories: "Kategorien",
    protectedDashboard: "Geschütztes Dashboard",
    viewWebsite: "Website ansehen",
    dashboardTitle: "Dashboard",
    homeTitle: "Homepage-Banner",
    ordersTitle: "Bestellungen",
    ordersNote: "Neue Bestellungen erscheinen hier automatisch.",
    ordersError: "Bestellungen konnten nicht geladen werden:",
    noOrders: "Noch keine Bestellungen.",
    orderCustomer: "Kunde",
    orderPhone: "Telefon",
    orderNotes: "Notiz",
    orderItems: "Artikel",
    orderTotal: "Summe",
    orderStatus: "Status",
    paymentMethod: "Zahlungsmethode",
    paymentStatus: "Zahlungsstatus",
    paymentCash: "Bar",
    paymentRestaurant: "Im Restaurant",
    paymentStripe: "Stripe",
    paymentMollie: "Mollie",
    paymentPaid: "Bezahlt",
    paymentPending: "Ausstehend",
    paymentUnpaid: "Nicht bezahlt",
    orderNew: "Neu",
    orderPreparing: "In Vorbereitung",
    orderCompleted: "Abgeschlossen",
    menuTitle: "Menüpunkte",
    offersTitle: "Angebote",
    reviewsTitle: "Bewertungen",
    bannersTitle: "Banner",
    galleryTitle: "Galerie",
    contactTitle: "Restaurantinformationen",
    hoursTitle: "Öffnungszeiten",
    settingsTitle: "Einstellungen",
    notificationsTitle: "Benachrichtigungen",
    categoriesTitle: "Kategorien",
    notificationsNote: "Speichern, Löschen und Uploads zeigen Benachrichtigungen oben rechts.",
    saveHome: "Startseite speichern",
    saveContact: "Kontakt speichern",
    saveSettings: "Einstellungen speichern",
    saveHours: "Öffnungszeiten speichern",
    addItem: "Eintrag hinzufügen",
    addOffer: "Angebot hinzufügen",
    addBanner: "Banner hinzufügen",
    addPhoto: "Foto hinzufügen",
    addReview: "Bewertung hinzufügen",
    addCategory: "Kategorie hinzufügen",
    categorySlug: "Kategorie-Code",
    role: "Rolle",
    title: "Titel",
    slogan: "Slogan",
    intro: "Intro",
    about: "Über uns",
    heroImage: "Hero-Bild",
    phone: "Telefon",
    address: "Adresse",
    whatsappMessage: "WhatsApp-Nachricht",
    instagramUrl: "Instagram-URL",
    tiktokUrl: "TikTok-URL",
    facebookUrl: "Facebook-URL",
    category: "Kategorie",
    available: "Verfuegbar",
    badge: "Badge",
    none: "Keine",
    type: "Typ",
    price: "Preis",
    rating: "Bewertung",
    name: "Name",
    description: "Beschreibung",
    bannerText: "Bannertext",
    uploadImage: "Bild hochladen",
    uploadHint: "Bild hier ablegen oder antippen, um auszuwählen. JPG, PNG, WEBP - max. 5MB",
    save: "Speichern",
    delete: "Löschen",
    saved: "Gespeichert",
    saveFailed: "Speichern fehlgeschlagen",
    homepageSaved: "Startseite gespeichert",
    contactSaved: "Restaurantinformationen gespeichert",
    hoursSaved: "Öffnungszeiten gespeichert",
    deleted: "Gelöscht",
    imageUploaded: "Bild hochgeladen",
    uploadFailed: "Upload fehlgeschlagen",
    cloudinaryMissing: "Cloudinary ist nicht konfiguriert. Füge cloudName und uploadPreset in src/cloudinaryConfig.js hinzu.",
    loggedOut: "Ausgeloggt.",
    loginFailed: "Login fehlgeschlagen.",
    firebaseMissing: "Firebase-Konfiguration fehlt. Füge die bestehende Firebase-Projektkonfiguration hinzu, bevor du dich einloggst."
  }
};

function tr(key) {
  return adminText[adminLang]?.[key] || adminText.nl[key] || key;
}

function applyAdminLanguage() {
  document.documentElement.lang = adminLang;
  document.documentElement.dir = adminLang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-admin-lang]").forEach((node) => {
    node.classList.toggle("active", node.dataset.adminLang === adminLang);
  });
  document.querySelectorAll("[data-admin-i18n]").forEach((node) => {
    node.textContent = tr(node.dataset.adminI18n);
  });
  renderRole();
}

function renderRole() {
  if (!currentSession || !$("#adminRole")) return;
  $("#adminRole").textContent = `${tr("role")}: ${currentSession?.admin?.role || currentSession?.role || "owner"}`;
}

function localizedError(error, fallbackKey) {
  const message = error?.message || "";
  if (message.includes("Firebase is not configured")) return tr("firebaseMissing");
  if (message.includes("Cloudinary is not configured")) return tr("cloudinaryMissing");
  if (message.includes("Temporary credentials")) return errorText("badLogin");
  if (message.includes("Username or password") || message.includes("incorrect")) return errorText("badLogin");
  if (message.includes("Admin user was not found")) return errorText("adminNotFound");
  if (message.includes("Enable Email/Password")) return errorText("emailPassword");
  if (message.includes("Could not reach Firebase")) return errorText("firebaseNetwork");
  if (message.includes("No image selected")) return errorText("noImage");
  if (message.includes("Only JPG")) return errorText("imageType");
  if (message.includes("too large")) return errorText("imageSize");
  return message || tr(fallbackKey);
}

function errorText(key) {
  const messages = {
    nl: {
      badLogin: "Gebruikersnaam of wachtwoord is onjuist.",
      adminNotFound: "Admin-gebruiker niet gevonden.",
      emailPassword: "Schakel e-mail/wachtwoord-login in bij Firebase Authentication.",
      firebaseNetwork: "Kan Firebase niet bereiken. Controleer de verbinding en instellingen.",
      noImage: "Geen afbeelding geselecteerd.",
      imageType: "Alleen JPG-, PNG- en WEBP-afbeeldingen zijn toegestaan.",
      imageSize: "Afbeelding is te groot. Maximaal 5MB."
    },
    ar: {
      badLogin: "اسم المستخدم أو كلمة المرور غير صحيحة.",
      adminNotFound: "لم يتم العثور على حساب الإدارة.",
      emailPassword: "فعّل تسجيل الدخول بالبريد وكلمة المرور في Firebase Authentication.",
      firebaseNetwork: "تعذر الاتصال بـ Firebase. تحقق من الاتصال والإعدادات.",
      noImage: "لم يتم اختيار صورة.",
      imageType: "يسمح فقط بصور JPG و PNG و WEBP.",
      imageSize: "الصورة كبيرة جدًا. الحد الأقصى 5MB."
    },
    de: {
      badLogin: "Benutzername oder Passwort ist falsch.",
      adminNotFound: "Admin-Benutzer wurde nicht gefunden.",
      emailPassword: "Aktiviere E-Mail/Passwort-Login in Firebase Authentication.",
      firebaseNetwork: "Firebase ist nicht erreichbar. Prüfe Verbindung und Einstellungen.",
      noImage: "Kein Bild ausgewählt.",
      imageType: "Nur JPG-, PNG- und WEBP-Bilder sind erlaubt.",
      imageSize: "Bild ist zu groß. Maximal 5MB."
    }
  };
  return messages[adminLang]?.[key] || messages.nl[key] || key;
}

function note(message) {
  $("#saveStatus").textContent = message;
  $("#adminToast").textContent = message;
  $("#adminToast").classList.add("visible");
  clearTimeout(note.timer);
  note.timer = setTimeout(() => {
    $("#saveStatus").textContent = "";
    $("#adminToast").classList.remove("visible");
  }, 2200);
}

function logNotificationDebug(message, details = {}) {
  console.info(`[AdminNotify] ${message}`, details);
  updateNotificationStatus();
}

function loading(active) {
  $("#adminLoader").classList.toggle("hidden", !active);
}

function showRestoringSession() {
  $("#loginView").classList.add("hidden");
  $("#dashboardView").classList.add("hidden");
  $("#loginNote").textContent = "";
}

function showLogin(message = "") {
  $("#loginView").classList.remove("hidden");
  $("#dashboardView").classList.add("hidden");
  $("#loginNote").textContent = message;
}

async function showDashboard(session) {
  currentSession = session;
  $("#loginView").classList.add("hidden");
  $("#dashboardView").classList.remove("hidden");
  setupOrderAlertAudio();
  unlockOrderSound();
  requestNotificationPermission();
  renderRole();
  siteData = await loadContent();
  renderAll();
  startOrdersFeed();
}

async function loadContent() {
  if (!isFirebaseConfigured()) return loadSiteData();
  return loadFirebaseSiteData();
}

async function saveContent(message = tr("saved")) {
  loading(true);
  try {
    await saveFirebaseSiteData(siteData);
    if (!isFirebaseConfigured()) saveSiteData(siteData);
    renderAll();
    note(message);
  } catch (error) {
    note(localizedError(error, "saveFailed"));
  } finally {
    loading(false);
  }
}

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  loading(true);
  try {
    const form = new FormData(event.currentTarget);
    // Replace with secure authentication before production.
    const username = String(form.get("username") || "").trim();
    const password = String(form.get("password") || "");
    if (username !== temporaryAdminCredentials.username || password !== temporaryAdminCredentials.password) {
      throw new Error("Temporary credentials are incorrect.");
    }
    requestNotificationPermission();
    const user = await signInAdmin(username, password);
    await showDashboard({
      user,
      admin: { username: "admin", role: "temporary-admin", active: true }
    });
  } catch (error) {
    showLogin(localizedError(error, "loginFailed"));
  } finally {
    loading(false);
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  if (unsubscribeOrders) unsubscribeOrders();
  unsubscribeOrders = null;
  orders = [];
  await signOutAdmin();
  currentSession = null;
  showLogin(tr("loggedOut"));
});

document.querySelectorAll(".admin-sidebar nav button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".admin-sidebar nav button, .admin-panel").forEach((node) => node.classList.remove("active"));
    button.classList.add("active");
    $(`#${button.dataset.panel}`).classList.add("active");
    if (button.dataset.panel === "ordersPanel") markOrdersRead();
  });
});

document.querySelectorAll("[data-admin-lang]").forEach((button) => {
  button.addEventListener("click", () => {
    adminLang = button.dataset.adminLang;
    localStorage.setItem(adminLangKey, adminLang);
    applyAdminLanguage();
    renderAll();
  });
});

document.querySelectorAll("[data-add]").forEach((button) => {
  button.addEventListener("click", () => {
    const collection = button.dataset.add;
    siteData[collection].unshift(blankItem(collection));
    renderAll();
  });
});

$("#orderSearch")?.addEventListener("input", (event) => {
  orderSearch = event.target.value;
  renderOrders();
});

$("#orderStatusFilter")?.addEventListener("change", (event) => {
  orderStatusFilter = event.target.value;
  renderOrders();
});

$("#saveHomeBtn").addEventListener("click", () => {
  collectFields($("#homeForm"), siteData.homepage);
  saveContent(tr("homepageSaved"));
});

$("#saveContactBtn").addEventListener("click", () => {
  collectFields($("#contactForm"), siteData.settings);
  saveContent(tr("contactSaved"));
});

$("#saveHoursBtn").addEventListener("click", () => {
  collectFields($("#hoursForm"), siteData.settings);
  saveContent(tr("hoursSaved"));
});

$("#addCategoryBtn")?.addEventListener("click", () => {
  siteData.categoryOrder = normalizeCategoryOrder();
  renderCategoriesAdmin();
});

$("#testNotificationBtn")?.addEventListener("click", async () => {
  const permission = await requestNotificationPermission(true);
  logNotificationDebug("Test notification requested", { permission });
  showOrderNotification({
    id: `test-${Date.now()}`,
    orderNumber: "TEST",
    customer: { name: "Test Customer" }
  }, true);
});

$("#testSoundBtn")?.addEventListener("click", async () => {
  logNotificationDebug("Test sound requested", {
    audioLoaded: orderAlertAudioLoaded,
    audioError: orderAlertAudioError
  });
  await playOrderSound(0, true);
});

async function bootAdmin() {
  showRestoringSession();
  loading(true);
  try {
    const session = await getAdminSession();
    if (session?.user) {
      await showDashboard(session);
      return;
    }
    showLogin("");
  } catch (error) {
    showLogin(localizedError(error, "loginFailed"));
  } finally {
    loading(false);
  }
}

function renderAll() {
  renderHome();
  renderOrders();
  renderCollection("menu", "menuEditor", { category: true, badge: true, price: true, desc: true, availability: true, folder: "menu" });
  renderCategoriesAdmin();
  renderContact();
  renderHours();
  setupUploads();
}

async function startOrdersFeed() {
  if (unsubscribeOrders || !isFirebaseConfigured()) return;
  console.info("[OrderFlow] Admin connecting realtime orders listener", { collection: "orders" });
  unsubscribeOrders = await subscribeFirebaseOrders((incomingOrders, changeInfo = {}) => {
    ordersError = "";
    const incomingIds = new Set(incomingOrders.map((order) => order.id));
    const isInitialSnapshot = !changeInfo.initialized;
    if (isInitialSnapshot) markOrdersRead(changeInfo.initialOrderIds || incomingOrders.map((order) => order.id), false);
    const freshOrders = isInitialSnapshot
      ? []
      : (changeInfo.addedOrders || []).filter((order) => !knownOrderIds.has(order.id));
    console.info("[OrderFlow] Added order changes detected", {
      initialized: changeInfo.initialized,
      addedCount: changeInfo.addedOrders?.length || 0,
      freshCount: freshOrders.length,
      addedOrders: (changeInfo.addedOrders || []).map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customer: order.customer?.name || ""
      }))
    });
    if (freshOrders.length) {
      console.info("[OrderFlow] New order received by admin", freshOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.orderStatus || order.status
      })));
      freshOrders.forEach((order, index) => {
        console.log("added order", order.id);
        playOrderSound(index * 0.45);
        showOrderNotification(order);
      });
      note(`${freshOrders.length} ${tr("ordersTitle")}`);
    }
    knownOrderIds = incomingIds;
    orders = incomingOrders;
    renderOrders();
  }, () => {
    console.error("[OrderFlow] Admin orders listener unavailable");
    ordersError = "unavailable";
    renderOrders();
  });
}

function renderOrders() {
  const root = $("#ordersList");
  if (!root) return;
  renderOrderStats();
  if (ordersError) {
    root.innerHTML = `<article class="admin-card"><p class="form-note">${tr("ordersError")}</p></article>`;
    return;
  }
  const visibleOrders = filteredOrders();
  if (!visibleOrders.length) {
    root.innerHTML = `<article class="admin-card"><p class="form-note">${tr("noOrders")}</p></article>`;
    updateOrdersBadge();
    return;
  }
  const readOrders = getReadOrders();
  root.innerHTML = visibleOrders.map((order) => `
    <article class="admin-card order-card ${readOrders.has(order.id) ? "" : "unread"}" data-order-id="${order.id}">
      <div class="order-card-head">
        <div>
          <strong>#${escapeHtml(order.orderNumber || order.id.slice(0, 8).toUpperCase())}</strong>
          <span>${formatOrderDate(order.createdAt)}</span>
        </div>
        <mark class="order-status ${escapeAttr(normalizeAdminStatus(order.orderStatus || order.status || "pending"))}">${statusLabel(order.orderStatus || order.status || "pending")}</mark>
      </div>
      <div class="order-meta">
        <p><span>${tr("orderCustomer")}</span><b>${escapeHtml(order.customer?.name || "")}</b></p>
        <p><span>${tr("orderPhone")}</span><b>${escapeHtml(order.customer?.phone || "")}</b></p>
        <p><span>Email</span><b>${escapeHtml(order.customer?.email || "-")}</b></p>
        <p><span>Fulfillment</span><b>${escapeHtml(order.customer?.fulfillment || "pickup")}</b></p>
        <p><span>${tr("orderTotal")}</span><b>${formatOrderTotal(order.subtotal)}</b></p>
        <p><span>${tr("paymentMethod")}</span><b>${paymentMethodLabel(order.paymentMethod)}</b></p>
        <p><span>${tr("paymentStatus")}</span><b>${paymentStatusLabel(order.paymentStatus)}</b></p>
      </div>
      <div class="order-items">
        <span>${tr("orderItems")}</span>
        ${order.items?.map((item) => `
          <p>
            ${Number(item.quantity || 1)}x ${escapeHtml(item.name || "")} <b>${escapeHtml(item.price || "")}</b>
            ${item.options?.length ? `<small>${item.options.map(escapeHtml).join(", ")}</small>` : ""}
            ${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ""}
          </p>
        `).join("") || ""}
      </div>
      ${order.customer?.notes ? `<p class="order-notes"><span>${tr("orderNotes")}</span>${escapeHtml(order.customer.notes)}</p>` : ""}
      <label class="order-status-field">
        <span>${tr("orderStatus")}</span>
        <select data-order-status="${order.id}">
          ${statusOption("pending", order.orderStatus || order.status)}
          ${statusOption("accepted", order.orderStatus || order.status)}
          ${statusOption("preparing", order.orderStatus || order.status)}
          ${statusOption("ready", order.orderStatus || order.status)}
          ${statusOption("completed", order.orderStatus || order.status)}
          ${statusOption("cancelled", order.orderStatus || order.status)}
        </select>
      </label>
      <div class="order-quick-actions">
        ${adminStatusFlow(order).map((status) => `<button class="status-chip ${escapeAttr(status)}" type="button" data-quick-status="${order.id}:${status}">${statusLabel(status)}</button>`).join("")}
      </div>
      <button class="btn ghost" type="button" data-print-order="${order.id}">Print kitchen ticket</button>
    </article>
  `).join("");
  root.querySelectorAll("[data-order-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      loading(true);
      try {
        await updateFirebaseOrderStatus(select.dataset.orderStatus, select.value);
        note(tr("saved"));
      } catch (error) {
        note(localizedError(error, "saveFailed"));
      } finally {
        loading(false);
      }
    });
  });
  root.querySelectorAll("[data-print-order]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = orders.find((entry) => entry.id === button.dataset.printOrder);
      if (order) printKitchenTicket(order);
    });
  });
  root.querySelectorAll("[data-quick-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      const [orderId, status] = button.dataset.quickStatus.split(":");
      loading(true);
      try {
        await updateFirebaseOrderStatus(orderId, status);
        note(tr("saved"));
      } catch (error) {
        note(localizedError(error, "saveFailed"));
      } finally {
        loading(false);
      }
    });
  });
  updateOrdersBadge();
}

function adminStatusFlow(order) {
  return ["accepted", "preparing", "ready", "completed"];
}

function filteredOrders() {
  const query = normalizeSearch(orderSearch);
  return orders.filter((order) => {
    const status = normalizeAdminStatus(order.orderStatus || order.status || "pending");
    if (orderStatusFilter !== "all" && status !== orderStatusFilter) return false;
    if (!query) return true;
    return normalizeSearch([
      order.orderNumber,
      order.id,
      order.customer?.name,
      order.customer?.phone,
      order.customer?.email
    ].join(" ")).includes(query);
  });
}

function renderOrderStats() {
  const root = $("#orderStats");
  if (!root) return;
  const today = new Date().toDateString();
  const todayOrders = orders.filter((order) => orderDate(order).toDateString() === today);
  const openOrders = orders.filter((order) => !["completed", "cancelled"].includes(normalizeAdminStatus(order.orderStatus || order.status || "pending")));
  const revenue = todayOrders
    .filter((order) => order.paymentStatus !== "cancelled")
    .reduce((sum, order) => sum + Number(order.subtotal || 0), 0);
  root.innerHTML = `
    <article><span>Today</span><strong>${todayOrders.length}</strong></article>
    <article><span>Open</span><strong>${openOrders.length}</strong></article>
    <article><span>Revenue</span><strong>${formatOrderTotal(revenue)}</strong></article>
    <article><span>Unread</span><strong>${orders.filter((order) => !getReadOrders().has(order.id)).length}</strong></article>
  `;
}

function orderDate(order) {
  return order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt || Date.now());
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().trim();
}

function printKitchenTicket(order) {
  const lines = [
    "SHAWARMA TIME",
    `Order: ${order.orderNumber || order.id.slice(0, 8).toUpperCase()}`,
    `Customer: ${order.customer?.name || "-"}`,
    `Phone: ${order.customer?.phone || "-"}`,
    `Type: ${order.customer?.fulfillment || "pickup"}`,
    "",
    ...(order.items || []).map((item) => [
      `${Number(item.quantity || 1)}x ${item.name || "Item"} ${item.price || ""}`,
      item.options?.length ? `  Options: ${item.options.join(", ")}` : "",
      item.notes ? `  Note: ${item.notes}` : ""
    ].filter(Boolean).join("\n")),
    "",
    `Notes: ${order.customer?.notes || "-"}`,
    `Total: ${formatOrderTotal(order.subtotal)}`
  ];
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return;
  win.document.write(`<pre style="font-family:monospace;font-size:15px;line-height:1.5;white-space:pre-wrap">${escapeHtml(lines.join("\n"))}</pre>`);
  win.document.close();
  win.focus();
  win.print();
}

function statusOption(value, selected) {
  return `<option value="${value}" ${value === normalizeAdminStatus(selected || "pending") ? "selected" : ""}>${statusLabel(value)}</option>`;
}

function statusLabel(status) {
  const normalized = normalizeAdminStatus(status);
  const flowLabels = {
    pending: "Pending",
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready",
    completed: "Completed",
    cancelled: "Cancelled"
  };
  if (flowLabels[normalized]) return flowLabels[normalized];
  if (normalized === "pending") return adminLang === "ar" ? "قيد الانتظار" : adminLang === "de" ? "Ausstehend" : "Pending";
  if (normalized === "confirmed") return adminLang === "ar" ? "تم التأكيد" : adminLang === "de" ? "Bestaetigt" : "Confirmed";
  if (normalized === "on_the_way") return adminLang === "ar" ? "في الطريق" : adminLang === "de" ? "Unterwegs" : "On The Way";
  if (status === "out_for_delivery") {
    return adminLang === "ar" ? "في الطريق" : adminLang === "de" ? "Unterwegs" : "Onderweg";
  }
  if (status === "accepted") {
    return adminLang === "ar" ? "تم قبول الطلب" : adminLang === "de" ? "Angenommen" : "Geaccepteerd";
  }
  const fallback = {
    nl: { ready: "Klaar voor afhalen", delivered: "Afgeleverd", cancelled: "Geannuleerd" },
    ar: { ready: "جاهز للاستلام", delivered: "تم التسليم", cancelled: "ملغي" },
    de: { ready: "Bereit zur Abholung", delivered: "Geliefert", cancelled: "Storniert" }
  };
  const keys = { new: "orderNew", accepted: "orderAccepted", preparing: "orderPreparing", ready: "orderReady", delivered: "orderDelivered", completed: "orderCompleted", cancelled: "orderCancelled" };
  const translated = tr(keys[status] || "orderNew");
  if (translated === keys[status]) return fallback[adminLang]?.[status] || fallback.nl[status] || tr("orderNew");
  return translated;
}

function normalizeAdminStatus(status) {
  const aliases = {
    new: "pending",
    confirmed: "accepted",
    out_for_delivery: "ready",
    on_the_way: "ready",
    delivered: "completed"
  };
  return aliases[status] || status || "pending";
}

function getReadOrders() {
  try {
    return new Set(JSON.parse(localStorage.getItem(readOrdersKey) || "[]"));
  } catch {
    return new Set();
  }
}

function markOrdersRead(orderIds = orders.map((order) => order.id), shouldRender = true) {
  const readOrders = getReadOrders();
  orderIds.forEach((id) => {
    if (id) readOrders.add(id);
  });
  localStorage.setItem(readOrdersKey, JSON.stringify([...readOrders]));
  if (shouldRender) renderOrders();
}

function updateOrdersBadge() {
  const badge = $("#ordersBadge");
  if (!badge) return;
  const readOrders = getReadOrders();
  const unread = orders.filter((order) => !readOrders.has(order.id)).length;
  badge.textContent = String(unread);
  badge.classList.toggle("hidden", unread === 0);
}

function setupOrderAlertAudio() {
  if (orderAlertAudio) return orderAlertAudio;
  orderAlertAudio = new Audio(orderAlertSoundUrl);
  orderAlertAudio.preload = "auto";
  orderAlertAudio.addEventListener("canplaythrough", () => {
    orderAlertAudioLoaded = true;
    orderAlertAudioError = "";
    logNotificationDebug("Audio file loaded", { src: orderAlertSoundUrl });
  }, { once: true });
  orderAlertAudio.addEventListener("error", () => {
    orderAlertAudioLoaded = false;
    orderAlertAudioError = orderAlertAudio.error?.message || `Audio load failed (${orderAlertAudio.error?.code || "unknown"})`;
    console.error("[AdminNotify] Audio file failed to load", {
      src: orderAlertSoundUrl,
      error: orderAlertAudioError,
      mediaError: orderAlertAudio.error
    });
    updateNotificationStatus();
  });
  orderAlertAudio.load();
  logNotificationDebug("Audio file loading", { src: orderAlertSoundUrl });
  return orderAlertAudio;
}

function unlockOrderSound() {
  try {
    setupOrderAlertAudio();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    orderAudioContext ||= new AudioContext();
    if (orderAudioContext.state === "suspended") orderAudioContext.resume();
  } catch {
    // Browser audio can be blocked until the admin interacts with the page.
  }
}

async function playOrderSound(delay = 0, force = false) {
  try {
    unlockOrderSound();
    const play = async () => {
      setupOrderAlertAudio();
      const audio = orderAlertAudio.cloneNode(true);
      audio.volume = 1;
      try {
        await audio.play();
        logNotificationDebug("Audio play succeeded", {
          forcedByButton: force,
          audioLoaded: orderAlertAudioLoaded,
          notificationPermission: notificationPermission()
        });
      } catch (error) {
        console.error("[AdminNotify] Audio play failed", {
          name: error?.name,
          message: error?.message,
          forcedByButton: force,
          audioLoaded: orderAlertAudioLoaded,
          audioError: orderAlertAudioError
        });
        logNotificationDebug("Audio play blocked or failed", {
          name: error?.name,
          message: error?.message
        });
        playOrderSoundFallback(delay);
      }
    };
    if (delay > 0) setTimeout(play, Math.round(delay * 1000));
    else await play();
  } catch (error) {
    console.error("[AdminNotify] Audio play setup failed", { message: error?.message || String(error) });
  }
}

function playOrderSoundFallback(delay = 0) {
  try {
    const context = orderAudioContext;
    if (!context) return;
    [0, 0.16, 0.32].forEach((offset) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, context.currentTime + delay + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + delay + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + offset + 0.12);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + delay + offset);
      oscillator.stop(context.currentTime + delay + offset + 0.14);
    });
  } catch {
    // Browser audio can be blocked until the admin interacts with the page.
  }
}

function notificationPermission() {
  return "Notification" in window ? Notification.permission : "unsupported";
}

async function requestNotificationPermission(force = false) {
  if (!("Notification" in window)) {
    logNotificationDebug("Browser notifications unsupported");
    return "unsupported";
  }
  if (notificationPermissionRequested && !force) {
    logNotificationDebug("Notification permission already requested", { permission: Notification.permission });
    return Notification.permission;
  }
  notificationPermissionRequested = true;
  if (Notification.permission === "default") {
    try {
      const permission = await Notification.requestPermission();
      logNotificationDebug("Notification permission response", { permission });
      return permission;
    } catch (error) {
      console.error("[AdminNotify] Notification permission request failed", { message: error?.message || String(error) });
      return Notification.permission;
    }
  }
  logNotificationDebug("Notification permission current", { permission: Notification.permission });
  return Notification.permission;
}

function showOrderNotification(order, force = false) {
  requestNotificationPermission();
  if (!("Notification" in window)) {
    logNotificationDebug("Browser notification skipped", { reason: "unsupported" });
    return;
  }
  if (Notification.permission !== "granted") {
    logNotificationDebug("Browser notification skipped", {
      reason: "permission-not-granted",
      permission: Notification.permission,
      forcedByButton: force
    });
    return;
  }
  const orderNumber = order.orderNumber || order.id.slice(0, 8).toUpperCase();
  const customerName = order.customer?.name || "Customer";
  new Notification("New Order Received", {
    body: `#${orderNumber} - ${customerName}`,
    tag: `shawarma-order-${order.id}`,
    icon: "../favicon-192x192.png?v=20260617-st-gold"
  });
  logNotificationDebug("Browser notification shown", {
    orderId: order.id,
    orderNumber,
    customerName,
    forcedByButton: force
  });
}

function updateNotificationStatus() {
  const status = $("#notificationStatus");
  if (!status) return;
  status.textContent = [
    `Notification permission: ${notificationPermission()}`,
    `Sound file: ${orderAlertAudioLoaded ? "loaded" : orderAlertAudioError || "loading"}`,
    `Autoplay: use Test Sound once if Chrome blocks automatic sound`
  ].join(" | ");
}

window.addEventListener("pointerdown", () => {
  setupOrderAlertAudio();
  unlockOrderSound();
  requestNotificationPermission();
}, { once: true });

function paymentMethodLabel(method) {
  const keys = { cash: "paymentCash", restaurant: "paymentRestaurant", stripe: "paymentStripe", mollie: "paymentMollie" };
  return tr(keys[method] || "paymentCash");
}

function paymentStatusLabel(status) {
  const keys = { paid: "paymentPaid", pending: "paymentPending", unpaid: "paymentUnpaid" };
  return tr(keys[status] || "paymentUnpaid");
}

function formatOrderTotal(value) {
  return new Intl.NumberFormat(adminLang === "de" ? "de-DE" : "nl-NL", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function formatOrderDate(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date();
  return new Intl.DateTimeFormat(adminLang === "de" ? "de-DE" : adminLang === "ar" ? "ar" : "nl-NL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function renderHome() {
  $("#homeForm").innerHTML = `
    ${multiInput(siteData.homepage, "title", tr("title"))}
    ${multiInput(siteData.homepage, "slogan", tr("slogan"), "textarea")}
    ${multiInput(siteData.homepage, "intro", tr("intro"), "textarea")}
    ${multiInput(siteData.homepage, "about", tr("about"), "textarea")}
    ${uploadLabel(tr("heroImage"), "data-home-image")}
  `;
  $("[data-home-image]").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadToField(file, siteData.homepage, "heroImage", "hero");
    event.target.value = "";
  });
}

function renderContact() {
  $("#contactForm").innerHTML = `
    ${field("phone", tr("phone"), siteData.settings.phone || "")}
    ${field("address", tr("address"), siteData.settings.address || "", "wide")}
    ${field("whatsappMessage", tr("whatsappMessage"), siteData.settings.whatsappMessage || "", "wide")}
    ${field("instagram", tr("instagramUrl"), siteData.settings.instagram || "")}
    ${field("tiktok", tr("tiktokUrl"), siteData.settings.tiktok || "")}
    ${field("facebook", tr("facebookUrl"), siteData.settings.facebook || "")}
  `;
}

function renderHours() {
  const days = ui[adminLang].days || ui.nl.days;
  $("#hoursForm").innerHTML = `
    <div class="hours-editor">
      ${days.map((day, index) => `
        <label>
          <span>${day}</span>
          <input data-field="hours.${index}" value="${escapeAttr(siteData.settings.hours?.[index] || "")}" />
        </label>
      `).join("")}
    </div>
  `;
}

function renderCategoriesAdmin() {
  const root = $("#categoriesEditor");
  if (!root) return;
  siteData.categoryOrder = normalizeCategoryOrder();
  siteData.categoryLabels ||= {};
  root.innerHTML = siteData.categoryOrder.map((slug, index) => `
    <article class="admin-card editor-card category-editor" data-index="${index}">
      <div class="editor-fields">
        <label><span>${tr("categorySlug")}</span><input data-category-slug value="${escapeAttr(slug)}" /></label>
        <label><span>${tr("name")} NL</span><input data-category-name="nl" value="${escapeAttr(siteData.categoryLabels[slug]?.nl || ui.nl.categories[slug] || slug)}" /></label>
        <label><span>${tr("name")} AR</span><input data-category-name="ar" value="${escapeAttr(siteData.categoryLabels[slug]?.ar || ui.ar.categories[slug] || slug)}" /></label>
        <label><span>${tr("name")} DE</span><input data-category-name="de" value="${escapeAttr(siteData.categoryLabels[slug]?.de || ui.de.categories[slug] || slug)}" /></label>
      </div>
      <div class="editor-actions">
        <button class="btn primary" type="button" data-save-category>${tr("save")}</button>
        <button class="btn ghost danger" type="button" data-delete-category>${tr("delete")}</button>
      </div>
    </article>
  `).join("");
  root.querySelectorAll("[data-save-category]").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest(".category-editor");
      const index = Number(card.dataset.index);
      const slug = normalizeCategorySlug(card.querySelector("[data-category-slug]").value);
      if (!slug) return;
      const oldSlug = siteData.categoryOrder[index];
      siteData.categoryOrder = normalizeCategoryOrder();
      if (oldSlug && oldSlug !== slug) delete siteData.categoryLabels[oldSlug];
      siteData.categoryLabels[oldSlug] = {
        nl: card.querySelector('[data-category-name="nl"]').value || slug,
        ar: card.querySelector('[data-category-name="ar"]').value || slug,
        de: card.querySelector('[data-category-name="de"]').value || slug
      };
      await saveContent(tr("saved"));
    });
  });
  root.querySelectorAll("[data-delete-category]").forEach((button) => {
    button.addEventListener("click", async () => {
      siteData.categoryOrder = normalizeCategoryOrder();
      await saveContent(tr("deleted"));
    });
  });
}

function normalizeCategorySlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderReviews() {
  const root = $("#reviewsEditor");
  root.innerHTML = (siteData.reviews || []).map((review) => `
    <article class="admin-card editor-card review-editor" data-id="${review.id}">
      <div class="editor-fields">
        ${field("name", tr("name"), review.name || "")}
        ${field("rating", tr("rating"), review.rating || "")}
        ${multiInput(review, "text", tr("description"), "textarea")}
      </div>
      <div class="editor-actions">
        <button class="btn primary" type="button" data-save-review>${tr("save")}</button>
        <button class="btn ghost danger" type="button" data-delete-review>${tr("delete")}</button>
      </div>
    </article>
  `).join("");
  root.querySelectorAll("[data-save-review]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".editor-card");
      const review = siteData.reviews.find((entry) => entry.id === card.dataset.id);
      collectFields(card, review);
      saveContent(tr("saved"));
    });
  });
  root.querySelectorAll("[data-delete-review]").forEach((button) => {
    button.addEventListener("click", () => {
      siteData.reviews = siteData.reviews.filter((entry) => entry.id !== button.closest(".editor-card").dataset.id);
      saveContent(tr("deleted"));
    });
  });
}

function renderCollection(collection, rootId, options) {
  const root = $(`#${rootId}`);
  root.innerHTML = siteData[collection].map((item) => editorCard(collection, item, options)).join("");
  root.querySelectorAll("[data-save]").forEach((button) => {
    button.addEventListener("click", () => saveEditor(collection, button.closest(".editor-card"), options));
  });
  root.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      siteData[collection] = siteData[collection].filter((item) => item.id !== button.closest(".editor-card").dataset.id);
      saveContent(tr("deleted"));
    });
  });
  root.querySelectorAll("[data-image]").forEach((input) => {
    input.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const item = siteData[collection].find((entry) => entry.id === input.closest(".editor-card").dataset.id);
      await uploadToField(file, item, "image", options.folder);
      event.target.value = "";
    });
  });
}

function editorCard(collection, item, options) {
  return `
    <article class="admin-card editor-card" data-id="${item.id}">
      <img src="${item.image || siteData.homepage.heroImage}" alt="" data-preview />
      <div class="editor-fields">
        ${options.category ? categorySelect(item) : ""}
        ${options.badge ? badgeSelect(item) : ""}
        ${options.availability ? checkboxField("available", tr("available"), item.available !== false) : ""}
        ${options.type ? field("type", tr("type"), item.type || "") : ""}
        ${options.price ? field("price", tr("price"), item.price || "") : ""}
        ${multiInput(item, options.title ? "title" : "name", options.title ? tr("title") : tr("name"))}
        ${options.desc ? multiInput(item, "desc", tr("description"), "textarea") : ""}
        ${options.text ? multiInput(item, "text", tr("bannerText"), "textarea") : ""}
        ${uploadLabel(tr("uploadImage"), "data-image")}
      </div>
      <div class="editor-actions">
        <button class="btn primary" type="button" data-save>${tr("save")}</button>
        <button class="btn ghost danger" type="button" data-delete>${tr("delete")}</button>
      </div>
    </article>
  `;
}

function saveEditor(collection, card) {
  const item = siteData[collection].find((entry) => entry.id === card.dataset.id);
  collectFields(card, item);
  saveContent(tr("saved"));
}

function collectFields(root, item) {
  root.querySelectorAll("[data-field]").forEach((input) => {
    setNested(item, input.dataset.field, input.type === "checkbox" ? input.checked : input.value);
  });
}

function multiInput(item, fieldName, label, type = "input") {
  return langs.map((lang) => {
    const value = item[fieldName]?.[lang] || "";
    return type === "textarea"
      ? `<label class="wide"><span>${label} ${lang.toUpperCase()}</span><textarea data-field="${fieldName}.${lang}">${escapeHtml(value)}</textarea></label>`
      : `<label><span>${label} ${lang.toUpperCase()}</span><input data-field="${fieldName}.${lang}" value="${escapeAttr(value)}" /></label>`;
  }).join("");
}

function field(fieldName, label, value, className = "") {
  return `<label class="${className}"><span>${label}</span><input data-field="${fieldName}" value="${escapeAttr(value)}" /></label>`;
}

function checkboxField(fieldName, label, checked) {
  return `<label class="toggle-label"><span>${label}</span><input type="checkbox" data-field="${fieldName}" ${checked ? "checked" : ""} /></label>`;
}

function uploadLabel(label, attribute) {
  return `<label class="wide upload-label"><span>${label}</span><small>${tr("uploadHint")}</small><input ${attribute} type="file" accept="${imageAccept}" /></label>`;
}

function categorySelect(item) {
  const categories = normalizeCategoryOrder();
  return `<label><span>${tr("category")}</span><select data-field="category">${categories.map((cat) => `<option value="${cat}" ${item.category === cat ? "selected" : ""}>${categoryLabelAdmin(cat)}</option>`).join("")}</select></label>`;
}

function categoryLabelAdmin(category) {
  return siteData.categoryLabels?.[category]?.[adminLang]
    || ui[adminLang].categories[category]
    || category;
}

function badgeSelect(item) {
  return `<label><span>${tr("badge")}</span><select data-field="badge">${badgeOptions.map((badge) => `<option value="${badge}" ${item.badge === badge ? "selected" : ""}>${badge ? (ui[adminLang].badges[badge] || badge) : tr("none")}</option>`).join("")}</select></label>`;
}

async function uploadToField(file, item, fieldName, folder) {
  loading(true);
  try {
    const preview = document.querySelector(`[data-id="${item.id}"] [data-preview]`);
    if (preview) preview.src = await fileToDataUrl(file);
    item[fieldName] = await uploadFirebaseImage(file, folder);
    await saveContent(tr("imageUploaded"));
  } catch (error) {
    note(localizedError(error, "uploadFailed"));
  } finally {
    loading(false);
  }
}

function setupUploads() {
  document.querySelectorAll(".upload-label").forEach((label) => {
    if (label.dataset.dropReady) return;
    label.dataset.dropReady = "true";
    ["dragenter", "dragover"].forEach((eventName) => {
      label.addEventListener(eventName, (event) => {
        event.preventDefault();
        label.classList.add("drag-over");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      label.addEventListener(eventName, (event) => {
        event.preventDefault();
        label.classList.remove("drag-over");
      });
    });
    label.addEventListener("drop", async (event) => {
      const file = event.dataTransfer?.files?.[0];
      const input = label.querySelector("input[type='file']");
      if (!file || !input) return;
      if (input.hasAttribute("data-home-image")) {
        await uploadToField(file, siteData.homepage, "heroImage", "hero");
        return;
      }
      const card = input.closest(".editor-card");
      if (!card) return;
      const collection = card.closest(".editor-list")?.id?.replace("Editor", "");
      const item = siteData[collection]?.find((entry) => entry.id === card.dataset.id);
      if (item) await uploadToField(file, item, "image", collection || "uploads");
    });
  });
}

function blankItem(collection) {
  const id = `${collection}-${Date.now()}`;
  const baseImage = siteData.homepage.heroImage;
  const blank = { nl: "", ar: "", de: "", en: "" };
  return {
    menu: { id, category: "sandwiches", badge: "", price: "EUR 0,00", available: true, name: { ...blank }, desc: { ...blank }, image: baseImage },
    offers: { id, type: "daily", price: "EUR 0,00", name: { ...blank }, desc: { ...blank }, image: baseImage },
    banners: { id, title: { ...blank }, text: { ...blank }, image: baseImage },
    gallery: { id, type: "food", title: { ...blank }, image: baseImage },
    reviews: { id, name: "", rating: "5.0", text: { ...blank } }
  }[collection];
}

function setNested(target, path, value) {
  const parts = path.split(".");
  let ref = target;
  while (parts.length > 1) {
    const key = parts.shift();
    const nextKey = parts[0];
    if (Array.isArray(ref[key]) || /^\d+$/.test(nextKey)) ref[key] ||= [];
    else ref[key] ||= {};
    ref = ref[key];
  }
  ref[parts[0]] = value;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

applyAdminLanguage();
bootAdmin();
