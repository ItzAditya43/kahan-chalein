// Kahan Chalein? · the trip finder, the ticket cards, sharing and the story image.
// Shared helpers live on window.KC so group.js (swipe with friends) can use them.
(() => {
  const { CITIES, VIBES, PLACES } = window;
  const KC = window.KC = {};
  const $ = (s, r = document) => r.querySelector(s);
  const BASE = location.origin + location.pathname;
  const THIS_MONTH = new Date().getMonth() + 1;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MAX_HOURS = { 1: 4, 2: 12, 3: 14 };   // one-way hours; a weekend allows an overnight bus each way
  const IDEAL_HOURS = { 1: 2, 2: 6, 3: 10 };

  // ---------- small helpers ----------
  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k in n) n[k] = v;
      else n.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k);
    return n;
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: fine */ } },
  };
  function track(name) {
    try { window.goatcounter?.count?.({ path: name, title: name, event: true }); } catch { /* analytics never breaks the page */ }
  }
  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }
  const hours = h => (h < 1 ? `${Math.round(h * 60)} min` : `~${h} h`);
  const rupees = c => '₹'.repeat(c);
  const COST_TEXT = { 1: 'under ~₹3k', 2: '~₹3–6k', 3: '₹6k+' };
  const SOLO_TEXT = { 3: 'Big solo & hostel scene', 2: 'Fine solo', 1: 'Better with friends' };
  const byId = id => PLACES.find(p => p.id === id);

  function monthsLabel(ms) {
    if (ms.length === 12) return 'all year';
    const set = new Set(ms);
    const start = ms.find(m => !set.has(m === 1 ? 12 : m - 1)) ?? ms[0];
    const runs = [];
    for (let i = 0; i < 12; i++) {
      const m = ((start - 1 + i) % 12) + 1;
      if (!set.has(m)) continue;
      const last = runs[runs.length - 1];
      if (last && last[1] === (m === 1 ? 12 : m - 1)) last[1] = m; else runs.push([m, m]);
    }
    return runs.map(([a, b]) => (a === b ? MONTHS[a - 1] : `${MONTHS[a - 1]}–${MONTHS[b - 1]}`)).join(', ');
  }
  const inSeason = p => p.months.includes(THIS_MONTH);
  const PREV_MONTH = THIS_MONTH === 1 ? 12 : THIS_MONTH - 1;
  const justStarted = p => inSeason(p) && !p.months.includes(PREV_MONTH);
  const minDays = (p, h) => p.days || (h <= MAX_HOURS[1] ? 1 : h <= MAX_HOURS[2] ? 2 : 3);
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');

  // ---------- rough cost per person (budget trip) ----------
  // Bus/train ≈ ₹100 an hour each way; a bed per night (goSTOPS's own "from" price where we have it);
  // food and getting around per day. Rough on purpose, and labelled so on the page.
  const STAY = { 1: 600, 2: 1000, 3: 1800 }, FOOD = { 1: 450, 2: 650, 3: 1000 }, LOCAL = 250;
  const round50 = n => Math.round(n / 50) * 50;
  function tripCost(p, from, days) {
    const h = p.from[from][0];
    const d = Math.max(+days || 2, minDays(p, h));
    const nights = d - 1;
    const travel = 2 * Math.max(150, round50(h * 100));
    const stay = nights * (p.bed ? round50(p.bed) : STAY[p.cost]);
    const food = d * FOOD[p.cost], local = d * LOCAL;
    return { d, nights, travel, stay, food, local, total: round50(travel + stay + food + local) };
  }

  function art(p) {
    const box = el('div', { class: 'art' });
    box.innerHTML = window.KCArt(p); // generated from our own data, never from user input
    return box;
  }

  // ---------- ranking ----------
  // o = { from, days, vibe, who, budget, shuffle }
  function rank(o) {
    const days = +o.days, budget = +o.budget;
    const pool = PLACES.filter(p => p.from[o.from] && minDays(p, p.from[o.from][0]) <= days);
    const out = pool.map(p => {
      const h = p.from[o.from][0];
      const vibeHit = o.vibe === 'any' || p.vibes.includes(o.vibe);
      let s = 0;
      if (o.vibe !== 'any' && vibeHit) s += 8 + (p.vibes[0] === o.vibe ? 2 : 0);
      s += inSeason(p) ? 4 : -4;
      if (o.who === 'solo') s += (p.solo - 2) * 2;
      if (p.cost > budget) s -= (p.cost - budget) * 3;
      s -= Math.abs(h - IDEAL_HOURS[days]) * 0.25;
      if (o.shuffle) s += Math.random() * 3;
      return { p, s, vibeHit };
    });
    out.sort((a, b) => (b.vibeHit - a.vibeHit) || (b.s - a.s));
    return out;
  }

  // ---------- weather on cards ----------
  function fillWeather(root, places) {
    const pending = () => root.querySelectorAll('.wx[data-pending]');
    if (!window.KCWeather) { pending().forEach(n => n.remove()); return; }
    window.KCWeather(places).then(map => {
      pending().forEach(n => {
        const w = map[n.dataset.id];
        n.removeAttribute('data-pending');
        if (!w) { n.remove(); return; }
        n.classList.toggle('bad', w.some(d => d.rain >= 60 || d.max >= 38));
        const note = w.every(d => d.rain >= 70) ? 'Rain most of the weekend. Pack for it, or pick another place.'
          : w.some(d => d.max >= 38) ? 'Very hot. Plan for early mornings and late evenings.' : '';
        n.replaceChildren(el('span', { class: 'wx-k', textContent: 'This weekend' }),
          ...w.map(d => el('span', { class: 'wx-d' }, el('b', { textContent: `${d.label} ${d.max}°` }),
            ` ${d.words}${d.rain >= 30 ? `, ${d.rain}% rain` : ''}`)),
          ...(note ? [el('span', { class: 'wx-note', textContent: note })] : []));
      });
    }).catch(() => pending().forEach(n => n.remove()));
  }

  // ---------- one ticket ----------
  const shareLink = (p, from) => `${BASE}?p=${encodeURIComponent(p.id)}&from=${from}`;
  function shareText(p, from, days) {
    const [h, how] = p.from[from];
    return `Kahan chalein? ${p.name} this weekend? 🎒\n${hours(h)} from ${CITIES[from]} (${how}), about ${inr(tripCost(p, from, days).total)} each. ${p.why}\nChalo?`;
  }
  const hostelLink = p => (p.gs ? el('a', { class: 'bed', href: `https://gostops.com/stay/${p.gs}`, target: '_blank', rel: 'noopener',
    title: p.bed ? 'The "from" price on gostops.com on 25 Nov. It changes with dates.' : null,
    textContent: p.bed ? `goSTOPS beds from ~${inr(p.bed)}/night ↗` : 'goSTOPS has a hostel here ↗', onclick: () => track(`hostel/${p.id}`) }) : null);

  function facts(p, from, days) {
    const [h, how] = p.from[from];
    const c = tripCost(p, from, days);
    return el('ul', { class: 'facts' },
      el('li', {}, el('strong', { textContent: hours(h) }), ` · ${how}`),
      el('li', {}, el('strong', { textContent: `~${inr(c.total)}` }), ` each for ${c.d === 1 ? 'a day' : `${c.d} days`}, roughly`),
      el('li', { textContent: SOLO_TEXT[p.solo] }));
  }
  function seasonStamp(p) {
    if (justStarted(p)) return el('span', { class: 'stamp new', textContent: 'Season just started' });
    return inSeason(p)
      ? el('span', { class: 'stamp now', textContent: `Good in ${MONTHS[THIS_MONTH - 1]}` })
      : el('span', { class: 'stamp off', textContent: `Best ${monthsLabel(p.months)}` });
  }

  // ---------- split the cost ----------
  function splitBox(p, from, days) {
    const c = tripCost(p, from, days);
    let people = 4, opened = false;
    const lines = el('ul', { class: 'split-lines' }), total = el('p', { class: 'split-total' });
    const count = el('output', { textContent: people });
    const msg = () => `Kahan chalein? ${p.name}, ${c.d === 1 ? 'a day trip' : `${c.d} days`} from ${CITIES[from]}, ${people} of us 🎒\n`
      + `Rough cost each: ${inr(c.total)} (travel ${inr(c.travel)}${c.stay ? ` · stay ${inr(c.stay)}` : ''} · food ${inr(c.food)} · getting around ${inr(c.local)}).\n`
      + `Total for ${people}: ${inr(c.total * people)}. Chalo? ${shareLink(p, from)}`;
    const draw = () => {
      count.textContent = people;
      lines.replaceChildren(
        el('li', {}, el('span', { textContent: `Travel, both ways (${p.from[from][1].split(',')[0]})` }), el('b', { textContent: inr(c.travel) })),
        c.nights ? el('li', {}, el('span', { textContent: `Stay, ${c.nights} night${c.nights > 1 ? 's' : ''}${p.bed ? ' (goSTOPS bed)' : ''}` }), el('b', { textContent: inr(c.stay) })) : null,
        el('li', {}, el('span', { textContent: `Food, ${c.d} day${c.d > 1 ? 's' : ''}` }), el('b', { textContent: inr(c.food) })),
        el('li', {}, el('span', { textContent: 'Getting around (scooter, autos)' }), el('b', { textContent: inr(c.local) })));
      total.replaceChildren(`Each: `, el('b', { textContent: inr(c.total) }), ` · Total for ${people}: `, el('b', { textContent: inr(c.total * people) }));
      wa.href = `https://wa.me/?text=${encodeURIComponent(msg())}`;
    };
    const wa = el('a', { class: 'wa', target: '_blank', rel: 'noopener', textContent: 'Send the split to the group', onclick: () => track(`split-share/${p.id}`) });
    const step = d => el('button', { type: 'button', class: 'step', 'aria-label': d > 0 ? 'One more person' : 'One less person', textContent: d > 0 ? '+' : '−',
      onclick: () => { people = Math.min(20, Math.max(1, people + d)); draw(); } });
    const box = el('details', { class: 'split' },
      el('summary', { textContent: 'Split the cost' }),
      el('div', { class: 'split-in' },
        el('div', { class: 'people' }, el('span', { textContent: 'People' }), step(-1), count, step(1)),
        lines, total,
        el('p', { class: 'split-note', textContent: 'Rough, for a budget trip: buses and trains at about ₹100 an hour, a hostel bed or budget room, simple food. Prices change.' }),
        wa));
    box.addEventListener('toggle', () => { if (box.open && !opened) { opened = true; track(`split/${p.id}`); } });
    draw();
    return box;
  }
  const wxSlot = p => el('p', { class: 'wx', 'data-id': p.id, 'data-pending': '', textContent: 'Checking this weekend\'s weather…' });

  function ticket(p, from, n, days = state.days) {
    const link = shareLink(p, from);
    const actions = el('div', { class: 'actions' },
      el('a', { class: 'wa', href: `https://wa.me/?text=${encodeURIComponent(shareText(p, from, days) + ' ' + link)}`, target: '_blank', rel: 'noopener',
        textContent: 'Send to the group chat', onclick: () => track(`share/whatsapp/${p.id}`) }),
      el('button', { type: 'button', textContent: navigator.share ? 'Share' : 'Copy link', onclick: () => share(p, from, days) }),
      el('button', { type: 'button', textContent: 'Story image', onclick: () => storyImage(p, from, days) }),
      hostelLink(p));
    return el('article', { class: 'ticket' },
      el('div', { class: 'stub' },
        el('span', { class: 'route' }, `${CITIES[from]} → `, el('b', { textContent: p.name })),
        el('span', { class: 'num', textContent: `No. ${String(n).padStart(2, '0')}` })),
      art(p),
      el('div', { class: 'body' },
        el('h3', { textContent: p.name }),
        el('p', { class: 'region' }, `${p.region}  `, seasonStamp(p)),
        facts(p, from, days),
        wxSlot(p),
        el('p', { class: 'why', textContent: p.why }),
        el('p', { class: 'plan' }, el('span', { textContent: 'How people do it: ' }), p.plan),
        el('p', { class: 'skip' }, el('span', { textContent: 'Skip it if: ' }), p.skip),
        splitBox(p, from, days),
        actions,
        el('a', { class: 'fixit', href: `mailto:aditya20pnd@gmail.com?subject=${encodeURIComponent(`Kahan Chalein: fix for ${p.name}`)}`,
          textContent: 'Wrong info? Tell me', onclick: () => track(`fix/${p.id}`) })));
  }

  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg); } catch { prompt('Copy this:', text); }
  }
  async function share(p, from, days) {
    const url = shareLink(p, from);
    track(`share/native/${p.id}`);
    if (navigator.share) {
      try { await navigator.share({ title: `${p.name} this weekend?`, text: shareText(p, from, days), url }); } catch { /* cancelled */ }
      return;
    }
    copy(`${shareText(p, from, days)} ${url}`, 'Link copied. Paste it in the group.');
  }

  // ---------- story image (1080×1920) for Instagram / WhatsApp status ----------
  function wrap(ctx, text, x, y, maxW, lh) {
    let line = '';
    for (const w of text.split(' ')) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh; } else line = test;
    }
    ctx.fillText(line, x, y); return y + lh;
  }
  async function drawArt(x, p, y0 = 0, h = 760) {
    try {
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.KCArt(p).replace('<svg ', '<svg width="600" height="260" '));
      await img.decode();
      const sh = 260, sw = sh * 1080 / h;  // crop the 600×260 art to fill a 1080-wide band
      x.drawImage(img, (600 - sw) / 2, 0, sw, sh, 0, y0, 1080, h);
    } catch { /* no picture, still a good card */ }
  }
  function saveCanvas(c, name, doneMsg) {
    c.toBlob(async blob => {
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file] }); return; } catch { /* fall through to download */ }
      }
      const a = el('a', { href: URL.createObjectURL(blob), download: file.name });
      document.body.append(a); a.click(); a.remove();
      toast(doneMsg);
    }, 'image/png');
  }
  async function storyImage(p, from, days) {
    track(`story/${p.id}`);
    try { await document.fonts.load('800 120px Fraunces'); } catch { /* fallback font is fine */ }
    const [h, how] = p.from[from];
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    const x = c.getContext('2d');
    x.fillStyle = '#f4eee2'; x.fillRect(0, 0, 1080, 1920);
    await drawArt(x, p);
    x.fillStyle = '#1d1b16'; x.font = '700 34px system-ui, sans-serif';
    x.fillText('KAHAN CHALEIN?', 90, 850);
    x.font = '800 132px Fraunces, Georgia, serif';
    let y = wrap(x, p.name, 90, 990, 900, 132);
    x.font = '600 42px system-ui, sans-serif'; x.fillStyle = '#e4572e';
    y = wrap(x, `${CITIES[from]} → ${p.name}`, 90, y + 10, 900, 54);
    x.fillStyle = '#1d1b16'; x.font = '400 40px system-ui, sans-serif';
    y = wrap(x, `${hours(h)}, ${how} · about ${inr(tripCost(p, from, days).total)} each`, 90, y + 6, 900, 54);
    x.font = '400 52px Fraunces, Georgia, serif';
    wrap(x, p.why, 90, y + 50, 900, 66);
    x.font = '800 66px Fraunces, Georgia, serif'; x.fillStyle = '#e4572e';
    x.fillText('This weekend. Chalein?', 90, 1700);
    x.fillStyle = '#6d665a'; x.font = '400 30px system-ui, sans-serif';
    x.fillText(location.host || 'kahan chalein', 90, 1780);
    x.font = '400 23px system-ui, sans-serif';
    x.fillText('Built by Aditya Pandey for the goSTOPS Build Sprint. Not an official goSTOPS product.', 90, 1840);
    saveCanvas(c, `${p.id}-weekend.png`, 'Saved. Post it to your story and tag your people.');
  }

  // ---------- the finder ----------
  const defaults = { from: 'blr', days: '2', vibe: 'any', who: 'solo', budget: '2' };
  const state = { ...defaults, ...store.get('kc.prefs', {}) };
  if (!CITIES[state.from]) state.from = 'blr';
  let ranked = [], shown = 0;

  function chipGroup(box, map, get, set) {
    box.replaceChildren(...Object.entries(map).map(([v, label]) => el('button', { type: 'button', textContent: label, 'data-v': v })));
    const sync = () => box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(get()))));
    box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; set(b.dataset.v); sync(); });
    sync();
    return sync;
  }

  const syncers = [];
  function setupFinder() {
    const opts = {
      from: CITIES,
      days: { 1: 'Just a day', 2: 'The weekend', 3: 'Long weekend' },
      vibe: { any: 'Anything', ...VIBES },
      who: { solo: 'Solo', group: 'With friends' },
      budget: { 1: 'Tight', 2: 'Okay', 3: 'Treat myself' },
    };
    document.querySelectorAll('#ask .chips').forEach(box => {
      const name = box.dataset.name;
      syncers.push(chipGroup(box, opts[name], () => state[name], v => {
        state[name] = v; store.set('kc.prefs', state);
        if (name === 'from') bestBets();
        if (ranked.length) run(false);
      }));
    });
    $('#ask').addEventListener('submit', e => { e.preventDefault(); run(true); });
    $('#surprise').addEventListener('click', () => surprise());
    $('#near').addEventListener('click', nearMe);
  }

  // ---------- surprise me: one random trip that fits and is in season ----------
  let lastSurprise = null;
  function surprise() {
    const pool = rank({ ...state, vibe: 'any', shuffle: true }).filter(r => inSeason(r.p) && r.p.id !== lastSurprise).slice(0, 12);
    if (!pool.length) { toast('Nothing in season fits that. Try more days.'); return; }
    const p = pool[Math.floor(Math.random() * pool.length)].p;
    lastSurprise = p.id; ranked = []; shown = 0;
    track(`surprise/${state.from}`);
    const box = $('#results');
    box.replaceChildren(el('h2', { textContent: `Surprise! How about ${p.name}?` }),
      el('p', { class: 'sub', textContent: `In season, and it fits ${({ 1: 'a day trip', 2: 'a weekend', 3: 'a long weekend' })[state.days]} from ${CITIES[state.from]}.` }),
      ticket(p, state.from, 1),
      el('button', { class: 'more', type: 'button', textContent: '🎲 Another one', onclick: () => surprise() }));
    fillWeather(box, [p]);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- near me: pick the closest of the 8 cities (asks for location only on tap) ----------
  const CITY_AT = { blr: [12.97, 77.59], bom: [19.08, 72.88], pnq: [18.52, 73.86], del: [28.61, 77.21],
    hyd: [17.39, 78.49], maa: [13.08, 80.27], ccu: [22.57, 88.36], amd: [23.02, 72.57] };
  function km([a, b], [c, d]) {
    const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(x));
  }
  function nearMe() {
    if (!navigator.geolocation) { toast('Your browser can\'t share location. Pick your city instead.'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      const here = [pos.coords.latitude, pos.coords.longitude];
      const [city, dist] = Object.entries(CITY_AT).map(([k, c]) => [k, km(here, c)]).sort((a, b) => a[1] - b[1])[0];
      state.from = city; store.set('kc.prefs', state); syncers.forEach(s => s());
      track(`near-me/${city}`);
      toast(dist > 300 ? `Closest city I cover: ${CITIES[city]} (~${Math.round(dist)} km).` : `Leaving from ${CITIES[city]}.`);
      bestBets(); run(false);
    }, () => toast('No location, no problem. Pick your city.'), { timeout: 10000, maximumAge: 3600e3 });
  }

  // ---------- this weekend's best bets: live weather over every in-season weekend trip ----------
  let bestToken = 0;
  async function bestBets() {
    const city = state.from, token = ++bestToken;
    const box = $('#best');
    const cands = PLACES.filter(p => p.from[city] && minDays(p, p.from[city][0]) <= 2 && inSeason(p));
    if (!cands.length || !window.KCWeather) { box.replaceChildren(); return; }
    box.replaceChildren(el('p', { class: 'best-k', textContent: `This weekend from ${CITIES[city]}` }),
      el('p', { class: 'best-wait', textContent: `Checking the forecast for ${cands.length} places…` }));
    let wx;
    try { wx = await window.KCWeather(cands); } catch { box.replaceChildren(); return; }
    if (token !== bestToken) return;
    const scored = cands.filter(p => wx[p.id]?.length).map(p => {
      const w = wx[p.id];
      const rain = w.reduce((a, d) => a + d.rain, 0) / w.length;
      const max = w.reduce((a, d) => a + d.max, 0) / w.length;
      return { p, w, rain, max, score: -rain * 0.6 - Math.abs(max - 26) * 2 - p.from[city][0] * 0.4 };
    });
    const good = scored.filter(x => x.rain < 50 && x.max < 37).sort((a, b) => b.score - a.score).slice(0, 3);
    const wet = scored.filter(x => x.w.every(d => d.rain >= 70)).map(x => x.p.name).slice(0, 4);
    if (!good.length) { box.replaceChildren(); return; }
    const sum = x => x.w.map(d => `${d.label} ${d.max}° ${d.words}`).join(' · ');
    const shareMsg = `This weekend from ${CITIES[city]}, by the live forecast 🌤️\n`
      + good.map((x, i) => `${i + 1}. ${x.p.name}: ${sum(x)} (${hours(x.p.from[city][0])})`).join('\n')
      + (wet.length ? `\nSkip: ${wet.join(', ')} (rain all weekend)` : '') + `\nKahan chalein? ${BASE}?best=${city}`;
    box.replaceChildren(
      el('p', { class: 'best-k', textContent: `This weekend's best bets from ${CITIES[city]}` }),
      el('ol', { class: 'best-list' }, good.map(x => el('li', {},
        el('button', { type: 'button', onclick: () => { track(`best/open/${x.p.id}`); showOne(x.p, `This weekend's pick from ${CITIES[city]}`); } },
          el('b', { textContent: x.p.name }), el('span', { class: 'best-wx', textContent: sum(x) }),
          el('span', { class: 'best-h', textContent: `${hours(x.p.from[city][0])} · ~${inr(tripCost(x.p, city, 2).total)} each` }))))),
      wet.length ? el('p', { class: 'best-skip', textContent: `Rain all weekend: ${wet.join(', ')}.` }) : null,
      el('div', { class: 'best-act' },
        el('a', { class: 'wa', href: `https://wa.me/?text=${encodeURIComponent(shareMsg)}`, target: '_blank', rel: 'noopener',
          textContent: 'Send these to the group', onclick: () => track(`best/share/${city}`) }),
        el('span', { class: 'best-note', textContent: 'Picked by the live forecast: least rain, comfortable temperatures, not too far.' })));
  }
  function showOne(p, heading) {
    ranked = []; shown = 0;
    const box = $('#results');
    box.replaceChildren(el('h2', { textContent: heading }), ticket(p, state.from, 1, 2));
    fillWeather(box, [p]);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function run(scroll, auto) {
    ranked = rank({ ...state, shuffle: state.vibe === 'any' }); shown = 0;
    const box = $('#results'); box.replaceChildren();
    const fromName = CITIES[state.from];
    const dayText = { 1: 'a day trip', 2: 'a weekend', 3: 'a long weekend' }[state.days];
    box.append(el('h2', { textContent: `From ${fromName}, for ${dayText}` }),
      el('p', { class: 'sub', textContent: 'Sorted by mood, season, budget and distance. The weather is the live forecast for this Saturday and Sunday.' }));
    if (!ranked.length) box.append(el('p', { class: 'empty', textContent: `Nothing in my list fits ${dayText} from ${fromName} yet. Try more days, or tell me a place to add.` }));
    else showMore();
    if (!auto) track(`search/${state.from}/${state.days}/${state.vibe}`); // the picks shown on load are not a search
    if (scroll) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showMore() {
    const box = $('#results');
    box.querySelector('.more')?.remove();
    const next = ranked.slice(shown, shown + 3);
    next.forEach((r, i) => {
      const k = shown + i;
      if (!r.vibeHit && (k === 0 || ranked[k - 1].vibeHit)) box.append(el('p', { class: 'sub', textContent: 'Not quite that mood, but worth a look:' }));
      box.append(ticket(r.p, state.from, k + 1));
    });
    fillWeather(box, next.map(r => r.p));
    shown += next.length;
    if (shown < ranked.length) {
      box.append(el('button', { class: 'more', type: 'button', textContent: `Show 3 more (${ranked.length - shown} left)`,
        onclick: () => { showMore(); track('more'); } }));
    }
  }

  // ---------- a friend opened a single shared trip ----------
  function openTripInvite(q) {
    const p = byId(q.get('p'));
    const from = CITIES[q.get('from')] ? q.get('from') : null;
    if (!p || !from || !p.from[from]) return false;
    track(`opened-invite/${p.id}`);
    state.from = from; syncers.forEach(s => s());
    const box = $('#invite'); box.hidden = false;
    const link = shareLink(p, from);
    box.append(
      el('p', { textContent: 'A friend wants to go:' }),
      el('h2', { textContent: `Chalo, ${p.name}?` }),
      el('p', { class: 'small', textContent: `${hours(p.from[from][0])} from ${CITIES[from]}. ${p.why}` }),
      el('div', { class: 'btns' },
        el('button', { class: 'yes', type: 'button', textContent: "I'm in, chalo!", onclick: () => {
          track(`im-in/${p.id}`);
          window.open(`https://wa.me/?text=${encodeURIComponent(`I'm in for ${p.name}! Kab nikal rahe hain? 🎒 ${link}`)}`, '_blank', 'noopener');
        } }),
        el('button', { class: 'mine', type: 'button', textContent: 'Show me other options', onclick: () => {
          track('invite-to-own'); $('#ask').scrollIntoView({ behavior: 'smooth' });
        } })));
    const res = $('#results');
    res.append(el('h2', { textContent: 'The trip they sent' }), ticket(p, from, 1));
    fillWeather(res, [p]);
    return true;
  }

  // ---------- tabs ----------
  function setMode(mode, push = true) {
    document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    $('#find').hidden = mode !== 'find';
    $('#group').hidden = mode !== 'group';
    if (push) history.replaceState(null, '', mode === 'group' ? '#group' : location.pathname + location.search);
    if (mode === 'group') window.KCGroup?.show();
  }

  KC.boot = () => {
    setupFinder();
    document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); track(`tab/${b.dataset.mode}`); }));
    $('#fix').href = 'mailto:aditya20pnd@gmail.com?subject=' + encodeURIComponent('Kahan Chalein: a fix or a place to add');
    const q = new URLSearchParams(location.search);
    if (q.get('g') && window.KCGroup?.openInvite(q.get('g'))) { setMode('group', false); return; }
    if (openTripInvite(q)) { setMode('find', false); return; }
    if (location.hash === '#group') { setMode('group', false); return; }
    setMode('find', false);
    const bc = q.get('best');
    if (CITIES[bc]) { state.from = bc; syncers.forEach(s => s()); track(`opened-best/${bc}`); }
    bestBets();
    run(false, true); // show picks straight away; nobody should have to work before seeing something useful
  };

  Object.assign(KC, { el, store, track, toast, copy, hours, rupees, inr, COST_TEXT, MONTHS, CITIES, PLACES, BASE, byId,
    rank, art, facts, seasonStamp, wxSlot, fillWeather, hostelLink, chipGroup, ticket, inSeason, tripCost,
    drawArt, saveCanvas, wrapText: wrap });
})();
