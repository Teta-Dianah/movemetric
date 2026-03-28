// API key from config.js
let apiKey = "";
try { apiKey = RAPIDAPI_KEY; } catch(e) {}
let apiHost = "cost-of-living-and-prices.p.rapidapi.com";

let countries = [];
let rates = null;
let allCities = [];
let picked = [];
let results = [];
let showUSD = false;
let currency = "";
let salary = 0;

// cache API responses in localStorage so we dont waste requests
function getCache(city, country) {
  try {
    let saved = JSON.parse(localStorage.getItem("mm_" + city + "_" + country));
    if (saved && Date.now() - saved.time < 3600000) return saved.data;
  } catch(e) {}
  return null;
}

function saveCache(city, country, data) {
  try { localStorage.setItem("mm_" + city + "_" + country, JSON.stringify({ data: data, time: Date.now() })); }
  catch(e) {}
}

// track how many API calls we made this hour (free plan = 10/hr)
function countRequests() {
  try {
    let log = JSON.parse(localStorage.getItem("mm_req_log") || "[]");
    let recent = [];
    for (let i = 0; i < log.length; i++)
      if (Date.now() - log[i] < 3600000) recent.push(log[i]);
    localStorage.setItem("mm_req_log", JSON.stringify(recent));
    return recent.length;
  } catch(e) { return 0; }
}

function logRequest() {
  try {
    let log = JSON.parse(localStorage.getItem("mm_req_log") || "[]");
    log.push(Date.now());
    localStorage.setItem("mm_req_log", JSON.stringify(log));
  } catch(e) {}
}

// helper functions
function showMsg(text, type) {
  let el = document.getElementById("status-message");
  el.className = "status-message " + (type || "info");
  el.textContent = text;
}

function getSalaryInUSD() {
  if (!rates || !currency) return salary;
  return rates[currency] > 0 ? salary / rates[currency] : salary;
}

function convertPrice(usd) {
  if (showUSD || !rates || !currency) return usd;
  return usd * (rates[currency] || 1);
}

function formatMoney(amt) {
  let code = showUSD ? "USD" : (currency || "USD");
  return code + " " + (amt >= 1000 ? Math.round(amt).toLocaleString() : amt.toFixed(2));
}

function getFlag(name) {
  for (let i = 0; i < countries.length; i++) {
    if (countries[i].name && countries[i].name.common &&
        countries[i].name.common.toLowerCase() === name.toLowerCase())
      return countries[i].flags.png;
  }
  return "";
}

// pull the prices we care about from the API response
function extractCosts(apiData) {
  let prices = apiData.prices || apiData.data || [];

  function find(keywords) {
    for (let i = 0; i < prices.length; i++) {
      let name = (prices[i].item_name || prices[i].name || "").toLowerCase();
      let ok = true;
      for (let k = 0; k < keywords.length; k++) {
        if (name.indexOf(keywords[k]) === -1) { ok = false; break; }
      }
      if (ok) {
        if (prices[i].usd && prices[i].usd.avg) return parseFloat(prices[i].usd.avg);
        return prices[i].avg || 0;
      }
    }
    return 0;
  }

  let big = find(["three bedroom", "in city"]);
  let med = find(["one bedroom", "in city"]);
  let sm  = find(["one bedroom", "outside"]) || Math.round(med * 0.75);

  return {
    HOUSING:   { label: "Housing",          total: big+med+sm, items: [{l:"Large Apartment (3br)", v:big}, {l:"Medium Apartment (1br)", v:med}, {l:"Small Apartment (outside)", v:sm}] },
    FOOD:      { label: "Food & Daily Life", total: find(["meal","inexpensive"]) + find(["cappuccino"]) + find(["imported beer"]), items: [{l:"Restaurant Meal", v:find(["meal","inexpensive"])}, {l:"Cappuccino", v:find(["cappuccino"])}, {l:"Beer (Imported)", v:find(["imported beer"])}] },
    TRANSPORT: { label: "Transportation",    total: find(["monthly pass"]), items: [{l:"Monthly Transport Pass", v:find(["monthly pass"])}] },
    INTERNET:  { label: "Internet",          total: find(["internet"]),     items: [{l:"Broadband Monthly", v:find(["internet"])}] },
    HEALTH:    { label: "Healthcare",        total: find(["doctor visit"]), items: find(["doctor visit"]) > 0 ? [{l:"Doctor Visit", v:find(["doctor visit"])}] : [] }
  };
}

