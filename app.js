// API key from config.js
let apiKey = (typeof RAPIDAPI_KEY !== "undefined") ? RAPIDAPI_KEY : "";
let apiHost = "cost-of-living-and-prices.p.rapidapi.com";

// all my global variables
let countries = [];
let rates = null;
let allCities = [];
let picked = [];
let results = [];
let showUSD = false;
let currency = "";
let salary = 0;

// when the page loads, set everything up
document.addEventListener("DOMContentLoaded", async function() {

  // get country data for flags and currency list
  try {
    let res = await fetch("https://restcountries.com/v3.1/all?fields=name,flags,currencies,cca2");
    countries = await res.json();
    fillCurrencyDropdown();
  } catch(e) {
    showMsg("Could not load country data.", "warning");
  }

  // get city list from API
  if (apiKey) {
    try {
      let res = await fetch("https://" + apiHost + "/cities", {
        headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": apiHost }
      });
      let data = await res.json();
      allCities = data.cities || data.data || data;
      console.log("Loaded " + allCities.length + " cities");
    } catch(e) {
      showMsg("Could not load city list. Check your connection.", "error");
    }
  } else {
    showMsg("No API key. Add your key in config.js", "error");
  }

  // event listeners
  document.getElementById("city-search").addEventListener("input", function() {
    searchCities(this.value);
  });

  document.getElementById("compare-btn").addEventListener("click", doCompare);

  document.getElementById("sort-select").addEventListener("change", function() {
    if (results.length) renderCards();
  });
  document.getElementById("filter-select").addEventListener("change", function() {
    if (results.length) renderCards();
  });

  // close dropdown when you click outside
  document.addEventListener("click", function(e) {
    if (!e.target.closest(".city-search-group")) {
      document.getElementById("search-results").classList.remove("open");
    }
  });

  document.getElementById("currency-select").addEventListener("change", function() {
    currency = this.value;
    salary = parseFloat(document.getElementById("salary-input").value) || 0;
    if (results.length) renderCards();
  });

  // local/usd toggle
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

  // check salary input
  document.getElementById("salary-input").addEventListener("input", function() {
    let val = parseFloat(this.value);
    if (this.value && (!val || val <= 0)) {
      document.getElementById("salary-error").textContent = "Enter a positive number.";
    } else {
      document.getElementById("salary-error").textContent = "";
    }
  });
});


// fill the currency dropdown with all currencies from REST Countries
function fillCurrencyDropdown() {
  let select = document.getElementById("currency-select");
  let currencyList = {};

  for (let i = 0; i < countries.length; i++) {
    let cur = countries[i].currencies;
    if (!cur) continue;
    let keys = Object.keys(cur);
    for (let j = 0; j < keys.length; j++) {
      if (!currencyList[keys[j]]) {
        currencyList[keys[j]] = cur[keys[j]].name || keys[j];
      }
    }
  }

  select.innerHTML = '<option value="">Select currency</option>';
  let sorted = Object.keys(currencyList).sort();
  for (let i = 0; i < sorted.length; i++) {
    let code = sorted[i];
    select.innerHTML += '<option value="' + code + '">' + code + ' — ' + currencyList[code] + '</option>';
  }
  select.value = "USD";
  currency = "USD";
}


