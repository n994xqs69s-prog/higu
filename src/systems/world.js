import * as THREE from 'three';
import { Textures, fbm, valueNoise, skyTexture } from './textures.js';

export const WORLD_SIZE = 1200;     // metros (mundo quadrado)
export const HALF = WORLD_SIZE / 2;
const SEG = 300;                    // resolução da malha do terreno

// ---------------------------------------------------------------------------
// Alturas: continente com montanhas ao norte, deserto a leste, pântano a sul,
// floresta encantada a oeste e uma cratera central (o Véu Rasgado).
// ---------------------------------------------------------------------------
export function heightAt(x, z) {
  const nx = x / WORLD_SIZE, nz = z / WORLD_SIZE;
  let h = 0;
  h += fbm(nx * 4 + 10, nz * 4 + 10, 6, 2) * 42 - 12;          // relevo base
  h += fbm(nx * 14, nz * 14, 4, 7) * 9;                         // detalhe
  // cadeia montanhosa ao norte
  const mountain = Math.max(0, (-nz - 0.12)) * 2.2;
  h += mountain * mountain * 150 * (0.55 + fbm(nx * 8, nz * 8, 4, 19) * 0.9);
  // planície central suavizada em torno da Vila
  const dCity = Math.hypot(x - 0, z - 60);
  if (dCity < 90) h = THREE.MathUtils.lerp(h, 6, 1 - dCity / 90);
  // cratera do Véu Rasgado
  const dCrater = Math.hypot(x - 260, z + 240);
  if (dCrater < 110) {
    const t = 1 - dCrater / 110;
    h -= Math.pow(t, 1.6) * 55;
  }
  // depressão do pântano ao sul
  const dSwamp = Math.hypot(x + 280, z - 300);
  if (dSwamp < 180) h = THREE.MathUtils.lerp(h, 1.2, Math.pow(1 - dSwamp / 180, 1.4));
  return h;
}

export const WATER_LEVEL = 2.0;

export function biomeAt(x, z) {
  const h = heightAt(x, z);
  if (h < WATER_LEVEL) return 'water';
  if (h > 62) return 'snow';
  if (h > 38) return 'rock';
  if (x > 260 && z > -120 && z < 220) return 'desert';
  if (Math.hypot(x + 280, z - 300) < 170) return 'swamp';
  if (x < -120 && z < 120) return 'forest';
  if (Math.hypot(x - 260, z + 240) < 110) return 'veil';
  return 'plains';
}

export const BIOME_INFO = {
  plains:  { nome: 'Planícies de Ardel',     cor: '#7fae5a', mana: 1.0, desc: 'Campos de trigo-prata e ventos constantes. Magia de ar flui melhor aqui.' },
  forest:  { nome: 'Mata do Sussurro',       cor: '#2f6b3a', mana: 1.3, desc: 'Árvores milenares. Mana vegetal abundante; fogo se espalha rápido.' },
  desert:  { nome: 'Areias de Kharun',       cor: '#d8c187', mana: 0.7, desc: 'Calor extremo drena estamina. Magia de fogo amplificada, de água penalizada.' },
  swamp:   { nome: 'Pântano de Mir',         cor: '#4b5f3c', mana: 1.1, desc: 'Água estagnada conduz raios com brutalidade. Veneno no ar.' },
  rock:    { nome: 'Escarpas de Vhorn',      cor: '#8b8b92', mana: 0.9, desc: 'Rocha densa: magia de terra ganha massa; quedas são letais.' },
  snow:    { nome: 'Coroa Gélida',           cor: '#e8f0ff', mana: 1.2, desc: 'Frio corta estamina. Gelo praticamente gratuito.' },
  veil:    { nome: 'O Véu Rasgado',          cor: '#8a5cd8', mana: 1.8, desc: 'A realidade é fina. Mana dobrada, mas magia falha de formas imprevisíveis.' },
  water:   { nome: 'Águas',                  cor: '#3b6ea5', mana: 1.0, desc: 'Condutora. Raio em água atinge tudo em volta — inclusive você.' },
};

// ---------------------------------------------------------------------------
export function buildWorld(scene) {
  const colliders = [];   // {type:'box'|'sphere', ...} para física
  const interactables = [];

  // --- Céu + luz --------------------------------------------------------
  scene.background = skyTexture();
  scene.fog = new THREE.FogExp2(0x9fb6da, 0.0022);

  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x44502f, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.55);
  sun.position.set(180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const d = 220;
  sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
  sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  // --- Terreno ----------------------------------------------------------
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const b = biomeAt(x, z);
    c.set(BIOME_INFO[b === 'water' ? 'plains' : b].cor);
    const shade = 0.82 + valueNoise(x * 0.08, z * 0.08, 5) * 0.36;
    c.multiplyScalar(shade);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.96, metalness: 0.0,
    map: Textures.get('grass', 180),
  }));
  terrain.receiveShadow = true;
  terrain.name = 'terrain';
  scene.add(terrain);

  // --- Água -------------------------------------------------------------
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x2e6ea8, transparent: true, opacity: 0.72,
      roughness: 0.12, metalness: 0.35,
    })
  );
  water.position.y = WATER_LEVEL;
  water.name = 'water';
  scene.add(water);

  // --- Vegetação (instanciada) -----------------------------------------
  addForest(scene, colliders);
  addRocks(scene, colliders);
  addCrystals(scene, colliders);

  // --- Estruturas -------------------------------------------------------
  const village = buildVillage(scene, colliders, interactables);
  buildRuins(scene, colliders, interactables);
  buildVeilTower(scene, colliders, interactables);

  return { terrain, water, sun, colliders, interactables, village };
}

