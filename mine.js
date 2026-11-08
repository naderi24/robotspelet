// Blockgruvan: hold on a block to dig it. Harder blocks take longer; harder ores need better pickaxes.
// Ores and finds open with a question. Pickaxes are built from ores and open deeper caves.
import { THREE, S, save, $, ICON, gemIcon, coinIcon, M, E, RB, mesh, canvasTex, skyTex, makeSparks, makeMotes, createView, makeRobot, idleRobot, setLoop, sfx, say, toast, openPanel, closePanel, toScreen, flyTo, lerp, ease, clamp01, rand, pick, CALM } from './core.js';
import { ask, cancelAsk, isAsking } from './learn.js';
import { makeCreature, ANIMALS, MOBS } from './creatures.js';

// t = pickaxe tier needed, h = how hard (seconds with the first pickaxe)
export const ORES = {
  kol: { n: 'Kol', c: '#3a3a40', px: ['#1c1c20', '#2c2c32', '#4a4a52'], e: .15, t: 0, h: 1.1 },
  koppar: { n: 'Koppar', c: '#e27b3c', px: ['#e27b3c', '#ffb07a', '#b5541f'], e: .7, t: 1, h: 1.3 },
  jarn: { n: 'Järn', c: '#e8c8ac', px: ['#e8c8ac', '#fff0e0', '#b8957a'], e: .6, t: 1, h: 1.4 },
  guld: { n: 'Guld', c: '#ffd23a', px: ['#ffd23a', '#fff1a0', '#d9a400'], e: 1.2, t: 2, h: 1.6 },
  diamant: { n: 'Diamant', c: '#5ff4ff', px: ['#5ff4ff', '#d8feff', '#1fb8c9'], e: 1.8, t: 2, h: 1.9 },
  smaragd: { n: 'Smaragd', c: '#2fe06b', px: ['#2fe06b', '#b0ffc8', '#169a45'], e: 1.6, t: 3, h: 2.1 },
  rubin: { n: 'Rubin', c: '#ff2d55', px: ['#ff2d55', '#ffb0c0', '#b8102f'], e: 1.8, t: 3, h: 2.2 },
  eldsten: { n: 'Eldsten', c: '#ff8a00', px: ['#ff8a00', '#ffd080', '#c45a00'], e: 2, t: 3, h: 2.2 },
  stjarnsten: { n: 'Stjärnsten', c: '#fff27a', px: ['#fff27a', '#ffffff', '#e0c040'], e: 2.2, t: 4, h: 2.5 },
  regnbage: { n: 'Regnbågssten', c: '#ff6bd6', px: ['#ff6bd6', '#5ff4ff', '#ffe14a', '#7dff6a'], e: 2.2, t: 4, h: 2.6 },
};
// ores: [name, share]; hard = seconds for plain blocks in this layer
export const LAYERS = [
  { n: 'Jordlagret', base: ['#7a4f2c', '#6b4426', '#875a33', '#5e3b20'], alt: ['#8b8f99', '#7c808a', '#979ba5', '#6e727c'], ores: [['kol', .65], ['koppar', .22], ['jarn', .13]], hard: [.45, .9], bg: 0x8fd0ff, amb: [0xcfe8ff, 0x5a4030, 1.0], mote: 0xffe2b0, surface: true, finds: [['🐚', 'Ammonit'], ['🦴', 'Benbit'], ['🪙', 'Gammalt mynt']] },
  { n: 'Stengrottan', base: ['#8b8f99', '#7c808a', '#979ba5', '#6e727c'], alt: ['#6a6e78', '#5d616a', '#74787f'], ores: [['jarn', .35], ['koppar', .2], ['guld', .3], ['diamant', .15]], hard: [.9, 1.1], bg: 0x0d1018, amb: [0x8a9ad0, 0x2a2018, .55], mote: 0xffd9a0, torches: true, finds: [['🦷', 'Dinosaurietand'], ['🗝️', 'Gammal nyckel'], ['🏺', 'Urgammal vas']] },
  { n: 'Kristallgrottan', base: ['#3b4a7a', '#33406b', '#44558a', '#2c375c'], alt: ['#4a3c86', '#5a4a9a', '#3e3270'], ores: [['diamant', .4], ['guld', .2], ['smaragd', .4]], hard: [1.1, 1.3], bg: 0x060a20, amb: [0x6a8cff, 0x10142a, .55], mote: 0x7ff9ff, crystals: true, finds: [['🔮', 'Glaskula'], ['🦕', 'Dinosaurieskelett'], ['🐚', 'Pärlsnäcka']] },
  { n: 'Lavagrottan', base: ['#3a2626', '#2e1d1d', '#452c2a', '#271818'], alt: ['#4a2014', '#5a2a1a', '#3a180e'], ores: [['rubin', .4], ['eldsten', .4], ['diamant', .2]], hard: [1.3, 1.5], bg: 0x140504, amb: [0xff8a5a, 0x1a0604, .6], mote: 0xff9a3c, lava: true, finds: [['🥚', 'Drakägg'], ['🌋', 'Vulkansten'], ['👑', 'Gammal krona']] },
  { n: 'Stjärngrottan', base: ['#3a2a5c', '#2f2250', '#47336b', '#271c44'], alt: ['#1c1636', '#2a1f4c', '#241a40'], ores: [['stjarnsten', .45], ['regnbage', .35], ['rubin', .2]], hard: [1.5, 1.7], bg: 0x04020c, amb: [0xb38cff, 0x0a0618, .6], mote: 0xffffff, stars: true, finds: [['☄️', 'Meteorit'], ['🛸', 'Ufo-bit'], ['🌠', 'Stjärnstoft']] },
];
// pickaxes; tier i opens layer i in the elevator; speed multiplies digging speed
export const TOOLS = [
  { n: 'Trähacka', c: 0xa8763e, speed: 1 },
  { n: 'Stenhacka', c: 0x9aa0aa, speed: 1.5, cost: { kol: 12 } },
  { n: 'Järnhacka', c: 0xe8d8c8, speed: 2.1, cost: { jarn: 15, koppar: 10 } },
  { n: 'Diamanthacka', c: 0x5ff4ff, speed: 2.8, cost: { diamant: 12, guld: 12 } },
  { n: 'Stjärnhacka', c: 0xfff27a, speed: 3.6, cost: { rubin: 15, eldsten: 15 } },
];
export const DRILLS = TOOLS;
const LAMPS = [{ n: 'Ficklampa', d: 7, i: 14 }, { n: 'Stark lampa', d: 10, i: 22, cost: { koppar: 10 } }, { n: 'Superlampa', d: 14, i: 34, cost: { guld: 12 } }];
const PAINTS = [
  { n: 'Grön', c: 0x22c55e }, { n: 'Blå', c: 0x2f7bff, cost: { kol: 10 } }, { n: 'Koppar', c: 0xe27b3c, cost: { koppar: 12 } },
  { n: 'Silver', c: 0xd8dde6, cost: { jarn: 12 } }, { n: 'Guld', c: 0xffc83d, cost: { guld: 15 } }, { n: 'Kristall', c: 0x5ff4ff, cost: { diamant: 12 } },
  { n: 'Smaragd', c: 0x169a45, cost: { smaragd: 12 } }, { n: 'Rubin', c: 0xff2d55, cost: { rubin: 12 } }, { n: 'Rymd', c: 0x8a5cff, cost: { stjarnsten: 12 } }, { n: 'Regnbåge', c: 0xff6bd6, cost: { regnbage: 12 } },
];
const X0 = -6, X1 = 6, BOT = -34;
let TOP = 2; // highest row the robot can reach (higher above ground, so there is sky to build in)
// Building blocks: everything he digs goes into the backpack and can be placed again.
export const BLOCKS = {
  jord: { n: 'Jord', pal: ['#7a4f2c', '#6b4426', '#875a33', '#5e3b20'], h: .45 },
  sten: { n: 'Sten', pal: ['#8b8f99', '#7c808a', '#979ba5', '#6e727c'], h: .9 },
  tra: { n: 'Trä', pal: ['#b07a45', '#a06c3a', '#bd8650'], h: .7, planks: true },
  lov: { n: 'Löv', pal: ['#2f8f2f', '#3aa83a', '#277a27', '#46b846'], h: .25 },
};
const HAMMER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6-3 3-6-6z"/><path d="M11 7L3 15l3 3 8-8"/></svg>';
const iconCache = {};
function blockIcon(t) {
  if (iconCache[t]) return iconCache[t];
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'), b = BLOCKS[t]; let seed = t.length * 97;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { seed = (seed * 16807) % 2147483647; g.fillStyle = b.pal[seed % b.pal.length]; g.fillRect(x, y, 1, 1); }
  if (b.planks) { g.fillStyle = '#6b4426'; for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1); }
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 15, 16, 1); g.fillRect(15, 0, 1, 16);
  return iconCache[t] = c.toDataURL();
}
const bagOf = (t, surface) => t === 'grass' || (t === 'b0' && surface) ? 'jord' : t === 'b0' || t === 'b1' ? 'sten' : t === 'log' ? 'tra' : t === 'leaf' ? 'lov' : t.startsWith('p_') ? t.slice(2) : null;
let view, hud, api, W = null, bot = null, shopTab = 'tools';
const inv = k => S.mine.inv[k] || 0;
const have = k => BLOCKS[k] ? (S.mine.bag[k] || 0) : inv(k);
const canAfford = cost => !!cost && Object.entries(cost).every(([k, n]) => have(k) >= n);
const pay = cost => Object.entries(cost).forEach(([k, n]) => { if (BLOCKS[k]) S.mine.bag[k] = have(k) - n; else S.mine.inv[k] = inv(k) - n; });
const itemIcon = (k, s) => ORES[k] ? gemIcon(ORES[k].c, s) : BLOCKS[k] ? `<img class="bicon" src="${blockIcon(k)}" alt="">` : k === 'lader' ? '<i class="leath"></i>' : '';
// Swords decide how many hits a fight takes; armor sometimes stops a monster's hit.
export const SWORDS = [
  { n: 'Träsvärd', c: 0xa8763e, dmg: 1 },
  { n: 'Stensvärd', c: 0x9aa0aa, dmg: 2, cost: { sten: 12 } },
  { n: 'Järnsvärd', c: 0xe8d8c8, dmg: 3, cost: { jarn: 8 } },
  { n: 'Guldsvärd', c: 0xffd23a, dmg: 4, cost: { guld: 8 } },
  { n: 'Diamantsvärd', c: 0x5ff4ff, dmg: 5, cost: { diamant: 8 } },
];
export const ARMOR = [
  { n: 'Ingen rustning', c: 0x6b7194, block: 0 },
  { n: 'Läderrustning', c: 0xa0643a, block: .25, cost: { lader: 5 } },
  { n: 'Järnrustning', c: 0xe8d8c8, block: .4, cost: { jarn: 12 } },
  { n: 'Guldrustning', c: 0xffd23a, block: .55, cost: { guld: 12 } },
  { n: 'Diamantrustning', c: 0x5ff4ff, block: .7, cost: { diamant: 14 } },
];
const MAXHP = 5;
const swordIcon = (c, size = 56) => `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(45 32 32)"><path d="M28 4h8v40h-8z" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="2"/><path d="M28 4l4-4 4 4z" fill="${c}"/><rect x="20" y="42" width="24" height="6" rx="2" fill="#5a3a1c"/><rect x="29" y="48" width="6" height="12" rx="2" fill="#8a5a2c"/></g></svg>`;
const armorIcon = (c, size = 56) => `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><path d="M14 10l10-4c2 6 14 6 16 0l10 4 6 14-8 4v28H16V28l-8-4z" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="2" stroke-linejoin="round"/></svg>`;
const heartSVG = full => `<svg viewBox="0 0 24 24" class="heart${full ? '' : ' empty'}" aria-hidden="true"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/></svg>`;
const FOODICON = '<svg viewBox="0 0 24 24" class="foodi" aria-hidden="true"><path d="M15 3a6 6 0 0 0-5.6 8.2L4 16.6a2 2 0 1 0 2.8 2.8l1-1 1 1A2 2 0 1 0 11.6 17l-1-1 2.2-2.2A6 6 0 1 0 15 3z" fill="#c8743a"/><circle cx="15" cy="9" r="3" fill="#e8955a"/></svg>';
const hexs = n => '#' + n.toString(16).padStart(6, '0');
const tier = () => Math.min(S.mine.drill || 0, TOOLS.length - 1);
export const pickIcon = (c, size = 56) => `<svg class="pickico" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(-35 32 32)"><rect x="29" y="16" width="6" height="44" rx="3" fill="#8a5a2c"/><path d="M6 20 Q32 4 58 20 L56 25 Q32 13 8 25Z" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="2" stroke-linejoin="round"/></g></svg>`;

