// API setup - key comes from config.js
let apiKey = (typeof RAPIDAPI_KEY !== "undefined") ? RAPIDAPI_KEY : "";
let apiHost = "cost-of-living-and-prices.p.rapidapi.com";

// Fallback city data (USD prices) in case API is down
// Format: [3br rent, 1br rent, small rent, meal, coffee, beer, transport, internet, doctor]
let fallback = {
  "New York":      { co: "United States", c: [4200,3000,2200,25,5.5,9,132,65,200] },
  "San Francisco": { co: "United States", c: [4500,3200,2400,22,5.5,8,98,60,200] },
  "Los Angeles":   { co: "United States", c: [3500,2500,1800,20,5,8,100,55,180] },
  "Chicago":       { co: "United States", c: [2800,1800,1400,18,4.5,7,105,50,160] },
  "Toronto":       { co: "Canada",        c: [3000,2000,1500,16,4,6,128,55,0] },
  "Mexico City":   { co: "Mexico",        c: [1500,800,500,6,3,3,20,20,20] },
  "London":        { co: "United Kingdom", c: [3500,2500,1800,18,4.5,7,185,40,0] },
  "Paris":         { co: "France",        c: [2800,1800,1200,16,4,7,85,35,30] },
  "Berlin":        { co: "Germany",       c: [2000,1300,900,12,3.5,4,86,30,30] },
  "Amsterdam":     { co: "Netherlands",   c: [2800,1800,1200,16,3.5,6,100,40,25] },
  "Madrid":        { co: "Spain",         c: [1800,1100,800,13,2,4,55,35,25] },
  "Dublin":        { co: "Ireland",       c: [3000,2000,1500,18,4,7,120,55,60] },
  "Zurich":        { co: "Switzerland",   c: [4000,2800,2000,30,5.5,8,88,50,120] },
  "Prague":        { co: "Czechia",       c: [1500,900,650,8,3,3,30,20,30] },
  "Warsaw":        { co: "Poland",        c: [1400,800,600,8,3,3,28,15,25] },
  "Tokyo":         { co: "Japan",         c: [3000,1800,1100,10,4,5,75,40,30] },
  "Seoul":         { co: "South Korea",   c: [2500,1400,800,9,4.5,5,55,25,20] },
  "Singapore":     { co: "Singapore",     c: [4000,2800,1800,12,4.5,8,80,30,60] },
  "Bangkok":       { co: "Thailand",      c: [1200,600,400,4,2,3,30,15,20] },
  "Dubai":         { co: "United Arab Emirates", c: [3500,2200,1500,12,5,8,80,60,50] },
  "Mumbai":        { co: "India",         c: [1500,700,350,3,2,3,12,12,8] },
  "Lagos":         { co: "Nigeria",       c: [2000,1000,600,6,3,3,30,25,20] },
  "Nairobi":       { co: "Kenya",         c: [1500,800,450,5,2.5,3,30,20,15] },
  "Cape Town":     { co: "South Africa",  c: [1800,1000,650,8,2.5,3,40,30,30] },
  "Johannesburg":  { co: "South Africa",  c: [1500,850,550,7,2.5,3,35,30,25] },
  "Cairo":         { co: "Egypt",         c: [800,400,250,4,2,2,12,10,10] },
  "Accra":         { co: "Ghana",         c: [1200,650,400,5,3,3,20,30,15] },
  "São Paulo":     { co: "Brazil",        c: [1800,1000,600,8,2.5,3,35,20,30] },
  "Sydney":        { co: "Australia",     c: [3500,2200,1500,18,4,8,140,55,60] },
  "Melbourne":     { co: "Australia",     c: [2800,1800,1200,16,4,7,120,50,55] }
};

// Global variables
let countries = [];
let rates = null;
let allCities = [];
let picked = [];
let results = [];
let showUSD = false;
let currency = "";
let salary = 0;
let categories = ["HOUSING", "FOOD", "TRANSPORT", "INTERNET", "HEALTH"];

