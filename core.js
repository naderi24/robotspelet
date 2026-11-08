// Shared engine for Robotspelet: save data, daily battery, questions, sound, speech and 3D helpers.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
export { THREE };

export const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const $ = s => document.querySelector(s);
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const clamp01 = t => Math.max(0, Math.min(1, t));
export const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ================= icons ================= */
export const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 8-8z" transform="translate(-2 -2)"/><path d="M15 4a5 5 0 0 0-6.5 6.5L3 16l5 5 5.5-5.5A5 5 0 0 0 20 9l-3 3-3-1-1-3z"/></svg>',
  lift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 9l3-3 3 3M9 15l3 3 3-3"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="3" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2.6" fill="none"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>',
  again: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/></svg>',
  paint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15l9-9 5 5-9 9H4z"/><path d="M14 5l2-2 5 5-2 2"/></svg>',
};
export const gemIcon = (c, size) => `<i class="gemi" style="--g:${c}${size ? `;--s:${size}` : ''}"></i>`;
export const coinIcon = size => `<i class="coini"${size ? ` style="--s:${size}"` : ''}></i>`;

/* ================= save data ================= */
const KEY = 'robotspelet-save-v1';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function fresh() {
  return {
    v: 1, updatedAt: 0,
    settings: { minutes: 15, math: true, read: true },
    learn: {},
    day: { date: today(), used: 0, bonus: 0 },
    mine: { inv: {}, seen: {}, drill: 0, layer: 0, paint: 0, paints: [0], tut: false },
    drag: { coins: 0, cars: ['golf'], car: 'golf', paint: {}, beaten: [], track: 0, tut: false },
  };
}
function merge(base, obj) {
  for (const k in obj) {
    const a = base[k], b = obj[k];
    if (b && typeof b === 'object' && !Array.isArray(b) && a && typeof a === 'object' && !Array.isArray(a)) merge(a, b);
    else base[k] = b;
  }
  return base;
}
function loadLocal() { const s = fresh(); try { const raw = localStorage.getItem(KEY); if (raw) merge(s, JSON.parse(raw)); } catch {} return s; }
export let S = loadLocal();
function writeLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }

let cloud = null, writing = false, pending = false, cloudTimer = 0;
export function save() {
  S.updatedAt = Date.now(); writeLocal();
  if (cloud) { clearTimeout(cloudTimer); cloudTimer = setTimeout(pushCloud, 1500); }
}
async function pushCloud() {
  if (!cloud) return;
  if (writing) { pending = true; return; }
  writing = true;
  try { await cloud.set(JSON.parse(JSON.stringify(S))); } catch {}
  writing = false;
  if (pending) { pending = false; pushCloud(); }
}
// How far a save has come; used to pick the better of the device save and the account save.
function progress(s) {
  try {
    const m = s.mine || {}, d = s.drag || {}, L = s.learn || {};
    const inv = Object.values(m.inv || {}).reduce((a, b) => a + (+b || 0), 0);
    return (m.drill || 0) * 1000 + inv * 10 + (d.beaten || []).length * 800 + (d.cars || []).length * 800 + (d.coins || 0) + ((L.math && L.math.n) || 0) + ((L.read && L.read.n) || 0);
  } catch { return 0; }
}
let cloudDone = null;
export const cloudReady = () => cloudDone || Promise.resolve();
export function initCloud(onLoaded) {
  cloudDone = (async () => {
    try {
      if (!window.claude || typeof window.claude.use !== 'function') return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const id = await user.id(); if (!id) return;
      const ref = db.doc(`data/users/${id}/save`);
      const snap = await Promise.race([ref.get(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))]);
      cloud = ref;
      if (!snap.exists) { pushCloud(); return; }
      const remote = snap.data() || {};
      const takeRemote = (remote.resetAt || 0) > (S.resetAt || 0) || ((remote.resetAt || 0) === (S.resetAt || 0) && progress(remote) > progress(S));
      if (takeRemote) {
        const day = S.day; S = merge(fresh(), remote);
        if (day && S.day && day.date === S.day.date) S.day.used = Math.max(S.day.used || 0, day.used || 0);
        writeLocal(); onLoaded && onLoaded();
      } else pushCloud();
    } catch {}
  })();
  return cloudDone;
}
export function resetProgress() { const st = S.settings, day = S.day; S = fresh(); S.settings = st; S.day = day; S.resetAt = Date.now(); save(); }

/* ================= daily battery ================= */
function ensureDay() { if (S.day.date !== today()) S.day = { date: today(), used: 0, bonus: 0 }; }
export const timer = {
  active: false, warned: false, onEnd: null, onWarn: null,
  total() { return S.settings.minutes * 60 + S.day.bonus; },
  left() { ensureDay(); return Math.max(0, this.total() - S.day.used); },
  start() { this.active = true; this.warned = this.left() <= 60; },
  stop() { this.active = false; save(); },
};
export function updateBatteries() {
  const l = timer.left(), tot = timer.total() || 1;
  document.querySelectorAll('[data-batt]').forEach(el => {
    const i = el.querySelector('i'), t = el.querySelector('span');
    if (i) { i.style.width = Math.max(5, l / tot * 100) + '%'; i.style.background = l < 120 ? '#ff5a3d' : l < 300 ? '#ffc83d' : '#7ee35b'; }
    if (t) t.textContent = l >= 60 ? `${Math.ceil(l / 60)} min` : `${l} s`;
  });
}
setInterval(() => {
  if (!timer.active || document.hidden) return;
  ensureDay(); S.day.used++; writeLocal();
  const l = timer.left(); updateBatteries();
  if (l <= 60 && !timer.warned) { timer.warned = true; timer.onWarn && timer.onWarn(); }
  if (l <= 0) { timer.active = false; save(); timer.onEnd && timer.onEnd(); }
}, 1000);