// how much of your salary is left after basic expenses
function getPower(costs, sal) {
  let rent = costs.HOUSING.items[1] ? costs.HOUSING.items[1].v : 0;
  let food = costs.FOOD.items[0] ? costs.FOOD.items[0].v * 30 : 0;
  let expenses = rent + food + costs.TRANSPORT.total + costs.INTERNET.total;
  if (sal <= 0) return 0;
  return Math.max(0, Math.round(((sal - expenses) / sal) * 100));
}

// fill currency dropdown
function fillCurrencies() {
  let sel = document.getElementById("currency-select");
  let list = {};
  for (let i = 0; i < countries.length; i++) {
    if (!countries[i].currencies) continue;
    let keys = Object.keys(countries[i].currencies);
    for (let j = 0; j < keys.length; j++)
      if (!list[keys[j]]) list[keys[j]] = countries[i].currencies[keys[j]].name || keys[j];
  }
  sel.innerHTML = '<option value="">Select currency</option>';
  let sorted = Object.keys(list).sort();
  for (let i = 0; i < sorted.length; i++)
    sel.innerHTML += '<option value="' + sorted[i] + '">' + sorted[i] + ' — ' + list[sorted[i]] + '</option>';
  sel.value = "USD";
  currency = "USD";
}

// city search dropdown
function searchCities(query) {
  let ul = document.getElementById("search-results");
  ul.innerHTML = "";
  if (!query || query.length < 2) { ul.classList.remove("open"); return; }

  let q = query.toLowerCase();
  let starts = [];
  let contains = [];
  for (let i = 0; i < allCities.length; i++) {
    let c = allCities[i];
    let taken = false;
    for (let j = 0; j < picked.length; j++)
      if (picked[j].id === c.city_id) taken = true;
    if (taken) continue;
    let name = c.city_name.toLowerCase();
    if (name.indexOf(q) === 0) starts.push(c);
    else if (name.includes(q)) contains.push(c);
    if (starts.length + contains.length >= 8) break;
  }
  let found = starts.concat(contains).slice(0, 8);

  if (!found.length) {
    ul.innerHTML = '<li style="color:#999">No cities found</li>';
    ul.classList.add("open");
    return;
  }

  for (let i = 0; i < found.length; i++) {
    let li = document.createElement("li");
    li.textContent = found[i].city_name + ", " + found[i].country_name;
    li.setAttribute("data-i", i);
    li.addEventListener("click", function() {
      addCity(found[parseInt(this.getAttribute("data-i"))]);
      ul.classList.remove("open");
      document.getElementById("city-search").value = "";
    });
    ul.appendChild(li);
  }
  ul.classList.add("open");
}

function addCity(city) {
  if (picked.length >= 4) { showMsg("Max 4 cities.", "warning"); return; }
  picked.push({ id: city.city_id, name: city.city_name, country: city.country_name });
  showChips();
  document.getElementById("compare-btn").disabled = picked.length < 2;
}

function removeCity(id) {
  let newPicked = [], newResults = [];
  for (let i = 0; i < picked.length; i++)
    if (picked[i].id !== id) newPicked.push(picked[i]);
  for (let i = 0; i < results.length; i++)
    if (results[i].id !== id) newResults.push(results[i]);
  picked = newPicked;
  results = newResults;
  showChips();
  document.getElementById("compare-btn").disabled = picked.length < 2;
  if (results.length) renderCards();
  else {
    document.getElementById("dashboard").innerHTML = "";
    document.getElementById("dashboard-controls").classList.remove("visible");
  }
}

function showChips() {
  let box = document.getElementById("selected-cities");
  box.innerHTML = "";
  for (let i = 0; i < picked.length; i++) {
    let chip = document.createElement("span");
    chip.className = "city-chip";
    chip.innerHTML = '<span>' + picked[i].name + '</span><button class="chip-remove" data-id="' + picked[i].id + '">&times;</button>';
    box.appendChild(chip);
  }
  let btns = box.querySelectorAll(".chip-remove");
  for (let i = 0; i < btns.length; i++)
    btns[i].addEventListener("click", function() { removeCity(parseInt(this.getAttribute("data-id"))); });
}

