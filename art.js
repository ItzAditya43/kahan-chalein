// Little postcard illustrations, drawn from each place's main vibe. Same place → same picture (seeded by its id).
(() => {
  const W = 600, H = 260;

  function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }

  // four times of day; all light enough for dark text below the picture
  const PALETTES = [
    { sky: ['#ffe3c7', '#ffb98f'], sun: '#fff6e3', far: '#eba383', mid: '#c96a4f', near: '#7c3c2e', sea: '#5aa6b0', sand: '#f2d6a6' }, // late afternoon
    { sky: ['#d9eef4', '#a9d6e6'], sun: '#fffbea', far: '#9cc2b2', mid: '#5a927c', near: '#285d4c', sea: '#3592a8', sand: '#efe0bb' }, // morning
    { sky: ['#f9dde5', '#eaa9bd'], sun: '#fff2e2', far: '#bb92ae', mid: '#80608a', near: '#41304f', sea: '#6f90c2', sand: '#f2d5bd' }, // dusk
    { sky: ['#fdeeb2', '#f6c46e'], sun: '#fffaf0', far: '#dcaa63', mid: '#ab6d3d', near: '#5d3b23', sea: '#3f9ba1', sand: '#f4dfa8' }, // golden hour
  ];

  const f = n => Math.round(n * 10) / 10;

  function ridge(r, base, amp, segs, fill, sharp) {
    const step = W / segs;
    let d = `M0 ${H} L0 ${f(base - r() * amp * 0.5)}`;
    for (let i = 1; i <= segs; i++) {
      const x = i * step, y = base - (sharp ? (i % 2 ? amp * (0.55 + 0.45 * r()) : amp * 0.25 * r()) : r() * amp);
      d += sharp ? ` L${f(x - step / 2 + (r() - 0.5) * step * 0.4)} ${f(y)}` : ` Q${f(x - step / 2)} ${f(base - r() * amp * 1.3)} ${f(x)} ${f(y)}`;
    }
    return `<path d="${d} L${W} ${H} Z" fill="${fill}"/>`;
  }

  function birds(r, color) {
    let s = '';
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const x = 60 + r() * 480, y = 30 + r() * 60, w = 6 + r() * 6;
      s += `<path d="M${f(x - w)} ${f(y)} q${f(w / 2)} ${f(-w / 2)} ${f(w)} 0 q${f(w / 2)} ${f(-w / 2)} ${f(w)} 0" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
    }
    return s;
  }

  function palm(x, base, color, flip) {
    const s = flip ? -1 : 1;
    let d = `<path d="M${x} ${base} q${8 * s} -50 ${-4 * s} -110" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;
    const tx = x - 4 * s, ty = base - 110;
    for (const [dx, dy] of [[-48, 10], [-36, -16], [40, -14], [52, 14], [6, -34]]) {
      d += `<path d="M${tx} ${ty} q${f(dx * 0.5)} ${f(dy - 18)} ${dx} ${dy + 18}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
    }
    return d;
  }

  const scenes = {
    mountains(r, p) {
      return ridge(r, 150, 70, 6, p.far, true) + ridge(r, 190, 70, 5, p.mid, true) + ridge(r, 235, 50, 4, p.near, false);
    },
    adventure(r, p) {
      const px = 220 + r() * 160;
      const peak = `<path d="M${f(px - 210)} ${H} L${f(px - 40)} 90 L${f(px - 18)} 72 L${f(px)} 46 L${f(px + 30)} 84 L${f(px + 60)} 70 L${f(px + 230)} ${H} Z" fill="${p.mid}"/>`;
      const snow = `<path d="M${f(px - 18)} 72 L${f(px)} 46 L${f(px + 30)} 84 L${f(px + 12)} 76 L${f(px - 2)} 88 Z" fill="#fffaf2"/>`;
      const flag = `<path d="M${f(px)} 46 L${f(px)} 22" stroke="${p.near}" stroke-width="2.5"/><path d="M${f(px)} 22 L${f(px + 20)} 28 L${f(px)} 34 Z" fill="#e4572e"/>`;
      const trail = `<path d="M${f(px - 120)} 250 L${f(px - 40)} 205 L${f(px - 90)} 170 L${f(px - 20)} 130 L${f(px - 45)} 100 L${f(px - 6)} 60" fill="none" stroke="#fffaf2" stroke-width="2.5" stroke-dasharray="6 7" stroke-linecap="round" opacity=".85"/>`;
      return ridge(r, 170, 60, 6, p.far, true) + peak + snow + trail + flag + ridge(r, 250, 30, 4, p.near, false);
    },
    beach(r, p) {
      const hz = 150;
      let s = `<rect x="0" y="${hz}" width="${W}" height="${H - hz}" fill="${p.sea}"/>`;
      for (let i = 0; i < 6; i++) {
        const y = hz + 12 + i * 9, x = 230 + (r() - 0.5) * 60, w = 70 - i * 8;
        s += `<rect x="${f(x)}" y="${y}" width="${f(w)}" height="2.5" rx="1" fill="${p.sun}" opacity=".7"/>`;
      }
      s += `<path d="M0 ${H} L0 220 Q150 200 300 214 T${W} 205 L${W} ${H} Z" fill="${p.sand}"/>`;
      s += `<path d="M0 220 Q150 200 300 214 T${W} 205" fill="none" stroke="#fffaf2" stroke-width="3" opacity=".8"/>`;
      const left = r() > 0.5;
      s += palm(left ? 70 + r() * 40 : 500 + r() * 40, 235, p.near, !left);
      return s;
    },
    history(r, p) {
      const x0 = 120 + r() * 120, w = 260, top = 150;
      let fort = `<rect x="${f(x0)}" y="${top}" width="${w}" height="${H - top}" fill="${p.mid}"/>`;
      for (let x = x0; x < x0 + w; x += 20) fort += `<rect x="${f(x)}" y="${top - 10}" width="11" height="11" fill="${p.mid}"/>`;
      for (const tx of [x0 - 16, x0 + w - 24]) {
        fort += `<rect x="${f(tx)}" y="${top - 40}" width="40" height="${H - top + 40}" fill="${p.near}"/>`;
        fort += `<path d="M${f(tx - 4)} ${top - 40} L${f(tx + 20)} ${top - 62} L${f(tx + 44)} ${top - 40} Z" fill="${p.near}"/>`;
      }
      const cx = x0 + w / 2;
      fort += `<path d="M${f(cx - 46)} ${top} A46 46 0 0 1 ${f(cx + 46)} ${top} Z" fill="${p.near}"/><path d="M${f(cx)} ${top - 46} L${f(cx)} ${top - 64}" stroke="${p.near}" stroke-width="3"/>`;
      fort += `<path d="M${f(cx - 16)} ${H} L${f(cx - 16)} 222 A16 16 0 0 1 ${f(cx + 16)} 222 L${f(cx + 16)} ${H} Z" fill="${p.sky[0]}" opacity=".55"/>`;
      return ridge(r, 175, 40, 5, p.far, false) + fort + `<rect x="0" y="246" width="${W}" height="14" fill="${p.near}"/>`;
    },
    spiritual(r, p) {
      const cx = 160 + r() * 280;
      let t = '';
      const tiers = 6, baseW = 120, y0 = 200;
      for (let i = 0; i < tiers; i++) {
        const w = baseW * (1 - i * 0.14), y = y0 - i * 18;
        t += `<rect x="${f(cx - w / 2)}" y="${f(y - 18)}" width="${f(w)}" height="19" fill="${i % 2 ? p.mid : p.near}"/>`;
      }
      t += `<path d="M${f(cx - 14)} ${y0 - tiers * 18} Q${f(cx)} ${y0 - tiers * 18 - 34} ${f(cx + 14)} ${y0 - tiers * 18} Z" fill="${p.near}"/>`;
      t += `<path d="M${f(cx)} ${y0 - tiers * 18 - 26} L${f(cx)} ${y0 - tiers * 18 - 50}" stroke="${p.near}" stroke-width="2"/><path d="M${f(cx)} ${y0 - tiers * 18 - 50} L${f(cx + 18)} ${y0 - tiers * 18 - 44} L${f(cx)} ${y0 - tiers * 18 - 38} Z" fill="#e4572e"/>`;
      let steps = '';
      for (let i = 0; i < 4; i++) steps += `<rect x="0" y="${200 + i * 9}" width="${W}" height="9" fill="${i % 2 ? p.sand : p.far}"/>`;
      steps += `<rect x="0" y="236" width="${W}" height="24" fill="${p.sea}"/>`;
      for (let i = 0; i < 5; i++) steps += `<circle cx="${f(60 + r() * 480)}" cy="${f(244 + r() * 10)}" r="3" fill="#ffcf5a"/>`;
      return ridge(r, 190, 30, 5, p.far, false) + t + steps;
    },
    chill(r, p) {
      let s = ridge(r, 165, 40, 4, p.far, false);
      s += `<ellipse cx="${f(150 + r() * 80)}" cy="250" rx="300" ry="85" fill="${p.mid}"/>`;
      s += `<ellipse cx="${f(450 + r() * 80)}" cy="270" rx="280" ry="80" fill="${p.near}"/>`;
      for (let i = 0; i < 7; i++) {
        const y = 192 + i * 10;
        s += `<path d="M${f(-20 + i * 8)} ${y} Q150 ${f(y - 14)} ${f(330 - i * 12)} ${y + 6}" fill="none" stroke="${p.near}" stroke-width="2" opacity=".35"/>`;
      }
      return s;
    },
  };

  window.KCArt = function art(place) {
    const r = seeded(place.id);
    const p = PALETTES[Math.floor(r() * PALETTES.length)];
    const scene = scenes[place.vibes[0]] || scenes.mountains;
    const sx = f(80 + r() * 440), sy = f(50 + r() * 50), sr = f(22 + r() * 14);
    const gid = 'g' + place.id.replace(/[^a-z0-9]/gi, '');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration of ${place.name.replace(/&/g, "and")}">`
      + `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient></defs>`
      + `<rect width="${W}" height="${H}" fill="url(#${gid})"/>`
      + `<circle cx="${sx}" cy="${sy}" r="${sr}" fill="${p.sun}"/>`
      + birds(r, p.near) + scene(r, p) + '</svg>';
  };
})();
