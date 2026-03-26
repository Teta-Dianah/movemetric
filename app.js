// ============================================
// SECTION 1: CONFIGURATION & GLOBAL VARIABLES
// ============================================

var EXCHANGE_API  = "https://open.er-api.com/v6/latest/USD";
var COUNTRIES_API = "https://restcountries.com/v3.1/all?fields=name,flags,currencies,cca2";

var urbanAreas    = [];   // [{name, slug, href}, ...]
var countriesData = [];   // raw REST Countries response
var exchangeRates = null; // {rates: {RWF: 1350, ...}}
var selectedCities = [];  // [{name, slug}, ...]  max 4
var comparisonData = [];  // processed results for dashboard
var showUSD = false;      // currency toggle state
var userCurrency = "";
var userSalary = 0;

// Maps category IDs we care about to friendly labels
var CATEGORY_MAP = {
  "HOUSING":         "Housing",
  "COST-OF-LIVING":  "Food & Daily Life",
  "TRANSPORTATION":  "Transportation",
  "INTERNET-ACCESS": "Internet",
  "HEALTHCARE":      "Healthcare",
  "EDUCATION":       "Education"
};

// Key cost items to extract per category (the most useful ones)
var KEY_ITEMS = {
  "HOUSING": [
    "APARTMENT-RENT-LARGE",
    "APARTMENT-RENT-MEDIUM",
    "APARTMENT-RENT-SMALL"
  ],
  "COST-OF-LIVING": [
    "COST-RESTAURANT-MEAL",
    "COST-CAPPUCCINO",
    "COST-IMPORT-BEER",
    "COST-PUBLIC-TRANSPORT"
  ],
  "TRANSPORTATION": [
    "TRANSPORT-MONTHLY-PASS"
  ],
  "INTERNET-ACCESS": [
    "INTERNET-SPEED-BROADBAND-DOWNLOAD"
  ],
  "HEALTHCARE": [],
  "EDUCATION": []
};

