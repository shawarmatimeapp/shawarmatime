import { loadSiteData, localized, normalizeCategoryOrder, ui } from "./data.js";
import { fetchPublicSiteData, subscribeToPublicUpdates } from "./publicApi.js";
import { createFirebaseOrder, subscribeFirebaseOrderByNumber } from "./firebaseService.js?v=20260706-restaurant-ready";
import { paymentConfig } from "./paymentConfig.js?v=20260702-mollie-functions";

let lang = localStorage.getItem("shawarma-time-lang") || "nl";
let activeCategory = "all";
let menuSearch = "";
let data = loadSiteData();
let unsubscribeRealtime = null;
let unsubscribeTrackedOrder = null;
const cartStorageKey = "shawarma-time-cart";
const restaurantCheckoutOnly = true;
let cart = loadSavedCart();
let modalProductId = null;
let modalQuantity = 1;
let mollieReady = false;
const isProduction = !["localhost", "127.0.0.1", ""].includes(window.location.hostname);

if (isProduction) {
  window.addEventListener("error", (event) => {
    event.preventDefault();
    setStatus("", false);
    return true;
  });
  window.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    setStatus("", false);
  });
}

const $ = (selector) => document.querySelector(selector);
const orderLog = (event, details = {}) => console.info(`[OrderFlow] ${event}`, details);
const routeSections = {
  "/": "home",
  "/menu": "home",
  "/checkout": "checkout",
  "/success": "success",
  "/payment-success": "success",
  "/failed": "failed",
  "/track": "track",
  "/contact": "contact"
};
const orderingUi = {
  nl: {
    badges: {
      new: "Nieuw",
      popular: "Best Seller",
      spicy: "Populair",
      offer: "Special Offer"
    },
    sectionText: {
      footer: "Shawarma Time Venlo. Online bestellen, met kaart betalen en snel afhalen."
    },
    section: {
      addedToCart: "is toegevoegd aan je winkelwagen.",
      checkout: "Checkout",
      trackOrder: "Volg bestelling",
      checkoutEyebrow: "Veilig bestellen",
      checkoutTitle: "Rond je bestelling af",
      checkoutIntro: "Vul je gegevens in, kies je betaalmethode en bevestig je bestelling.",
      yourOrder: "Jouw bestelling",
      addMore: "Meer toevoegen",
      goToCheckout: "Naar checkout",
      idealPayment: "Cash / test checkout",
      mollieWallets: "Tijdelijk: bestelling direct testen en betalen bij afhalen.",
      customerEmail: "E-mail",
      customerAddress: "Adres",
      preferredTime: "Gewenste tijd",
      fulfillment: "Afhalen of bezorgen",
      pickup: "Afhalen",
      delivery: "Bezorgen",
      orderConfirmed: "Bestelling bevestigd",
      thankYou: "Bedankt voor je bestelling",
      orderNumber: "Ordernummer",
      paymentStatus: "Betaalstatus",
      pickupDelivery: "Afhalen / bezorgen",
      prepTime: "Bereidingstijd",
      defaultPrepTime: "20-30 min",
      successMessage: "We gaan direct voor je aan de slag. Totaal:",
      successOnlineMessage: "Je betaling is ontvangen. De bestelling wordt automatisch doorgestuurd naar de keuken.",
      onlineOrderNumber: "Online betaald",
      backToMenu: "Terug naar menu",
      callRestaurant: "Bel restaurant",
      paymentFailed: "Betaling mislukt",
      paymentFailedTitle: "De betaling is niet afgerond",
      paymentFailedText: "Je kunt opnieuw proberen of een andere betaalmethode kiezen.",
      retryPayment: "Opnieuw proberen",
      trackEyebrow: "Bestelstatus",
      trackTitle: "Volg je bestelling",
      orderReceived: "In afwachting",
      confirmed: "Bevestigd",
      accepted: "Geaccepteerd",
      preparing: "In bereiding",
      readyForPickup: "Klaar voor afhalen",
      onTheWay: "Onderweg",
      outForDelivery: "Onderweg",
      delivered: "Afgeleverd",
      cancelled: "Geannuleerd",
      estimatedPrep: "Geschatte bereiding",
      remainingTime: "Nog ongeveer",
      liveTracking: "Live status",
      trackingHint: "Vul je ordernummer in of plaats een bestelling om de status te zien.",
      trackingNotFound: "We konden dit ordernummer niet vinden. Controleer het nummer of bel het restaurant.",
      directions: "Route",
      openNow: "Nu open",
      closedNow: "Nu gesloten",
      orderNow: "Bestel nu",
      addToBasket: "Toevoegen aan mandje",
      addOns: "Extra's",
      extraGarlic: "Extra knoflooksaus",
      extraSpicy: "Extra pittige saus",
      extraCheese: "Extra kaas",
      pickupDeliveryInfo: "Afhalen en bezorgen",
      openingHours: "Openingstijden"
    }
  },
  ar: {
    badges: {
      new: "جديد",
      popular: "الأكثر مبيعاً",
      spicy: "شائع",
      offer: "عرض خاص"
    },
    sectionText: {
      footer: "شاورما تايم فينلو. اطلب أونلاين وادفع بالبطاقة واستلم بسرعة."
    },
    section: {
      addedToCart: "تمت إضافته إلى سلة الطلب.",
      checkout: "إتمام الطلب",
      trackOrder: "تتبع الطلب",
      checkoutEyebrow: "طلب آمن",
      checkoutTitle: "أكمل طلبك",
      checkoutIntro: "أدخل بياناتك، اختر طريقة الدفع وأكد طلبك.",
      yourOrder: "طلبك",
      addMore: "أضف المزيد",
      goToCheckout: "إلى الدفع",
      idealPayment: "Cash / test checkout",
      mollieWallets: "Temporary: create the order now and pay at pickup.",
      customerEmail: "البريد الإلكتروني",
      customerAddress: "العنوان",
      preferredTime: "الوقت المفضل",
      fulfillment: "استلام أو توصيل",
      pickup: "استلام",
      delivery: "توصيل",
      orderConfirmed: "تم تأكيد الطلب",
      thankYou: "شكراً لطلبك",
      orderNumber: "رقم الطلب",
      paymentStatus: "حالة الدفع",
      pickupDelivery: "استلام / توصيل",
      prepTime: "وقت التحضير",
      defaultPrepTime: "20-30 دقيقة",
      successMessage: "سنبدأ بتحضير طلبك فوراً. المجموع:",
      successOnlineMessage: "تم استلام الدفع. سيتم إرسال الطلب تلقائياً إلى المطبخ.",
      onlineOrderNumber: "دفع أونلاين",
      backToMenu: "العودة إلى القائمة",
      callRestaurant: "اتصل بالمطعم",
      paymentFailed: "فشل الدفع",
      paymentFailedTitle: "لم تكتمل عملية الدفع",
      paymentFailedText: "يمكنك المحاولة مرة أخرى أو اختيار طريقة دفع أخرى.",
      retryPayment: "حاول مرة أخرى",
      trackEyebrow: "حالة الطلب",
      trackTitle: "تتبع طلبك",
      orderReceived: "قيد الانتظار",
      confirmed: "تم التأكيد",
      accepted: "تم القبول",
      preparing: "قيد التحضير",
      readyForPickup: "جاهز للاستلام",
      onTheWay: "في الطريق",
      outForDelivery: "في الطريق",
      delivered: "تم التسليم",
      cancelled: "ملغي",
      estimatedPrep: "وقت التحضير المتوقع",
      remainingTime: "المتبقي تقريباً",
      liveTracking: "تتبع مباشر",
      trackingHint: "أدخل رقم الطلب أو قم بإنشاء طلب لمتابعة الحالة.",
      trackingNotFound: "لم نتمكن من العثور على رقم الطلب. تحقق من الرقم أو اتصل بالمطعم.",
      directions: "الاتجاهات",
      openNow: "مفتوح الآن",
      closedNow: "مغلق الآن",
      orderNow: "اطلب الآن",
      addToBasket: "أضف إلى السلة",
      addOns: "إضافات",
      extraGarlic: "صلصة ثوم إضافية",
      extraSpicy: "صلصة حارة إضافية",
      extraCheese: "جبنة إضافية",
      pickupDeliveryInfo: "استلام وتوصيل",
      openingHours: "ساعات العمل"
    }
  },
  de: {
    badges: {
      new: "Neu",
      popular: "Bestseller",
      spicy: "Beliebt",
      offer: "Sonderangebot"
    },
    sectionText: {
      footer: "Shawarma Time Venlo. Online bestellen, mit Karte bezahlen und schnell abholen."
    },
    section: {
      addedToCart: "wurde in den Warenkorb gelegt.",
      checkout: "Checkout",
      trackOrder: "Bestellung verfolgen",
      checkoutEyebrow: "Sicher bestellen",
      checkoutTitle: "Bestellung abschliessen",
      checkoutIntro: "Gib deine Daten ein, waehle die Zahlung und bestaetige die Bestellung.",
      yourOrder: "Deine Bestellung",
      addMore: "Mehr hinzufuegen",
      goToCheckout: "Zum Checkout",
      idealPayment: "Cash / test checkout",
      mollieWallets: "Voruebergehend: Bestellung direkt testen und bei Abholung bezahlen.",
      customerEmail: "E-Mail",
      customerAddress: "Adresse",
      preferredTime: "Gewuenschte Zeit",
      fulfillment: "Abholen oder liefern",
      pickup: "Abholen",
      delivery: "Liefern",
      orderConfirmed: "Bestellung bestaetigt",
      thankYou: "Danke fuer deine Bestellung",
      orderNumber: "Bestellnummer",
      paymentStatus: "Zahlungsstatus",
      pickupDelivery: "Abholung / Lieferung",
      prepTime: "Zubereitungszeit",
      defaultPrepTime: "20-30 min",
      successMessage: "Wir beginnen direkt mit deiner Bestellung. Summe:",
      successOnlineMessage: "Die Zahlung wurde empfangen. Die Bestellung wird automatisch an die Kueche gesendet.",
      onlineOrderNumber: "Online bezahlt",
      backToMenu: "Zurueck zum Menue",
      callRestaurant: "Restaurant anrufen",
      paymentFailed: "Zahlung fehlgeschlagen",
      paymentFailedTitle: "Die Zahlung wurde nicht abgeschlossen",
      paymentFailedText: "Du kannst es erneut versuchen oder anders bezahlen.",
      retryPayment: "Erneut versuchen",
      trackEyebrow: "Bestellstatus",
      trackTitle: "Bestellung verfolgen",
      orderReceived: "Ausstehend",
      confirmed: "Bestaetigt",
      accepted: "Angenommen",
      preparing: "In Vorbereitung",
      readyForPickup: "Bereit zur Abholung",
      onTheWay: "Unterwegs",
      outForDelivery: "Unterwegs",
      delivered: "Geliefert",
      cancelled: "Storniert",
      estimatedPrep: "Geschaetzte Zeit",
      remainingTime: "Noch etwa",
      liveTracking: "Live-Status",
      trackingHint: "Gib deine Bestellnummer ein oder erstelle eine Bestellung, um den Status zu sehen.",
      trackingNotFound: "Diese Bestellnummer wurde nicht gefunden. Bitte pruefe die Nummer oder rufe das Restaurant an.",
      directions: "Route",
      openNow: "Jetzt geoeffnet",
      closedNow: "Jetzt geschlossen",
      orderNow: "Jetzt bestellen",
      addToBasket: "In den Warenkorb",
      addOns: "Extras",
      extraGarlic: "Extra Knoblauchsauce",
      extraSpicy: "Extra scharfe Sauce",
      extraCheese: "Extra Kaese",
      pickupDeliveryInfo: "Abholung und Lieferung",
      openingHours: "Oeffnungszeiten"
    }
  },
  en: {
    nav: {
      home: "Home",
      menu: "Menu",
      offers: "Offers",
      gallery: "Gallery",
      about: "About",
      hours: "Hours",
      contact: "Contact"
    },
    categories: {
      all: "All",
      shawarma: "Shawarma",
      sandwiches: "Sandwiches",
      meals: "Meals",
      appetizers: "Appetizers",
      grilledChicken: "Grilled chicken",
      broastedChicken: "Broasted chicken",
      crispyChicken: "Crispy chicken",
      kapsalon: "Kapsalon",
      falafel: "Falafel",
      sides: "Sides",
      drinks: "Drinks",
      sauces: "Sauces",
      salads: "Salads"
    },
    badges: {
      new: "New",
      popular: "Popular",
      spicy: "Spicy",
      offer: "Special Offer"
    },
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    sectionText: {
      footer: "Shawarma Time Venlo. Order online, pay by card and pick up fast."
    },
    section: {
      whatsapp: "WhatsApp",
      viewMenu: "View Menu",
      addToCart: "Add",
      addedToCart: "was added to your cart.",
      cart: "Cart",
      cartEmpty: "Your cart is empty.",
      checkout: "Checkout",
      trackOrder: "Track",
      checkoutEyebrow: "Secure ordering",
      checkoutTitle: "Complete your order",
      checkoutIntro: "Enter your details, choose payment and confirm your order.",
      yourOrder: "Your order",
      addMore: "Add more",
      goToCheckout: "Go to checkout",
      quantity: "Quantity",
      subtotal: "Total",
      customerName: "Name",
      customerPhone: "Phone",
      customerEmail: "Email",
      customerAddress: "Address",
      preferredTime: "Preferred time",
      fulfillment: "Pickup or delivery",
      pickup: "Pickup",
      delivery: "Delivery",
      orderNotes: "Notes",
      paymentMethod: "Payment method",
      idealPayment: "Cash / test checkout",
      mollieWallets: "Temporary: create the order now and pay at pickup.",
      cashOnDelivery: "Online payment only",
      payAtRestaurant: "Online payment only",
      submitOrder: "Submit order",
      orderSuccess: "Thank you. Your order has been received.",
      mollieRedirect: "You will be redirected to Mollie for secure card payment.",
      mollieUnavailable: "Online card payment is temporarily unavailable. Please call the restaurant.",
      mollieMissingBackend: "Online card payment is temporarily unavailable. Please call the restaurant.",
      mollieMissingConfig: "Online card payment is temporarily unavailable. Please call the restaurant.",
      paymentSuccess: "Payment received. Your order has been sent.",
      paymentCancel: "Online payment was cancelled. You can try again or choose another payment method.",
      orderError: "Could not send order.",
      orderConfirmed: "Order confirmed",
      thankYou: "Thank you for your order",
      orderNumber: "Order number",
      paymentStatus: "Payment status",
      pickupDelivery: "Pickup / delivery",
      prepTime: "Preparation time",
      defaultPrepTime: "20-30 min",
      successMessage: "We will start preparing your order. Total:",
      successOnlineMessage: "Your payment was received. The order will be sent to the kitchen automatically.",
      onlineOrderNumber: "Paid online",
      backToMenu: "Back to menu",
      callRestaurant: "Call restaurant",
      closeCart: "Close cart",
      fullscreen: "Open image",
      close: "Close",
      paymentFailed: "Payment failed",
      paymentFailedTitle: "Payment was not completed",
      paymentFailedText: "You can try again or choose another payment method.",
      retryPayment: "Try again",
      trackEyebrow: "Order status",
      trackTitle: "Track your order",
      orderReceived: "Pending",
      confirmed: "Confirmed",
      accepted: "Accepted",
      preparing: "Preparing",
      readyForPickup: "Ready for Pickup",
      onTheWay: "On The Way",
      outForDelivery: "On The Way",
      delivered: "Delivered",
      cancelled: "Cancelled",
      estimatedPrep: "Estimated preparation",
      remainingTime: "About remaining",
      liveTracking: "Live status",
      trackingHint: "Enter your order number or place an order to see the status.",
      trackingNotFound: "We could not find this order number. Please check it or call the restaurant.",
      directions: "Directions",
      openNow: "Open now",
      closedNow: "Closed now",
      orderNow: "Order now",
      addToBasket: "Add to basket",
      addOns: "Add-ons",
      extraGarlic: "Extra garlic sauce",
      extraSpicy: "Extra spicy sauce",
      extraCheese: "Extra cheese",
      pickupDeliveryInfo: "Pickup and delivery",
      openingHours: "Opening hours",
      address: "Address",
      phone: "Phone"
    }
  }
};
const sectionTextFallbacks = {
  featuredEyebrow: {
    nl: "Populair in Venlo",
    ar: "الأكثر طلباً في فينلو",
    de: "Beliebt in Venlo",
    en: "Popular in Venlo"
  },
  featuredTitle: {
    nl: "Featured dishes",
    ar: "أطباق مميزة",
    de: "Empfohlene Gerichte",
    en: "Featured dishes"
  }
};
const serviceInfo = {
  nl: [
    ["Afhalen", "Bestel online en haal je maaltijd warm op in Venlo."],
    ["Bezorgen", "Vul je adres in bij checkout en wij bevestigen de mogelijkheden."],
    ["Veilig betalen", "Betaal online met creditcard of debitcard via Mollie."]
  ],
  ar: [
    ["استلام", "اطلب أونلاين واستلم وجبتك ساخنة في فينلو."],
    ["توصيل", "أدخل عنوانك عند الدفع وسنؤكد إمكانية التوصيل."],
    ["دفع آمن", "ادفع أونلاين ببطاقة ائتمان أو خصم عبر Mollie."]
  ],
  de: [
    ["Abholen", "Online bestellen und dein Essen warm in Venlo abholen."],
    ["Lieferung", "Adresse im Checkout eingeben, wir bestaetigen die Moeglichkeiten."],
    ["Sicher bezahlen", "Online mit Kreditkarte oder Debitkarte via Mollie bezahlen."]
  ],
  en: [
    ["Pickup", "Order online and pick up your meal hot in Venlo."],
    ["Delivery", "Enter your address at checkout and we will confirm availability."],
    ["Secure payment", "Pay online by credit or debit card via Mollie."]
  ]
};

