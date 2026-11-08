// Adaptive question engine. Each skill (math, reading) has a rating that rises with first-try,
// quick answers and falls with misses (an Elo-style update). Questions are drawn mostly at the
// current level, sometimes one below (review) or one above (probe). Missed questions return later.
import { S, save, say, sfx, ICON, $, rand, pick, shuffle, gemIcon, toast } from './core.js';
import { CARS } from './cars.js';

export const TRACKS = {
  math: { max: 12, start: 2, name: 'Matte' },
  read: { max: 9, start: 2, name: 'Läsa' },
};
export const LEVEL_TEXT = {
  math: ['', 'Plus till 10', 'Plus och minus till 10', 'Plus och minus till 20', 'Över tiotalet, saknat tal', 'Hela tiotal, dubbelt', 'Tvåsiffrigt, 2:ans 5:ans 10:ans tabell', 'Tvåsiffrigt plus, 3:ans och 4:ans tabell', 'Tvåsiffrigt minus, alla tabeller, två steg', 'Division, hundratal, två steg med gånger', 'Tresiffrigt, blandade steg', 'Saknad faktor, större tabeller', 'Tresiffrigt med minnessiffra, 2-siffrigt gånger 1-siffrigt'],
  read: ['', 'Korta ord (2–3 bokstäver), färger', 'Ord med 4–5 bokstäver', 'Långa ord, liknande början', 'Bild till ord', 'STOR och LITEN', 'Antal: TRE BILAR', 'Kategorier: DJUR, MAT', 'Rim', 'Korta meningar'],
};
const PRAISE = ['Bra!', 'Rätt!', 'Snyggt!', 'Precis!', 'Fint!'];
const BTN = [['#7b61ff', '#4b33c9'], ['#ff7a59', '#c64a2c'], ['#22b3ff', '#1679b8']];

/* ---------- skill model ----------
   r is an ability estimate. Questions are asked about one level below r, where the expected
   first-try success is ~80%, so he gets most right while the level keeps creeping up.
   Early answers move r fast (quick calibration), later ones slowly. Two misses in the last
   three answers puts the next few questions one level easier. */
const LEARN_V = 2;
export function skill(track) {
  S.learn = S.learn || {};
  if (S.learn.v !== LEARN_V) { S.learn = { v: LEARN_V }; }
  return S.learn[track] || (S.learn[track] = { r: TRACKS[track].start, n: 0, hist: [], miss: [], streak: 0, comfort: 0 });
}
const clampL = (track, l) => Math.max(1, Math.min(TRACKS[track].max, l));
export const levelOf = track => clampL(track, Math.floor(skill(track).r - 1));
export function setLevel(track, lvl) { const L = skill(track); L.r = lvl + 1.3; L.n = Math.max(L.n, 10); L.comfort = 0; save(); }
function chooseLevel(track) {
  const L = skill(track); let base = levelOf(track);
  if (L.comfort > 0) { L.comfort--; return clampL(track, base - 1); }
  const x = Math.random();
  return clampL(track, x < .1 ? base - 1 : x > .9 ? base + 1 : base);
}
function record(track, level, outcome) {
  const L = skill(track);
  const p = 1 / (1 + Math.exp(-(L.r - (level + .5)) * 1.4));
  const K = L.n < 10 ? 1.2 : L.n < 30 ? .8 : .55;
  L.r += K * (outcome - p);
  L.streak = outcome >= .99 ? L.streak + 1 : 0;
  if (L.streak >= 3) { L.r += L.n < 30 ? .35 : .2; L.streak = 0; }
  L.r = Math.max(2, Math.min(TRACKS[track].max + 1.99, L.r));
  L.n++; L.hist.push(outcome >= .85 ? 1 : 0); if (L.hist.length > 30) L.hist.shift();
  const last3 = L.hist.slice(-3); if (last3.length === 3 && last3.filter(x => !x).length >= 2) { L.comfort = 3; }
}
export function accuracy(track) { const h = skill(track).hist; return h.length ? Math.round(h.reduce((a, b) => a + b, 0) / h.length * 100) : null; }

/* ---------- helpers ---------- */
const spoken = e => e.replace(/\+/g, ' plus ').replace(/−/g, ' minus ').replace(/×/g, ' gånger ').replace(/÷/g, ' delat med ').replace(/\?/g, ' vad ').replace(/=/g, ' är ');
function numQ(expr, ans, { hint = 'Räkna', sayTxt, near = [] } = {}) {
  const s = new Set([ans]);
  const cands = shuffle([...near, ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10]).filter(v => v >= 0 && v !== ans);
  for (const v of cands) { if (s.size >= 3) break; s.add(v); }
  while (s.size < 3) s.add(ans + s.size + 2);
  const arr = shuffle([...s]);
  return { hint, big: expr, say: sayTxt || `Vad blir ${spoken(expr)}?`, answers: arr.map((v, i) => ({ label: String(v), c: BTN[i][0], d: BTN[i][1] })), correct: arr.indexOf(ans) };
}
const coin = () => Math.random() < .5;

