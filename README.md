# MoveMetric

**Compare your salary across cities worldwide.** Enter your monthly salary, pick cities you're considering, and instantly see a side-by-side cost of living breakdown — all converted to your own currency.

## What It Does

MoveMetric shows you how far your salary stretches in different cities around the world. It calculates a **Purchasing Power Score** (percentage of salary remaining after rent, food, and transport) and converts all costs to your local currency using real-time exchange rates, so you can make informed relocation decisions at a glance.

## How to Run Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/<your-username>/movemetric.git
   cd movemetric
   ```
2. Open `index.html` in any modern browser.

That's it — no build tools, no dependencies, no server required.

> **Important:** Before using the app, open `app.js` and replace `YOUR_RAPIDAPI_KEY_HERE` on line 6 with your free RapidAPI key. Get one at [rapidapi.com/traveltables/api/cost-of-living-and-prices](https://rapidapi.com/traveltables/api/cost-of-living-and-prices).

## How to Use

1. Enter your **monthly salary** (e.g., 3000).
2. Select your **currency** from the dropdown (e.g., USD, KES, RWF, GBP).
3. **Search for cities** — type a city name (searches ~8,000 cities live from the API), then click to add it. Select 2–4 cities.
4. Click **Compare Cities**.
5. The dashboard shows each city with:
   - **Purchasing Power Score** — percentage of salary left after basic expenses
   - **Cost breakdowns** by category: Housing, Food, Transport, Internet, Healthcare
   - **Visual bars** indicating relative cost (green = cheap, yellow = moderate, red = expensive)
   - **Country flag** and country name
6. Use the controls to:
   - **Sort** by affordability, rent, food cost, purchasing power, or internet cost
   - **Filter** to show only specific expense categories
   - **Toggle** between your local currency and USD
   - **Remove** a city and add a different one without resetting

## APIs and Data Sources

### 1. Cost of Living and Prices API — TravelTables (via RapidAPI)
- **Purpose:** Primary data source. Provides 55+ price items (rent, groceries, coffee, transport, internet, healthcare, etc.) across ~8,000 cities worldwide
- **Documentation:** [https://rapidapi.com/traveltables/api/cost-of-living-and-prices](https://rapidapi.com/traveltables/api/cost-of-living-and-prices)
- **Endpoints used:**
  - `GET /cities` — loads the full list of ~8,000 available cities for the search feature
  - `GET /prices?city_name=London&country_name=United Kingdom` — fetches all price items for a specific city
- **Authentication:** Requires a free RapidAPI key. Sign up at [rapidapi.com](https://rapidapi.com) and subscribe to the free tier (500 req/month).
- **Setup:** Open `app.js` and replace `YOUR_RAPIDAPI_KEY_HERE` on line 6 with your key.
- **Free tier:** 500 requests/month. Results are cached in `localStorage` for 24 hours to minimise API usage.

### 2. ExchangeRate API (Live)
- **Purpose:** Converts all costs from USD to the user's selected currency using real-time rates
- **Documentation:** [https://open.er-api.com/](https://open.er-api.com/)
- **Endpoint used:** `GET /v6/latest/USD` — returns current exchange rates for all currencies
- **Authentication:** None required. Free and open.

### 3. REST Countries API (Live)
- **Purpose:** Provides country flags, currency names, and symbols for the UI
- **Documentation:** [https://restcountries.com/](https://restcountries.com/)
- **Endpoint used:** `GET /v3.1/all?fields=name,flags,currencies,cca2`
- **Authentication:** None required. Free and open.

## Error Handling

- **City not found:** The search only shows cities with available data, preventing dead ends.
- **Exchange rate failure:** Falls back to displaying prices in USD with a notice.
- **Individual city failure:** Shows partial results for successful cities with a warning for the failed one.
- **Invalid salary:** Inline validation prevents submission of non-positive numbers.
- **Network errors:** Displays a clear message with a retry button.

## Deployment to Web Servers

### Prerequisites
- Two web servers (Web01, Web02) running Nginx
- One load balancer (Lb01) running Nginx or HAProxy

### Step 1: Deploy to Web01 and Web02

On each web server, copy the application files to the Nginx document root:

```bash
sudo mkdir -p /var/www/html/movemetric
sudo cp index.html style.css app.js /var/www/html/movemetric/
```

Ensure Nginx is configured to serve the directory. In `/etc/nginx/sites-available/default`:

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/html/movemetric;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

Restart Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

Repeat on both Web01 and Web02.

### Step 2: Configure the Load Balancer (Lb01)

On Lb01, configure Nginx as a reverse proxy. Edit `/etc/nginx/sites-available/default`:

```nginx
upstream movemetric_backend {
    server <Web01_IP>;
    server <Web02_IP>;
}

server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://movemetric_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Restart Nginx on Lb01:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Step 3: Verify

1. Access the app via `http://<Lb01_IP>/` in a browser.
2. Refresh multiple times — traffic should alternate between Web01 and Web02 (check with `sudo tail -f /var/log/nginx/access.log` on each server).
3. Test the full flow: enter salary, select cities, compare, sort, filter, toggle currency.

## File Structure

```
movemetric/
├── index.html       # Application UI
├── style.css        # Styling
├── app.js           # All application logic — API calls, rendering, interactions
├── .gitignore       # Excludes unnecessary files
└── README.md        # This file
```

## Tech Stack

- HTML, CSS, JavaScript (vanilla — no frameworks or libraries)
- All API calls use the browser's native `fetch()` API
- No backend, database, or build tools required

## Challenges

- **Teleport API discontinued:** The originally planned primary data source (Teleport API) was shut down before this project was completed. The app was migrated to the TravelTables Cost of Living and Prices API, which provides broader city coverage (~8,000 cities vs Teleport's ~264) and richer price data.
- **API rate limits:** The TravelTables free tier is 500 requests/month. To work within this, all API responses (the city list and per-city prices) are cached in `localStorage` for 24 hours, so the same data is never fetched twice in a day.
- **Currency normalisation:** TravelTables returns prices in the city's local currency. Each value is converted to USD immediately using live exchange rates, so all cities can be meaningfully compared.
- **Partial failures:** When comparing multiple cities, a single city's API call failing could break the whole comparison. Each fetch is wrapped in its own error handler so partial results still display with a warning.

## Credits

- [TravelTables Cost of Living and Prices API](https://rapidapi.com/traveltables/api/cost-of-living-and-prices) — primary cost of living and city data
- [ExchangeRate API](https://open.er-api.com/) — real-time currency conversion
- [REST Countries API](https://restcountries.com/) — country flags and currency metadata