const textFallbacks = {
  nl: {
    "section.ingredients": "Ingredienten",
    "section.itemNotes": "Opmerking bij dit item",
    "section.itemNotesPlaceholder": "Bijv. zonder ui, extra saus apart...",
    "section.clearCart": "Winkelwagen legen",
    "section.searchMenu": "Zoek in menu",
    "section.searchMenuPlaceholder": "Zoek gerecht, categorie of ingredient...",
    "section.accepted": "Geaccepteerd",
    "section.completed": "Afgerond"
  },
  ar: {
    "section.ingredients": "المكونات",
    "section.itemNotes": "ملاحظة على هذا الصنف",
    "section.itemNotesPlaceholder": "مثلا بدون بصل أو الصلصة جانبا...",
    "section.clearCart": "إفراغ السلة",
    "section.searchMenu": "البحث في القائمة",
    "section.searchMenuPlaceholder": "ابحث عن طبق أو فئة أو مكونات...",
    "section.accepted": "تم القبول",
    "section.completed": "اكتمل"
  },
  de: {
    "section.ingredients": "Zutaten",
    "section.itemNotes": "Notiz zu diesem Artikel",
    "section.itemNotesPlaceholder": "Z.B. ohne Zwiebeln, Sauce separat...",
    "section.clearCart": "Warenkorb leeren",
    "section.searchMenu": "Menue durchsuchen",
    "section.searchMenuPlaceholder": "Gericht, Kategorie oder Zutaten suchen...",
    "section.accepted": "Angenommen",
    "section.completed": "Abgeschlossen"
  },
  en: {
    "section.ingredients": "Ingredients",
    "section.itemNotes": "Item notes",
    "section.itemNotesPlaceholder": "Example: no onions, sauce on the side...",
    "section.clearCart": "Clear cart",
    "section.searchMenu": "Search menu",
    "section.searchMenuPlaceholder": "Search dish, category, or ingredients...",
    "section.accepted": "Accepted",
    "section.completed": "Completed"
  }
};