/* ================= sound ================= */
let ac = null, master = null, noiseBuf = null;
export function audioInit() {
  if (ac) { if (ac.state !== 'running') { try { ac.resume().catch(() => {}); } catch {} } return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = .4; master.connect(ac.destination); loadVoice(); } catch {}
}
function envl(g, t, a, d, peak) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
function tone(freq, dur = .15, type = 'sine', vol = .3, when = 0, slide = 0) {
  if (!ac) return; const t = ac.currentTime + when;
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  envl(g, t, .01, dur, vol); o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
}
function noise(dur = .1, vol = .2, freq = 1200, q = 1, when = 0) {
  if (!ac) return;
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = ac.currentTime + when, s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); envl(g, t, .005, dur, vol); s.connect(f).connect(g).connect(master); s.start(t, Math.random() * .4); s.stop(t + dur + .05);
}
export const sfx = {
  tap() { tone(660, .07, 'triangle', .12); },
  chip() { noise(.06, .22, 800 + Math.random() * 900, 2); },
  dig() { noise(.18, .3, 420, .9); tone(150, .14, 'square', .05, 0, .6); },
  gem() { [0, 4, 7, 12].forEach((n, i) => tone(880 * 2 ** (n / 12), .2, 'triangle', .16, i * .06)); },
  coin() { tone(1320, .07, 'square', .07); tone(1760, .2, 'square', .07, .07); },
  right() { [0, 4, 7].forEach((n, i) => tone(523 * 2 ** (n / 12), .16, 'triangle', .2, i * .08)); },
  wrong() { tone(260, .2, 'sine', .18, 0, .7); },
  win() { [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(392 * 2 ** (n / 12), .24, 'triangle', .16, i * .09)); },
  whoosh() { noise(.7, .45, 650, .5); },
  jet() { noise(.1, .08, 380, .8); },
  beep(hi) { tone(hi ? 880 : 440, hi ? .5 : .18, 'square', .1); },
  unlock() { [0, 7, 12, 19, 24].forEach((n, i) => tone(330 * 2 ** (n / 12), .32, 'sine', .2, i * .12)); },
  thud() { tone(90, .18, 'sine', .25, 0, .5); },
};
export function engineSound() {
  if (!ac) return { set() {}, stop() {} };
  const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
  o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
  o1.connect(f); o2.connect(f); f.connect(g).connect(master); o1.start(); o2.start();
  return {
    set(rpm, load = .5) { const t = ac.currentTime, fr = 38 + rpm * 150; o1.frequency.setTargetAtTime(fr, t, .06); o2.frequency.setTargetAtTime(fr * .5, t, .06); f.frequency.setTargetAtTime(300 + rpm * 1500, t, .06); g.gain.setTargetAtTime(.035 + load * .06, t, .08); },
    stop() { const t = ac.currentTime; g.gain.setTargetAtTime(0, t, .08); setTimeout(() => { try { o1.stop(); o2.stop(); } catch {} }, 600); },
  };
}

/* ================= background music ================= */
// Calm generated music: soft chord pads plus a slow pentatonic melody. Quiet by design.
const MOODS = {
  mine: { bpm: 72, root: 50, chords: [[0, 7, 12, 16], [-3, 4, 9, 12], [-7, 0, 5, 9], [-5, 2, 7, 11]], scale: [0, 2, 4, 7, 9, 12, 14, 16], wave: 'triangle', beat: false },
  drag: { bpm: 96, root: 52, chords: [[0, 7, 12, 15], [-4, 3, 8, 12], [-2, 5, 10, 14], [-5, 2, 7, 10]], scale: [0, 3, 5, 7, 10, 12, 15], wave: 'sawtooth', beat: true },
  home: { bpm: 66, root: 55, chords: [[0, 4, 7, 12], [-3, 0, 4, 9], [-7, -3, 0, 5], [-5, -1, 2, 7]], scale: [0, 2, 4, 7, 9, 12], wave: 'triangle', beat: false },
};
let mBus = null, mTimer = 0, mMood = null, mStep = 0, mNext = 0, duckUntil = 0;
export const music = {
  get on() { return S.settings.music !== false; },
  toggle() { S.settings.music = !this.on; save(); if (this.on && mMood) this.play(mMood, true); else this.stop(); return this.on; },
  play(mood, force) {
    if (!ac) return; if (mMood === mood && mTimer && !force) return;
    this.stop(); mMood = mood; if (!this.on) return;
    mBus = ac.createGain(); mBus.gain.value = 0; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    mBus.connect(lp).connect(master); mBus.gain.setTargetAtTime(.32, ac.currentTime, 1.5);
    mStep = 0; mNext = ac.currentTime + .1; mTimer = setInterval(schedule, 120);
  },
  stop() { if (mTimer) clearInterval(mTimer); mTimer = 0; if (mBus) { const b = mBus; b.gain.setTargetAtTime(0, ac.currentTime, .4); setTimeout(() => b.disconnect(), 1500); mBus = null; } },
  mood(m) { mMood = m; if (this.on && ac) this.play(m); },
};
function duck(ms = 2600) { duckUntil = performance.now() + ms; if (mBus && ac) mBus.gain.setTargetAtTime(.12, ac.currentTime, .1); }
function note(midi, t, dur, vol, type) {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  if (type === 'sawtooth') { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; o.connect(f).connect(g); } else o.connect(g);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(.4, dur * .3)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  g.connect(mBus); o.start(t); o.stop(t + dur + .05);
}
function schedule() {
  if (!mBus || !ac) return;
  if (duckUntil && performance.now() > duckUntil) { duckUntil = 0; mBus.gain.setTargetAtTime(.32, ac.currentTime, .6); }
  const md = MOODS[mMood] || MOODS.home, beat = 60 / md.bpm / 2;
  while (mNext < ac.currentTime + .4) {
    const bar = Math.floor(mStep / 8) % 4, ch = md.chords[bar], t = mNext;
    if (mStep % 8 === 0) ch.forEach(n => note(md.root + n, t, beat * 8.5, .045, 'sine'));
    if (mStep % 8 === 0) note(md.root - 12 + ch[0], t, beat * 4, .07, 'triangle');
    if (mStep % 2 === 0 && Math.random() < .55) note(md.root + 12 + pick(md.scale), t, beat * 2.2, .03, md.wave === 'sawtooth' ? 'triangle' : 'sine');
    if (md.beat && mStep % 4 === 0) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + .15); g.gain.setValueAtTime(.08, t); g.gain.exponentialRampToValueAtTime(.0001, t + .18); o.connect(g).connect(mBus); o.start(t); o.stop(t + .2); }
    mNext += beat; mStep++;
  }
}

