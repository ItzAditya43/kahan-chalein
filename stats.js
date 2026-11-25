// Live numbers page. Reads stats.json (written by the stats job from GoatCounter's API) and draws it.
(() => {
  const SRC = 'stats.json';
  const LAUNCH = '2026-11-24', LAST_DAY = '2026-11-27';
  const $ = s => document.querySelector(s);
  const SVG = 'http://www.w3.org/2000/svg';
  const fmt = n => Number(n || 0).toLocaleString('en-IN');
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '–');

  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v; else if (k in n) n[k] = v; else n.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k);
    return n;
  }
  function svg(tag, attrs = {}, ...kids) {
    const n = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    for (const k of kids) n.append(k);
    return n;
  }
  const placeName = id => (window.PLACES || []).find(p => p.id === id)?.name || id;
  const cityName = id => (window.CITIES || {})[id] || id;
  const vibeName = id => (id === 'any' ? 'Anything' : (window.VIBES || {})[id] || id);

  // ---------- freshness + countdown ----------
  function ago(iso) {
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
  }
  function freshness(d) {
    const stale = Date.now() - new Date(d.updated) > 45 * 60000;
    $('.eyebrow').classList.toggle('stale', stale);
    $('#fresh').textContent = `${stale ? 'Last updated' : 'Live · updated'} ${ago(d.updated)}`;
    $('#updated').textContent = `Data from GoatCounter · ${new Date(d.updated).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST`;
  }
  function clock(deadline) {
    const tick = () => {
      const ms = new Date(deadline) - Date.now();
      const box = $('#clock'); box.replaceChildren();
      if (ms <= 0) { box.append('The sprint has ended. These are the final numbers.'); return; }
      const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
      box.append('Sprint ends in ', el('b', { textContent: `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m` }), ' · Fri 27 Nov, 11:59 PM IST');
    };
    tick(); setInterval(tick, 30000);
  }

  // ---------- stat strip ----------
  function strip(d) {
    const c = d.counts;
    const friends = (c.invites_opened || 0) + (c.group_invites_opened || 0);
    const items = [
      ['lead', d.visitors, 'People', 'unique visitors'],
      ['', c.searches, 'Trip searches', 'own city or mood'],
      ['', c.shares, 'Shares', 'WhatsApp, story, links'],
      ['', friends, 'Friends brought in', 'opened a shared link'],
    ];
    $('#strip').replaceChildren(...items.map(([cls, n, label, small]) =>
      el('div', { class: `stat ${cls}` }, el('b', { textContent: fmt(n) }), el('span', { textContent: label }), el('small', { textContent: small }))));
  }

  // ---------- daily chart: grouped bars, one axis ----------
  const SERIES = [['visitors', 'People', 'var(--mark-1)'], ['events', 'Actions', 'var(--mark-2)']];
  function days(d) {
    const byDay = Object.fromEntries(d.daily.map(x => [x.day, x]));
    const out = [];
    for (let t = new Date(`${LAUNCH}T00:00:00Z`); t <= new Date(`${LAST_DAY}T00:00:00Z`); t = new Date(+t + 864e5)) {
      const key = t.toISOString().slice(0, 10);
      const future = key > new Date().toISOString().slice(0, 10);
      out.push({ day: key, future, visitors: byDay[key]?.visitors || 0, events: byDay[key]?.events || 0 });
    }
    return out;
  }
  const dayLabel = k => new Date(`${k}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  // A bar with 4px rounded top corners, square at the baseline.
  function barPath(x, y, w, h) {
    if (h <= 0) return '';
    const r = Math.min(4, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }
  function niceMax(v) {
    if (v <= 5) return 5;
    const p = 10 ** Math.floor(Math.log10(v)), f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  function daily(d) {
    const rows = days(d);
    $('#legend').replaceChildren(...SERIES.map(([, label, color]) => el('span', {}, el('i', { style: `background:${color}` }), label)));
    const box = $('#daily');
    const W = Math.max(box.clientWidth, 300), H = box.clientHeight || 168;
    const m = { t: 16, r: 4, b: 22, l: 26 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const max = niceMax(Math.max(1, ...rows.flatMap(r => [r.visitors, r.events])));
    const y = v => m.t + ih - (v / max) * ih;
    const band = iw / rows.length, bw = Math.min(34, (band * 0.62 - 2) / 2);
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
    const grid = svg('g', { class: 'grid' }), axis = svg('g', { class: 'axis' });
    const ticks = max % 4 === 0 ? 4 : 5;  // whole-number ticks: counts are never fractional
    for (let i = 0; i <= ticks; i++) {
      const v = (max / ticks) * i, yy = y(v);
      grid.append(svg('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy }));
      const t = svg('text', { x: m.l - 8, y: yy + 4, 'text-anchor': 'end' }); t.textContent = fmt(v); axis.append(t);
    }
    root.append(grid, axis);
    rows.forEach((r, i) => {
      const cx = m.l + band * i + band / 2;
      const g = svg('g');
      SERIES.forEach(([key, , color], s) => {
        const x = cx - bw - 1 + s * (bw + 2);
        const p = barPath(x, y(r[key]), bw, m.t + ih - y(r[key]));
        if (p) g.append(svg('path', { d: p, fill: color }));
      });
      if (r.visitors) { const t = svg('text', { class: 'val', x: cx - bw / 2 - 1, y: y(r.visitors) - 6, 'text-anchor': 'middle' }); t.textContent = fmt(r.visitors); g.append(t); }
      const lab = svg('text', { x: cx, y: H - 5, 'text-anchor': 'middle', opacity: r.future ? 0.5 : 1 });
      lab.textContent = band < 100 ? dayLabel(r.day).split(',')[0] + ' ' + r.day.slice(8).replace(/^0/, '') : dayLabel(r.day); axis.append(lab);
      const hit = svg('rect', { class: 'hit', x: cx - band / 2, y: m.t, width: band, height: ih, rx: 8 });
      hit.addEventListener('pointermove', e => showTip(e, dayLabel(r.day) + (r.future ? ' (to come)' : ''), SERIES.map(([k, label, color]) => [label, r[k], color])));
      hit.addEventListener('pointerleave', hideTip);
      root.append(g, hit);
    });
    box.replaceChildren(root);
    box.setAttribute('aria-label', rows.filter(r => !r.future).map(r => `${dayLabel(r.day)}: ${r.visitors} people, ${r.events} actions`).join('; '));
    $('#daily-table').replaceChildren(el('table', {},
      el('thead', {}, el('tr', {}, el('th', { textContent: 'Day' }), el('th', { textContent: 'People' }), el('th', { textContent: 'Actions' }))),
      el('tbody', {}, rows.filter(r => !r.future).map(r => el('tr', {}, el('td', { textContent: dayLabel(r.day) }), el('td', { textContent: fmt(r.visitors) }), el('td', { textContent: fmt(r.events) }))))));
  }

  // ---------- tooltip ----------
  const tip = $('#tip');
  function showTip(e, title, rows) {
    tip.replaceChildren(el('b', { textContent: title }), ...rows.map(([label, v, color]) =>
      el('div', {}, el('span', {}, el('i', { style: `background:${color}` }), label), el('span', { textContent: fmt(v) }))));
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(innerWidth - r.width - 8, e.clientX + 14)}px`;
    tip.style.top = `${Math.max(8, e.clientY - r.height - 12)}px`;
  }
  function hideTip() { tip.hidden = true; }

  // ---------- funnel ----------
  function funnel(d) {
    const c = d.counts;
    const steps = [
      ['Opened it', '', d.visitors],
      ['Searched', '', c.searches || 0],
      ['Shared', '', c.shares || 0],
      ['A friend opened it', '', (c.invites_opened || 0) + (c.group_invites_opened || 0)],
      ['Said yes', '', (c.im_in || 0) + (c.group_joined || 0)],
    ];
    const top = Math.max(1, steps[0][2]);
    $('#funnel').replaceChildren(...steps.map(([label, small, n], i) => el('li', {},
      el('div', { class: 'lbl' }, label, el('small', { textContent: small })),
      el('div', { class: 'bar' }, el('i', { style: `width:${Math.min(100, (n / top) * 100)}%;animation-delay:${i * 80}ms` })),
      el('div', { class: 'num' }, el('b', { textContent: fmt(n) }), el('small', { textContent: i ? `${pct(n, steps[i - 1][2])}` : '', title: 'of the step above' })))));
  }

  // ---------- bento cards ----------
  function rows(map, name, { sea = false, limit = 6 } = {}) {
    const list = Object.entries(map || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, limit);
    if (!list.length) return el('p', { class: 'empty', textContent: 'Nothing yet.' });
    const max = list[0][1];
    return el('ol', { class: 'rows' }, list.map(([k, n], i) => el('li', {},
      el('span', { textContent: name(k) }), el('span', { class: 'n', textContent: fmt(n) }),
      el('div', { class: `bar${sea ? ' sea' : ''}` }, el('i', { style: `width:${(n / max) * 100}%;animation-delay:${i * 60}ms` })))));
  }
  function card(cls, title, note, ...body) {
    return el('div', { class: `card ${cls}` }, el('h3', { textContent: title }), note && el('p', { class: 'note', textContent: note }), ...body);
  }
  function bento(d) {
    const c = d.counts, P = d.places || {};
    const pick = key => Object.fromEntries(Object.entries(P).map(([id, v]) => [id, v[key] || 0]));
    const sizes = Object.entries(d.group_sizes || {}).filter(([k]) => /^\d+$/.test(k));
    const people = sizes.reduce((s, [k, n]) => s + k * n, 0), plans = sizes.reduce((s, [, n]) => s + n, 0);
    const used = { 'This weekend\'s best bets': c.best_open, 'Surprise me': c.surprise, 'Split the cost': c.split_open,
      'Near me': c.near_me, 'Add to calendar': c.calendar, 'Wrong info? reports': c.fix };
    $('#bento').replaceChildren(
      card('s3', 'Leaving from', 'Searches by city', rows(d.city, cityName, { limit: 4 })),
      card('s3', 'Mood', 'What they asked for', rows(d.vibe, vibeName, { sea: true, limit: 4 })),
      card('s2', 'Most shared', 'Shares per trip', rows(pick('shared'), placeName, { limit: 4 })),
      card('s2 hl', 'Hostel clicks', 'To gostops.com',
        el('div', { class: 'big' }, el('div', {}, el('b', { textContent: fmt(c.hostel) }), el('span', { textContent: 'clicks' }))),
        rows(pick('hostel'), placeName, { limit: 3 })),
      card('s2', 'Group plans', 'Swipe with friends',
        el('div', { class: 'big' },
          el('div', {}, el('b', { textContent: fmt(c.group_started) }), el('span', { textContent: 'started' })),
          el('div', {}, el('b', { textContent: fmt(c.group_joined) }), el('span', { textContent: 'joined' })),
          el('div', {}, el('b', { textContent: plans ? (people / plans).toFixed(1) : '–' }), el('span', { textContent: 'per plan' })))),
      card('', 'Features used', 'Taps per feature', rows(used, x => x, { sea: true, limit: 6 })),
    );
    document.querySelectorAll('.card').forEach(n => n.addEventListener('pointermove', e => {
      const r = n.getBoundingClientRect();
      n.style.setProperty('--mx', `${e.clientX - r.left}px`); n.style.setProperty('--my', `${e.clientY - r.top}px`);
    }));
  }

  // ---------- load ----------
  let data;
  function draw() { strip(data); daily(data); funnel(data); bento(data); freshness(data); }
  async function load() {
    try {
      const r = await fetch(`${SRC}?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      data = await r.json();
      draw();
    } catch {
      $('#fresh').textContent = "Couldn't load the numbers. Try again in a minute.";
      $('.eyebrow').classList.add('stale');
    }
  }
  clock('2026-11-27T23:59:00+05:30');
  load();
  setInterval(load, 5 * 60000);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => data && daily(data), 150); });
})();
