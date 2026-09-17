import * as THREE from 'three';
import { heightAt, WATER_LEVEL, HALF, biomeAt } from './world.js';

// ---------------------------------------------------------------------------
// Motor físico simplificado mas *real* o bastante para que decisões táticas
// façam sentido: gravidade, massa, inércia, atrito por superfície, empuxo,
// dano de queda por energia cinética, e impulsos vetoriais dependentes de massa.
// ---------------------------------------------------------------------------

export const G = -22.0;              // gravidade (m/s²) — ligeiramente arcade
export const AR_DENSIDADE = 1.225;   // kg/m³
export const AGUA_DENSIDADE = 1000;

export class Body {
  constructor(opts = {}) {
    this.pos = opts.pos ? opts.pos.clone() : new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.massa = opts.massa ?? 80;          // kg
    this.raio = opts.raio ?? 0.45;          // m
    this.altura = opts.altura ?? 1.8;       // m
    this.grounded = false;
    this.naAgua = false;
    this.atritoBase = 8.0;
    this.restituicao = opts.restituicao ?? 0.0;
    this.voando = false;
    this.arrasto = opts.arrasto ?? 0.02;
  }

  /** Impulso em N·s — a aceleração resultante DEPENDE DA MASSA. Essa é a regra
   *  central do jogo: vento arremessa feéricos e mal move golems. */
  aplicarImpulso(v) { this.vel.addScaledVector(v, 1 / this.massa); }

  aplicarForca(v, dt) { this.vel.addScaledVector(v, dt / this.massa); }
}

/** Colisão horizontal contra colliders estáticos do mundo (cyl/box/sphere). */
export function resolverColisoes(body, colliders) {
  const p = body.pos;
  for (const c of colliders) {
    if (c.destruido) continue;
    if (c.type === 'cyl' || c.type === 'sphere') {
      const cy = c.type === 'cyl' ? c.y : c.y - c.r;
      const topo = c.type === 'cyl' ? c.y + c.h : c.y + c.r;
      if (p.y > topo || p.y + body.altura < cy) continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      const dist = Math.hypot(dx, dz) || 1e-5;
      const min = (c.r ?? 1) + body.raio;
      if (dist < min) {
        const push = (min - dist);
        p.x += (dx / dist) * push;
        p.z += (dz / dist) * push;
        const n = new THREE.Vector3(dx / dist, 0, dz / dist);
        const vn = body.vel.dot(n);
        if (vn < 0) body.vel.addScaledVector(n, -vn * (1 + body.restituicao));
      }
    } else if (c.type === 'box') {
      // AABB rotacionada em Y
      const cos = Math.cos(-c.rot || 0), sin = Math.sin(-c.rot || 0);
      const lx = (p.x - c.x) * cos - (p.z - c.z) * sin;
      const lz = (p.x - c.x) * sin + (p.z - c.z) * cos;
      if (p.y > c.y + c.hh || p.y + body.altura < c.y) continue;
      const ex = c.hw + body.raio, ez = c.hd + body.raio;
      if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
        const penX = ex - Math.abs(lx), penZ = ez - Math.abs(lz);
        let nlx = 0, nlz = 0;
        if (penX < penZ) nlx = Math.sign(lx) * penX; else nlz = Math.sign(lz) * penZ;
        const cos2 = Math.cos(c.rot || 0), sin2 = Math.sin(c.rot || 0);
        p.x += nlx * cos2 - nlz * sin2;
        p.z += nlx * sin2 + nlz * cos2;
      }
    }
  }
}