// Embedded cost-of-living data for major cities (values in USD per month)
// Source: Numbeo cost-of-living indices (publicly available data)
// Format: [lgRent, mdRent, smRent, meal, coffee, beer, transport, internet, doctor]
var CITY_DATA = {
  // North America
  "new-york":        { name: "New York",        country: "US", score: 62, c: [4200, 3000, 2200, 25, 5.5, 9, 132, 65, 200] },
  "san-francisco":   { name: "San Francisco",   country: "US", score: 68, c: [4500, 3200, 2400, 22, 5.5, 8, 98, 60, 200] },
  "los-angeles":     { name: "Los Angeles",     country: "US", score: 58, c: [3500, 2500, 1800, 20, 5, 8, 100, 55, 180] },
  "chicago":         { name: "Chicago",         country: "US", score: 57, c: [2800, 1800, 1400, 18, 4.5, 7, 105, 50, 160] },
  "seattle":         { name: "Seattle",         country: "US", score: 65, c: [3200, 2200, 1600, 20, 5, 7, 99, 55, 180] },
  "boston":           { name: "Boston",          country: "US", score: 63, c: [3800, 2600, 1900, 22, 5, 8, 90, 55, 180] },
  "miami":           { name: "Miami",           country: "US", score: 55, c: [3200, 2200, 1600, 18, 4.5, 7, 112, 55, 150] },
  "austin":          { name: "Austin",          country: "US", score: 60, c: [2400, 1600, 1200, 17, 4.5, 7, 41, 55, 150] },
  "denver":          { name: "Denver",          country: "US", score: 61, c: [2600, 1700, 1300, 18, 4.5, 7, 114, 55, 160] },
  "washington-d-c":  { name: "Washington, D.C.", country: "US", score: 60, c: [3400, 2400, 1700, 20, 5, 7, 90, 55, 170] },
  "toronto":         { name: "Toronto",         country: "CA", score: 59, c: [3000, 2000, 1500, 16, 4, 6, 128, 55, 0] },
  "vancouver":       { name: "Vancouver",       country: "CA", score: 62, c: [3200, 2200, 1600, 16, 4, 6, 100, 55, 0] },
  "montreal":        { name: "Montreal",        country: "CA", score: 58, c: [2200, 1400, 1000, 15, 3.5, 6, 90, 50, 0] },
  "mexico-city":     { name: "Mexico City",     country: "MX", score: 45, c: [1500, 800, 500, 6, 3, 3, 20, 20, 20] },
  // Europe
  "london":          { name: "London",          country: "GB", score: 64, c: [3500, 2500, 1800, 18, 4.5, 7, 185, 40, 0] },
  "paris":           { name: "Paris",           country: "FR", score: 61, c: [2800, 1800, 1200, 16, 4, 7, 85, 35, 30] },
  "berlin":          { name: "Berlin",          country: "DE", score: 67, c: [2000, 1300, 900, 12, 3.5, 4, 86, 30, 30] },
  "amsterdam":       { name: "Amsterdam",       country: "NL", score: 65, c: [2800, 1800, 1200, 16, 3.5, 6, 100, 40, 25] },
  "madrid":          { name: "Madrid",          country: "ES", score: 58, c: [1800, 1100, 800, 13, 2, 4, 55, 35, 25] },
  "rome":            { name: "Rome",            country: "IT", score: 50, c: [2000, 1200, 800, 15, 2, 5, 40, 30, 70] },
  "barcelona":       { name: "Barcelona",       country: "ES", score: 57, c: [2000, 1200, 850, 13, 2.5, 4, 55, 35, 25] },
  "lisbon":          { name: "Lisbon",          country: "PT", score: 56, c: [1800, 1100, 750, 10, 1.5, 3, 45, 35, 40] },
  "dublin":          { name: "Dublin",          country: "IE", score: 60, c: [3000, 2000, 1500, 18, 4, 7, 120, 55, 60] },
  "vienna":          { name: "Vienna",          country: "AT", score: 70, c: [1800, 1100, 800, 14, 4, 5, 51, 30, 25] },
  "stockholm":       { name: "Stockholm",       country: "SE", score: 64, c: [2200, 1400, 1000, 15, 4.5, 7, 97, 30, 25] },
  "zurich":          { name: "Zurich",          country: "CH", score: 72, c: [4000, 2800, 2000, 30, 5.5, 8, 88, 50, 120] },
  "copenhagen":      { name: "Copenhagen",      country: "DK", score: 69, c: [2200, 1500, 1000, 18, 5, 7, 55, 35, 0] },
  "helsinki":         { name: "Helsinki",        country: "FI", score: 67, c: [1800, 1200, 850, 14, 4, 6, 60, 25, 30] },
  "prague":          { name: "Prague",          country: "CZ", score: 56, c: [1500, 900, 650, 8, 3, 3, 30, 20, 30] },
  "warsaw":          { name: "Warsaw",          country: "PL", score: 55, c: [1400, 800, 600, 8, 3, 3, 28, 15, 25] },
  "budapest":        { name: "Budapest",        country: "HU", score: 54, c: [1200, 700, 500, 8, 2.5, 2.5, 30, 15, 25] },
  "munich":          { name: "Munich",          country: "DE", score: 66, c: [2500, 1700, 1200, 14, 4, 5, 80, 35, 30] },
  "edinburgh":       { name: "Edinburgh",       country: "GB", score: 58, c: [2000, 1400, 950, 16, 4, 6, 70, 35, 0] },
  "brussels":        { name: "Brussels",        country: "BE", score: 57, c: [1800, 1200, 850, 15, 3.5, 5, 55, 35, 25] },
  // Asia
  "tokyo":           { name: "Tokyo",           country: "JP", score: 63, c: [3000, 1800, 1100, 10, 4, 5, 75, 40, 30] },
  "seoul":           { name: "Seoul",           country: "KR", score: 55, c: [2500, 1400, 800, 9, 4.5, 5, 55, 25, 20] },
  "singapore":       { name: "Singapore",       country: "SG", score: 70, c: [4000, 2800, 1800, 12, 4.5, 8, 80, 30, 60] },
  "bangkok":         { name: "Bangkok",         country: "TH", score: 48, c: [1200, 600, 400, 4, 2, 3, 30, 15, 20] },
  "kuala-lumpur":    { name: "Kuala Lumpur",    country: "MY", score: 50, c: [1200, 650, 450, 4, 2, 3, 25, 20, 15] },
  "dubai":           { name: "Dubai",           country: "AE", score: 59, c: [3500, 2200, 1500, 12, 5, 8, 80, 60, 50] },
  "mumbai":          { name: "Mumbai",          country: "IN", score: 40, c: [1500, 700, 350, 3, 2, 3, 12, 12, 8] },
  "bangalore":       { name: "Bangalore",       country: "IN", score: 45, c: [1000, 500, 250, 3, 2, 3, 15, 12, 8] },
  "hong-kong":       { name: "Hong Kong",       country: "HK", score: 56, c: [4500, 2800, 1800, 10, 5, 7, 60, 25, 70] },
  "shanghai":        { name: "Shanghai",        country: "CN", score: 50, c: [2500, 1400, 800, 5, 4, 4, 15, 15, 20] },
  "taipei":          { name: "Taipei",          country: "TW", score: 55, c: [1500, 800, 550, 5, 3.5, 4, 20, 20, 10] },
  "ho-chi-minh-city":{ name: "Ho Chi Minh City",country: "VN", score: 42, c: [1000, 500, 350, 3, 2, 2, 8, 10, 10] },
  "jakarta":         { name: "Jakarta",         country: "ID", score: 40, c: [1500, 700, 400, 3, 2, 3, 12, 15, 10] },
  // Africa
  "lagos":           { name: "Lagos",           country: "NG", score: 35, c: [2000, 1000, 600, 6, 3, 3, 30, 25, 20] },
  "nairobi":         { name: "Nairobi",         country: "KE", score: 38, c: [1500, 800, 450, 5, 2.5, 3, 30, 20, 15] },
  "cape-town":       { name: "Cape Town",       country: "ZA", score: 48, c: [1800, 1000, 650, 8, 2.5, 3, 40, 30, 30] },
  "johannesburg":    { name: "Johannesburg",    country: "ZA", score: 42, c: [1500, 850, 550, 7, 2.5, 3, 35, 30, 25] },
  "cairo":           { name: "Cairo",           country: "EG", score: 36, c: [800, 400, 250, 4, 2, 2, 12, 10, 10] },
  "casablanca":      { name: "Casablanca",      country: "MA", score: 40, c: [1000, 550, 350, 5, 2, 3, 18, 15, 15] },
  "accra":           { name: "Accra",           country: "GH", score: 37, c: [1200, 650, 400, 5, 3, 3, 20, 30, 15] },
  // South America
  "sao-paulo":       { name: "São Paulo",       country: "BR", score: 45, c: [1800, 1000, 600, 8, 2.5, 3, 35, 20, 30] },
  "buenos-aires":    { name: "Buenos Aires",    country: "AR", score: 48, c: [1200, 700, 450, 8, 2.5, 3, 20, 20, 10] },
  "bogota":          { name: "Bogotá",          country: "CO", score: 42, c: [1000, 550, 350, 5, 2, 2, 20, 15, 10] },
  "lima":            { name: "Lima",            country: "PE", score: 40, c: [1000, 550, 400, 5, 2.5, 3, 25, 20, 20] },
  "santiago":        { name: "Santiago",        country: "CL", score: 48, c: [1200, 700, 500, 8, 3, 3, 40, 25, 25] },
  // Oceania
  "sydney":          { name: "Sydney",          country: "AU", score: 62, c: [3500, 2200, 1500, 18, 4, 8, 140, 55, 60] },
  "melbourne":       { name: "Melbourne",       country: "AU", score: 60, c: [2800, 1800, 1200, 16, 4, 7, 120, 50, 55] },
  "auckland":        { name: "Auckland",        country: "NZ", score: 56, c: [2500, 1600, 1100, 15, 4, 7, 100, 55, 50] }
};

