# Kahan chalein?

**Live:** https://itzaditya43.github.io/kahan-chalein/

A free page for the "we have the weekend, where do we go?" chat.

- **Find me a trip:** pick your city, how much time you have, a mood, solo or with friends, and a budget. You get
  weekend trips with travel time, rough cost, whether it's a good month, this Saturday and Sunday's weather, a simple
  plan and the honest "skip it if".
- **Decide with friends:** everyone swipes the same 10 trips and the link carries the votes. Send it to the group
  chat and see where you all match.
- **This weekend's best bets:** the live forecast over every in-season trip from your city: the 3 driest, most
  comfortable picks, and which places will be rained out.
- **Split the cost:** a rough budget per person (travel, stay, food, getting around) for any group size, ready to send.
- **Surprise me**, **Near me** (nearest of the 8 cities, only when you tap), goSTOPS bed prices where they have a
  hostel, a result image and calendar file for group plans, and a "Wrong info?" link on every trip.
- **Live numbers:** [stats.html](https://itzaditya43.github.io/kahan-chalein/stats.html), how many people used it.

Plain HTML, CSS and JavaScript, no framework and no backend. Weather from [Open-Meteo](https://open-meteo.com).
Page counts with [GoatCounter](https://www.goatcounter.com) (no cookies).

Built by Aditya Pandey for the goSTOPS Build Sprint. Not an official goSTOPS product.

| File | What it does |
|---|---|
| `data.js` | The places: travel times from 8 cities, cost, best months, why go, a plan, skip it if |
| `app.js` | Ranking, trip cards, sharing, the story image |
| `group.js` | Swipe with friends; the votes live in the link |
| `art.js` | Postcard illustrations drawn in code |
| `weather.js` | This weekend's forecast for the places on screen |

Run it locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
