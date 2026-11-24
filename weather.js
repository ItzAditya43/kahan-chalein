// This-weekend forecast from Open-Meteo (free, no key). One request per batch of places, cached for the session.
(() => {
  const WORDS = c => (c === 0 ? 'clear' : c <= 2 ? 'mostly clear' : c === 3 ? 'cloudy' : c <= 48 ? 'foggy'
    : c <= 57 ? 'drizzle' : c <= 67 ? 'rain' : c <= 77 ? 'snow' : c <= 82 ? 'showers' : c <= 86 ? 'snow showers' : 'thunderstorms');

  // The coming Saturday and Sunday in IST (or just "today" if it's already Sunday).
  function weekendDates() {
    const ist = new Date(Date.now() + 5.5 * 3600e3);
    const day = ist.getUTCDay();
    const iso = d => d.toISOString().slice(0, 10);
    if (day === 0) return [{ date: iso(ist), label: 'Today' }];
    const sat = new Date(ist.getTime() + ((6 - day) * 86400e3));
    const sun = new Date(sat.getTime() + 86400e3);
    return [{ date: iso(sat), label: day === 6 ? 'Today' : 'Sat' }, { date: iso(sun), label: 'Sun' }];
  }

  const cache = {};
  try { Object.assign(cache, JSON.parse(sessionStorage.getItem('kc.wx') || '{}')); } catch { /* ok */ }
  const save = () => { try { sessionStorage.setItem('kc.wx', JSON.stringify(cache)); } catch { /* ok */ } };

  window.KCWeather = async function weather(places) {
    const want = weekendDates();
    const key = id => `${id}:${want[0].date}`;
    const todo = places.filter(p => window.COORDS[p.id] && !cache[key(p.id)]);
    if (todo.length) {
      const lat = todo.map(p => window.COORDS[p.id][0]).join(',');
      const lon = todo.map(p => window.COORDS[p.id][1]).join(',');
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
        + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=8';
      const res = await fetch(url);
      if (!res.ok) throw new Error('weather ' + res.status);
      let data = await res.json();
      if (!Array.isArray(data)) data = [data];
      todo.forEach((p, i) => {
        const d = data[i]?.daily; if (!d) return;
        cache[key(p.id)] = want.map(w => {
          const j = d.time.indexOf(w.date);
          return j < 0 ? null : { label: w.label, max: Math.round(d.temperature_2m_max[j]), min: Math.round(d.temperature_2m_min[j]),
            rain: d.precipitation_probability_max[j] ?? 0, words: WORDS(d.weather_code[j]) };
        }).filter(Boolean);
      });
      save();
    }
    const out = {};
    for (const p of places) if (cache[key(p.id)]?.length) out[p.id] = cache[key(p.id)];
    return out;
  };
})();