export function enter(stage, hudEl, a) {
  api = a; hud = hudEl;
  S.mine.worlds = S.mine.worlds || {}; S.mine.lamp = S.mine.lamp || 0; S.mine.finds = S.mine.finds || {}; S.mine.holds = S.mine.holds || 0;
  S.mine.bag = Object.assign({ jord: 0, sten: 0, tra: 0, lov: 0 }, S.mine.bag || {}); S.mine.sel = S.mine.sel || 'jord'; S.mine.builds = S.mine.builds || 0;
  if (S.mine.hp == null) S.mine.hp = MAXHP; S.mine.food = S.mine.food || 0; S.mine.sword = S.mine.sword || 0; S.mine.armor = S.mine.armor || 0;
  if (S.mine.layer > tier()) S.mine.layer = tier();
  view = createView(stage, { bloom: [.5, .5, .8], exposure: 1.1 });
  stage.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
  buildHud(); buildWorld(S.mine.layer);
}
export function exit() {
  setLoop(null); cancelAsk(); closePanel();
  window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
  if (W && bot) { persist(); save(); }
  if (view) { view.host.removeEventListener('pointerdown', onDown); view.dispose(); }
  view = null; hud.innerHTML = ''; W = null; bot = null;
}

/* ================= textures ================= */
function rng(seed) { seed = (seed % 2147483646) + 1; return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
function edges(g) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, 15, 16, 1); g.fillRect(15, 0, 1, 16); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16); }
function pix(pal, r, draw, outline = true) {
  return canvasTex(16, 16, g => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = pal[Math.floor(r() * pal.length)]; g.fillRect(x, y, 1, 1); } if (draw) draw(g); if (outline) edges(g); }, { nearest: true });
}
function oreTex(pal, ore, r) {
  const spots = []; for (let k = 0; k < 5; k++) { const cx = 2 + Math.floor(r() * 11), cy = 2 + Math.floor(r() * 11); [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]].slice(0, 3 + Math.floor(r() * 4)).forEach(([dx, dy], j) => spots.push([cx + dx, cy + dy, ore.px[(j + k) % ore.px.length]])); }
  const map = pix(pal, r, g => spots.forEach(([x, y, c]) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); }));
  const em = canvasTex(16, 16, g => { g.fillStyle = '#000'; g.fillRect(0, 0, 16, 16); spots.forEach(([x, y, c]) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); }); }, { nearest: true });
  return M(0xffffff, { map, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: ore.e, roughness: .7 });
}
function findTex(pal, r) {
  const bone = [[4, 6], [5, 7], [6, 8], [7, 8], [8, 8], [9, 8], [10, 7], [11, 6], [4, 9], [11, 9], [3, 6], [12, 6], [3, 9], [12, 9]];
  const map = pix(pal, r, g => { g.fillStyle = '#f2ead8'; bone.forEach(([x, y]) => g.fillRect(x, y, 1, 1)); });
  const em = canvasTex(16, 16, g => { g.fillStyle = '#000'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#8a8070'; bone.forEach(([x, y]) => g.fillRect(x, y, 1, 1)); }, { nearest: true });
  return M(0xffffff, { map, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: .5, roughness: .8 });
}
function crackTex(stage) {
  return canvasTex(16, 16, g => {
    g.clearRect(0, 0, 16, 16); g.fillStyle = 'rgba(0,0,0,.75)';
    const lines = [[[7, 7], [6, 6], [5, 5], [8, 8], [9, 9]], [[7, 8], [7, 9], [7, 10], [8, 6], [9, 5], [10, 4]], [[4, 9], [3, 10], [2, 11], [11, 10], [12, 11], [13, 12], [5, 4], [4, 3]], [[1, 6], [2, 6], [3, 5], [12, 3], [13, 2], [10, 12], [10, 13], [9, 14], [2, 13], [3, 12], [14, 7], [13, 7]]];
    for (let s = 0; s <= stage; s++) lines[s].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  }, { nearest: true, srgb: false });
}
function shade(hex, k) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k * .5); return '#' + c.getHexString(); }
function pickOre(L, r) { let x = r(), acc = 0; for (const [k, w] of L.ores) { acc += w; if (x <= acc) return k; } return L.ores[0][0]; }
const isSpecial = t => !!ORES[t] || t === 'chest' || t === 'find';

