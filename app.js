// ============================================================
// STEP 1: API CONFIGURATION
// Your key lives in config.js (which is gitignored).
// If config.js is missing, the app falls back to embedded data.
// ============================================================
const API_KEY  = (typeof RAPIDAPI_KEY !== "undefined") ? RAPIDAPI_KEY : "";
const API_HOST = "cost-of-living-and-prices.p.rapidapi.com";
const API_BASE = "https://" + API_HOST;

// Cache API responses for 24 hours to save on the 500 req/month limit
const CACHE_TTL = 24 * 60 * 60 * 1000;

// ============================================================
// FALLBACK DATA
// Used when the TravelTables API is unavailable or slow.
// Costs are in USD/month, sourced from Numbeo public indices.
// Format: [lgRent, mdRent, smRent, meal, coffee, beer, transport, internet, doctor]
// ============================================================
const FALLBACK_CITIES = {
  "New York":      { country: "United States", c: [4200,3000,2200,25,5.5,9,132,65,200] },
  "San Francisco": { country: "United States", c: [4500,3200,2400,22,5.5,8,98,60,200]  },
  "Los Angeles":   { country: "United States", c: [3500,2500,1800,20,5,8,100,55,180]   },
  "Chicago":       { country: "United States", c: [2800,1800,1400,18,4.5,7,105,50,160] },
  "Miami":         { country: "United States", c: [3200,2200,1600,18,4.5,7,112,55,150] },
  "Toronto":       { country: "Canada",        c: [3000,2000,1500,16,4,6,128,55,0]     },
  "Vancouver":     { country: "Canada",        c: [3200,2200,1600,16,4,6,100,55,0]     },
  "Mexico City":   { country: "Mexico",        c: [1500,800,500,6,3,3,20,20,20]        },
  "London":        { country: "United Kingdom",c: [3500,2500,1800,18,4.5,7,185,40,0]   },
  "Paris":         { country: "France",        c: [2800,1800,1200,16,4,7,85,35,30]     },
  "Berlin":        { country: "Germany",       c: [2000,1300,900,12,3.5,4,86,30,30]    },
  "Amsterdam":     { country: "Netherlands",   c: [2800,1800,1200,16,3.5,6,100,40,25]  },
  "Madrid":        { country: "Spain",         c: [1800,1100,800,13,2,4,55,35,25]      },
  "Barcelona":     { country: "Spain",         c: [2000,1200,850,13,2.5,4,55,35,25]    },
  "Dublin":        { country: "Ireland",       c: [3000,2000,1500,18,4,7,120,55,60]    },
  "Vienna":        { country: "Austria",       c: [1800,1100,800,14,4,5,51,30,25]      },
  "Zurich":        { country: "Switzerland",   c: [4000,2800,2000,30,5.5,8,88,50,120]  },
  "Prague":        { country: "Czechia",       c: [1500,900,650,8,3,3,30,20,30]        },
  "Warsaw":        { country: "Poland",        c: [1400,800,600,8,3,3,28,15,25]        },
  "Budapest":      { country: "Hungary",       c: [1200,700,500,8,2.5,2.5,30,15,25]   },
  "Tokyo":         { country: "Japan",         c: [3000,1800,1100,10,4,5,75,40,30]     },
  "Seoul":         { country: "South Korea",   c: [2500,1400,800,9,4.5,5,55,25,20]     },
  "Singapore":     { country: "Singapore",     c: [4000,2800,1800,12,4.5,8,80,30,60]   },
  "Bangkok":       { country: "Thailand",      c: [1200,600,400,4,2,3,30,15,20]        },
  "Dubai":         { country: "United Arab Emirates", c: [3500,2200,1500,12,5,8,80,60,50] },
  "Mumbai":        { country: "India",         c: [1500,700,350,3,2,3,12,12,8]         },
  "Hong Kong":     { country: "Hong Kong",     c: [4500,2800,1800,10,5,7,60,25,70]     },
  "Shanghai":      { country: "China",         c: [2500,1400,800,5,4,4,15,15,20]       },
  "Lagos":         { country: "Nigeria",       c: [2000,1000,600,6,3,3,30,25,20]       },
  "Nairobi":       { country: "Kenya",         c: [1500,800,450,5,2.5,3,30,20,15]      },
  "Cape Town":     { country: "South Africa",  c: [1800,1000,650,8,2.5,3,40,30,30]     },
  "Johannesburg":  { country: "South Africa",  c: [1500,850,550,7,2.5,3,35,30,25]      },
  "Cairo":         { country: "Egypt",         c: [800,400,250,4,2,2,12,10,10]         },
  "Accra":         { country: "Ghana",         c: [1200,650,400,5,3,3,20,30,15]        },
  "São Paulo":     { country: "Brazil",        c: [1800,1000,600,8,2.5,3,35,20,30]     },
  "Buenos Aires":  { country: "Argentina",     c: [1200,700,450,8,2.5,3,20,20,10]      },
  "Sydney":        { country: "Australia",     c: [3500,2200,1500,18,4,8,140,55,60]    },
  "Melbourne":     { country: "Australia",     c: [2800,1800,1200,16,4,7,120,50,55]    }
};

