// Adaptive question engine. Each skill (math, reading) has a rating that rises with first-try,
// quick answers and falls with misses (an Elo-style update). Questions are drawn mostly at the
// current level, sometimes one below (review) or one above (probe). Missed questions return later.
import { S, save, say, sfx, ICON, $, rand, pick, shuffle, gemIcon } from './core.js';

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
  const K = L.n < 10 ? 1.2 : L.n < 30 ? .7 : .45;
  L.r += K * (outcome - p);
  L.streak = outcome >= .99 ? L.streak + 1 : 0;
  if (L.streak >= 4) { L.r += L.n < 30 ? .35 : .15; L.streak = 0; }
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
function mathQ(L) {
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

/* ---------- picking and asking ---------- */
let lastTrack = 'read';
function nextQuestion(prefer) {
  const tracks = [];
  if (S.settings.math) tracks.push('math'); if (S.settings.read) tracks.push('read'); if (!tracks.length) tracks.push('math', 'read');
  let track = prefer && tracks.includes(prefer) && Math.random() < .6 ? prefer : tracks.length > 1 ? (lastTrack === 'math' ? 'read' : 'math') : tracks[0];
  lastTrack = track;
  const L = skill(track);
  if (L.miss.length && Math.random() < .22) {
    const item = L.miss.shift(); const q = JSON.parse(JSON.stringify(item.q));
    const order = shuffle(q.answers.map((_, i) => i)); const c = order.indexOf(q.correct); q.answers = order.map(i => q.answers[i]); q.correct = c;
    return { track, level: item.level, q, review: true };
  }
  const level = chooseLevel(track);
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
    m.querySelectorAll('.ans').forEach(b => b.onclick = () => {
      if (m.dataset.done) return;
      if (+b.dataset.i === q.correct) {
        m.dataset.done = '1'; b.classList.add('ok'); sfx.right(); if (!wrongs) say(pick(PRAISE));
        const secs = (performance.now() - t0) / 1000;
        const outcome = wrongs === 0 ? (secs < 10 ? 1 : .85) : wrongs === 1 ? .3 : 0;
        record(track, level, outcome);
        const L = skill(track);
        if (wrongs) { L.miss.push({ level, q }); if (L.miss.length > 8) L.miss.shift(); }
        save();
        setTimeout(() => { m.className = 'qmodal'; m.innerHTML = ''; asking = false; resolve({ wrongs, track, level, firstTry: !wrongs }); }, 650);
      } else { wrongs++; b.classList.add('no', 'gone'); sfx.wrong(); say('Försök igen.'); }
    });
  });
}
export function cancelAsk() { const m = $('#qmodal'); if (!m) return; m.className = 'qmodal'; m.innerHTML = ''; asking = false; }
