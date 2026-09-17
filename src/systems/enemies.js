import * as THREE from 'three';
import { Body, integrar, temLinhaDeVisao, atritoDoBioma } from './physics.js';
import { heightAt, biomeAt } from './world.js';
import { Textures } from './textures.js';

// ---------------------------------------------------------------------------
// Bestiário. Cada criatura tem massa real (define o quanto é empurrável),
// fraquezas elementais e uma IA de estados (patrulha → perseguir → atacar → fugir).
// ---------------------------------------------------------------------------

export const BESTIARIO = {
  lobo_veu: {
    nome: 'Lobo do Véu', vida: 70, dano: 12, massa: 55, veloc: 7.2, alcance: 2.4, xp: 30,
    cor: 0x554466, escala: 0.9, fraqueza: 'fogo', resist: 'sombra', forma: 'quadrupede',
    desc: 'Rápido, caça em matilha. Massa baixa: rajadas de vento o arremessam longe.',
  },
  goblin: {
    nome: 'Goblin Saqueador', vida: 45, dano: 9, massa: 42, veloc: 5.4, alcance: 2.0, xp: 20,
    cor: 0x6b8f4a, escala: 0.75, fraqueza: 'raio', resist: null, forma: 'humanoide',
    desc: 'Covarde e numeroso. Foge abaixo de 25% de vida; usa armadura de sucata (metálico).',
    metalico: true,
  },
  golem_pedra: {
    nome: 'Golem de Pedra', vida: 260, dano: 30, massa: 600, veloc: 2.4, alcance: 3.2, xp: 110,
    cor: 0x8a8a92, escala: 1.6, fraqueza: 'agua', resist: 'terra', forma: 'humanoide',
    desc: 'Praticamente imóvel a empurrões (massa 600 kg). Água em fissuras + gelo o racha.',
    construto: true,
  },
  espectro: {
    nome: 'Espectro do Véu', vida: 90, dano: 20, massa: 12, veloc: 5.0, alcance: 12, xp: 70,
    cor: 0xaa88ff, escala: 1.1, fraqueza: 'vida', resist: 'sombra', forma: 'flutuante',
    desc: 'Atravessa obstáculos. Dano físico reduzido em 70%; magia radiante o dissolve.',
    etereo: true, voa: true,
  },
  aranha_mana: {
    nome: 'Aranha de Mana', vida: 110, dano: 16, massa: 90, veloc: 6.0, alcance: 14, xp: 60,
    cor: 0x3a7a8a, escala: 1.2, fraqueza: 'fogo', resist: 'agua', forma: 'quadrupede',
    desc: 'Lança teias inflamáveis. Se você a molhar, o fogo perde efeito — ordem importa.',
  },
  cavaleiro_caido: {
    nome: 'Cavaleiro Caído', vida: 180, dano: 26, massa: 140, veloc: 4.6, alcance: 3.0, xp: 95,
    cor: 0x4a4a55, escala: 1.15, fraqueza: 'raio', resist: 'fogo', forma: 'humanoide',
    desc: 'Armadura pesada = condutor perfeito. Raio o paralisa; fogo só aquece o metal (dano por tempo).',
    metalico: true,
  },
  elemental_chama: {
    nome: 'Elemental de Chama', vida: 130, dano: 24, massa: 30, veloc: 6.2, alcance: 9, xp: 85,
    cor: 0xff7733, escala: 1.1, fraqueza: 'agua', resist: 'fogo', forma: 'flutuante',
    desc: 'Imune a fogo, morre rápido na água. Incendeia o solo por onde passa.',
    voa: true,
  },
};

