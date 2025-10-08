const countrySelect = document.getElementById("countrySelect");
const countryInput = document.getElementById("countryInput");
const yearInput = document.getElementById("yearInput");
const monthSelect = document.getElementById("monthSelect");
const fetchBtn = document.getElementById("fetchBtn");
const clearCacheBtn = document.getElementById("clearCacheBtn");

const loading = document.getElementById("loading");
const error = document.getElementById("error");
const holidaysSection = document.getElementById("holidaysSection");
const resultsContainer = document.getElementById("resultsContainer");

const helpBtn = document.getElementById("helpBtn");
const aboutBtn = document.getElementById("aboutBtn");
const overlay = document.getElementById("overlay");

const API_BASE = "https://date.nager.at/api/v3";
const COUNTRIES_KEY = "nh_countries_v1";
const CACHE_PREFIX = "nh_holidays_"; // nh_holidays_<CODE>_<YEAR>
const CURRENT_YEAR = new Date().getFullYear();

/* helper month names */
const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/* small utility functions */

function qLog(...args) {
  console.log(...args);
}

function setLoading(on) {
  if (!loading) return;
  if (on) loading.classList.remove("hidden");
  else loading.classList.add("hidden");
}

function setError(message) {
  if (!error) return;
  error.classList.remove("hidden");
  error.innerHTML = `<p>${
    message || "Sorry, we couldn't load the holidays. Please try again."
  }</p>`;
}

function clearError() {
  if (!error) return;
  error.classList.add("hidden");
  error.innerHTML = "";
}

function hideResults() {
  if (!holidaysSection) return;
  holidaysSection.classList.add("hidden");
  resultsContainer.innerHTML = "";
}

/* cache helpers */
function saveCountriesToCache(data) {
  try {
    localStorage.setItem(
      COUNTRIES_KEY,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch (e) {
    /* ignore */
  }
}
function loadCountriesFromCache(maxAgeMs = 24 * 60 * 60 * 1000) {
  // 24h
  try {
    const raw = localStorage.getItem(COUNTRIES_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj.ts || Date.now() - obj.ts > maxAgeMs) return null;
    return obj.data;
  } catch (e) {
    return null;
  }
}
function cacheHolidays(code, year, holidays) {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${code}_${year}`,
      JSON.stringify({ ts: Date.now(), holidays })
    );
  } catch (e) {
    /* ignore */
  }
}
function loadCachedHolidays(code, year, maxAgeMs = 6 * 60 * 60 * 1000) {
  // 6 hours
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${code}_${year}`);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj.ts || Date.now() - obj.ts > maxAgeMs) return null;
    return obj.holidays;
  } catch (e) {
    return null;
  }
}

/* populate country dropdown (tries cache first) */
async function loadCountries() {
  if (!countrySelect) return;
  // try cached
  const cached = loadCountriesFromCache();
  if (cached) {
    populateCountrySelect(cached);
    return;
  }

  // fetch available countries
  try {
    const res = await fetch(`${API_BASE}/AvailableCountries`);
    if (!res.ok) throw new Error("Failed to load countries");
    const data = await res.json();
    saveCountriesToCache(data);
    populateCountrySelect(data);
  } catch (err) {
    qLog("Error loading countries:", err);
    // leave existing static options in place and show a gentle console warning
  }
}

function populateCountrySelect(list) {
  if (!countrySelect) return;
  // keep an initial placeholder
  countrySelect.innerHTML = `<option value="">Choose a country...</option>`;
  // sort by name
  list.sort((a, b) => a.name.localeCompare(b.name));
  list.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.countryCode;
    opt.textContent = `${c.name} (${c.countryCode})`;
    countrySelect.appendChild(opt);
  });

  // try to preselect user's locale (if present)
  const locale = (navigator.language || "").split("-")[1];
  if (locale) {
    const found = [...countrySelect.options].find(
      (o) => o.value === locale.toUpperCase()
    );
    if (found) found.selected = true;
  }
}

/* utility: format date in readable form */
function formatDate(iso) {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return iso;
  }
}