/* ---------- math ---------- */
/* ---------- picture questions: clock, patterns, number line, block rows ---------- */
const SHAPE_COL = ['#e8473a', '#2f86ff', '#ffc400', '#3db54a', '#8a5cff'];
const shp = (k, c) => `<i class="shp shp-${k}" style="--c:${c}"></i>`;
function clockSVG(h, m) {
  const ha = ((h % 12) + m / 60) * 30, ma = m * 6, rad = a => (a - 90) * Math.PI / 180;
  const nums = Array.from({ length: 12 }, (_, i) => { const n = i + 1, a = rad(n * 30); return `<text x="${50 + Math.cos(a) * 36}" y="${50 + Math.sin(a) * 36 + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#22203e">${n}</text>`; }).join('');
  const hand = (a, len, w, c) => `<line x1="50" y1="50" x2="${50 + Math.cos(rad(a)) * len}" y2="${50 + Math.sin(rad(a)) * len}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  return `<svg class="clock" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" fill="#fff" stroke="#22203e" stroke-width="4"/>${nums}${hand(ha, 22, 6, '#22203e')}${hand(ma, 34, 3.5, '#e8473a')}<circle cx="50" cy="50" r="4" fill="#22203e"/></svg>`;
}
function clockQ(L) {
  const half = L >= 5 && Math.random() < .5, h = rand(1, 12), m = half ? 30 : 0;
  const name = x => half ? `halv ${x % 12 + 1}` : String(x);
  const s = new Set([h]); while (s.size < 3) s.add(rand(1, 12)); const arr = shuffle([...s]);
  return { hint: 'Vad är klockan?', big: clockSVG(h, m), say: 'Vad är klockan?', answers: arr.map((v, i) => ({ label: name(v), aria: name(v), cls: half ? 'txt' : '', c: BTN[i][0], d: BTN[i][1] })), correct: arr.indexOf(h) };
}
function patternQ(L) {
  if (L >= 4 && Math.random() < .5) { // number pattern
    const step = L >= 7 ? pick([2, 3, 4, 5, 10, -2]) : pick([1, 2, 5, 10]), a = step < 0 ? rand(12, 20) : rand(0, L >= 6 ? 20 : 10);
    const seq = [0, 1, 2, 3].map(i => a + i * step), ans = a + 4 * step;
    const q = numQ('', ans, { hint: 'Vad kommer sen?', sayTxt: 'Vad kommer sen?', near: [ans + step, ans - step] });
    q.big = `<span class="nl">${seq.map(v => `<b>${v}</b>`).join('')}<b class="q">?</b></span>`; return q;
  }
  const kinds = shuffle(['c', 's', 't']), cols = shuffle([...SHAPE_COL]);
  const items = [0, 1, 2].map(i => [kinds[i], cols[i]]);
  const unit = L <= 2 ? [0, 1] : pick([[0, 1], [0, 0, 1], [0, 1, 2], [0, 1, 1]]);
  const seq = Array.from({ length: unit.length * 2 + (unit.length === 2 ? 2 : 1) }, (_, i) => unit[i % unit.length]);
  const ans = unit[seq.length % unit.length];
  const opts = shuffle([0, 1, 2]);
  return { hint: 'Vad kommer sen?', big: `<span class="pat">${seq.map(i => shp(...items[i])).join('')}<b class="q">?</b></span>`, say: 'Vad kommer sen?', answers: opts.map(i => ({ label: shp(...items[i]), aria: 'form', cls: 'pic', c: '#ffffff', d: '#d9d4ea' })), correct: opts.indexOf(ans) };
}
function lineQ(L) {
  const hi = L <= 2 ? 10 : L <= 4 ? 20 : L <= 8 ? 100 : 1000, before = Math.random() < .4, n = rand(before ? 2 : 1, hi - 1), ans = before ? n - 1 : n + 1;
  const q = numQ('', ans, { hint: 'Vilket tal saknas?', sayTxt: 'Vilket tal saknas?', near: [ans + 10, ans - 10] });
  q.big = `<span class="nl">${before ? `<b class="q">?</b><b>${n}</b><b>${n + 1}</b>` : `<b>${n - 1}</b><b>${n}</b><b class="q">?</b>`}</span>`; return q;
}
function rowsQ(L) {
  const r = rand(2, L >= 7 ? 5 : 3), c = rand(2, L >= 7 ? 6 : 5), col = pick(['#5ff4ff', '#ffd23a', '#ff2d55', '#2fe06b']);
  const q = numQ('', r * c, { hint: L >= 6 ? `${r} rader med ${c}` : 'Hur många?', sayTxt: 'Hur många ser du?', near: [r * c + c, r * c - c, r * c + r] });
  q.big = `<span class="rows">${Array.from({ length: r }, () => `<span>${Array.from({ length: c }, () => gemIcon(col)).join('')}</span>`).join('')}</span>`; return q;
}
function extraQ(L) {
  const kinds = ['line', 'pattern'];
  if (L >= 2) kinds.push('clock'); if (L >= 5) kinds.push('rows', 'rows');
  const k = pick(kinds);
  return k === 'clock' ? clockQ(L) : k === 'pattern' ? patternQ(L) : k === 'rows' ? rowsQ(L) : lineQ(L);
}
// Car quiz for the races: two real cars, pick the one with more horsepower or a higher top speed.
export function carQ(L) {
  const kinds = [['hk', 'Flest hästkrafter?', 'Vilken bil har flest hästkrafter?', c => c.hk + ' hk', 1], ['top', 'Högst topfart?', 'Vilken bil har högst topfart?', c => c.top + ' km/h', 1]];
  if (L >= 5) kinds.push(['acc', 'Snabbast till 100?', 'Vilken bil är snabbast till hundra?', c => String(c.acc).replace('.', ',') + ' s', -1]);
  const [key, hint, sayTxt, fmt, dir] = pick(kinds);
  let a, b; do { [a, b] = shuffle([...CARS]).slice(0, 2); } while (a[key] === b[key]);
  const arr = [a, b], best = dir > 0 ? (a[key] > b[key] ? a : b) : (a[key] < b[key] ? a : b);
  return { hint, big: '', say: sayTxt, answers: arr.map(c => ({ label: `<img src="img/cars/${c.id}.jpg" alt=""><b>${fmt(c)}</b>`, aria: c.name, cls: 'carpick', c: '#ffffff', d: '#d9d4ea' })), correct: arr.indexOf(best) };
}

