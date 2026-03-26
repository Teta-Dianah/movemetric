// globals
var countriesData = [], exchangeRates = null;
var selectedCities = [], comparisonData = [];
var showUSD = false, userCurrency = "", userSalary = 0;
var cats = ["HOUSING", "FOOD", "TRANSPORT", "INTERNET", "HEALTH"];

// city cost data (USD/month) from Numbeo public indices
// [lgRent, mdRent, smRent, meal, coffee, beer, transport, internet, doctor]
var cities = {
  "new-york":      {n:"New York",      co:"US", s:62, c:[4200,3000,2200,25,5.5,9,132,65,200]},
  "san-francisco": {n:"San Francisco", co:"US", s:68, c:[4500,3200,2400,22,5.5,8,98,60,200]},
  "los-angeles":   {n:"Los Angeles",   co:"US", s:58, c:[3500,2500,1800,20,5,8,100,55,180]},
  "chicago":       {n:"Chicago",       co:"US", s:57, c:[2800,1800,1400,18,4.5,7,105,50,160]},
  "miami":         {n:"Miami",         co:"US", s:55, c:[3200,2200,1600,18,4.5,7,112,55,150]},
  "toronto":       {n:"Toronto",       co:"CA", s:59, c:[3000,2000,1500,16,4,6,128,55,0]},
  "vancouver":     {n:"Vancouver",     co:"CA", s:62, c:[3200,2200,1600,16,4,6,100,55,0]},
  "mexico-city":   {n:"Mexico City",   co:"MX", s:45, c:[1500,800,500,6,3,3,20,20,20]},
  "london":        {n:"London",        co:"GB", s:64, c:[3500,2500,1800,18,4.5,7,185,40,0]},
  "paris":         {n:"Paris",         co:"FR", s:61, c:[2800,1800,1200,16,4,7,85,35,30]},
  "berlin":        {n:"Berlin",        co:"DE", s:67, c:[2000,1300,900,12,3.5,4,86,30,30]},
  "amsterdam":     {n:"Amsterdam",     co:"NL", s:65, c:[2800,1800,1200,16,3.5,6,100,40,25]},
  "madrid":        {n:"Madrid",        co:"ES", s:58, c:[1800,1100,800,13,2,4,55,35,25]},
  "barcelona":     {n:"Barcelona",     co:"ES", s:57, c:[2000,1200,850,13,2.5,4,55,35,25]},
  "dublin":        {n:"Dublin",        co:"IE", s:60, c:[3000,2000,1500,18,4,7,120,55,60]},
  "vienna":        {n:"Vienna",        co:"AT", s:70, c:[1800,1100,800,14,4,5,51,30,25]},
  "zurich":        {n:"Zurich",        co:"CH", s:72, c:[4000,2800,2000,30,5.5,8,88,50,120]},
  "prague":        {n:"Prague",        co:"CZ", s:56, c:[1500,900,650,8,3,3,30,20,30]},
  "warsaw":        {n:"Warsaw",        co:"PL", s:55, c:[1400,800,600,8,3,3,28,15,25]},
  "budapest":      {n:"Budapest",      co:"HU", s:54, c:[1200,700,500,8,2.5,2.5,30,15,25]},
  "tokyo":         {n:"Tokyo",         co:"JP", s:63, c:[3000,1800,1100,10,4,5,75,40,30]},
  "seoul":         {n:"Seoul",         co:"KR", s:55, c:[2500,1400,800,9,4.5,5,55,25,20]},
  "singapore":     {n:"Singapore",     co:"SG", s:70, c:[4000,2800,1800,12,4.5,8,80,30,60]},
  "bangkok":       {n:"Bangkok",       co:"TH", s:48, c:[1200,600,400,4,2,3,30,15,20]},
  "dubai":         {n:"Dubai",         co:"AE", s:59, c:[3500,2200,1500,12,5,8,80,60,50]},
  "mumbai":        {n:"Mumbai",        co:"IN", s:40, c:[1500,700,350,3,2,3,12,12,8]},
  "hong-kong":     {n:"Hong Kong",     co:"HK", s:56, c:[4500,2800,1800,10,5,7,60,25,70]},
  "shanghai":      {n:"Shanghai",      co:"CN", s:50, c:[2500,1400,800,5,4,4,15,15,20]},
  "lagos":         {n:"Lagos",         co:"NG", s:35, c:[2000,1000,600,6,3,3,30,25,20]},
  "nairobi":       {n:"Nairobi",       co:"KE", s:38, c:[1500,800,450,5,2.5,3,30,20,15]},
  "cape-town":     {n:"Cape Town",     co:"ZA", s:48, c:[1800,1000,650,8,2.5,3,40,30,30]},
  "johannesburg":  {n:"Johannesburg",  co:"ZA", s:42, c:[1500,850,550,7,2.5,3,35,30,25]},
  "cairo":         {n:"Cairo",         co:"EG", s:36, c:[800,400,250,4,2,2,12,10,10]},
  "accra":         {n:"Accra",         co:"GH", s:37, c:[1200,650,400,5,3,3,20,30,15]},
  "sao-paulo":     {n:"São Paulo",     co:"BR", s:45, c:[1800,1000,600,8,2.5,3,35,20,30]},
  "buenos-aires":  {n:"Buenos Aires",  co:"AR", s:48, c:[1200,700,450,8,2.5,3,20,20,10]},
  "sydney":        {n:"Sydney",        co:"AU", s:62, c:[3500,2200,1500,18,4,8,140,55,60]},
  "melbourne":     {n:"Melbourne",     co:"AU", s:60, c:[2800,1800,1200,16,4,7,120,50,55]}
};