/**
 * Convert compact CITY_DATA entry into the Teleport-style detail response
 * format that extractCosts() expects.
 */
function buildDetailsResponse(entry) {
  var c = entry.c;
  return {
    categories: [
      { id: "HOUSING", label: "Housing", data: [
        { id: "APARTMENT-RENT-LARGE",  label: "Large Apartment Rent",  currency_dollar_value: c[0], type: "currency" },
        { id: "APARTMENT-RENT-MEDIUM", label: "Medium Apartment Rent", currency_dollar_value: c[1], type: "currency" },
        { id: "APARTMENT-RENT-SMALL",  label: "Small Apartment Rent",  currency_dollar_value: c[2], type: "currency" }
      ]},
      { id: "COST-OF-LIVING", label: "Cost of Living", data: [
        { id: "COST-RESTAURANT-MEAL", label: "Restaurant Meal", currency_dollar_value: c[3], type: "currency" },
        { id: "COST-CAPPUCCINO",      label: "Cappuccino",      currency_dollar_value: c[4], type: "currency" },
        { id: "COST-IMPORT-BEER",     label: "Beer (Import)",   currency_dollar_value: c[5], type: "currency" }
      ]},
      { id: "TRANSPORTATION", label: "Transportation", data: [
        { id: "TRANSPORT-MONTHLY-PASS", label: "Monthly Public Transport", currency_dollar_value: c[6], type: "currency" }
      ]},
      { id: "INTERNET-ACCESS", label: "Internet Access", data: [
        { id: "INTERNET-BROADBAND-MONTHLY", label: "Broadband Monthly", currency_dollar_value: c[7], type: "currency" }
      ]},
      { id: "HEALTHCARE", label: "Healthcare", data: c[8] > 0 ? [
        { id: "HEALTHCARE-DOCTOR-VISIT", label: "Doctor Visit", currency_dollar_value: c[8], type: "currency" }
      ] : [] },
      { id: "EDUCATION", label: "Education", data: [] }
    ]
  };
}