export const CHEFES = {
  ancião_raiz: {
    nome: 'Ancião-Raiz de Sussurro', vida: 900, dano: 38, massa: 2200, veloc: 2.0, alcance: 7, xp: 600,
    cor: 0x3f6b3a, escala: 3.6, fraqueza: 'fogo', resist: 'terra', forma: 'humanoide', construto: false,
    bioma: 'forest', pos: [-300, -60],
    desc: 'Árvore senciente de 12 metros. Imóvel por natureza — você precisa DERRUBÁ-LA, não empurrá-la: queime as raízes de um lado e o peso faz o resto.',
    fases: [
      'Fase 1 — Raízes: prende você no chão e golpeia. Corte/queime as raízes expostas.',
      'Fase 2 — Copa em chamas: tenta apagar o fogo com chuva de seiva. Contra-ataque com vento.',
      'Fase 3 — Queda: o tronco enfraquecido tomba. Escolher o lado errado esmaga você.',
    ],
  },
  rainha_areia: {
    nome: 'Rainha das Areias', vida: 1100, dano: 44, massa: 800, veloc: 5.5, alcance: 16, xp: 800,
    cor: 0xd8b070, escala: 3.0, fraqueza: 'agua', resist: 'terra', forma: 'quadrupede',
    bioma: 'desert', pos: [420, 60],
    desc: 'Verme colossal que nada na areia. Só emerge sobre solo seco — vitrifique a areia com calor extremo ou molhe o terreno e ela fica presa à superfície.',
    fases: [
      'Fase 1 — Submersa: rastreia por vibração. Pare de correr e ela te perde.',
      'Fase 2 — Emersa: investidas em linha reta. Use obstáculos de pedra.',
      'Fase 3 — Tempestade de areia: visibilidade zero, dano contínuo. Escudo ou abrigo.',
    ],
  },
  tirano_gelo: {
    nome: 'Tirano da Coroa Gélida', vida: 1400, dano: 50, massa: 1600, veloc: 4.0, alcance: 12, xp: 1000,
    cor: 0xaadfff, escala: 3.4, fraqueza: 'fogo', resist: 'agua', forma: 'humanoide',
    bioma: 'snow', pos: [-60, -470],
    desc: 'Gigante de gelo vivo. O chão gelado reduz seu atrito a quase nada: você desliza. Derreta o piso sob ELE e a massa de 1,6 t o afunda.',
    fases: [
      'Fase 1 — Lanças de gelo teleguiadas.',
      'Fase 2 — Ele congela o lago: o piso vira armadilha frágil que quebra sob peso.',
      'Fase 3 — Avalanche. Correr é inútil; escave ou erga muro de pedra.',
    ],
  },
  arauto_veu: {
    nome: 'Arauto do Véu Rasgado', vida: 2200, dano: 62, massa: 400, veloc: 6.5, alcance: 20, xp: 2000,
    cor: 0xaa66ff, escala: 3.2, fraqueza: null, resist: null, forma: 'flutuante', voa: true,
    bioma: 'veil', pos: [260, -240],
    desc: 'O chefe final. Copia a ÚLTIMA magia que você usou e devolve amplificada. Vencê-lo exige variar de escola constantemente — repetição é suicídio.',
    fases: [
      'Fase 1 — Espelho: reflete sua última escola.',
      'Fase 2 — Fragmentação: três cópias, apenas uma é real (a que projeta sombra).',
      'Fase 3 — Colapso: a arena desmorona em plataformas flutuantes. Física vertical pura.',
    ],
  },
};

export class Enemy {
  constructor(tipoId, pos, scene, chefe = false) {
    const t = chefe ? CHEFES[tipoId] : BESTIARIO[tipoId];
    this.tipoId = tipoId;
    this.def = t;
    this.chefe = chefe;
    this.nome = t.nome;
    this.ficha = { vidaMax: t.vida, poderMagico: 1, poderFisico: 1, armadura: chefe ? 0.25 : 0.05, resistMagica: 0.05, alcance: 1 };
    this.vida = t.vida;
    this.mana = 100;
    this.cooldowns = {};
    this.body = new Body({ pos, massa: t.massa, raio: 0.5 * t.escala, altura: 1.8 * t.escala });
    this.body.voando = !!t.voa;
    this.veloc = t.veloc;
    this.estado = 'patrulha';
    this.alvo = null;
    this.timerAtaque = 0;
    this.molhado = 0; this.queimando = 0; this.stun = 0; this.congelado = 0; this.preso = 0; this.medo = 0;
    this.metalico = !!t.metalico;
    this.construto = !!t.construto;
    this.etereo = !!t.etereo;
    this.fase = 1;
    this.origem = pos.clone();
    this.mesh = this.buildMesh(t);
    this.mesh.position.copy(pos);
    scene.add(this.mesh);
    this.vivo = true;
    this.ultimaEscolaRecebida = null;
  }