/* create a card element for a holiday (we will inject into table wrapper inside a row cell, so visual layout preserved) */
function createHolidayCard(h, countryCode) {
  const card = document.createElement("div");
  card.className = "card"; // reuse your existing .card look for a card-like appearance
  card.style.background =
    "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.9))";
  card.style.borderLeft = "6px solid rgba(77,150,255,0.9)";
  card.style.margin = "10px 0";
  card.style.padding = "14px";
  card.style.borderRadius = "12px";
  card.style.boxShadow = "0 6px 18px rgba(0,0,0,0.08)";

  const title = document.createElement("h3");
  title.textContent = h.name || "Unnamed holiday";
  title.style.marginBottom = "6px";
  title.style.color = "#1f2937";

  const dateP = document.createElement("p");
  dateP.innerHTML = `<strong>Date:</strong> ${formatDate(h.date)}`;
  dateP.style.margin = "4px 0";

  const localP = document.createElement("p");
  if (h.localName && h.localName !== h.name) {
    localP.innerHTML = `<strong>Local name:</strong> ${h.localName}`;
    localP.style.margin = "4px 0";
  }

  const metaP = document.createElement("p");
  const typesText =
    Array.isArray(h.types) && h.types.length ? h.types.join(", ") : "N/A";
  const regionText =
    h.counties && h.counties.length
      ? `Applies to: ${h.counties.join(", ")}`
      : h.global
      ? "Nationwide"
      : "Regional";
  metaP.innerHTML = `<strong>Type:</strong> ${typesText} • ${regionText}${
    h.launchYear ? ` • Since ${h.launchYear}` : ""
  }`;
  metaP.style.margin = "6px 0";
  metaP.style.color = "#374151";

  const descP = document.createElement("p");
  descP.style.margin = "6px 0";
  descP.style.color = "#4b5563";
  // auto-generate a short description
  let desc = `Observed on ${new Date(h.date + "T00:00:00").toLocaleDateString(
    undefined,
    { month: "long", day: "numeric", year: "numeric" }
  )}. `;
  if (h.localName && h.localName !== h.name)
    desc += `Locally known as ${h.localName}. `;
  if (h.launchYear) desc += `First observed in ${h.launchYear}. `;
  desc += h.global ? "Observed nationwide." : "Observed regionally.";
  descP.textContent = desc;

  // image
  const img = document.createElement("img");
  const query = h.name ? encodeURIComponent(h.name.split(" ")[0]) : "holiday";
  img.src = `https://source.unsplash.com/800x400/?${query},celebration,festival`;
  img.alt = `${h.name} image`;
  img.loading = "lazy";
  img.style.width = "100%";
  img.style.maxHeight = "200px";
  img.style.objectFit = "cover";
  img.style.borderRadius = "8px";
  img.style.marginTop = "10px";
  img.onerror = function () {
    this.onerror = null;
    this.src = "https://via.placeholder.com/800x400?text=No+Image";
  };

  // append elements
  card.appendChild(title);
  card.appendChild(dateP);
  if (localP.innerHTML) card.appendChild(localP);
  card.appendChild(metaP);
  card.appendChild(descP);
  card.appendChild(img);

  return card;
}

/* group holidays by month number -> returns array of [monthNum, items] sorted */
function groupByMonth(holidays) {
  const map = new Map();
  holidays.forEach((h) => {
    const m = new Date(h.date + "T00:00:00").getMonth() + 1;
    if (!map.has(m)) map.set(m, []);
    map.get(m).push(h);
  });
  const arr = Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  return arr;
}

/* render grouped months into your existing table-wrapper (keeps design intact) */
function renderGrouped(holidays, filterMonth = "all", countryCode) {
  if (!resultsContainer) return;
  resultsContainer.innerHTML = ""; // clear
  if (!holidays || holidays.length === 0) {
    const p = document.createElement("div");
    p.style.padding = "18px";
    p.style.color = "#6b7280";
    p.textContent = `No holidays found for ${countryCode} in the selected year/month.`;
    resultsContainer.appendChild(p);
    holidaysSection.classList.remove("hidden");
    return;
  }

  // apply month filter if any
  let filtered = holidays;
  if (filterMonth !== "all") {
    filtered = holidays.filter(
      (h) =>
        new Date(h.date + "T00:00:00").getMonth() + 1 === Number(filterMonth)
    );
  }

  if (filtered.length === 0) {
    const p = document.createElement("div");
    p.style.padding = "18px";
    p.style.color = "#6b7280";
    p.textContent = `No holidays found for the selected month.`;
    resultsContainer.appendChild(p);
    holidaysSection.classList.remove("hidden");
    return;
  }

  // group
  const grouped = groupByMonth(filtered);
  // auto-expand current month group by default if available
  const currentMonth = new Date().getMonth() + 1;

  grouped.forEach(([monthNum, items]) => {
    // month wrapper
    const monthWrapper = document.createElement("div");
    monthWrapper.className = "month-group";
    monthWrapper.style.marginBottom = "12px";
    monthWrapper.style.borderRadius = "12px";
    monthWrapper.style.overflow = "hidden";
    monthWrapper.style.border = "1px solid rgba(0,0,0,0.06)";
    monthWrapper.style.background = "rgba(255,255,255,0.97)";

    // header
    const header = document.createElement("div");
    header.className = "month-header";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.padding = "12px 14px";
    header.style.cursor = "pointer";
    header.style.background =
      "linear-gradient(90deg, rgba(255,255,255,0.98), rgba(245,245,245,0.98))";

    const h3 = document.createElement("h3");
    h3.textContent = `${MONTH_NAMES[monthNum]} (${items.length})`;
    h3.style.margin = "0";
    h3.style.fontSize = "16px";
    h3.style.color = "#111827";

    const badge = document.createElement("div");
    badge.textContent = `${items.length}`;
    badge.style.background = "#fff";
    badge.style.border = "1px solid #e5e7eb";
    badge.style.padding = "6px 10px";
    badge.style.borderRadius = "999px";
    badge.style.fontSize = "13px";
    badge.style.color = "#111827";

    header.appendChild(h3);
    header.appendChild(badge);

    // body (grid of cards)
    const body = document.createElement("div");
    body.className = "month-body";
    body.style.padding = "12px";
    body.style.display = "grid";
    body.style.gridTemplateColumns = "repeat(auto-fit, minmax(260px, 1fr))";
    body.style.gap = "12px";

    // create cards sorted by date
    items.sort((a, b) => new Date(a.date) - new Date(b.date));
    items.forEach((h) => {
      const card = createHolidayCard(h, countryCode);
      body.appendChild(card);
    });

    // toggle
    header.addEventListener("click", () => {
      body.style.display = body.style.display === "none" ? "grid" : "none";
    });

    // default: show body. But auto-collapse if not current month (optional)
    if (monthNum !== currentMonth) {
      // keep shown — you can collapse non-current months if you prefer:
      // body.style.display = 'none';
    }

    monthWrapper.appendChild(header);
    monthWrapper.appendChild(body);
    resultsContainer.appendChild(monthWrapper);
  });

  holidaysSection.classList.remove("hidden");
}

