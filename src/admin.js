import { badgeOptions, categoryOrder, loadSiteData, ui } from "./data.js";
import { loadAdminSiteData, saveAdminSiteData, uploadAdminImage } from "./adminApi.js";
import {
  isSupabaseConfigured,
  onAuthStateChange,
  requireAdminSession,
  requestPasswordReset,
  signIn,
  signOut,
  updatePassword
} from "./supabaseService.js";

let data = loadSiteData();
let designDraft = structuredClone(data.design || {});
let usingSupabase = false;
let currentAdmin = null;
let inactivityTimer = null;
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const LOCAL_ADMIN_USERNAME = "admin";
const LOCAL_ADMIN_PASSWORD_HASH = "04dbee8cfd24bfd0350661c4ced6518658bd339c3d44135a5e93555729aaf0b4";
const LOCAL_ADMIN_SESSION_KEY = "shawarma-time-local-admin-session";
const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
let adminLang = localStorage.getItem("shawarma-time-admin-lang") || "nl";

const $ = (selector) => document.querySelector(selector);
const langs = ["nl", "ar", "de", "en"];
const days = ui.nl.days;

const adminText = {
  nl: {
    admin: "Admin",
    control: "Control",
    username: "Username",
    email: "E-mail",
    password: "Wachtwoord",
    continue: "Doorgaan",
    forgotPassword: "Wachtwoord vergeten?",
    resetPassword: "Reset wachtwoord",
    sendReset: "Stuur resetlink",
    backLogin: "Terug naar login",
    newPasswordTitle: "Nieuw wachtwoord",
    newPassword: "Nieuw wachtwoord",
    savePassword: "Wachtwoord opslaan",
    logout: "Uitloggen",
    premiumDashboard: "Premium dashboard",
    manageTitle: "Beheer Shawarma Time",
    viewWebsite: "Bekijk website",
    homepage: "Homepage",
    design: "Design",
    media: "Media",
    menu: "Menu",
    offers: "Aanbiedingen",
    banners: "Banners",
    gallery: "Galerij",
    reviews: "Reviews",
    contact: "Contact",
    save: "Opslaan",
    delete: "Verwijderen",
    addMenu: "Nieuw item",
    addOffer: "Nieuwe aanbieding",
    addBanner: "Nieuwe banner",
    addPhoto: "Nieuwe foto",
    addReview: "Nieuwe review",
    uploadImage: "Afbeelding uploaden",
    uploadMedia: "Media uploaden",
    replace: "Vervangen",
    noMedia: "Nog geen media geupload.",
    name: "Naam",
    title: "Titel",
    description: "Beschrijving",
    price: "Prijs",
    category: "Categorie",
    badge: "Badge",
    type: "Type",
    rating: "Rating",
    phone: "Telefoon",
    address: "Adres",
    whatsappMessage: "WhatsApp bericht",
    saved: "Wijzigingen opgeslagen",
    imageSaved: "Afbeelding opgeslagen",
    imageReady: "Afbeelding klaar voor preview",
    loading: "Laden..."
  },
  ar: {
    admin: "الإدارة",
    control: "التحكم",
    username: "اسم المستخدم",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    continue: "متابعة",
    forgotPassword: "نسيت كلمة المرور؟",
    resetPassword: "إعادة تعيين كلمة المرور",
    sendReset: "إرسال رابط reset",
    backLogin: "العودة لتسجيل الدخول",
    newPasswordTitle: "كلمة مرور جديدة",
    newPassword: "كلمة مرور جديدة",
    savePassword: "حفظ كلمة المرور",
    logout: "تسجيل الخروج",
    premiumDashboard: "لوحة تحكم فاخرة",
    manageTitle: "إدارة Shawarma Time",
    viewWebsite: "عرض الموقع",
    homepage: "الرئيسية",
    design: "التصميم",
    media: "الوسائط",
    menu: "القائمة",
    offers: "العروض",
    banners: "البنرات",
    gallery: "المعرض",
    reviews: "التقييمات",
    contact: "التواصل",
    save: "حفظ",
    delete: "حذف",
    addMenu: "عنصر جديد",
    addOffer: "عرض جديد",
    addBanner: "بنر جديد",
    addPhoto: "صورة جديدة",
    addReview: "تقييم جديد",
    uploadImage: "رفع صورة",
    uploadMedia: "رفع وسائط",
    replace: "استبدال",
    noMedia: "لا توجد وسائط بعد.",
    name: "الاسم",
    title: "العنوان",
    description: "الوصف",
    price: "السعر",
    category: "الفئة",
    badge: "الشارة",
    type: "النوع",
    rating: "التقييم",
    phone: "الهاتف",
    address: "العنوان",
    whatsappMessage: "رسالة واتساب",
    saved: "تم حفظ التغييرات",
    imageSaved: "تم حفظ الصورة",
    imageReady: "الصورة جاهزة للمعاينة",
    loading: "جار التحميل..."
  },
  de: {
    admin: "Admin",
    control: "Kontrolle",
    username: "Benutzername",
    email: "E-Mail",
    password: "Passwort",
    continue: "Weiter",
    forgotPassword: "Passwort vergessen?",
    resetPassword: "Passwort zurücksetzen",
    sendReset: "Reset-Link senden",
    backLogin: "Zurück zum Login",
    newPasswordTitle: "Neues Passwort",
    newPassword: "Neues Passwort",
    savePassword: "Passwort speichern",
    logout: "Abmelden",
    premiumDashboard: "Premium Dashboard",
    manageTitle: "Shawarma Time verwalten",
    viewWebsite: "Website ansehen",
    homepage: "Homepage",
    design: "Design",
    media: "Medien",
    menu: "Menü",
    offers: "Angebote",
    banners: "Banner",
    gallery: "Galerie",
    reviews: "Bewertungen",
    contact: "Kontakt",
    save: "Speichern",
    delete: "Löschen",
    addMenu: "Neuer Artikel",
    addOffer: "Neues Angebot",
    addBanner: "Neuer Banner",
    addPhoto: "Neues Foto",
    addReview: "Neue Bewertung",
    uploadImage: "Bild hochladen",
    uploadMedia: "Medien hochladen",
    replace: "Ersetzen",
    noMedia: "Noch keine Medien hochgeladen.",
    name: "Name",
    title: "Titel",
    description: "Beschreibung",
    price: "Preis",
    category: "Kategorie",
    badge: "Badge",
    type: "Typ",
    rating: "Bewertung",
    phone: "Telefon",
    address: "Adresse",
    whatsappMessage: "WhatsApp Nachricht",
    saved: "Änderungen gespeichert",
    imageSaved: "Bild gespeichert",
    imageReady: "Bild bereit für Vorschau",
    loading: "Laden..."
  }
};