function mathQ(L) {
  if (Math.random() < .3) return extraQ(L);
  // occasional variety at lower levels
  if (L <= 2 && Math.random() < .2) { const n = rand(3, 9), c = pick(['#5ff4ff', '#ffd23a', '#ff2d55', '#2fe06b']); const q = numQ('', n, { hint: 'Hur många?', sayTxt: 'Hur många ser du?' }); q.big = `<span class="dots">${Array.from({ length: n }, () => gemIcon(c)).join('')}</span>`; return q; }
  if (L >= 3 && L <= 7 && Math.random() < .15) {
    const hi = L <= 4 ? 30 : L <= 5 ? 100 : 1000, big = coin(), s = new Set(); while (s.size < 3) s.add(rand(L <= 4 ? 5 : 11, hi));
    const arr = shuffle([...s]), t = big ? Math.max(...arr) : Math.min(...arr);
    return { hint: 'Tryck på', big: big ? 'STÖRST' : 'MINST', word: true, say: big ? 'Tryck på det största talet.' : 'Tryck på det minsta talet.', answers: arr.map((v, i) => ({ label: String(v), c: BTN[i][0], d: BTN[i][1] })), correct: arr.indexOf(t) };
  }
  let a, b, c, t, n;
  switch (L) {
    case 1: a = rand(1, 5); b = rand(1, 5); return numQ(`${a} + ${b}`, a + b);
    case 2: if (coin()) { a = rand(2, 8); b = rand(1, 10 - a); return numQ(`${a} + ${b}`, a + b); } a = rand(4, 10); b = rand(1, a - 1); return numQ(`${a} − ${b}`, a - b);
    case 3: if (coin()) { a = rand(11, 17); b = rand(1, 9 - a % 10); return numQ(`${a} + ${b}`, a + b); } a = rand(12, 19); b = rand(1, a % 10); return numQ(`${a} − ${b}`, a - b);
    case 4: {
      const k = rand(0, 2);
      if (k === 0) { a = rand(5, 9); b = rand(11 - a, 9); return numQ(`${a} + ${b}`, a + b); }
      if (k === 1) { a = rand(11, 17); b = rand(a % 10 + 1, 9); return numQ(`${a} − ${b}`, a - b); }
      a = rand(3, 9); c = rand(a + 3, 18); return numQ(`${a} + ? = ${c}`, c - a, { hint: 'Vilket tal saknas?', sayTxt: `${a} plus vad är ${c}?` });
    }
    case 5: {
      const k = rand(0, 2);
      if (k === 0) { a = rand(1, 7) * 10; b = rand(1, 9 - a / 10) * 10; return numQ(`${a} + ${b}`, a + b, { near: [a + b + 10, a + b - 10] }); }
      if (k === 1) { a = rand(4, 9) * 10; b = rand(1, a / 10 - 1) * 10; return numQ(`${a} − ${b}`, a - b, { near: [a - b + 10, a - b - 10] }); }
      n = rand(6, 25); return numQ(`${n} + ${n}`, n * 2, { hint: 'Dubbelt' });
    }
    case 6: {
      const k = rand(0, 2);
      if (k === 0) { a = rand(1, 8) * 10 + rand(5, 9); b = rand(10 - a % 10, 9); return numQ(`${a} + ${b}`, a + b, { near: [a + b - 10] }); }
      if (k === 1) { a = rand(2, 9) * 10 + rand(0, 6); b = rand(a % 10 + 1, 9); return numQ(`${a} − ${b}`, a - b, { near: [a - b + 10] }); }
      t = pick([2, 5, 10]); n = rand(1, 10); return numQ(coin() ? `${n} × ${t}` : `${t} × ${n}`, n * t, { hint: 'Gånger', near: [n * t + t, n * t - t] });
    }
    case 7: {
      if (coin()) { a = rand(11, 69); b = rand(11, 99 - a); return numQ(`${a} + ${b}`, a + b, { near: [a + b - 10, a + b + 10] }); }
      t = pick([3, 4]); n = rand(2, 10); return numQ(`${n} × ${t}`, n * t, { hint: 'Gånger', near: [n * t + t, n * t - t] });
    }
    case 8: {
      const k = rand(0, 2);
      if (k === 0) { a = rand(40, 99); b = rand(11, a - 10); return numQ(`${a} − ${b}`, a - b, { near: [a - b + 10, a - b - 10] }); }
      if (k === 1) { t = rand(2, 10); n = rand(2, 10); return numQ(`${t} × ${n}`, t * n, { hint: 'Gånger', near: [t * n + t, t * n - n] }); }
      a = rand(5, 20); b = rand(2, 10); c = rand(1, a + b - 1); return numQ(`${a} + ${b} − ${c}`, a + b - c, { hint: 'Två steg' });
    }
    case 9: {
      const k = rand(0, 2);
      if (k === 0) { t = rand(2, 10); n = rand(2, 10); return numQ(`${t * n} ÷ ${t}`, n, { hint: 'Delat med' }); }
      if (k === 1) { a = rand(2, 9); b = rand(2, 9); c = rand(1, 15); return numQ(`${a} × ${b} + ${c}`, a * b + c, { hint: 'Två steg' }); }
      a = rand(1, 7); b = rand(1, 9 - a); return numQ(`${a * 100} + ${b * 100}`, (a + b) * 100, { near: [(a + b) * 100 + 100, (a + b) * 100 - 100] });
    }
    case 10: {
      const k = rand(0, 2);
      if (k === 0) { a = rand(1, 5) * 100 + rand(1, 4) * 10 + rand(1, 4); b = rand(1, 3) * 100 + rand(1, 4) * 10 + rand(1, 4); return numQ(`${a} + ${b}`, a + b, { near: [a + b + 100, a + b - 10] }); }
      if (k === 1) { a = rand(5, 9) * 100 + rand(4, 9) * 10 + rand(4, 9); b = rand(1, 4) * 100 + rand(1, 3) * 10 + rand(1, 3); return numQ(`${a} − ${b}`, a - b, { near: [a - b - 100, a - b + 10] }); }
      a = rand(3, 9); b = rand(3, 9); c = rand(2, Math.min(20, a * b - 1)); return numQ(`${a} × ${b} − ${c}`, a * b - c, { hint: 'Två steg' });
    }
    case 11: {
      const k = rand(0, 2);
      if (k === 0) { t = rand(3, 10); n = rand(3, 10); return numQ(`? × ${t} = ${t * n}`, n, { hint: 'Vilket tal saknas?', sayTxt: `Vad gånger ${t} är ${t * n}?` }); }
      if (k === 1) { a = pick([11, 12, 15, 20, 25]); n = rand(2, 6); return numQ(`${a} × ${n}`, a * n, { hint: 'Gånger', near: [a * n + a, a * n - a] }); }
      t = rand(2, 9); n = rand(2, 9); c = rand(2, 15); return numQ(`${t * n} ÷ ${t} + ${c}`, n + c, { hint: 'Två steg' });
    }
    default: {
      if (coin()) { a = rand(150, 699); b = rand(150, 299); return numQ(`${a} + ${b}`, a + b, { near: [a + b - 10, a + b + 100, a + b - 100] }); }
      a = rand(12, 39); b = rand(2, 6); return numQ(`${a} × ${b}`, a * b, { hint: 'Gånger', near: [a * b + b, a * b - 10] });
    }
  }
}