// Turn the compact fallback array into the full cost structure
function buildCostsFromFallback(cityName) {
  let d = FALLBACK_CITIES[cityName];
  if (!d) return null;
  let c = d.c;
  return {
    HOUSING:   { label:"Housing",          total: c[0]+c[1]+c[2], items: [{l:"Large Apartment (3br)",v:c[0]},{l:"Medium Apartment (1br)",v:c[1]},{l:"Small Apartment (outside)",v:c[2]}] },
    FOOD:      { label:"Food & Daily Life", total: c[3]+c[4]+c[5], items: [{l:"Restaurant Meal",v:c[3]},{l:"Cappuccino",v:c[4]},{l:"Beer (Imported)",v:c[5]}] },
    TRANSPORT: { label:"Transportation",   total: c[6],            items: [{l:"Monthly Transport Pass",v:c[6]}] },
    INTERNET:  { label:"Internet",         total: c[7],            items: [{l:"Broadband Monthly",v:c[7]}] },
    HEALTH:    { label:"Healthcare",       total: c[8],            items: c[8]>0?[{l:"Doctor Visit",v:c[8]}]:[] }
  };
}

// ============================================================
// GLOBAL STATE
// ============================================================
let countriesData  = [];
let exchangeRates  = null;
let allCities      = [];   // populated from API or fallback
let selectedCities = [];
let comparisonData = [];
let showUSD        = false;
let userCurrency   = "";
let userSalary     = 0;
let cats           = ["HOUSING", "FOOD", "TRANSPORT", "INTERNET", "HEALTH"];
let usingFallback  = false; // true when API is unavailable

// ============================================================
// CACHE HELPERS
// ============================================================

function cacheSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data })); } catch(e) {}
}

function cacheGet(key) {
  try {
    let item = JSON.parse(localStorage.getItem(key));
    if (!item) return null;
    if (Date.now() - item.ts > CACHE_TTL) return null;
    return item.data;
  } catch (e) { return null; }
}

// ============================================================
// STEP 2: LOAD CITY LIST
// Tries the API first. If that fails, falls back to the
// 38 embedded cities so the app always works.
// ============================================================

function loadFallbackCities() {
  usingFallback = true;
  allCities = Object.keys(FALLBACK_CITIES).map(function(name, i) {
    return { city_id: i, city_name: name, country_name: FALLBACK_CITIES[name].country };
  });
  clearMsg();
}

function loadCities() {
  // Use cached list if still fresh
  let cached = cacheGet("traveltables_cities");
  if (cached && cached.length > 0) {
    allCities = cached;
    return Promise.resolve();
  }

  // No API key — use fallback immediately
  if (!API_KEY) {
    loadFallbackCities();
    msg("No API key found — using built-in city data (38 cities).", "warning");
    return Promise.resolve();
  }

  msg("Loading cities...", "info");
  return fetch(API_BASE + "/cities", {
    headers: { "X-RapidAPI-Key": API_KEY, "X-RapidAPI-Host": API_HOST }
  })
  .then(function(r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  })
  .then(function(d) {
    // Handle different possible response shapes
    let list = d.cities || d.data || (Array.isArray(d) ? d : []);
    if (list.length === 0) throw new Error("Empty city list");
    allCities = list;
    cacheSet("traveltables_cities", allCities);
    clearMsg();
  })
  .catch(function(err) {
    console.warn("TravelTables API unavailable, using built-in cities:", err.message);
    loadFallbackCities();
    msg("Live city data unavailable — using built-in city list.", "warning");
  });
}