// get cost breakdown from compact data
function getCosts(slug) {
  var c = cities[slug].c;
  return {
    HOUSING:   {label:"Housing",         total:c[0]+c[1]+c[2], items:[{l:"Large Apartment",v:c[0]},{l:"Medium Apartment",v:c[1]},{l:"Small Apartment",v:c[2]}]},
    FOOD:      {label:"Food & Daily Life",total:c[3]+c[4]+c[5], items:[{l:"Restaurant Meal",v:c[3]},{l:"Cappuccino",v:c[4]},{l:"Beer (Import)",v:c[5]}]},
    TRANSPORT: {label:"Transportation",   total:c[6], items:[{l:"Monthly Transport Pass",v:c[6]}]},
    INTERNET:  {label:"Internet",         total:c[7], items:[{l:"Broadband Monthly",v:c[7]}]},
    HEALTH:    {label:"Healthcare",       total:c[8], items:c[8]>0?[{l:"Doctor Visit",v:c[8]}]:[]}
  };
}

// purchasing power = % salary left after rent + transport + food
function calcPower(costs, sal) {
  var exp = costs.HOUSING.items[1].v + costs.TRANSPORT.total + costs.FOOD.items[0].v * 30;
  return sal <= 0 ? 0 : Math.max(0, Math.round(((sal - exp) / sal) * 100));
}

// convert USD to user currency
function convert(usd) {
  if (showUSD || !exchangeRates || !userCurrency) return usd;
  return usd * (exchangeRates.rates[userCurrency] || 1);
}

function salaryInUSD() {
  if (!exchangeRates || !userCurrency) return userSalary;
  var r = exchangeRates.rates[userCurrency];
  return r > 0 ? userSalary / r : userSalary;
}

function money(amt) {
  var code = (showUSD ? "USD" : userCurrency) || "USD";
  var sym = code + " ";
  for (var i = 0; i < countriesData.length; i++) {
    var cur = countriesData[i].currencies;
    if (cur && cur[code] && cur[code].symbol) { sym = cur[code].symbol; break; }
  }
  return amt >= 1000 ? sym + Math.round(amt).toLocaleString() : sym + amt.toFixed(2);
}

function getFlag(name) {
  var code = "";
  for (var s in cities) { if (cities[s].n === name) { code = cities[s].co; break; } }
  if (!code) return "";
  for (var i = 0; i < countriesData.length; i++) {
    if (countriesData[i].cca2 === code) return countriesData[i].flags.png;
  }
  return "";
}

function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

// show a message to the user
function msg(text, type) {
  var el = document.getElementById("status-message");
  el.className = "status-message " + (type || "info");
  el.innerHTML = esc(text);
}
function clearMsg() {
  var el = document.getElementById("status-message");
  el.className = "status-message"; el.innerHTML = "";
}