// ============================================
// SECTION 2: API FUNCTIONS
// ============================================

/**
 * Build the urban areas list from embedded city data.
 * Returns a resolved promise for consistency with the rest of the init flow.
 */
function fetchUrbanAreas() {
  urbanAreas = Object.keys(CITY_DATA).map(function (slug) {
    return { name: CITY_DATA[slug].name, slug: slug };
  });
  urbanAreas.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return Promise.resolve(urbanAreas);
}

/**
 * Fetch country data from REST Countries API.
 * Used for currency list and flags.
 */
function fetchCountries() {
  return fetch(COUNTRIES_API)
    .then(function (res) {
      if (!res.ok) throw new Error("Failed to load country data");
      return res.json();
    })
    .then(function (data) {
      countriesData = data;
      return data;
    });
}

/**
 * Fetch exchange rates (base USD).
 */
function fetchExchangeRates() {
  return fetch(EXCHANGE_API)
    .then(function (res) {
      if (!res.ok) throw new Error("Exchange rate service unavailable");
      return res.json();
    })
    .then(function (data) {
      if (data.result !== "success") {
        throw new Error("Exchange rate lookup failed");
      }
      exchangeRates = data;
      return data;
    });
}

/**
 * Look up cost-of-living data for a city from the embedded dataset.
 * Returns a promise (resolved or rejected) for consistency with the async flow.
 */
function fetchCityData(slug) {
  var entry = CITY_DATA[slug];
  if (!entry) {
    return Promise.reject(new Error("City data not available"));
  }
  return Promise.resolve({
    details: buildDetailsResponse(entry),
    scores: { teleport_city_score: entry.score }
  });
}

// ============================================
// SECTION 3: DATA PROCESSING & UTILITIES
// ============================================

/**
 * Extract the relevant cost items from a city's detail response.
 * Returns an object keyed by our CATEGORY_MAP ids.
 */
function extractCosts(detailsResponse) {
  var costs = {};
  var categories = detailsResponse.categories || [];

  categories.forEach(function (cat) {
    if (!CATEGORY_MAP[cat.id]) return; // skip categories we don't show

    var items = [];
    (cat.data || []).forEach(function (item) {
      if (item.type === "currency" && typeof item.currency_dollar_value === "number") {
        items.push({
          id: item.id,
          label: item.label,
          usd: item.currency_dollar_value
        });
      }
    });

    // Sum all currency items to get a category total
    var total = items.reduce(function (sum, i) { return sum + i.usd; }, 0);

    costs[cat.id] = {
      label: CATEGORY_MAP[cat.id],
      total: total,
      items: items
    };
  });

  return costs;
}

/**
 * Calculate purchasing power: percentage of salary remaining
 * after basic monthly expenses (medium rent + transport + food estimate).
 */
function calcPurchasingPower(costs, salaryUSD) {
  var monthlyExpense = 0;

  // Rent: use medium apartment
  if (costs["HOUSING"]) {
    var rentItem = costs["HOUSING"].items.find(function (i) {
      return i.id === "APARTMENT-RENT-MEDIUM";
    });
    if (rentItem) monthlyExpense += rentItem.usd;
  }

  // Transport: monthly pass
  if (costs["TRANSPORTATION"]) {
    var transport = costs["TRANSPORTATION"].items.find(function (i) {
      return i.id === "TRANSPORT-MONTHLY-PASS";
    });
    if (transport) monthlyExpense += transport.usd;
  }

  // Food: estimate 30 restaurant meals/month as proxy
  if (costs["COST-OF-LIVING"]) {
    var meal = costs["COST-OF-LIVING"].items.find(function (i) {
      return i.id === "COST-RESTAURANT-MEAL";
    });
    if (meal) monthlyExpense += meal.usd * 30;
  }

  if (salaryUSD <= 0) return 0;
  var remaining = ((salaryUSD - monthlyExpense) / salaryUSD) * 100;
  return Math.max(0, Math.round(remaining));
}