// ============================================================
// STEP 3: FETCH PRICES FOR A CITY
// Tries the API first, falls back to embedded data on failure.
// ============================================================

function fetchPrices(cityName, countryName) {
  // If we're in fallback mode or this city is in fallback data, use it directly
  if (usingFallback || !API_KEY) {
    let costs = buildCostsFromFallback(cityName);
    if (costs) return Promise.resolve({ _fallback: true, costs: costs });
    return Promise.reject(new Error("No data for " + cityName));
  }

  let cacheKey = "prices_v4|" + cityName + "|" + countryName;
  let cached   = cacheGet(cacheKey);
  if (cached) return Promise.resolve(cached);

  let url = API_BASE + "/prices"
    + "?city_name="    + encodeURIComponent(cityName)
    + "&country_name=" + encodeURIComponent(countryName);

  return fetch(url, {
    headers: { "X-RapidAPI-Key": API_KEY, "X-RapidAPI-Host": API_HOST }
  })
  .then(function(r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  })
  .then(function(d) {
    cacheSet(cacheKey, d);
    return d;
  })
  .catch(function(err) {
    // API failed — try embedded fallback before giving up
    console.warn("Price fetch failed for " + cityName + ":", err.message);
    let costs = buildCostsFromFallback(cityName);
    if (costs) return { _fallback: true, costs: costs };
    throw err;
  });
}

// ============================================================
// STEP 4: MAP API PRICES TO APP CATEGORIES
// ============================================================

// Finds a price item by keyword match.
// The API provides a pre-converted usd.avg field — we use that directly.
function findPrice(prices, keywords) {
  let match = prices.find(function(p) {
    let name = (p.item_name || p.name || "").toLowerCase();
    return keywords.every(function(kw) { return name.includes(kw); });
  });
  if (!match) return 0;
  // usd.avg is already converted by the API — no exchange rate math needed
  if (match.usd && match.usd.avg) return parseFloat(match.usd.avg) || 0;
  return match.avg || 0;
}

function buildCostsFromAPI(apiData) {
  let prices = apiData.prices || apiData.data || [];

  function get(keywords) {
    return findPrice(prices, keywords);
  }

  // Housing — API item names confirmed:
  // "Three bedroom apartment in city centre/center"
  // "One bedroom apartment in city centre/center"
  // "One bedroom apartment outside of city centre/center"
  // Using "in city" avoids matching "outside of city centre" (which also contains "city centre")
  let lgRent = get(["three bedroom", "in city"]);
  let mdRent = get(["one bedroom", "in city"]);
  let smRent = get(["one bedroom", "outside"])
            || Math.round(mdRent * 0.75);

  let meal   = get(["meal in inexpensive"])   || get(["meal", "inexpensive"]);
  let coffee = get(["cappuccino"]);
  let beer   = get(["imported beer"])         || get(["beer", "bottle"]);
  let trans  = get(["monthly pass"]);
  let net    = get(["internet, 60 mbps"])     || get(["internet"]);
  let doc    = get(["doctor visit"])          || 0;

  return {
    HOUSING:   { label:"Housing",          total: lgRent+mdRent+smRent, items:[{l:"Large Apartment (3br, centre)",v:lgRent},{l:"Medium Apartment (1br, centre)",v:mdRent},{l:"Small Apartment (1br, outside)",v:smRent}] },
    FOOD:      { label:"Food & Daily Life", total: meal+coffee+beer,     items:[{l:"Restaurant Meal",v:meal},{l:"Cappuccino",v:coffee},{l:"Beer (Imported)",v:beer}] },
    TRANSPORT: { label:"Transportation",   total: trans,                 items:[{l:"Monthly Transport Pass",v:trans}] },
    INTERNET:  { label:"Internet",         total: net,                   items:[{l:"Broadband Monthly",v:net}] },
    HEALTH:    { label:"Healthcare",       total: doc,                   items:doc>0?[{l:"Doctor Visit",v:doc}]:[] }
  };
}

// Choose which builder to use based on the response type
function buildCosts(apiData) {
  if (apiData._fallback) return apiData.costs;
  return buildCostsFromAPI(apiData);
}