/* ---------- reading ---------- */
// word, picture, category, plural, definite form, ett-word
const W = [
  ['KO', '🐮', 'DJUR', 'KOR', 'KON'], ['BI', '🐝', 'DJUR', 'BIN', '', 1], ['SOL', '☀️', 'SAK'], ['BIL', '🚗', 'FORDON', 'BILAR'], ['HUS', '🏠', 'SAK', 'HUS', '', 1], ['BOK', '📖', 'SAK', 'BÖCKER'],
  ['ORM', '🐍', 'DJUR', 'ORMAR', 'ORMEN'], ['MUS', '🐭', 'DJUR', 'MÖSS', 'MUSEN'], ['BÅT', '⛵', 'FORDON', 'BÅTAR'], ['TÅG', '🚂', 'FORDON', 'TÅG', '', 1], ['SKO', '👟', 'KLÄDER', 'SKOR'], ['OST', '🧀', 'MAT'], ['ÄGG', '🥚', 'MAT', 'ÄGG', '', 1],
  ['HUND', '🐶', 'DJUR', 'HUNDAR', 'HUNDEN'], ['KATT', '🐱', 'DJUR', 'KATTER', 'KATTEN'], ['FISK', '🐟', 'DJUR', 'FISKAR'], ['GRIS', '🐷', 'DJUR', 'GRISAR', 'GRISEN'], ['BOLL', '⚽', 'SAK', 'BOLLAR'],
  ['MÅNE', '🌙', 'SAK'], ['GLASS', '🍦', 'MAT', 'GLASSAR'], ['KAKA', '🍪', 'MAT', 'KAKOR'], ['TRÄD', '🌳', 'SAK', 'TRÄD', '', 1], ['ANKA', '🦆', 'DJUR', 'ANKOR', 'ANKAN'], ['HÄST', '🐴', 'DJUR', 'HÄSTAR', 'HÄSTEN'],
  ['BUSS', '🚌', 'FORDON', 'BUSSAR'], ['CYKEL', '🚲', 'FORDON', 'CYKLAR'], ['LEJON', '🦁', 'DJUR', 'LEJON', 'LEJONET', 1], ['BANAN', '🍌', 'MAT', 'BANANER'], ['ÄPPLE', '🍎', 'MAT', 'ÄPPLEN', '', 1],
  ['PIZZA', '🍕', 'MAT', 'PIZZOR'], ['TÅRTA', '🎂', 'MAT', 'TÅRTOR'], ['MÖSSA', '🧢', 'KLÄDER', 'MÖSSOR'], ['TRÖJA', '👕', 'KLÄDER', 'TRÖJOR'], ['ROBOT', '🤖', 'SAK', 'ROBOTAR'], ['RAKET', '🚀', 'FORDON', 'RAKETER'],
  ['UGGLA', '🦉', 'DJUR', 'UGGLOR'], ['NYCKEL', '🔑', 'SAK', 'NYCKLAR'], ['BLOMMA', '🌸', 'SAK', 'BLOMMOR'], ['KLOCKA', '⏰', 'SAK', 'KLOCKOR'], ['MOROT', '🥕', 'MAT', 'MORÖTTER'], ['TOMAT', '🍅', 'MAT', 'TOMATER'],
  ['KRONA', '👑', 'SAK', 'KRONOR'], ['STJÄRNA', '⭐', 'SAK', 'STJÄRNOR'], ['ELEFANT', '🐘', 'DJUR', 'ELEFANTER'], ['GIRAFF', '🦒', 'DJUR', 'GIRAFFER'], ['FLYGPLAN', '✈️', 'FORDON', 'FLYGPLAN', '', 1], ['JORDGUBBE', '🍓', 'MAT', 'JORDGUBBAR'],
];
const COLORS = [['RÖD', '#e8473a', '#a82a1f'], ['GRÖN', '#3db54a', '#25802f'], ['BLÅ', '#2f86ff', '#1a5bc0'], ['GUL', '#ffd23a', '#c49a00'], ['SVART', '#26262c', '#000000'], ['VIT', '#ffffff', '#b9bcc8'], ['ROSA', '#ff8ccf', '#c9589b'], ['LILA', '#8a5cff', '#5a35c4'], ['BRUN', '#8a5a2b', '#5c3a18'], ['ORANGE', '#ff8a1f', '#c4600a']];
const RHYMES = [['BIL', 'PIL', 'SIL'], ['HUS', 'MUS', 'BUS'], ['KATT', 'HATT', 'NATT'], ['BOLL', 'NOLL', 'TROLL'], ['SOL', 'STOL', 'KOL'], ['GRIS', 'IS', 'RIS'], ['BÅT', 'GRÅT', 'LÅT'], ['KO', 'SKO', 'BO'], ['FISK', 'DISK', 'VISK'], ['KAKA', 'BAKA', 'SMAKA'], ['HAND', 'SAND', 'BAND'], ['VÄG', 'SLÄG', 'TRÄG']];
const NUMW = ['', '', 'TVÅ', 'TRE', 'FYRA', 'FEM'];
const LETTERS = 'ABDEFGHIJKLMNOPRSTUVÅÄÖ'.split('');
const picQ = (hint, big, sayTxt, items, correctItem, render, word = true) => {
  const arr = shuffle([...items]);
  return { hint, big, word, say: sayTxt, answers: arr.map(it => ({ label: render(it), aria: it[0] || 'bild', cls: 'pic', c: '#ffffff', d: '#d9d4ea' })), correct: arr.indexOf(correctItem) };
};
const wordBtns = (hint, big, sayTxt, words, correct, bigIsWord = true) => {
  const arr = shuffle([...words]);
  return { hint, big, word: bigIsWord, say: sayTxt, answers: arr.map((w, i) => ({ label: w, cls: 'txt', c: BTN[i][0], d: BTN[i][1] })), correct: arr.indexOf(correct) };
};
function threeFrom(pool, first) { const rest = shuffle(pool.filter(w => w !== first)).slice(0, 2); return [first, ...rest]; }