const adminCopy = {
  nl: {
    admin: "Admin", control: "Control", secureLogin: "Beveiligde admin login", loginHelp: "Log in met het admin-account dat in Supabase Auth is aangemaakt.", authMissing: "Log in met het admin-account dat in Supabase Auth is aangemaakt.", loginAgain: "Log opnieuw in met een actief admin-account.", loginFailed: "Inloggen is mislukt.", authRequired: "Secure Supabase-authenticatie is verplicht voordat admin toegang actief is.", loggedOut: "Je bent veilig uitgelogd.", resetSent: "Als dit e-mailadres bestaat, is er een resetlink verzonden.", resetFailed: "Resetlink verzenden is mislukt.", passwordUpdated: "Wachtwoord bijgewerkt. Log opnieuw in.", passwordFailed: "Wachtwoord bijwerken is mislukt.", sessionExpired: "Je sessie is verlopen. Log opnieuw in.", sessionIdle: "Je sessie is verlopen door inactiviteit.", noActiveAdmin: "Geen actief admin-account gevonden.", role: "Rol",
    username: "Username", email: "E-mail", password: "Wachtwoord", continue: "Doorgaan", forgotPassword: "Wachtwoord vergeten?", resetPassword: "Reset wachtwoord", sendReset: "Stuur resetlink", backLogin: "Terug naar login", newPasswordTitle: "Nieuw wachtwoord", newPassword: "Nieuw wachtwoord", savePassword: "Wachtwoord opslaan", logout: "Uitloggen", premiumDashboard: "Premium dashboard", manageTitle: "Beheer Shawarma Time", viewWebsite: "Bekijk website",
    homepage: "Homepage", design: "Design", media: "Media", menu: "Menu", offers: "Aanbiedingen", banners: "Banners", gallery: "Galerij", reviews: "Reviews", contact: "Contact", homepageContent: "Homepage content", designSettings: "Design Settings", livePreview: "Live preview", close: "Sluiten", mediaLibrary: "Media Library", menuItems: "Menu items", offersDiscounts: "Offers & discounts", advertisementBanners: "Advertisement banners", contactHours: "Contact, social media en openingstijden",
    save: "Opslaan", saveDesign: "Design opslaan", saveHomepage: "Homepage opslaan", saveDetails: "Gegevens opslaan", delete: "Verwijderen", addMenu: "Nieuw item", addOffer: "Nieuwe aanbieding", addBanner: "Nieuwe banner", addPhoto: "Nieuwe foto", addReview: "Nieuwe review", uploadImage: "Afbeelding uploaden", uploadMedia: "Media uploaden", replace: "Vervangen", noMedia: "Nog geen media geupload.",
    name: "Naam", title: "Titel", description: "Beschrijving", price: "Prijs", category: "Categorie", badge: "Badge", type: "Type", rating: "Rating", reviewText: "Review tekst", bannerText: "Banner tekst", noBadge: "Geen", eyebrow: "Eyebrow", slogan: "Slogan", intro: "Intro", about: "Over ons", menuTitle: "Menu titel", offersTitle: "Offers titel", galleryTitle: "Gallery titel", aboutTitle: "Over ons sectietitel", footer: "Footer tekst", heroImage: "Hero afbeelding uploaden",
    tone: "Tone", darkLuxury: "Dark luxury", lightWarm: "Light warm", fontStyle: "Font stijl", modernClean: "Modern clean", elegantSerif: "Elegant serif", roundedModern: "Rounded modern", boldDisplay: "Bold display", accentColor: "Accent kleur", buttonColor: "Button kleur", goldColor: "Gold kleur", cardStyle: "Card stijl", glassLuxury: "Glass luxury", flatClean: "Flat clean", goldOutline: "Gold outline", borderRadius: "Border radius", heroOverlay: "Hero overlay", glowEffects: "Glow/fire effects", animations: "Animaties", logoImage: "Logo afbeelding", heroMedia: "Homepage achtergrond / hero media", menuBackground: "Menu section background", offersBackground: "Offers section background", galleryBackground: "Gallery section background", aboutBackground: "About section background", contactBackground: "Contact section background",
    phone: "Telefoon", address: "Adres", whatsappMessage: "WhatsApp bericht", saved: "Wijzigingen opgeslagen", homepageSaved: "Homepage opgeslagen", designSaved: "Design opgeslagen", detailsSaved: "Contactgegevens opgeslagen", mediaSaved: "media bestand(en) opgeslagen", mediaDeleted: "Media verwijderd", mediaReplaced: "Media vervangen", imageSaved: "Afbeelding opgeslagen", heroImageSaved: "Hero afbeelding opgeslagen", uploadFailed: "Upload mislukt", imageReady: "Afbeelding klaar voor preview", loading: "Laden..."
  },
  ar: {
    admin: "\u0627\u0644\u0625\u062f\u0627\u0631\u0629", control: "\u0627\u0644\u062a\u062d\u0643\u0645", secureLogin: "\u062a\u0633\u062c\u064a\u0644 \u062f\u062e\u0648\u0644 \u0622\u0645\u0646 \u0644\u0644\u0625\u062f\u0627\u0631\u0629", loginHelp: "\u0633\u062c\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0628\u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0630\u064a \u062a\u0645 \u0625\u0646\u0634\u0627\u0624\u0647 \u0641\u064a Supabase Auth.", authMissing: "\u0644\u0645 \u064a\u062a\u0645 \u0625\u0639\u062f\u0627\u062f \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u0628\u0639\u062f. \u0623\u0636\u0641 \u0645\u062a\u063a\u064a\u0631\u0627\u062a Supabase \u0644\u0644\u0625\u0646\u062a\u0627\u062c.", loginAgain: "\u0633\u062c\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649 \u0628\u062d\u0633\u0627\u0628 \u0645\u062f\u064a\u0631 \u0646\u0634\u0637.", loginFailed: "\u0641\u0634\u0644 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644.", authRequired: "\u064a\u062c\u0628 \u062a\u0641\u0639\u064a\u0644 \u0645\u0635\u0627\u062f\u0642\u0629 Supabase \u0627\u0644\u0622\u0645\u0646\u0629 \u0642\u0628\u0644 \u0641\u062a\u062d \u0627\u0644\u0625\u062f\u0627\u0631\u0629.", loggedOut: "\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u062e\u0631\u0648\u062c\u0643 \u0628\u0623\u0645\u0627\u0646.", resetSent: "\u0625\u0630\u0627 \u0643\u0627\u0646 \u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064a\u062f \u0645\u0648\u062c\u0648\u062f\u0627\u060c \u0641\u0642\u062f \u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0627\u0628\u0637 \u0627\u0644\u0625\u0639\u0627\u062f\u0629.", resetFailed: "\u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0631\u0627\u0628\u0637 \u0627\u0644\u0625\u0639\u0627\u062f\u0629.", passwordUpdated: "\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631. \u0633\u062c\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.", passwordFailed: "\u0641\u0634\u0644 \u062a\u062d\u062f\u064a\u062b \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631.", sessionExpired: "\u0627\u0646\u062a\u0647\u062a \u0627\u0644\u062c\u0644\u0633\u0629. \u0633\u062c\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.", sessionIdle: "\u0627\u0646\u062a\u0647\u062a \u0627\u0644\u062c\u0644\u0633\u0629 \u0628\u0633\u0628\u0628 \u0639\u062f\u0645 \u0627\u0644\u0646\u0634\u0627\u0637.", noActiveAdmin: "\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u062d\u0633\u0627\u0628 \u0645\u062f\u064a\u0631 \u0646\u0634\u0637.", role: "\u0627\u0644\u062f\u0648\u0631",
    username: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645", email: "\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a", password: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", continue: "\u0645\u062a\u0627\u0628\u0639\u0629", forgotPassword: "\u0646\u0633\u064a\u062a \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631\u061f", resetPassword: "\u0625\u0639\u0627\u062f\u0629 \u062a\u0639\u064a\u064a\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", sendReset: "\u0625\u0631\u0633\u0627\u0644 \u0631\u0627\u0628\u0637 \u0627\u0644\u0625\u0639\u0627\u062f\u0629", backLogin: "\u0627\u0644\u0639\u0648\u062f\u0629 \u0644\u0644\u062f\u062e\u0648\u0644", newPasswordTitle: "\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u062c\u062f\u064a\u062f\u0629", newPassword: "\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u062c\u062f\u064a\u062f\u0629", savePassword: "\u062d\u0641\u0638 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", logout: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c", premiumDashboard: "\u0644\u0648\u062d\u0629 \u062a\u062d\u0643\u0645 \u0641\u0627\u062e\u0631\u0629", manageTitle: "\u0625\u062f\u0627\u0631\u0629 Shawarma Time", viewWebsite: "\u0639\u0631\u0636 \u0627\u0644\u0645\u0648\u0642\u0639",
    homepage: "\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629", design: "\u0627\u0644\u062a\u0635\u0645\u064a\u0645", media: "\u0627\u0644\u0648\u0633\u0627\u0626\u0637", menu: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629", offers: "\u0627\u0644\u0639\u0631\u0648\u0636", banners: "\u0627\u0644\u0628\u0646\u0631\u0627\u062a", gallery: "\u0627\u0644\u0645\u0639\u0631\u0636", reviews: "\u0627\u0644\u062a\u0642\u064a\u064a\u0645\u0627\u062a", contact: "\u0627\u0644\u062a\u0648\u0627\u0635\u0644", homepageContent: "\u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629", designSettings: "\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u062a\u0635\u0645\u064a\u0645", livePreview: "\u0645\u0639\u0627\u064a\u0646\u0629 \u0645\u0628\u0627\u0634\u0631\u0629", close: "\u0625\u063a\u0644\u0627\u0642", mediaLibrary: "\u0645\u0643\u062a\u0628\u0629 \u0627\u0644\u0648\u0633\u0627\u0626\u0637", menuItems: "\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0626\u0645\u0629", offersDiscounts: "\u0627\u0644\u0639\u0631\u0648\u0636 \u0648\u0627\u0644\u062e\u0635\u0648\u0645\u0627\u062a", advertisementBanners: "\u0628\u0646\u0631\u0627\u062a \u0625\u0639\u0644\u0627\u0646\u064a\u0629", contactHours: "\u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0648\u0627\u0644\u0633\u0648\u0634\u0627\u0644 \u0645\u064a\u062f\u064a\u0627 \u0648\u0623\u0648\u0642\u0627\u062a \u0627\u0644\u0639\u0645\u0644",
    save: "\u062d\u0641\u0638", saveDesign: "\u062d\u0641\u0638 \u0627\u0644\u062a\u0635\u0645\u064a\u0645", saveHomepage: "\u062d\u0641\u0638 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629", saveDetails: "\u062d\u0641\u0638 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a", delete: "\u062d\u0630\u0641", addMenu: "\u0639\u0646\u0635\u0631 \u062c\u062f\u064a\u062f", addOffer: "\u0639\u0631\u0636 \u062c\u062f\u064a\u062f", addBanner: "\u0628\u0646\u0631 \u062c\u062f\u064a\u062f", addPhoto: "\u0635\u0648\u0631\u0629 \u062c\u062f\u064a\u062f\u0629", addReview: "\u062a\u0642\u064a\u064a\u0645 \u062c\u062f\u064a\u062f", uploadImage: "\u0631\u0641\u0639 \u0635\u0648\u0631\u0629", uploadMedia: "\u0631\u0641\u0639 \u0648\u0633\u0627\u0626\u0637", replace: "\u0627\u0633\u062a\u0628\u062f\u0627\u0644", noMedia: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0648\u0633\u0627\u0626\u0637 \u0628\u0639\u062f.",
    name: "\u0627\u0644\u0627\u0633\u0645", title: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646", description: "\u0627\u0644\u0648\u0635\u0641", price: "\u0627\u0644\u0633\u0639\u0631", category: "\u0627\u0644\u0641\u0626\u0629", badge: "\u0627\u0644\u0634\u0627\u0631\u0629", type: "\u0627\u0644\u0646\u0648\u0639", rating: "\u0627\u0644\u062a\u0642\u064a\u064a\u0645", reviewText: "\u0646\u0635 \u0627\u0644\u062a\u0642\u064a\u064a\u0645", bannerText: "\u0646\u0635 \u0627\u0644\u0628\u0646\u0631", noBadge: "\u0628\u062f\u0648\u0646", eyebrow: "\u0639\u0628\u0627\u0631\u0629 \u0639\u0644\u0648\u064a\u0629", slogan: "\u0627\u0644\u0634\u0639\u0627\u0631", intro: "\u0627\u0644\u0645\u0642\u062f\u0645\u0629", about: "\u0645\u0646 \u0646\u062d\u0646", menuTitle: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629", offersTitle: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0639\u0631\u0648\u0636", galleryTitle: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0645\u0639\u0631\u0636", aboutTitle: "\u0639\u0646\u0648\u0627\u0646 \u0645\u0646 \u0646\u062d\u0646", footer: "\u0646\u0635 \u0627\u0644\u0641\u0648\u062a\u0631", heroImage: "\u0631\u0641\u0639 \u0635\u0648\u0631\u0629 \u0627\u0644\u0647\u064a\u0631\u0648",
    tone: "\u0627\u0644\u0646\u0645\u0637", darkLuxury: "\u062f\u0627\u0643\u0646 \u0641\u0627\u062e\u0631", lightWarm: "\u0641\u0627\u062a\u062d \u062f\u0627\u0641\u0626", fontStyle: "\u0646\u0645\u0637 \u0627\u0644\u062e\u0637", modernClean: "\u062d\u062f\u064a\u062b \u0648\u0646\u0638\u064a\u0641", elegantSerif: "\u0623\u0646\u064a\u0642", roundedModern: "\u062d\u062f\u064a\u062b \u0645\u0633\u062a\u062f\u064a\u0631", boldDisplay: "\u0639\u0631\u0636 \u062c\u0631\u064a\u0621", accentColor: "\u0644\u0648\u0646 \u0627\u0644\u062a\u0645\u064a\u064a\u0632", buttonColor: "\u0644\u0648\u0646 \u0627\u0644\u0623\u0632\u0631\u0627\u0631", goldColor: "\u0627\u0644\u0644\u0648\u0646 \u0627\u0644\u0630\u0647\u0628\u064a", cardStyle: "\u0646\u0645\u0637 \u0627\u0644\u0628\u0637\u0627\u0642\u0627\u062a", glassLuxury: "\u0632\u062c\u0627\u062c \u0641\u0627\u062e\u0631", flatClean: "\u0645\u0633\u0637\u062d \u0646\u0638\u064a\u0641", goldOutline: "\u062d\u062f\u0648\u062f \u0630\u0647\u0628\u064a\u0629", borderRadius: "\u0627\u0633\u062a\u062f\u0627\u0631\u0629 \u0627\u0644\u062d\u0648\u0627\u0641", heroOverlay: "\u0637\u0628\u0642\u0629 \u0627\u0644\u0647\u064a\u0631\u0648", glowEffects: "\u062a\u0623\u062b\u064a\u0631\u0627\u062a \u0627\u0644\u0648\u0647\u062c \u0648\u0627\u0644\u0646\u0627\u0631", animations: "\u0627\u0644\u062d\u0631\u0643\u0627\u062a", logoImage: "\u0635\u0648\u0631\u0629 \u0627\u0644\u0634\u0639\u0627\u0631", heroMedia: "\u062e\u0644\u0641\u064a\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629 / \u0645\u064a\u062f\u064a\u0627 \u0627\u0644\u0647\u064a\u0631\u0648", menuBackground: "\u062e\u0644\u0641\u064a\u0629 \u0642\u0633\u0645 \u0627\u0644\u0645\u0646\u064a\u0648", offersBackground: "\u062e\u0644\u0641\u064a\u0629 \u0642\u0633\u0645 \u0627\u0644\u0639\u0631\u0648\u0636", galleryBackground: "\u062e\u0644\u0641\u064a\u0629 \u0642\u0633\u0645 \u0627\u0644\u0645\u0639\u0631\u0636", aboutBackground: "\u062e\u0644\u0641\u064a\u0629 \u0642\u0633\u0645 \u0645\u0646 \u0646\u062d\u0646", contactBackground: "\u062e\u0644\u0641\u064a\u0629 \u0642\u0633\u0645 \u0627\u0644\u062a\u0648\u0627\u0635\u0644",
    phone: "\u0627\u0644\u0647\u0627\u062a\u0641", address: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646", whatsappMessage: "\u0631\u0633\u0627\u0644\u0629 \u0648\u0627\u062a\u0633\u0627\u0628", saved: "\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a", homepageSaved: "\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629", designSaved: "\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u062a\u0635\u0645\u064a\u0645", detailsSaved: "\u062a\u0645 \u062d\u0641\u0638 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062a\u0648\u0627\u0635\u0644", mediaSaved: "\u0645\u0644\u0641\u0627\u062a \u0648\u0633\u0627\u0626\u0637 \u062a\u0645 \u062d\u0641\u0638\u0647\u0627", mediaDeleted: "\u062a\u0645 \u062d\u0630\u0641 \u0627\u0644\u0648\u0633\u0627\u0626\u0637", mediaReplaced: "\u062a\u0645 \u0627\u0633\u062a\u0628\u062f\u0627\u0644 \u0627\u0644\u0648\u0633\u0627\u0626\u0637", imageSaved: "\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u0635\u0648\u0631\u0629", heroImageSaved: "\u062a\u0645 \u062d\u0641\u0638 \u0635\u0648\u0631\u0629 \u0627\u0644\u0647\u064a\u0631\u0648", uploadFailed: "\u0641\u0634\u0644 \u0627\u0644\u0631\u0641\u0639", imageReady: "\u0627\u0644\u0635\u0648\u0631\u0629 \u062c\u0627\u0647\u0632\u0629 \u0644\u0644\u0645\u0639\u0627\u064a\u0646\u0629", loading: "\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644..."
  },
  de: {
    admin: "Admin", control: "Kontrolle", secureLogin: "Sicherer Admin-Login", loginHelp: "Melde dich mit dem Admin-Konto an, das in Supabase Auth erstellt wurde.", authMissing: "Melde dich mit dem Admin-Konto an, das in Supabase Auth erstellt wurde.", loginAgain: "Bitte melde dich erneut mit einem aktiven Admin-Konto an.", loginFailed: "Anmeldung fehlgeschlagen.", authRequired: "Sichere Supabase-Authentifizierung ist erforderlich, bevor Admin-Zugriff aktiviert ist.", loggedOut: "Du wurdest sicher abgemeldet.", resetSent: "Wenn diese E-Mail existiert, wurde ein Reset-Link gesendet.", resetFailed: "Reset-Link konnte nicht gesendet werden.", passwordUpdated: "Passwort aktualisiert. Bitte erneut anmelden.", passwordFailed: "Passwort konnte nicht aktualisiert werden.", sessionExpired: "Deine Sitzung ist abgelaufen. Bitte erneut anmelden.", sessionIdle: "Deine Sitzung ist wegen Inaktivitaet abgelaufen.", noActiveAdmin: "Kein aktives Admin-Konto gefunden.", role: "Rolle",
    username: "Benutzername", email: "E-Mail", password: "Passwort", continue: "Weiter", forgotPassword: "Passwort vergessen?", resetPassword: "Passwort zuruecksetzen", sendReset: "Reset-Link senden", backLogin: "Zurueck zum Login", newPasswordTitle: "Neues Passwort", newPassword: "Neues Passwort", savePassword: "Passwort speichern", logout: "Abmelden", premiumDashboard: "Premium Dashboard", manageTitle: "Shawarma Time verwalten", viewWebsite: "Website ansehen",
    homepage: "Homepage", design: "Design", media: "Medien", menu: "Menue", offers: "Angebote", banners: "Banner", gallery: "Galerie", reviews: "Bewertungen", contact: "Kontakt", homepageContent: "Homepage-Inhalte", designSettings: "Design-Einstellungen", livePreview: "Live-Vorschau", close: "Schliessen", mediaLibrary: "Medienbibliothek", menuItems: "Menuepunkte", offersDiscounts: "Angebote & Rabatte", advertisementBanners: "Werbebanner", contactHours: "Kontakt, Social Media und Oeffnungszeiten",
    save: "Speichern", saveDesign: "Design speichern", saveHomepage: "Homepage speichern", saveDetails: "Daten speichern", delete: "Loeschen", addMenu: "Neuer Artikel", addOffer: "Neues Angebot", addBanner: "Neuer Banner", addPhoto: "Neues Foto", addReview: "Neue Bewertung", uploadImage: "Bild hochladen", uploadMedia: "Medien hochladen", replace: "Ersetzen", noMedia: "Noch keine Medien hochgeladen.",
    name: "Name", title: "Titel", description: "Beschreibung", price: "Preis", category: "Kategorie", badge: "Badge", type: "Typ", rating: "Bewertung", reviewText: "Bewertungstext", bannerText: "Bannertext", noBadge: "Keine", eyebrow: "Eyebrow", slogan: "Slogan", intro: "Intro", about: "Ueber uns", menuTitle: "Menue-Titel", offersTitle: "Angebote-Titel", galleryTitle: "Galerie-Titel", aboutTitle: "Ueber-uns-Titel", footer: "Footer-Text", heroImage: "Hero-Bild hochladen",
    tone: "Ton", darkLuxury: "Dark luxury", lightWarm: "Light warm", fontStyle: "Schriftstil", modernClean: "Modern clean", elegantSerif: "Elegant serif", roundedModern: "Rounded modern", boldDisplay: "Bold display", accentColor: "Akzentfarbe", buttonColor: "Buttonfarbe", goldColor: "Goldfarbe", cardStyle: "Kartenstil", glassLuxury: "Glass luxury", flatClean: "Flat clean", goldOutline: "Gold outline", borderRadius: "Border radius", heroOverlay: "Hero overlay", glowEffects: "Glow/Fire-Effekte", animations: "Animationen", logoImage: "Logo-Bild", heroMedia: "Homepage-Hintergrund / Hero-Media", menuBackground: "Menue-Sektionshintergrund", offersBackground: "Angebote-Sektionshintergrund", galleryBackground: "Galerie-Sektionshintergrund", aboutBackground: "Ueber-uns-Sektionshintergrund", contactBackground: "Kontakt-Sektionshintergrund",
    phone: "Telefon", address: "Adresse", whatsappMessage: "WhatsApp Nachricht", saved: "Aenderungen gespeichert", homepageSaved: "Homepage gespeichert", designSaved: "Design gespeichert", detailsSaved: "Kontaktdaten gespeichert", mediaSaved: "Mediendatei(en) gespeichert", mediaDeleted: "Medien geloescht", mediaReplaced: "Medien ersetzt", imageSaved: "Bild gespeichert", heroImageSaved: "Hero-Bild gespeichert", uploadFailed: "Upload fehlgeschlagen", imageReady: "Bild bereit fuer Vorschau", loading: "Laden..."
  }
};