/* ================= world ================= */
function persist() { if (W && bot) S.mine.worlds[W.li] = { seed: W.seed, dug: [...W.dug], placed: { ...W.placed }, x: bot.x, y: bot.y }; }
function buildWorld(li, fresh = false) {
  const L = LAYERS[li], sc = new THREE.Scene();
  TOP = L.surface ? 7 : 2;
  const saved = !fresh && S.mine.worlds[li];
  const seed = saved ? saved.seed : Math.floor(Math.random() * 1e9);
  const r = rng(seed);
  view.setScene(sc);
  sc.background = L.surface ? skyTex([[0, '#4aa8f0'], [.6, '#a8dcff'], [1, '#e8f6ff']]) : new THREE.Color(L.bg);
  sc.fog = new THREE.Fog(L.surface ? 0xcfeaff : L.bg, 14, 34);
  const hemi = new THREE.HemisphereLight(...L.amb); sc.add(hemi);
  const front = new THREE.DirectionalLight(0xffffff, L.surface ? 1.6 : .35); front.position.set(-4, 10, 12); sc.add(front);
  const lp = LAMPS[S.mine.lamp || 0], lamp = new THREE.PointLight(0xfff0d0, lp.i, lp.d, 1.4); sc.add(lamp);
  const dark = L.base.map(c => shade(c, -.35));
  const mats = {
    b0: M(0xffffff, { map: pix(L.base, r), roughness: .95 }), b1: M(0xffffff, { map: pix(L.alt, r), roughness: .95 }),
    edge: M(0xffffff, { map: pix(dark, r, g => { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 7, 16, 1); g.fillRect(7, 0, 1, 16); }), roughness: 1 }),
    chest: M(0xffffff, { map: canvasTex(16, 16, g => { g.fillStyle = '#8a4a20'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#6a3410'; for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1); g.fillStyle = '#ffc23a'; g.fillRect(0, 6, 16, 2); g.fillRect(6, 5, 4, 5); g.fillStyle = '#2a1a08'; g.fillRect(7, 7, 2, 2); edges(g); }, { nearest: true }), emissive: 0x332200, roughness: .6 }),
    find: findTex(L.alt, r),
  };
  L.ores.forEach(([k]) => mats[k] = oreTex(L.base, ORES[k], r));
  mats.log = M(0xffffff, { map: pix(['#6b4426', '#5a381e', '#7a4f2c'], r, g => { g.fillStyle = '#4a2e18'; for (let x = 2; x < 16; x += 5) g.fillRect(x, 0, 1, 16); }), roughness: 1 });
  mats.leaf = M(0xffffff, { map: pix(BLOCKS.lov.pal, r), roughness: .9 });
  for (const k in BLOCKS) mats['p_' + k] = M(0xffffff, { map: pix(BLOCKS[k].pal, r, BLOCKS[k].planks ? g => { g.fillStyle = '#6b4426'; for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1); } : null), roughness: .95 });
  if (L.surface) {
    const side = pix(L.base, r, g => { for (let x = 0; x < 16; x++) { const h = 3 + (x * 7 % 3 === 0 ? 1 : 0); for (let y = 0; y < h; y++) { g.fillStyle = ['#5cbf3a', '#4fae31', '#69cc45'][(x + y) % 3]; g.fillRect(x, y, 1, 1); } } });
    const top = pix(['#5cbf3a', '#4fae31', '#69cc45', '#57b736'], r);
    const sm = M(0xffffff, { map: side, roughness: 1 }), tm = M(0xffffff, { map: top, roughness: 1 });
    mats.grass = [sm, sm, tm, mats.b0, sm, sm];
  }
  const grid = new Map(), key = (x, y) => x + ',' + y, put = (x, y, t) => grid.set(key(x, y), { x, y, t });
  const oreP = y => .035 + .025 * clamp01((-y) / 30);
  for (let x = X0 - 7; x <= X1 + 7; x++) for (let y = BOT - 2; y <= (L.surface ? 0 : TOP + 4); y++) {
    const ins = x >= X0 && x <= X1 && y >= BOT && y <= TOP;
    if (ins && y >= 1) continue;
    if (!ins) { if (y >= 1 && L.surface) continue; put(x, y, 'edge'); continue; }
    if (y === BOT) { put(x, y, 'edge'); continue; }
    let t = L.surface && y === 0 ? 'grass' : (Math.sin(x * .7 + y * .4) + Math.sin(y * .33 - x * .21) > (L.surface ? .2 + y * .04 : .9)) ? 'b1' : 'b0';
    if (t !== 'grass' && y < -1 && r() < oreP(y)) t = pickOre(L, r);
    put(x, y, t);
  }
  for (const c of [...grid.values()]) if (ORES[c.t] && r() < .3) { const n = grid.get(key(c.x + (r() < .5 ? 1 : 0), c.y - (r() < .5 ? 1 : 0))); if (n && (n.t === 'b0' || n.t === 'b1') && n.x >= X0 && n.x <= X1 && n.y > BOT) n.t = c.t; }
  const placeRare = (t, p) => { if (r() < p) { const c = grid.get(key(X0 + Math.floor(r() * 13), -8 - Math.floor(r() * 22))); if (c && c.t !== 'edge') c.t = t; } };
  placeRare('chest', .3); placeRare('find', .45);
  const placed = saved && saved.placed ? { ...saved.placed } : {};
  const treeKeys = [];
  if (L.surface) for (const tx of [X0, X1]) {
    for (let y = 1; y <= 3; y++) { put(tx, y, 'log'); treeKeys.push(key(tx, y)); }
    for (let dx = -1; dx <= 1; dx++) for (let y = 4; y <= 5; y++) { put(tx + dx, y, 'leaf'); treeKeys.push(key(tx + dx, y)); }
    put(tx, 6, 'leaf'); treeKeys.push(key(tx, 6));
  }
  const dug = new Set(saved ? saved.dug : []);
  treeKeys.forEach(k => { if (!placed[k]) dug.delete(k); }); // trees grow back between visits
  dug.forEach(k => grid.delete(k));
  Object.keys(placed).forEach(k => { if (grid.has(k)) delete placed[k]; });
  const box = new THREE.BoxGeometry(1, 1, 1), groups = {}, o = new THREE.Object3D();
  for (const c of grid.values()) (groups[c.t] = groups[c.t] || []).push(c);
  const ims = {};
  for (const t in groups) {
    const list = groups[t], im = new THREE.InstancedMesh(box, mats[t], list.length);
    list.forEach((c, i) => { o.position.set(c.x, c.y, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); c.i = i; });
    im.receiveShadow = true; sc.add(im); ims[t] = im;
  }
  for (const [k, t] of Object.entries(placed)) { const [x, y] = k.split(',').map(Number); const m = mesh(box, mats['p_' + t], x, y, 0, sc); m.receiveShadow = true; grid.set(k, { x, y, t: 'p_' + t, mesh: m }); }
  const yMin = BOT - 2, yMax = L.surface ? .5 : TOP + 5;
  const bt = pix(L.base.map(c => shade(c, -.45)), r); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(30, yMax - yMin);
  mesh(new THREE.PlaneGeometry(30, yMax - yMin), M(0xffffff, { map: bt, roughness: 1 }), 0, (yMin + yMax) / 2, -.5, sc);
  decorate(sc, L);
  // aim outline and cracks
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85 }));
  outline.visible = false; sc.add(outline);
  const cracks = [0, 1, 2, 3].map(crackTex);
  const crack = mesh(new THREE.PlaneGeometry(1.002, 1.002), new THREE.MeshBasicMaterial({ map: cracks[0], transparent: true, depthWrite: false }), 0, 0, .502, sc); crack.visible = false;
  const R = makeRobot({ body: PAINTS[S.mine.paint]?.c ?? 0x22c55e, accent: 0xffa323, pick: true, drillColor: TOOLS[tier()].c });
  R.scale.setScalar(.3); sc.add(R);
  const chips = makeSparks(sc, 260, .1, { square: true, gravity: 9 });
  const glints = makeSparks(sc, 120, .14, { gravity: 0 });
  const motes = makeMotes(sc, 90, [-9, 9, -6, 6, -.3, .6], L.mote, .05, { speed: .15, opacity: .6 });
  W = { li, L, sc, grid, ims, key, lamp, hemi, front, R, chips, glints, motes, mats, o, seed, dug, placed, box, outline, crack, cracks, camY: 1.5, camX: 0, swingBase: -1.3, held: false, dig: null, mode: 'dig',
    mobs: [], clock: 25, spawnT: 1.5, regenT: 0, wasNight: false, dayBg: sc.background, ambI: L.amb[2] };
  if (L.surface) {
    W.moon = mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false }), -8, 8.5, -12, sc); W.moon.visible = false;
    W.stars = makeMotes(sc, 160, [-24, 24, 4, 16, -11.5, -11], 0xffffff, .12, { speed: 0, opacity: 0 }); W.sun = sc.userData.sun;
    W.nightBg = new THREE.Color(0x0b1030); W.dayFog = new THREE.Color(0xcfeaff);
  }
  gearRobot();
  bot = { x: 0, y: 1, anim: null, target: null, busy: false };
  if (saved && saved.y <= TOP && saved.y > BOT && !grid.has(key(saved.x, saved.y))) { bot.x = saved.x; bot.y = saved.y; }
  R.position.set(bot.x, bot.y - .5, 0); W.camY = Math.min(1.8, bot.y + .4); W.camX = Math.max(-2.5, Math.min(2.5, bot.x * .55));
  persist(); save();
  view.camera.fov = 40; view.camera.updateProjectionMatrix();
  updateHud(); drawStatus();
  if (S.mine.holds < 3) { showHint('Håll inne på en sten för att gräva'); setTimeout(() => say('Håll fingret på en sten för att gräva!'), 500); }
  else setTimeout(() => say(L.n), 300);
  setLoop(loop);
}
function decorate(sc, L) {
  if (L.surface) {
    sc.userData.sun = mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }), 9, 9, -12, sc);
    const hillM = M(0x5fbf3c, { roughness: 1, flatShading: true });
    for (let i = 0; i < 6; i++) { const h = mesh(new THREE.SphereGeometry(6 + Math.random() * 5, 16, 8), hillM, -20 + i * 8, -2.5, -14 - Math.random() * 4, sc); h.scale.y = .45; }
    const trunk = M(0x6b4426), leaf = M(0x3aa83a, { roughness: .9 });
    for (const tx of [-10, -8.5, 8.5, 10.5]) { const g = new THREE.Group(); g.position.set(tx, .5, -.8); sc.add(g); for (let y = 0; y < 3; y++) mesh(new THREE.BoxGeometry(1, 1, 1), trunk, 0, y + .5, 0, g); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let y = 3; y <= 4; y++) if (!(Math.abs(dx) + Math.abs(dz) === 2 && y === 4)) mesh(new THREE.BoxGeometry(1, 1, 1), leaf, dx, y + .5, dz, g); }
  } else {
    for (const x of [-3, 3]) { mesh(new THREE.BoxGeometry(.1, 1.4, .1), M(0x5a3a1c), x, 1.2, -.3, sc); mesh(new THREE.BoxGeometry(.3, .3, .3), E(0xffc070, 3), x, 2, -.3, sc); }
  }
  const liftM = M(0x9aa0aa, { metalness: .8, roughness: .3 });
  for (const dx of [-.45, .45]) mesh(new THREE.BoxGeometry(.08, 2, .08), liftM, -5 + dx, 1.5, -.2, sc);
  mesh(new THREE.BoxGeometry(1, .08, .8), liftM, -5, .55, -.1, sc); mesh(new THREE.BoxGeometry(1, .08, .8), liftM, -5, 2.45, -.1, sc);
  mesh(new THREE.BoxGeometry(.3, .2, .05), E(0x5fff8a, 2), -5, 1.6, .25, sc);
  mesh(RB(1, .12, .7, .03), M(0x8a5a2c), 5, 1.05, -.1, sc); for (const dx of [-.4, .4]) mesh(new THREE.BoxGeometry(.08, .5, .08), M(0x6b4426), 5 + dx, .75, -.1, sc);
  mesh(new THREE.BoxGeometry(.4, .25, .3), M(0x3a3f4a, { metalness: .8 }), 5.1, 1.25, -.1, sc);
  mesh(new THREE.PlaneGeometry(.5, .3), E(0x7fd8ff, 1.5), 4.75, 1.45, .01, sc);
  const z = -.46;
  if (L.torches) for (let i = 0; i < 14; i++) { const x = rand(-6, 6), y = rand(BOT + 2, -2); mesh(new THREE.BoxGeometry(.08, .3, .02), M(0x6b4426), x, y, z, sc); mesh(new THREE.BoxGeometry(.12, .12, .02), E(0xffb347, 4), x, y + .18, z, sc); }
  if (L.crystals) for (let i = 0; i < 40; i++) { const c = mesh(new THREE.OctahedronGeometry(.18 + Math.random() * .2, 0), E(pick([0x6ff7ff, 0xa58bff, 0x5f8cff]), 2), rand(-6, 6) + Math.random() - .5, rand(BOT + 1, -1) + Math.random() - .5, z, sc); c.scale.y = 1.8; c.rotation.z = Math.random() - .5; }
  if (L.lava) for (let i = 0; i < 16; i++) mesh(new THREE.PlaneGeometry(.6 + Math.random() * 1.6, .25), E(0xff5a1a, 2.4), rand(-6, 6), rand(BOT + 1, -2) - .4, z, sc);
  if (L.stars) makeMotes(sc, 300, [-14, 14, BOT - 2, TOP + 4, -.47, -.46], 0xffffff, .08, { speed: 0 });
}