/**
 * Convert a USD amount to the user's currency.
 */
function convertCurrency(amountUSD) {
  if (showUSD || !exchangeRates || !userCurrency) return amountUSD;
  var rate = exchangeRates.rates[userCurrency];
  if (!rate) return amountUSD;
  return amountUSD * rate;
}

/**
 * Format a number as currency string.
 */
function formatMoney(amount, forceCurrency) {
  var code = forceCurrency || (showUSD ? "USD" : userCurrency) || "USD";
  var symbol = getCurrencySymbol(code);
  var formatted;

  if (amount >= 1000) {
    formatted = Math.round(amount).toLocaleString();
  } else if (amount >= 1) {
    formatted = amount.toFixed(2);
  } else {
    formatted = amount.toFixed(2);
  }

  return symbol + formatted;
}

/**
 * Get a currency symbol from country data, falling back to the code itself.
 */
function getCurrencySymbol(code) {
  for (var i = 0; i < countriesData.length; i++) {
    var c = countriesData[i];
    if (c.currencies && c.currencies[code] && c.currencies[code].symbol) {
      return c.currencies[code].symbol;
    }
  }
  return code + " ";
}

/**
 * Return the user's salary converted to USD for internal calculations.
 */
function getSalaryUSD() {
  if (!exchangeRates || !userCurrency) return userSalary;
  var rate = exchangeRates.rates[userCurrency];
  if (!rate || rate === 0) return userSalary;
  return userSalary / rate;
}

/**
 * Get color class based on a value's position in a range.
 */
function getBarColor(value, max) {
  var ratio = max > 0 ? value / max : 0;
  if (ratio < 0.4) return "green";
  if (ratio < 0.7) return "yellow";
  return "red";
}

// ============================================
// SECTION 4: UI RENDERING
// ============================================

/**
 * Populate the currency dropdown from REST Countries data.
 */
function renderCurrencySelector() {
  var select = document.getElementById("currency-select");
  var currencySet = {};

  countriesData.forEach(function (country) {
    if (!country.currencies) return;
    Object.keys(country.currencies).forEach(function (code) {
      if (!currencySet[code]) {
        currencySet[code] = country.currencies[code].name || code;
      }
    });
  });

  // Sort by code
  var codes = Object.keys(currencySet).sort();

  select.innerHTML = '<option value="">Select currency</option>';
  codes.forEach(function (code) {
    var opt = document.createElement("option");
    opt.value = code;
    opt.textContent = code + " — " + currencySet[code];
    select.appendChild(opt);
  });

  // Default to USD
  select.value = "USD";
  userCurrency = "USD";
}

/**
 * Render city search results dropdown.
 */
function renderSearchResults(query) {
  var list = document.getElementById("search-results");
  list.innerHTML = "";

  if (!query || query.length < 2) {
    list.classList.remove("open");
    return;
  }

  var lower = query.toLowerCase();
  var matches = urbanAreas.filter(function (ua) {
    // Don't show already-selected cities
    var alreadySelected = selectedCities.some(function (sc) {
      return sc.slug === ua.slug;
    });
    return !alreadySelected && ua.name.toLowerCase().indexOf(lower) !== -1;
  }).slice(0, 8);

  if (matches.length === 0) {
    var li = document.createElement("li");
    li.textContent = "No matching cities with cost data available.";
    li.style.color = "#999";
    li.style.cursor = "default";
    list.appendChild(li);
    list.classList.add("open");
    return;
  }

  matches.forEach(function (ua) {
    var li = document.createElement("li");
    li.textContent = ua.name;
    li.addEventListener("click", function () {
      addCity(ua);
      list.classList.remove("open");
      document.getElementById("city-search").value = "";
    });
    list.appendChild(li);
  });

  list.classList.add("open");
}

/**
 * Add a city to the selected list and render chips.
 */
function addCity(urbanArea) {
  if (selectedCities.length >= 4) {
    showStatus("You can compare up to 4 cities at once.", "warning");
    return;
  }

  if (selectedCities.some(function (c) { return c.slug === urbanArea.slug; })) {
    return; // already added
  }

  selectedCities.push({ name: urbanArea.name, slug: urbanArea.slug });
  renderSelectedCities();
  updateCompareButton();
}

/**
 * Remove a city by slug.
 */
