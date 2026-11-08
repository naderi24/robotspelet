// Blocky creatures for Blockgruvan. Each model faces +x, stands on y = 0 and is under one block tall.
import { THREE, M, E, shadows } from './core.js';

export const ANIMALS = {
  ko: { n: 'Ko', say: 'En ko!', food: 1, lader: 1 },
  gris: { n: 'Gris', say: 'En gris!', food: 1 },
  hona: { n: 'Höna', say: 'En höna!', food: 1 },
};
// hp = how many sword hits it takes
export const MOBS = {
  zombie: { n: 'Zombie', say: 'En zombie!', hp: 3 },
  skelett: { n: 'Skelett', say: 'Ett skelett!', hp: 2 },
  slem: { n: 'Grottslem', say: 'Ett grottslem!', hp: 2 },
  spokbot: { n: 'Spökbot', say: 'En spökbot!', hp: 4 },
};

export function makeCreature(kind) {
  const g = new THREE.Group(), mats = {};
  const mat = (c, o) => mats[c + (o ? 'e' : '')] || (mats[c + (o ? 'e' : '')] = o ? E(c, 2.5) : M(c, { roughness: .85 }));
  const b = (w, h, d, c, x, y, z, glow) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, glow)); m.position.set(x, y, z); g.add(m); return m; };
  const legs = (c, w, h, dx, dz) => [[-dx, -dz], [-dx, dz], [dx, -dz], [dx, dz]].map(([x, z]) => b(w, h, w, c, x, h / 2, z));
  let bob = null;
  if (kind === 'ko') {
    legs(0x2a2a2a, .1, .28, .26, .13);
    b(.78, .4, .42, 0xf4f1ea, 0, .48, 0); b(.26, .22, .44, 0x26262a, -.14, .56, 0); b(.16, .16, .44, 0x26262a, .2, .42, 0);
    b(.26, .26, .3, 0xf4f1ea, .5, .62, 0); b(.08, .14, .24, 0xf2b8b0, .66, .56, 0);
    for (const z of [-.08, .08]) b(.02, .05, .05, 0x111111, .64, .68, z);
    for (const z of [-.13, .13]) b(.05, .09, .05, 0xe8e0c8, .44, .8, z);
  } else if (kind === 'gris') {
    legs(0xe98aa0, .1, .22, .22, .12);
    b(.66, .34, .38, 0xf4a8b8, 0, .38, 0); b(.26, .26, .3, 0xf4a8b8, .44, .48, 0); b(.07, .12, .16, 0xe0889c, .59, .44, 0);
    for (const z of [-.07, .07]) b(.02, .05, .05, 0x111111, .58, .54, z);
    for (const z of [-.1, .1]) b(.06, .06, .04, 0xe98aa0, .4, .63, z);
  } else if (kind === 'hona') {
    for (const z of [-.05, .05]) b(.03, .14, .03, 0xffc020, 0, .07, z);
    b(.3, .24, .22, 0xffffff, 0, .26, 0); b(.16, .2, .16, 0xffffff, .15, .44, 0);
    b(.07, .05, .06, 0xffb020, .26, .44, 0); b(.04, .07, .05, 0xe8302a, .22, .38, 0); b(.1, .05, .04, 0xe8302a, .14, .56, 0);
    b(.12, .14, .02, 0xeeeeee, -.02, .27, .12); b(.12, .14, .02, 0xeeeeee, -.02, .27, -.12);
  } else if (kind === 'zombie') {
    for (const z of [-.08, .08]) b(.13, .36, .13, 0x3a4fa8, 0, .18, z);
    b(.2, .34, .34, 0x2aa6a6, 0, .53, 0);
    for (const z of [-.2, .2]) b(.36, .11, .11, 0x6aa84f, .16, .64, z);
    b(.28, .28, .28, 0x6aa84f, 0, .84, 0);
    for (const z of [-.06, .06]) b(.02, .05, .05, 0x1a2a10, .145, .86, z);
  } else if (kind === 'skelett') {
    const bone = 0xe6e3d8;
    for (const z of [-.07, .07]) b(.07, .38, .07, bone, 0, .19, z);
    b(.12, .08, .26, bone, 0, .4, 0); b(.06, .28, .06, bone, 0, .56, 0);
    for (let i = 0; i < 3; i++) b(.14, .03, .24, bone, 0, .48 + i * .07, 0);
    for (const z of [-.15, .15]) b(.07, .3, .07, bone, .04, .56, z);
    b(.26, .26, .26, bone, 0, .82, 0);
    for (const z of [-.06, .06]) b(.02, .07, .07, 0x111111, .135, .84, z);
    b(.02, .03, .12, 0x111111, .135, .74, 0);
  } else if (kind === 'slem') {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(.32, 18, 12), new THREE.MeshStandardMaterial({ color: 0x5fd06a, roughness: .2, transparent: true, opacity: .8, emissive: 0x1a5020, emissiveIntensity: .6 }));
    blob.scale.set(1.1, .78, .9); blob.position.y = .26; g.add(blob); bob = blob;
    for (const z of [-.09, .09]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), mat(0x102010)); e.position.set(.3, .32, z); g.add(e); }
  } else if (kind === 'spokbot') {
    const body = new THREE.Group(); g.add(body); bob = body;
    const m2 = (w, h, d, c, x, y, z, glow) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, glow)); m.position.set(x, y, z); body.add(m); return m; };
    m2(.36, .36, .3, 0x3a3f4a, 0, .45, 0); m2(.3, .26, .26, 0x4a505c, 0, .76, 0);
    m2(.04, .1, .12, 0xff3030, .16, .78, 0, true); m2(.03, .14, .03, 0x8a8f99, -.05, .95, 0); m2(.06, .06, .06, 0xff3030, -.05, 1.03, 0, true);
    for (const z of [-.22, .22]) m2(.1, .26, .08, 0x2a2e38, 0, .42, z);
    m2(.2, .06, .2, 0x7fd8ff, 0, .22, 0, true);
  }
  shadows(g, true, false);
  g.userData = { kind, bob };
  return g;
}