/* ================= speech =================
   A pre-recorded Swedish voice (Piper, see tools/) lives in voice/v0.mp4, v1.mp4 … (about 25 s each, loaded only when needed) with an index in voice.json.
   say() splits a sentence into recorded pieces (longest match first, numbers built from parts) and
   plays them back to back. Anything not recorded falls back to the device's own speech voice. */
export const normSay = s => s.toLowerCase().replace(/[−–]/g, ' minus ').replace(/[.,!?:;"“”()]/g, ' ').replace(/\s+/g, ' ').trim();
let vIndex = null, vLoading = null, vSrcs = [], vGain = null, vSeq = 0;
const vCache = new Map(); // chunk number -> Promise<AudioBuffer>, only a few kept (phones have little memory)
export function loadVoice() {
  if (vLoading || !ac) return vLoading;
  vLoading = (async () => {
    try {
      const j = await fetch('voice/voice.json').then(r => r.json());
      vIndex = j.clips; vGain = ac.createGain(); vGain.gain.value = 1; vGain.connect(ac.destination);
      chunk(0); chunk(1);
    } catch (e) { console.warn('voice', e); vLoading = null; }
  })();
  return vLoading;
}
function chunk(i) {
  if (vCache.has(i)) { const p = vCache.get(i); vCache.delete(i); vCache.set(i, p); return p; }
  const p = fetch(`voice/v${i}.mp4`).then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => ac.decodeAudioData(b, res, rej)));
  p.catch(() => vCache.delete(i));
  vCache.set(i, p);
  while (vCache.size > 5) { const first = vCache.keys().next().value; if (first === 0) { const z = vCache.get(0); vCache.delete(0); vCache.set(0, z); continue; } vCache.delete(first); }
  return p;
}
function numKeys(n) {
  if (n <= 100) return ['#' + n];
  const ks = []; if (n >= 1000) { const k = Math.floor(n / 1000); if (k > 20) return null; ks.push('#t' + k); n %= 1000; }
  if (n >= 100) { ks.push('#h' + Math.floor(n / 100)); n %= 100; }
  if (n > 0) ks.push('#' + n); return ks;
}
function segment(text) {
  if (!vIndex) return null;
  const t = normSay(text).split(' ').filter(Boolean), out = [];
  let i = 0;
  while (i < t.length) {
    let hit = 0;
    for (let j = Math.min(t.length, i + 45); j > i; j--) { const k = t.slice(i, j).join(' '); if (vIndex[k]) { out.push(k); hit = j; break; } }
    if (hit) { i = hit; continue; }
    if (/^\d+$/.test(t[i])) { const ks = numKeys(+t[i]); if (!ks) return null; out.push(...ks); i++; continue; }
    return null;
  }
  return out.length ? out : null;
}
function stopVoice() { vSrcs.forEach(x => { try { x.stop(); } catch {} }); vSrcs = []; try { speechSynthesis.cancel(); } catch {} }
let svVoice = null;
function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices().filter(v => /^sv/i.test(v.lang));
    const score = v => (/premium|enhanced|förbättrad|neural|natural/i.test(v.name) ? 10 : 0) + (/alva|klara|sofie|hillevi/i.test(v.name) ? 3 : 0) + (v.localService ? 1 : 0);
    svVoice = vs.sort((a, b) => score(b) - score(a))[0] || null;
  } catch {}
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speakDevice(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text); u.lang = 'sv-SE'; if (svVoice) u.voice = svVoice; u.rate = .92; u.pitch = 1.05; duck(2600);
    speechSynthesis.speak(u);
  } catch {}
}
export function say(text) {
  stopVoice();
  const my = ++vSeq, parts = vIndex && ac ? segment(text) : null;
  if (!parts) { speakDevice(text); return; }
  const need = [...new Set(parts.map(k => vIndex[k][0]))];
  const ready = Promise.all(need.map(chunk));
  const late = new Promise(r => setTimeout(() => r('late'), 2500));
  Promise.race([ready, late]).then(bufs => {
    if (my !== vSeq) return;
    if (bufs === 'late') { speakDevice(text); return; }
    const byChunk = new Map(need.map((n, i) => [n, bufs[i]]));
    let t = ac.currentTime + .03;
    for (const k of parts) { const [c, st, d] = vIndex[k]; const src = ac.createBufferSource(); src.buffer = byChunk.get(c); src.connect(vGain); src.start(t, st, d); vSrcs.push(src); t += d + .05; }
    duck((t - ac.currentTime) * 1000 + 400);
  }).catch(() => { if (my === vSeq) speakDevice(text); });
}