// search cities as user types
function searchCities(query) {
  let ul = document.getElementById("search-results");
  ul.innerHTML = "";

  if (!query || query.length < 2) {
    ul.classList.remove("open");
    return;
  }

  let q = query.toLowerCase();
  let count = 0;
  let found = [];

  for (let i = 0; i < allCities.length; i++) {
    if (count >= 8) break;
    let city = allCities[i];

    // skip if already picked
    let alreadyPicked = false;
    for (let j = 0; j < picked.length; j++) {
      if (picked[j].id === city.city_id) { alreadyPicked = true; break; }
    }
    if (alreadyPicked) continue;

    if (city.city_name.toLowerCase().includes(q)) {
      found.push(city);
      count++;
    }
  }

  if (found.length === 0) {
    ul.innerHTML = '<li style="color:#999">No cities found</li>';
    ul.classList.add("open");
    return;
  }

  for (let i = 0; i < found.length; i++) {
    let li = document.createElement("li");
    li.textContent = found[i].city_name + ", " + found[i].country_name;

    // need this so the click handler gets the right city
    li.setAttribute("data-index", i);
    li.addEventListener("click", function() {
      let idx = parseInt(this.getAttribute("data-index"));
      let c = found[idx];
      addCity(c);
      ul.classList.remove("open");
      document.getElementById("city-search").value = "";
    });

    ul.appendChild(li);
  }
  ul.classList.add("open");
}


function addCity(city) {
  if (picked.length >= 4) {
    showMsg("Max 4 cities.", "warning");
    return;
  }
  picked.push({ id: city.city_id, name: city.city_name, country: city.country_name });
  showChips();
  document.getElementById("compare-btn").disabled = picked.length < 2;
}

function removeCity(cityId) {
  let newPicked = [];
  for (let i = 0; i < picked.length; i++) {
    if (picked[i].id !== cityId) newPicked.push(picked[i]);
  }
  picked = newPicked;

  let newResults = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i].id !== cityId) newResults.push(results[i]);
  }
  results = newResults;

  showChips();
  document.getElementById("compare-btn").disabled = picked.length < 2;

  if (results.length > 0) {
    renderCards();
  } else {
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
  // add click handlers to remove buttons
  let buttons = box.querySelectorAll(".chip-remove");
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener("click", function() {
      removeCity(parseInt(this.getAttribute("data-id")));
    });
  }
}


// this takes the API response and pulls out the prices we need
function extractCosts(apiData) {
  let prices = apiData.prices || apiData.data || [];

  // helper to search for a price by keywords
  function findItem(keywords) {
    for (let i = 0; i < prices.length; i++) {
      let itemName = (prices[i].item_name || prices[i].name || "").toLowerCase();
      let found = true;
      for (let k = 0; k < keywords.length; k++) {
        if (itemName.indexOf(keywords[k]) === -1) {
          found = false;
          break;
        }
      }
      if (found) {
        // the API gives us USD prices in usd.avg
        if (prices[i].usd && prices[i].usd.avg) return parseFloat(prices[i].usd.avg);
        return prices[i].avg || 0;
      }
    }
    return 0;
  }

  let bigRent   = findItem(["three bedroom", "in city"]);
  let medRent   = findItem(["one bedroom", "in city"]);
  let smallRent = findItem(["one bedroom", "outside"]);
  if (smallRent === 0) smallRent = Math.round(medRent * 0.75); // estimate if missing

  let meal    = findItem(["meal", "inexpensive"]);
  let coffee  = findItem(["cappuccino"]);
  let beer    = findItem(["imported beer"]);
  let transit = findItem(["monthly pass"]);
  let wifi    = findItem(["internet"]);
  let doctor  = findItem(["doctor visit"]);

  return {
    HOUSING:   { label: "Housing",          total: bigRent + medRent + smallRent, items: [{l: "Large Apartment (3br)", v: bigRent}, {l: "Medium Apartment (1br)", v: medRent}, {l: "Small Apartment (outside)", v: smallRent}] },
    FOOD:      { label: "Food & Daily Life", total: meal + coffee + beer,         items: [{l: "Restaurant Meal", v: meal}, {l: "Cappuccino", v: coffee}, {l: "Beer (Imported)", v: beer}] },
    TRANSPORT: { label: "Transportation",    total: transit,                       items: [{l: "Monthly Transport Pass", v: transit}] },
    INTERNET:  { label: "Internet",          total: wifi,                          items: [{l: "Broadband Monthly", v: wifi}] },
    HEALTH:    { label: "Healthcare",        total: doctor,                        items: doctor > 0 ? [{l: "Doctor Visit", v: doctor}] : [] }
  };
}