function t(path) {
  const keys = path.split(".");
  if (keys[0] === "categories" && keys[1]) {
    return localized(data.categoryLabels?.[keys[1]], lang)
      || keys.reduce((value, key) => value?.[key], orderingUi[lang])
      || keys.reduce((value, key) => value?.[key], ui[lang])
      || keys[1];
  }
  return keys.reduce((value, key) => value?.[key], orderingUi[lang])
    || keys.reduce((value, key) => value?.[key], ui[lang])
    || textFallbacks[lang]?.[path]
    || textFallbacks.en[path]
    || path;
}

function appBasePath() {
  return window.location.pathname.startsWith("/shawarmatime") ? "/shawarmatime" : "";
}

function currentRoute() {
  const requestedRoute = new URLSearchParams(window.location.search).get("route");
  if (requestedRoute && routeSections[requestedRoute]) return requestedRoute;
  const base = appBasePath();
  let route = window.location.pathname.slice(base.length).replace(/\/+$/, "") || "/";
  if (!route.startsWith("/")) route = `/${route}`;
  return routeSections[route] ? route : "/";
}

function routeUrl(route) {
  const base = appBasePath();
  return `${base}${route === "/" ? "/" : route}`;
}

function navigateToRoute(route, behavior = "smooth") {
  if (!routeSections[route]) return;
  window.history.pushState({ route }, "", routeUrl(route));
  scrollToRoute(route, behavior);
}

function scrollToRoute(route = currentRoute(), behavior = "smooth") {
  const section = document.getElementById(routeSections[route] || "home");
  if (!section) return;
  section.scrollIntoView({ behavior, block: "start" });
  document.querySelectorAll("[data-route]").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === route);
  });
}

function applyLanguage() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === lang);
  });
  document.querySelectorAll("[data-section-text]").forEach((el) => {
    el.textContent = orderingUi[lang]?.sectionText?.[el.dataset.sectionText]
      || localized(data.sectionText?.[el.dataset.sectionText], lang)
      || localized(sectionTextFallbacks[el.dataset.sectionText], lang)
      || el.textContent;
  });
  renderCart();
}

function phoneHref(phone) {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

function whatsappHref(phone) {
  const normalized = phone.replace(/\D/g, "").replace(/^0/, "31");
  return `https://wa.me/${normalized}?text=${encodeURIComponent(data.settings.whatsappMessage)}`;
}

function renderHero() {
  $("#heroBg").style.backgroundImage = `url("${data.homepage.heroImage}")`;
  $("#heroEyebrow").textContent = localized(data.homepage.eyebrow, lang);
  $("#heroTitle").textContent = localized(data.homepage.title, lang);
  $("#heroSlogan").textContent = localized(data.homepage.slogan, lang);
  $("#heroIntro").textContent = localized(data.homepage.intro, lang);
  $("#heroWhatsapp").href = whatsappHref(data.settings.phone);
  $("#heroWhatsapp").textContent = t("section.whatsapp");
  renderOrderingMeta();
}

function renderOrderingMeta() {
  const root = $("#orderingMeta");
  if (!root) return;
  const openState = isOpenNow(data.settings.hours);
  root.innerHTML = `
    <article class="open-state ${openState.open ? "open" : "closed"}">
      <span>${openState.open ? t("section.openNow") : t("section.closedNow")}</span>
      <strong>${escapeHtml(openState.today || "")}</strong>
    </article>
    <article>
      <span>${t("section.pickupDeliveryInfo")}</span>
      <strong>${t("section.pickup")} / ${t("section.delivery")}</strong>
    </article>
    <article>
      <span>${t("section.phone")}</span>
      <strong>${escapeHtml(data.settings.phone || "")}</strong>
    </article>
  `;
}

function renderDesign() {
  const design = data.design || {};
  const root = document.documentElement;
  root.style.setProperty("--orange", design.accentColor || "#ff7a1a");
  root.style.setProperty("--gold", design.goldColor || "#ffbf58");
  root.style.setProperty("--button", design.buttonColor || design.accentColor || "#ff7a1a");
  root.style.setProperty("--radius", `${Number(design.borderRadius || 8)}px`);
  root.style.setProperty("--hero-overlay", `${Number(design.heroOverlay || 78) / 100}`);
  root.style.setProperty("--site-font", fontStack(design.font));
  document.body.dataset.tone = design.tone || "dark";
  document.body.dataset.cardStyle = design.cardStyle || "glass";
  document.body.classList.toggle("no-glow", design.glow === false);
  document.body.classList.toggle("no-animations", design.animations === false);
  setOptionalBackground("#menu", design.menuBackground);
  setOptionalBackground("#offers", design.offersBackground);
  setOptionalBackground("#gallery", design.galleryBackground);
  setOptionalBackground("#about", design.aboutBackground);
  setOptionalBackground("#contact", design.contactBackground);
  document.querySelectorAll(".brand-mark").forEach((mark) => {
    if (design.logoImage) {
      mark.style.backgroundImage = `url("${design.logoImage}")`;
      mark.style.backgroundSize = "cover";
      mark.style.color = "transparent";
    } else {
      mark.style.backgroundImage = "";
      mark.style.color = "";
    }
  });
}

function fontStack(font) {
  const stacks = {
    Inter: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    Elegant: 'Georgia, "Times New Roman", serif',
    Modern: '"Trebuchet MS", Inter, system-ui, sans-serif',
    Bold: 'Impact, Inter, system-ui, sans-serif'
  };
  return stacks[font] || stacks.Inter;
}

function setOptionalBackground(selector, image) {
  const el = $(selector);
  if (!el) return;
  el.style.backgroundImage = image ? `linear-gradient(rgba(9,5,4,.86), rgba(9,5,4,.9)), url("${image}")` : "";
  el.style.backgroundSize = image ? "cover" : "";
  el.style.backgroundPosition = image ? "center" : "";
}

function renderBanners() {
  $("#banners").innerHTML = data.banners.map((banner) => `
    <article class="ad-banner" style="--banner-image:url('${banner.image}')">
      <div>
        <span class="ad-kicker">Shawarma Time</span>
        <strong>${localized(banner.title, lang)}</strong>
        <span>${localized(banner.text, lang)}</span>
      </div>
    </article>
  `).join("");
}

function renderFeatured() {
  const featured = data.menu
    .filter((item) => ["popular", "offer", "new"].includes(item.badge))
    .slice(0, 4);
  $("#featuredGrid").innerHTML = (featured.length ? featured : data.menu.slice(0, 4)).map(itemCard).join("");
  $("#featuredGrid").querySelectorAll("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", () => addToCart(button.dataset.addCart));
  });
}

