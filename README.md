# MoveMetric

A web app that lets you compare how far your salary goes in different cities around the world. You enter your monthly salary, pick some cities, and it shows you the cost of living breakdown with prices converted to your currency.

## How to Run It

1. Clone the repo:
   ```bash
   git clone https://github.com/Teta-Dianah/movemetric.git
   cd movemetric
   ```

2. Create a `config.js` file in the project folder with your RapidAPI key:
   ```js
   const RAPIDAPI_KEY = "your-key-here";
   ```
   You can get a free key at [rapidapi.com/traveltables/api/cost-of-living-and-prices](https://rapidapi.com/traveltables/api/cost-of-living-and-prices) (1,000 requests/month for free).

3. Open `index.html` in your browser. No build tools or server needed.

## Features

- Search from ~8,000 cities worldwide
- Compare 2-4 cities side by side
- See purchasing power (% of salary left after basics like rent, food, transport)
- Color coded bars showing which city is cheapest/most expensive
- Sort by affordability, rent, food, internet, or purchasing power
- Filter by category (housing, food, transport, internet, healthcare)
- Switch between your local currency and USD
- Country flags next to each city

## APIs Used

1. **Cost of Living API** (TravelTables via RapidAPI) — gets prices for rent, food, transport, internet, etc. for each city. Needs a free API key.
   - `GET /cities` — list of all available cities
   - `GET /prices?city_name=...&country_name=...` — prices for a specific city

2. **ExchangeRate API** ([open.er-api.com](https://open.er-api.com/)) — converts USD prices to whatever currency the user picks. Free, no key needed.

3. **REST Countries API** ([restcountries.com](https://restcountries.com/)) — gets country flags and currency info for the dropdown. Free, no key needed.

## Deploying to Servers

### On Web01 and Web02 (Nginx)

```bash
sudo mkdir -p /var/www/html/movemetric
sudo cp index.html style.css app.js config.js /var/www/html/movemetric/
```

Make sure Nginx serves the folder. In `/etc/nginx/sites-available/default`:
```nginx
server {
    listen 80;
    root /var/www/html/movemetric;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

Then restart Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### On Lb01 (Load Balancer)

Set up Nginx to split traffic between the two servers. In `/etc/nginx/sites-available/default`:
```nginx
upstream backend {
    server <Web01_IP>;
    server <Web02_IP>;
}

server {
    listen 80;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Restart Nginx and go to `http://<Lb01_IP>/` to test.

## Files

```
movemetric/
├── index.html    — the page layout
├── style.css     — all the styling
├── app.js        — main app logic (API calls, rendering, etc.)
├── config.js     — your API key (not in the repo, create it yourself)
└── README.md
```

## Built With

- HTML, CSS, vanilla JavaScript
- No frameworks, no libraries, no backend