// convert salary to USD using exchange rate
function getSalaryInUSD() {
  if (!rates || !currency) return salary;
  let rate = rates[currency];
  if (rate > 0) return salary / rate;
  return salary;
}

// convert a USD price to the users currency
function convertPrice(usdAmount) {
  if (showUSD || !rates || !currency) return usdAmount;
  return usdAmount * (rates[currency] || 1);
}

// format number as money
function formatMoney(amount) {
  let code = showUSD ? "USD" : (currency || "USD");
  if (amount >= 1000) return code + " " + Math.round(amount).toLocaleString();
  return code + " " + amount.toFixed(2);
}

// calculate purchasing power - how much salary is left after rent, food, transport, internet
function getPurchasingPower(costs, salaryUSD) {
  let rent = costs.HOUSING.items[1] ? costs.HOUSING.items[1].v : 0; // 1br apartment
  let food = costs.FOOD.items[0] ? costs.FOOD.items[0].v * 30 : 0;  // meals per month
  let transport = costs.TRANSPORT.total;
  let internet = costs.INTERNET.total;
  let monthlyExpenses = rent + food + transport + internet;

  if (salaryUSD <= 0) return 0;
  let remaining = (salaryUSD - monthlyExpenses) / salaryUSD;
  return Math.max(0, Math.round(remaining * 100));
}

// get flag URL for a country
function getFlag(countryName) {
  for (let i = 0; i < countries.length; i++) {
    if (countries[i].name && countries[i].name.common) {
      if (countries[i].name.common.toLowerCase() === countryName.toLowerCase()) {
        return countries[i].flags.png;
      }
    }
  }
  return "";
}

function showMsg(text, type) {
  let el = document.getElementById("status-message");
  el.className = "status-message " + (type || "info");
  el.textContent = text;
}


// main compare function
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

  // clear old stuff
  document.getElementById("status-message").textContent = "";
  document.getElementById("status-message").className = "status-message";
  document.getElementById("loader").classList.add("active");
  document.getElementById("dashboard").innerHTML = "";

  // get exchange rates first (only once)
  if (!rates) {
    try {
      let res = await fetch("https://open.er-api.com/v6/latest/USD");
      let data = await res.json();
      if (data.result === "success") {
        rates = data.rates;
        console.log("Got exchange rates");
      }
    } catch(e) {
      showMsg("Currency conversion failed. Showing USD.", "warning");
      showUSD = true;
    }
  }

  // now fetch prices for each city
  results = [];
  for (let i = 0; i < picked.length; i++) {
    try {
      let url = "https://" + apiHost + "/prices"
        + "?city_name=" + encodeURIComponent(picked[i].name)
        + "&country_name=" + encodeURIComponent(picked[i].country);

      let res = await fetch(url, {
        headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": apiHost }
      });
      let data = await res.json();
      let costs = extractCosts(data);

      results.push({
        id: picked[i].id,
        name: picked[i].name,
        country: picked[i].country,
        costs: costs,
        power: getPurchasingPower(costs, getSalaryInUSD()),
        flag: getFlag(picked[i].country)
      });
    } catch(e) {
      console.log("Failed to get data for " + picked[i].name);
    }
  }

  document.getElementById("loader").classList.remove("active");

  if (results.length === 0) {
    showMsg("Could not load data. Check your connection.", "error");
    return;
  }

  document.getElementById("dashboard-controls").classList.add("visible");
  renderCards();
}