function renderServiceStrip() {
  $("#serviceStrip").innerHTML = (serviceInfo[lang] || serviceInfo.nl).map(([title, text], index) => `
    <article>
      <span>${index === 0 ? "01" : index === 1 ? "02" : "03"}</span>
      <strong>${title}</strong>
      <p>${text}</p>
    </article>
  `).join("");
}

function renderCategories() {
  const categories = ["all", ...normalizeCategoryOrder()];
  $("#categoryTabs").innerHTML = categories.map((category) => `
    <button type="button" class="${activeCategory === category ? "active" : ""}" data-category="${category}">
      ${t(`categories.${category}`)}
    </button>
  `).join("");
  $("#categoryTabs").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      renderMenu();
      renderCategories();
    });
  });
}

function renderBadge(badge) {
  if (!badge) return "";
  return `<mark class="badge ${badge}">${t(`badges.${badge}`)}</mark>`;
}

function itemCard(item) {
  const name = localized(item.name, lang);
  const description = localized(item.desc, lang) || menuDescriptionPlaceholder();
  return `
    <article class="food-card" data-product-open="${encodeAttr(item.id)}" tabindex="0" role="button" aria-label="${encodeAttr(name)}">
      <div class="food-image food-card-media">
        <img src="${item.image}" alt="${name}" loading="lazy" decoding="async" />
        ${renderBadge(item.badge)}
      </div>
      <div class="food-card-body">
        <span class="food-category">${t(`categories.${item.category}`)}</span>
        <h3 class="food-title">${name}</h3>
        <p class="food-description">${description}</p>
        <div class="food-card-bottom">
          <strong class="food-price">${item.price}</strong>
          <button class="btn tiny add-button" type="button" data-add-cart="${encodeAttr(item.id)}" aria-label="${encodeAttr(t("section.addToBasket"))}">+</button>
        </div>
      </div>
    </article>
  `;
}

function renderMenu() {
  const availableItems = data.menu.filter(isDisplayableMenuItem).filter(matchesMenuSearch);
  const root = $("#menuGrid");
  if (activeCategory === "all") {
    root.classList.add("grouped");
    const groupedHtml = normalizeCategoryOrder().map((category) => {
      const categoryItems = availableItems.filter((item) => item.category === category);
      if (!categoryItems.length) return "";
      return `
        <section class="menu-category-section" data-menu-category="${category}">
          <header class="menu-category-head">
            <span>${t(`categories.${category}`)}</span>
            <b>${categoryItems.length}</b>
          </header>
          <div class="menu-category-grid">
            ${categoryItems.map(itemCard).join("")}
          </div>
        </section>
      `;
    }).join("");
    root.innerHTML = groupedHtml || `<p class="menu-empty">${menuEmptyText()}</p>`;
  } else {
    root.classList.remove("grouped");
    const items = availableItems.filter((item) => item.category === activeCategory);
    root.innerHTML = items.length ? items.map(itemCard).join("") : `<p class="menu-empty">${menuEmptyText()}</p>`;
  }
  $("#menuGrid").querySelectorAll("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      addToCart(button.dataset.addCart);
    });
  });
  $("#menuGrid").querySelectorAll("[data-product-open]").forEach((card) => {
    card.addEventListener("click", () => openProductModal(card.dataset.productOpen));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openProductModal(card.dataset.productOpen);
    });
  });
}

function matchesMenuSearch(item) {
  const query = menuSearch.trim().toLowerCase();
  if (!query) return true;
  return [
    localized(item.name, lang),
    localized(item.desc, lang),
    localized(item.name, "nl"),
    localized(item.name, "en"),
    localized(item.name, "de"),
    localized(item.name, "ar"),
    localized(item.desc, "nl"),
    localized(item.desc, "en"),
    localized(item.desc, "de"),
    localized(item.desc, "ar"),
    ingredientText(item),
    t(`categories.${item.category}`),
    item.category,
    item.badge
  ].join(" ").toLowerCase().includes(query);
}

function isDisplayableMenuItem(item) {
  if (!item || item.available === false) return false;
  if (!localized(item.name, lang).trim()) return false;
  const value = priceNumber(item.price);
  const isFree = item.free === true || item.isFree === true || item.priceIntent === "free";
  return Number.isFinite(value) && (value > 0 || isFree);
}

function menuDescriptionPlaceholder() {
  return {
    nl: "Vers bereid door Shawarma Time.",
    ar: "يحضر طازجا لدى شاورما تايم.",
    de: "Frisch zubereitet von Shawarma Time.",
    en: "Freshly prepared by Shawarma Time."
  }[lang] || "Freshly prepared by Shawarma Time.";
}

function menuEmptyText() {
  return {
    nl: "Geen geldige menu-items beschikbaar.",
    ar: "لا توجد عناصر قائمة صالحة حاليا.",
    de: "Keine gueltigen Menuepunkte verfuegbar.",
    en: "No valid menu items available."
  }[lang] || "No valid menu items available.";
}

function hasUsableMenuItems(siteData) {
  return Array.isArray(siteData?.menu) && siteData.menu.some(isDisplayableMenuItem);
}

function withUsableMenuData(siteData) {
  if (hasUsableMenuItems(siteData)) return siteData;
  const fallback = loadSiteData();
  console.info("[Menu] Firestore menu has no displayable products; using built-in restaurant menu fallback.");
  return {
    ...siteData,
    menu: fallback.menu,
    categories: fallback.categories,
    categoryLabels: { ...fallback.categoryLabels, ...siteData.categoryLabels }
  };
}

function renderOffers() {
  $("#offerGrid").innerHTML = data.offers.map((offer) => `
    <article class="offer-card">
      <img src="${offer.image}" alt="${localized(offer.name, lang)}" loading="lazy" decoding="async" />
      <div>
        <span>${offer.type}</span>
        <h3>${localized(offer.name, lang)}</h3>
        <p>${localized(offer.desc, lang)}</p>
        <strong>${offer.price}</strong>
      </div>
    </article>
  `).join("");
}

