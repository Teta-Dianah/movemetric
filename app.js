// ============================================
// SECTION 1: CONFIGURATION & GLOBAL VARIABLES
// ============================================

var TELEPORT_BASE = "https://api.teleport.org/api";
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

// ============================================
// SECTION 2: API FUNCTIONS
// ============================================

/**
 * Fetch the list of all urban areas from Teleport.
 * Returns an array of {name, slug, href}.
 */
function fetchUrbanAreas() {
  return fetch(TELEPORT_BASE + "/urban_areas/")
    .then(function (res) {
      if (!res.ok) throw new Error("Failed to load cities");
      return res.json();
    })
    .then(function (data) {
      var items = data._links["ua:item"];
      urbanAreas = items.map(function (item) {
        var parts = item.href.split("slug:");
        var slug = parts[1].replace("/", "");
        return { name: item.name, slug: slug, href: item.href };
      });
      return urbanAreas;
    });
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
 * Fetch detailed cost-of-living data for a single city slug.
 * Returns {details, scores} or throws on failure.
 */
function fetchCityData(slug) {
  var detailsUrl = TELEPORT_BASE + "/urban_areas/slug:" + slug + "/details/";
  var scoresUrl  = TELEPORT_BASE + "/urban_areas/slug:" + slug + "/scores/";

  return Promise.all([
    fetch(detailsUrl).then(function (r) {
      if (!r.ok) throw new Error("Details unavailable");
      return r.json();
    }),
    fetch(scoresUrl).then(function (r) {
      if (!r.ok) throw new Error("Scores unavailable");
      return r.json();
    })
  ]).then(function (results) {
    return { details: results[0], scores: results[1] };
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
 * Get a flag image URL for a city by looking up the urban area's country.
 * Uses a simple mapping from city name heuristics + countries data.
 */
function getFlagForCity(cityName) {
  // Teleport city names are just city names, so we try to match
  // from a hardcoded lookup of known mappings or return a default.
  // For robustness, we try the scores endpoint's summary or just
  // return a placeholder.
  return "";
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
      scoreHTML = '<div class="city-score">Teleport Quality Score: ' + city.teleportScore.toFixed(1) + ' / 100</div>';
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
 * Attempt to find a flag URL for a city by matching country data.
 * Uses heuristic matching of the city name to known countries.
 */
function findFlagForCity(cityName) {
  // Common city-to-country mappings for better matching
  var cityCountryMap = {
    "nairobi": "KE", "lagos": "NG", "cape-town": "ZA", "cape town": "ZA",
    "johannesburg": "ZA", "cairo": "EG", "casablanca": "MA",
    "london": "GB", "paris": "FR", "berlin": "DE", "amsterdam": "NL",
    "madrid": "ES", "rome": "IT", "barcelona": "ES", "lisbon": "PT",
    "dublin": "IE", "vienna": "AT", "zurich": "CH", "stockholm": "SE",
    "oslo": "NO", "copenhagen": "DK", "helsinki": "FI", "warsaw": "PL",
    "prague": "CZ", "budapest": "HU", "bucharest": "RO", "athens": "GR",
    "istanbul": "TR", "moscow": "RU", "saint petersburg": "RU",
    "new york": "US", "san francisco": "US", "los angeles": "US",
    "chicago": "US", "boston": "US", "seattle": "US", "miami": "US",
    "washington": "US", "austin": "US", "denver": "US", "portland": "US",
    "philadelphia": "US", "dallas": "US", "houston": "US", "atlanta": "US",
    "detroit": "US", "minneapolis": "US", "phoenix": "US", "san diego": "US",
    "toronto": "CA", "vancouver": "CA", "montreal": "CA", "ottawa": "CA",
    "calgary": "CA", "mexico city": "MX", "guadalajara": "MX",
    "sao paulo": "BR", "rio de janeiro": "BR", "buenos aires": "AR",
    "santiago": "CL", "bogota": "CO", "lima": "PE", "montevideo": "UY",
    "tokyo": "JP", "osaka": "JP", "seoul": "KR", "beijing": "CN",
    "shanghai": "CN", "hong kong": "HK", "taipei": "TW", "singapore": "SG",
    "bangkok": "TH", "kuala lumpur": "MY", "jakarta": "ID", "manila": "PH",
    "ho chi minh city": "VN", "hanoi": "VN", "mumbai": "IN", "bangalore": "IN",
    "delhi": "IN", "chennai": "IN", "hyderabad": "IN", "pune": "IN",
    "dubai": "AE", "abu dhabi": "AE", "doha": "QA", "riyadh": "SA",
    "tel aviv": "IL", "sydney": "AU", "melbourne": "AU", "brisbane": "AU",
    "perth": "AU", "auckland": "NZ", "wellington": "NZ",
    "accra": "GH", "dar es salaam": "TZ", "kampala": "UG",
    "addis ababa": "ET", "lusaka": "ZM", "harare": "ZW", "maputo": "MZ",
    "tunis": "TN", "algiers": "DZ", "dakar": "SN",
    "edinburgh": "GB", "manchester": "GB", "birmingham": "GB",
    "lyon": "FR", "marseille": "FR", "munich": "DE", "hamburg": "DE",
    "milan": "IT", "florence": "IT", "brussels": "BE",
    "krakow": "PL", "bratislava": "SK", "tallinn": "EE",
    "riga": "LV", "vilnius": "LT", "belgrade": "RS", "zagreb": "HR",
    "sofia": "BG", "luxembourg": "LU", "reykjavik": "IS"
  };

  var lower = cityName.toLowerCase();
  var countryCode = cityCountryMap[lower];

  if (countryCode) {
    // Find flag from countries data
    for (var i = 0; i < countriesData.length; i++) {
      if (countriesData[i].cca2 === countryCode) {
        return countriesData[i].flags.png;
      }
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