/* fetch holidays for code & year, use cache when available */
async function fetchHolidaysFor(code, year) {
  clearError();
  hideResults();
  setLoading(true);

  // try cache
  const cached = loadCachedHolidays(code, year);
  if (cached) {
    qLog("Using cached holidays for", code, year);
    setLoading(false);
    renderGrouped(cached, monthSelect ? monthSelect.value : "all", code);
    return;
  }

  try {
    const url = `${API_BASE}/PublicHolidays/${encodeURIComponent(
      year
    )}/${encodeURIComponent(code)}`;
    qLog("Fetching", url);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`API returned ${res.status}`);
    }
    const data = await res.json();
    // store cache
    cacheHolidays(code, year, data);
    setLoading(false);
    renderGrouped(data, monthSelect ? monthSelect.value : "all", code);
  } catch (err) {
    qLog("Error fetching holidays:", err);
    setLoading(false);
    setError(
      "Could not load holidays. Please check the country code or try again later."
    );
  }
}

/* main action: determine country code to use and trigger fetch */
async function handleSearch() {
  clearError();
  hideResults();

  // pick manual input if filled (priority), else dropdown
  const manual =
    countryInput && countryInput.value && countryInput.value.trim()
      ? countryInput.value.trim().toUpperCase()
      : "";
  const dropdown =
    countrySelect && countrySelect.value ? countrySelect.value : "";
  const countryCode = manual || dropdown;
  const year =
    yearInput && yearInput.value ? yearInput.value : new Date().getFullYear();
  const month = monthSelect && monthSelect.value ? monthSelect.value : "all";

  if (!countryCode) {
    setError(
      "Please choose a country from the dropdown or enter a 2-letter country code."
    );
    return;
  }
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    setError("Country code should be two letters (e.g., US, IN).");
    return;
  }
  if (!/^\d{4}$/.test(String(year))) {
    setError("Please enter a valid year (e.g., 2025).");
    return;
  }

  // trigger fetch (uses caching internally)
  fetchHolidaysFor(countryCode, year);
}

/* wire up events & init */
function initialize() {
  qLog("Initializing holiday widget...");
  // populate countries
  loadCountries();

  // default year
  if (yearInput) yearInput.value = CURRENT_YEAR;

  // button handlers
  if (fetchBtn) fetchBtn.addEventListener("click", handleSearch);
  if (clearCacheBtn)
    clearCacheBtn.addEventListener("click", () => {
      // clear country list cache and holiday caches
      try {
        // remove country cache
        localStorage.removeItem(COUNTRIES_KEY);
        // remove holiday caches with prefix
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
        });
        alert("Cache cleared.");
      } catch (e) {
        /* ignore */
      }
    });

  // keyboard: Enter triggers search when focused on countryInput or yearInput
  if (countryInput)
    countryInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSearch();
    });
  if (yearInput)
    yearInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSearch();
    });
  if (countrySelect)
    countrySelect.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSearch();
    });

  // modals (existing functions closeModal, closeAllModals were present in your previous JS; keep them.)
  if (helpBtn) helpBtn.addEventListener("click", () => showModal("helpModal"));
  if (aboutBtn)
    aboutBtn.addEventListener("click", () => showModal("aboutModal"));

  qLog("Initialized.");
}

/* attempt to reuse your existing modal functions if present, otherwise define small safe fallbacks */
if (typeof showModal === "undefined") {
  window.showModal = function (id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove("hidden");
    if (overlay) overlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  };
}
if (typeof closeModal === "undefined") {
  window.closeModal = function (id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add("hidden");
    const open = document.querySelectorAll(".modal:not(.hidden)");
    if (!open.length) {
      if (overlay) overlay.classList.add("hidden");
      document.body.style.overflow = "";
    }
  };
}
if (typeof closeAllModals === "undefined") {
  window.closeAllModals = function () {
    document
      .querySelectorAll(".modal")
      .forEach((m) => m.classList.add("hidden"));
    if (overlay) overlay.classList.add("hidden");
    document.body.style.overflow = "";
  };
}

/* DOM ready */
document.addEventListener("DOMContentLoaded", initialize);