/* ================= HUD ================= */
function buildHud() {
  hud.innerHTML = `
    <div class="hud-top">
      <button class="round" id="m-home" aria-label="Till startsidan">${ICON.home}</button>
      <div class="chip" data-batt><b class="batt"><i></i></b><span></span></div>
      <div class="chip" id="m-layer"></div>
      <span class="grow"></span>
      <div class="inv" id="m-inv"></div>
    </div>
    <div class="m-status" id="m-status"></div>
    <div class="hotbar" id="m-hotbar" hidden></div>
    <div class="m-tools">
      <button class="tool" id="m-build" data-tts="Bygg"><span class="round big" id="m-build-ic">${HAMMER}</span><em id="m-build-lbl">Bygg</em></button>
      <button class="tool" id="m-shop" data-tts="Verkstaden"><span class="round big">${ICON.wrench}</span><em>Verkstad</em></button>
      <button class="tool" id="m-lift" data-tts="Hissen"><span class="round big">${ICON.lift}</span><em>Hiss</em></button>
    </div>
    <div class="hintb" id="m-hint"></div>`;
  api.refreshBattery();
  $('#m-home').onclick = () => api.exit();
  $('#m-shop').onclick = () => showShop();
  $('#m-build').onclick = toggleBuild;
  $('#m-lift').onclick = showLift;
  drawStatus();
}
const nextTool = () => TOOLS[tier() + 1];
function updateHud() {
  if (!W) return;
  const nt = nextTool();
  $('#m-layer').textContent = `${W.L.n} · ${Math.max(0, 1 - bot.y)} m`;
  const ks = nt ? Object.keys(nt.cost) : W.L.ores.map(o => o[0]).slice(0, 2);
  $('#m-inv').innerHTML = ks.map(k => { const need = nt && nt.cost[k]; return `<div class="slot" id="slot-${k}">${gemIcon(ORES[k].c)}<b>${inv(k)}${need ? `<small>/${need}</small>` : ''}</b></div>`; }).join('') + (nt ? `<div class="slot goal">${pickIcon(hexs(nt.c), 22)}<b><small>${nt.n}</small></b></div>` : '');
  $('#m-shop .round').classList.toggle('ready', canAfford(nt && nt.cost));
}
function drawStatus() {
  const el = $('#m-status'); if (!el || !W) return;
  const night = W.L.surface ? (W.wasNight ? 'moon' : 'sun') : '';
  el.innerHTML = `<div class="hearts" id="m-hearts">${Array.from({ length: MAXHP }, (_, i) => heartSVG(i < S.mine.hp)).join('')}</div>
    <button class="foodbtn" id="m-food" aria-label="Ät">${FOODICON}<b>${S.mine.food}</b></button>
    ${night ? `<span class="daynight ${night}" aria-hidden="true"></span>` : ''}`;
  $('#m-food').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); eat(); });
}
function eat() {
  if (!S.mine.food) { sfx.wrong(); say('Du har ingen mat. Fånga djur på gräset!'); return; }
  if (S.mine.hp >= MAXHP) { sfx.tap(); say('Du är mätt.'); return; }
  S.mine.food--; S.mine.hp = Math.min(MAXHP, S.mine.hp + 2); sfx.right(); say('Mums!'); save(); drawStatus();
}
function showHint(t) { const h = $('#m-hint'); if (!h) return; h.textContent = t; h.classList.add('on'); clearTimeout(h._t); h._t = setTimeout(() => h.classList.remove('on'), 4000); }

/* ================= input ================= */
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -.5), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
function onDown(e) {
  if (!W || isAsking() || $('#panel').classList.contains('on') || e.target.closest('button')) return;
  const rc = view.host.getBoundingClientRect();
  ndc.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
  ray.setFromCamera(ndc, view.camera);
  if (!ray.ray.intersectPlane(plane, hit)) return;
  const tx = Math.max(X0, Math.min(X1, Math.round(hit.x))), ty = Math.max(BOT + 1, Math.min(TOP, Math.round(hit.y)));
  W.held = true; W.pressT = performance.now();
  W.outline.position.set(tx, ty, 0); W.outline.visible = true;
  if (W.mode === 'build' && tryPlace(tx, ty)) { W.held = false; return; }
  if (tx === bot.x && ty === bot.y) return;
  bot.target = [tx, ty]; sfx.tap();
}
function onUp() { if (!W) return; W.held = false; }