function at(key) {
  return adminCopy[adminLang]?.[key] || adminCopy.nl[key] || key;
}

function applyAdminLanguage() {
  document.documentElement.lang = adminLang;
  document.documentElement.dir = adminLang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-admin-i18n]").forEach((el) => {
    el.textContent = at(el.dataset.adminI18n);
  });
  document.querySelectorAll("[data-label-key]").forEach((el) => {
    const label = el.querySelector("b");
    if (label) label.textContent = at(el.dataset.labelKey);
  });
  document.querySelectorAll("[data-admin-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminLang === adminLang);
  });
  const panelTitles = {
    homePanel: "homepageContent",
    designPanel: "designSettings",
    mediaPanel: "mediaLibrary",
    menuPanel: "menuItems",
    offersPanel: "offersDiscounts",
    bannersPanel: "advertisementBanners",
    galleryPanel: "gallery",
    reviewsPanel: "reviews",
    settingsPanel: "contactHours"
  };
  Object.entries(panelTitles).forEach(([id, key]) => {
    const title = document.querySelector(`#${id} .panel-head h2`);
    if (title) title.textContent = at(key);
  });
  const fixedButtons = [
    ["#previewDesignBtn", "livePreview"],
    ["#saveDesignBtn", "saveDesign"],
    ["#closePreviewBtn", "close"],
    ["#settingsForm button[type='submit']", "saveDetails"]
  ];
  fixedButtons.forEach(([selector, key]) => {
    const node = $(selector);
    if (node) node.textContent = at(key);
  });
  const mediaUploadLabel = document.querySelector("#mediaPanel .upload-button");
  if (mediaUploadLabel) mediaUploadLabel.childNodes[0].textContent = at("uploadMedia");
  const contactLabels = { phone: "phone", address: "address", whatsappMessage: "whatsappMessage", instagram: "Instagram URL", tiktok: "TikTok URL", facebook: "Facebook URL" };
  Object.entries(contactLabels).forEach(([name, key]) => {
    const label = document.querySelector(`#settingsForm [name='${name}']`)?.closest("label");
    if (label) label.childNodes[0].textContent = at(key) || key;
  });
  const navIcons = ["H", "D", "M", "\u2630", "%", "B", "G", "\u2605", "C"];
  document.querySelectorAll(".admin-sidebar nav button span").forEach((icon, index) => {
    icon.textContent = navIcons[index] || "";
  });
  document.querySelectorAll("[data-add]").forEach((button) => {
    const keys = { menu: "addMenu", offers: "addOffer", banners: "addBanner", gallery: "addPhoto", reviews: "addReview" };
    button.textContent = at(keys[button.dataset.add] || "save");
  });
}