  buildMesh(t) {
    const g = new THREE.Group();
    const cor = new THREE.Color(t.cor);
    const mat = new THREE.MeshStandardMaterial({
      color: cor, roughness: 0.85, flatShading: true,
      emissive: t.forma === 'flutuante' ? cor : 0x000000,
      emissiveIntensity: t.forma === 'flutuante' ? 1.2 : 0,
      transparent: !!t.etereo, opacity: t.etereo ? 0.62 : 1,
    });
    const s = t.escala;
    if (t.forma === 'quadrupede') {
      const corpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.42 * s, 1.1 * s, 3, 8), mat);
      corpo.rotation.z = Math.PI / 2;
      corpo.position.y = 0.85 * s;
      const cabeca = new THREE.Mesh(new THREE.ConeGeometry(0.32 * s, 0.75 * s, 6), mat);
      cabeca.rotation.x = Math.PI / 2;
      cabeca.position.set(0, 0.95 * s, 0.95 * s);
      g.add(corpo, cabeca);
      this.pernas = [];
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.11 * s, 0.7 * s, 3, 6), mat);
        p.position.set((i % 2 ? 1 : -1) * 0.34 * s, 0.4 * s, (i < 2 ? 1 : -1) * 0.5 * s);
        g.add(p); this.pernas.push(p);
      }
    } else if (t.forma === 'flutuante') {
      const nucleo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 * s, 1), mat);
      nucleo.position.y = 1.6 * s;
      const manto = new THREE.Mesh(new THREE.ConeGeometry(0.8 * s, 2.0 * s, 8, 1, true),
        new THREE.MeshStandardMaterial({ color: cor, transparent: true, opacity: 0.4, side: THREE.DoubleSide, emissive: cor, emissiveIntensity: 0.8 }));
      manto.position.y = 0.8 * s;
      manto.rotation.x = Math.PI;
      g.add(nucleo, manto);
      const l = new THREE.PointLight(cor, 30 * s, 24 * s, 2);
      l.position.y = 1.6 * s;
      g.add(l);
      this.nucleo = nucleo;
    } else {
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.4 * s, 0.85 * s, 3, 8), mat);
      torso.position.y = 1.25 * s;
      const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 10, 8), mat);
      cabeca.position.y = 1.95 * s;
      g.add(torso, cabeca);
      this.bracos = [];
      for (let i = 0; i < 2; i++) {
        const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.14 * s, 0.85 * s, 3, 6), mat);
        b.position.set((i ? 1 : -1) * 0.55 * s, 1.25 * s, 0);
        g.add(b); this.bracos.push(b);
      }
      this.pernas = [];
      for (let i = 0; i < 2; i++) {
        const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.17 * s, 0.8 * s, 3, 6), mat);
        p.position.set((i ? 1 : -1) * 0.22 * s, 0.45 * s, 0);
        g.add(p); this.pernas.push(p);
      }
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    if (this.chefe) {
      const aura = new THREE.Mesh(new THREE.RingGeometry(2.5 * s, 3.2 * s, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
      aura.position.y = 0.06;
      g.add(aura);
      this.aura = aura;
    }
    return g;
  }

  update(dt, game) {
    if (!this.vivo) return;
    const t = this.def;
    // Estados
    this.stun = Math.max(0, this.stun - dt);
    this.congelado = Math.max(0, this.congelado - dt);
    this.preso = Math.max(0, this.preso - dt);
    this.medo = Math.max(0, this.medo - dt);
    this.molhado = Math.max(0, this.molhado - dt);
    if (this.queimando > 0) {
      this.queimando -= dt;
      const mult = this.molhado > 0 ? 0.2 : 1;
      game.aplicarDano(this, 7 * dt * mult, null, 'fogo', true);
    }

    const jogador = game.jogadorMaisProximo(this.body.pos);
    const dist = jogador ? this.body.pos.distanceTo(jogador.body.pos) : 999;
    const percepcao = this.chefe ? 90 : 42;

    if (this.stun <= 0 && this.congelado <= 0) {
      if (this.medo > 0 && jogador) {
        this.estado = 'fuga';
      } else if (jogador && dist < percepcao) {
        this.estado = dist < t.alcance * 1.3 ? 'atacar' : 'perseguir';
        this.alvo = jogador;
      } else {
        this.estado = 'patrulha';
      }

      const mover = (dir, mult = 1) => {
        if (this.preso > 0) return;
        const v = this.veloc * mult * (this.molhado > 0 ? 0.85 : 1);
        this.body.vel.x = THREE.MathUtils.lerp(this.body.vel.x, dir.x * v, dt * 5);
        this.body.vel.z = THREE.MathUtils.lerp(this.body.vel.z, dir.z * v, dt * 5);
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      };

      if (this.estado === 'perseguir' && jogador) {
        const dir = jogador.body.pos.clone().sub(this.body.pos).setY(0).normalize();
        mover(dir);
        // atacar à distância se o tipo permite
        if (t.alcance > 6 && dist < t.alcance * 2.2 && this.timerAtaque <= 0 && temLinhaDeVisao(this.body.pos.clone().setY(this.body.pos.y + 1.5), jogador.body.pos)) {
          this.atacarDistancia(game, jogador);
          this.timerAtaque = this.chefe ? 1.8 : 2.8;
        }
      } else if (this.estado === 'atacar' && jogador) {
        const dir = jogador.body.pos.clone().sub(this.body.pos).setY(0).normalize();
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        this.body.vel.x *= 0.85; this.body.vel.z *= 0.85;
        if (this.timerAtaque <= 0) {
          game.aplicarDano(jogador, t.dano * (this.chefe ? this.fase : 1), this, 'fisico');
          jogador.body.aplicarImpulso(dir.multiplyScalar(t.massa * 12));
          this.timerAtaque = this.chefe ? 1.4 : 1.6;
          this.animAtaque = 0.4;
        }
      } else if (this.estado === 'fuga' && jogador) {
        const dir = this.body.pos.clone().sub(jogador.body.pos).setY(0).normalize();
        mover(dir, 1.25);
      } else {
        // patrulha: passeio em torno da origem
        this.patrulhaT = (this.patrulhaT || Math.random() * 10) + dt;
        const a = this.patrulhaT * 0.25;
        const alvoP = this.origem.clone().add(new THREE.Vector3(Math.cos(a) * 12, 0, Math.sin(a) * 12));
        const dir = alvoP.sub(this.body.pos).setY(0);
        if (dir.length() > 1) mover(dir.normalize(), 0.35);
      }
    } else {
      this.body.vel.x *= 0.8; this.body.vel.z *= 0.8;
    }
    this.timerAtaque -= dt;

    // Física
    if (t.voa) {
      const alvoY = heightAt(this.body.pos.x, this.body.pos.z) + 3.2 + Math.sin(performance.now() * 0.001 + this.body.pos.x) * 0.7;
      this.body.vel.y = (alvoY - this.body.pos.y) * 2.6;
      this.body.pos.addScaledVector(this.body.vel, dt);
    } else {
      const atrito = atritoDoBioma(biomeAt(this.body.pos.x, this.body.pos.z));
      this.body.vel.x -= this.body.vel.x * Math.min(1, atrito * dt * 0.3);
      this.body.vel.z -= this.body.vel.z * Math.min(1, atrito * dt * 0.3);
      const ev = integrar(this.body, dt, game.colliders);
      if (ev.queda > 5) game.aplicarDano(this, ev.queda, null, 'fisico', true);
    }
    this.mesh.position.copy(this.body.pos);

    // Fases do chefe
    if (this.chefe) {
      const f = this.vida / this.ficha.vidaMax;
      const nova = f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
      if (nova !== this.fase) {
        this.fase = nova;
        game.log(`⚔ ${this.nome} entra na ${this.def.fases[nova - 1]}`, 'boss');
        game.spells.explosaoVisual(this.body.pos.clone().setY(this.body.pos.y + 3), '#ffffff', 4);
      }
      if (this.aura) this.aura.rotation.y += dt;
    }

    // Animação simples
    const v = Math.hypot(this.body.vel.x, this.body.vel.z);
    this.fase_anim = (this.fase_anim || 0) + dt * (2 + v);
    if (this.pernas) this.pernas.forEach((p, i) => { p.rotation.x = Math.sin(this.fase_anim + i * 1.6) * Math.min(0.8, v * 0.14); });
    if (this.bracos) this.bracos.forEach((b, i) => { b.rotation.x = (this.animAtaque > 0 ? -1.8 : Math.sin(this.fase_anim + i * 3.1) * Math.min(0.6, v * 0.12)); });
    if (this.nucleo) this.nucleo.rotation.y += dt * 1.4;
    if (this.animAtaque > 0) this.animAtaque -= dt;
    if (this.congelado > 0) this.mesh.scale.setScalar(1.0);
  }

  atacarDistancia(game, jogador) {
    const escola = { aranha_mana: 'terra', espectro: 'sombra', elemental_chama: 'fogo', arauto_veu: 'sombra', rainha_areia: 'terra', tirano_gelo: 'agua', ancião_raiz: 'vida' }[this.tipoId] || 'terra';
    const origem = this.body.pos.clone().setY(this.body.pos.y + 1.8 * this.def.escala);
    const alvoP = jogador.body.pos.clone().setY(jogador.body.pos.y + 1);
    const dir = alvoP.sub(origem).normalize();
    game.spells.spawnProjetil('inimigo', this, origem, dir, this.def.dano * 0.8 * (this.chefe ? this.fase : 1),
      { escola, vel: 28 + (this.chefe ? 12 : 0), dano: this.def.dano });
  }

  danoFinal(dano, escola) {
    let d = dano;
    if (this.def.fraqueza === escola) d *= 1.75;
    if (this.def.resist === escola) d *= 0.4;
    if (this.etereo && escola === 'fisico') d *= 0.3;
    if (this.metalico && escola === 'raio') d *= 1.6;
    if (this.construto && escola === 'vida') d = 0;
    if (this.molhado > 0 && escola === 'raio') d *= 1.5;
    if (this.molhado > 0 && escola === 'fogo') d *= 0.55;
    return d * (1 - (this.ficha.armadura || 0));
  }
}
