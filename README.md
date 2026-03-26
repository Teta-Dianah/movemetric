# MoveMetric

**Compare your salary across cities worldwide.** Enter your monthly salary, pick cities you're considering, and instantly see a side-by-side cost of living breakdown — all converted to your own currency.

## What It Does

MoveMetric fetches real cost of living data and exchange rates, then shows you how far your salary stretches in each city. It calculates a **Purchasing Power Score** (percentage of salary remaining after rent, food, and transport) so you can make informed relocation decisions at a glance.

## How to Run Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/<your-username>/movemetric.git
   cd movemetric
   ```
2. Open `index.html` in any modern browser.

That's it — no build tools, no dependencies, no server required. All API calls run directly in the browser.

## How to Use

1. Enter your **monthly salary** (e.g., 3000).
2. Select your **currency** from the dropdown (e.g., USD, KES, RWF).
3. **Search for cities** — type a city name, then click to add it. Select 2–4 cities.
4. Click **Compare Cities**.
5. The dashboard shows each city with:
   - **Purchasing Power Score** — percentage of salary left after basic expenses
   - **Cost breakdowns** by category: Housing, Food, Transport, Internet, Healthcare, Education
   - **Visual bars** indicating relative cost (green = cheap, yellow = moderate, red = expensive)
6. Use the controls to:
   - **Sort** by affordability, rent, food cost, purchasing power, or internet cost
   - **Filter** to show only specific expense categories
   - **Toggle** between your local currency and USD
   - **Remove** a city and add a different one without resetting

## APIs Used

This application uses three free, open APIs. No API keys are required.

### 1. Teleport API
- **Purpose:** Cost of living data, quality of life scores, and city search for 264 urban areas worldwide
- **Documentation:** [https://developers.teleport.org/api/](https://developers.teleport.org/api/)
- **Endpoints used:**
  - `/urban_areas/` — list all cities with cost data
  - `/urban_areas/slug:{city}/details/` — detailed cost breakdown (rent, food, transport, etc.)
  - `/urban_areas/slug:{city}/scores/` — quality of life scores

### 2. ExchangeRate API
- **Purpose:** Converts all costs from USD (Teleport's base currency) to the user's local currency
- **Documentation:** [https://open.er-api.com/](https://open.er-api.com/)
- **Endpoint used:** `/v6/latest/USD` — current exchange rates for all currencies

### 3. REST Countries API
- **Purpose:** Provides country flags, currency names, and symbols for the UI
- **Documentation:** [https://restcountries.com/](https://restcountries.com/)
- **Endpoint used:** `/v3.1/all?fields=name,flags,currencies,cca2`

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

- **Teleport API structure:** The API uses HAL-style JSON with nested `_links` objects, requiring careful navigation of the response format rather than simple flat JSON parsing.
- **City-to-country mapping for flags:** The Teleport API returns city names without country codes, so a mapping table was built to match cities to their country flags from REST Countries data.
- **Limited African coverage:** The Teleport API covers ~264 cities globally with limited African representation. The app handles this by only showing cities with available data in the search results.

## Credits

- [Teleport API](https://developers.teleport.org/api/) by Teleport — city cost of living data
- [ExchangeRate API](https://open.er-api.com/) — real-time currency conversion
- [REST Countries API](https://restcountries.com/) — country flags and currency metadata
- All APIs are free and open. No paid tiers were used.