function setMode() {
  $("#authTitle").textContent = at("secureLogin");
  $("#authNote").textContent = at("loginHelp");
}

async function showDashboard() {
  setLoading(true);
  if (usingSupabase) {
    const access = await requireAdminSession();
    if (!access) {
      setLoading(false);
      showLogin(at("loginAgain"));
      return;
    }
    currentAdmin = access.admin;
  }
  $("#authView").classList.add("hidden");
  $("#dashboardView").classList.remove("hidden");
  $("#adminRole").textContent = currentAdmin ? `${at("role")}: ${currentAdmin.role}` : "";
  try {
    data = await loadAdminSiteData();
    renderAll();
    applyAdminLanguage();
    startInactivityTimer();
    window.history.replaceState(null, "", "/admin/#dashboard");
  } finally {
    setLoading(false);
  }
}

function showLogin(message = "") {
  currentAdmin = null;
  stopInactivityTimer();
  $("#dashboardView").classList.add("hidden");
  $("#authView").classList.remove("hidden");
  $("#authForm").classList.remove("hidden");
  $("#resetRequestForm").classList.add("hidden");
  $("#newPasswordForm").classList.add("hidden");
  if (message) $("#authNote").textContent = message;
  window.history.replaceState(null, "", "/admin/#login");
}