// main compare - gets exchange rates then fetches prices for each city
async function doCompare() {
  salary = parseFloat(document.getElementById("salary-input").value);
  if (!salary || salary <= 0) {
    document.getElementById("salary-error").textContent = "Enter a valid salary.";
    return;
  }
  document.getElementById("salary-error").textContent = "";
  currency = document.getElementById("currency-select").value;
  if (!currency) { showMsg("Select a currency.", "warning"); return; }
  if (picked.length < 2) { showMsg("Pick at least 2 cities.", "warning"); return; }

  document.getElementById("status-message").textContent = "";
  document.getElementById("status-message").className = "status-message";
  document.getElementById("loader").classList.add("active");
  document.getElementById("dashboard").innerHTML = "";

  // get exchange rates (only need to do this once)
  if (!rates) {
    try {
      let res = await fetch("https://open.er-api.com/v6/latest/USD");
      let data = await res.json();
      if (data.result === "success") rates = data.rates;
    } catch(e) {
      showMsg("Currency conversion failed. Showing USD.", "warning");
      showUSD = true;
    }
  }

  // fetch prices for each city, use cache if we already have it
  results = [];
  let needFetch = 0;
  for (let i = 0; i < picked.length; i++)
    if (!getCache(picked[i].name, picked[i].country)) needFetch++;

  if (countRequests() + needFetch > 10) {
    document.getElementById("loader").classList.remove("active");
    showMsg("Too many requests this hour. Wait a bit or compare cities you already looked up.", "warning");
    return;
  }

  for (let i = 0; i < picked.length; i++) {
    try {
      let data = getCache(picked[i].name, picked[i].country);
      if (!data) {
        let url = "https://" + apiHost + "/prices?city_name=" + encodeURIComponent(picked[i].name)
          + "&country_name=" + encodeURIComponent(picked[i].country);
        let res = await fetch(url, {
          headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": apiHost }
        });
        data = await res.json();
        saveCache(picked[i].name, picked[i].country, data);
        logRequest();
      }
      let costs = extractCosts(data);
      results.push({
        id: picked[i].id, name: picked[i].name, country: picked[i].country,
        costs: costs, power: getPower(costs, getSalaryInUSD()), flag: getFlag(picked[i].country)
      });
    } catch(e) {
      console.log("Couldnt get data for " + picked[i].name);
    }
  }

  document.getElementById("loader").classList.remove("active");
  if (!results.length) { showMsg("Could not load data. Check your connection.", "error"); return; }
  document.getElementById("dashboard-controls").classList.add("visible");
  renderCards();
}

// draw the city cards
function renderCards() {
  let box = document.getElementById("dashboard");
  box.innerHTML = "";
  if (!results.length) return;

  let sal = getSalaryInUSD();
  let cats = ["HOUSING", "FOOD", "TRANSPORT", "INTERNET", "HEALTH"];
  for (let i = 0; i < results.length; i++)
    results[i].power = getPower(results[i].costs, sal);

  // sort
  let sortBy = document.getElementById("sort-select").value;
  results.sort(function(a, b) {
    if (sortBy === "rent") return a.costs.HOUSING.items[1].v - b.costs.HOUSING.items[1].v;
    if (sortBy === "food") return a.costs.FOOD.total - b.costs.FOOD.total;
    if (sortBy === "internet") return a.costs.INTERNET.total - b.costs.INTERNET.total;
    if (sortBy === "power") return b.power - a.power;
    let ta = 0, tb = 0;
    for (let i = 0; i < cats.length; i++) { ta += a.costs[cats[i]].total; tb += b.costs[cats[i]].total; }
    return ta - tb;
  });

  // get max cost per category for bar widths
  let filter = document.getElementById("filter-select").value;
  let maxCost = {};
  for (let i = 0; i < results.length; i++)
    for (let k = 0; k < cats.length; k++) {
      let t = results[i].costs[cats[k]].total;
      if (!maxCost[cats[k]] || t > maxCost[cats[k]]) maxCost[cats[k]] = t;
    }

  // build each card
  for (let i = 0; i < results.length; i++) {
    let city = results[i];
    let card = document.createElement("div");
    card.className = "city-card";

    let pc = city.power >= 50 ? "green" : city.power >= 25 ? "yellow" : "red";

    let h = '<div class="city-card-header">';
    if (city.flag) h += '<img src="' + city.flag + '" alt="">';
    h += '<h3>' + city.name + ' <small style="font-weight:normal;font-size:0.8em;opacity:0.65">' + city.country + '</small></h3>';
    h += '<button class="remove-city" data-id="' + city.id + '">&times;</button></div>';

    h += '<div class="power-gauge">';
    h += '<div class="power-value text-' + pc + '">' + city.power + '%</div>';
    h += '<div class="power-label">of salary remaining after basics</div>';
    h += '<div class="power-bar-track"><div class="power-bar-fill power-' + pc + '" style="width:' + city.power + '%"></div></div></div>';

    for (let k = 0; k < cats.length; k++) {
      let id = cats[k];
      if (filter !== "all" && filter !== id) continue;
      let cat = city.costs[id];
      if (!cat.items.length) continue;

      let w = maxCost[id] > 0 ? Math.round(cat.total / maxCost[id] * 100) : 0;
      let col = w < 40 ? "green" : w < 75 ? "yellow" : "red";

      h += '<div class="category-row">';
      h += '<div class="category-label"><span>' + cat.label + '</span><span class="category-cost">' + formatMoney(convertPrice(cat.total)) + '</span></div>';
      h += '<div class="cost-bar-track"><div class="cost-bar-fill bar-' + col + '" style="width:' + w + '%"></div></div>';
      h += '<div class="category-items">';
      for (let j = 0; j < cat.items.length; j++)
        h += '<div class="category-item"><span>' + cat.items[j].l + '</span><span>' + formatMoney(convertPrice(cat.items[j].v)) + '</span></div>';
      h += '</div></div>';
    }

    card.innerHTML = h;
    card.querySelector(".remove-city").addEventListener("click", function() {
      removeCity(parseInt(this.getAttribute("data-id")));
    });
    box.appendChild(card);
  }
}

