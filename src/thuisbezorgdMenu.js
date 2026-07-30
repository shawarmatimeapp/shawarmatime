import { localized, loadSiteData, normalizeCategoryOrder, ui } from "./data.js";
import { fetchPublicSiteData, subscribeToPublicUpdates } from "./publicApi.js";

const languages = ["ar", "nl", "en", "de"];
const langKey = "shawarma-time-thuisbezorgd-lang";
let lang = localStorage.getItem(langKey) || "nl";
if (!languages.includes(lang)) lang = "nl";

let siteData = loadSiteData();
let unsubscribe = null;

const text = {
  nl: {
    eyebrow: "Thuisbezorgd catalogus",
    title: "Menu review pagina",
    intro: "Een live catalogus van Shawarma Time producten voor controle door Thuisbezorgd.",
    downloadPdf: "Download menu als PDF",
    downloadCsv: "Download menu als CSV",
    loading: "Menu laden...",
    live: "Live menu geladen. Wijzigingen uit het admin paneel verschijnen automatisch.",
    error: "Menu kon niet live worden geladen. Controleer de verbinding.",
    available: "Beschikbaar",
    unavailable: "Niet beschikbaar",
    empty: "Geen producten in deze categorie.",
    category: "Categorie",
    name: "Productnaam",
    description: "Beschrijving",
    price: "Prijs",
    imageUrl: "Afbeelding URL",
    availability: "Beschikbaarheid",
    printTitle: "Shawarma Time - Thuisbezorgd menu"
  },
  ar: {
    eyebrow: "كتالوج Thuisbezorgd",
    title: "صفحة مراجعة القائمة",
    intro: "كتالوج مباشر لمنتجات شاورما تايم لمراجعة فريق Thuisbezorgd.",
    downloadPdf: "تنزيل القائمة كملف PDF",
    downloadCsv: "تنزيل القائمة كملف CSV",
    loading: "جار تحميل القائمة...",
    live: "تم تحميل القائمة المباشرة. تظهر تغييرات لوحة الإدارة تلقائياً.",
    error: "تعذر تحميل القائمة المباشرة. تحقق من الاتصال.",
    available: "متاح",
    unavailable: "غير متاح",
    empty: "لا توجد منتجات في هذا التصنيف.",
    category: "التصنيف",
    name: "اسم المنتج",
    description: "الوصف",
    price: "السعر",
    imageUrl: "رابط الصورة",
    availability: "التوفر",
    printTitle: "شاورما تايم - قائمة Thuisbezorgd"
  },
  en: {
    eyebrow: "Thuisbezorgd catalogue",
    title: "Menu review page",
    intro: "A live catalogue of Shawarma Time products for Thuisbezorgd staff review.",
    downloadPdf: "Download menu as PDF",
    downloadCsv: "Download menu as CSV",
    loading: "Loading menu...",
    live: "Live menu loaded. Admin panel changes appear automatically.",
    error: "The live menu could not be loaded. Check the connection.",
    available: "Available",
    unavailable: "Unavailable",
    empty: "No products in this category.",
    category: "Category",
    name: "Product name",
    description: "Description",
    price: "Price",
    imageUrl: "Image URL",
    availability: "Availability",
    printTitle: "Shawarma Time - Thuisbezorgd menu"
  },
  de: {
    eyebrow: "Thuisbezorgd Katalog",
    title: "Menü-Prüfseite",
    intro: "Ein Live-Katalog der Shawarma Time Produkte zur Prüfung durch Thuisbezorgd.",
    downloadPdf: "Menü als PDF herunterladen",
    downloadCsv: "Menü als CSV herunterladen",
    loading: "Menü wird geladen...",
    live: "Live-Menü geladen. Änderungen aus dem Adminbereich erscheinen automatisch.",
    error: "Das Live-Menü konnte nicht geladen werden. Verbindung prüfen.",
    available: "Verfügbar",
    unavailable: "Nicht verfügbar",
    empty: "Keine Produkte in dieser Kategorie.",
    category: "Kategorie",
    name: "Produktname",
    description: "Beschreibung",
    price: "Preis",
    imageUrl: "Bild-URL",
    availability: "Verfügbarkeit",
    printTitle: "Shawarma Time - Thuisbezorgd Menü"
  }
};

const $ = (selector) => document.querySelector(selector);
const t = (key) => text[lang]?.[key] || text.nl[key] || key;

function setLanguage(nextLang) {
  lang = languages.includes(nextLang) ? nextLang : "nl";
  localStorage.setItem(langKey, lang);
  applyLanguage();
  renderMenu();
}

function applyLanguage() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === lang);
  });
}

function categoryLabel(category) {
  return localized(siteData.categoryLabels?.[category], lang)
    || ui[lang]?.categories?.[category]
    || ui.nl.categories[category]
    || category;
}