/** Integração de um corpo. Retorna info de eventos (impacto, queda). */
export function integrar(body, dt, colliders, { comGravidade = true } = {}) {
  const ev = { queda: 0, impacto: 0 };
  const alturaSolo = heightAt(body.pos.x, body.pos.z);
  body.naAgua = body.pos.y < WATER_LEVEL - 0.3 && alturaSolo < WATER_LEVEL;

  if (comGravidade && !body.voando) {
    if (body.naAgua) {
      // Empuxo: corpo humano ~ densidade 985 kg/m³ → quase neutro.
      const volume = body.massa / 985;
      const empuxo = AGUA_DENSIDADE * volume * -G;   // N
      const peso = body.massa * -G;
      body.vel.y += ((empuxo - peso) / body.massa) * dt;
      body.vel.multiplyScalar(1 - Math.min(1, 2.6 * dt));   // arrasto aquático
    } else {
      body.vel.y += G * dt;
      const v2 = body.vel.lengthSq();
      if (v2 > 1) body.vel.addScaledVector(body.vel, -body.arrasto * dt * Math.sqrt(v2) / Math.sqrt(v2));
    }
  }

  const antesY = body.vel.y;
  body.pos.addScaledVector(body.vel, dt);

  // Limites do mundo
  body.pos.x = THREE.MathUtils.clamp(body.pos.x, -HALF + 5, HALF - 5);
  body.pos.z = THREE.MathUtils.clamp(body.pos.z, -HALF + 5, HALF - 5);

  resolverColisoes(body, colliders);

  const solo = heightAt(body.pos.x, body.pos.z);
  if (body.pos.y <= solo) {
    body.pos.y = solo;
    if (!body.grounded && antesY < -8) {
      // Dano de queda por energia cinética: E = ½mv². Convertemos em "dano"
      // normalizado por massa (um golem não morre pela própria inércia).
      const v = Math.abs(antesY);
      ev.queda = Math.max(0, (0.5 * v * v - 40) * 0.22);
      ev.impacto = v;
    }
    body.grounded = true;
    if (body.vel.y < 0) body.vel.y = -body.vel.y * body.restituicao;
  } else {
    body.grounded = false;
  }
  return ev;
}

/** Atrito por superfície: gelo escorrega, areia freia, pântano suga. */
export function atritoDoBioma(bioma) {
  switch (bioma) {
    case 'snow': return 2.2;
    case 'desert': return 6.5;
    case 'swamp': return 10.5;
    case 'rock': return 9.0;
    case 'water': return 3.0;
    default: return 8.5;
  }
}

/** Raycast contra o terreno (marching) — usado por mira e IA. */
export function raycastTerreno(origem, dir, maxDist = 200, passo = 0.6) {
  const p = origem.clone();
  const d = dir.clone().normalize();
  for (let t = 0; t < maxDist; t += passo) {
    p.addScaledVector(d, passo);
    if (p.y <= heightAt(p.x, p.z)) return { hit: true, ponto: p.clone(), dist: t };
  }
  return { hit: false, ponto: p.clone(), dist: maxDist };
}

/** Linha de visão simples: nada de terreno no caminho. */
export function temLinhaDeVisao(a, b) {
  const dir = b.clone().sub(a);
  const dist = dir.length();
  const r = raycastTerreno(a, dir, dist, 1.2);
  return !r.hit || r.dist > dist - 1.5;
}

/** Quanto de massa um personagem consegue erguer/arremessar. */
export function capacidadeCarga(forca, massaCorpo, musculo = 50) {
  return forca * 9 + massaCorpo * (0.4 + musculo / 250);
}

/** Velocidade de arremesso dada a massa do objeto e a capacidade do braço. */
export function velocidadeArremesso(capacidade, massaObjeto) {
  if (massaObjeto <= 0) return 0;
  const razao = capacidade / massaObjeto;
  return THREE.MathUtils.clamp(Math.sqrt(razao) * 7, 0, 45);
}

/** Alcance balístico teórico: R = v² sen(2θ)/g, θ=45° → v²/g. */
export function alcanceBalistico(v) { return (v * v) / Math.abs(G); }

/** Condutividade elétrica do ambiente no ponto (0..1) — usada por raio. */
export function condutividade(pos) {
  const b = biomeAt(pos.x, pos.z);
  if (b === 'water') return 1.0;
  if (b === 'swamp') return 0.85;
  if (b === 'snow') return 0.5;
  if (b === 'desert') return 0.12;
  return 0.3;
}

/** Inflamabilidade do ambiente (0..1) — usada por fogo. */
export function inflamabilidade(pos) {
  const b = biomeAt(pos.x, pos.z);
  if (b === 'forest') return 1.0;
  if (b === 'plains') return 0.7;
  if (b === 'swamp') return 0.25;
  if (b === 'desert') return 0.35;
  if (b === 'water' || b === 'snow') return 0.0;
  return 0.2;
}
