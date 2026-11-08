// Dragracet: collect real car cards, race the rivals on six tracks, answer questions for nitro.
import { THREE, S, save, $, ICON, coinIcon, M, E, RB, mesh, shadows, canvasTex, skyTex, dotTex, makeSparks, makeMotes, createView, disposeScene, makeCar, setLoop, sfx, say, toast, openPanel, closePanel, engineSound, lerp, ease, clamp01, rand, pick, CALM } from './core.js';
import { ask, cancelAsk } from './learn.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CARS, carById, TRACKS, physics, NITRO, PHOTOS } from './cars.js';

const D = 402; // a quarter mile in metres
let view, hud, api, R = null, garage = null, engine = null;
const hex = n => '#' + n.toString(16).padStart(6, '0');
const dec = x => String(x).replace('.', ',');
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const owned = id => S.drag.cars.includes(id);
const beaten = id => S.drag.beaten.includes(id);
const known = id => owned(id) || beaten(id);
const lastOpen = () => { let i = 0; TRACKS.forEach((_, k) => { if (trackOpen(k)) i = k; }); return i; };
export const trackOpen = i => i === 0 || TRACKS[i - 1].rivals.every(beaten);

export function enter(stage, hudEl, a) {
  api = a; hud = hudEl;
  if (!Array.isArray(S.drag.beaten)) S.drag.beaten = [];
  if (!S.drag.cars.length || !CARS.some(c => c.id === S.drag.car)) { S.drag.cars = ['golf']; S.drag.car = 'golf'; }
  view = createView(stage, { bloom: [.42, .5, .86], exposure: 1.05 });
  showGarage();
}
export function exit() {
  setLoop(null); cancelAsk(); closePanel();
  if (engine) { engine.stop(); engine = null; }
  if (R && R.keyDown) { window.removeEventListener('keydown', R.keyDown); window.removeEventListener('keyup', R.keyUp); }
  if (thumbR) { thumbR.dispose(); try { thumbR.forceContextLoss(); } catch {} thumbR = null; }
  view && view.dispose(); view = null; hud.innerHTML = ''; R = null; garage = null;
}

/* ================= card thumbnails ================= */
let thumbR = null, thumbEnv = null; const thumbs = {};
function thumb(car) {
  if (thumbs[car.id]) return thumbs[car.id];
  if (!thumbR) {
    thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbR.setPixelRatio(1); thumbR.setSize(400, 220); thumbR.toneMapping = THREE.ACESFilmicToneMapping;
    const pm = new THREE.PMREMGenerator(thumbR); thumbEnv = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
  }
  const sc = new THREE.Scene(); sc.environment = thumbEnv;
  sc.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.2));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(4, 6, 5); sc.add(d);
  const c = makeCar(car.m); c.rotation.y = -.55; c.userData.glow.visible = false; sc.add(c);
  const cam = new THREE.PerspectiveCamera(28, 400 / 220, .1, 60); cam.position.set(7.2, 2.6, 8.4); cam.lookAt(0, .55, 0);
  let url = '';
  try { thumbR.render(sc, cam); url = thumbR.domElement.toDataURL('image/png'); } catch {}
  disposeScene(sc); thumbs[car.id] = url; return url;
}
function stat(label, val, frac, hide) { return `<div class="cs"><span>${label}</span><b>${hide ? '?' : val}</b>${frac == null ? '' : `<i style="--f:${hide ? 0 : Math.max(.06, Math.min(1, frac))}"></i>`}</div>`; }
export function cardHTML(car, { small = false, tag = '' } = {}) {
  const lock = !known(car.id);
  return `<div class="ccard${lock ? ' locked' : ''}${small ? ' small' : ''}" data-id="${car.id}" style="--cc:${hex(car.m.glow ?? car.m.paint)}">
    ${tag ? `<div class="ctag">${tag}</div>` : ''}
    <div class="cimg"><img src="img/cars/${car.id}.jpg" alt="${lock ? '' : car.name}" loading="lazy"></div>
    <div class="cname">${lock ? '???' : car.name}</div>
    ${small ? '' : `<div class="cland">${lock ? '&nbsp;' : car.land}</div>
    <div class="cstats">${stat('Hästkrafter', car.hk + ' hk', car.hk / 2000, lock)}${stat('0–100 km/h', dec(car.acc) + ' s', (7 - car.acc) / 5.5, lock)}${stat('Topfart', car.top + ' km/h', car.top / 540, lock)}${stat('Pris i verkligheten', car.pris, null, lock)}</div>
    <div class="cfakta">${lock ? 'Vinn mot bilen för att låsa upp kortet.' : car.fakta}</div>
    ${lock ? '' : `<button class="speak cspeak" data-say="${car.id}" aria-label="Läs upp kortet">${ICON.speaker}</button>`}
    ${lock || !PHOTOS[car.id] ? '' : `<div class="credit">Foto: ${esc(PHOTOS[car.id].by)}, ${esc(PHOTOS[car.id].lic)}, Wikimedia Commons</div>`}`}
  </div>`;
}
function readCard(car) { say(`${car.name}. ${car.hk} hästkrafter. Noll till hundra på ${dec(car.acc)} sekunder. Topfart ${car.top} kilometer i timmen. ${car.fakta}`); }
function wireSpeak(root) { root.querySelectorAll('[data-say]').forEach(b => b.onclick = e => { e.stopPropagation(); readCard(carById(b.dataset.say)); }); }