function addForest(scene, colliders) {
  const trunkGeo = new THREE.CylinderGeometry(0.42, 0.72, 8, 6);
  const leafGeo = new THREE.IcosahedronGeometry(3.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ map: Textures.get('bark', 2), roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ map: Textures.get('leaf', 1), roughness: 0.9, flatShading: true });

  const spots = [];
  for (let i = 0; i < 2600; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.95;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.95;
    const b = biomeAt(x, z);
    const density = b === 'forest' ? 0.95 : b === 'plains' ? 0.13 : b === 'swamp' ? 0.4 : 0;
    if (Math.random() > density) continue;
    if (Math.hypot(x, z - 60) < 75) continue;   // fora da vila
    spots.push([x, heightAt(x, z), z, 0.7 + Math.random() * 0.9]);
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, spots.length);
  trunks.castShadow = leaves.castShadow = true;
  leaves.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  spots.forEach(([x, y, z, sc], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
    s.set(sc, sc, sc);
    m.compose(new THREE.Vector3(x, y + 4 * sc, z), q, s);
    trunks.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, y + 8.6 * sc, z), q, s.clone().multiplyScalar(1.1));
    leaves.setMatrixAt(i, m);
    colliders.push({ type: 'cyl', x, z, r: 0.8 * sc, y, h: 9 * sc, tag: 'árvore' });
  });
  scene.add(trunks, leaves);
}

function addRocks(scene, colliders) {
  const geo = new THREE.DodecahedronGeometry(2, 0);
  const mat = new THREE.MeshStandardMaterial({ map: Textures.get('rock', 1), roughness: 1, flatShading: true });
  const list = [];
  for (let i = 0; i < 900; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.95;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.95;
    const b = biomeAt(x, z);
    if (b === 'water') continue;
    const density = (b === 'rock' || b === 'snow') ? 0.8 : 0.16;
    if (Math.random() > density) continue;
    if (Math.hypot(x, z - 60) < 70) continue;
    list.push([x, heightAt(x, z), z, 0.6 + Math.random() * 2.4]);
  }
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  im.castShadow = im.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  list.forEach(([x, y, z, sc], i) => {
    q.setFromEuler(new THREE.Euler(Math.random(), Math.random() * 6.28, Math.random()));
    m.compose(new THREE.Vector3(x, y + sc * 0.7, z), q, new THREE.Vector3(sc, sc * 0.8, sc));
    im.setMatrixAt(i, m);
    colliders.push({ type: 'sphere', x, y: y + sc * 0.7, z, r: sc * 1.6, tag: 'rocha' });
  });
  scene.add(im);
}

function addCrystals(scene, colliders) {
  const geo = new THREE.ConeGeometry(1.1, 6, 5);
  const mat = new THREE.MeshStandardMaterial({
    map: Textures.get('crystal', 1), emissive: 0x4488ff, emissiveIntensity: 0.7,
    transparent: true, opacity: 0.88, roughness: 0.15, metalness: 0.2, flatShading: true,
  });
  const list = [];
  for (let i = 0; i < 400; i++) {
    const a = Math.random() * 6.28, r = Math.random() * 150;
    const x = 260 + Math.cos(a) * r, z = -240 + Math.sin(a) * r;
    if (biomeAt(x, z) === 'water') continue;
    list.push([x, heightAt(x, z), z, 0.5 + Math.random() * 2]);
  }
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  im.castShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  list.forEach(([x, y, z, sc], i) => {
    q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.6, Math.random() * 6.28, (Math.random() - 0.5) * 0.6));
    m.compose(new THREE.Vector3(x, y + 2.6 * sc, z), q, new THREE.Vector3(sc, sc, sc));
    im.setMatrixAt(i, m);
    colliders.push({ type: 'sphere', x, y: y + 2 * sc, z, r: sc * 1.4, tag: 'cristal', shatter: true });
  });
  const light = new THREE.PointLight(0x6aa8ff, 60, 260, 2);
  light.position.set(260, heightAt(260, -240) + 20, -240);
  scene.add(im, light);
}

