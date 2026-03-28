# MoveMetric

A web app that lets you compare how far your salary goes in different cities around the world. You enter your monthly salary, pick some cities, and it shows you the cost of living breakdown with prices converted to your currency.

Live at: https://dianah.tech

## How to Run It Locally

1. Clone the repo:
   ```bash
   git clone https://github.com/Teta-Dianah/movemetric.git
   cd movemetric
   ```

2. Create a `config.js` file in the project folder with your RapidAPI key:
   ```js
   const RAPIDAPI_KEY = "your-key-here";
   ```
   You can get a free key at [rapidapi.com/traveltables/api/cost-of-living-and-prices](https://rapidapi.com/traveltables/api/cost-of-living-and-prices).

3. Open `index.html` in your browser. No build tools or server needed — just double click the file or use something like `python -m http.server 3000`.

## Features

- Search from ~8,000 cities worldwide
- Compare 2-4 cities side by side
- Purchasing power calculation (% of salary left after rent, food, transport)
- Color coded bars showing which city is cheapest/most expensive
- Sort by affordability, rent, food, internet, or purchasing power
- Filter by category (housing, food, transport, internet, healthcare)
- Switch between your local currency and USD
- Country flags next to each city
- Caching with localStorage so we don't waste API requests on cities we already looked up
- Rate limit tracking to stay within the free plan (10 requests/hour)

## APIs Used

1. **Cost of Living API** by [TravelTables via RapidAPI](https://rapidapi.com/traveltables/api/cost-of-living-and-prices) — gets prices for rent, food, transport, internet, etc. Needs a free API key.
   - `GET /cities` — list of all available cities
   - `GET /prices?city_name=...&country_name=...` — prices for a specific city

2. **ExchangeRate API** by [open.er-api.com](https://open.er-api.com/) — converts USD prices to whatever currency the user picks. Free, no key needed.

3. **REST Countries API** by [restcountries.com](https://restcountries.com/) — gets country flags and currency info for the dropdown. Free, no key needed.

## Deployment

The app is deployed on two web servers behind a load balancer:

- **Web01** — 52.90.67.39 (Ubuntu, Nginx)
- **Web02** — 44.208.165.54 (Ubuntu, Nginx)
- **Lb01** — 3.91.133.253 (Ubuntu, HAProxy)
- **Domain** — dianah.tech points to Lb01

### Steps I followed to deploy

**1. Copy the files to both web servers**

I used `scp` to copy the app files to both servers:
```bash
scp -i ~/.ssh/web_infra_key index.html style.css app.js config.js ubuntu@52.90.67.39:/tmp/
sudo cp /tmp/index.html /tmp/style.css /tmp/app.js /tmp/config.js /var/www/html/
```
Did the same thing for Web02 with its IP. Both servers already had Nginx installed and running, serving files from `/var/www/html/`.

**2. Nginx config on Web01 and Web02**

Both servers use the default Nginx config that serves from `/var/www/html/`. The important parts:
```nginx
server {
    listen 80 default_server;
    root /var/www/html;
    index index.html;

    server_name _;
    add_header X-Served-By $hostname;

    location / {
        try_files $uri $uri/ =404;
    }
}
```
The `X-Served-By` header is useful for testing — it tells you which server handled your request.

**3. HAProxy config on Lb01**

The load balancer uses HAProxy with round-robin to split traffic between both servers. The config at `/etc/haproxy/haproxy.cfg`:
```
frontend http-in
    bind *:80
    redirect scheme https code 301 if !{ ssl_fc }
    default_backend web_servers

frontend https-in
    bind *:443 ssl crt /etc/haproxy/certs/www.dianah.tech.pem
    http-request set-header X-Forwarded-Proto https if { ssl_fc }
    default_backend web_servers

backend web_servers
    balance roundrobin
    server web-01 52.90.67.39:80 check
    server web-02 44.208.165.54:80 check
```
This redirects HTTP to HTTPS, then balances traffic between the two servers. The `roundrobin` setting means each request goes to the next server in order.

**4. Testing it works**

I ran `curl` twice to check that different servers respond:
```bash
curl -s -k -I https://dianah.tech/ | grep x-served-by
# x-served-by: web-01

curl -s -k -I https://dianah.tech/ | grep x-served-by
# x-served-by: web-02
```
Both servers take turns, load balancing is working.

## Challenges

- **Rate limits** — The free plan on RapidAPI only gives 10 requests per hour, which is not a lot when you're comparing 4 cities at a time. I fixed this by caching API responses in localStorage so if you look up the same city again it just uses the saved data instead of making another API call. I also added a request counter that warns you before you hit the limit.

- **Currency conversion** — The cost of living API returns prices in USD, but I wanted users to see prices in their own currency. I had to figure out how to chain two API calls together — first get the exchange rates, then convert all the prices. If the exchange rate API fails it just falls back to showing USD.

- **City search being slow** — The API returns around 8,000 cities which is a lot to search through. I keep the list cached in localStorage so it only needs to fetch it once, and the search only starts after you type at least 2 characters to keep it fast.

## Files

```
movemetric/
├── index.html    — the page layout
├── style.css     — all the styling
├── app.js        — main app logic (API calls, caching, rendering)
├── config.js     — your API key (not in the repo, create it yourself)
└── README.md
```

## Built With

- HTML, CSS, vanilla JavaScript
- No frameworks, no libraries, no backend
