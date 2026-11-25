// "Decide with friends": everyone swipes the same 10 trips; the votes travel inside the shared link (no server).
// Link format: ?g=<base64url of {c: city, d: days, k: [place ids], v: {name: "1011…"}}>
(() => {
  const KC = window.KC;
  const { el, store, track, toast, copy, CITIES, byId, BASE } = KC;
  const $ = s => document.querySelector(s);
  const DECK_SIZE = 10, MAX_VOTERS = 15;

  let g = null;                       // the current plan
  let me = store.get('kc.name', '');  // this person's first name
  let shownOnce = false;

  // ---------- link encoding ----------
  const b64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0)));
  const encode = plan => b64(JSON.stringify(plan));
  const link = () => `${BASE}?g=${encode(g)}`;

  function decode(code) {
    try {
      const o = JSON.parse(unb64(code));
      if (!CITIES[o.c] || ![1, 2, 3].includes(+o.d) || !Array.isArray(o.k)) return null;
      const k = o.k.filter(id => typeof id === 'string' && byId(id) && byId(id).from[o.c]).slice(0, DECK_SIZE);
      if (k.length < 2 || k.length !== o.k.length) return null;
      const v = {};
      for (const [name, bits] of Object.entries(o.v || {}).slice(0, MAX_VOTERS)) {
        const n = String(name).trim().slice(0, 20);
        if (n && typeof bits === 'string' && /^[01]+$/.test(bits) && bits.length === k.length) v[n] = bits;
      }
      return { c: o.c, d: +o.d, k, v };
    } catch { return null; }
  }

  // ---------- the deck: a varied 10 that are worth going to now ----------
  function makeDeck(city, days) {
    const ranked = KC.rank({ from: city, days, vibe: 'any', who: 'group', budget: 3 });
    const perVibe = {}, out = [];
    for (const { p } of ranked) {
      const v = p.vibes[0];
      if ((perVibe[v] || 0) >= 3) continue;
      perVibe[v] = (perVibe[v] || 0) + 1; out.push(p.id);
      if (out.length === DECK_SIZE) break;
    }
    for (const { p } of ranked) { if (out.length >= DECK_SIZE) break; if (!out.includes(p.id)) out.push(p.id); }
    return out;
  }

  const panel = () => $('#group');
  const names = () => Object.keys(g.v);
  const listNames = ns => (ns.length <= 2 ? ns.join(' and ') : `${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`);
  const dayWord = d => ({ 1: 'day trip', 2: 'weekend', 3: 'long weekend' }[d]);

  function nameField() {
    return el('label', { class: 'name' }, el('span', { textContent: 'Your first name' }),
      el('input', { id: 'g-name', type: 'text', maxLength: 20, autocomplete: 'given-name', placeholder: 'So your friends know who voted', value: me }));
  }
  function readName() {
    const n = $('#g-name').value.trim().replace(/\s+/g, ' ').slice(0, 20);
    if (!n) { toast('Add your name so the group knows who voted.'); $('#g-name').focus(); return null; }
    return n;
  }

  // ---------- 1. start a plan ----------
  function setup() {
    let city = store.get('kc.prefs', {}).from || 'blr';
    if (!CITIES[city]) city = 'blr';
    let days = '2';
    const cityBox = el('div', { class: 'chips' }), dayBox = el('div', { class: 'chips' });
    panel().replaceChildren(
      el('div', { class: 'g-intro' },
        el('h2', { textContent: 'Can\'t agree where to go?' }),
        el('p', { textContent: 'Everyone swipes the same 10 trips. The link adds up the votes, so you see where the group actually matches. No sign-up, no app.' })),
      nameField(),
      el('fieldset', {}, el('legend', { textContent: 'Leaving from' }), cityBox),
      el('fieldset', {}, el('legend', { textContent: 'Time you\'ve got' }), dayBox),
      el('button', { class: 'go', type: 'button', textContent: 'Start swiping', onclick: () => {
        const n = readName(); if (!n) return;
        me = n; store.set('kc.name', me);
        g = { c: city, d: +days, k: makeDeck(city, +days), v: {} };
        track(`group/start/${city}`);
        swipe();
      } }));
    KC.chipGroup(cityBox, CITIES, () => city, v => { city = v; });
    KC.chipGroup(dayBox, { 1: 'Just a day', 2: 'The weekend', 3: 'Long weekend' }, () => days, v => { days = v; });
  }

  // ---------- 1b. joining someone else's plan ----------
  function joinIntro() {
    const who = names();
    panel().replaceChildren(
      el('div', { class: 'g-intro invite' },
        el('p', { textContent: who.length ? `${listNames(who)} ${who.length === 1 ? 'is' : 'are'} planning a ${dayWord(g.d)} from ${CITIES[g.c]}.` : `A ${dayWord(g.d)} plan from ${CITIES[g.c]}.` }),
        el('h2', { textContent: `Swipe ${g.k.length} trips. See where you match.` }),
        el('p', { class: 'small', textContent: 'Right if you\'d go, left if you wouldn\'t. Takes about a minute.' })),
      nameField(),
      el('button', { class: 'go', type: 'button', textContent: 'Start swiping', onclick: () => {
        let n = readName(); if (!n) return;
        if (g.v[n] && n !== me) { let i = 2; while (g.v[`${n} ${i}`]) i++; n = `${n} ${i}`; }
        me = n; store.set('kc.name', me);
        track('group/joined');
        swipe();
      } }));
  }

  // ---------- 2. swiping ----------
  function swipe() {
    const places = g.k.map(byId);
    const votes = [];
    let i = 0;
    const count = el('span', { class: 'count' });
    const stack = el('div', { class: 'stack' });
    const cards = places.map(p => {
      const card = el('article', { class: 'card' },
        el('span', { class: 'mark yes', textContent: 'I\'d go' }), el('span', { class: 'mark no', textContent: 'Nah' }),
        KC.art(p),
        el('div', { class: 'card-body' },
          el('h3', { textContent: p.name }),
          el('p', { class: 'region' }, `${p.region}  `, KC.seasonStamp(p)),
          KC.facts(p, g.c),
          KC.wxSlot(p),
          el('p', { class: 'why', textContent: p.why }),
          el('p', { class: 'skip' }, el('span', { textContent: 'Skip it if: ' }), p.skip)));
      bindDrag(card, yes => decide(yes));
      return card;
    });
    stack.append(...cards);
    const btns = el('div', { class: 'swipe-btns' },
      el('button', { type: 'button', class: 'nah', textContent: 'Nah', onclick: () => decide(false) }),
      el('button', { type: 'button', class: 'yes', textContent: 'I\'d go', onclick: () => decide(true) }));
    panel().replaceChildren(el('div', { class: 'swipe-head' }, el('span', { textContent: `${CITIES[g.c]} · ${dayWord(g.d)}` }), count), stack, btns,
      el('p', { class: 'hint', textContent: 'Drag the card, tap the buttons, or use ← →.' }));
    KC.fillWeather(stack, places);
    layout();

    function layout() {
      count.textContent = `${Math.min(i + 1, cards.length)} of ${cards.length}`;
      cards.forEach((c, j) => {
        c.classList.toggle('top', j === i);
        c.style.zIndex = String(cards.length - j);
        if (j < i) return;
        const depth = Math.min(j - i, 2);
        c.style.transform = depth ? `translateY(${depth * 10}px) scale(${1 - depth * 0.04})` : '';
        c.style.opacity = j - i > 2 ? '0' : '1';
      });
    }
    function decide(yes) {
      if (i >= cards.length) return;
      const c = cards[i];
      votes[i] = yes ? '1' : '0';
      c.classList.add('gone');
      c.style.transform = `translateX(${yes ? 130 : -130}%) rotate(${yes ? 18 : -18}deg)`;
      c.style.opacity = '0';
      i++;
      if (i === cards.length) { document.removeEventListener('keydown', keys); setTimeout(() => finish(votes.join('')), 260); }
      else layout();
    }
    function keys(e) {
      if (panel().hidden || e.target.closest?.('input')) return;
      if (e.key === 'ArrowRight') decide(true);
      if (e.key === 'ArrowLeft') decide(false);
    }
    document.addEventListener('keydown', keys);
  }

  function bindDrag(card, onDecide) {
    let x0 = null, dx = 0;
    card.addEventListener('pointerdown', e => {
      if (!card.classList.contains('top') || e.target.closest('a, button')) return;
      x0 = e.clientX; dx = 0; card.setPointerCapture(e.pointerId); card.classList.add('drag');
    });
    card.addEventListener('pointermove', e => {
      if (x0 == null) return;
      dx = e.clientX - x0;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
      card.style.setProperty('--yes', String(Math.max(0, Math.min(1, dx / 110))));
      card.style.setProperty('--no', String(Math.max(0, Math.min(1, -dx / 110))));
    });
    const end = () => {
      if (x0 == null) return;
      x0 = null; card.classList.remove('drag');
      card.style.setProperty('--yes', '0'); card.style.setProperty('--no', '0');
      if (Math.abs(dx) > 100) onDecide(dx > 0); else card.style.transform = '';
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  }

  function finish(bits) {
    g.v[me] = bits;
    track(`group/finished/${names().length}`);
    history.replaceState(null, '', `?g=${encode(g)}`);
    tally();
  }

  // ---------- the coming weekend (IST), for the calendar and the result image ----------
  function nextWeekend(days) {
    const ist = new Date(Date.now() + 5.5 * 3600e3);
    const dow = ist.getUTCDay();                       // 0 Sun … 6 Sat
    const sat = new Date(ist.getTime() + (((6 - dow) + 7) % 7) * 864e5);
    const start = dow === 0 ? ist : sat;               // on a Sunday, "this weekend" is today
    const end = new Date(start.getTime() + (dow === 0 ? 1 : days) * 864e5); // exclusive
    const iso = d => d.toISOString().slice(0, 10);
    const nice = d => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    return { start: iso(start), end: iso(end), label: days === 1 || dow === 0 ? nice(start) : `${nice(start)} – ${nice(new Date(end.getTime() - 864e5))}` };
  }

  function addToCalendar(p) {
    const w = nextWeekend(g.d);
    const ymd = s => s.replace(/-/g, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kahan Chalein//EN', 'BEGIN:VEVENT',
      `UID:${Date.now()}-${p.id}@kahan-chalein`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${ymd(w.start)}`, `DTEND;VALUE=DATE:${ymd(w.end)}`,
      `SUMMARY:${p.name} trip 🎒`, `DESCRIPTION:Decided on Kahan Chalein? ${link()}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = el('a', { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: `${p.id}-trip.ics` });
    document.body.append(a); a.click(); a.remove();
    track('group/calendar');
    toast(`Saved ${w.label}. Open it to add to your calendar.`);
  }

  // A 1080×1920 image of the group's result, for the group chat or a story.
  async function resultImage(top, total) {
    track('group/story');
    try { await document.fonts.load('800 120px Fraunces'); } catch { /* fallback font is fine */ }
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    const x = c.getContext('2d');
    x.fillStyle = '#f4eee2'; x.fillRect(0, 0, 1080, 1920);
    await KC.drawArt(x, top.p, 0, 720);
    const W = KC.wrapText;
    x.fillStyle = '#1d1b16'; x.font = '700 34px system-ui, sans-serif';
    x.fillText('KAHAN CHALEIN?', 90, 810);
    x.font = '400 56px Fraunces, Georgia, serif';
    x.fillText(total === 1 ? 'My pick for the weekend:' : top.yes.length === total ? 'The gang matched on' : 'Top match so far:', 90, 900);
    x.font = '800 132px Fraunces, Georgia, serif';
    let y = W(x, top.p.name, 90, 1040, 900, 132);
    x.fillStyle = '#e4572e'; x.font = '700 60px system-ui, sans-serif';
    y = W(x, total === 1 ? `${CITIES[g.c]} → ${top.p.name}` : `${top.yes.length} of ${total} said yes`, 90, y + 20, 900, 72);
    x.fillStyle = '#1d1b16'; x.font = '400 44px system-ui, sans-serif';
    if (total > 1) y = W(x, top.yes.join(' · '), 90, y + 10, 900, 58);
    y = W(x, `${nextWeekend(g.d).label} · ${KC.hours(top.p.from[g.c][0])} from ${CITIES[g.c]}`, 90, y + 10, 900, 58);
    x.font = '800 66px Fraunces, Georgia, serif'; x.fillStyle = '#e4572e';
    x.fillText(total === 1 ? 'Who\'s in? Swipe yours.' : 'Chalo! 🎒', 90, 1700);
    x.fillStyle = '#6d665a'; x.font = '400 30px system-ui, sans-serif';
    x.fillText(location.host || 'kahan chalein', 90, 1780);
    x.font = '400 23px system-ui, sans-serif';
    x.fillText('Built by Aditya Pandey for the goSTOPS Build Sprint. Not an official goSTOPS product.', 90, 1840);
    KC.saveCanvas(c, `${top.p.id}-match.png`, 'Saved. Drop it in the group chat.');
  }

  // ---------- 3. where the group matches ----------
  function headline(rows, total) {
    const best = rows[0].yes.length;
    if (!best) return 'No matches yet. Keep swiping, or start a new plan.';
    const tied = rows.filter(r => r.yes.length === best).map(r => r.p.name);
    const list = tied.length > 3 ? `${tied.slice(0, 3).join(', ')} and ${tied.length - 3} more` : listNames(tied);
    if (best === total) return tied.length === 1 ? `Everyone's in for ${tied[0]}.` : `Everyone's in for ${list}.`;
    return `${tied.length === 1 ? 'Leading' : 'Tied at the top'}: ${list} (${best} of ${total}).`;
  }

  function tally() {
    const who = names(), total = who.length;
    const rows = g.k.map((id, i) => ({ p: byId(id), yes: who.filter(n => g.v[n][i] === '1') }))
      .sort((a, b) => b.yes.length - a.yes.length || g.k.indexOf(a.p.id) - g.k.indexOf(b.p.id));
    const top = rows[0];
    const solo = total === 1;
    const msg = solo
      ? `${me} is planning a ${dayWord(g.d)} from ${CITIES[g.c]}. Swipe 10 trips (takes a minute) and let's see where we match:`
      : `${listNames(who)} swiped. Top match so far: ${top.p.name} (${top.yes.length} of ${total}). Add your swipes:`;
    const shareBox = el('div', { class: 'g-share' },
      el('p', { textContent: solo
        ? 'Now send it to the group. As each friend swipes and sends the link back, the matches add up here.'
        : 'The votes ride inside the link, so always share the newest one.' }),
      el('div', { class: 'actions' },
        el('a', { class: 'wa', href: `https://wa.me/?text=${encodeURIComponent(msg + ' ' + link())}`, target: '_blank', rel: 'noopener',
          textContent: 'Send to the group chat', onclick: () => track(`group/share/${total}`) }),
        el('button', { type: 'button', textContent: 'Copy link', onclick: () => { copy(`${msg} ${link()}`, 'Copied. Paste it in the group.'); track('group/copy'); } }),
        top.yes.length ? el('button', { type: 'button', textContent: 'Result image', onclick: () => resultImage(top, total) }) : null));

    const head = solo
      ? el('div', { class: 'g-intro' }, el('h2', { textContent: 'Your picks are in.' }),
        el('p', { textContent: `You said yes to ${rows.filter(r => r.yes.length).length} of ${g.k.length}.` }))
      : el('div', { class: 'g-intro' }, el('h2', { textContent: headline(rows, total) }),
        el('p', { textContent: `Voted so far: ${listNames(who)}.` }));

    const list = el('ol', { class: 'tally' }, rows.filter(r => r.yes.length).map(r => el('li', {},
      el('div', { class: 'tally-top' }, el('b', { textContent: r.p.name }), el('span', { textContent: `${r.yes.length} of ${total}` })),
      el('div', { class: 'bar' }, el('i', { style: `width:${(r.yes.length / total) * 100}%` })),
      solo ? null : el('p', { class: 'who', textContent: r.yes.join(', ') }))));
    const nobody = rows.filter(r => !r.yes.length).map(r => r.p.name);

    const parts = [head, shareBox];
    if (top.yes.length) {
      parts.push(el('h3', { class: 'g-h', textContent: solo ? 'Your favourite' : 'Top match' }), KC.ticket(top.p, g.c, 1, g.d),
        el('div', { class: 'g-again' }, el('button', { type: 'button', textContent: `📅 Add ${top.p.name} to my calendar (${nextWeekend(g.d).label})`, onclick: () => addToCalendar(top.p) })));
    }
    parts.push(el('h3', { class: 'g-h', textContent: 'All the votes' }), list);
    if (nobody.length) parts.push(el('p', { class: 'nobody', textContent: `Nobody picked: ${nobody.join(', ')}.` }));
    parts.push(el('div', { class: 'g-again' },
      el('button', { type: 'button', textContent: 'Redo my swipes', onclick: () => { delete g.v[me]; swipe(); } }),
      el('button', { type: 'button', textContent: 'Start a new plan', onclick: () => { g = null; history.replaceState(null, '', location.pathname + '#group'); setup(); } })));
    panel().replaceChildren(...parts);
    KC.fillWeather(panel(), top.yes.length ? [top.p] : []);
  }

  window.KCGroup = {
    show() {
      if (shownOnce) return;
      shownOnce = true;
      if (!g) setup(); else if (me && g.v[me]) tally(); else joinIntro();
    },
    openInvite(code) {
      const plan = decode(code);
      if (!plan) return false;
      g = plan;
      track('group/opened-invite');
      return true;
    },
  };
})();