// populate currency dropdown from REST Countries data
function fillCurrencySelect() {
  var sel = document.getElementById("currency-select"), list = {};
  countriesData.forEach(function(c) {
    if (!c.currencies) return;
    Object.keys(c.currencies).forEach(function(k) { if (!list[k]) list[k] = c.currencies[k].name || k; });
  });
  sel.innerHTML = '<option value="">Select currency</option>';
  Object.keys(list).sort().forEach(function(k) {
    sel.innerHTML += '<option value="'+k+'">'+k+' — '+list[k]+'</option>';
  });
  sel.value = "USD"; userCurrency = "USD";
}

// city search dropdown
function search(q) {
  var ul = document.getElementById("search-results");
  ul.innerHTML = "";
  if (!q || q.length < 2) { ul.classList.remove("open"); return; }
  var low = q.toLowerCase();
  var cityList = Object.keys(cities).map(function(s) { return {name: cities[s].n, slug: s}; });
  var hits = cityList.filter(function(c) {
    var taken = selectedCities.some(function(s) { return s.slug === c.slug; });
    return !taken && c.name.toLowerCase().indexOf(low) !== -1;
  }).slice(0, 8);

  if (!hits.length) { ul.innerHTML = '<li style="color:#999">No cities found.</li>'; ul.classList.add("open"); return; }
  hits.forEach(function(city) {
    var li = document.createElement("li");
    li.textContent = city.name;
    li.onclick = function() { addCity(city); ul.classList.remove("open"); document.getElementById("city-search").value = ""; };
    ul.appendChild(li);
  });
  ul.classList.add("open");
}

function addCity(city) {
  if (selectedCities.length >= 4) { msg("Max 4 cities.", "warning"); return; }
  if (selectedCities.some(function(s) { return s.slug === city.slug; })) return;
  selectedCities.push(city);
  renderChips();
  document.getElementById("compare-btn").disabled = selectedCities.length < 2;
}

function removeCity(slug) {
  selectedCities = selectedCities.filter(function(c) { return c.slug !== slug; });
  comparisonData = comparisonData.filter(function(c) { return c.slug !== slug; });
  renderChips();
  document.getElementById("compare-btn").disabled = selectedCities.length < 2;
  comparisonData.length ? renderDashboard() : (document.getElementById("dashboard").innerHTML = "", document.getElementById("dashboard-controls").classList.remove("visible"));
}

function renderChips() {
  var box = document.getElementById("selected-cities");
  box.innerHTML = "";
  selectedCities.forEach(function(city) {
    var chip = document.createElement("span");
    chip.className = "city-chip";
    chip.innerHTML = '<span>'+esc(city.name)+'</span><button class="chip-remove">&times;</button>';
    chip.querySelector("button").onclick = function() { removeCity(city.slug); };
    box.appendChild(chip);
  });
}

// main comparison
function compare() {
  userSalary = parseFloat(document.getElementById("salary-input").value);
  if (!userSalary || userSalary <= 0) { document.getElementById("salary-error").textContent = "Enter a valid salary."; return; }
  document.getElementById("salary-error").textContent = "";
  userCurrency = document.getElementById("currency-select").value;
  if (!userCurrency) { msg("Select a currency.", "warning"); return; }
  if (selectedCities.length < 2) { msg("Pick at least 2 cities.", "warning"); return; }

  clearMsg();
  document.getElementById("loader").classList.add("active");
  document.getElementById("dashboard").innerHTML = "";
  document.getElementById("dashboard-controls").classList.remove("visible");

  var p = exchangeRates ? Promise.resolve() : fetch("https://open.er-api.com/v6/latest/USD")
    .then(function(r) { return r.json(); })
    .then(function(d) { if (d.result === "success") exchangeRates = d; })
    .catch(function() { msg("Currency conversion unavailable. Showing USD.", "warning"); showUSD = true; });

  p.then(function() {
    document.getElementById("loader").classList.remove("active");
    comparisonData = [];
    var sal = salaryInUSD();
    selectedCities.forEach(function(city) {
      if (!cities[city.slug]) return;
      var costs = getCosts(city.slug);
      comparisonData.push({ slug:city.slug, name:city.name, costs:costs, power:calcPower(costs,sal), score:cities[city.slug].s, flag:getFlag(city.name) });
    });
    if (!comparisonData.length) { msg("No data available.", "error"); return; }
    document.getElementById("dashboard-controls").classList.add("visible");
    renderDashboard();
  });
}