function showResetRequest() {
  $("#authForm").classList.add("hidden");
  $("#newPasswordForm").classList.add("hidden");
  $("#resetRequestForm").classList.remove("hidden");
  window.history.replaceState(null, "", "/admin/#forgot-password");
}

function showNewPasswordForm() {
  $("#authForm").classList.add("hidden");
  $("#resetRequestForm").classList.add("hidden");
  $("#newPasswordForm").classList.remove("hidden");
  $("#authView").classList.remove("hidden");
  $("#dashboardView").classList.add("hidden");
  window.history.replaceState(null, "", "/admin/#reset-password");
}

document.querySelectorAll("[data-admin-lang]").forEach((button) => {
  button.addEventListener("click", () => {
    adminLang = button.dataset.adminLang;
    localStorage.setItem("shawarma-time-admin-lang", adminLang);
    applyAdminLanguage();
    setMode();
    if (!$("#dashboardView").classList.contains("hidden")) {
      renderAll();
      $("#adminRole").textContent = currentAdmin ? `${at("role")}: ${currentAdmin.role}` : "";
    }
  });
});

$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const username = form.get("username").trim();
  const password = form.get("password");
  if (usingSupabase) {
    try {
      setLoading(true);
      const access = await signIn(username, password);
      currentAdmin = access.admin;
      await showDashboard();
    } catch (error) {
      $("#authNote").textContent = error.message || at("loginFailed");
    } finally {
      setLoading(false);
    }
    return;
  }
  if (await verifyLocalAdmin(username, password)) {
    sessionStorage.setItem(LOCAL_ADMIN_SESSION_KEY, "active");
    currentAdmin = { username: LOCAL_ADMIN_USERNAME, role: "owner", is_active: true };
    await showDashboard();
    return;
  }
  $("#authNote").textContent = at("loginFailed");
});

$("#logoutBtn").addEventListener("click", async () => {
  setLoading(true);
  sessionStorage.removeItem(LOCAL_ADMIN_SESSION_KEY);
  await signOut();
  setLoading(false);
  showLogin(at("loggedOut"));
});

$("#forgotPasswordBtn").addEventListener("click", showResetRequest);

document.querySelectorAll("[data-auth-back]").forEach((button) => {
  button.addEventListener("click", () => showLogin(""));
});

$("#resetRequestForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const username = new FormData(event.currentTarget).get("username").trim();
    if (!usingSupabase) {
      $("#resetRequestNote").textContent = "Password reset is available after Supabase is connected.";
      return;
    }
    await requestPasswordReset(username);
    $("#resetRequestNote").textContent = at("resetSent");
  } catch (error) {
    $("#resetRequestNote").textContent = error.message || at("resetFailed");
  }
});

async function verifyLocalAdmin(username, password) {
  if (String(username || "").trim().toLowerCase() !== LOCAL_ADMIN_USERNAME) return false;
  const encoded = new TextEncoder().encode(String(password || ""));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return hash === LOCAL_ADMIN_PASSWORD_HASH;
}

$("#newPasswordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const newPassword = new FormData(event.currentTarget).get("newPassword");
    await updatePassword(newPassword);
    await signOut();
    showLogin(at("passwordUpdated"));
  } catch (error) {
    $("#newPasswordNote").textContent = error.message || at("passwordFailed");
  }
});

function startInactivityTimer() {
  stopInactivityTimer();
  const reset = () => {
    window.clearTimeout(inactivityTimer);
    inactivityTimer = window.setTimeout(async () => {
      await signOut();
      showLogin(at("sessionIdle"));
    }, INACTIVITY_LIMIT_MS);
  };
  ["click", "keydown", "pointermove", "scroll", "touchstart"].forEach((eventName) => {
    window.addEventListener(eventName, reset, { passive: true });
  });
  startInactivityTimer.reset = reset;
  reset();
}