function readQ(L) {
  if (L <= 2 && Math.random() < .25) {
    const opts = shuffle([...COLORS]).slice(0, 3), t = opts[0], arr = shuffle([...opts]);
    return { hint: 'Vilken färg?', big: t[0], word: true, say: 'Vilken färg står det?', answers: arr.map(cl => ({ label: '', aria: cl[0], cls: 'swatch', c: cl[1], d: cl[2] })), correct: arr.indexOf(t) };
  }
  if (L === 1 && Math.random() < .25) {
    const w = pick(W.filter(x => x[0].length <= 4)), f = w[0][0], s = new Set([f]); while (s.size < 3) s.add(pick(LETTERS)); const arr = shuffle([...s]);
    return { hint: 'Första bokstaven?', big: `<span class="emo">${w[1]}</span>`, say: `Vilken bokstav börjar ${w[0].toLowerCase()} med?`, answers: arr.map((v, i) => ({ label: v, c: BTN[i][0], d: BTN[i][1] })), correct: arr.indexOf(f) };
  }
  if (L <= 3) {
    const pool = W.filter(w => L === 1 ? w[0].length <= 3 : L === 2 ? w[0].length >= 3 && w[0].length <= 5 : w[0].length >= 4);
    const t = pick(pool); let others = W.filter(w => w !== t);
    if (L === 3) { const same = others.filter(w => w[0][0] === t[0][0]); if (same.length >= 2) others = same; }
    const items = [t, ...shuffle(others).slice(0, 2)];
    return picQ('Vilken bild?', t[0], 'Vilken bild passar ordet?', items, t, w => w[1]);
  }
  if (L === 4) {
    const t = pick(W), sim = W.filter(w => w !== t && (w[0][0] === t[0][0] || Math.abs(w[0].length - t[0].length) <= 1));
    const words = [t[0], ...shuffle(sim).slice(0, 2).map(w => w[0])];
    return wordBtns('Vilket ord?', `<span class="emo">${t[1]}</span>`, 'Vilket ord passar bilden?', words, t[0], false);
  }
  if (L === 5) {
    const en = W.filter(w => !w[5] && w[2] !== 'MAT' || (!w[5] && w[0] === 'BANAN'));
    const t = pick(en), o = pick(en.filter(w => w !== t)), bigWanted = coin();
    const items = [[t[0], t[1], bigWanted], [t[0], t[1], !bigWanted], [o[0], o[1], bigWanted]];
    return picQ('Vilken bild?', `${bigWanted ? 'STOR' : 'LITEN'} ${t[0]}`, 'Vilken bild passar orden?', items, items[0], it => `<span class="${it[2] ? 'em-big' : 'em-small'}">${it[1]}</span>`);
  }
  if (L === 6) {
    const pl = W.filter(w => w[3] && w[3] !== w[0]); const t = pick(pl), o = pick(pl.filter(w => w !== t)), n = rand(2, 5), m = n === 5 ? 4 : n + 1;
    const items = [[t[0], t[1], n], [t[0], t[1], m], [o[0], o[1], n]];
    return picQ('Vilken bild?', `${NUMW[n]} ${t[3]}`, 'Vilken bild passar orden?', items, items[0], it => `<span class="em-row">${it[1].repeat(it[2])}</span>`);
  }
  if (L === 7) {
    const cats = ['DJUR', 'MAT', 'FORDON', 'KLÄDER'], c = pick(cats), inC = W.filter(w => w[2] === c && w[0].length <= 6), out = W.filter(w => w[2] !== c && w[0].length <= 6);
    const t = pick(inC), words = [t[0], ...shuffle(out).slice(0, 2).map(w => w[0])];
    return wordBtns('Vilket är', c, `Vilket ord är ${c.toLowerCase()}?`, words, t[0]);
  }
  if (L === 8) {
    const g = pick(RHYMES), [base, ans] = shuffle([...g]).slice(0, 2), others = shuffle(RHYMES.filter(x => x !== g)).slice(0, 2).map(x => pick(x));
    return wordBtns('Rimmar på', base, `Vilket ord rimmar på ${base.toLowerCase()}?`, [ans, ...others], ans);
  }
  const animals = W.filter(w => w[4]), foods = W.filter(w => ['OST', 'GLASS', 'PIZZA', 'TÅRTA'].includes(w[0]));
  const a = pick(animals), f = pick(foods), a2 = pick(animals.filter(x => x !== a)), f2 = pick(foods.filter(x => x !== f));
  const items = [[a[0], `${a[1]}${f[1]}`], [a2[0], `${a2[1]}${f[1]}`], [a[0] + '2', `${a[1]}${f2[1]}`]];
  return picQ('Vilken bild?', `${a[4]} ÄTER ${f[0]}`, 'Vilken bild passar meningen?', items, items[0], it => `<span class="em-row">${it[1]}</span>`);
}