// ============================================================
// PURCHASING POWER
// ============================================================

function calcPower(costs, sal) {
  let rent  = costs.HOUSING.items[1] ? costs.HOUSING.items[1].v : 0;
  let trans = costs.TRANSPORT.total;
  let food  = costs.FOOD.items[0]    ? costs.FOOD.items[0].v * 30 : 0;
  let exp   = rent + trans + food;
  return sal <= 0 ? 0 : Math.max(0, Math.round(((sal - exp) / sal) * 100));
}

// ============================================================
// CURRENCY & DISPLAY HELPERS
// ============================================================

function convert(usd) {
  if (showUSD || !exchangeRates || !userCurrency) return usd;
  return usd * (exchangeRates.rates[userCurrency] || 1);
}

function salaryInUSD() {
  if (!exchangeRates || !userCurrency) return userSalary;
  let r = exchangeRates.rates[userCurrency];
  return r > 0 ? userSalary / r : userSalary;
}

function money(amt) {
  let code = (showUSD ? "USD" : userCurrency) || "USD";
  let sym  = code + " ";
  for (let i = 0; i < countriesData.length; i++) {
    let cur = countriesData[i].currencies;
    if (cur && cur[code] && cur[code].symbol) { sym = cur[code].symbol; break; }
  }
  return amt >= 1000 ? sym + Math.round(amt).toLocaleString() : sym + amt.toFixed(2);
}

function getFlag(countryName) {
  let match = countriesData.find(function(c) {
    return c.name && c.name.common &&
           c.name.common.toLowerCase() === countryName.toLowerCase();
  });
  return match ? match.flags.png : "";
}