function stopInactivityTimer() {
  window.clearTimeout(inactivityTimer);
  if (startInactivityTimer.reset) {
    ["click", "keydown", "pointermove", "scroll", "touchstart"].forEach((eventName) => {
      window.removeEventListener(eventName, startInactivityTimer.reset);
    });
    startInactivityTimer.reset = null;
  }
}

document.querySelectorAll(".admin-sidebar nav button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".admin-sidebar nav button, .admin-panel").forEach((el) => el.classList.remove("active"));
    button.classList.add("active");
    $(`#${button.dataset.panel}`).classList.add("active");
  });
});

document.querySelectorAll("[data-add]").forEach((button) => {
  button.addEventListener("click", () => addItem(button.dataset.add));
});

function localizedInputs(item, field, label, type = "input") {
  return langs.map((lang) => {
    const value = item[field]?.[lang] || "";
    return type === "textarea"
      ? `<label class="wide"><span>${label} ${lang.toUpperCase()}</span><textarea data-field="${field}.${lang}">${escapeHtml(value)}</textarea></label>`
      : `<label><span>${label} ${lang.toUpperCase()}</span><input data-field="${field}.${lang}" value="${escapeAttr(value)}" /></label>`;
  }).join("");
}

function renderList(collection, rootId, options = {}) {
  const root = $(`#${rootId}`);
  root.innerHTML = "";
  data[collection].forEach((item) => {
    const node = $("#editorTemplate").content.firstElementChild.cloneNode(true);
    node.dataset.id = item.id;
    node.querySelector("[data-preview]").src = item.image || data.homepage.heroImage;
    node.querySelector(".editor-fields").innerHTML = fieldsFor(item, options);
    node.querySelector("[data-save]").textContent = at("save");
    node.querySelector("[data-delete]").textContent = at("delete");
    node.querySelector("[data-save]").addEventListener("click", () => saveEditor(collection, node));
    node.querySelector("[data-delete]").addEventListener("click", () => deleteItem(collection, item.id));
    const imageInput = node.querySelector("[data-image]");
    if (imageInput) {
      imageInput.addEventListener("change", (event) => loadImage(event, item, node));
      bindDropUpload(imageInput.closest(".upload-label"), (file) => handleImageFile(file, item, node));
    }
    root.appendChild(node);
  });
}

function fieldsFor(item, options) {
  if (options.review) {
    return `
      <label><span>${at("name")}</span><input data-field="name" value="${escapeAttr(item.name || "")}" /></label>
      <label><span>${at("rating")}</span><input data-field="rating" value="${escapeAttr(item.rating || "")}" /></label>
      ${localizedInputs(item, "text", at("reviewText"), "textarea")}
    `;
  }
  const category = options.category ? `
    <label><span>${at("category")}</span>
      <select data-field="category">
        ${categoryOrder.map((cat) => `<option value="${cat}" ${item.category === cat ? "selected" : ""}>${ui[adminLang]?.categories?.[cat] || ui.nl.categories[cat]}</option>`).join("")}
      </select>
    </label>` : "";
  const badge = options.badge ? `
    <label><span>${at("badge")}</span>
      <select data-field="badge">
        ${badgeOptions.map((value) => `<option value="${value}" ${item.badge === value ? "selected" : ""}>${value || at("noBadge")}</option>`).join("")}
      </select>
    </label>` : "";
  const type = options.type ? `<label><span>${at("type")}</span><input data-field="type" value="${escapeAttr(item.type || "")}" /></label>` : "";
  const price = options.price ? `<label><span>${at("price")}</span><input data-field="price" value="${escapeAttr(item.price || "")}" /></label>` : "";
  const title = options.banner || options.gallery
    ? localizedInputs(item, "title", at("title"))
    : localizedInputs(item, "name", at("name"));
  const desc = options.desc ? localizedInputs(item, "desc", at("description"), "textarea") : "";
  const text = options.banner ? localizedInputs(item, "text", at("bannerText"), "textarea") : "";
  return `
    ${category}
    ${badge}
    ${type}
    ${price}
    ${title}
    ${desc}
    ${text}
    <label class="wide upload-label"><span>${at("uploadImage")}</span><small>JPG, PNG, WEBP - max 5MB</small><input data-image type="file" accept="${IMAGE_ACCEPT}" /></label>
  `;
}

function setNested(target, path, value) {
  const parts = path.split(".");
  let ref = target;
  while (parts.length > 1) {
    const key = parts.shift();
    ref[key] ||= {};
    ref = ref[key];
  }
  ref[parts[0]] = value;
}

function saveEditor(collection, node) {
  const item = data[collection].find((entry) => entry.id === node.dataset.id);
  node.querySelectorAll("[data-field]").forEach((input) => setNested(item, input.dataset.field, input.value));
  saveAndRender();
}

function deleteItem(collection, id) {
  data[collection] = data[collection].filter((item) => item.id !== id);
  saveAndRender();
}

function addItem(collection) {
  const id = `${collection}-${Date.now()}`;
  const baseImage = data.menu[0]?.image || data.homepage.heroImage;
  const item = {
    menu: { id, category: "sandwiches", badge: "", price: "€0,00", name: blank(), desc: blank(), image: baseImage },
    offers: { id, type: "daily", price: "€0,00", name: blank(), desc: blank(), image: baseImage },
    banners: { id, title: blank(), text: blank(), image: baseImage },
    gallery: { id, type: "food", title: blank(), image: baseImage },
    reviews: { id, name: "", rating: "5.0", text: blank() }
  }[collection];
  data[collection].unshift(item);
  saveAndRender();
}

function blank() {
  return { nl: "", ar: "", de: "" };
}

async function loadImage(event, item, node) {
  const file = event.target.files?.[0];
  if (!file) return;
  await handleImageFile(file, item, node);
  event.target.value = "";
}

async function handleImageFile(file, item, node) {
  try {
    validateImageCandidate(file);
    node.querySelector("[data-preview]").src = await fileToDataUrl(file);
    showSaved(at("imageReady"));
  } catch (error) {
    showSaved(error.message || at("uploadFailed"));
    return;
  }
  setLoading(true);
  try {
    item.image = await uploadAdminImage(file, bucketForCollection(node.closest(".admin-panel")?.id), item.image);
    node.querySelector("[data-preview]").src = item.image;
    await persistData();
    showSaved(at("imageSaved"));
  } catch (error) {
    showSaved(error.message || at("uploadFailed"));
  } finally {
    setLoading(false);
  }
}

function validateImageCandidate(file) {
  if (!file) throw new Error("No image selected.");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("Only JPG, PNG and WEBP images are allowed.");
  if (file.size > MAX_IMAGE_SIZE) throw new Error("Image is too large. Maximum size is 5MB.");
}