/* ================= garage ================= */
function studioScene() {
  const sc = new THREE.Scene(); sc.environment = view.envTex;
  sc.background = new THREE.Color(0x0b0d16); sc.fog = new THREE.Fog(0x0b0d16, 14, 34);
  sc.add(new THREE.HemisphereLight(0xbfd4ff, 0x10121a, .5));
  const key = new THREE.SpotLight(0xfff4e6, 120, 24, .5, .55, 1.3); key.position.set(2, 9, 5); key.target.position.set(0, 0, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); sc.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x8fb4ff, 1.4); rim.position.set(-6, 4, -6); sc.add(rim);
  const floor = mesh(new THREE.CircleGeometry(40, 64), M(0x0d1018, { metalness: .7, roughness: .28 }), 0, 0, 0, sc); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  const tt = mesh(new THREE.CylinderGeometry(3.6, 3.75, .18, 72), M(0x1b2030, { metalness: .8, roughness: .3 }), 0, .09, 0, sc); tt.receiveShadow = true;
  const ring = mesh(new THREE.TorusGeometry(3.66, .035, 8, 160), E(0x7fb0ff, 3), 0, .18, 0, sc); ring.rotation.x = Math.PI / 2;
  for (let i = 0; i < 9; i++) { const a = Math.PI * (1.1 + i * .1); const s = mesh(new THREE.BoxGeometry(.12, 5, .12), E(0x9fc0ff, 1.1), Math.cos(a) * 13, 2.5, Math.sin(a) * 13, sc); }
  const strip = mesh(new THREE.BoxGeometry(18, .08, .08), E(0xffffff, 1.5), 0, 7, -10, sc);
  return { sc, tt, ring, key };
}
function showGarage(index) {
  if (engine) { engine.stop(); engine = null; }
  if (R && R.keyDown) { window.removeEventListener('keydown', R.keyDown); window.removeEventListener('keyup', R.keyUp); }
  R = null; closePanel();
  const st = studioScene(); view.setScene(st.sc);
  const cam = view.camera; cam.fov = 34; cam.updateProjectionMatrix();
  const list = CARS.filter(c => known(c.id));
  let gi = Math.max(0, list.findIndex(c => c.id === (index || S.drag.car)));
  garage = { st, gi, list, car: null };
  hud.innerHTML = `
    <div class="hud-top">
      <button class="round" id="d-home" aria-label="Till startsidan">${ICON.home}</button>
      <div class="chip" data-batt><b class="batt"><i></i></b><span></span></div>
      <div class="chip" id="d-coins">${coinIcon()}<span>${S.drag.coins}</span></div>
      <span class="grow"></span>
      <button class="pill" id="d-tracks" data-tts="Välj bana">${ICON.flag}<span>Banor</span></button>
      <button class="pill" id="d-album" data-tts="Bilkort">Bilkort ${CARS.filter(c => known(c.id)).length}/${CARS.length}</button>
    </div>
    <div class="g-card" id="g-card"></div>
    <div class="g-nav">
      <button class="round big" id="g-prev" aria-label="Förra bilen">${ICON.left}</button>
      <div class="g-act" id="g-act"></div>
      <button class="round big" id="g-next" aria-label="Nästa bil">${ICON.right}</button>
    </div>
    <button class="go-btn" id="g-race">${ICON.play}<span>Kör!</span></button>
    <div class="g-tip">På en kort sträcka är <b>0–100</b> viktigast.</div>`;
  api.refreshBattery();
  $('#d-home').onclick = () => api.exit();
  $('#d-album').onclick = showAlbum;
  const n = garage.list.length;
  $('#g-prev').hidden = $('#g-next').hidden = n < 2;
  $('#g-prev').onclick = () => { sfx.tap(); garage.gi = (garage.gi + n - 1) % n; showCar(true); };
  $('#g-next').onclick = () => { sfx.tap(); garage.gi = (garage.gi + 1) % n; showCar(true); };
  $('#g-race').onclick = startNext;
  $('#d-tracks').onclick = showTracks;
  showCar();
  if (!S.drag.tut) { S.drag.tut = true; save(); setTimeout(() => say('Välkommen till garaget! Tryck på den gula knappen för att köra.'), 400); }
  else { const buy = garage.list.find(c => !owned(c.id) && S.drag.coins >= c.coins); if (buy && !garage.told) { garage.told = true; setTimeout(() => say('Du har råd med en ny bil! Tryck på pilarna.'), 600); } }
  setLoop((dt, t) => {
    if (!view || !garage) return;
    const g = garage; st.tt.rotation.y += dt * .25 * (CALM ? 0 : 1);
    if (g.car) g.car.rotation.y = st.tt.rotation.y;
    cam.position.set(Math.sin(t * .1) * .6, 2.3, 9.6); cam.lookAt(1.6, .6, 0);
    st.ring.material.emissiveIntensity = 2.6 + Math.sin(t * 2) * .5;
    view.render();
  });
}
function showCar(speak) {
  const g = garage, car = g.list[g.gi];
  if (speak) say(car.name);
  if (g.car) { g.st.sc.remove(g.car); disposeScene(g.car); }
  const c = makeCar(car.m, S.drag.paint[car.id]);
  if (!known(car.id)) { c.traverse(o => { if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); o.material.color.set(0x06070a); if (o.material.emissive) o.material.emissive.set(0x000000); } }); c.userData.glow.visible = false; }
  c.position.y = .18; c.rotation.y = g.st.tt.rotation.y; g.st.sc.add(c); g.car = c;
  const el = $('#g-card'); el.innerHTML = cardHTML(car, { tag: S.drag.car === car.id ? 'DIN BIL' : '' }); wireSpeak(el);
  const act = $('#g-act');
  if (S.drag.car === car.id) act.innerHTML = `<div class="g-state">${ICON.check}<span>Vald</span></div>`;
  else if (owned(car.id)) { act.innerHTML = `<button class="pill strong" id="g-pick">Kör den här</button>`; $('#g-pick').onclick = () => { S.drag.car = car.id; save(); sfx.tap(); say(car.name); showCar(); }; }
  else if (beaten(car.id)) {
    const can = S.drag.coins >= car.coins;
    act.innerHTML = can ? `<button class="pill strong" id="g-buy">Köp ${coinIcon()} ${car.coins}</button>` : `<button class="pill buyprog" id="g-buy" style="--p:${Math.round(S.drag.coins / car.coins * 100)}%">${coinIcon()} ${S.drag.coins} / ${car.coins}</button>`;
    $('#g-buy').onclick = () => {
      if (S.drag.coins < car.coins) { sfx.wrong(); say(`Du behöver ${car.coins - S.drag.coins} mynt till.`); toast(`Du behöver ${car.coins - S.drag.coins} mynt till`); return; }
      S.drag.coins -= car.coins; S.drag.cars.push(car.id); S.drag.car = car.id; save();
      sfx.unlock(); say(`Ny bil! ${car.name}.`); toast(`Ny bil: ${car.name}`, 2200);
      $('#d-coins span').textContent = S.drag.coins; showCar();
    };
  } else act.innerHTML = `<div class="g-state dim">${ICON.lock}<span>Vinn mot den</span></div>`;
}
function showAlbum() {
  sfx.tap();
  const body = openPanel(`Bilkort ${CARS.filter(c => known(c.id)).length} av ${CARS.length}`, `<div class="album">${CARS.map(c => cardHTML(c, { small: true })).join('')}</div>`, '#2b6cff');
  body.querySelectorAll('.ccard').forEach(el => el.onclick = () => {
    const car = carById(el.dataset.id); sfx.tap();
    const b2 = openPanel(known(car.id) ? car.name : 'Okänd bil', `<div class="card-big">${cardHTML(car)}</div><button class="pill" id="al-back">Tillbaka</button>`, '#2b6cff');
    wireSpeak(b2); if (known(car.id)) readCard(car);
    b2.querySelector('#al-back').onclick = showAlbum;
  });
}
function startNext() {
  sfx.tap();
  const ti = lastOpen();
  S.drag.track = ti; save();
  const T = TRACKS[ti], rid = T.rivals.find(id => !beaten(id)) || pick(T.rivals);
  showVersus(rid);
}
function showTracks() {
  sfx.tap();
  if (!trackOpen(S.drag.track)) S.drag.track = 0;
  const draw = () => {
    const ti = S.drag.track, T = TRACKS[ti];
    const next = T.rivals.find(id => !beaten(id));
    const body = openPanel('Välj bana och motståndare', `
      <div class="tracks">${TRACKS.map((t, i) => `<button class="trk${i === ti ? ' on' : ''}${trackOpen(i) ? '' : ' locked'}" data-t="${i}" style="--tc:${t.color}"><b>${t.name}</b><span>${trackOpen(i) ? `${t.rivals.filter(beaten).length}/3 ${ICON.check}` : ICON.lock}</span></button>`).join('')}</div>
      <div class="rivals">${T.rivals.map((id, i) => { const open = i === 0 || beaten(T.rivals[i - 1]); return `<div class="rv${open ? '' : ' locked'}" data-r="${id}">${cardHTML(carById(id), { small: true, tag: beaten(id) ? 'VUNNEN' : id === next ? `NÄSTA ${(S.drag.rw && S.drag.rw[id]) || 0}/2` : '' })}${open ? `<button class="pill strong">${beaten(id) ? 'Kör igen' : 'Kör'}</button>` : `<div class="g-state dim">${ICON.lock}</div>`}</div>`; }).join('')}</div>`, T.color);
    body.querySelectorAll('.trk').forEach(b => b.onclick = () => { const i = +b.dataset.t; if (!trackOpen(i)) { sfx.wrong(); say('Vinn mot alla bilar på banan innan.'); return; } S.drag.track = i; save(); sfx.tap(); draw(); });
    body.querySelectorAll('.rv:not(.locked)').forEach(el => el.onclick = () => showVersus(el.dataset.r));
  };
  draw();
}
function showVersus(rivalId) {
  sfx.tap();
  const me = carById(S.drag.car), rv = carById(rivalId);
  const body = openPanel(`Dags att tävla · ${TRACKS[S.drag.track].name}`, `<div class="vs">${cardHTML(me, { tag: 'DU' })}<div class="vs-mid"><span>VS</span><button class="go-btn inline" id="vs-go" data-tts="Starta">${ICON.play}<span>Starta</span></button></div>${cardHTML(rv, { tag: 'MOTSTÅNDARE' })}</div>`, TRACKS[S.drag.track].color);
  wireSpeak(body);
  say(`Du kör ${me.name} mot ${known(rv.id) ? rv.name : 'en okänd bil'}.`);
  body.querySelector('#vs-go').onclick = () => { closePanel(); startRace(rivalId); };
}