// start everything when page loads
document.addEventListener("DOMContentLoaded", async function() {
  try {
    let res = await fetch("https://restcountries.com/v3.1/all?fields=name,flags,currencies,cca2");
    countries = await res.json();
    fillCurrencies();
  } catch(e) {
    showMsg("Could not load country data.", "warning");
  }

  if (apiKey) {
    // load city list from cache if we have it, otherwise fetch
    try {
      let saved = JSON.parse(localStorage.getItem("mm_cities"));
      if (saved && Date.now() - saved.time < 3600000) allCities = saved.data;
    } catch(e) {}

    if (!allCities.length) {
      try {
        let res = await fetch("https://" + apiHost + "/cities", {
          headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": apiHost }
        });
        let data = await res.json();
        allCities = data.cities || data.data || data;
        logRequest();
        try { localStorage.setItem("mm_cities", JSON.stringify({ data: allCities, time: Date.now() })); } catch(e) {}
      } catch(e) {
        showMsg("Could not load cities.", "error");
      }
    }
  } else {
    showMsg("No API key. Add it in config.js", "error");
  }

  document.getElementById("city-search").addEventListener("input", function() { searchCities(this.value); });
  document.getElementById("compare-btn").addEventListener("click", doCompare);
  document.getElementById("sort-select").addEventListener("change", function() { if (results.length) renderCards(); });
  document.getElementById("filter-select").addEventListener("change", function() { if (results.length) renderCards(); });

  document.addEventListener("click", function(e) {
    if (!e.target.closest(".city-search-group"))
      document.getElementById("search-results").classList.remove("open");
  });

  document.getElementById("currency-select").addEventListener("change", function() {
    currency = this.value;
    salary = parseFloat(document.getElementById("salary-input").value) || 0;
    if (results.length) {
      showMsg("Currency changed — make sure your salary is in " + currency + ", then click Compare again.", "warning");
      renderCards();
    }
  });

  document.getElementById("toggle-local").addEventListener("click", function() {
    showUSD = false;
    this.classList.add("active");
    document.getElementById("toggle-usd").classList.remove("active");
    if (results.length) renderCards();
  });
  document.getElementById("toggle-usd").addEventListener("click", function() {
    showUSD = true;
    this.classList.add("active");
    document.getElementById("toggle-local").classList.remove("active");
    if (results.length) renderCards();
  });

  document.getElementById("salary-input").addEventListener("input", function() {
    let v = parseFloat(this.value);
    document.getElementById("salary-error").textContent = (this.value && (!v || v <= 0)) ? "Enter a positive number." : "";
  });
});
