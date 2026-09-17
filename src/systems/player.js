import * as THREE from 'three';
import { Body, integrar, atritoDoBioma } from './physics.js';
import { biomeAt, heightAt } from './world.js';
import { buildAvatar, animarAvatar, computarFicha } from './character.js';
import { MAGIAS } from './chardata.js';

export class Player {
  constructor(build, scene, pos) {
    this.build = build;
    this.ficha = computarFicha(build);
    this.vida = this.ficha.vidaMax;
    this.mana = this.ficha.manaMax;
    this.stam = this.ficha.stamMax;
    this.cooldowns = {};
    this.buffs = {};
    this.escudo = 0;
    this.molhado = 0; this.queimando = 0; this.stun = 0; this.congelado = 0; this.preso = 0;
    this.invulneravel = 0;
    this.conjurando = 0;
    this.atacando = 0;
    this.fadiga = 0;
    this.vivo = true;
    this.metalico = build.classe === 'guerreiro';
    this.construto = build.raca === 'golem';
    this.body = new Body({ pos, massa: this.ficha.massa, raio: 0.42, altura: build.corpo.altura });
    this.mesh = buildAvatar(build);
    this.mesh.position.copy(pos);
    scene.add(this.mesh);
    this.nome = build.nome;
    this.magias = [...build.magias];
    this.magiaAtiva = 0;
    this.nivel = build.nivel || 1;
    this.xp = build.xp || 0;
    this.ultimaEscola = null;
  }

  get magiaSelecionada() { return this.magias[this.magiaAtiva]; }

  update(dt, input, game, camDir) {
    const f = this.ficha;
    // estados
    for (const k of ['molhado', 'queimando', 'stun', 'congelado', 'preso', 'invulneravel', 'conjurando', 'atacando']) {
      this[k] = Math.max(0, (this[k] || 0) - dt);
    }
    for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    for (const k in this.buffs) {
      this.buffs[k] -= dt;
      if (this.buffs[k] <= 0) {
        if (k === 'pele_pedra') this.body.massa = f.massa;
        if (k === 'runa_escudo') this.escudo = 0;
        delete this.buffs[k];
      }
    }
    if (this.buffs.regeneracao) this.vida = Math.min(f.vidaMax, this.vida + 4 * dt);
    if (this.queimando > 0) game.aplicarDano(this, (this.molhado > 0 ? 1.5 : 6) * dt, null, 'fogo', true);

    // ambiente: temperatura drena estamina
    const bioma = biomeAt(this.body.pos.x, this.body.pos.z);
    if (bioma === 'snow') this.stam -= (2.2 / f.tolFrio) * dt;
    if (bioma === 'desert') this.stam -= (2.0 / f.tolCalor) * dt;
    if (this.body.naAgua && this.construto) game.aplicarDano(this, 9 * dt, null, 'fisico', true);

    // regen
    this.mana = Math.min(f.manaMax, this.mana + f.regenMana * dt * (bioma === 'veil' ? 2 : 1));
    this.stam = Math.min(f.stamMax, Math.max(0, this.stam + (input.correr ? -14 : f.regenStam * 0.55) * dt));
    this.fadiga = Math.max(0, this.fadiga - dt * 2);

    // movimento
    const podeMover = this.stun <= 0 && this.congelado <= 0 && this.preso <= 0 && this.vivo;
    const fwd = new THREE.Vector3(camDir.x, 0, camDir.z).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const dir = new THREE.Vector3();
    if (podeMover) {
      if (input.frente) dir.add(fwd);
      if (input.tras) dir.sub(fwd);
      if (input.dir) dir.add(right);
      if (input.esq) dir.sub(right);
    }
    const correndo = input.correr && this.stam > 1 && dir.lengthSq() > 0;
    const vAlvo = f.veloc * (correndo ? 1.65 : 1) * (this.body.naAgua ? 0.55 : 1) * (1 - this.fadiga / 400);
    if (dir.lengthSq() > 0) {
      dir.normalize();
      const atrito = atritoDoBioma(bioma);
      const acc = this.body.grounded ? atrito * 1.6 : 3.0;
      this.body.vel.x = THREE.MathUtils.lerp(this.body.vel.x, dir.x * vAlvo, Math.min(1, acc * dt));
      this.body.vel.z = THREE.MathUtils.lerp(this.body.vel.z, dir.z * vAlvo, Math.min(1, acc * dt));
      this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, Math.atan2(dir.x, dir.z), Math.min(1, dt * 12));
    } else if (this.body.grounded) {
      const atrito = atritoDoBioma(bioma);
      this.body.vel.x -= this.body.vel.x * Math.min(1, atrito * dt);
      this.body.vel.z -= this.body.vel.z * Math.min(1, atrito * dt);
    }

    if (input.pular && this.body.grounded && podeMover && this.stam > 8) {
      this.body.vel.y = f.pulo;
      this.stam -= 8;
      this.body.grounded = false;
    }
    // planar (feérico / elfo)
    if (input.pular && !this.body.grounded && this.body.vel.y < 0 &&
        (this.build.raca === 'feerico' || this.build.tracos.includes('peso_leve'))) {
      this.body.vel.y = Math.max(this.body.vel.y, -2.2);
    }

    const ev = integrar(this.body, dt, game.colliders);
    if (ev.queda > 0) {
      let d = ev.queda;
      if (this.build.raca === 'elfo') d *= 0.7;
      if (d > 1) {
        game.aplicarDano(this, d, null, 'fisico', true);
        game.log(`Impacto a ${ev.impacto.toFixed(1)} m/s: ${Math.round(d)} de dano (½mv²).`, 'aviso');
      }
    }
    if (this.body.naAgua) this.molhado = 6;

    this.mesh.position.copy(this.body.pos);
    const v = Math.hypot(this.body.vel.x, this.body.vel.z);
    animarAvatar(this.mesh, dt, {
      velocidade: v, noAr: !this.body.grounded,
      conjurando: this.conjurando, atacando: this.atacando, vivo: this.vivo,
    });
    return { velocidade: v, bioma };
  }

  ataqueFisico(game, dir) {
    if (this.stam < 12) return { ok: false, msg: 'Sem fôlego.' };
    this.stam -= 12;
    this.atacando = 0.35;
    const alcance = 2.4 * this.ficha.alcance;
    let acertou = 0;
    for (const e of game.inimigos) {
      if (!e.vivo) continue;
      const d = e.body.pos.distanceTo(this.body.pos);
      if (d > alcance + e.body.raio) continue;
      const para = e.body.pos.clone().sub(this.body.pos).setY(0).normalize();
      if (para.dot(dir.clone().setY(0).normalize()) < 0.25) continue;
      let dano = 16 * this.ficha.poderFisico;
      if (this.build.raca === 'orc' && this.vida / this.ficha.vidaMax < 0.3) dano *= 1.5;
      game.aplicarDano(e, dano, this, 'fisico');
      e.body.aplicarImpulso(para.multiplyScalar(this.ficha.massa * 22));
      acertou++;
    }
    return { ok: true, acertou };
  }

  serializar() {
    return {
      build: this.build, vida: this.vida, mana: this.mana, stam: this.stam,
      pos: [this.body.pos.x, this.body.pos.y, this.body.pos.z],
      nivel: this.nivel, xp: this.xp, magias: this.magias,
    };
  }
}