/* ================= UI helpers ================= */
document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('[data-tts]'); if (el) say(el.dataset.tts); }, true);
export function toast(text, ms = 1700) { const t = $('#toast'); t.innerHTML = text; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms); }
export function openPanel(title, html, accent = '#6a4cff') {
  const p = $('#panel');
  p.innerHTML = `<div class="sheet" style="--q:${accent}" role="dialog" aria-label="${title}"><div class="sheet-head"><h2>${title}</h2><button class="round close" aria-label="Stäng">${ICON.x}</button></div><div class="sheet-body">${html}</div></div>`;
  p.classList.add('on'); p.querySelector('.close').onclick = closePanel;
  p.onclick = e => { if (e.target === p) closePanel(); };
  return p.querySelector('.sheet-body');
}
export function closePanel() { const p = $('#panel'); p.classList.remove('on'); p.innerHTML = ''; }
export function toScreen(v, camera, host) { const p = v.clone().project(camera), r = host.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; }
export function flyTo(x, y, target, html) {
  if (!target) return;
  const r = target.getBoundingClientRect(), d = document.createElement('div');
  d.className = 'fly'; d.innerHTML = html; d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transform = `translate(${r.left + r.width / 2 - x}px,${r.top + r.height / 2 - y}px) scale(.55)`; d.style.opacity = '.3'; }));
  setTimeout(() => { d.remove(); target.classList.remove('bump'); void target.offsetWidth; target.classList.add('bump'); }, 700);
}

/* ================= render loop ================= */
let loopFn = null, last = performance.now();
export function setLoop(fn) { loopFn = fn; last = performance.now(); }
function frame(now) { const dt = Math.min(.05, (now - last) / 1000); last = now; if (loopFn) { try { loopFn(dt, now / 1000); } catch (e) { console.error(e); } } requestAnimationFrame(frame); }
requestAnimationFrame(frame);

/* ================= 3D helpers ================= */
export const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .38, metalness: .2 }, o));
export const E = (color, i = 2.5) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: .4 });
export const RB = (w, h, d, r, s = 4) => new RoundedBoxGeometry(w, h, d, s, r);
export function mesh(geo, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; }
export function shadows(o, cast = true, recv = true) { o.traverse(m => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = recv; } }); }
export function canvasTex(w, h, draw, { nearest = false, repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
let _dot, _sq;
export function dotTex() { return _dot || (_dot = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, { srgb: false })); }
export function sqTex() { return _sq || (_sq = canvasTex(8, 8, g => { g.fillStyle = '#fff'; g.fillRect(1, 1, 6, 6); }, { nearest: true, srgb: false })); }
export function skyTex(stops) { return canvasTex(4, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); stops.forEach(([p, c]) => gr.addColorStop(p, c)); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); }); }

export function makeSparks(scene, n, size, { square = false, gravity = 6, additive = !square } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), vel = new Float32Array(n * 3), life = new Float32Array(n);
  for (let i = 0; i < n; i++) pos[i * 3 + 1] = -9999;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false, map: square ? sqTex() : dotTex(), blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, alphaTest: square ? .5 : 0 });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  let head = 0; const c = new THREE.Color();
  return {
    points: pts,
    burst(at, count, speed, colors, up = 1, spread = 1) {
      for (let k = 0; k < count; k++) {
        const i = head++ % n;
        pos[i * 3] = at.x + (Math.random() - .5) * .3 * spread; pos[i * 3 + 1] = at.y + (Math.random() - .5) * .3 * spread; pos[i * 3 + 2] = at.z + (Math.random() - .5) * .3 * spread;
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), s = speed * (.35 + Math.random() * .9);
        vel[i * 3] = Math.sin(ph) * Math.cos(th) * s; vel[i * 3 + 1] = up * Math.abs(Math.cos(ph)) * s + (1 - up) * Math.cos(ph) * s; vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * s;
        c.set(colors[k % colors.length]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; life[i] = .6 + Math.random() * .6;
      }
      geo.attributes.color.needsUpdate = true;
    },
    update(dt) {
      for (let i = 0; i < n; i++) {
        if (life[i] <= 0) continue; life[i] -= dt;
        vel[i * 3 + 1] -= gravity * dt; pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (life[i] <= 0) pos[i * 3 + 1] = -9999;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
export function makeMotes(scene, n, box, color, size, { fall = false, speed = .25, opacity = .8, additive = true } = {}) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < n; i++) { pos[i * 3] = rnd(box[0], box[1]); pos[i * 3 + 1] = rnd(box[2], box[3]); pos[i * 3 + 2] = rnd(box[4], box[5]); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, map: dotTex(), transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, opacity }));
  p.frustumCulled = false; scene.add(p);
  const o = { points: p, box, update(dt) {
    const m = CALM ? 0 : 1, b = o.box;
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 1] += (fall ? -1 : 1) * dt * speed * m; pos[i * 3] += Math.sin(pos[i * 3 + 1] * 2 + i) * dt * .08 * m;
      if (!fall && pos[i * 3 + 1] > b[3]) pos[i * 3 + 1] = b[2];
      if (fall && pos[i * 3 + 1] < b[2]) pos[i * 3 + 1] = b[3];
      if (pos[i * 3] < b[0]) pos[i * 3] += b[1] - b[0]; if (pos[i * 3] > b[1]) pos[i * 3] -= b[1] - b[0];
    }
    geo.attributes.position.needsUpdate = true;
  } };
  return o;
}