/* ================= building ================= */
function drawHotbar() {
  const hb = $('#m-hotbar'); if (!hb) return;
  hb.innerHTML = Object.keys(BLOCKS).map(k => `<button class="hb${S.mine.sel === k ? ' on' : ''}" data-b="${k}" aria-label="${BLOCKS[k].n}"><img src="${blockIcon(k)}" alt=""><b>${S.mine.bag[k] || 0}</b></button>`).join('');
  hb.querySelectorAll('.hb').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); S.mine.sel = b.dataset.b; sfx.tap(); say(BLOCKS[b.dataset.b].n); drawHotbar(); }));
}
function toggleBuild() {
  W.mode = W.mode === 'build' ? 'dig' : 'build'; sfx.tap();
  const on = W.mode === 'build';
  $('#m-hotbar').hidden = !on; $('#m-build-lbl').textContent = on ? 'Gräv' : 'Bygg'; $('#m-build-ic').innerHTML = on ? pickIcon(hexs(TOOLS[tier()].c), 30) : HAMMER;
  $('#m-build').dataset.tts = on ? 'Gräv' : 'Bygg';
  if (on) { drawHotbar(); if (S.mine.builds < 3) { showHint('Välj ett block och tryck där du vill bygga'); setTimeout(() => say('Välj ett block och tryck där du vill bygga!'), 400); } }
}
function tryPlace(x, y) {
  if (!inside(x, y) || solid(x, y) || (x === bot.x && y === bot.y) || mobAt(x, y)) return false;
  if (W.L.surface && Math.abs(x) === 5 && y <= 2) return false; // lift and workbench
  if (!(solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) return false;
  const t = S.mine.sel;
  if (!(S.mine.bag[t] > 0)) { sfx.wrong(); say('Du har inga block av den sorten. Gräv först!'); return true; }
  const m = mesh(W.box, W.mats['p_' + t], x, y, 0, W.sc); m.receiveShadow = true; m.scale.setScalar(.6);
  W.grid.set(W.key(x, y), { x, y, t: 'p_' + t, mesh: m }); W.placed[W.key(x, y)] = t;
  S.mine.bag[t]--; S.mine.builds++; sfx.thud(); W.chips.burst(new THREE.Vector3(x, y, .5), 6, 1.2, BLOCKS[t].pal);
  const t0 = performance.now(); const grow = () => { const k = Math.min(1, (performance.now() - t0) / 140); m.scale.setScalar(.6 + .4 * k); if (k < 1) requestAnimationFrame(grow); }; grow();
  persist(); save(); drawHotbar(); return true;
}

/* ================= movement and digging ================= */
const cellAt = (x, y) => W.grid.get(W.key(x, y));
const solid = (x, y) => !!cellAt(x, y);
const inside = (x, y) => x >= X0 && x <= X1 && y > BOT && y <= TOP;
function chooseStep() {
  const [tx, ty] = bot.target, dx = tx - bot.x, dy = ty - bot.y;
  if (!dx && !dy) { bot.target = null; return null; }
  const opts = [];
  if (Math.abs(dy) >= Math.abs(dx)) { if (dy) opts.push([0, Math.sign(dy)]); if (dx) opts.push([Math.sign(dx), 0]); }
  else { if (dx) opts.push([Math.sign(dx), 0]); if (dy) opts.push([0, Math.sign(dy)]); }
  // prefer an open way, then a diggable one
  for (const [sx, sy] of opts) { const nx = bot.x + sx, ny = bot.y + sy; if (inside(nx, ny) && !solid(nx, ny)) return [sx, sy]; }
  for (const [sx, sy] of opts) { const nx = bot.x + sx, ny = bot.y + sy; if (!inside(nx, ny)) continue; const c = cellAt(nx, ny); if (c && c.t === 'edge') continue; return [sx, sy]; }
  bot.target = null; return null;
}
function hideCell(c) {
  if (c.mesh) { W.sc.remove(c.mesh); const k = W.key(c.x, c.y); delete W.placed[k]; W.grid.delete(k); return; }
  const im = W.ims[c.t]; W.o.position.set(0, -999, 0); W.o.scale.setScalar(0); W.o.updateMatrix(); im.setMatrixAt(c.i, W.o.matrix); im.instanceMatrix.needsUpdate = true; W.o.scale.setScalar(1);
  const k = W.key(c.x, c.y); W.grid.delete(k); W.dug.add(k);
}
function faceTo(sx, sy) { if (sx) W.R.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; W.swingBase = sy > 0 ? -2.3 : sy < 0 ? -.6 : -1.3; }
function hardness(c) {
  if (ORES[c.t]) return ORES[c.t].h;
  if (c.t === 'chest') return .9; if (c.t === 'find') return 1.2;
  if (c.t === 'log') return .8; if (c.t === 'leaf') return .25; if (c.t.startsWith('p_')) return BLOCKS[c.t.slice(2)].h;
  return c.t === 'b1' ? W.L.hard[1] : W.L.hard[0];
}
function bonk(c, sx, sy) {
  const ore = ORES[c.t], need = TOOLS[ore.t];
  W.R.userData.armR.rotation.x = W.swingBase - .7;
  sfx.thud(); W.chips.burst(new THREE.Vector3(c.x - sx * .45, c.y - sy * .45, .5), 6, 1.5, ['#ffffff', '#aaaaaa']);
  say(`För hårt! Du behöver en ${need.n.toLowerCase()}.`); toast(`${pickIcon(hexs(need.c), 26)} ${ore.n}: behöver ${need.n.toLowerCase()}`, 2400);
  bot.target = null; W.dig = null; W.crack.visible = false;
}
async function openSpecial(c) {
  bot.busy = true; bot.target = null; W.crack.visible = false;
  const kind = c.t === 'chest' ? 'chest' : c.t === 'find' ? 'find' : 'ore', ore = ORES[c.t];
  if (kind === 'chest') { say('En skattkista!'); await ask({ title: 'Skattkista', accent: '#ffc23a' }); if (!W) return; }
  if (kind === 'find') { say('Något gömmer sig i stenen!'); }
  await ask({ title: kind === 'chest' ? 'Skattkista' : kind === 'find' ? 'Fynd' : ore.n, accent: kind === 'chest' ? '#ffc23a' : kind === 'find' ? '#d8c8a8' : ore.c });
  if (!W) return;
  const p = new THREE.Vector3(c.x, c.y, .5), [sxp, syp] = toScreen(p, view.camera, view.host);
  hideCell(c); sfx.dig();
  W.chips.burst(p, 26, 3, kind === 'chest' ? ['#8a4a20', '#ffc23a'] : kind === 'find' ? ['#f2ead8', '#8a8070'] : [ore.px[0], ore.px[1], W.L.base[0]]);
  if (kind === 'chest') {
    const ok = W.L.ores.filter(([o]) => ORES[o].t <= tier()), k = (ok.length ? pick(ok) : W.L.ores[0])[0];
    gain(k, 2, sxp, syp); S.drag.coins += 25; save();
    sfx.gem(); toast(`Skattkista! +2 ${ORES[k].n} och ${coinIcon()} 25 till racingen`, 2600);
  } else if (kind === 'find') {
    const list = W.L.finds, have = S.mine.finds, left = list.filter(([, n]) => !have[n]), f = left.length ? left[0] : pick(list);
    have[f[1]] = (have[f[1]] || 0) + 1; persist(); save();
    sfx.unlock(); say(`Du hittade: ${f[1]}!`);
    toast(`<span style="font-size:34px">${f[0]}</span> Du hittade: ${f[1]}${left.length ? '' : ' (en till)'}`, 3200);
  } else { gain(c.t, 1, sxp, syp); sfx.gem(); }
  bot.busy = false;
}
function gain(k, n, x, y) {
  S.mine.inv[k] = inv(k) + n; S.mine.seen[k] = 1; persist(); save();
  flyTo(x, y, $(`#slot-${k}`) || $('#m-shop .round'), gemIcon(ORES[k].c, '34px'));
  setTimeout(updateHud, 700);
  const nt = nextTool();
  if (nt && canAfford(nt.cost) && !W.told) { W.told = true; setTimeout(() => say(`Du har nog för att bygga en ${nt.n.toLowerCase()} i verkstaden.`), 1200); }
}
function startAnim(type, dur, sx, sy) { bot.anim = { type, t: 0, dur, sx, sy, fx: bot.x, fy: bot.y }; }
function step(dt) {
  const s = chooseStep(); if (!s) { W.dig = null; W.crack.visible = false; return; }
  const [sx, sy] = s, nx = bot.x + sx, ny = bot.y + sy, c = cellAt(nx, ny);
  faceTo(sx, sy);
  const who = mobAt(nx, ny);
  if (who) { bot.target = null; who.animal ? catchAnimal(who) : fight(who); return; }
  if (!c) { W.dig = null; W.crack.visible = false; startAnim('move', sy > 0 ? .2 : .14, sx, sy); return; }
  // a block is in the way: dig only while the finger is held (and never in build mode)
  if (W.mode === 'build') { bot.target = null; return; }
  if (!W.held) { if (!W.dig || W.dig.c !== c) { bot.target = null; W.crack.visible = false; if (S.mine.holds < 6) showHint('Håll inne för att gräva'); } return; }
  if (ORES[c.t] && ORES[c.t].t > tier()) { bonk(c, sx, sy); return; }
  if (!W.dig || W.dig.c !== c) W.dig = { c, p: 0 };
  const d = W.dig; d.p += dt * TOOLS[tier()].speed / hardness(c);
  W.R.userData.armR.rotation.x = W.swingBase + Math.sin(performance.now() / 1000 * 20) * .75;
  W.crack.visible = true; W.crack.position.set(c.x, c.y, .502); W.crack.material.map = W.cracks[Math.min(3, Math.floor(d.p * 4))];
  W.outline.position.set(c.x, c.y, 0); W.outline.visible = true;
  if (Math.random() < .25) W.chips.burst(new THREE.Vector3(c.x - sx * .5, c.y - sy * .5, .45), 1, 1.6, [W.L.base[0], W.L.base[2]]);
  if (Math.random() < .1) sfx.chip();
  if (d.p >= 1) {
    W.dig = null; W.crack.visible = false; S.mine.holds++;
    if (isSpecial(c.t)) { openSpecial(c); return; }
    const bt = bagOf(c.t, W.L.surface);
    hideCell(c); W.chips.burst(new THREE.Vector3(c.x, c.y, .45), 8, 2.2, c.t === 'leaf' || c.t === 'p_lov' ? BLOCKS.lov.pal : c.t === 'log' || c.t === 'p_tra' ? BLOCKS.tra.pal : [W.L.base[0], W.L.base[1], W.L.base[3]]); sfx.dig();
    if (bt) { S.mine.bag[bt] = Math.min(99, (S.mine.bag[bt] || 0) + 1); drawHotbar(); }
    startAnim('move', .14, sx, sy);
  }
}
let saveTick = 0;
function loop(dt, t) {
  if (!view || !W) return;
  const R = W.R, u = R.userData, arm = u.armR;
  if (!bot.busy) {
    if (bot.anim) {
      const a = bot.anim; a.t += dt; const k = clamp01(a.t / a.dur);
      const x = lerp(a.fx, a.fx + a.sx, ease(k)), y = lerp(a.fy, a.fy + a.sy, a.type === 'fall' ? k * k : ease(k));
      R.position.set(x, y - .5, 0);
      u.flames.forEach(f => f.visible = a.sy > 0);
      if (k >= 1) { bot.x = a.fx + a.sx; bot.y = a.fy + a.sy; bot.anim = null; if (a.type === 'fall' && solid(bot.x, bot.y - 1)) sfx.thud(); updateHud(); if (++saveTick % 6 === 0) { persist(); save(); } }
    } else if (bot.target) step(dt);
    else if (inside(bot.x, bot.y - 1) && !solid(bot.x, bot.y - 1)) { startAnim('fall', .1, 0, -1); u.flames.forEach(f => f.visible = false); }
    else { u.flames.forEach(f => f.visible = false); arm.rotation.x = lerp(arm.rotation.x, -.25, dt * 3); R.rotation.y = lerp(R.rotation.y, .5, dt * 2); }
  }
  if (!W.held && !W.dig && W.outline.visible && performance.now() - W.pressT > 900) W.outline.visible = false;
  idleRobot(R, t, 0, .6);
  W.lamp.position.set(R.position.x, R.position.y + 1, 1.4);
  if (W.L.surface) W.hemi.intensity = lerp(1.0, .3, clamp01(Math.max(0, 1 - bot.y) / 6));
  W.camY = lerp(W.camY, Math.min(W.L.surface ? 5 : 1.8, R.position.y + (W.L.surface && bot.y >= 0 ? 1.7 : .9)), Math.min(1, dt * 3));
  W.camX = lerp(W.camX, Math.max(-2.5, Math.min(2.5, R.position.x * .55)), Math.min(1, dt * 3));
  view.camera.position.set(W.camX, W.camY + .4, 10.5); view.camera.lookAt(W.camX, W.camY, 0);
  for (const [k] of W.L.ores) W.mats[k].emissiveIntensity = ORES[k].e * (.8 + Math.sin(t * 2) * .2);
  if (Math.random() < .03 && !CALM) { const cs = [...W.grid.values()].filter(c => isSpecial(c.t) && Math.abs(c.y - bot.y) < 6); if (cs.length) { const c = pick(cs); W.glints.burst(new THREE.Vector3(c.x + (Math.random() - .5) * .8, c.y + (Math.random() - .5) * .8, .52), 1, .2, ['#ffffff']); } }
  W.chips.update(dt); W.glints.update(dt); W.motes.update(dt);
  W.motes.points.position.y = R.position.y;
  lifeTick(dt, t);
  view.render();
}

/* ================= life: day and night, animals, monsters ================= */
const DAY = 200, NIGHT = 75; // seconds
const mobAt = (x, y) => W && W.mobs.find(m => !m.gone && m.x === x && m.y === y);
function ground(x, maxY) { for (let y = maxY; y > BOT + 1; y--) if (!solid(x, y) && solid(x, y - 1)) return y; return null; }
function addCreature(kind, x, y) {
  const animal = !!ANIMALS[kind], g = makeCreature(kind);
  g.scale.setScalar(.95); g.position.set(x, y - .5, 0); W.sc.add(g);
  const m = { kind, animal, def: animal ? ANIMALS[kind] : MOBS[kind], x, y, hp: animal ? 1 : MOBS[kind].hp, g, t: Math.random() * 2, dir: Math.random() < .5 ? 1 : -1, fx: x, fy: y, k: 1 };
  g.rotation.y = m.dir > 0 ? 0 : Math.PI; W.mobs.push(m); return m;
}
function removeCreature(m, poof = true) {
  m.gone = true; W.sc.remove(m.g);
  if (poof) W.chips.burst(new THREE.Vector3(m.x, m.y, .5), 18, 2, ['#ffffff', '#dfe3ea', '#b8bec8']);
  W.mobs = W.mobs.filter(x => x !== m);
}
function moveCreature(m, nx, ny) { m.fx = m.x; m.fy = m.y; m.x = nx; m.y = ny; m.k = 0; if (nx !== m.fx) { m.dir = Math.sign(nx - m.fx); m.g.rotation.y = m.dir > 0 ? 0 : Math.PI; } }
function creatureStep(m) {
  if (!solid(m.x, m.y - 1) && m.y - 1 > BOT && !mobAt(m.x, m.y - 1) && !(bot.x === m.x && bot.y === m.y - 1)) { moveCreature(m, m.x, m.y - 1); return; }
  const near = !m.animal && Math.abs(bot.x - m.x) + Math.abs(bot.y - m.y) <= 9;
  const sx = near ? Math.sign(bot.x - m.x) || 0 : (Math.random() < .3 ? -m.dir : m.dir);
  if (!sx) return;
  const nx = m.x + sx, free = (x, y) => inside(x, y) && !solid(x, y) && !mobAt(x, y) && !(bot.x === x && bot.y === y);
  if (m.animal && (W.L.surface && (Math.abs(nx) === 5 || nx < X0 || nx > X1))) { m.dir = -m.dir; return; }
  if (free(nx, m.y)) moveCreature(m, nx, m.y);
  else if (free(m.x, m.y + 1) && free(nx, m.y + 1) && solid(nx, m.y)) moveCreature(m, nx, m.y + 1); // climb one block
  else m.dir = -m.dir;
}
function lifeTick(dt, t) {
  const busy = bot.busy || isAsking() || $('#panel').classList.contains('on');
  // day and night only above ground
  if (W.L.surface) {
    if (!busy) W.clock += dt;
    const c = W.clock % (DAY + NIGHT), target = c > DAY ? 1 : 0;
    W.night = lerp(W.night || 0, target, Math.min(1, dt * .4));
    const n = W.night, deep = clamp01(Math.max(0, 1 - bot.y) / 6);
    W.sc.background = n > .5 ? W.nightBg : W.dayBg;
    W.sc.fog.color.lerpColors(W.dayFog, W.nightBg, n);
    W.hemi.intensity = lerp(1.0, .3, deep) * (1 - .72 * n); W.front.intensity = 1.6 * (1 - .8 * n);
    W.sun.visible = n < .5; W.moon.visible = n >= .5; W.stars.points.material.opacity = n;
    const isNight = target === 1;
    if (isNight !== W.wasNight) {
      W.wasNight = isNight; drawStatus();
      if (isNight) { say('Natten kommer! Bygg ett hus eller gå ner i gruvan.'); toast('Natten kommer. Monster kan komma fram!', 2800); }
      else { say('Det blir morgon!'); W.mobs.filter(m => !m.animal && m.y >= 0).forEach(m => removeCreature(m)); }
    }
  }
  if (busy) { W.mobs.forEach(m => animCreature(m, 0, t)); return; }
  // spawning
  W.spawnT -= dt;
  if (W.spawnT <= 0) {
    W.spawnT = 6 + Math.random() * 6;
    const animals = W.mobs.filter(m => m.animal).length, monsters = W.mobs.filter(m => !m.animal).length;
    if (W.L.surface && !W.wasNight && animals < 3 && Math.random() < (animals < 2 ? 1 : .5)) {
      const xs = []; for (let x = X0 + 1; x < X1; x++) { if (Math.abs(x) === 5 || Math.abs(x - bot.x) <= 1) continue; const y = ground(x, 2); if (y != null && y >= 1 && !mobAt(x, y)) xs.push([x, y]); }
      if (xs.length) { const [x, y] = pick(xs); addCreature(pick(['ko', 'gris', 'hona']), x, y); }
    }
    const surfaceNight = W.L.surface && W.wasNight && bot.y >= -1;
    const caveChance = W.L.surface ? (bot.y < -3 ? .08 : 0) : .12 + .03 * W.li;
    if (surfaceNight && monsters < 3 && Math.random() < .7) {
      const x = pick([X0, X1, X0 + 1, X1 - 1]), y = ground(x, 2);
      if (y != null && Math.abs(x - bot.x) > 3 && !mobAt(x, y)) addCreature(pick(['zombie', 'zombie', 'skelett', 'slem']), x, y);
    } else if (!surfaceNight && monsters < (W.li >= 3 ? 2 : 1) && Math.random() < caveChance) {
      const spots = [];
      for (let x = X0; x <= X1; x++) for (let y = bot.y - 6; y <= bot.y + 4; y++) { const d = Math.abs(x - bot.x) + Math.abs(y - bot.y); if (d >= 4 && d <= 9 && inside(x, y) && y < 0 && !solid(x, y) && solid(x, y - 1) && !mobAt(x, y)) spots.push([x, y]); }
      if (spots.length) { const [x, y] = pick(spots); const kinds = [['zombie', 'skelett'], ['zombie', 'skelett', 'slem'], ['skelett', 'slem'], ['slem', 'spokbot'], ['spokbot', 'spokbot', 'slem']][W.li]; addCreature(pick(kinds), x, y); }
    }
  }
  // moving, and monsters that reach the robot start a fight
  for (const m of [...W.mobs]) {
    m.t -= dt;
    if (m.t <= 0 && m.k >= 1) { m.t = m.animal ? 1.6 + Math.random() * 2 : .75; creatureStep(m); }
    animCreature(m, dt, t);
    if (!m.animal && m.k >= 1 && Math.abs(bot.x - m.x) + Math.abs(bot.y - m.y) <= 1 && !bot.anim) { fight(m); break; }
  }
  // hearts slowly come back
  if (S.mine.hp < MAXHP) { W.regenT += dt; if (W.regenT > 60) { W.regenT = 0; S.mine.hp++; save(); drawStatus(); } }
}
function animCreature(m, dt, t) {
  m.k = Math.min(1, m.k + dt / .35);
  const e = ease(m.k), x = lerp(m.fx, m.x, e), y = lerp(m.fy, m.y, m.fy > m.y ? m.k * m.k : e);
  m.g.position.set(x, y - .5 + (m.k < 1 ? Math.sin(m.k * Math.PI) * .08 : 0), 0);
  if (m.g.userData.bob) m.g.userData.bob.position.y = (m.kind === 'slem' ? .26 : 0) + Math.sin(t * 3 + m.x) * .04;
}
async function catchAnimal(m) {
  bot.busy = true; faceTo(Math.sign(m.x - bot.x), 0); say(m.def.say);
  await ask({ title: `Fånga: ${m.def.n}`, accent: '#7ac74f' });
  if (!W) return;
  removeCreature(m); sfx.gem();
  S.mine.food = Math.min(20, (S.mine.food || 0) + m.def.food);
  if (m.def.lader) S.mine.inv.lader = inv('lader') + m.def.lader;
  toast(`${FOODICON} +${m.def.food} mat${m.def.lader ? ' och <i class="leath"></i> +1 läder' : ''}`, 2000);
  save(); drawStatus(); bot.busy = false;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function fight(m) {
  if (bot.busy) return;
  bot.busy = true; bot.target = null; W.dig = null; W.crack.visible = false;
  faceTo(Math.sign(m.x - bot.x) || 1, 0); sfx.thud(); say(m.def.say);
  while (W && m.hp > 0 && S.mine.hp > 0) {
    const res = await ask({ title: `Strid: ${m.def.n}`, accent: '#e8473a' });
    if (!W) return;
    if (res.wrongs) { // a wrong answer lets the monster hit once; armor may stop it
      if (Math.random() < ARMOR[S.mine.armor].block) { sfx.tap(); toast(`${armorIcon(hexs(ARMOR[S.mine.armor].c), 26)} Rustningen skyddade dig!`, 1500); }
      else { S.mine.hp = Math.max(0, S.mine.hp - 1); hurt(); }
      drawStatus(); save();
      if (S.mine.hp <= 0) break;
    }
    const arm = W.R.userData.armL; arm.rotation.x = -2.2; setTimeout(() => { if (W) arm.rotation.x = -.3; }, 220);
    m.hp -= SWORDS[S.mine.sword].dmg; sfx.dig(); W.chips.burst(new THREE.Vector3(m.x, m.y, .5), 10, 2, ['#ffffff', '#ff8080']);
    m.g.position.x += Math.sign(m.x - bot.x) * .15;
    await wait(400);
  }
  if (!W) return;
  if (S.mine.hp <= 0) { faint(); return; }
  removeCreature(m); sfx.win(); say('Du vann striden!'); bot.busy = false; save();
}
function hurt() {
  sfx.thud(); say('Aj!');
  const bm = W.R.userData.m.bodyM; bm.emissive.set(0xff2020); bm.emissiveIntensity = .8; setTimeout(() => { if (W) bm.emissive.set(0x000000); }, 300);
  const h = $('#m-hearts'); if (h) { h.classList.remove('hit'); void h.offsetWidth; h.classList.add('hit'); }
}
function faint() {
  const lost = Object.values(S.mine.inv).reduce((a, b) => a + (b || 0), 0);
  S.mine.inv = {}; S.mine.hp = MAXHP;
  W.mobs.filter(m => !m.animal).forEach(m => removeCreature(m));
  bot.anim = null; bot.target = null; bot.x = 0; bot.y = 1; W.R.position.set(0, .5, 0);
  persist(); save(); updateHud(); drawStatus();
  say('Robo svimmade! Du tappade dina stenar.');
  toast(lost ? `Robo svimmade och tappade ${lost} stenar. Försök igen!` : 'Robo svimmade. Försök igen!', 3400);
  bot.busy = false;
}
function gearRobot() {
  const u = W.R.userData, hand = u.armL.userData.hand;
  if (u.sword) hand.remove(u.sword);
  const sw = new THREE.Group(), sc = SWORDS[S.mine.sword].c;
  sw.add(mesh(new THREE.BoxGeometry(.1, .9, .05), M(sc, { metalness: .8, roughness: .25, emissive: sc, emissiveIntensity: .15 }), 0, -.55, .1));
  sw.add(mesh(new THREE.BoxGeometry(.34, .07, .1), M(0x5a3a1c), 0, -.08, .1));
  hand.add(sw); u.sword = sw;
  if (u.plate) W.R.remove(u.plate);
  if (S.mine.armor > 0) { const a = ARMOR[S.mine.armor]; u.plate = mesh(RB(1.08, .7, .2, .08), M(a.c, { metalness: .7, roughness: .3 }), 0, 1.4, .46, W.R); }
}

/* ================= workshop ================= */
const costChips = cost => Object.entries(cost).map(([k, n]) => `<span class="cost${have(k) >= n ? ' ok' : ''}">${itemIcon(k)}<b>${Math.min(have(k), n)}/${n}</b></span>`).join('');
function showShop(tab) {
  sfx.tap(); if (tab) shopTab = tab;
  const T = tier(), seen = Object.keys(ORES).filter(k => S.mine.seen[k]);
  const tabs = [['tools', 'Hackor'], ['sword', 'Svärd'], ['armor', 'Rustning'], ['lamp', 'Lampa'], ['paint', 'Färger'], ['finds', 'Samling']];
  const gearShelf = (list, cur, kind, icon, note) => `<div class="shelf">${list.map((it, i) => {
    const st = i < cur ? 'done' : i === cur ? 'mine' : i === cur + 1 ? 'next' : 'later';
    return `<div class="item ${st}" style="--ic:${hexs(it.c)}">${st === 'mine' ? `<span class="badge">${kind === 'sword' ? 'Ditt svärd' : 'Din rustning'}</span>` : ''}
      <div class="item-art">${icon(st === 'later' ? '#3a3f55' : hexs(it.c), 60)}</div><b>${st === 'later' ? '???' : it.n}</b>
      <div class="mines"><span>${note(it)}</span></div>
      ${st === 'next' ? `<div class="costs">${costChips(it.cost)}</div><button class="pill strong${canAfford(it.cost) ? '' : ' dim'}" data-buy="${kind}" data-i="${i}">Bygg</button>` : st === 'later' ? `<div class="item-note">${ICON.lock}</div>` : `<div class="item-note ok">${ICON.check}</div>`}</div>`; }).join('')}</div>`;
  let content = '';
  if (shopTab === 'tools') content = `<div class="shelf">${TOOLS.map((tl, i) => {
    const st = i < T ? 'done' : i === T ? 'mine' : i === T + 1 ? 'next' : 'later';
    const newOres = Object.keys(ORES).filter(k => ORES[k].t === i);
    return `<div class="item ${st}" style="--ic:${hexs(tl.c)}">
      ${st === 'mine' ? '<span class="badge">Din hacka</span>' : ''}
      <div class="item-art">${pickIcon(st === 'later' ? '#3a3f55' : hexs(tl.c), 64)}</div>
      <b>${st === 'later' ? '???' : tl.n}</b>
      <div class="mines"><span>Bryter</span>${(st === 'later' ? newOres.map(() => '<i class="gemi" style="--g:#444"></i>') : newOres.map(k => gemIcon(ORES[k].c))).join('')}</div>
      ${st === 'next' ? `<div class="costs">${costChips(tl.cost)}</div><button class="pill strong${canAfford(tl.cost) ? '' : ' dim'}" data-buy="tool" data-i="${i}">Bygg</button>` : st === 'later' ? `<div class="item-note">${ICON.lock}</div>` : `<div class="item-note ok">${ICON.check}</div>`}
    </div>`; }).join('')}</div>
    <p class="shop-tip">Bättre hackor gräver snabbare, kan bryta hårdare stenar och öppnar nya grottor i hissen.</p>`;
  if (shopTab === 'sword') content = gearShelf(SWORDS, S.mine.sword || 0, 'sword', swordIcon, it => `${it.dmg} ${it.dmg === 1 ? 'slag' : 'slag'} per rätt svar`) + '<p class="shop-tip">Ett bättre svärd gör striderna kortare.</p>';
  if (shopTab === 'armor') content = gearShelf(ARMOR, S.mine.armor || 0, 'armor', armorIcon, it => it.block ? `Skyddar ofta` : 'Inget skydd') + '<p class="shop-tip">Rustning kan stoppa monstrens slag. Läder får du från kor.</p>';
  if (shopTab === 'lamp') { const ml = S.mine.lamp || 0; content = `<div class="shelf">${LAMPS.map((lp, i) => {
    const st = i < ml ? 'done' : i === ml ? 'mine' : i === ml + 1 ? 'next' : 'later';
    return `<div class="item ${st}" style="--ic:#ffe08a">
      ${st === 'mine' ? '<span class="badge">Din lampa</span>' : ''}
      <div class="item-art"><span class="bulb" style="--g:${.35 + i * .3}"></span></div><b>${lp.n}</b>
      <div class="mines"><span>Lyser ${['lite', 'mer', 'mest'][i]}</span></div>
      ${st === 'next' ? `<div class="costs">${costChips(lp.cost)}</div><button class="pill strong${canAfford(lp.cost) ? '' : ' dim'}" data-buy="lamp" data-i="${i}">Bygg</button>` : st === 'later' ? `<div class="item-note">${ICON.lock}</div>` : `<div class="item-note ok">${ICON.check}</div>`}
    </div>`; }).join('')}</div>`; }
  if (shopTab === 'paint') content = `<div class="paints">${PAINTS.map((p, i) => { const own = S.mine.paints.includes(i); return `<button class="paint${S.mine.paint === i ? ' on' : ''}${own ? '' : ' locked'}" data-p="${i}" style="--pc:${hexs(p.c)}" aria-label="${p.n}"><i></i>${own ? '' : `<span class="pcost">${Object.entries(p.cost).map(([k, n]) => `${gemIcon(ORES[k].c)}${n}`).join('')}</span>`}</button>`; }).join('')}</div>`;
  if (shopTab === 'finds') { const all = LAYERS.flatMap((L, li) => L.finds.map(f => [f, li])); const got = all.filter(([f]) => S.mine.finds[f[1]]).length;
    content = `<p class="shop-tip">Du har hittat ${got} av ${all.length}. Fynden gömmer sig i stenar med vita mönster.</p><div class="finds">${all.map(([f, li]) => S.mine.finds[f[1]] ? `<div class="find got"><span>${f[0]}</span><b>${f[1]}</b></div>` : `<div class="find"><span>?</span><b>${LAYERS[li].n}</b></div>`).join('')}</div>`; }
  const body = openPanel('Verkstaden', `
    <div class="stones">${seen.length ? seen.map(k => `<span class="stone">${gemIcon(ORES[k].c, '22px')}<b>${inv(k)}</b><em>${ORES[k].n}</em></span>`).join('') : '<span class="stone unknown">Inga stenar än. Gräv!</span>'}</div>
    <div class="tabs">${tabs.map(([id, n]) => `<button class="tab${shopTab === id ? ' on' : ''}" data-tab="${id}" data-tts="${n}">${n}</button>`).join('')}</div>
    ${content}`, '#e27b3c');
  body.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => showShop(b.dataset.tab));
  body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
    const i = +b.dataset.i, kind = b.dataset.buy, isTool = kind === 'tool', item = isTool ? TOOLS[i] : kind === 'sword' ? SWORDS[i] : kind === 'armor' ? ARMOR[i] : LAMPS[i];
    if (kind === 'sword' || kind === 'armor') {
      if (!canAfford(item.cost)) { sfx.wrong(); say('Du behöver fler stenar.'); return; }
      pay(item.cost); sfx.unlock(); S.mine[kind] = i; gearRobot(); say(`${item.n}!`); toast(`${(kind === 'sword' ? swordIcon : armorIcon)(hexs(item.c), 26)} ${item.n}!`, 2200);
      persist(); save(); updateHud(); showShop(); return;
    }
    if (!canAfford(item.cost)) { sfx.wrong(); say('Du behöver fler stenar.'); return; }
    pay(item.cost); sfx.unlock();
    if (isTool) {
      S.mine.drill = i; W.R.userData.m.pickM.color.set(item.c); W.R.userData.m.pickM.emissive.set(item.c);
      say(`Ny hacka! Nu kan du åka hissen till ${LAYERS[i].n}.`); toast(`${pickIcon(hexs(item.c), 26)} ${item.n}! Hissen går nu till ${LAYERS[i].n}`, 2800); W.told = false;
    } else { S.mine.lamp = i; W.lamp.distance = item.d; W.lamp.intensity = item.i; say(`${item.n}!`); }
    persist(); save(); updateHud(); showShop();
  });
  body.querySelectorAll('.paint').forEach(b => b.onclick = () => {
    const i = +b.dataset.p, p = PAINTS[i];
    if (!S.mine.paints.includes(i)) { if (!canAfford(p.cost)) { sfx.wrong(); say('Du behöver fler stenar.'); return; } pay(p.cost); S.mine.paints.push(i); sfx.unlock(); }
    S.mine.paint = i; save(); W.R.userData.m.bodyM.color.set(p.c); sfx.tap(); updateHud(); showShop();
  });
}
function showLift() {
  sfx.tap();
  const body = openPanel('Hissen', `
    <div class="lift-actions">${bot.y < 1 ? `<button class="pill" id="lift-up">${ICON.lift}<span>Åk upp till toppen</span></button>` : ''}<button class="pill" id="lift-new">${ICON.again}<span>Ny gruva här</span></button></div>
    <div class="layers">${LAYERS.map((L, i) => { const open = i <= tier(); return `<button class="layer${i === W.li ? ' on' : ''}${open ? '' : ' locked'}" data-l="${i}" style="--lc:${L.surface ? '#5cbf3a' : L.base[0]}"><b>${i + 1}. ${open ? L.n : '???'}</b><span>${open ? L.ores.map(([k]) => gemIcon(ORES[k].c)).join('') : `${pickIcon(hexs(TOOLS[i].c), 18)} Behöver ${TOOLS[i].n.toLowerCase()}`}</span></button>`; }).join('')}</div>`, '#5fa8ff');
  const up = body.querySelector('#lift-up');
  if (up) up.onclick = () => { closePanel(); bot.anim = null; bot.target = null; bot.x = 0; bot.y = 1; W.R.position.set(0, .5, 0); sfx.whoosh(); persist(); save(); updateHud(); };
  body.querySelector('#lift-new').onclick = () => { closePanel(); sfx.whoosh(); buildWorld(W.li, true); };
  body.querySelectorAll('.layer').forEach(b => b.onclick = () => {
    const i = +b.dataset.l;
    if (i > tier()) { sfx.wrong(); say(`Du behöver en ${TOOLS[i].n.toLowerCase()} först.`); return; }
    persist(); S.mine.layer = i; save(); closePanel(); sfx.whoosh(); buildWorld(i);
  });
}