// --- Construções -----------------------------------------------------------
function house(x, z, w, d, h, rot = 0) {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ map: Textures.get('plank', 2), roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ map: Textures.get('stonebrick', 2), roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  body.position.y = h / 2; body.castShadow = body.receiveShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.82, h * 0.7, 4), roofMat);
  roof.position.y = h + h * 0.35; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.15),
    new THREE.MeshStandardMaterial({ map: Textures.get('wood', 1) }));
  door.position.set(0, 1.1, d / 2 + 0.05);
  g.add(body, roof, door);
  const y = heightAt(x, z);
  g.position.set(x, y, z); g.rotation.y = rot;
  return { group: g, collider: { type: 'box', x, y, z, hw: w / 2 + 0.2, hh: h, hd: d / 2 + 0.2, rot, tag: 'casa' } };
}

function buildVillage(scene, colliders, interactables) {
  const cx = 0, cz = 60;
  const group = new THREE.Group();
  const layout = [
    [-22, -14, 9, 8, 5], [16, -18, 10, 9, 5.5], [-26, 16, 8, 8, 4.5],
    [22, 14, 11, 9, 6], [0, -30, 14, 10, 7], [-8, 28, 9, 8, 5],
  ];
  layout.forEach(([dx, dz, w, d, h]) => {
    const { group: g, collider } = house(cx + dx, cz + dz, w, d, h, Math.random() * 0.5);
    group.add(g); colliders.push(collider);
  });

  // Praça: fonte de mana
  const fountain = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.6, 1.2, 16),
    new THREE.MeshStandardMaterial({ map: Textures.get('stonebrick', 3), roughness: 0.9 }));
  base.position.y = 0.6;
  const wat = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.3, 16),
    new THREE.MeshStandardMaterial({ color: 0x55aaff, emissive: 0x2266aa, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }));
  wat.position.y = 1.2;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4, 8),
    new THREE.MeshStandardMaterial({ map: Textures.get('runes', 1), emissive: 0x3366ff, emissiveIntensity: 0.5 }));
  pillar.position.y = 3;
  fountain.add(base, wat, pillar);
  const fy = heightAt(cx, cz);
  fountain.position.set(cx, fy, cz);
  fountain.castShadow = true;
  group.add(fountain);
  const fl = new THREE.PointLight(0x66aaff, 40, 60, 2);
  fl.position.set(cx, fy + 6, cz); group.add(fl);
  colliders.push({ type: 'cyl', x: cx, z: cz, r: 4.6, y: fy, h: 1.4, tag: 'fonte' });
  interactables.push({ id: 'fonte_mana', x: cx, z: cz, y: fy, r: 8, label: 'Fonte de Mana (E: restaurar)', kind: 'mana' });

  scene.add(group);
  return { x: cx, z: cz, y: fy };
}

function buildRuins(scene, colliders, interactables) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: Textures.get('stonebrick', 2), roughness: 1 });
  const cx = -320, cz = -180;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = cx + Math.cos(a) * 26, z = cz + Math.sin(a) * 26;
    const h = 5 + Math.random() * 9;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, h, 8), mat);
    const y = heightAt(x, z);
    p.position.set(x, y + h / 2, z); p.rotation.z = (Math.random() - 0.5) * 0.15;
    p.castShadow = p.receiveShadow = true;
    g.add(p);
    colliders.push({ type: 'cyl', x, z, r: 1.6, y, h, tag: 'pilar' });
  }
  const altar = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 6),
    new THREE.MeshStandardMaterial({ map: Textures.get('runes', 2), emissive: 0x220044, emissiveIntensity: 1 }));
  const ay = heightAt(cx, cz);
  altar.position.set(cx, ay + 0.8, cz); altar.castShadow = true;
  g.add(altar);
  interactables.push({ id: 'altar_ruinas', x: cx, z: cz, y: ay, r: 9, label: 'Altar Esquecido (E: examinar)', kind: 'altar' });
  scene.add(g);
}

function buildVeilTower(scene, colliders, interactables) {
  const cx = 260, cz = -240;
  const y = heightAt(cx, cz);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    map: Textures.get('runes', 4), emissive: 0x6622cc, emissiveIntensity: 0.9, roughness: 0.6,
  });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(7, 11, 56, 10, 1, true), mat);
  tower.position.set(cx, y + 28, cz);
  tower.castShadow = tower.receiveShadow = true;
  tower.material.side = THREE.DoubleSide;
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(6, 2),
    new THREE.MeshStandardMaterial({ color: 0xaa66ff, emissive: 0x8844ff, emissiveIntensity: 2.2, transparent: true, opacity: 0.8 }));
  orb.position.set(cx, y + 62, cz);
  orb.name = 'veilOrb';
  const light = new THREE.PointLight(0x9955ff, 400, 400, 2);
  light.position.set(cx, y + 62, cz);
  g.add(tower, orb, light);
  scene.add(g);
  colliders.push({ type: 'cyl', x: cx, z: cz, r: 9, y, h: 56, tag: 'torre' });
  interactables.push({ id: 'torre_veu', x: cx, z: cz, y, r: 16, label: 'Torre do Véu (E: entrar no ato final)', kind: 'boss' });
  return orb;
}
