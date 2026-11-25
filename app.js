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
  const minDays = (p, h) => p.days || (h <= MAX_HOURS[1] ? 1 : h <= MAX_HOURS[2] ? 2 : 3);

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
  function shareText(p, from) {
    const [h, how] = p.from[from];
    return `Kahan chalein? I'm thinking ${p.name} this weekend.\n${hours(h)} from ${CITIES[from]} (${how}). ${p.why}\nIn?`;
  }
  const hostelLink = p => (p.gs ? el('a', { class: 'bed', href: `https://gostops.com/stay/${p.gs}`, target: '_blank', rel: 'noopener',
    textContent: 'goSTOPS has a hostel here ↗', onclick: () => track(`hostel/${p.id}`) }) : null);

  function facts(p, from) {
    const [h, how] = p.from[from];
    return el('ul', { class: 'facts' },
      el('li', {}, el('strong', { textContent: hours(h) }), ` · ${how}`),
      el('li', {}, el('strong', { textContent: rupees(p.cost) }), ` ${COST_TEXT[p.cost]} per person`),
      el('li', { textContent: SOLO_TEXT[p.solo] }));
  }
  function seasonStamp(p) {
    return inSeason(p)
      ? el('span', { class: 'stamp now', textContent: `Good in ${MONTHS[THIS_MONTH - 1]}` })
      : el('span', { class: 'stamp off', textContent: `Best ${monthsLabel(p.months)}` });
  }
  const wxSlot = p => el('p', { class: 'wx', 'data-id': p.id, 'data-pending': '', textContent: 'Checking this weekend\'s weather…' });

  function ticket(p, from, n) {
    const link = shareLink(p, from);
    const actions = el('div', { class: 'actions' },
      el('a', { class: 'wa', href: `https://wa.me/?text=${encodeURIComponent(shareText(p, from) + ' ' + link)}`, target: '_blank', rel: 'noopener',
        textContent: 'Send to the group chat', onclick: () => track(`share/whatsapp/${p.id}`) }),
      el('button', { type: 'button', textContent: navigator.share ? 'Share' : 'Copy link', onclick: () => share(p, from) }),
      el('button', { type: 'button', textContent: 'Story image', onclick: () => storyImage(p, from) }),
      hostelLink(p));
    return el('article', { class: 'ticket' },
      el('div', { class: 'stub' },
        el('span', { class: 'route' }, `${CITIES[from]} → `, el('b', { textContent: p.name })),
        el('span', { class: 'num', textContent: `No. ${String(n).padStart(2, '0')}` })),
      art(p),
      el('div', { class: 'body' },
        el('h3', { textContent: p.name }),
        el('p', { class: 'region' }, `${p.region}  `, seasonStamp(p)),
        facts(p, from),
        wxSlot(p),
        el('p', { class: 'why', textContent: p.why }),
        el('p', { class: 'plan' }, el('span', { textContent: 'How people do it: ' }), p.plan),
        el('p', { class: 'skip' }, el('span', { textContent: 'Skip it if: ' }), p.skip),
        actions));
  }

  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg); } catch { prompt('Copy this:', text); }
  }
  async function share(p, from) {
    const url = shareLink(p, from);
    track(`share/native/${p.id}`);
    if (navigator.share) {
      try { await navigator.share({ title: `${p.name} this weekend?`, text: shareText(p, from), url }); } catch { /* cancelled */ }
      return;
    }
    copy(`${shareText(p, from)} ${url}`, 'Link copied. Paste it in the group.');
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
  async function storyImage(p, from) {
    track(`story/${p.id}`);
    try { await document.fonts.load('800 120px Fraunces'); } catch { /* fallback font is fine */ }
    const [h, how] = p.from[from];
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    const x = c.getContext('2d');
    x.fillStyle = '#f4eee2'; x.fillRect(0, 0, 1080, 1920);
    try {
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.KCArt(p).replace('<svg ', '<svg width="600" height="260" '));
      await img.decode();
      // the art is 600×260; crop it to fill a 1080×760 band
      const sh = 260, sw = sh * 1080 / 760;
      x.drawImage(img, (600 - sw) / 2, 0, sw, sh, 0, 0, 1080, 760);
    } catch { /* no picture, still a good card */ }
    x.fillStyle = '#1d1b16'; x.font = '700 34px system-ui, sans-serif';
    x.fillText('KAHAN CHALEIN?', 90, 850);
    x.font = '800 132px Fraunces, Georgia, serif';
    let y = wrap(x, p.name, 90, 990, 900, 132);
    x.font = '600 42px system-ui, sans-serif'; x.fillStyle = '#e4572e';
    y = wrap(x, `${CITIES[from]} → ${p.name}`, 90, y + 10, 900, 54);
    x.fillStyle = '#1d1b16'; x.font = '400 40px system-ui, sans-serif';
    y = wrap(x, `${hours(h)}, ${how} · ${rupees(p.cost)} ${COST_TEXT[p.cost]}`, 90, y + 6, 900, 54);
    x.font = '400 52px Fraunces, Georgia, serif';
    wrap(x, p.why, 90, y + 50, 900, 66);
    x.font = '800 66px Fraunces, Georgia, serif'; x.fillStyle = '#e4572e';
    x.fillText('This weekend. Who\'s in?', 90, 1700);
    x.fillStyle = '#6d665a'; x.font = '400 30px system-ui, sans-serif';
    x.fillText(location.host || 'kahan chalein', 90, 1780);
    x.font = '400 23px system-ui, sans-serif';
    x.fillText('Built by Aditya Pandey for the goSTOPS Build Sprint. Not an official goSTOPS product.', 90, 1840);
    c.toBlob(async blob => {
      const file = new File([blob], `${p.id}-weekend.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: p.name }); return; } catch { /* fall through to download */ }
      }
      const a = el('a', { href: URL.createObjectURL(blob), download: file.name });
      document.body.append(a); a.click(); a.remove();
      toast('Saved. Post it to your story and tag your people.');
    }, 'image/png');
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
      vibe: { any: 'Surprise me', ...VIBES },
      who: { solo: 'Solo', group: 'With friends' },
      budget: { 1: 'Tight', 2: 'Okay', 3: 'Treat myself' },
    };
    document.querySelectorAll('#ask .chips').forEach(box => {
      const name = box.dataset.name;
      syncers.push(chipGroup(box, opts[name], () => state[name], v => {
        state[name] = v; store.set('kc.prefs', state);
        if (ranked.length) run(false);
      }));
    });
    $('#ask').addEventListener('submit', e => { e.preventDefault(); run(true); });
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
      el('p', { textContent: 'A friend sent you this:' }),
      el('h2', { textContent: `${p.name} this weekend?` }),
      el('p', { class: 'small', textContent: `${hours(p.from[from][0])} from ${CITIES[from]}. ${p.why}` }),
      el('div', { class: 'btns' },
        el('button', { class: 'yes', type: 'button', textContent: "I'm in", onclick: () => {
          track(`im-in/${p.id}`);
          window.open(`https://wa.me/?text=${encodeURIComponent(`I'm in for ${p.name}! When do we leave? ${link}`)}`, '_blank', 'noopener');
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
    run(false, true); // show picks straight away; nobody should have to work before seeing something useful
  };

  Object.assign(KC, { el, store, track, toast, copy, hours, rupees, COST_TEXT, MONTHS, CITIES, PLACES, BASE, byId,
    rank, art, facts, seasonStamp, wxSlot, fillWeather, hostelLink, chipGroup, ticket, inSeason });
})();