/* ================= home-screen picture ================= */
export function previewScene(v) {
  const li = Math.min(tier(), LAYERS.length - 1), L = LAYERS[li], sc = new THREE.Scene(), r = rng(99 + li);
  sc.background = L.surface ? skyTex([[0, '#4aa8f0'], [.6, '#a8dcff'], [1, '#e8f6ff']]) : new THREE.Color(L.bg);
  sc.add(new THREE.HemisphereLight(...L.amb));
  const front = new THREE.DirectionalLight(0xffffff, L.surface ? 1.2 : .3); front.position.set(-4, 8, 10); sc.add(front);
  const mats = { b0: M(0xffffff, { map: pix(L.base, r), roughness: .95 }), b1: M(0xffffff, { map: pix(L.alt, r), roughness: .95 }) };
  L.ores.forEach(([k]) => mats[k] = oreTex(L.base, ORES[k], r));
  if (L.surface) { const side = pix(L.base, r, g => { for (let x = 0; x < 16; x++) for (let y = 0; y < 3 + (x % 3 === 0 ? 1 : 0); y++) { g.fillStyle = ['#5cbf3a', '#4fae31', '#69cc45'][(x + y) % 3]; g.fillRect(x, y, 1, 1); } }); mats.grass = M(0xffffff, { map: side, roughness: 1 }); }
  const tunnel = new Set(['-4,0', '-3,0', '-2,0', '-1,0', '-3,-1', '-3,-2', '-4,-2']);
  const o0 = L.ores[0][0], o1 = (L.ores[1] || L.ores[0])[0];
  const ores = { '0,0': o0, '2,-1': o1, '-5,-2': o0, '3,1': o1, '1,-3': o0, '-1,-3': o1 };
  const box = new THREE.BoxGeometry(1, 1, 1);
  for (let x = -7; x <= 7; x++) for (let y = -4; y <= (L.surface ? 1 : 3); y++) {
    const k = x + ',' + y; if (tunnel.has(k)) continue;
    const t = ores[k] || (L.surface && y === 1 ? 'grass' : (Math.sin(x * .7 + y * .5) + Math.sin(y * .4 - x * .3) > .8 ? 'b1' : 'b0'));
    mesh(box, mats[t], x, y, 0, sc);
  }
  const bt = pix(L.base.map(c => shade(c, -.45)), r); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(16, 8);
  const bh = L.surface ? 6 : 8; mesh(new THREE.PlaneGeometry(16, bh), M(0xffffff, { map: bt, roughness: 1 }), 0, L.surface ? -2.5 : -1, -.5, sc);
  if (L.surface) { mesh(new THREE.CircleGeometry(1.4, 32), new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }), 4.5, 4.2, -6, sc); const hm = M(0x5fbf3c, { roughness: 1, flatShading: true }); for (let i = 0; i < 4; i++) { const h = mesh(new THREE.SphereGeometry(4 + i, 16, 8), hm, -9 + i * 6, -.8, -8, sc); h.scale.y = .5; } }
  if (L.crystals) for (let i = 0; i < 6; i++) { const c = mesh(new THREE.OctahedronGeometry(.18, 0), E(pick([0x6ff7ff, 0xa58bff]), 2.4), -4.4 + i * .3, -.3 + (i % 2) * .4, -.45, sc); c.scale.y = 1.8; }
  if (L.lava) mesh(new THREE.PlaneGeometry(1.6, .25), E(0xff5a1a, 2.6), -2.8, -.4, -.46, sc);
  if (L.torches) { mesh(new THREE.BoxGeometry(.08, .3, .02), M(0x6b4426), -3, -.1, -.46, sc); mesh(new THREE.BoxGeometry(.12, .12, .02), E(0xffb347, 4), -3, .08, -.46, sc); }
  const R = makeRobot({ body: PAINTS[S.mine.paint]?.c ?? 0x22c55e, accent: 0xffa323, pick: true, drillColor: TOOLS[tier()].c });
  R.scale.setScalar(.32); R.position.set(-1.05, -.5, 0); R.rotation.y = Math.PI / 2 - .35; R.userData.armR.rotation.x = -2.0; sc.add(R);
  const lamp = new THREE.PointLight(0xfff0d0, 14, 6, 1.4); lamp.position.set(-1, .6, 1.4); sc.add(lamp);
  const ore = ORES[o0];
  for (let i = 0; i < 14; i++) { const ch = mesh(new THREE.BoxGeometry(.07, .07, .07), M(i % 2 ? ore.px[0] : L.base[0], { emissive: i % 2 ? ore.px[0] : 0x000000, emissiveIntensity: .8 }), -.4 + Math.random() * .5, -.3 + Math.random() * .7, .3 + Math.random() * .3, sc); ch.rotation.set(Math.random() * 3, Math.random() * 3, 0); }
  return { scene: sc, camera(c) { c.fov = 40; c.position.set(-.4, .2, 8.6); c.lookAt(-.8, -.5, 0); c.updateProjectionMatrix(); } };
}

export const _debug = () => ({ W, bot });