function renderGallery() {
  $("#galleryGrid").innerHTML = data.gallery.map((photo, index) => {
    const item = galleryMenuItem(photo, index);
    if (!item) return "";
    const itemName = localized(item.name, lang);
    return `
    <figure class="gallery-card" data-gallery-item="${encodeAttr(item.id)}" tabindex="0" role="button" aria-label="${encodeAttr(`${t("section.orderNow")} ${itemName}`)}">
      <div class="gallery-button" data-image="${encodeAttr(photo.image)}" data-caption="${encodeAttr(localized(photo.title, lang))}">
        <img src="${photo.image}" alt="${localized(photo.title, lang)}" loading="lazy" decoding="async" />
      </div>
      <figcaption>
        <span>${localized(photo.title, lang)}</span>
        <strong>${itemName}</strong>
        <em>${item.price}</em>
        <button class="btn tiny gallery-order-button" type="button" data-gallery-add="${encodeAttr(item.id)}">${t("section.orderNow")}</button>
      </figcaption>
    </figure>
  `;
  }).join("");

  $("#galleryGrid").querySelectorAll("[data-gallery-item]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("[data-gallery-add]")) return;
      addToCart(card.dataset.galleryItem);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      addToCart(card.dataset.galleryItem);
    });
  });

  $("#galleryGrid").querySelectorAll("[data-gallery-add]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      addToCart(button.dataset.galleryAdd);
    });
  });
}

function galleryMenuItem(photo, index) {
  const linkedId = photo.menuItemId || photo.itemId || photo.menu_item_id || photo.menu_item;
  const linkedItem = linkedId ? data.menu.find((item) => item.id === linkedId) : null;
  if (linkedItem) return linkedItem;

  const title = normalizedText(localized(photo.title, lang));
  const titleMatch = data.menu.find((item) => {
    const names = Object.values(item.name || {}).map(normalizedText);
    return names.some((name) => title.includes(name) || name.includes(title));
  });
  if (titleMatch) return titleMatch;

  const typeMatch = data.menu.find((item) => item.category === photo.type);
  if (typeMatch) return typeMatch;

  return data.menu[index % data.menu.length] || data.menu[0];
}

function normalizedText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function openLightbox(src, caption) {
  $("#lightboxImage").src = src;
  $("#lightboxImage").alt = caption;
  $("#lightboxCaption").textContent = caption;
  $("#lightbox").showModal();
}

function renderHours() {
  const openState = isOpenNow(data.settings.hours);
  $("#hoursList").innerHTML = `
    <p class="open-state ${openState.open ? "open" : "closed"}"><span>${openState.open ? t("section.openNow") : t("section.closedNow")}</span><strong>${openState.today || ""}</strong></p>
  ` + (orderingUi[lang]?.days || ui[lang]?.days || ui.nl.days).map((day, index) => `
    <p><span>${day}</span><strong>${data.settings.hours[index] || ""}</strong></p>
  `).join("");
}

function isOpenNow(hours) {
  const now = new Date();
  const mondayIndex = (now.getDay() + 6) % 7;
  const today = hours?.[mondayIndex] || "";
  const match = today.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return { open: false, today };
  const current = now.getHours() * 60 + now.getMinutes();
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  return { open: current >= start && current <= end, today };
}

function renderReviews() {
  $("#reviewGrid").innerHTML = data.reviews.map((review) => `
    <article class="review-card">
      <div class="stars">★★★★★ <span>${review.rating}</span></div>
      <p>${localized(review.text, lang)}</p>
      <strong>${review.name}</strong>
    </article>
  `).join("");
}

function renderSocials() {
  const socials = [
    ["Instagram", data.settings.instagram],
    ["TikTok", data.settings.tiktok],
    ["Facebook", data.settings.facebook]
  ];
  $("#socialGrid").innerHTML = socials.map(([name, url]) => `
    <a href="${url}" target="_blank" rel="noopener" class="social-card">
      <span>${name.slice(0, 2).toUpperCase()}</span>
      <strong>${name}</strong>
    </a>
  `).join("");
}