// Turn fallback array into category objects
function makeCosts(c) {
  return {
    HOUSING:   { label: "Housing",          total: c[0]+c[1]+c[2], items: [{l:"Large Apartment (3br)",v:c[0]},{l:"Medium Apartment (1br)",v:c[1]},{l:"Small Apartment (outside)",v:c[2]}] },
    FOOD:      { label: "Food & Daily Life", total: c[3]+c[4]+c[5], items: [{l:"Restaurant Meal",v:c[3]},{l:"Cappuccino",v:c[4]},{l:"Beer (Imported)",v:c[5]}] },
    TRANSPORT: { label: "Transportation",   total: c[6], items: [{l:"Monthly Transport Pass",v:c[6]}] },
    INTERNET:  { label: "Internet",         total: c[7], items: [{l:"Broadband Monthly",v:c[7]}] },
    HEALTH:    { label: "Healthcare",       total: c[8], items: c[8] > 0 ? [{l:"Doctor Visit",v:c[8]}] : [] }
  };
}

// Parse API response into same category format
function parsePrices(data) {
  let prices = data.prices || data.data || [];

  // find a price by matching keywords in the item name
  function find(keywords) {
    for (let i = 0; i < prices.length; i++) {
      let name = (prices[i].item_name || prices[i].name || "").toLowerCase();
      let match = true;
      for (let j = 0; j < keywords.length; j++) {
        if (!name.includes(keywords[j])) { match = false; break; }
      }
      if (match) {
        if (prices[i].usd && prices[i].usd.avg) return parseFloat(prices[i].usd.avg) || 0;
        return prices[i].avg || 0;
      }
    }
    return 0;
  }

  let big   = find(["three bedroom", "in city"]);
  let med   = find(["one bedroom", "in city"]);
  let small = find(["one bedroom", "outside"]) || Math.round(med * 0.75);
  let meal  = find(["meal", "inexpensive"]);
  let cof   = find(["cappuccino"]);
  let beer  = find(["imported beer"]) || find(["beer", "bottle"]);
  let bus   = find(["monthly pass"]);
  let net   = find(["internet"]);
  let doc   = find(["doctor visit"]);

  return {
    HOUSING:   { label: "Housing",          total: big+med+small, items: [{l:"Large Apartment (3br)",v:big},{l:"Medium Apartment (1br)",v:med},{l:"Small Apartment (outside)",v:small}] },
    FOOD:      { label: "Food & Daily Life", total: meal+cof+beer, items: [{l:"Restaurant Meal",v:meal},{l:"Cappuccino",v:cof},{l:"Beer (Imported)",v:beer}] },
    TRANSPORT: { label: "Transportation",   total: bus, items: [{l:"Monthly Transport Pass",v:bus}] },
    INTERNET:  { label: "Internet",         total: net, items: [{l:"Broadband Monthly",v:net}] },
    HEALTH:    { label: "Healthcare",       total: doc, items: doc > 0 ? [{l:"Doctor Visit",v:doc}] : [] }
  };
}

// Calculate how much salary is left after basic expenses
function calcPower(costs, sal) {
  let rent = costs.HOUSING.items[1] ? costs.HOUSING.items[1].v : 0;
  let food = costs.FOOD.items[0] ? costs.FOOD.items[0].v * 30 : 0;
  let bus  = costs.TRANSPORT.total;
  let net  = costs.INTERNET.total;
  let total = rent + food + bus + net;
  if (sal <= 0) return 0;
  return Math.max(0, Math.round(((sal - total) / sal) * 100));
}

// Convert USD amount to user's currency
function convert(usd) {
  if (showUSD || !rates || !currency) return usd;
  return usd * (rates[currency] || 1);
}

// Convert user salary to USD
function toUSD() {
  if (!rates || !currency) return salary;
  let r = rates[currency];
  return r > 0 ? salary / r : salary;
}

// Format a number as money
function money(amt) {
  let code = showUSD ? "USD" : (currency || "USD");
  if (amt >= 1000) return code + " " + Math.round(amt).toLocaleString();
  return code + " " + amt.toFixed(2);
}

// Get country flag image URL
function getFlag(countryName) {
  for (let i = 0; i < countries.length; i++) {
    if (countries[i].name && countries[i].name.common &&
        countries[i].name.common.toLowerCase() === countryName.toLowerCase()) {
      return countries[i].flags.png;
    }
  }
  return "";
}