/* ================= tracks ================= */
function scatter(parent, geo, mat, n, place) {
  const im = new THREE.InstancedMesh(geo, mat, n), o = new THREE.Object3D();
  for (let i = 0; i < n; i++) { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); place(o, i); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
  im.castShadow = false; im.receiveShadow = true; parent.add(im); return im;
}
const side = () => (Math.random() < .5 ? -1 : 1);
function buildTrack(ti, envTex = view.envTex) {
  const sc = new THREE.Scene(); sc.environment = envTex;
  const theme = TRACKS[ti].id, X0 = -80, X1 = D + 320, L = X1 - X0, XC = (X0 + X1) / 2;
  let fx = { update() {} }, night = false, sunCol = 0xfff0d8, sunI = 2.2, hemi = [0xbfd4ff, 0x444444, .7], wallCol = 0x9aa0a8, groundCol = 0x2a2d33;
  // themes
  if (theme === 'stad') { night = true; sc.background = new THREE.Color(0x060914); sc.fog = new THREE.Fog(0x080c1c, 40, 260); hemi = [0x5070b0, 0x0c0c14, .55]; sunCol = 0xa9c0ff; sunI = .9; groundCol = 0x0b0f17; }
  if (theme === 'oken') { sc.background = skyTex([[0, '#2b1b4f'], [.45, '#c4507a'], [.75, '#ff8a3d'], [1, '#ffd27a']]); sc.fog = new THREE.Fog(0xf2a066, 60, 420); hemi = [0xffc89a, 0x7a4a2a, .8]; sunCol = 0xffb070; sunI = 2.4; groundCol = 0xd9a86a; wallCol = 0xc98a5a; }
  if (theme === 'kust') { sc.background = skyTex([[0, '#2f7fe0'], [.6, '#8fd0ff'], [1, '#e8f6ff']]); sc.fog = new THREE.Fog(0xcfeaff, 80, 480); hemi = [0xcfeaff, 0xd9c08a, .9]; sunCol = 0xfff4e0; sunI = 2.8; groundCol = 0xe8d39a; wallCol = 0xf2f2f2; }
  if (theme === 'sno') { sc.background = skyTex([[0, '#8fb4dc'], [.7, '#d4e6f5'], [1, '#f4f9ff']]); sc.fog = new THREE.Fog(0xe6f0fa, 50, 360); hemi = [0xeef6ff, 0xbfd0e0, 1.0]; sunCol = 0xffffff; sunI = 1.8; groundCol = 0xf4f8fc; wallCol = 0x3a7bd5; }
  if (theme === 'vulkan') { night = true; sc.background = skyTex([[0, '#12040a'], [.6, '#4a0d0a'], [1, '#b8320f']]); sc.fog = new THREE.Fog(0x3a0c08, 40, 300); hemi = [0xff8a5a, 0x1a0606, .55]; sunCol = 0xff9a6a; sunI = 1.0; groundCol = 0x1c1414; wallCol = 0x3a3434; }
  if (theme === 'rymd') { night = true; sc.background = new THREE.Color(0x04020c); sc.fog = new THREE.Fog(0x08041a, 80, 500); hemi = [0x9b7bff, 0x0a0618, .6]; sunCol = 0xc8b8ff; sunI = 1.0; groundCol = 0x07050f; wallCol = 0x1a1530; }
  sc.add(new THREE.HemisphereLight(...hemi));
  const sun = new THREE.DirectionalLight(sunCol, sunI); sun.position.set(30, 40, 25); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 120 }); sun.shadow.bias = -.0005; sc.add(sun, sun.target);
  // ground and road
  if (theme !== 'rymd') { const gr = mesh(new THREE.PlaneGeometry(L + 600, 900), M(groundCol, { roughness: 1 }), XC, -.03, 0, sc); gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true; }
  const at = canvasTex(256, 256, (g) => { g.fillStyle = theme === 'sno' ? '#4a4f5a' : '#23262e'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 4000; i++) { const v = 28 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v},${v},${v + 6})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); } }, { repeat: [L / 5, 2] });
  const road = mesh(new THREE.PlaneGeometry(L, 10), M(0xffffff, { map: at, roughness: theme === 'sno' ? .35 : .6, metalness: .1 }), XC, 0, 0, sc); road.rotation.x = -Math.PI / 2; road.receiveShadow = true;
  if (theme === 'rymd') mesh(new THREE.BoxGeometry(L, .6, 10.4), M(0x14102a, { metalness: .6 }), XC, -.31, 0, sc);
  const lineM = theme === 'rymd' ? E(0xff4fd8, 2) : E(0xf4f4f0, night ? .6 : .2), midM = theme === 'rymd' ? E(0x4ff7ff, 2) : E(0xffc400, night ? .9 : .3);
  for (const z of [-4.6, 4.6]) mesh(new THREE.PlaneGeometry(L, .16), lineM, XC, .01, z, sc).rotation.x = -Math.PI / 2;
  mesh(new THREE.PlaneGeometry(L, .18), midM, XC, .012, 0, sc).rotation.x = -Math.PI / 2;
  const ck = canvasTex(32, 256, g => { for (let y = 0; y < 32; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f2f2f2'; g.fillRect(x * 8, y * 8, 8, 8); } }, { nearest: true });
  for (const x of [0, D]) { const l = mesh(new THREE.PlaneGeometry(1, 9.6), M(0xffffff, { map: ck, roughness: .6 }), x + .5, .013, 0, sc); l.rotation.x = -Math.PI / 2; l.receiveShadow = true; }
  // walls
  const wt = canvasTex(64, 16, g => { g.fillStyle = hex(wallCol); g.fillRect(0, 0, 64, 16); for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#e2402a' : '#f4f4f4'; g.fillRect(i * 16, 0, 16, 4); } }, { repeat: [L / 6, 1] });
  if (theme !== 'rymd') for (const z of [-5.4, 5.4]) mesh(new THREE.BoxGeometry(L, .9, .4), M(0xffffff, { map: wt, roughness: .8 }), XC, .45, z, sc).receiveShadow = true;
  else for (const z of [-5.25, 5.25]) mesh(new THREE.BoxGeometry(L, .12, .12), E(z < 0 ? 0xff4fd8 : 0x4ff7ff, 3), XC, .1, z, sc);
  // gantries
  const poleM = M(0x3a3f4a, { metalness: .7, roughness: .4 });
  const gantry = (x, text, col) => {
    const tx = canvasTex(512, 128, g => { g.fillStyle = '#0c0f1c'; g.fillRect(0, 0, 512, 128); g.font = '700 92px Fredoka, Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(text, 256, 68); });
    for (const z of [-5.8, 5.8]) mesh(new THREE.BoxGeometry(.3, 6.4, .3), poleM, x + .5, 3.2, z, sc);
    mesh(new THREE.BoxGeometry(.6, 1.3, 11.9), M(0x1a1f2c, { metalness: .6 }), x + .5, 6.3, 0, sc);
    for (const s of [1, -1]) { const p = mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshStandardMaterial({ map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 1.2 }), x + .5 + s * .31, 6.3, 0, sc); p.rotation.y = s * Math.PI / 2; }
  };
  gantry(0, 'START', '#ffb02e'); gantry(D, 'MÅL', '#5fff8a');
  // start lights
  const tree = new THREE.Group(); tree.position.set(1.6, 0, 0); sc.add(tree);
  mesh(new THREE.CylinderGeometry(.08, .08, 2.2, 10), poleM, 0, 1.1, 0, tree); mesh(RB(.35, 1.6, .9, .06), M(0x14171f, { metalness: .5 }), 0, 2.8, 0, tree);
  const bulbs = []; [0xffb000, 0xffb000, 0xffb000, 0x22ff55].forEach((cc, i) => { for (const z of [-.22, .22]) bulbs.push({ row: i, m: mesh(new THREE.SphereGeometry(.11, 16, 12), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: cc, emissiveIntensity: .05 }), -.18, 3.4 - i * .36, z, tree) }); });
  // lamps for night tracks
  if (night && theme !== 'rymd') {
    const lampM = E(theme === 'vulkan' ? 0xffb070 : 0xfff3d6, 4);
    for (let x = X0; x < X1; x += 16) { mesh(new THREE.CylinderGeometry(.08, .1, 7, 8), poleM, x, 3.5, -6.6, sc); mesh(new THREE.BoxGeometry(.6, .06, .4), lampM, x, 6.95, -6.2, sc); }
    const poolM = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: .06, depthWrite: false, blending: THREE.AdditiveBlending, map: dotTex() });
    scatter(sc, new THREE.CircleGeometry(3.4, 24), poolM, Math.ceil(L / 16), (o, i) => { o.position.set(X0 + i * 16, .02, -3.2); o.rotation.x = -Math.PI / 2; });
  }
  // theme props
  if (theme === 'stad') {
    const win = canvasTex(64, 128, g => { g.fillStyle = '#0d1120'; g.fillRect(0, 0, 64, 128); for (let y = 4; y < 124; y += 8) for (let x = 4; x < 60; x += 8) if (Math.random() < .4) { g.fillStyle = Math.random() < .7 ? '#ffd98a' : '#9fd0ff'; g.fillRect(x, y, 4, 4); } });
    const bm = new THREE.MeshStandardMaterial({ color: 0x0d1120, map: win, emissive: 0xffffff, emissiveMap: win, emissiveIntensity: .9 });
    scatter(sc, new THREE.BoxGeometry(1, 1, 1), bm, 140, (o) => { const h = 10 + Math.random() * 40, w = 6 + Math.random() * 10; o.position.set(X0 + Math.random() * L, h / 2, side() * (30 + Math.random() * 50)); o.scale.set(w, h, 8); });
    const crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.13, .25, 4, 8), M(0xffffff, { roughness: .8 }), 500), o = new THREE.Object3D(), c = new THREE.Color(), pal = [0xff7a1a, 0x2f86ff, 0xf2f2f2, 0xffc400, 0xe2402a, 0x8a5cff];
    for (let i = 0; i < 500; i++) { const row = i % 5; o.position.set(-25 + Math.random() * 50, 1 + row * .6, -10 - row * 1.1); o.updateMatrix(); crowd.setMatrixAt(i, o.matrix); crowd.setColorAt(i, c.set(pal[i % pal.length]).multiplyScalar(.2 + Math.random() * .2)); }
    sc.add(crowd); for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(56, .5, 1.2), M(0x2a2f3a, { roughness: .8 }), 0, .55 + i * .6, -10 - i * 1.1, sc);
    const stars = makeMotes(sc, 400, [X0, X1, 40, 120, -200, -120], 0xcfd8ff, .9, { speed: 0 });
  }
  if (theme === 'oken') {
    mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshBasicMaterial({ color: 0xffe2a0, fog: false }), X1 + 200, 30, -60, sc).lookAt(0, 20, 0);
    const mesaM = M(0xb8582e, { roughness: 1, flatShading: true });
    scatter(sc, new THREE.CylinderGeometry(1, 1.3, 1, 7), mesaM, 26, o => { const h = 14 + Math.random() * 26, w = 12 + Math.random() * 20; o.position.set(X0 + Math.random() * (L + 200), h / 2, side() * (70 + Math.random() * 90)); o.scale.set(w, h, w * .7); o.rotation.y = Math.random() * 3; });
    const cactM = M(0x3f8a3a, { roughness: .8 });
    scatter(sc, new THREE.CapsuleGeometry(.35, 3, 4, 8), cactM, 90, o => { o.position.set(X0 + Math.random() * L, 1.8, side() * (9 + Math.random() * 30)); });
    scatter(sc, new THREE.CapsuleGeometry(.22, 1.2, 4, 8), cactM, 90, o => { o.position.set(X0 + Math.random() * L, 2.2, side() * (9 + Math.random() * 30)); o.position.x += .6; o.rotation.z = -.6; });
    scatter(sc, new THREE.DodecahedronGeometry(1, 0), M(0xa86a3e, { roughness: 1, flatShading: true }), 80, o => { const s = .4 + Math.random() * 1.4; o.position.set(X0 + Math.random() * L, s * .3, side() * (8 + Math.random() * 40)); o.scale.setScalar(s); });
    fx = makeMotes(sc, 200, [X0, X1, .2, 5, -20, 20], 0xffd9a0, .12, { speed: .4, opacity: .5 });
  }
  if (theme === 'kust') {
    const sea = mesh(new THREE.PlaneGeometry(L + 600, 500, 1, 1), M(0x1a8fd0, { roughness: .15, metalness: .2 }), XC, -.4, -260, sc); sea.rotation.x = -Math.PI / 2;
    mesh(new THREE.PlaneGeometry(L + 600, 12), M(0x5fe0d6, { roughness: .3 }), XC, -.35, -14, sc).rotation.x = -Math.PI / 2;
    const cliffM = M(0x8a7a66, { roughness: 1, flatShading: true });
    scatter(sc, new THREE.DodecahedronGeometry(1, 0), cliffM, 40, o => { const s = 10 + Math.random() * 20; o.position.set(X0 + Math.random() * (L + 300), s * .4, 40 + Math.random() * 60); o.scale.set(s, s * (1 + Math.random()), s); });
    const trunkM = M(0x8b5a2b, { roughness: .9 }), leafM = M(0x2fa84a, { roughness: .6, side: THREE.DoubleSide });
    const palms = Array.from({ length: 50 }, () => [X0 + Math.random() * L, side() > 0 ? 9 + Math.random() * 20 : -(9 + Math.random() * 5), 4 + Math.random() * 3]);
    scatter(sc, new THREE.CylinderGeometry(.16, .26, 1, 8), trunkM, palms.length, (o, i) => { const [x, z, h] = palms[i]; o.position.set(x, h / 2, z); o.scale.set(1, h, 1); o.rotation.z = .12; });
    scatter(sc, new THREE.SphereGeometry(1, 10, 6), leafM, palms.length * 6, (o, i) => { const [x, z, h] = palms[Math.floor(i / 6)], a = (i % 6) / 6 * Math.PI * 2; o.position.set(x - h * .06 + Math.cos(a) * 1.2, h - .1, z + Math.sin(a) * 1.2); o.scale.set(1.6, .07, .38); o.rotation.y = -a; o.rotation.z = -.35; });
    const cloudM = M(0xffffff, { roughness: 1, emissive: 0xffffff, emissiveIntensity: .3 });
    scatter(sc, new THREE.SphereGeometry(1, 12, 8), cloudM, 60, o => { o.position.set(X0 + Math.random() * (L + 400), 40 + Math.random() * 20, -150 - Math.random() * 120); o.scale.set(8 + Math.random() * 10, 3 + Math.random() * 3, 5); });
  }
  if (theme === 'sno') {
    const pineM = M(0x1f5a3a, { roughness: .9, flatShading: true }), snowM = M(0xffffff, { roughness: .8, flatShading: true });
    const pines = Array.from({ length: 160 }, () => [X0 + Math.random() * L, side() * (9 + Math.random() * 45), 3 + Math.random() * 4]);
    scatter(sc, new THREE.ConeGeometry(1, 1, 8), pineM, pines.length * 2, (o, i) => { const [x, z, h] = pines[i >> 1], k = i & 1; o.position.set(x, h * (.35 + k * .35), z); o.scale.set(h * (.42 - k * .14), h * .6, h * (.42 - k * .14)); });
    scatter(sc, new THREE.ConeGeometry(1, 1, 8), snowM, pines.length, (o, i) => { const [x, z, h] = pines[i]; o.position.set(x, h * .95, z); o.scale.set(h * .14, h * .25, h * .14); });
    scatter(sc, new THREE.ConeGeometry(1, 1, 6), M(0xdfe8f2, { roughness: 1, flatShading: true }), 30, o => { const s = 60 + Math.random() * 70; o.position.set(X0 + Math.random() * (L + 300), s * .45, side() * (160 + Math.random() * 100)); o.scale.set(s, s, s); });
    fx = makeMotes(sc, 700, [X0, X1, 0, 18, -30, 30], 0xffffff, .18, { fall: true, speed: 1.6, opacity: .9, additive: false });
  }
  if (theme === 'vulkan') {
    const lavaM = E(0xff5a1a, 2.2);
    for (const z of [-9, 9]) mesh(new THREE.PlaneGeometry(L, 3), lavaM, XC, .02, z, sc).rotation.x = -Math.PI / 2;
    scatter(sc, new THREE.DodecahedronGeometry(1, 0), M(0x2a2222, { roughness: 1, flatShading: true }), 140, o => { const s = .6 + Math.random() * 3; o.position.set(X0 + Math.random() * L, s * .3, side() * (12 + Math.random() * 40)); o.scale.setScalar(s); o.rotation.set(Math.random(), Math.random(), 0); });
    const volc = mesh(new THREE.ConeGeometry(120, 140, 24, 1, true), M(0x2a1a18, { roughness: 1, flatShading: true }), D + 260, 50, -220, sc);
    mesh(new THREE.CircleGeometry(24, 24), E(0xff7a1a, 4), D + 260, 119, -220, sc).rotation.x = -Math.PI / 2;
    const vl = new THREE.PointLight(0xff6a2a, 4000, 400, 1.6); vl.position.set(D + 260, 130, -200); sc.add(vl);
    fx = makeMotes(sc, 300, [X0, X1, 0, 14, -25, 25], 0xff8a3c, .2, { speed: 1.2 });
  }
  if (theme === 'rymd') {
    makeMotes(sc, 900, [X0 - 200, X1 + 200, -150, 200, -300, 300], 0xffffff, .9, { speed: 0 });
    const planet = mesh(new THREE.SphereGeometry(60, 48, 32), M(0x6a4cff, { roughness: .7, emissive: 0x2a1060, emissiveIntensity: .6 }), D + 120, 60, -240, sc);
    const pr = mesh(new THREE.RingGeometry(80, 110, 64), new THREE.MeshBasicMaterial({ color: 0xc8a8ff, side: THREE.DoubleSide, transparent: true, opacity: .5 }), D + 120, 60, -240, sc); pr.rotation.x = 1.2;
    const grid = canvasTex(64, 64, g => { g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#6a3cff'; g.lineWidth = 2; g.strokeRect(0, 0, 64, 64); }, { repeat: [(L + 600) / 8, 60] });
    const gp = mesh(new THREE.PlaneGeometry(L + 600, 480), new THREE.MeshBasicMaterial({ map: grid, transparent: true, opacity: .5, blending: THREE.AdditiveBlending }), XC, -30, 0, sc); gp.rotation.x = -Math.PI / 2;
    for (let x = 40; x < X1; x += 45) { const r = mesh(new THREE.TorusGeometry(7.5, .14, 8, 64), E(x % 90 ? 0x4ff7ff : 0xff4fd8, 3), x, 2, 0, sc); r.rotation.y = Math.PI / 2; }
    scatter(sc, new THREE.DodecahedronGeometry(1, 0), M(0x5a5470, { roughness: .9, flatShading: true }), 80, o => { const s = 1 + Math.random() * 4; o.position.set(X0 + Math.random() * L, -10 + Math.random() * 40, side() * (20 + Math.random() * 70)); o.scale.setScalar(s); o.rotation.set(Math.random() * 3, Math.random() * 3, 0); });
  }
  return { sc, sun, bulbs, fx };
}

/* ================= race ================= */
function startRace(rivalId) {
  const me = carById(S.drag.car), rv = carById(rivalId), ti = S.drag.track;
  const tr = buildTrack(ti); view.setScene(tr.sc);
  const P = makeCar(me.m, S.drag.paint[me.id]), Q = makeCar(rv.m);
  P.position.set(-2.35, 0, 1.9); Q.position.set(-2.35, 0, -1.9); tr.sc.add(P, Q);
  const pp = physics(me), qp = physics(rv), sc = rivalScale(pp, qp); qp.a0 *= sc; qp.vmax *= sc;
  const smoke = makeSparks(tr.sc, 300, 1.2, { gravity: -.5, additive: false });
  smoke.points.material.opacity = .35;
  R = { phase: 'intro', t: 0, ts: 1, tsTarget: 1, go: 0, k: 0, firsts: 0, ti, me, rv, P, Q, tr, smoke,
    tank: [], tankT: 0, p: { x: 0, v: 0, a: 0, ...pp, s: 0, s0: 0, sT: -9, fin: 0 }, q: { x: 0, v: 0, a: 0, ...qp, s: 0, sT: -9, fin: 0 }, marks: [.3, .65], done: false };
  engine = engineSound();
  hud.innerHTML = `
    <div class="hud-top">
      <button class="round" id="r-home" aria-label="Till garaget">${ICON.home}</button>
      <div class="race-bar"><span class="rb-flag">${ICON.flag}</span><i class="rb-me" id="rb-me" style="--c:${hex(me.m.paint)}"></i><i class="rb-rv" id="rb-rv" style="--c:${hex(rv.m.paint)}"></i></div>
      <div class="chip" data-batt><b class="batt"><i></i></b><span></span></div>
    </div>
    <div class="r-names"><span style="--c:${hex(me.m.paint)}">${me.name}</span><span style="--c:${hex(rv.m.paint)}">${known(rv.id) ? rv.name : '???'}</span></div>
    <div class="gauge"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="7" stroke-dasharray="207 400" stroke-linecap="round"/><circle id="g-arc" cx="50" cy="50" r="44" fill="none" stroke="#ff8a1f" stroke-width="7" stroke-dasharray="0 400" stroke-linecap="round"/></svg><div><b id="g-kmh">0</b><span>KM/H</span></div></div>
    <div class="r-time" id="r-time"></div>
    <button class="gas" id="r-gas" aria-label="Gas"><span>GAS</span></button>
    <button class="nitro" id="r-nitro" aria-label="Nitro"><span>NITRO</span><b id="r-tank">0</b></button>
    <div class="gas-hint nitro-hint" id="r-nitrohint">Tryck på NITRO!</div>
    <div class="gas-hint" id="r-gashint">Håll inne GAS!</div>
    <div class="result" id="r-result"></div>`;
  api.refreshBattery();
  $('#r-home').onclick = () => { cancelAsk(); showGarage(); };
  const gas = $('#r-gas'), on = e => { e.preventDefault(); if (R) R.gas = true; gas.classList.add('down'); }, off = () => { if (R) R.gas = false; gas.classList.remove('down'); };
  gas.addEventListener('pointerdown', on); gas.addEventListener('pointerup', off); gas.addEventListener('pointercancel', off); gas.addEventListener('pointerleave', off);
  const nb = $('#r-nitro'); nb.addEventListener('pointerdown', e => { e.preventDefault(); fireNitro(); });
  R.keyDown = e => { if ((e.code === 'Space' || e.code === 'ArrowUp') && !e.repeat) { R.gas = true; gas.classList.add('down'); e.preventDefault(); } if ((e.code === 'KeyN' || e.code === 'ArrowRight') && !e.repeat) fireNitro(); };
  R.keyUp = e => { if (e.code === 'Space' || e.code === 'ArrowUp') off(); };
  window.addEventListener('keydown', R.keyDown); window.addEventListener('keyup', R.keyUp);
  setLoop(raceLoop);
}
function addNitro(strength) {
  if (!R) return; R.tank.push(strength); R.tankT = 0; R.saidNitro = false; drawTank();
}
function drawTank() { const b = $('#r-nitro'), c = $('#r-tank'); if (!b || !R) return; c.textContent = R.tank.length; b.classList.toggle('ready', R.tank.length > 0); }
function fireNitro() {
  const r = R; if (!r || !r.tank.length || r.p.fin || !(r.phase === 'go' || r.phase === 'end')) return;
  if (r.p.s > 0 && r.go - r.p.sT < NITRO.dur) return;
  r.p.s = r.tank.shift(); r.p.sT = r.go; r.tankT = 0; sfx.whoosh(); drawTank();
  const b = $('#r-nitro'); if (b) { b.classList.remove('fire'); void b.offsetWidth; b.classList.add('fire'); }
}
function nitroFrom(res) { return res.wrongs === 0 ? 1 : res.wrongs === 1 ? .6 : .25; }
function rivalNitro(res) { return res.wrongs === 0 ? 0 : res.wrongs === 1 ? .5 : 1; }
// Rival speed is set from the player's own car: a perfect run (gas held, three first-try answers) beats it by a
// margin that shrinks the faster the rival's real car is. A better car of your own therefore makes races easier.
function simET(a0, vmax, nit) {
  let v = 0, x = 0, t = 0, k = 0, ns = 0, nt = -9; const dt = .01, m = [0, .3 * D, .65 * D];
  while (x < D && t < 60) { if (k < 3 && x >= m[k]) { ns = nit[k]; nt = t; k++; } const on = t - nt < NITRO.dur ? ns : 0, vm = vmax * (1 + NITRO.top * on); v += a0 * (1 + (NITRO.boost - 1) * on) * Math.max(0, 1 - (v / vm) ** 2) * dt; x += v * dt; t += dt; }
  return t;
}
function rivalScale(pp, qp) {
  const p0 = simET(pp.a0, pp.vmax, [0, 0, 0]), q0 = simET(qp.a0, qp.vmax, [0, 0, 0]), gap = (p0 - q0) / p0;
  const margin = Math.min(.07, Math.max(.015, .07 - .35 * gap)), target = simET(pp.a0, pp.vmax, [1, 1, 1]) * (1 + margin);
  let lo = .2, hi = 3; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; simET(qp.a0 * mid, qp.vmax * mid, [0, 0, 0]) > target ? lo = mid : hi = mid; }
  return (lo + hi) / 2;
}
function setLights(n) { R.tr.bulbs.forEach(b => b.m.material.emissiveIntensity = (b.row < 3 && b.row < n) || (b.row === 3 && n >= 4) ? 5 : .05); }
const cam = () => view.camera;
function raceLoop(dt, t) {
  if (!view || !R) return;
  const r = R, c = cam();
  r.ts = lerp(r.ts, r.tsTarget, Math.min(1, dt * 6));
  const gdt = dt * r.ts;
  if (r.phase === 'intro') {
    r.t += dt; const k = ease(clamp01(r.t / 2.4));
    c.position.set(lerp(9, -8.5, k), lerp(1.4, 2.6, k), lerp(8, 6.6, k)); c.lookAt(lerp(-1, 6, k), .7, lerp(0, -.5, k)); c.fov = 42; c.updateProjectionMatrix();
    setLights(Math.floor(t * 2) % 2 ? 0 : 1);
    engine.set(.18 + Math.sin(t * 9) * .02, .1);
    if (r.t > 2.4) { r.phase = 'q0'; setLights(0); ask({ title: 'Start', accent: TRACKS[r.ti].color, place: 'race' }).then(res => { if (!R) return; addNitro(nitroFrom(res)); r.q.s0 = rivalNitro(res); if (!res.wrongs) r.firsts++; r.phase = 'count'; r.t = 0; if ((S.drag.gasTut || 0) < 4) { S.drag.gasTut = (S.drag.gasTut || 0) + 1; say('Håll inne gas-knappen!'); } }); }
  } else if (r.phase === 'q0') {
    engine.set(.2 + Math.sin(t * 7) * .05, .15);
    const hint0 = $('#r-gashint'); if (hint0) hint0.classList.remove('on');
  } else if (r.phase === 'count') {
    const h = $('#r-gashint'); if (h) h.classList.toggle('on', !r.gas);
    const before = Math.floor(r.t / .4); r.t += dt; const n = Math.floor(r.t / .4);
    if (n !== before && n <= 3) { sfx.beep(n === 3); }
    setLights(Math.min(3, n) + (n >= 3 ? 1 : 0));
    engine.set(.45 + Math.random() * .05, .5);
    if (n >= 3) { r.phase = 'go'; r.go = 0; r.tankT = 0; r.q.s = r.q.s0 || 0; r.q.sT = 0; sfx.whoosh(); say('Kör!'); }
  } else if (r.phase === 'go' || r.phase === 'q' || r.phase === 'end') {
    r.go += gdt;
    r.thr = lerp(r.thr || 0, r.gas || r.p.fin ? 1 : 0, Math.min(1, dt * 8));
    drive(r.p, gdt, r.go, r.thr); drive(r.q, gdt, r.go, 1);
    const hint = $('#r-gashint'); if (hint) hint.classList.toggle('on', r.phase === 'go' && !r.gas && !r.p.fin);
    if (r.phase === 'go' && r.tank.length && !r.p.fin) { r.tankT += dt; } else r.tankT = 0;
    const nh = $('#r-nitrohint'); if (nh) nh.classList.toggle('on', r.tankT > 2);
    if (r.tankT > 2 && !r.saidNitro && (S.drag.nitroTut || 0) < 4) { r.saidNitro = true; S.drag.nitroTut = (S.drag.nitroTut || 0) + 1; say('Tryck på nitro!'); }
    if (r.phase === 'go' && r.k < 2 && r.p.x >= D * r.marks[r.k]) {
      r.phase = 'q'; r.tsTarget = .03; r.k++;
      ask({ title: 'Nitro', accent: TRACKS[r.ti].color, place: 'race' }).then(res => { if (!R) return; addNitro(nitroFrom(res)); const rn = rivalNitro(res); if (rn) { r.q.s = rn; r.q.sT = r.go; } if (!res.wrongs) r.firsts++; r.phase = 'go'; r.tsTarget = 1; });
    }
    if (!r.p.fin && r.p.x >= D) r.p.fin = r.go;
    if (!r.q.fin && r.q.x >= D) r.q.fin = r.go;
    if (r.phase === 'go' && (r.p.fin || r.q.fin)) { r.phase = 'end'; r.endT = 0; if (r.p.fin && !r.q.fin) { r.tsTarget = .35; } }
    if (r.phase === 'end') { r.endT += dt; if (r.endT > .9) r.tsTarget = 1; if (r.p.fin && r.q.fin && !r.done && r.endT > 1.4) { r.done = true; finish(); } }
    // visuals
    const kmh = Math.round(r.p.v * 3.6); $('#g-kmh').textContent = kmh; $('#g-arc').setAttribute('stroke-dasharray', `${Math.min(207, kmh / 420 * 207)} 400`);
    $('#rb-me').style.left = Math.min(100, r.p.x / D * 100) + '%'; $('#rb-rv').style.left = Math.min(100, r.q.x / D * 100) + '%';
    $('#r-time').textContent = r.p.fin ? `${dec(r.p.fin.toFixed(2))} s` : `${dec(r.go.toFixed(1))} s`;
    const frac = (r.p.v / r.p.vmax * 5) % 1; engine.set(.25 + frac * .65 * (.4 + .6 * r.thr), r.p.fin ? .1 : .2 + .6 * r.thr);
  }
  // place cars
  for (const [car, s, z] of [[r.P, r.p, 1.9], [r.Q, r.q, -1.9]]) {
    car.position.x = s.x - 2.35;
    car.userData.wheels.forEach(w => w.spin.rotation.z -= w.dir * s.v * gdt / .4);
    const on = s.s > 0 && r.go - s.sT < NITRO.dur && !s.fin;
    car.userData.flames.forEach(f => { f.visible = on; if (on) f.scale.set(1, .7 + Math.random() * .5, 1); });
    car.userData.body.rotation.z = lerp(car.userData.body.rotation.z, (r.phase === 'go' || r.phase === 'q') && !s.fin ? Math.min(.035, s.a * .003) : 0, Math.min(1, dt * 4));
    car.userData.body.position.y = r.phase === 'intro' || r.phase === 'q0' || r.phase === 'count' ? Math.sin(t * 40 + z) * .004 : 0;
    if (r.go < 1.4 && s.v > 1 && !CALM && Math.random() < .5) r.smoke.burst(new THREE.Vector3(s.x - 2.35 + (car === r.P ? -1.45 : -1.45), .25, z + (z > 0 ? .9 : -.9)), 1, 1.2, [0x8a8f9a, 0x6a6f7a], .4);
  }
  // camera
  if (r.phase !== 'intro') {
    if (r.p.fin && r.phase === 'end') { c.position.lerp(new THREE.Vector3(D + 6, 2.2, 10), Math.min(1, dt * 2)); c.lookAt(D - 2, .8, 0); }
    else {
      const sp = r.p.v / r.p.vmax, px = r.P.position.x;
      const ty = 2.5 - sp * .3; c.position.set(px - 8.2 - sp * 1.5, lerp(c.position.y, ty, Math.min(1, dt * 4)), lerp(c.position.z, 6.4, Math.min(1, dt * 4)));
      c.lookAt(px + 6, .7, -.4);
      const fov = 42 + sp * 12 + (r.p.s > .5 && r.go - r.p.sT < NITRO.dur ? 4 : 0);
      c.fov = lerp(c.fov, fov, Math.min(1, dt * 3)); c.updateProjectionMatrix();
    }
  }
  const sx = r.P.position.x; r.tr.sun.position.set(sx + 30, 40, 25); r.tr.sun.target.position.set(sx + 4, 0, 0);
  r.tr.fx.update && r.tr.fx.update(dt); r.smoke.update(dt);
  view.render();
}
function drive(s, dt, go, thr = 1) {
  if (s.fin && go - s.fin > .2) { s.v = Math.max(0, s.v - 22 * dt); s.x += s.v * dt; s.a = 0; return; }
  const on = s.s > 0 && go - s.sT < NITRO.dur, k = on ? s.s : 0;
  const vm = s.vmax * (1 + NITRO.top * k);
  s.a = s.a0 * thr * (1 + (NITRO.boost - 1) * k) * Math.max(0, 1 - (s.v / vm) ** 2) - (1 - thr) * (1.5 + s.v * .03);
  s.v = Math.max(0, s.v + s.a * dt); s.x += s.v * dt;
}
function finish() {
  const r = R, win = r.p.fin <= r.q.fin;
  S.drag.rw = S.drag.rw || {};
  if (win && !beaten(r.rv.id)) S.drag.rw[r.rv.id] = (S.drag.rw[r.rv.id] || 0) + 1;
  const wins = S.drag.rw[r.rv.id] || 0, first = win && !beaten(r.rv.id) && wins >= 2, halfway = win && !beaten(r.rv.id) && wins < 2;
  const coins = win ? 50 + 15 * r.ti + 5 * r.firsts : 15 + 3 * r.firsts;
  const wasOpen = TRACKS.map((_, i) => trackOpen(i));
  S.drag.coins += coins; if (first) S.drag.beaten.push(r.rv.id);
  const newTrack = TRACKS.findIndex((_, i) => trackOpen(i) && !wasOpen[i]);
  save();
  if (win) { sfx.win(); say(first ? `Du vann! Nytt bilkort: ${r.rv.name}.` : halfway ? 'Du vann! Vinn en gång till för bilkortet.' : 'Du vann!'); } else { sfx.thud(); say('Nästan! Försök igen.'); }
  const el = $('#r-result');
  el.innerHTML = `<div class="res-card">
    <h2>${win ? 'Du vann!' : 'Nästan!'}</h2>
    <div class="res-times"><span>Din tid <b>${dec(r.p.fin.toFixed(2))} s</b></span><span>${known(r.rv.id) ? r.rv.name.split(' ')[0] : 'Motståndaren'} <b>${dec(r.q.fin.toFixed(2))} s</b></span></div>
    <div class="res-coins">${coinIcon()} +${coins}</div>
    ${halfway ? `<p class="res-track">${wins} av 2 vinster mot ${known(r.rv.id) ? r.rv.name : 'bilen'}. Vinn en gång till för bilkortet!</p>` : ''}
    ${first ? `<div class="res-new"><span>Nytt bilkort</span>${cardHTML(r.rv, { small: true })}<span class="res-sub">Nu kan du köpa den i garaget.</span></div>` : ''}
    ${!win ? `<p class="res-sub">Håll inne GAS hela vägen. Rätt svar på första försöket ger nitro, fel svar ger motståndaren nitro.</p>` : ''}
    ${newTrack > 0 ? `<p class="res-track">Ny bana: <b>${TRACKS[newTrack].name}</b></p>` : ''}
    <div class="res-btns"><button class="pill" id="res-garage">Garaget</button>${win ? `<button class="pill strong" id="res-next">${ICON.play}<span>Nästa lopp</span></button>` : `<button class="pill strong" id="res-again">${ICON.again}<span>Kör igen</span></button>`}</div></div>`;
  el.classList.add('on'); wireSpeak(el);
  if (newTrack > 0) setTimeout(() => { sfx.unlock(); say(`Ny bana: ${TRACKS[newTrack].name}`); }, 1800);
  const rid = r.rv.id;
  $('#res-garage').onclick = () => showGarage();
  const ra = $('#res-again'), rn = $('#res-next');
  if (ra) ra.onclick = () => { if (engine) { engine.stop(); engine = null; } startRace(rid); };
  if (rn) rn.onclick = () => { if (engine) { engine.stop(); engine = null; } showGarage(); startNext(); };
}

/* ================= home-screen picture ================= */
export function previewScene(v) {
  const ti = lastOpen();
  const tr = buildTrack(ti, v.envTex), me = carById(S.drag.car);
  const car = makeCar(me.m, S.drag.paint[me.id]); car.position.set(-4.2, 0, 1.4); car.rotation.y = .32; tr.sc.add(car);
  const rv = makeCar(carById(TRACKS[ti].rivals[0]).m); rv.position.set(-9, 0, -1.9); tr.sc.add(rv);
  tr.bulbs.forEach(b => b.m.material.emissiveIntensity = b.row < 3 ? 5 : .05);
  tr.sun.position.set(10, 30, 25); tr.sun.target.position.set(-4, 0, 0);
  const fill = new THREE.PointLight(0xffffff, 6, 12, 1.5); fill.position.set(-1, 2.5, 5); tr.sc.add(fill); if (tr.sc.fog) { tr.sc.fog.near = 30; }
  return { scene: tr.sc, camera(c) { c.fov = 44; c.position.set(2.6, 1.15, 4.7); c.lookAt(-5.4, .5, .3); c.updateProjectionMatrix(); } };
}