function bindDropUpload(zone, onFile) {
  if (!zone) return;
  ["dragenter", "dragover"].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      zone.classList.add("drag-over");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      if (eventName === "drop") {
        const file = event.dataTransfer?.files?.[0];
        if (file) onFile(file);
      }
      zone.classList.remove("drag-over");
    });
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function renderHomepage() {
  $("#homepageForm").innerHTML = `
    ${localizedInputs(data.homepage, "eyebrow", at("eyebrow"))}
    ${localizedInputs(data.homepage, "title", at("title"))}
    ${localizedInputs(data.homepage, "slogan", at("slogan"), "textarea")}
    ${localizedInputs(data.homepage, "intro", at("intro"), "textarea")}
    ${localizedInputs(data.homepage, "about", at("about"), "textarea")}
    ${localizedInputs(data.sectionText, "menuTitle", at("menuTitle"))}
    ${localizedInputs(data.sectionText, "offersTitle", at("offersTitle"))}
    ${localizedInputs(data.sectionText, "galleryTitle", at("galleryTitle"))}
    ${localizedInputs(data.sectionText, "aboutTitle", at("aboutTitle"))}
    ${localizedInputs(data.sectionText, "footer", at("footer"), "textarea")}
    <label class="wide upload-label"><span>${at("heroImage")}</span><small>JPG, PNG, WEBP - max 5MB</small><input id="heroImageInput" type="file" accept="${IMAGE_ACCEPT}" /></label>
    <button class="btn primary" type="submit">${at("saveHomepage")}</button>
  `;
  const uploadHero = async (file) => {
    if (!file) return;
    try {
      validateImageCandidate(file);
    } catch (error) {
      showSaved(error.message || at("uploadFailed"));
      return;
    }
    setLoading(true);
    try {
      data.homepage.heroImage = await uploadAdminImage(file, "hero", data.homepage.heroImage);
      await persistData();
      showSaved(at("heroImageSaved"));
    } catch (error) {
      showSaved(error.message || at("uploadFailed"));
    } finally {
      setLoading(false);
    }
  };
  $("#heroImageInput").addEventListener("change", async (event) => {
    await uploadHero(event.target.files?.[0]);
    event.target.value = "";
  });
  bindDropUpload($("#heroImageInput").closest(".upload-label"), uploadHero);
}

$("#homepageForm").addEventListener("submit", (event) => {
  event.preventDefault();
  event.currentTarget.querySelectorAll("[data-field]").forEach((input) => {
    const target = input.dataset.field.startsWith("menuTitle.")
      || input.dataset.field.startsWith("offersTitle.")
      || input.dataset.field.startsWith("galleryTitle.")
      || input.dataset.field.startsWith("aboutTitle.")
      || input.dataset.field.startsWith("footer.")
      ? data.sectionText
      : data.homepage;
    setNested(target, input.dataset.field, input.value);
  });
  saveAndRender(at("homepageSaved"));
});

function renderDesign() {
  designDraft = structuredClone(data.design || {});
  $("#designForm").innerHTML = `
    <label><span>${at("tone")}</span>
      <select data-design="tone">
        ${option("dark", at("darkLuxury"), designDraft.tone)}
        ${option("light", at("lightWarm"), designDraft.tone)}
      </select>
    </label>
    <label><span>${at("fontStyle")}</span>
      <select data-design="font">
        ${option("Inter", at("modernClean"), designDraft.font)}
        ${option("Elegant", at("elegantSerif"), designDraft.font)}
        ${option("Modern", at("roundedModern"), designDraft.font)}
        ${option("Bold", at("boldDisplay"), designDraft.font)}
      </select>
    </label>
    <label><span>${at("accentColor")}</span><input data-design="accentColor" type="color" value="${escapeAttr(designDraft.accentColor || "#ff7a1a")}" /></label>
    <label><span>${at("buttonColor")}</span><input data-design="buttonColor" type="color" value="${escapeAttr(designDraft.buttonColor || "#ff7a1a")}" /></label>
    <label><span>${at("goldColor")}</span><input data-design="goldColor" type="color" value="${escapeAttr(designDraft.goldColor || "#ffbf58")}" /></label>
    <label><span>${at("cardStyle")}</span>
      <select data-design="cardStyle">
        ${option("glass", at("glassLuxury"), designDraft.cardStyle)}
        ${option("flat", at("flatClean"), designDraft.cardStyle)}
        ${option("outline", at("goldOutline"), designDraft.cardStyle)}
      </select>
    </label>
    <label><span>${at("borderRadius")}</span><input data-design="borderRadius" type="range" min="0" max="28" value="${Number(designDraft.borderRadius || 8)}" /></label>
    <label><span>${at("heroOverlay")}</span><input data-design="heroOverlay" type="range" min="35" max="96" value="${Number(designDraft.heroOverlay || 78)}" /></label>
    <label class="toggle-label"><input data-design="glow" type="checkbox" ${designDraft.glow !== false ? "checked" : ""} /> <span>${at("glowEffects")}</span></label>
    <label class="toggle-label"><input data-design="animations" type="checkbox" ${designDraft.animations !== false ? "checked" : ""} /> <span>${at("animations")}</span></label>
    <label class="wide upload-label"><span>${at("logoImage")}</span><small>JPG, PNG, WEBP - max 5MB</small><input data-design-image="logoImage" type="file" accept="${IMAGE_ACCEPT}" /></label>
    <label class="wide upload-label"><span>${at("heroMedia")}</span><small>JPG, PNG, WEBP - max 5MB</small><input data-design-image="heroImage" type="file" accept="${IMAGE_ACCEPT}" /></label>
    <label class="wide upload-label"><span>${at("menuBackground")}</span><small>JPG, PNG, WEBP - max 5MB</small><input data-design-image="menuBackground" type="file" accept="${IMAGE_ACCEPT}" /></label>
    <label class="wide upload-label"><span>${at("offersBackground")}</span><small>JPG, PNG, WEBP - max 5MB</small><input data-design-image="offersBackground" type="file" accept="${IMAGE_ACCEPT}" /></label>
    <label class="wide upload-label"><span>${at("galleryBackground")}</span><small>JPG, PNG, WEBP - max 5MB</small><input data-design-image="galleryBackground" type="file" accept="${IMAGE_ACCEPT}" /></label>
    <label class="wide upload-label"><span>${at("aboutBackground")}</span><small>JPG, PNG, WEBP - max 5MB</small><input data-design-image="aboutBackground" type="file" accept="${IMAGE_ACCEPT}" /></label>
    <label class="wide upload-label"><span>${at("contactBackground")}</span><small>JPG, PNG, WEBP - max 5MB</small><input data-design-image="contactBackground" type="file" accept="${IMAGE_ACCEPT}" /></label>
  `;
  $("#designForm").querySelectorAll("[data-design]").forEach((input) => {
    input.addEventListener("input", collectDesignDraft);
    input.addEventListener("change", collectDesignDraft);
  });
  $("#designForm").querySelectorAll("[data-design-image]").forEach((input) => {
    const uploadDesignImage = async (file) => {
      if (!file) return;
      try {
        validateImageCandidate(file);
      } catch (error) {
        showSaved(error.message || at("uploadFailed"));
        return;
      }
      const key = input.dataset.designImage;
      setLoading(true);
      try {
        const previousUrl = key === "heroImage" ? data.homepage.heroImage : designDraft[key];
        const value = await uploadAdminImage(file, bucketForDesignKey(key), previousUrl);
        if (key === "heroImage") data.homepage.heroImage = value;
        else designDraft[key] = value;
        data.design = structuredClone(designDraft);
        addMedia(file.name, value);
        await persistData();
        renderMedia();
        showSaved(at("imageReady"));
        sendPreview();
      } catch (error) {
        showSaved(error.message || at("uploadFailed"));
      } finally {
        setLoading(false);
      }
    };
    input.addEventListener("change", async (event) => {
      await uploadDesignImage(event.target.files?.[0]);
      event.target.value = "";
    });
    bindDropUpload(input.closest(".upload-label"), uploadDesignImage);
  });
}

function option(value, label, selected) {
  return `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`;
}