// Show a message to the user
function showMsg(text, type) {
  let el = document.getElementById("status-message");
  el.className = "status-message " + (type || "info");
  el.textContent = text;
}

// Load city list from API or use fallback
function loadCities() {
  if (!apiKey) {
    // no API key, use built-in cities
    allCities = Object.keys(fallback).map(function(name, i) {
      return { city_id: i, city_name: name, country_name: fallback[name].co };
    });
    return;
  }

  fetch("https://" + apiHost + "/cities", {
    headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": apiHost }
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    let list = d.cities || d.data || (Array.isArray(d) ? d : []);
    if (list.length > 0) allCities = list;
    else throw new Error("empty");
  })
  .catch(function() {
    // API failed, use fallback
    allCities = Object.keys(fallback).map(function(name, i) {
      return { city_id: i, city_name: name, country_name: fallback[name].co };
    });
  });
}

// Get prices for a city (from API or fallback)
function getPrices(cityName, countryName) {
  // use fallback if no API key or city is in fallback data
  if (!apiKey && fallback[cityName]) {
    return Promise.resolve({ _fb: true, costs: makeCosts(fallback[cityName].c) });
  }

  if (!apiKey) return Promise.reject(new Error("No data for " + cityName));

  let url = "https://" + apiHost + "/prices"
    + "?city_name=" + encodeURIComponent(cityName)
    + "&country_name=" + encodeURIComponent(countryName);

  return fetch(url, {
    headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": apiHost }
  })
  .then(function(r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  })
  .catch(function() {
    // if API fails, try fallback
    if (fallback[cityName]) {
      return { _fb: true, costs: makeCosts(fallback[cityName].c) };
    }
    throw new Error("No data for " + cityName);
  });
}

// Fill the currency dropdown from REST Countries data
function fillCurrencies() {
  let sel = document.getElementById("currency-select");
  let list = {};
  for (let i = 0; i < countries.length; i++) {
    let cur = countries[i].currencies;
    if (!cur) continue;
    let keys = Object.keys(cur);
    for (let j = 0; j < keys.length; j++) {
      if (!list[keys[j]]) list[keys[j]] = cur[keys[j]].name || keys[j];
    }
  }
  sel.innerHTML = '<option value="">Select currency</option>';
  let sorted = Object.keys(list).sort();
  for (let i = 0; i < sorted.length; i++) {
    let k = sorted[i];
    sel.innerHTML += '<option value="' + k + '">' + k + ' — ' + list[k] + '</option>';
  }
  sel.value = "USD";
  currency = "USD";
}

// Search for cities as user types
function searchCities(query) {
  let ul = document.getElementById("search-results");
  ul.innerHTML = "";
  if (!query || query.length < 2) { ul.classList.remove("open"); return; }

  let q = query.toLowerCase();
  let hits = allCities.filter(function(c) {
    // skip cities already picked
    for (let i = 0; i < picked.length; i++) {
      if (picked[i].id === c.city_id) return false;
    }
    return c.city_name.toLowerCase().includes(q);
  }).slice(0, 8);

  if (!hits.length) {
    ul.innerHTML = '<li style="color:#999">No cities found</li>';
    ul.classList.add("open");
    return;
  }

  for (let i = 0; i < hits.length; i++) {
    let li = document.createElement("li");
    li.textContent = hits[i].city_name + ", " + hits[i].country_name;
    li.onclick = (function(city) {
      return function() {
        addCity(city);
        ul.classList.remove("open");
        document.getElementById("city-search").value = "";
      };
    })(hits[i]);
    ul.appendChild(li);
  }
  ul.classList.add("open");
}

// Add a city to the comparison list
function addCity(city) {
  if (picked.length >= 4) { showMsg("Max 4 cities.", "warning"); return; }
  picked.push({ id: city.city_id, name: city.city_name, country: city.country_name });
  showChips();
  document.getElementById("compare-btn").disabled = picked.length < 2;
}

// Remove a city
function removeCity(id) {
  picked = picked.filter(function(c) { return c.id !== id; });
  results = results.filter(function(c) { return c.id !== id; });
  showChips();
  document.getElementById("compare-btn").disabled = picked.length < 2;
  if (results.length) renderDashboard();
  else {
    document.getElementById("dashboard").innerHTML = "";
    document.getElementById("dashboard-controls").classList.remove("visible");
  }
}