/* ---------- Persian (farsi): letters first, words once the alphabet is learned ----------
   He speaks Persian but can't read it yet, so letters are taught sound-first: he hears the letter and a
   word he knows, then taps the letter. Letters come in small groups; a letter counts as learned after
   3 first-try right answers in a row, and the next group opens when the whole group is learned.
   Words unlock only when all letters are learned: short words, then longer, then picture -> word. */
export const FA_SETS = [
  [['ا', 'الف', 'اسب', '🐴'], ['ب', 'به', 'بادکنک', '🎈'], ['د', 'دال', 'دست', '✋'], ['م', 'میم', 'ماه', '🌙']],
  [['ن', 'نون', 'نان', '🍞'], ['س', 'سین', 'سیب', '🍎'], ['ر', 'ره', 'روباه', '🦊'], ['ت', 'ته', 'توپ', '⚽']],
  [['ی', 'یه', 'یخ', '🧊'], ['و', 'واو', 'وال', '🐳'], ['ک', 'کاف', 'کفش', '👟'], ['گ', 'گاف', 'گل', '🌸']],
  [['ش', 'شین', 'شیر', '🦁'], ['ل', 'لام', 'لاک‌پشت', '🐢'], ['پ', 'په', 'پرنده', '🐦'], ['ز', 'زه', 'زنبور', '🐝']],
  [['ج', 'جیم', 'جوجه', '🐤'], ['چ', 'چه', 'چتر', '☂️'], ['خ', 'خه', 'خرگوش', '🐰'], ['ف', 'فه', 'فیل', '🐘']],
  [['ه', 'هه', 'هویج', '🥕'], ['ق', 'قاف', 'قایق', '⛵'], ['غ', 'غین', 'غذا', '🍲'], ['آ', 'آ', 'آب', '💧']],
  [['ع', 'عین', 'عینک', '👓'], ['ح', 'حه', 'حلزون', '🐌'], ['ط', 'طا', 'طوطی', '🦜'], ['ص', 'صاد', 'صندلی', '🪑']],
  [['ژ', 'ژه', 'ژله', '🍮'], ['ذ', 'ذال', 'ذرت', '🌽'], ['ث', 'ثه', 'ثانیه', '⏱️'], ['ض', 'ضاد', 'ضبط', '📻'], ['ظ', 'ظا', 'ظرف', '🍽️']],
];
export const FA_WORDS1 = [['آب', '💧'], ['گل', '🌸'], ['ماه', '🌙'], ['نان', '🍞'], ['سیب', '🍎'], ['دست', '✋'], ['شیر', '🦁'], ['موش', '🐭'], ['اسب', '🐴'], ['توپ', '⚽'], ['کفش', '👟'], ['فیل', '🐘'], ['سگ', '🐶'], ['برف', '❄️'], ['یخ', '🧊'], ['چتر', '☂️'], ['ابر', '☁️'], ['کیک', '🎂'], ['در', '🚪']];
export const FA_WORDS2 = [['بابا', '👨'], ['مامان', '👩'], ['ماهی', '🐟'], ['درخت', '🌳'], ['خرس', '🐻'], ['گربه', '🐱'], ['باران', '🌧️'], ['ماشین', '🚗'], ['کتاب', '📖'], ['خانه', '🏠'], ['جوجه', '🐤'], ['روباه', '🦊'], ['زنبور', '🐝'], ['هویج', '🥕'], ['قایق', '⛵'], ['پرنده', '🐦'], ['عینک', '👓'], ['خرگوش', '🐰'], ['ستاره', '⭐'], ['موز', '🍌'], ['انگور', '🍇']];
export const FA_PHRASES = { which: 'کدوم حرفه؟', starts: 'کدوم عکس با این حرف شروع میشه؟', wordPic: 'این کلمه کدوم عکسه؟', picWord: 'کدوم کلمه درسته؟', retry: 'دوباره امتحان کن.', newSet: 'آفرین! حرف‌های جدید!', words: 'آفرین! حالا کلمه می‌خونیم!' };
export const FA_PRAISE = ['آفرین!', 'عالیه!', 'درسته!', 'باریکلا!'];
export const faLetterSay = l => `${l[1]}، مثلِ ${l[2]}. ${FA_PHRASES.which}`;
const FA_ALL = FA_SETS.flat();
export function fa() { S.learn = S.learn || {}; return S.learn.fa || (S.learn.fa = { m: {}, set: 0, stage: 0, w: {} }); }
const faLearned = ch => (fa().m[ch] || 0) >= 3;
export function faProgress() { const F = fa(); return { letters: FA_ALL.filter(l => faLearned(l[0])).length, total: FA_ALL.length, set: F.set, stage: F.stage }; }
export function faSetLevel(set) { const F = fa(); F.set = Math.max(0, Math.min(FA_SETS.length - 1, set)); if (F.set < FA_SETS.length - 1) F.stage = 0; save(); }
const faBig = t => `<span class="fa">${t}</span>`;
function faQuestion() {
  const F = fa(), open = FA_SETS.slice(0, F.set + 1).flat();
  const wordsQ = (list, pool) => {
    const t = pick(list.filter(w => (F.w[w[0]] || 0) < 2).length ? list.filter(w => (F.w[w[0]] || 0) < 2) : list);
    const others = shuffle(pool.filter(w => w !== t && w[1] !== t[1])).slice(0, 2);
    if (F.stage >= 3 && Math.random() < .5) { const arr = shuffle([t, ...others]); return { fa: true, item: { k: 'w', id: t[0] }, after: t[0], hint: faBig(FA_PHRASES.picWord), big: `<span class="emo">${t[1]}</span>`, say: FA_PHRASES.picWord, answers: arr.map((w, i) => ({ label: faBig(w[0]), aria: w[0], cls: 'txt fa-ans', c: BTN[i][0], d: BTN[i][1] })), correct: arr.indexOf(t) }; }
    const arr = shuffle([t, ...others]);
    return { fa: true, item: { k: 'w', id: t[0] }, after: t[0], hint: faBig(FA_PHRASES.wordPic), big: `<span class="fa fa-word">${t[0]}</span>`, word: true, say: FA_PHRASES.wordPic, answers: arr.map(w => ({ label: w[1], aria: 'bild', cls: 'pic', c: '#ffffff', d: '#d9d4ea' })), correct: arr.indexOf(t) };
  };
  if (F.stage >= 1 && Math.random() > .1) {
    const list = F.stage === 1 ? FA_WORDS1 : F.stage === 2 ? [...FA_WORDS2, ...FA_WORDS1.slice(0, 6)] : [...FA_WORDS1, ...FA_WORDS2];
    return wordsQ(list, [...FA_WORDS1, ...FA_WORDS2]);
  }
  const cur = FA_SETS[F.set], todo = cur.filter(l => !faLearned(l[0]));
  const L = Math.random() < .72 ? pick(todo.length ? todo : cur) : pick(open);
  const pool = (open.length >= 3 ? open : FA_ALL).filter(x => x !== L && !(L[0] === 'ا' && x[0] === 'آ') && !(L[0] === 'آ' && x[0] === 'ا'));
  const others = shuffle(pool).slice(0, 2);
  if ((F.m[L[0]] || 0) >= 1 && Math.random() < .35) { // see the letter, pick the picture that starts with it
    const arr = shuffle([L, ...others]);
    return { fa: true, item: { k: 'l', id: L[0] }, after: L[2], hint: faBig(FA_PHRASES.starts), big: `<span class="fa fa-letter">${L[0]}</span>`, say: FA_PHRASES.starts, answers: arr.map(x => ({ label: x[3], aria: x[2], cls: 'pic', c: '#ffffff', d: '#d9d4ea' })), correct: arr.indexOf(L) };
  }
  const arr = shuffle([L, ...others]); // hear the letter, pick it
  return { fa: true, item: { k: 'l', id: L[0] }, hint: faBig(FA_PHRASES.which), big: `<span class="emo">${L[3]}</span>`, say: faLetterSay(L), answers: arr.map((x, i) => ({ label: faBig(x[0]), aria: x[1], cls: 'txt fa-ans fa-l', c: BTN[i][0], d: BTN[i][1] })), correct: arr.indexOf(L) };
}
function faRecord(item, wrongs) {
  const F = fa(), tbl = item.k === 'l' ? F.m : F.w;
  tbl[item.id] = wrongs ? 0 : (tbl[item.id] || 0) + 1;
  if (item.k === 'l' && F.stage === 0 && FA_SETS[F.set].every(l => faLearned(l[0]))) {
    if (F.set < FA_SETS.length - 1) { F.set++; return 'newSet'; }
    F.stage = 1; return 'words';
  }
  if (item.k === 'w') {
    const share = list => list.filter(w => (F.w[w[0]] || 0) >= 2).length / list.length;
    if (F.stage === 1 && share(FA_WORDS1) >= .8) F.stage = 2;
    else if (F.stage === 2 && share(FA_WORDS2) >= .8) F.stage = 3;
  }
  return null;
}