// Light graphics: no glow pass, no shadows, lower resolution. Off by default; parents can turn it on in the settings.
export const GFX_AUTO_LITE = matchMedia('(pointer: coarse)').matches && (devicePixelRatio || 1) <= 2.1;
export const isLite = () => S.settings.gfx === 'lite';
export function createView(host, { bloom = [.6, .5, .82], exposure = 1.05 } = {}) {
  const lite = isLite(), touch = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: !lite, powerPreference: lite ? 'default' : 'high-performance' });
  const pr = lite ? Math.min(devicePixelRatio || 1, 1.25) : Math.min(devicePixelRatio || 1, touch ? 1.5 : 2);
  renderer.setPixelRatio(pr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = !lite; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); if (renderer.domElement.__bye) return; if (window.__showErr) window.__showErr('WebGL context lost'); const g = document.getElementById('glLost'); if (g) g.hidden = false; });
  const pm = new THREE.PMREMGenerator(renderer); const envTex = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
  const camera = new THREE.PerspectiveCamera(40, 2, .1, 900);
  let scene = new THREE.Scene();
  let composer = null, rp = null, bp = null;
  if (!lite) { composer = new EffectComposer(renderer); rp = new RenderPass(scene, camera); composer.addPass(rp); bp = new UnrealBloomPass(new THREE.Vector2(256, 256), bloom[0], bloom[1], bloom[2]); composer.addPass(bp); composer.addPass(new OutputPass()); }
  const v = {
    renderer, camera, composer, bloom: bp, envTex, w: 1, h: 1, host, lite,
    get scene() { return scene; },
    setScene(sc) { const old = scene; scene = sc; if (rp) rp.scene = sc; if (old && old !== sc) disposeScene(old); },
    render() { if (composer) composer.render(); else renderer.render(scene, camera); },
    dispose() { renderer.domElement.__bye = true; ro.disconnect(); disposeScene(scene); if (composer) composer.dispose && composer.dispose(); renderer.dispose(); try { renderer.forceContextLoss(); } catch {} renderer.domElement.remove(); },
  };
  const resize = () => { const w = host.clientWidth || 1, h = host.clientHeight || 1; v.w = w; v.h = h; renderer.setSize(w, h); if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); } camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();
  return v;
}
export function disposeScene(sc) {
  sc.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { for (const k in m) { const t = m[k]; if (t && t.isTexture && t !== _dot && t !== _sq) t.dispose(); } m.dispose(); });
  });
}