function removeCity(slug) {
  selectedCities = selectedCities.filter(function (c) { return c.slug !== slug; });
  renderSelectedCities();
  updateCompareButton();

  // If dashboard is showing, re-render without this city
  comparisonData = comparisonData.filter(function (cd) { return cd.slug !== slug; });
  if (comparisonData.length > 0) {
    renderDashboard();
  } else {
    document.getElementById("dashboard").innerHTML = "";
    document.getElementById("dashboard-controls").classList.remove("visible");
  }
}

/**
 * Render the selected city chips.
 */
function renderSelectedCities() {
  var container = document.getElementById("selected-cities");
  container.innerHTML = "";

  selectedCities.forEach(function (city) {
    var chip = document.createElement("span");
    chip.className = "city-chip";
    chip.innerHTML =
      '<span>' + escapeHTML(city.name) + '</span>' +
      '<button class="chip-remove" title="Remove">&times;</button>';
    chip.querySelector(".chip-remove").addEventListener("click", function () {
      removeCity(city.slug);
    });
    container.appendChild(chip);
  });
}

/**
 * Enable/disable the compare button based on selection count.
 */
function updateCompareButton() {
  var btn = document.getElementById("compare-btn");
  btn.disabled = selectedCities.length < 2;
}

/**
 * Render the full comparison dashboard.
 */
function renderDashboard() {
  var container = document.getElementById("dashboard");
  container.innerHTML = "";

  if (comparisonData.length === 0) return;

  // Apply current sort
  sortComparisonData();

  // Get the active filter
  var filterValue = document.getElementById("filter-select").value;

  // Find max values across all cities for relative bar widths
  var maxCosts = {};
  comparisonData.forEach(function (city) {
    Object.keys(city.costs).forEach(function (catId) {
      var total = city.costs[catId].total;
      if (!maxCosts[catId] || total > maxCosts[catId]) {
        maxCosts[catId] = total;
      }
    });
  });

  comparisonData.forEach(function (city) {
    var card = document.createElement("div");
    card.className = "city-card";

    // Header
    var headerHTML =
      '<div class="city-card-header">' +
        (city.flagUrl ? '<img src="' + city.flagUrl + '" alt="flag">' : '') +
        '<h3>' + escapeHTML(city.name) + '</h3>' +
        '<button class="remove-city" title="Remove city">&times;</button>' +
      '</div>';

    // Purchasing Power
    var power = city.purchasingPower;
    var powerColor = power >= 50 ? "green" : power >= 25 ? "yellow" : "red";
    var powerHTML =
      '<div class="power-gauge">' +
        '<div class="power-value text-' + powerColor + '">' + power + '%</div>' +
        '<div class="power-label">of salary remaining after basics</div>' +
        '<div class="power-bar-track">' +
          '<div class="power-bar-fill power-' + powerColor + '" style="width:' + power + '%;"></div>' +
        '</div>' +
      '</div>';

    // Teleport overall score
    var scoreHTML = '';
    if (typeof city.teleportScore === "number") {
      scoreHTML = '<div class="city-score">Quality of Life Score: ' + city.teleportScore.toFixed(1) + ' / 100</div>';
    }

    // Cost categories
    var categoriesHTML = '';
    Object.keys(CATEGORY_MAP).forEach(function (catId) {
      // Apply filter
      if (filterValue !== "all" && filterValue !== catId) return;

      var catData = city.costs[catId];
      if (!catData || catData.items.length === 0) return;

      var totalConverted = convertCurrency(catData.total);
      var maxConverted = convertCurrency(maxCosts[catId] || 1);
      var barPercent = maxCosts[catId] > 0 ? (catData.total / maxCosts[catId]) * 100 : 0;
      var color = getBarColor(catData.total, maxCosts[catId]);

      categoriesHTML +=
        '<div class="category-row">' +
          '<div class="category-label">' +
            '<span>' + catData.label + '</span>' +
            '<span class="category-cost">' + formatMoney(totalConverted) + '</span>' +
          '</div>' +
          '<div class="cost-bar-track">' +
            '<div class="cost-bar-fill bar-' + color + '" style="width:' + Math.round(barPercent) + '%;"></div>' +
          '</div>' +
          '<div class="category-items">' +
            catData.items.slice(0, 4).map(function (item) {
              var itemConverted = convertCurrency(item.usd);
              return '<div class="category-item"><span>' + escapeHTML(item.label) + '</span><span>' + formatMoney(itemConverted) + '</span></div>';
            }).join("") +
          '</div>' +
        '</div>';
    });

    card.innerHTML = headerHTML + powerHTML + scoreHTML + categoriesHTML;

    // Wire up remove button
    card.querySelector(".remove-city").addEventListener("click", function () {
      removeCity(city.slug);
    });

    container.appendChild(card);
  });
}