/* ---------- picking and asking ---------- */
let lastTrack = 'read';
function nextQuestion(prefer) {
  const tracks = [];
  if (S.settings.math) tracks.push('math'); if (S.settings.read) tracks.push('read'); if (S.settings.farsi !== false) tracks.push('farsi'); if (!tracks.length) tracks.push('math', 'read');
  let track = prefer && tracks.includes(prefer) && Math.random() < .6 ? prefer : tracks[(tracks.indexOf(lastTrack) + 1) % tracks.length];
  lastTrack = track;
  if (track === 'farsi') return { track, level: 0, q: faQuestion() };
  const L = skill(track);
  if (L.miss.length && Math.random() < .22) {
    const item = L.miss.shift(); const q = JSON.parse(JSON.stringify(item.q));
    const order = shuffle(q.answers.map((_, i) => i)); const c = order.indexOf(q.correct); q.answers = order.map(i => q.answers[i]); q.correct = c;
    return { track, level: item.level, q, review: true };
  }
  const level = chooseLevel(track);
  if (prefer === 'car' && S.settings.math && Math.random() < .45) return { track: 'math', level: Math.min(level, 5), q: carQ(level) };
  return { track, level, q: track === 'math' ? mathQ(level) : readQ(level) };
}

let asking = false;
export const isAsking = () => asking;
export function ask({ title = 'Fråga', accent = '#6a4cff', place = '', prefer = null } = {}) {
  return new Promise(resolve => {
    asking = true;
    const { track, level, q } = nextQuestion(prefer), m = $('#qmodal'), t0 = performance.now();
    m.className = 'qmodal on ' + place; m.style.setProperty('--q', accent); m.dataset.done = '';
    m.innerHTML = `<div class="qcard" role="dialog" aria-label="${title}">
      <div class="qhead"><span class="qtitle">${title}</span><button class="speak" aria-label="Lyssna">${ICON.speaker}</button></div>
      <div class="qbody"><span class="hint">${q.hint}</span><span class="big${q.word ? ' word' : ''}">${q.big}</span></div>
      <div class="answers">${q.answers.map((a, i) => `<button class="ans ${a.cls || ''}" data-i="${i}" style="--c:${a.c};--d:${a.d}" aria-label="${a.aria || a.label}">${a.label}</button>`).join('')}</div></div>`;
    setTimeout(() => say(q.say), 200);
    let wrongs = 0;
    m.querySelector('.speak').onclick = () => say(q.say);
    // Answer on touch-down: on iPhone a tap with a second finger (while one finger holds GAS) never becomes a click.
    const shownAt = performance.now();
    m.querySelectorAll('.ans').forEach(b => {
      b.addEventListener('pointerdown', e => { e.preventDefault(); if (performance.now() - shownAt > 350) choose(b); });
      b.onclick = e => { if (e.detail === 0) choose(b); };
    });
    function choose(b) {
      if (m.dataset.done || b.classList.contains('gone')) return;
      if (+b.dataset.i === q.correct) {
        m.dataset.done = '1'; b.classList.add('ok'); sfx.right();
        if (q.fa) {
          const ev = faRecord(q.item, wrongs); save();
          const words = [q.after, wrongs ? '' : pick(FA_PRAISE), ev ? FA_PHRASES[ev] : ''].filter(Boolean);
          say(words.join(' '));
          if (ev === 'newSet') toast('Nya persiska bokstäver!', 2200); if (ev === 'words') toast('Alla bokstäver klara! Nu kommer persiska ord.', 3000);
        } else {
          if (!wrongs) say(pick(PRAISE));
          const secs = (performance.now() - t0) / 1000;
          const outcome = wrongs === 0 ? (secs < 10 ? 1 : .85) : wrongs === 1 ? .3 : 0;
          record(track, level, outcome);
          const L = skill(track);
          if (wrongs) { L.miss.push({ level, q }); if (L.miss.length > 8) L.miss.shift(); }
          save();
        }
        setTimeout(() => { m.className = 'qmodal'; m.innerHTML = ''; asking = false; resolve({ wrongs, track, level, firstTry: !wrongs }); }, 650);
      } else { wrongs++; b.classList.add('no', 'gone'); sfx.wrong(); say(q.fa ? FA_PHRASES.retry : 'Försök igen.'); }
    }
  });
}
export function cancelAsk() { const m = $('#qmodal'); if (!m) return; m.className = 'qmodal'; m.innerHTML = ''; asking = false; }