function esc(s) {
  let d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function msg(text, type) {
  let el = document.getElementById("status-message");
  el.className = "status-message " + (type || "info");
  el.innerHTML = esc(text);
}

function clearMsg() {
  let el = document.getElementById("status-message");
  el.className = "status-message";
  el.innerHTML = "";
}

// ============================================================
// CURRENCY DROPDOWN
// ============================================================

function fillCurrencySelect() {
  let sel = document.getElementById("currency-select"), list = {};
  countriesData.forEach(function(c) {
    if (!c.currencies) return;
    Object.keys(c.currencies).forEach(function(k) {
      if (!list[k]) list[k] = c.currencies[k].name || k;
    });
  });
  sel.innerHTML = '<option value="">Select currency</option>';
  Object.keys(list).sort().forEach(function(k) {
    sel.innerHTML += '<option value="' + k + '">' + k + ' — ' + list[k] + '</option>';
  });
  sel.value    = "USD";
  userCurrency = "USD";
}

// ============================================================
// CITY SEARCH DROPDOWN
// ============================================================

function search(q) {
  let ul = document.getElementById("search-results");
  ul.innerHTML = "";
  if (!q || q.length < 2) { ul.classList.remove("open"); return; }

  if (!allCities.length) {
    ul.innerHTML = '<li style="color:#999">Loading cities, please wait...</li>';
    ul.classList.add("open");
    return;
  }

  let low  = q.toLowerCase();
  let hits = allCities.filter(function(c) {
    let taken = selectedCities.some(function(s) { return s.id === c.city_id; });
    return !taken && c.city_name.toLowerCase().includes(low);
  }).slice(0, 8);

  if (!hits.length) {
    ul.innerHTML = '<li style="color:#999">No cities found. Try a nearby major city.</li>';
    ul.classList.add("open");
    return;
  }

  hits.forEach(function(city) {
    let li         = document.createElement("li");
    li.textContent = city.city_name + ", " + city.country_name;
    li.onclick     = function() {
      addCity({ id: city.city_id, name: city.city_name, country: city.country_name });
      ul.classList.remove("open");
      document.getElementById("city-search").value = "";
    };
    ul.appendChild(li);
  });
  ul.classList.add("open");
}

function addCity(city) {
  if (selectedCities.length >= 4) { msg("Max 4 cities.", "warning"); return; }
  if (selectedCities.some(function(s) { return s.id === city.id; })) return;
  selectedCities.push(city);
  renderChips();
  document.getElementById("compare-btn").disabled = selectedCities.length < 2;
}

function removeCity(cityId) {
  selectedCities = selectedCities.filter(function(c) { return c.id !== cityId; });
  comparisonData = comparisonData.filter(function(c) { return c.id !== cityId; });
  renderChips();
  document.getElementById("compare-btn").disabled = selectedCities.length < 2;
  if (comparisonData.length) {
    renderDashboard();
  } else {
    document.getElementById("dashboard").innerHTML = "";
    document.getElementById("dashboard-controls").classList.remove("visible");
  }
}

function renderChips() {
  let box = document.getElementById("selected-cities");
  box.innerHTML = "";
  selectedCities.forEach(function(city) {
    let chip       = document.createElement("span");
    chip.className = "city-chip";
    chip.innerHTML = '<span>' + esc(city.name) + ', ' + esc(city.country) + '</span>'
                   + '<button class="chip-remove">&times;</button>';
    chip.querySelector("button").onclick = function() { removeCity(city.id); };
    box.appendChild(chip);
  });
}

// ============================================================
// COMPARE — fetch prices for each city, then render
// ============================================================

function compare() {
  userSalary = parseFloat(document.getElementById("salary-input").value);
  if (!userSalary || userSalary <= 0) {
    document.getElementById("salary-error").textContent = "Enter a valid salary.";
    return;
  }
  document.getElementById("salary-error").textContent = "";

  userCurrency = document.getElementById("currency-select").value;
  if (!userCurrency) { msg("Select a currency.", "warning"); return; }
  if (selectedCities.length < 2) { msg("Pick at least 2 cities.", "warning"); return; }

  clearMsg();
  document.getElementById("loader").classList.add("active");
  document.getElementById("dashboard").innerHTML = "";
  document.getElementById("dashboard-controls").classList.remove("visible");

  // 1. Get exchange rates
  let ratesPromise = exchangeRates
    ? Promise.resolve()
    : fetch("https://open.er-api.com/v6/latest/USD")
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.result === "success") exchangeRates = d; })
        .catch(function() { msg("Currency conversion unavailable. Showing USD.", "warning"); showUSD = true; });

  // 2. Fetch prices for each city (each has its own error handler)
  ratesPromise
    .then(function() {
      let fetches = selectedCities.map(function(city) {
        return fetchPrices(city.name, city.country)
          .then(function(apiData) {
            let costs = buildCosts(apiData);
            return {
              id:      city.id,
              name:    city.name,
              country: city.country,
              costs:   costs,
              power:   calcPower(costs, salaryInUSD()),
              flag:    getFlag(city.country)
            };
          })
          .catch(function(err) {
            console.error("No data for " + city.name + ":", err.message);
            return null;
          });
      });
      return Promise.all(fetches);
    })
    .then(function(results) {
      document.getElementById("loader").classList.remove("active");
      let failed     = results.filter(function(r) { return r === null; });
      comparisonData = results.filter(function(r) { return r !== null; });

      if (!comparisonData.length) {
        msg("Could not load price data. Check your connection and try again.", "error");
        return;
      }
      if (failed.length > 0) {
        msg(failed.length + " city/cities had no available data and were skipped.", "warning");
      }
      document.getElementById("dashboard-controls").classList.add("visible");
      renderDashboard();
    })
    .catch(function(err) {
      document.getElementById("loader").classList.remove("active");
      msg("Something went wrong. Check your connection and try again.", "error");
      console.error(err);
    });
}

// ============================================================
// DASHBOARD RENDERING
// ============================================================