/* ================= robot ================= */
function makeArm(m, drill) {
  const pivot = new THREE.Group();
  mesh(new THREE.SphereGeometry(.2, 24, 16), m.accM, 0, 0, 0, pivot);
  mesh(new THREE.CylinderGeometry(.09, .09, .45, 14), m.metalM, 0, -.3, 0, pivot);
  mesh(new THREE.SphereGeometry(.13, 18, 12), m.darkM, 0, -.55, 0, pivot);
  mesh(RB(.3, .55, .3, .1), m.bodyM, 0, -.86, 0, pivot);
  mesh(RB(.34, .1, .34, .04), m.accM, 0, -.62, 0, pivot);
  const hand = new THREE.Group(); hand.position.y = -1.16; pivot.add(hand);
  if (drill === 'pick') {
    mesh(new THREE.SphereGeometry(.13, 16, 12), m.darkM, 0, 0, 0, hand);
    const pk = new THREE.Group(); pk.position.set(0, -.05, .12); hand.add(pk);
    mesh(new THREE.CylinderGeometry(.05, .055, 1.15, 10), M(0x8a5a2c, { roughness: .8 }), 0, 0, .35, pk).rotation.x = Math.PI / 2;
    const head = new THREE.Group(); head.position.set(0, 0, .9); pk.add(head);
    mesh(RB(.16, .9, .16, .05), m.pickM, 0, 0, 0, head);
    for (const s of [-1, 1]) { const tip = mesh(new THREE.ConeGeometry(.08, .28, 10), m.pickM, 0, s * .58, 0, head); if (s < 0) tip.rotation.x = Math.PI; }
    head.rotation.x = .25;
    pivot.userData.pick = pk;
  } else if (drill) {
    const spin = new THREE.Group(); hand.add(spin);
    const cone = mesh(new THREE.ConeGeometry(.2, .66, 22), m.drillM, 0, -.3, 0, spin); cone.rotation.x = Math.PI;
    for (let i = 0; i < 3; i++) { const r = mesh(new THREE.TorusGeometry(.16 - .045 * i, .028, 6, 20), m.metalM, 0, -.1 - .16 * i, 0, spin); r.rotation.x = Math.PI / 2; r.rotation.y = .3; }
    pivot.userData.spin = spin;
  } else {
    mesh(new THREE.SphereGeometry(.13, 16, 12), m.darkM, 0, 0, 0, hand);
    for (const s of [-1, 1]) { const f = mesh(RB(.08, .26, .13, .035), m.metalM, s * .09, -.14, 0, hand); f.rotation.z = s * .28; }
  }
  pivot.userData.hand = hand;
  return pivot;
}
export function makeRobot(o = {}) {
  const { body = 0x22c55e, accent = 0xffa323, eye = 0x9dfcff, drill = false, drillColor = 0xc7ccd6, pick = false } = o;
  const g = new THREE.Group();
  const m = {
    bodyM: new THREE.MeshPhysicalMaterial({ color: body, metalness: .3, roughness: .3, clearcoat: .6, clearcoatRoughness: .2 }),
    accM: M(accent, { metalness: .75, roughness: .25 }), darkM: M(0x262a3d, { roughness: .55, metalness: .3 }),
    metalM: M(0xc7ccd6, { metalness: .95, roughness: .2 }), drillM: M(drillColor, { metalness: .9, roughness: .22 }), pickM: M(drillColor, { metalness: .85, roughness: .28, emissive: drillColor, emissiveIntensity: .12 }),
  };
  const eyeM = E(eye, 3.2);
  for (const s of [-1, 1]) {
    mesh(RB(.36, .56, 1.08, .18), m.darkM, s * .42, .3, 0, g);
    for (let i = 0; i < 3; i++) { const w = mesh(new THREE.CylinderGeometry(.15, .15, .385, 18), m.metalM, s * .42, .3, -.33 + i * .33, g); w.rotation.z = Math.PI / 2; }
  }
  mesh(RB(.9, .3, .6, .1), m.darkM, 0, .68, 0, g);
  mesh(RB(1.22, 1.06, .92, .22), m.bodyM, 0, 1.3, 0, g);
  mesh(RB(.74, .46, .08, .05), m.darkM, 0, 1.36, .46, g);
  [0xff5d5d, 0xffd24a, 0x63f06b].forEach((c, i) => mesh(new THREE.SphereGeometry(.065, 14, 10), E(c, 3), -.21 + i * .21, 1.36, .5, g));
  mesh(RB(.62, .12, .1, .04), m.accM, 0, 1.0, .47, g);
  // jetpack
  const jet = new THREE.Group(); jet.position.set(0, 1.35, -.55); g.add(jet);
  for (const s of [-1, 1]) { mesh(new THREE.CylinderGeometry(.16, .18, .7, 16), m.metalM, s * .22, 0, 0, jet); mesh(new THREE.CylinderGeometry(.1, .14, .14, 16), m.darkM, s * .22, -.42, 0, jet); }
  const flames = [];
  for (const s of [-1, 1]) { const f = mesh(new THREE.ConeGeometry(.13, .7, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffa83d, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }), s * .22, -.85, 0, jet); f.rotation.x = Math.PI; f.visible = false; flames.push(f); }
  mesh(new THREE.CylinderGeometry(.16, .21, .24, 18), m.metalM, 0, 1.92, 0, g);
  const head = new THREE.Group(); head.position.y = 2.36; g.add(head);
  mesh(RB(1.04, .78, .88, .24), m.bodyM, 0, 0, 0, head);
  mesh(RB(.86, .44, .08, .11), m.darkM, 0, .02, .43, head);
  const eyes = [];
  for (const s of [-1, 1]) { eyes.push(mesh(RB(.17, .21, .05, .05), eyeM, s * .2, .04, .48, head)); const ear = mesh(new THREE.CylinderGeometry(.13, .13, .12, 22), m.accM, s * .57, 0, 0, head); ear.rotation.z = Math.PI / 2; }
  // helmet lamp
  mesh(new THREE.CylinderGeometry(.12, .12, .1, 18), m.accM, 0, .43, .2, head);
  const lampM = E(0xfff3c4, 3); mesh(new THREE.CylinderGeometry(.08, .08, .04, 18), lampM, 0, .43, .27, head).rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(.03, .03, .38, 8), m.metalM, 0, .57, -.15, head);
  const ball = mesh(new THREE.SphereGeometry(.1, 18, 12), E(accent, 3.5), 0, .8, -.15, head);
  const armL = makeArm(m, false); armL.position.set(-.8, 1.62, 0); g.add(armL);
  const armR = makeArm(m, pick ? 'pick' : drill); armR.position.set(.8, 1.62, 0); g.add(armR);
  shadows(g); flames.forEach(f => { f.castShadow = false; });
  g.userData = { head, armL, armR, ball, eyes, eyeM, m, flames, jet };
  return g;
}
export function idleRobot(r, t, phase = 0, amount = 1) {
  const u = r.userData, a = CALM ? 0 : amount;
  u.head.rotation.y = Math.sin(t * .9 + phase) * .18 * a;
  u.head.rotation.z = Math.sin(t * 1.3 + phase) * .04 * a;
  u.armL.rotation.z = -.1 - Math.sin(t * 1.6 + phase) * .06 * a;
  if (u.ball) u.ball.material.emissiveIntensity = 2.5 + Math.sin(t * 4 + phase) * 1.2;
  const blink = ((t + phase) % 4) < .12 ? .1 : 1; u.eyes.forEach(e => e.scale.y = blink);
}