/**
 * Show a status message.
 */
function showStatus(message, type, showRetry) {
  var el = document.getElementById("status-message");
  el.className = "status-message " + (type || "info");
  el.innerHTML = escapeHTML(message);
  if (showRetry) {
    el.innerHTML += '<br><button class="retry-btn" id="retry-btn">Retry</button>';
    document.getElementById("retry-btn").addEventListener("click", function () {
      clearStatus();
      runComparison();
    });
  }
}

/**
 * Clear status message.
 */
function clearStatus() {
  var el = document.getElementById("status-message");
  el.className = "status-message";
  el.innerHTML = "";
}

/**
 * Show or hide the loading spinner.
 */
function setLoading(on) {
  document.getElementById("loader").classList.toggle("active", on);
}

/**
 * Escape HTML to prevent XSS.
 */
function escapeHTML(str) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ============================================
// SECTION 5: EVENT HANDLERS & INTERACTIONS
// ============================================

/**
 * Sort comparisonData array in place based on current sort selection.
 */
function sortComparisonData() {
  var sortBy = document.getElementById("sort-select").value;

  comparisonData.sort(function (a, b) {
    switch (sortBy) {
      case "affordability":
        return getTotalCost(a) - getTotalCost(b);
      case "rent":
        return getRentCost(a) - getRentCost(b);
      case "food":
        return getFoodCost(a) - getFoodCost(b);
      case "power":
        return b.purchasingPower - a.purchasingPower;
      case "internet":
        return getInternetCost(a) - getInternetCost(b);
      default:
        return 0;
    }
  });
}

function getTotalCost(city) {
  var sum = 0;
  Object.keys(city.costs).forEach(function (k) { sum += city.costs[k].total; });
  return sum;
}

function getRentCost(city) {
  if (!city.costs["HOUSING"]) return 0;
  var medium = city.costs["HOUSING"].items.find(function (i) { return i.id === "APARTMENT-RENT-MEDIUM"; });
  return medium ? medium.usd : city.costs["HOUSING"].total;
}

function getFoodCost(city) {
  return city.costs["COST-OF-LIVING"] ? city.costs["COST-OF-LIVING"].total : 0;
}

function getInternetCost(city) {
  return city.costs["INTERNET-ACCESS"] ? city.costs["INTERNET-ACCESS"].total : 0;
}

/**
 * Run the comparison: fetch data for all selected cities.
 */
function runComparison() {
  // Validate salary
  var salaryInput = document.getElementById("salary-input");
  userSalary = parseFloat(salaryInput.value);
  if (!userSalary || userSalary <= 0) {
    document.getElementById("salary-error").textContent = "Enter a valid salary greater than 0.";
    return;
  }
  document.getElementById("salary-error").textContent = "";

  // Validate currency
  userCurrency = document.getElementById("currency-select").value;
  if (!userCurrency) {
    showStatus("Please select your currency.", "warning");
    return;
  }

  // Validate cities
  if (selectedCities.length < 2) {
    showStatus("Select at least 2 cities to compare.", "warning");
    return;
  }

  clearStatus();
  setLoading(true);
  document.getElementById("dashboard").innerHTML = "";
  document.getElementById("dashboard-controls").classList.remove("visible");

  // Fetch exchange rates + all city data in parallel
  var ratePromise = exchangeRates
    ? Promise.resolve(exchangeRates)
    : fetchExchangeRates().catch(function () {
        showStatus("Currency conversion unavailable. Showing prices in USD.", "warning");
        showUSD = true;
        return null;
      });

  var cityPromises = selectedCities.map(function (city) {
    return fetchCityData(city.slug)
      .then(function (data) {
        return { slug: city.slug, name: city.name, data: data, error: null };
      })
      .catch(function (err) {
        return { slug: city.slug, name: city.name, data: null, error: err.message };
      });
  });

  Promise.all([ratePromise].concat(cityPromises))
    .then(function (results) {
      setLoading(false);

      var salaryUSD = getSalaryUSD();
      comparisonData = [];
      var errors = [];

      // results[0] is exchange rates, rest are city results
      for (var i = 1; i < results.length; i++) {
        var r = results[i];
        if (r.error) {
          errors.push(r.name + ": " + r.error);
          continue;
        }

        var costs = extractCosts(r.data.details);
        var power = calcPurchasingPower(costs, salaryUSD);
        var teleportScore = r.data.scores.teleport_city_score || null;

        // Try to find country flag from city name
        var flagUrl = findFlagForCity(r.name);

        comparisonData.push({
          slug: r.slug,
          name: r.name,
          costs: costs,
          purchasingPower: power,
          teleportScore: teleportScore,
          flagUrl: flagUrl
        });
      }

      if (errors.length > 0 && comparisonData.length > 0) {
        showStatus("Some cities could not be loaded: " + errors.join("; "), "warning");
      } else if (comparisonData.length === 0) {
        showStatus("Could not load data for any selected city. Please try again.", "error", true);
        return;
      }

      document.getElementById("dashboard-controls").classList.add("visible");
      renderDashboard();
    })
    .catch(function (err) {
      setLoading(false);
      showStatus("Something went wrong: " + err.message, "error", true);
    });
}