function renderContact() {
  $("#contactAddress").textContent = data.settings.address;
  $("#footerAddress").textContent = data.settings.address;
  $("#contactPhone").textContent = data.settings.phone;
  $("#contactPhone").href = phoneHref(data.settings.phone);
  $("#whatsappBtn").href = whatsappHref(data.settings.phone);
  $("#callBtn").href = phoneHref(data.settings.phone);
  $("#floatingWhatsapp").href = whatsappHref(data.settings.phone);
  $("#successPhoneBtn").href = phoneHref(data.settings.phone);
  $("#directionsBtn").href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(data.settings.address)}`;
  const days = ui[lang]?.days || ui.nl.days;
  $("#contactHours").innerHTML = `
    <strong>${t("section.openingHours")}</strong>
    ${days.map((day, index) => `<p><span>${day}</span><b>${escapeHtml(data.settings.hours?.[index] || "")}</b></p>`).join("")}
  `;
}

function openProductModal(itemId) {
  const item = data.menu.find((entry) => entry.id === itemId);
  const modal = $("#productModal");
  if (!item || !modal) return;
  modalProductId = itemId;
  modalQuantity = 1;
  $("#productModalImage").src = item.image;
  $("#productModalImage").alt = localized(item.name, lang);
  $("#productModalCategory").textContent = t(`categories.${item.category}`);
  $("#productModalName").textContent = localized(item.name, lang);
  $("#productModalDesc").textContent = localized(item.desc, lang);
  $("#productModalIngredients").textContent = ingredientText(item);
  $("#productModalPrice").textContent = item.price;
  $("#productQty").textContent = String(modalQuantity);
  const notes = $("#productModalNotes");
  if (notes) notes.value = "";
  modal.querySelectorAll(".product-options input").forEach((input) => {
    input.checked = false;
  });
  modal.showModal();
}

function closeProductModal() {
  const modal = $("#productModal");
  if (modal?.open) modal.close();
}

function changeModalQuantity(delta) {
  modalQuantity = Math.max(1, modalQuantity + delta);
  $("#productQty").textContent = String(modalQuantity);
}

function addModalProductToCart() {
  if (!modalProductId) return;
  const options = [...document.querySelectorAll("#productModal .product-options input:checked")]
    .map((input) => input.value);
  addToCart(modalProductId, modalQuantity, options, $("#productModalNotes")?.value || "");
  closeProductModal();
}

function addToCart(itemId, quantity = 1, options = [], notes = "") {
  const item = data.menu.find((entry) => entry.id === itemId);
  if (!item) return;
  const optionKey = [...options].sort().join(",");
  const normalizedNotes = String(notes || "").trim().slice(0, 300);
  const noteKey = normalizedNotes.toLowerCase();
  const existing = cart.find((entry) => entry.id === itemId && (entry.optionKey || "") === optionKey && (entry.noteKey || "") === noteKey);
  if (existing) existing.quantity += quantity;
  else cart.push({
    id: item.id,
    cartId: `${item.id}-${optionKey || "plain"}-${noteKey || "standard"}`,
    optionKey,
    noteKey,
    name: localized(item.name, lang),
    price: item.price,
    priceValue: priceNumber(item.price),
    image: item.image,
    ingredients: ingredientText(item),
    quantity,
    options,
    notes: normalizedNotes
  });
  saveCart();
  renderCart();
  setStatus(`${localized(item.name, lang)} ${t("section.addedToCart")}`, false);
}

function ingredientText(item) {
  const ingredients = item?.ingredients;
  if (Array.isArray(ingredients)) return ingredients.map((entry) => localized(entry, lang) || entry).filter(Boolean).join(", ");
  const localizedIngredients = localized(ingredients, lang);
  if (localizedIngredients) return localizedIngredients;
  const description = localized(item?.desc, lang);
  return description || menuDescriptionPlaceholder();
}

function loadSavedCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(cartStorageKey) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((item) => item?.id && Number(item.quantity) > 0)
      .map((item) => ({
        ...item,
        quantity: Math.max(1, Math.min(99, Number(item.quantity || 1))),
        priceValue: Number(item.priceValue || priceNumber(item.price)),
        cartId: item.cartId || item.id,
        noteKey: item.noteKey || String(item.notes || "").trim().toLowerCase()
      }));
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  } catch {
    // Cart persistence is helpful, but checkout should still work if storage is unavailable.
  }
}

function priceNumber(price) {
  const normalized = String(price || "").replace(/[^\d,.-]/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

function cartTotal() {
  return cart.reduce((sum, item) => sum + item.priceValue * item.quantity, 0);
}

function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartCount = $("#cartCount");
  if (cartCount) cartCount.textContent = String(count);
  const mobileCartCount = $("#mobileCartCount");
  if (mobileCartCount) mobileCartCount.textContent = String(count);
  $("#cartOpen")?.classList.toggle("has-items", count > 0);
  const title = $("#cartTitle");
  if (title) title.textContent = t("section.cart");
  const list = $("#cartItems");
  if (!list) return;
  if (!cart.length) {
    list.innerHTML = `<p class="cart-empty">${t("section.cartEmpty")}</p>`;
  } else {
    list.innerHTML = cart.map((item) => `
      <article class="cart-item" data-cart-id="${encodeAttr(item.cartId || item.id)}">
        <img src="${item.image}" alt="${encodeAttr(item.name)}" loading="lazy" decoding="async" />
        <div>
          <strong>${item.name}</strong>
          <span>${item.price}</span>
          ${item.options?.length ? `<small>${item.options.map(optionLabel).join(", ")}</small>` : ""}
          ${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ""}
          <div class="quantity-control" aria-label="${t("section.quantity")}">
            <button type="button" data-cart-dec="${encodeAttr(item.cartId || item.id)}">-</button>
            <b>${item.quantity}</b>
            <button type="button" data-cart-inc="${encodeAttr(item.cartId || item.id)}">+</button>
          </div>
        </div>
        <button class="cart-remove" type="button" data-cart-remove="${encodeAttr(item.cartId || item.id)}" aria-label="${t("section.close")}">×</button>
      </article>
    `).join("");
  }
  $("#cartSubtotalLabel").textContent = t("section.subtotal");
  $("#cartSubtotal").textContent = euro(cartTotal());
  $("#goCheckoutBtn").textContent = t("section.goToCheckout");
  $("#goCheckoutBtn").disabled = !cart.length;
  const clearCartBtn = $("#clearCartBtn");
  if (clearCartBtn) {
    clearCartBtn.textContent = t("section.clearCart");
    clearCartBtn.disabled = !cart.length;
  }
  $("#cartClose").setAttribute("aria-label", t("section.closeCart"));
  list.querySelectorAll("[data-cart-inc]").forEach((button) => button.addEventListener("click", () => changeQuantity(button.dataset.cartInc, 1)));
  list.querySelectorAll("[data-cart-dec]").forEach((button) => button.addEventListener("click", () => changeQuantity(button.dataset.cartDec, -1)));
  list.querySelectorAll("[data-cart-remove]").forEach((button) => button.addEventListener("click", () => removeFromCart(button.dataset.cartRemove)));
  renderCheckout();
}

function renderCheckout() {
  const checkoutItems = $("#checkoutItems");
  if (!checkoutItems) return;
  $("#checkoutNameLabel").textContent = t("section.customerName");
  $("#checkoutPhoneLabel").textContent = t("section.customerPhone");
  $("#checkoutEmailLabel").textContent = t("section.customerEmail");
  $("#checkoutAddressLabel").textContent = t("section.customerAddress");
  $("#checkoutTimeLabel").textContent = t("section.preferredTime");
  $("#checkoutFulfillmentLabel").textContent = t("section.fulfillment");
  $("#pickupLabel").textContent = t("section.pickup");
  $("#deliveryLabel").textContent = t("section.delivery");
  $("#checkoutNotesLabel").textContent = t("section.orderNotes");
  $("#checkoutPaymentMethodLabel").textContent = t("section.paymentMethod");
  const onlineAvailable = isMollieReady();
  $("#checkoutMollieLabel").textContent = onlineAvailable ? mollieOnlineLabel() : t("section.idealPayment");
  $("#checkoutMollieNote").textContent = onlineAvailable ? mollieOnlineNote() : t("section.mollieWallets");
  syncPaymentAvailability();
  $("#submitOrderBtn").textContent = t("section.submitOrder");
  $("#checkoutSubtotalLabel").textContent = t("section.subtotal");
  $("#checkoutSubtotal").textContent = euro(cartTotal());
  checkoutItems.innerHTML = cart.length ? cart.map((item) => `
    <article class="checkout-item">
      <img src="${item.image}" alt="${encodeAttr(item.name)}" loading="lazy" decoding="async" />
      <div>
        <strong>${item.name}</strong>
        <span>${item.quantity} x ${item.price}</span>
        ${item.options?.length ? `<small>${item.options.map(optionLabel).join(", ")}</small>` : ""}
        ${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ""}
      </div>
      <b>${euro(item.priceValue * item.quantity)}</b>
    </article>
  `).join("") : `<p class="cart-empty">${t("section.cartEmpty")}</p>`;
}

function syncPaymentAvailability() {
  const mollieInput = document.querySelector('input[name="paymentMethod"][value="cash"], input[name="paymentMethod"][value="mollie"]');
  const mollieOption = $("#molliePaymentOption") || mollieInput?.closest("label");
  const onlineAvailable = isMollieReady();
  if (mollieInput) {
    mollieInput.value = onlineAvailable ? "mollie" : "cash";
    mollieInput.disabled = false;
    mollieInput.checked = true;
  }
  if (mollieOption) mollieOption.classList.remove("disabled");
  if ($("#submitOrderBtn")) $("#submitOrderBtn").disabled = false;
}

function normalizePaymentMethod(value) {
  if (restaurantCheckoutOnly) return "cash";
  return isMollieReady() && value === "mollie" ? "mollie" : "cash";
}

function isMollieReady() {
  if (restaurantCheckoutOnly) return false;
  return Boolean(paymentConfig.onlinePaymentsEnabled && paymentConfig.molliePaymentEndpoint && mollieReady);
}

function mollieOnlineLabel() {
  return {
    nl: "Online betalen met Mollie",
    ar: "الدفع أونلاين عبر Mollie",
    de: "Online mit Mollie bezahlen",
    en: "Pay online with Mollie"
  }[lang] || "Pay online with Mollie";
}

function mollieOnlineNote() {
  return {
    nl: "Veilig betalen met iDEAL, kaart of beschikbare wallets.",
    ar: "ادفع بأمان بالبطاقة أو المحافظ المتاحة.",
    de: "Sicher mit iDEAL, Karte oder verfuegbaren Wallets bezahlen.",
    en: "Secure payment with iDEAL, card or available wallets."
  }[lang] || "Secure payment with Mollie.";
}

function euro(value) {
  return new Intl.NumberFormat(lang === "de" ? "de-DE" : "nl-NL", { style: "currency", currency: "EUR" }).format(value);
}

function optionLabel(option) {
  const labels = {
    garlic: t("section.extraGarlic"),
    spicy: t("section.extraSpicy"),
    cheese: t("section.extraCheese")
  };
  return labels[option] || option;
}

function changeQuantity(cartId, delta) {
  cart = cart.map((item) => (item.cartId || item.id) === cartId ? { ...item, quantity: item.quantity + delta } : item)
    .filter((item) => item.quantity > 0);
  saveCart();
  renderCart();
}

function removeFromCart(cartId) {
  cart = cart.filter((item) => (item.cartId || item.id) !== cartId);
  saveCart();
  renderCart();
}

function clearCart() {
  cart = [];
  saveCart();
  renderCart();
}

function openCart() {
  $("#cartDrawer").classList.add("open");
  $("#cartBackdrop").classList.add("open");
}

function closeCart() {
  $("#cartDrawer").classList.remove("open");
  $("#cartBackdrop").classList.remove("open");
}

async function submitCart(event) {
  event.preventDefault();
  if (!cart.length) {
    setStatus(t("section.cartEmpty"), true);
    return;
  }
  const cartForm = event.currentTarget;
  const form = new FormData(cartForm);
  const paymentMethod = normalizePaymentMethod(form.get("paymentMethod"));
  setStatus(t("section.submitOrder"), false);
  $("#submitOrderBtn").disabled = true;
  try {
    const orderPayload = {
      items: cart,
      customer: {
        name: form.get("name"),
        phone: form.get("phone"),
        email: form.get("email"),
        address: form.get("address"),
        fulfillment: form.get("fulfillment"),
        preferredTime: form.get("preferredTime"),
        notes: form.get("notes")
      },
      paymentMethod
    };
    orderLog("Order payload created", {
      itemCount: orderPayload.items.length,
      paymentMethod,
      fulfillment: orderPayload.customer.fulfillment,
      customerPhone: orderPayload.customer.phone
    });
    if (paymentMethod === "mollie") {
      setStatus(t("section.mollieRedirect"), false);
      await redirectToMolliePayment(orderPayload);
      return;
    }
    setStatus(t("section.submitOrder"), false);
    const savedOrder = await createFirebaseOrder({
      ...orderPayload,
      subtotal: cartTotal()
    });
    showOrderSuccess(savedOrder, cartTotal(), paymentMethod, orderPayload);
    cart = [];
    saveCart();
    renderCart();
  } catch (error) {
    orderLog("Order submission failed", { message: error?.message || String(error) });
    setStatus(customerSafeErrorMessage(error, paymentMethod), true);
  } finally {
    $("#submitOrderBtn").disabled = false;
  }
}

function showOrderSuccess(savedOrder, total, paymentMethod, orderPayload) {
  const orderId = typeof savedOrder === "string" ? savedOrder : savedOrder?.id;
  const orderNumber = typeof savedOrder === "string" ? formatOrderNumber(savedOrder) : savedOrder?.orderNumber || formatOrderNumber(orderId);
  const successData = {
    orderId,
    orderNumber,
    prepTime: t("section.defaultPrepTime"),
    total,
    paymentMethod,
    paymentStatus: savedOrder?.paymentStatus || "pending",
    customer: orderPayload.customer,
    items: orderPayload.items,
    status: savedOrder?.status || "new",
    orderStatus: savedOrder?.orderStatus || "new",
    createdAt: new Date().toISOString()
  };
  sessionStorage.setItem("shawarma-time-last-order", JSON.stringify(successData));
  renderSuccess(successData);
  closeCart();
  navigateToRoute("/success", "auto");
  setStatus(t("section.orderSuccess"), false);
}

function renderSuccess(successData = getLastOrder()) {
  const number = successData?.orderNumber || "-";
  $("#successOrderNumber").textContent = number;
  $("#successPaymentStatus").textContent = paymentStatusText(successData?.paymentStatus);
  $("#successPrepTime").textContent = successData?.prepTime || t("section.defaultPrepTime");
  $("#successFulfillment").textContent = fulfillmentText(successData?.customer?.fulfillment);
  $("#successSummary").innerHTML = successData?.items?.length ? `
    <strong>${t("section.yourOrder")}</strong>
    ${successData.items.map((item) => `<p><span>${Number(item.quantity || 1)}x ${escapeHtml(item.name || "")}</span><b>${escapeHtml(item.price || "")}</b></p>`).join("")}
  ` : "";
  $("#successMessage").textContent = number === "-"
    ? t("section.successOnlineMessage")
    : `${t("section.successMessage")} ${euro(Number(successData.total || 0))}`;
  renderTracking(successData);
}

function paymentStatusText(status) {
  const labels = {
    paid: lang === "ar" ? "مدفوع" : lang === "de" ? "Bezahlt" : lang === "en" ? "Paid" : "Betaald",
    pending: lang === "ar" ? "قيد الانتظار" : lang === "de" ? "Ausstehend" : lang === "en" ? "Pending" : "In afwachting",
    unpaid: lang === "ar" ? "غير مدفوع" : lang === "de" ? "Nicht bezahlt" : lang === "en" ? "Unpaid" : "Niet betaald"
  };
  return labels[status] || labels.unpaid;
}

function fulfillmentText(value) {
  return value === "delivery" ? t("section.delivery") : t("section.pickup");
}

function renderTracking(order = getLastOrder()) {
  const root = $("#trackSteps");
  if (!root) return;
  const current = normalizeOrderStatus(order?.orderStatus || order?.status || "pending");
  const fulfillment = order?.customer?.fulfillment || "pickup";
  const statuses = trackingStatuses(fulfillment, current);
  const index = statuses.indexOf(current);
  const labels = {
    pending: t("section.orderReceived"),
    new: t("section.orderReceived"),
    confirmed: t("section.confirmed"),
    accepted: t("section.accepted"),
    preparing: t("section.preparing"),
    ready: t("section.readyForPickup"),
    on_the_way: t("section.onTheWay"),
    out_for_delivery: t("section.onTheWay"),
    delivered: t("section.delivered"),
    completed: t("section.completed"),
    cancelled: t("section.cancelled")
  };
  root.innerHTML = `
    <div class="track-summary">
      <p><span>${t("section.orderNumber")}</span><strong>${escapeHtml(order?.orderNumber || "-")}</strong></p>
      <p><span>${t("section.liveTracking")}</span><strong>${labels[current] || labels.pending}</strong></p>
      <p><span>${t("section.estimatedPrep")}</span><strong>${estimatedPrepTime(order)}</strong></p>
      <p><span>${t("section.remainingTime")}</span><strong>${remainingTime(order, current)}</strong></p>
    </div>
    <div class="track-timeline">
      ${statuses.map((status, statusIndex) => `
        <div class="track-step ${statusIndex <= Math.max(index, 0) ? "active" : ""} ${status === current ? "current" : ""}">
          <span></span>
          <b>${labels[status]}</b>
        </div>
      `).join("")}
    </div>
  `;
  $("#trackNote").textContent = order?.orderNumber
    ? `${t("section.pickupDelivery")}: ${fulfillmentText(fulfillment)}`
    : t("section.trackingHint");
}

function trackingStatuses(fulfillment, current) {
  if (current === "cancelled") return ["pending", "accepted", "preparing", "cancelled"];
  return ["pending", "accepted", "preparing", "ready", "completed"];
}

function estimatedPrepTime(order) {
  return order?.prepTime || t("section.defaultPrepTime");
}

function remainingTime(order, current) {
  if (!order?.orderNumber) return "-";
  if (["ready", "completed", "on_the_way", "delivered", "cancelled"].includes(current)) return "0 min";
  const created = orderTimestamp(order.createdAt);
  const totalMinutes = order?.customer?.fulfillment === "delivery" ? 40 : 30;
  const elapsed = Math.max(0, Math.floor((Date.now() - created.getTime()) / 60000));
  return `${Math.max(0, totalMinutes - elapsed)} min`;
}

function normalizeOrderStatus(status) {
  const value = String(status || "pending");
  const aliases = {
    new: "pending",
    confirmed: "accepted",
    out_for_delivery: "ready",
    on_the_way: "ready",
    delivered: "completed"
  };
  return aliases[value] || value;
}

function orderTimestamp(value) {
  if (value?.toDate) return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getLastOrder() {
  try {
    return JSON.parse(sessionStorage.getItem("shawarma-time-last-order") || "null");
  } catch {
    return null;
  }
}

async function startOrderTracking(orderNumber) {
  const requested = String(orderNumber || "").trim().toUpperCase();
  if (!requested) {
    renderTracking(null);
    return;
  }
  if (unsubscribeTrackedOrder) unsubscribeTrackedOrder();
  $("#trackNote").textContent = t("section.submitOrder");
  unsubscribeTrackedOrder = await subscribeFirebaseOrderByNumber(requested, (order) => {
    if (!order) {
      renderTracking(null);
      $("#trackNote").textContent = t("section.trackingNotFound");
      return;
    }
    const trackedOrder = {
      ...order,
      status: order.orderStatus || order.status || "pending",
      orderStatus: order.orderStatus || order.status || "pending",
      orderNumber: order.orderNumber || requested
    };
    sessionStorage.setItem("shawarma-time-last-order", JSON.stringify({
      ...trackedOrder,
      createdAt: orderTimestamp(order.createdAt).toISOString()
    }));
    renderTracking(trackedOrder);
  }, () => {
    renderTracking(null);
    $("#trackNote").textContent = t("section.trackingNotFound");
  });
}

function formatOrderNumber(orderId) {
  return `ST-${String(orderId || Date.now()).replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase()}`;
}

async function redirectToMolliePayment(orderPayload) {
  const endpoint = paymentConfig.molliePaymentEndpoint;
  if (!endpoint) throw new Error(t("section.mollieUnavailable"));
  await assertMollieReady();
  const total = cartTotal();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      order: {
        ...orderPayload,
        paymentMethod: "mollie",
        subtotal: cartTotal(),
        currency: "EUR"
      },
      redirectUrl: new URL(`${routeUrl("/success")}?payment=success`, window.location.origin).toString(),
      cancelUrl: new URL(`${routeUrl("/failed")}?payment=failed`, window.location.origin).toString()
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.url) {
    throw new Error(payload.error || t("section.mollieUnavailable"));
  }
  const orderNumber = payload.orderNumber || formatOrderNumber(payload.checkoutId || payload.paymentId);
  sessionStorage.setItem("shawarma-time-pending-online-order", JSON.stringify({
    checkoutId: payload.checkoutId || "",
    paymentId: payload.paymentId || "",
    orderNumber,
    prepTime: t("section.defaultPrepTime"),
    total,
    paymentMethod: "mollie",
    paymentStatus: "pending",
    customer: orderPayload.customer,
    items: orderPayload.items,
    status: "pending",
    orderStatus: "pending",
    createdAt: new Date().toISOString()
  }));
  window.location.href = payload.url;
}

async function assertMollieReady() {
  const endpoint = paymentConfig.mollieConfigStatusEndpoint;
  if (!endpoint) return;
  let response;
  try {
    response = await fetch(endpoint, { headers: { accept: "application/json" } });
  } catch {
    throw new Error(t("section.mollieMissingBackend"));
  }
  if (!response.ok) throw new Error(t("section.mollieMissingBackend"));
  const status = await response.json().catch(() => null);
  if (!status?.configured) {
    throw new Error(t("section.mollieMissingConfig"));
  }
}

async function refreshMollieReadiness() {
  if (restaurantCheckoutOnly || !paymentConfig.onlinePaymentsEnabled || !paymentConfig.mollieConfigStatusEndpoint) {
    mollieReady = false;
    renderCheckout();
    return;
  }
  try {
    const response = await fetch(paymentConfig.mollieConfigStatusEndpoint, { headers: { accept: "application/json" } });
    const status = response.ok ? await response.json().catch(() => null) : null;
    mollieReady = Boolean(status?.configured);
  } catch {
    mollieReady = false;
  }
  renderCheckout();
}

function setupReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

function render() {
  renderDesign();
  applyLanguage();
  renderHero();
  renderCategories();
  renderMenu();
  renderContact();
  renderCheckout();
  renderSuccess();
  renderTracking();
  renderPaymentReturnMessage();
  window.requestAnimationFrame(() => scrollToRoute(currentRoute(), "auto"));
  window.setTimeout(() => scrollToRoute(currentRoute(), "auto"), 120);
}

function renderPaymentReturnMessage() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  if (payment === "success") {
    const pending = getPendingOnlineOrder();
    const successData = pending || {
      orderNumber: t("section.onlineOrderNumber"),
      prepTime: t("section.defaultPrepTime"),
      paymentStatus: "paid",
      customer: { fulfillment: "pickup" },
      status: "pending",
      orderStatus: "pending"
    };
    successData.paymentStatus = "paid";
    successData.status = normalizeOrderStatus(successData.orderStatus || successData.status || "pending");
    successData.orderStatus = successData.status;
    sessionStorage.setItem("shawarma-time-last-order", JSON.stringify(successData));
    sessionStorage.removeItem("shawarma-time-pending-online-order");
    cart = [];
    saveCart();
    renderCart();
    renderSuccess(successData);
    setStatus(t("section.paymentSuccess"), false);
  }
  if (payment === "cancel") setStatus(t("section.paymentCancel"), true);
  if (payment === "failed") setStatus(t("section.paymentCancel"), true);
}

function getPendingOnlineOrder() {
  try {
    return JSON.parse(sessionStorage.getItem("shawarma-time-pending-online-order") || "null");
  } catch {
    return null;
  }
}

async function refreshDataAndRender() {
  try {
    data = withUsableMenuData(await fetchPublicSiteData());
    setStatus("", false);
  } catch {
    data = withUsableMenuData(loadSiteData());
    setStatus("", false);
  }
  render();
}

async function setupRealtime() {
  unsubscribeRealtime = await subscribeToPublicUpdates((updatedData) => {
    if (updatedData) {
      data = withUsableMenuData(updatedData);
      render();
      return;
    }
    refreshDataAndRender();
  });
}

function setStatus(message, isError) {
  const status = $("#siteStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", Boolean(isError));
  status.classList.toggle("visible", Boolean(message));
}

function customerSafeErrorMessage(error, paymentMethod = "") {
  const message = String(error?.message || "");
  if (paymentMethod === "mollie") return t("section.mollieUnavailable");
  if (paymentMethod === "stripe") return t("section.stripeUnavailable");
  if (/missing|configured|config|api[_ -]?key|secret|service[_ -]?account|serverless|netlify|firebase|supabase|stack|referenceerror|typeerror|syntaxerror/i.test(message)) {
    return t("section.orderError");
  }
  return message || t("section.orderError");
}

function encodeAttr(value) {
  return String(value).replace(/"/g, "&quot;");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

document.querySelectorAll("[data-lang]").forEach((button) => {
  button.addEventListener("click", () => {
    lang = button.dataset.lang;
    localStorage.setItem("shawarma-time-lang", lang);
    render();
  });
});

document.querySelectorAll("[data-route]").forEach((link) => {
  link.addEventListener("click", (event) => {
    const route = link.dataset.route || "/";
  if (!routeSections[route]) return;
  event.preventDefault();
    navigateToRoute(route);
    $(".main-nav")?.classList.remove("open");
    $(".nav-toggle")?.setAttribute("aria-expanded", "false");
  });
});

window.addEventListener("popstate", () => scrollToRoute(currentRoute()));

$(".nav-toggle").addEventListener("click", () => {
  const nav = $(".main-nav");
  const expanded = nav.classList.toggle("open");
  $(".nav-toggle").setAttribute("aria-expanded", String(expanded));
});

$(".lightbox-close").addEventListener("click", () => $("#lightbox").close());
$("#lightbox").addEventListener("click", (event) => {
  if (event.target.id === "lightbox") $("#lightbox").close();
});

$("#cartOpen").addEventListener("click", openCart);
$("#mobileCartBtn").addEventListener("click", openCart);
$("#cartClose").addEventListener("click", closeCart);
$("#cartBackdrop").addEventListener("click", closeCart);
$("#clearCartBtn")?.addEventListener("click", clearCart);
$("#productModalClose")?.addEventListener("click", closeProductModal);
$("#productQtyDec")?.addEventListener("click", () => changeModalQuantity(-1));
$("#productQtyInc")?.addEventListener("click", () => changeModalQuantity(1));
$("#productAddBtn")?.addEventListener("click", addModalProductToCart);
$("#productModal")?.addEventListener("click", (event) => {
  if (event.target.id === "productModal") closeProductModal();
});
$("#menuSearch")?.addEventListener("input", (event) => {
  menuSearch = event.target.value || "";
  renderMenu();
});
$("#goCheckoutBtn").addEventListener("click", () => {
  if (!cart.length) {
    setStatus(t("section.cartEmpty"), true);
    return;
  }
  closeCart();
  navigateToRoute("/checkout");
});
$("#checkoutForm").addEventListener("submit", submitCart);
$("#trackForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = new FormData(event.currentTarget).get("orderNumber");
  const lastOrder = getLastOrder();
  const requested = String(value || "").trim().toUpperCase();
  if (lastOrder?.orderNumber && requested === lastOrder.orderNumber.toUpperCase()) {
    renderTracking(lastOrder);
  }
  startOrderTracking(requested);
});

if (document.readyState === "complete") {
  document.body.classList.add("loaded");
} else {
window.addEventListener("load", () => document.body.classList.add("loaded"), { once: true });
}
window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin || event.data?.type !== "shawarma-preview") return;
  data = event.data.data;
  renderDesign();
  applyLanguage();
  renderHero();
  renderCategories();
  renderMenu();
  renderContact();
});
setupReveal();
refreshDataAndRender();
setupRealtime();
refreshMollieReadiness();