/* ================= cars ================= */
const SHAPES = [
  { // 0: mid-engine wedge
    body(s) { s.moveTo(-2.3, .32); s.lineTo(-2.0, .26); s.absarc(-1.45, .42, .56, Math.PI, 0, true); s.lineTo(1.0, .24); s.absarc(1.55, .42, .56, Math.PI, 0, true); s.lineTo(2.28, .26); s.bezierCurveTo(2.45, .3, 2.45, .5, 2.3, .54); s.quadraticCurveTo(1.6, .72, 1.0, .82); s.lineTo(.55, .9); s.quadraticCurveTo(.05, 1.24, -.55, 1.22); s.quadraticCurveTo(-1.3, 1.17, -1.95, 1.02); s.lineTo(-2.32, .96); s.lineTo(-2.38, .6); s.lineTo(-2.3, .32); },
    win(s) { s.moveTo(.48, .94); s.quadraticCurveTo(.05, 1.2, -.55, 1.19); s.quadraticCurveTo(-1.15, 1.15, -1.5, 1.03); s.lineTo(-1.3, .96); s.lineTo(.48, .94); },
    roof(s) { s.moveTo(.6, .9); s.quadraticCurveTo(.05, 1.24, -.55, 1.22); s.quadraticCurveTo(-1.1, 1.18, -1.55, 1.09); s.lineTo(.6, .9); },
    tail: [-2.42, .84], wingY: 1.38, wingX: -2.05, mirror: [.42, 1.02], wheels: [-1.45, 1.55], nose: 2.27,
  },
  { // 1: long-hood GT
    body(s) { s.moveTo(-2.36, .34); s.lineTo(-2.05, .26); s.absarc(-1.5, .42, .56, Math.PI, 0, true); s.lineTo(1.05, .24); s.absarc(1.6, .42, .56, Math.PI, 0, true); s.lineTo(2.34, .28); s.bezierCurveTo(2.52, .32, 2.52, .56, 2.36, .6); s.quadraticCurveTo(1.6, .8, .5, .9); s.quadraticCurveTo(.05, 1.16, -.6, 1.17); s.quadraticCurveTo(-1.45, 1.12, -2.1, .98); s.lineTo(-2.4, .9); s.lineTo(-2.44, .55); s.lineTo(-2.36, .34); },
    win(s) { s.moveTo(.4, .95); s.quadraticCurveTo(.0, 1.13, -.6, 1.13); s.quadraticCurveTo(-1.25, 1.1, -1.6, 1.0); s.lineTo(-1.4, .95); s.lineTo(.4, .95); },
    roof(s) { s.moveTo(.5, .9); s.quadraticCurveTo(.05, 1.16, -.6, 1.17); s.quadraticCurveTo(-1.25, 1.13, -1.7, 1.04); s.lineTo(.5, .9); },
    tail: [-2.46, .8], wingY: 1.3, wingX: -2.15, mirror: [.3, 1.0], wheels: [-1.5, 1.6], nose: 2.34,
  },
  { // 2: ultra-low hyper
    body(s) { s.moveTo(-2.4, .3); s.lineTo(-2.05, .24); s.absarc(-1.5, .41, .56, Math.PI, 0, true); s.lineTo(1.0, .22); s.absarc(1.55, .41, .56, Math.PI, 0, true); s.lineTo(2.38, .24); s.bezierCurveTo(2.5, .26, 2.5, .42, 2.4, .46); s.quadraticCurveTo(1.7, .6, .9, .74); s.lineTo(.45, .8); s.quadraticCurveTo(-.1, 1.1, -.7, 1.08); s.quadraticCurveTo(-1.5, 1.04, -2.2, .9); s.lineTo(-2.44, .86); s.lineTo(-2.48, .5); s.lineTo(-2.4, .3); },
    win(s) { s.moveTo(.38, .84); s.quadraticCurveTo(-.1, 1.06, -.7, 1.05); s.quadraticCurveTo(-1.3, 1.02, -1.6, .93); s.lineTo(-1.4, .86); s.lineTo(.38, .84); },
    roof(s) { s.moveTo(.5, .8); s.quadraticCurveTo(-.1, 1.1, -.7, 1.08); s.quadraticCurveTo(-1.3, 1.05, -1.75, .97); s.lineTo(.5, .8); },
    tail: [-2.5, .74], wingY: 1.25, wingX: -2.15, mirror: [.3, .92], wheels: [-1.5, 1.55], nose: 2.36,
  },
  { // 3: hot hatch
    body(s) { s.moveTo(-2.05, .36); s.lineTo(-1.85, .28); s.absarc(-1.35, .42, .52, Math.PI, 0, true); s.lineTo(.95, .26); s.absarc(1.45, .42, .52, Math.PI, 0, true); s.lineTo(2.05, .3); s.bezierCurveTo(2.2, .34, 2.2, .62, 2.05, .68); s.quadraticCurveTo(1.4, .86, .85, .92); s.lineTo(.35, 1.0); s.quadraticCurveTo(-.05, 1.42, -.6, 1.45); s.lineTo(-1.6, 1.42); s.quadraticCurveTo(-1.95, 1.35, -2.05, 1.0); s.lineTo(-2.1, .6); s.lineTo(-2.05, .36); },
    win(s) { s.moveTo(.3, 1.04); s.quadraticCurveTo(-.05, 1.37, -.6, 1.39); s.lineTo(-1.55, 1.36); s.quadraticCurveTo(-1.85, 1.3, -1.9, 1.08); s.lineTo(.3, 1.04); },
    roof(s) { s.moveTo(.35, 1.0); s.quadraticCurveTo(-.05, 1.42, -.6, 1.45); s.lineTo(-1.6, 1.42); s.lineTo(-1.6, 1.3); s.lineTo(.35, 1.0); },
    tail: [-2.13, .95], wingY: 1.5, wingX: -1.75, mirror: [.3, 1.1], wheels: [-1.35, 1.45], nose: 2.05,
  },
];
export function makeCar(spec, paintHex) {
  const sh = SHAPES[spec.shape || 0];
  const car = new THREE.Group(); const body = new THREE.Group(); car.add(body);
  const paint = paintHex ?? spec.paint;
  const paintM = new THREE.MeshPhysicalMaterial({ color: paint, metalness: spec.chrome ? 1 : .55, roughness: spec.chrome ? .14 : .3, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: .9 });
  const accM = new THREE.MeshPhysicalMaterial({ color: spec.accent ?? 0x15171c, metalness: .5, roughness: .35, clearcoat: .6 });
  const carbon = M(0x15171c, { roughness: .4, metalness: .5 });
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0x06080e, metalness: .9, roughness: .05, clearcoat: 1, envMapIntensity: 1.3 });
  const bs = new THREE.Shape(); sh.body(bs);
  const bg = new THREE.ExtrudeGeometry(bs, { depth: 1.62, bevelEnabled: true, bevelThickness: .16, bevelSize: .1, bevelSegments: 6, curveSegments: 28 });
  bg.translate(0, 0, -.81); mesh(bg, paintM, 0, 0, 0, body);
  const ws = new THREE.Shape(); sh.win(ws);
  const wg = new THREE.ExtrudeGeometry(ws, { depth: 1.98, bevelEnabled: false, curveSegments: 16 }); wg.translate(0, 0, -.99); mesh(wg, glassM, 0, 0, 0, body);
  const rs = new THREE.Shape(); sh.roof(rs);
  const rg = new THREE.ExtrudeGeometry(rs, { depth: 1.2, bevelEnabled: false, curveSegments: 20 }); rg.translate(0, .105, -.6); mesh(rg, glassM, 0, 0, 0, body);
  const headM = E(0xeaf6ff, 6), tailM = E(0xff1a2a, 6);
  for (const z of [-1, 1]) {
    const hl = mesh(RB(.2, .06, .46, .02), headM, sh.nose, sh === SHAPES[3] ? .62 : .5, z * .6, body); hl.rotation.y = -z * .28; hl.rotation.z = -.22;
    mesh(RB(.75, .3, .04, .03), carbon, -.75, .56, z * .985, body);
    mesh(RB(2.6, .08, .04, .02), accM, .05, .28, z * .99, body);
    mesh(RB(.2, .1, .14, .04), accM, sh.mirror[0], sh.mirror[1], z * 1.06, body);
    mesh(new THREE.CylinderGeometry(.07, .07, .12, 16), M(0xb8bec8, { metalness: 1, roughness: .2 }), sh.tail[0] - .02, .36, z * .32, body).rotation.z = Math.PI / 2;
  }
  mesh(RB(.05, .07, 1.78, .02), tailM, sh.tail[0], sh.tail[1], 0, body);
  mesh(RB(.04, .04, 1.2, .015), E(0xff1a2a, 3), sh.tail[0], sh.tail[1] - .18, 0, body);
  mesh(new THREE.BoxGeometry(.45, .04, 1.9), carbon, sh.nose - .05, .16, 0, body);
  for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(.4, .14, .03), carbon, sh.tail[0] + .2, .23, -.6 + i * .3, body);
  const W = spec.wing || 0, wx = sh.wingX, wy = sh.wingY;
  if (W === 1) mesh(RB(.32, .07, 1.86, .03), accM, sh === SHAPES[3] ? -1.8 : sh.tail[0] + .15, sh === SHAPES[3] ? 1.44 : sh.tail[1] + .16, 0, body);
  if (W >= 2) {
    mesh(RB(.5, .06, 1.98, .02), accM, wx, wy, 0, body);
    for (const z of [-1, 1]) { mesh(new THREE.BoxGeometry(.06, wy - sh.tail[1] - .1, .04), carbon, wx + .05, (wy + sh.tail[1]) / 2 + .05, z * .55, body); mesh(RB(.55, .26, .03, .01), accM, wx, wy - .02, z * .98, body); }
    if (W === 3) mesh(RB(.36, .05, 1.98, .02), accM, wx - .06, wy + .17, 0, body);
  }
  if (spec.neon) for (const z of [-1, 1]) mesh(new THREE.BoxGeometry(3.4, .04, .03), E(spec.glow, 4), 0, .2, z * 1.0, body);
  const flames = [];
  for (const z of [-1, 1]) { const f = mesh(new THREE.ConeGeometry(.1, .9, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x6fb6ff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }), sh.tail[0] - .55, .36, z * .32, body); f.rotation.z = Math.PI / 2; f.visible = false; flames.push(f); }
  if (spec.rockets) for (const z of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(.16, .2, 1.1, 18), M(0xdfe3ea, { metalness: 1, roughness: .2 }), -1.7, 1.05, z * .62, body).rotation.z = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(.13, .13, .05, 18), E(0x5ff4ff, 5), -2.27, 1.05, z * .62, body).rotation.z = Math.PI / 2;
    const f = mesh(new THREE.ConeGeometry(.15, 1.4, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x9ffcff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }), -2.95, 1.05, z * .62, body); f.rotation.z = Math.PI / 2; f.visible = false; flames.push(f);
  }
  const wheels = []; const tireM = M(0x15161a, { roughness: .85 }), rimM = M(spec.rim ?? 0x2b2e35, { metalness: .9, roughness: .22 }), spokeM = M(0xdfe3ea, { metalness: 1, roughness: .18 }), calM = M(spec.caliper ?? 0xffd400, { roughness: .35, metalness: .3 });
  const [rx, fx] = sh.wheels;
  for (const [x, z] of [[rx, 1], [rx, -1], [fx, 1], [fx, -1]]) {
    const w = new THREE.Group(); w.position.set(x, .4, z * .86); if (z < 0) w.rotation.y = Math.PI; car.add(w);
    const spin = new THREE.Group(); w.add(spin);
    mesh(new THREE.CylinderGeometry(.4, .4, .3, 40), tireM, 0, 0, 0, spin).rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(.29, .29, .31, 32), rimM, 0, 0, 0, spin).rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const sp = mesh(new THREE.BoxGeometry(.055, .25, .03), spokeM, Math.sin(a) * .13, Math.cos(a) * .13, .165, spin); sp.rotation.z = -a; }
    mesh(new THREE.CylinderGeometry(.06, .06, .04, 16), spokeM, 0, 0, .17, spin).rotation.x = Math.PI / 2;
    mesh(RB(.2, .12, .07, .03), calM, .17, .12, .12, w).rotation.z = -.6;
    wheels.push({ spin, dir: z < 0 ? -1 : 1 });
  }
  const glow = mesh(new THREE.PlaneGeometry(5.2, 2.4), new THREE.MeshBasicMaterial({ color: spec.glow ?? paint, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, map: dotTex() }), 0, .03, 0, car); glow.rotation.x = -Math.PI / 2;
  shadows(car); glow.castShadow = false; flames.forEach(f => f.castShadow = false);
  car.userData = { body, wheels, flames, paintM, glow, headM, tailM };
  return car;
}
export const voiceParts = t => segment(t);