/**
 * Find a flag URL for a city using CITY_DATA country codes + REST Countries data.
 */
function findFlagForCity(cityName) {
  // Look up the country code from CITY_DATA
  var countryCode = "";
  var slugs = Object.keys(CITY_DATA);
  for (var j = 0; j < slugs.length; j++) {
    if (CITY_DATA[slugs[j]].name === cityName) {
      countryCode = CITY_DATA[slugs[j]].country;
      break;
    }
  }
  if (!countryCode) return "";

  // Match against REST Countries data for the flag image
  for (var i = 0; i < countriesData.length; i++) {
    if (countriesData[i].cca2 === countryCode) {
      return countriesData[i].flags.png;
    }
  }
  return "";
}

/**
 * Bind all event listeners.
 */
function bindEvents() {
  // City search input
  var searchInput = document.getElementById("city-search");
  searchInput.addEventListener("input", function () {
    renderSearchResults(this.value);
  });

  // Close search results when clicking outside
  document.addEventListener("click", function (e) {
    var list = document.getElementById("search-results");
    if (!e.target.closest(".city-search-group")) {
      list.classList.remove("open");
    }
  });

  // Currency selector
  document.getElementById("currency-select").addEventListener("change", function () {
    userCurrency = this.value;
    if (comparisonData.length > 0) {
      renderDashboard();
    }
  });

  // Compare button
  document.getElementById("compare-btn").addEventListener("click", function () {
    runComparison();
  });

  // Sort selector
  document.getElementById("sort-select").addEventListener("change", function () {
    if (comparisonData.length > 0) {
      renderDashboard();
    }
  });

  // Filter selector
  document.getElementById("filter-select").addEventListener("change", function () {
    if (comparisonData.length > 0) {
      renderDashboard();
    }
  });

  // Currency toggle buttons
  document.getElementById("toggle-local").addEventListener("click", function () {
    showUSD = false;
    this.classList.add("active");
    document.getElementById("toggle-usd").classList.remove("active");
    if (comparisonData.length > 0) renderDashboard();
  });

  document.getElementById("toggle-usd").addEventListener("click", function () {
    showUSD = true;
    this.classList.add("active");
    document.getElementById("toggle-local").classList.remove("active");
    if (comparisonData.length > 0) renderDashboard();
  });

  // Salary input validation
  document.getElementById("salary-input").addEventListener("input", function () {
    var val = parseFloat(this.value);
    if (this.value && (!val || val <= 0)) {
      document.getElementById("salary-error").textContent = "Enter a positive number.";
    } else {
      document.getElementById("salary-error").textContent = "";
    }
  });
}

// ============================================
// SECTION 6: ERROR HANDLING
// ============================================

// Error handling is integrated throughout the API functions and runComparison.
// Key strategies:
// - Each API call has its own .catch() so one failure doesn't break everything
// - Exchange rate failure falls back to showing USD
// - Individual city failures show partial results with a warning
// - Network errors show a retry button
// - Input validation prevents bad requests before they happen

// ============================================
// SECTION 7: INITIALIZATION
// ============================================

/**
 * Initialize the app: load urban areas list and country data.
 */
function init() {
  Promise.all([
    fetchUrbanAreas().catch(function (err) {
      showStatus("Could not load city list. Check your connection and refresh.", "error");
      return [];
    }),
    fetchCountries().catch(function (err) {
      showStatus("Could not load country data. Some features may be limited.", "warning");
      return [];
    })
  ]).then(function () {
    if (countriesData.length > 0) {
      renderCurrencySelector();
    }
    if (urbanAreas.length > 0 && countriesData.length > 0) {
      clearStatus();
    }
  });

  bindEvents();
}

// Start the app when the DOM is ready
document.addEventListener("DOMContentLoaded", init);