// draw the comparison cards on the page
function renderCards() {
  let dashboard = document.getElementById("dashboard");
  dashboard.innerHTML = "";
  if (results.length === 0) return;

  let salUSD = getSalaryInUSD();
  let categories = ["HOUSING", "FOOD", "TRANSPORT", "INTERNET", "HEALTH"];

  // update purchasing power
  for (let i = 0; i < results.length; i++) {
    results[i].power = getPurchasingPower(results[i].costs, salUSD);
  }

  // sorting
  let sortBy = document.getElementById("sort-select").value;
  results.sort(function(a, b) {
    if (sortBy === "rent") return a.costs.HOUSING.items[1].v - b.costs.HOUSING.items[1].v;
    if (sortBy === "food") return a.costs.FOOD.total - b.costs.FOOD.total;
    if (sortBy === "internet") return a.costs.INTERNET.total - b.costs.INTERNET.total;
    if (sortBy === "power") return b.power - a.power;

    // default sort by total cost
    let totalA = 0, totalB = 0;
    for (let i = 0; i < categories.length; i++) {
      totalA += a.costs[categories[i]].total;
      totalB += b.costs[categories[i]].total;
    }
    return totalA - totalB;
  });

  // figure out the max cost in each category (for the bar widths)
  let filterValue = document.getElementById("filter-select").value;
  let maxInCategory = {};
  for (let i = 0; i < results.length; i++) {
    for (let k = 0; k < categories.length; k++) {
      let catId = categories[k];
      let total = results[i].costs[catId].total;
      if (!maxInCategory[catId] || total > maxInCategory[catId]) {
        maxInCategory[catId] = total;
      }
    }
  }

  // build a card for each city
  for (let i = 0; i < results.length; i++) {
    let city = results[i];
    let card = document.createElement("div");
    card.className = "city-card";

    // power gauge color
    let powerColor = "red";
    if (city.power >= 50) powerColor = "green";
    else if (city.power >= 25) powerColor = "yellow";

    // start building the HTML
    let html = '<div class="city-card-header">';
    if (city.flag) html += '<img src="' + city.flag + '" alt="">';
    html += '<h3>' + city.name + ' <small style="font-weight:normal;font-size:0.8em;opacity:0.65">' + city.country + '</small></h3>';
    html += '<button class="remove-city" data-id="' + city.id + '">&times;</button></div>';

    html += '<div class="power-gauge">';
    html += '<div class="power-value text-' + powerColor + '">' + city.power + '%</div>';
    html += '<div class="power-label">of salary remaining after basics</div>';
    html += '<div class="power-bar-track"><div class="power-bar-fill power-' + powerColor + '" style="width:' + city.power + '%"></div></div>';
    html += '</div>';

    // add each cost category
    for (let k = 0; k < categories.length; k++) {
      let catId = categories[k];
      if (filterValue !== "all" && filterValue !== catId) continue;

      let cat = city.costs[catId];
      if (cat.items.length === 0) continue;

      // bar width is relative to the most expensive city
      let barWidth = 0;
      if (maxInCategory[catId] > 0) {
        barWidth = Math.round(cat.total / maxInCategory[catId] * 100);
      }

      // pick color - green if cheap, yellow if mid, red if expensive
      let barColor = "red";
      if (barWidth < 40) barColor = "green";
      else if (barWidth < 75) barColor = "yellow";

      html += '<div class="category-row">';
      html += '<div class="category-label"><span>' + cat.label + '</span>';
      html += '<span class="category-cost">' + formatMoney(convertPrice(cat.total)) + '</span></div>';
      html += '<div class="cost-bar-track"><div class="cost-bar-fill bar-' + barColor + '" style="width:' + barWidth + '%"></div></div>';

      // individual items
      html += '<div class="category-items">';
      for (let j = 0; j < cat.items.length; j++) {
        html += '<div class="category-item">';
        html += '<span>' + cat.items[j].l + '</span>';
        html += '<span>' + formatMoney(convertPrice(cat.items[j].v)) + '</span>';
        html += '</div>';
      }
      html += '</div></div>';
    }

    card.innerHTML = html;

    // remove button click
    let removeBtn = card.querySelector(".remove-city");
    removeBtn.addEventListener("click", function() {
      removeCity(parseInt(this.getAttribute("data-id")));
    });

    dashboard.appendChild(card);
  }
}