function collectDesignDraft() {
  $("#designForm").querySelectorAll("[data-design]").forEach((input) => {
    const key = input.dataset.design;
    designDraft[key] = input.type === "checkbox" ? input.checked : input.value;
  });
}

$("#previewDesignBtn").addEventListener("click", () => {
  collectDesignDraft();
  $("#previewShell").classList.remove("hidden");
  sendPreview();
});

$("#saveDesignBtn").addEventListener("click", () => {
  collectDesignDraft();
  data.design = structuredClone(designDraft);
  saveAndRender(at("designSaved"));
  sendPreview();
});

$("#closePreviewBtn").addEventListener("click", () => $("#previewShell").classList.add("hidden"));

function sendPreview() {
  const frame = $("#previewFrame");
  const previewData = structuredClone(data);
  previewData.design = structuredClone(designDraft);
  frame.contentWindow?.postMessage({ type: "shawarma-preview", data: previewData }, window.location.origin);
}

$("#previewFrame").addEventListener("load", sendPreview);

function addMedia(name, src) {
  data.media ||= [];
  data.media.unshift({ id: `media-${Date.now()}-${Math.random().toString(16).slice(2)}`, name, src, createdAt: new Date().toISOString() });
}

$("#mediaUpload").addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);
  await uploadMediaFiles(files);
  event.target.value = "";
});

bindDropUpload($("#mediaUpload").closest(".upload-button"), (file) => uploadMediaFiles([file]));

async function uploadMediaFiles(files) {
  if (!files.length) return;
  setLoading(true);
  try {
    for (const file of files) {
      validateImageCandidate(file);
      const url = await uploadAdminImage(file, "gallery");
      addMedia(file.name, url);
    }
    await saveAndRender(`${files.length} ${at("mediaSaved")}`);
  } catch (error) {
    showSaved(error.message || at("uploadFailed"));
  } finally {
    setLoading(false);
  }
}

function renderMedia() {
  const items = data.media || [];
  $("#mediaGrid").innerHTML = items.length ? items.map((item) => `
    <article class="media-card" data-id="${item.id}">
      <img src="${item.src}" alt="${escapeAttr(item.name)}" />
      <div>
        <small>${escapeHtml(item.name)}</small>
        <div class="media-actions">
          <label class="btn ghost upload-button">${at("replace")}<input data-replace-media="${item.id}" type="file" accept="${IMAGE_ACCEPT}" /></label>
          <button class="btn ghost danger" data-delete-media="${item.id}" type="button">${at("delete")}</button>
        </div>
      </div>
    </article>
  `).join("") : `<p class="form-note">Nog geen media geüpload.</p>`;
  if (!items.length) $("#mediaGrid").innerHTML = `<p class="form-note">${at("noMedia")}</p>`;
  $("#mediaGrid").querySelectorAll("[data-delete-media]").forEach((button) => {
    button.addEventListener("click", () => {
      data.media = data.media.filter((item) => item.id !== button.dataset.deleteMedia);
      saveAndRender(at("mediaDeleted"));
    });
  });
  $("#mediaGrid").querySelectorAll("[data-replace-media]").forEach((input) => {
    const replaceMedia = async (file) => {
      if (!file) return;
      try {
        validateImageCandidate(file);
      } catch (error) {
        showSaved(error.message || at("uploadFailed"));
        return;
      }
      const item = data.media.find((entry) => entry.id === input.dataset.replaceMedia);
      item.name = file.name;
      setLoading(true);
      try {
        item.src = await uploadAdminImage(file, "gallery", item.src);
        await saveAndRender(at("mediaReplaced"));
      } catch (error) {
        showSaved(error.message || at("uploadFailed"));
      } finally {
        setLoading(false);
      }
    };
    input.addEventListener("change", async (event) => {
      await replaceMedia(event.target.files?.[0]);
      event.target.value = "";
    });
    bindDropUpload(input.closest(".upload-button"), replaceMedia);
  });
}

function renderSettings() {
  $("#settingsForm").phone.value = data.settings.phone;
  $("#settingsForm").address.value = data.settings.address;
  $("#settingsForm").whatsappMessage.value = data.settings.whatsappMessage;
  $("#settingsForm").instagram.value = data.settings.instagram;
  $("#settingsForm").tiktok.value = data.settings.tiktok;
  $("#settingsForm").facebook.value = data.settings.facebook;
  $("#hoursEditor").innerHTML = days.map((day, index) => `
    <label><span>${day}</span><input data-hour="${index}" value="${escapeAttr(data.settings.hours[index] || "")}" /></label>
  `).join("");
}

$("#settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  data.settings.phone = form.phone.value;
  data.settings.address = form.address.value;
  data.settings.whatsappMessage = form.whatsappMessage.value;
  data.settings.instagram = form.instagram.value;
  data.settings.tiktok = form.tiktok.value;
  data.settings.facebook = form.facebook.value;
  form.querySelectorAll("[data-hour]").forEach((input) => {
    data.settings.hours[Number(input.dataset.hour)] = input.value;
  });
  saveAndRender(at("detailsSaved"));
});

async function saveAndRender(message = at("saved")) {
  setLoading(true);
  try {
    await persistData();
    renderAll();
    showSaved(message);
  } finally {
    setLoading(false);
  }
}

async function persistData() {
  await saveAdminSiteData(data);
}

function showSaved(message) {
  $("#saveStatus").textContent = message;
  const toast = $("#adminToast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showSaved.timer);
  showSaved.timer = window.setTimeout(() => {
    $("#saveStatus").textContent = "";
    toast.classList.remove("visible");
  }, 2200);
}

function setLoading(active) {
  $("#adminLoader").classList.toggle("hidden", !active);
}

function renderAll() {
  if (!usingSupabase) data = loadSiteData();
  renderHomepage();
  renderDesign();
  renderMedia();
  renderList("menu", "menuEditor", { category: true, badge: true, price: true, desc: true });
  renderList("offers", "offersEditor", { type: true, price: true, desc: true });
  renderList("banners", "bannersEditor", { banner: true });
  renderList("gallery", "galleryEditor", { gallery: true, type: true });
  renderList("reviews", "reviewsEditor", { review: true });
  renderSettings();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function bucketForCollection(panelId) {
  if (panelId === "offersPanel" || panelId === "bannersPanel") return "offers";
  if (panelId === "galleryPanel") return "gallery";
  return "menu";
}

function bucketForDesignKey(key) {
  if (key === "heroImage" || key === "logoImage") return "hero";
  if (key === "offersBackground") return "offers";
  if (key === "galleryBackground") return "gallery";
  return "menu";
}

async function init() {
  applyAdminLanguage();
  usingSupabase = await isSupabaseConfigured();
  if (usingSupabase) {
    onAuthStateChange(async (_event, session) => {
      if (_event === "PASSWORD_RECOVERY") {
        showNewPasswordForm();
        return;
      }
      if (!session) {
        showLogin(at("sessionExpired"));
        return;
      }
      const access = await requireAdminSession();
      if (!access) showLogin(at("noActiveAdmin"));
    });
    setMode();
    if (window.location.hash === "#reset-password") {
      showNewPasswordForm();
      return;
    }
    const access = await requireAdminSession();
    if (access) {
      currentAdmin = access.admin;
      await showDashboard();
    } else {
      showLogin(at("loginHelp"));
    }
    return;
  }
  setMode();
  if (sessionStorage.getItem(LOCAL_ADMIN_SESSION_KEY) === "active") {
    currentAdmin = { username: LOCAL_ADMIN_USERNAME, role: "owner", is_active: true };
    await showDashboard();
  }
}

init();