// render dashboard cards
function renderDashboard() {
  var box = document.getElementById("dashboard");
  box.innerHTML = "";
  if (!comparisonData.length) return;

  // sort
  var by = document.getElementById("sort-select").value;
  comparisonData.sort(function(a, b) {
    if (by === "rent") return a.costs.HOUSING.items[1].v - b.costs.HOUSING.items[1].v;
    if (by === "food") return a.costs.FOOD.total - b.costs.FOOD.total;
    if (by === "internet") return a.costs.INTERNET.total - b.costs.INTERNET.total;
    if (by === "power") return b.power - a.power;
    var ta = 0, tb = 0;
    cats.forEach(function(k) { ta += a.costs[k].total; tb += b.costs[k].total; });
    return ta - tb;
  });

  var filter = document.getElementById("filter-select").value;
  var maxC = {};
  comparisonData.forEach(function(city) { cats.forEach(function(id) { if (!maxC[id] || city.costs[id].total > maxC[id]) maxC[id] = city.costs[id].total; }); });

  comparisonData.forEach(function(city) {
    var card = document.createElement("div");
    card.className = "city-card";
    var pw = city.power, pc = pw >= 50 ? "green" : pw >= 25 ? "yellow" : "red";

    var h = '<div class="city-card-header">'+(city.flag?'<img src="'+city.flag+'" alt="">':'')+'<h3>'+esc(city.name)+'</h3><button class="remove-city">&times;</button></div>';
    h += '<div class="power-gauge"><div class="power-value text-'+pc+'">'+pw+'%</div><div class="power-label">of salary remaining after basics</div>';
    h += '<div class="power-bar-track"><div class="power-bar-fill power-'+pc+'" style="width:'+pw+'%"></div></div></div>';
    if (city.score) h += '<div class="city-score">Quality of Life: '+city.score+'/100</div>';

    cats.forEach(function(id) {
      if (filter !== "all" && filter !== id) return;
      var cat = city.costs[id];
      if (!cat.items.length) return;
      var pct = maxC[id] > 0 ? cat.total / maxC[id] * 100 : 0;
      var r = maxC[id] > 0 ? cat.total / maxC[id] : 0;
      var col = r < 0.4 ? "green" : r < 0.7 ? "yellow" : "red";
      h += '<div class="category-row"><div class="category-label"><span>'+cat.label+'</span><span class="category-cost">'+money(convert(cat.total))+'</span></div>';
      h += '<div class="cost-bar-track"><div class="cost-bar-fill bar-'+col+'" style="width:'+Math.round(pct)+'%"></div></div><div class="category-items">';
      cat.items.forEach(function(it) { h += '<div class="category-item"><span>'+esc(it.l)+'</span><span>'+money(convert(it.v))+'</span></div>'; });
      h += '</div></div>';
    });

    card.innerHTML = h;
    card.querySelector(".remove-city").onclick = function() { removeCity(city.slug); };
    box.appendChild(card);
  });
}

// start app
document.addEventListener("DOMContentLoaded", function() {
  // load country data for flags and currencies
  fetch("https://restcountries.com/v3.1/all?fields=name,flags,currencies,cca2")
    .then(function(r) { return r.json(); })
    .then(function(d) { countriesData = d; fillCurrencySelect(); })
    .catch(function() { msg("Could not load country data.", "warning"); });

  // events
  document.getElementById("city-search").addEventListener("input", function() { search(this.value); });
  document.addEventListener("click", function(e) { if (!e.target.closest(".city-search-group")) document.getElementById("search-results").classList.remove("open"); });
  document.getElementById("currency-select").addEventListener("change", function() { userCurrency = this.value; if (comparisonData.length) renderDashboard(); });
  document.getElementById("compare-btn").addEventListener("click", compare);
  document.getElementById("sort-select").addEventListener("change", function() { if (comparisonData.length) renderDashboard(); });
  document.getElementById("filter-select").addEventListener("change", function() { if (comparisonData.length) renderDashboard(); });
  document.getElementById("toggle-local").addEventListener("click", function() { showUSD=false; this.classList.add("active"); document.getElementById("toggle-usd").classList.remove("active"); if(comparisonData.length) renderDashboard(); });
  document.getElementById("toggle-usd").addEventListener("click", function() { showUSD=true; this.classList.add("active"); document.getElementById("toggle-local").classList.remove("active"); if(comparisonData.length) renderDashboard(); });
  document.getElementById("salary-input").addEventListener("input", function() { var v=parseFloat(this.value); document.getElementById("salary-error").textContent=(this.value&&(!v||v<=0))?"Enter a positive number.":""; });
});