// Show city chips below the search box
function showChips() {
  let box = document.getElementById("selected-cities");
  box.innerHTML = "";
  for (let i = 0; i < picked.length; i++) {
    let chip = document.createElement("span");
    chip.className = "city-chip";
    chip.innerHTML = '<span>' + picked[i].name + '</span><button class="chip-remove">&times;</button>';
    chip.querySelector("button").onclick = (function(id) {
      return function() { removeCity(id); };
    })(picked[i].id);
    box.appendChild(chip);
  }
}

// Main compare function - runs when user clicks Compare
function compare() {
  salary = parseFloat(document.getElementById("salary-input").value);
  if (!salary || salary <= 0) {
    document.getElementById("salary-error").textContent = "Enter a valid salary.";
    return;
  }
  document.getElementById("salary-error").textContent = "";

  currency = document.getElementById("currency-select").value;
  if (!currency) { showMsg("Select a currency.", "warning"); return; }
  if (picked.length < 2) { showMsg("Pick at least 2 cities.", "warning"); return; }

  // show loading
  document.getElementById("status-message").className = "status-message";
  document.getElementById("status-message").textContent = "";
  document.getElementById("loader").classList.add("active");
  document.getElementById("dashboard").innerHTML = "";

  // step 1: get exchange rates
  let ratesFetch = rates
    ? Promise.resolve()
    : fetch("https://open.er-api.com/v6/latest/USD")
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.result === "success") rates = d.rates; })
        .catch(function() { showMsg("Currency conversion failed. Showing USD.", "warning"); showUSD = true; });

  // step 2: get prices for each city
  ratesFetch.then(function() {
    let fetches = [];
    for (let i = 0; i < picked.length; i++) {
      fetches.push(
        getPrices(picked[i].name, picked[i].country)
          .then(function(data) {
            let costs = data._fb ? data.costs : parsePrices(data);
            return {
              id: picked[i].id,
              name: picked[i].name,
              country: picked[i].country,
              costs: costs,
              power: calcPower(costs, toUSD()),
              flag: getFlag(picked[i].country)
            };
          })
          .catch(function() { return null; })
      );
    }
    return Promise.all(fetches);
  })
  .then(function(data) {
    document.getElementById("loader").classList.remove("active");
    results = data.filter(function(r) { return r !== null; });

    if (!results.length) {
      showMsg("Could not load data. Check your connection.", "error");
      return;
    }
    document.getElementById("dashboard-controls").classList.add("visible");
    renderDashboard();
  });
}