function menuRows() {
  return (siteData.menu || []).map((item) => ({
    item,
    category: categoryLabel(item.category),
    name: localized(item.name, lang).trim(),
    description: localized(item.desc, lang).trim(),
    price: String(item.price || "").trim(),
    image: String(item.image || "").trim(),
    available: item.available !== false
  })).filter((row) => row.name);
}

function renderMenu() {
  const root = $("#menuRoot");
  const rows = menuRows();
  const rowsByCategory = new Map();
  rows.forEach((row) => {
    const list = rowsByCategory.get(row.item.category) || [];
    list.push(row);
    rowsByCategory.set(row.item.category, list);
  });

  root.innerHTML = normalizeCategoryOrder().map((category) => {
    const categoryRows = rowsByCategory.get(category) || [];
    return `
      <section class="tb-category">
        <header class="tb-category-head">
          <h2>${escapeHtml(categoryLabel(category))}</h2>
          <span class="tb-count">${categoryRows.length}</span>
        </header>
        ${categoryRows.length ? `
          <div class="tb-grid">
            ${categoryRows.map(renderCard).join("")}
          </div>
        ` : `<p class="tb-empty">${escapeHtml(t("empty"))}</p>`}
      </section>
    `;
  }).join("");
}

function renderCard(row) {
  const availability = row.available ? t("available") : t("unavailable");
  return `
    <article class="tb-card">
      <div class="tb-media">
        ${row.image ? `<img src="${escapeAttr(row.image)}" alt="${escapeAttr(row.name)}" loading="lazy" decoding="async" />` : ""}
      </div>
      <div class="tb-card-body">
        <h3>${escapeHtml(row.name)}</h3>
        <p class="tb-desc">${escapeHtml(row.description || " ")}</p>
        <div></div>
        <div class="tb-meta">
          <strong class="tb-price">${escapeHtml(row.price)}</strong>
          <span class="tb-availability ${row.available ? "" : "off"}">${escapeHtml(availability)}</span>
        </div>
      </div>
    </article>
  `;
}

function setStatus(message, isError = false) {
  const status = $("#statusMessage");
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function downloadCsv() {
  const headers = [t("category"), t("name"), t("description"), t("price"), t("imageUrl"), t("availability")];
  const body = menuRows().map((row) => [
    row.category,
    row.name,
    row.description,
    row.price,
    row.image,
    row.available ? t("available") : t("unavailable")
  ]);
  const csv = [headers, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `shawarma-time-thuisbezorgd-menu-${lang}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function downloadPdf() {
  const rows = menuRows();
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.write(printDocument(rows));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function printDocument(rows) {
  return `<!DOCTYPE html>
    <html lang="${escapeAttr(lang)}" dir="${lang === "ar" ? "rtl" : "ltr"}">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(t("printTitle"))}</title>
        <style>
          body { font-family: Arial, Tahoma, sans-serif; color: #111; margin: 24px; }
          h1 { margin: 0 0 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #ddd; padding: 7px; vertical-align: top; text-align: start; }
          th { background: #f3f3f3; }
          img { width: 54px; height: 54px; object-fit: contain; }
          a { color: #111; word-break: break-all; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(t("printTitle"))}</h1>
        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t("category"))}</th>
              <th>${escapeHtml(t("name"))}</th>
              <th>${escapeHtml(t("description"))}</th>
              <th>${escapeHtml(t("price"))}</th>
              <th>${escapeHtml(t("imageUrl"))}</th>
              <th>${escapeHtml(t("availability"))}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${escapeHtml(row.category)}</td>
                <td>${escapeHtml(row.name)}</td>
                <td>${escapeHtml(row.description)}</td>
                <td>${escapeHtml(row.price)}</td>
                <td>${row.image ? `<img src="${escapeAttr(row.image)}" alt="" /><br /><a href="${escapeAttr(row.image)}">${escapeHtml(row.image)}</a>` : ""}</td>
                <td>${escapeHtml(row.available ? t("available") : t("unavailable"))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body>
    </html>`;
}

function csvCell(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

async function init() {
  applyLanguage();
  renderMenu();
  setStatus(t("loading"));

  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.lang));
  });
  $("#downloadCsvBtn").addEventListener("click", downloadCsv);
  $("#downloadPdfBtn").addEventListener("click", downloadPdf);

  try {
    siteData = await fetchPublicSiteData();
    renderMenu();
    setStatus(t("live"));
    unsubscribe = await subscribeToPublicUpdates((nextData) => {
      siteData = nextData;
      renderMenu();
      setStatus(t("live"));
    });
  } catch (error) {
    console.error("[ThuisbezorgdMenu] Failed to load live menu", error);
    setStatus(t("error"), true);
  }
}

window.addEventListener("beforeunload", () => {
  if (unsubscribe) unsubscribe();
});

init();