function renderDashboard() {
  let box = document.getElementById("dashboard");
  box.innerHTML = "";
  if (!comparisonData.length) return;

  let sal = salaryInUSD();
  comparisonData.forEach(function(city) { city.power = calcPower(city.costs, sal); });

  let by = document.getElementById("sort-select").value;
  comparisonData.sort(function(a, b) {
    if (by === "rent")     return a.costs.HOUSING.items[1].v - b.costs.HOUSING.items[1].v;
    if (by === "food")     return a.costs.FOOD.total         - b.costs.FOOD.total;
    if (by === "internet") return a.costs.INTERNET.total     - b.costs.INTERNET.total;
    if (by === "power")    return b.power - a.power;
    let ta = 0, tb = 0;
    cats.forEach(function(k) { ta += a.costs[k].total; tb += b.costs[k].total; });
    return ta - tb;
  });

  let filter = document.getElementById("filter-select").value;
  let maxC   = {};
  comparisonData.forEach(function(city) {
    cats.forEach(function(id) {
      if (!maxC[id] || city.costs[id].total > maxC[id]) maxC[id] = city.costs[id].total;
    });
  });

  comparisonData.forEach(function(city) {
    let card       = document.createElement("div");
    card.className = "city-card";
    let pw = city.power;
    let pc = pw >= 50 ? "green" : pw >= 25 ? "yellow" : "red";

    let h = '<div class="city-card-header">';
    h += city.flag ? '<img src="' + city.flag + '" alt="">' : "";
    h += '<h3>' + esc(city.name)
       + ' <small style="font-weight:normal;font-size:0.8em;opacity:0.65">'
       + esc(city.country) + '</small></h3>';
    h += '<button class="remove-city">&times;</button></div>';

    h += '<div class="power-gauge">';
    h += '<div class="power-value text-' + pc + '">' + pw + '%</div>';
    h += '<div class="power-label">of salary remaining after basics</div>';
    h += '<div class="power-bar-track"><div class="power-bar-fill power-' + pc + '" style="width:' + pw + '%"></div></div>';
    h += '</div>';

    cats.forEach(function(id) {
      if (filter !== "all" && filter !== id) return;
      let cat = city.costs[id];
      if (!cat.items.length) return;
      let pct = maxC[id] > 0 ? cat.total / maxC[id] * 100 : 0;
      let r   = sal > 0 ? cat.total / sal : 0;
      let col = r < 0.15 ? "green" : r < 0.35 ? "yellow" : "red";

      h += '<div class="category-row">';
      h += '<div class="category-label"><span>' + cat.label + '</span><span class="category-cost">' + money(convert(cat.total)) + '</span></div>';
      h += '<div class="cost-bar-track"><div class="cost-bar-fill bar-' + col + '" style="width:' + Math.round(pct) + '%"></div></div>';
      h += '<div class="category-items">';
      cat.items.forEach(function(it) {
        h += '<div class="category-item"><span>' + esc(it.l) + '</span><span>' + money(convert(it.v)) + '</span></div>';
      });
      h += '</div></div>';
    });

    card.innerHTML = h;
    card.querySelector(".remove-city").onclick = function() { removeCity(city.id); };
    box.appendChild(card);
  });
}

// ============================================================
// APP STARTUP
// ============================================================

document.addEventListener("DOMContentLoaded", function() {
  // Load country data (flags + currencies) and city list at the same time
  fetch("https://restcountries.com/v3.1/all?fields=name,flags,currencies,cca2")
    .then(function(r) { return r.json(); })
    .then(function(d) { countriesData = d; fillCurrencySelect(); })
    .catch(function() { msg("Could not load country data.", "warning"); });

  loadCities();

  // UI event listeners
  document.getElementById("city-search").addEventListener("input", function() { search(this.value); });

  document.addEventListener("click", function(e) {
    if (!e.target.closest(".city-search-group")) {
      document.getElementById("search-results").classList.remove("open");
    }
  });

  document.getElementById("currency-select").addEventListener("change", function() {
    userCurrency = this.value;
    userSalary   = parseFloat(document.getElementById("salary-input").value) || 0;
    if (comparisonData.length) renderDashboard();
  });

  document.getElementById("compare-btn").addEventListener("click", compare);

  document.getElementById("sort-select").addEventListener("change", function() {
    if (comparisonData.length) renderDashboard();
  });

  document.getElementById("filter-select").addEventListener("change", function() {
    if (comparisonData.length) renderDashboard();
  });

  document.getElementById("toggle-local").addEventListener("click", function() {
    showUSD = false;
    this.classList.add("active");
    document.getElementById("toggle-usd").classList.remove("active");
    if (comparisonData.length) renderDashboard();
  });

  document.getElementById("toggle-usd").addEventListener("click", function() {
    showUSD = true;
    this.classList.add("active");
    document.getElementById("toggle-local").classList.remove("active");
    if (comparisonData.length) renderDashboard();
  });

  document.getElementById("salary-input").addEventListener("input", function() {
    let v = parseFloat(this.value);
    document.getElementById("salary-error").textContent =
      (this.value && (!v || v <= 0)) ? "Enter a positive number." : "";
  });
});