// Draw the city comparison cards
function renderDashboard() {
  let box = document.getElementById("dashboard");
  box.innerHTML = "";
  if (!results.length) return;

  // recalculate power with current salary
  let sal = toUSD();
  for (let i = 0; i < results.length; i++) {
    results[i].power = calcPower(results[i].costs, sal);
  }

  // sort
  let sortBy = document.getElementById("sort-select").value;
  results.sort(function(a, b) {
    if (sortBy === "rent") return a.costs.HOUSING.items[1].v - b.costs.HOUSING.items[1].v;
    if (sortBy === "food") return a.costs.FOOD.total - b.costs.FOOD.total;
    if (sortBy === "internet") return a.costs.INTERNET.total - b.costs.INTERNET.total;
    if (sortBy === "power") return b.power - a.power;
    // default: total cost
    let ta = 0, tb = 0;
    for (let k = 0; k < categories.length; k++) {
      ta += a.costs[categories[k]].total;
      tb += b.costs[categories[k]].total;
    }
    return ta - tb;
  });

  // find max cost per category (for bar widths and colors)
  let filter = document.getElementById("filter-select").value;
  let maxCost = {};
  for (let i = 0; i < results.length; i++) {
    for (let k = 0; k < categories.length; k++) {
      let id = categories[k];
      let t = results[i].costs[id].total;
      if (!maxCost[id] || t > maxCost[id]) maxCost[id] = t;
    }
  }

  // build each city card
  for (let i = 0; i < results.length; i++) {
    let city = results[i];
    let card = document.createElement("div");
    card.className = "city-card";

    let pw = city.power;
    let pwColor = pw >= 50 ? "green" : pw >= 25 ? "yellow" : "red";

    // card header with flag and name
    let html = '<div class="city-card-header">';
    if (city.flag) html += '<img src="' + city.flag + '" alt="">';
    html += '<h3>' + city.name + ' <small style="font-weight:normal;font-size:0.8em;opacity:0.65">' + city.country + '</small></h3>';
    html += '<button class="remove-city">&times;</button></div>';

    // purchasing power gauge
    html += '<div class="power-gauge">';
    html += '<div class="power-value text-' + pwColor + '">' + pw + '%</div>';
    html += '<div class="power-label">of salary remaining after basics</div>';
    html += '<div class="power-bar-track"><div class="power-bar-fill power-' + pwColor + '" style="width:' + pw + '%"></div></div>';
    html += '</div>';

    // cost categories
    for (let k = 0; k < categories.length; k++) {
      let id = categories[k];
      if (filter !== "all" && filter !== id) continue;

      let cat = city.costs[id];
      if (!cat.items.length) continue;

      // bar width = % of the most expensive city
      let pct = maxCost[id] > 0 ? Math.round(cat.total / maxCost[id] * 100) : 0;
      // color based on how this city compares to others
      let barColor = pct < 40 ? "green" : pct < 75 ? "yellow" : "red";

      html += '<div class="category-row">';
      html += '<div class="category-label"><span>' + cat.label + '</span><span class="category-cost">' + money(convert(cat.total)) + '</span></div>';
      html += '<div class="cost-bar-track"><div class="cost-bar-fill bar-' + barColor + '" style="width:' + pct + '%"></div></div>';
      html += '<div class="category-items">';
      for (let j = 0; j < cat.items.length; j++) {
        html += '<div class="category-item"><span>' + cat.items[j].l + '</span><span>' + money(convert(cat.items[j].v)) + '</span></div>';
      }
      html += '</div></div>';
    }

    card.innerHTML = html;
    card.querySelector(".remove-city").onclick = (function(id) {
      return function() { removeCity(id); };
    })(city.id);
    box.appendChild(card);
  }
}

// Start the app when page loads
document.addEventListener("DOMContentLoaded", function() {

  // load country data (for flags and currencies)
  fetch("https://restcountries.com/v3.1/all?fields=name,flags,currencies,cca2")
    .then(function(r) { return r.json(); })
    .then(function(d) { countries = d; fillCurrencies(); })
    .catch(function() { showMsg("Could not load country data.", "warning"); });

  // load city list
  loadCities();

  // search as user types
  document.getElementById("city-search").addEventListener("input", function() {
    searchCities(this.value);
  });

  // close search dropdown when clicking outside
  document.addEventListener("click", function(e) {
    if (!e.target.closest(".city-search-group")) {
      document.getElementById("search-results").classList.remove("open");
    }
  });

  // currency change
  document.getElementById("currency-select").addEventListener("change", function() {
    currency = this.value;
    salary = parseFloat(document.getElementById("salary-input").value) || 0;
    if (results.length) renderDashboard();
  });

  // compare button
  document.getElementById("compare-btn").addEventListener("click", compare);

  // sort and filter
  document.getElementById("sort-select").addEventListener("change", function() {
    if (results.length) renderDashboard();
  });
  document.getElementById("filter-select").addEventListener("change", function() {
    if (results.length) renderDashboard();
  });

  // currency toggle buttons
  document.getElementById("toggle-local").addEventListener("click", function() {
    showUSD = false;
    this.classList.add("active");
    document.getElementById("toggle-usd").classList.remove("active");
    if (results.length) renderDashboard();
  });
  document.getElementById("toggle-usd").addEventListener("click", function() {
    showUSD = true;
    this.classList.add("active");
    document.getElementById("toggle-local").classList.remove("active");
    if (results.length) renderDashboard();
  });

  // salary validation
  document.getElementById("salary-input").addEventListener("input", function() {
    let v = parseFloat(this.value);
    document.getElementById("salary-error").textContent =
      (this.value && (!v || v <= 0)) ? "Enter a positive number." : "";
  });
});
