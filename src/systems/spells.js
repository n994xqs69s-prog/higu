import * as THREE from 'three';
import { MAGIAS, ESCOLAS } from './chardata.js';
import { Body, integrar, condutividade, inflamabilidade, G } from './physics.js';
import { heightAt, biomeAt, BIOME_INFO } from './world.js';

// ---------------------------------------------------------------------------
// Sistema de magia com efeitos físicos: projéteis balísticos, áreas, muros,
// controle, sinergias elementais (molhado+raio, fogo+óleo, etc).
// ---------------------------------------------------------------------------

export class SpellSystem {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.projeteis = [];
    this.efeitos = [];
    this.muros = [];
    this.runas = [];
  }

  custoAjustado(id, caster) {
    const m = this.def(id, caster);
    if (!m) return 999;
    const bioma = biomeAt(caster.body.pos.x, caster.body.pos.z);
    let mult = 1 / (BIOME_INFO[bioma]?.mana || 1);
    // Regras físicas por escola vs bioma
    if (m.escola === 'fogo' && (bioma === 'water' || caster.body.naAgua)) mult *= 3.0;
    if (m.escola === 'agua' && bioma === 'desert') mult *= 3.0;
    if (m.escola === 'agua' && (bioma === 'water' || bioma === 'swamp')) mult *= 0.5;
    if (m.escola === 'fogo' && bioma === 'forest') mult *= 0.75;
    if (m.escola === 'sombra' && this.game.horaDoDia > 0.25 && this.game.horaDoDia < 0.75) mult *= 2.0;
    if (m.escola === 'terra' && (bioma === 'rock' || bioma === 'desert')) mult *= 0.7;
    return Math.round(m.custo * mult);
  }

  /** Multiplicador de dano do ambiente + explicação textual (mostrada ao jogador). */
  contexto(id, pos, caster) {
    const m = this.def(id, caster) || { escola: 'runica' };
    const bioma = biomeAt(pos.x, pos.z);
    let mult = 1, notas = [];
    if (m.escola === 'fogo') {
      const infl = inflamabilidade(pos);
      mult *= 0.7 + infl * 0.8;
      if (infl > 0.8) notas.push('vegetação seca: incêndio se alastra (+dano)');
      if (infl === 0) notas.push('nada para queimar aqui (-dano)');
    }
    if (m.escola === 'raio') {
      const cond = condutividade(pos);
      mult *= 0.65 + cond * 1.0;
      if (cond > 0.8) notas.push('superfície condutora: a corrente salta');
    }
    if (m.escola === 'agua' && bioma === 'desert') { mult *= 0.6; notas.push('ar seco: pouca água disponível'); }
    if (m.escola === 'terra' && bioma === 'water') { mult *= 0.5; notas.push('sem solo firme para moldar'); }
    if (bioma === 'veil') { mult *= 1.5; notas.push('o Véu amplifica tudo (instável)'); }
    return { mult, notas, bioma };
  }

  /** Resolve a definição da magia: catálogo oficial OU poder forjado pelo jogador. */
  def(id, caster) {
    if (MAGIAS[id]) return MAGIAS[id];
    const p = caster?.build?.poderes?.find(x => x.id === id);
    return p || null;
  }

  conjurar(id, caster, direcao, alvoPos) {
    const m = this.def(id, caster);
    if (!m) return { ok: false, msg: 'Magia desconhecida.' };
    const custo = this.custoAjustado(id, caster);
    if (caster.mana < custo) return { ok: false, msg: `Mana insuficiente (${custo} necessários).` };
    const cd = caster.cooldowns[id] || 0;
    if (cd > 0) return { ok: false, msg: `${m.nome} em recarga (${cd.toFixed(1)}s).` };

    caster.mana -= custo;
    caster.cooldowns[id] = m.cd;
    caster.conjurando = 0.35;

    const origem = caster.body.pos.clone().add(new THREE.Vector3(0, caster.ficha.alcance * 1.4, 0));
    const ctx = this.contexto(id, origem, caster);
    let dano = Math.abs(m.dano) * caster.ficha.poderMagico * ctx.mult;

    // Falha caótica do Véu
    if (caster.build?.tracos?.includes('maldicao_veu') && Math.random() < 0.05) {
      ctx.notas.push('⚡ FALHA CAÓTICA: a magia se distorceu');
      dano *= 0.4 + Math.random();
      direcao = direcao.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.2);
    }

    // Limitações que o jogador aceitou ao forjar o poder
    if (m.custom && m.efeitos?.length) {
      if (m.efeitos.includes('recuo')) {
        const auto = Math.max(3, dano * 0.12);
        caster.vida -= auto;
        ctx.notas.push(`custo de sangue: −${Math.round(auto)} PV`);
      }
      if (m.efeitos.includes('enraiza')) { caster.preso = Math.max(caster.preso || 0, 1.2); ctx.notas.push('você fica imóvel por 1,2 s'); }
      if (m.efeitos.includes('drena')) { caster.mana = 0; ctx.notas.push('drenou toda a sua mana'); }
      if (m.efeitos.includes('instavel') && Math.random() < 0.18) {
        dano *= 0.3;
        direcao = direcao.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.4);
        ctx.notas.push('⚡ o poder instável se desviou');
      }
      if (m.efeitos.includes('cast_lento')) caster.conjurando = 0.9;
    }

    switch (m.tipo) {
      case 'projetil': this.spawnProjetil(id, caster, origem, direcao, dano, m); break;
      case 'invocacao': this.spawnInvocacao(id, caster, origem, direcao, dano, m); break;
      case 'area': this.spawnArea(id, caster, alvoPos || origem.clone().addScaledVector(direcao, 14), dano, m); break;
      case 'cadeia': this.spawnCadeia(id, caster, origem, dano, m); break;
      case 'muro': this.spawnMuro(id, caster, origem.clone().addScaledVector(direcao, 7), m, 'fogo'); break;
      case 'utilidade': this.utilidade(id, caster, origem, direcao, m); break;
      case 'mobilidade': this.mobilidade(id, caster, direcao, m); break;
      case 'buff': this.buff(id, caster, m); break;
      case 'controle': this.controle(id, caster, origem, direcao, m, dano); break;
      case 'cura': this.cura(id, caster, dano); break;
      case 'armadilha': this.armadilha(id, caster, origem, direcao, dano, m); break;
    }
    return { ok: true, custo, notas: ctx.notas, nome: m.nome };
  }

  // --- Projétil balístico real ---------------------------------------------
  spawnProjetil(id, caster, origem, dir, dano, m) {
    const cor = new THREE.Color(ESCOLAS[m.escola].cor);
    const massa = m.escola === 'terra' ? 12 : m.escola === 'agua' ? 4 : 0.4;
    const geo = m.escola === 'terra'
      ? new THREE.DodecahedronGeometry(0.42, 0)
      : new THREE.SphereGeometry(0.3, 10, 8);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: cor, emissive: cor, emissiveIntensity: 2.2, transparent: true, opacity: 0.95,
    }));
    mesh.position.copy(origem);
    const luz = new THREE.PointLight(cor, 14, 16, 2);
    mesh.add(luz);
    this.scene.add(mesh);

    const body = new Body({ pos: origem, massa, raio: 0.3 });
    body.vel.copy(dir).normalize().multiplyScalar(m.vel);
    // projéteis leves (fogo, raio, ar) quase não sofrem gravidade
    const gravidade = m.escola === 'terra' ? 1.0 : m.escola === 'agua' ? 0.5 : m.escola === 'raio' ? 0.0 : 0.12;

    this.projeteis.push({ id, mesh, body, dano, dono: caster, vida: 5, gravidade, escola: m.escola, luz });
  }

  spawnInvocacao(id, caster, origem, dir, dano, m) {
    const cor = new THREE.Color(ESCOLAS[m.escola].cor);
    const n = 1 + Math.floor((m.intens || 1) * 1.5);
    for (let i = 0; i < n; i++) {
      const pos = origem.clone().addScaledVector(dir, 4 + i * 1.6);
      pos.x += (Math.random() - 0.5) * 3; pos.z += (Math.random() - 0.5) * 3;
      this.game.invocar(caster, pos, dano, m.escola, cor);
    }
  }

  spawnArea(id, caster, pos, dano, m) {
    const cor = new THREE.Color(ESCOLAS[m.escola].cor);
    const raio = m.raio || 8;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(raio, 16, 12),
      new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    pos.y = heightAt(pos.x, pos.z) + raio * 0.4;
    mesh.position.copy(pos);
    mesh.scale.setScalar(0.1);
    this.scene.add(mesh);
    const luz = new THREE.PointLight(cor, 200, raio * 5, 2);
    luz.position.copy(pos); this.scene.add(luz);
    this.efeitos.push({ mesh, luz, t: 0, dur: 0.75, tipo: 'expandir' });

    // Dano + onda de choque dependente da massa
    for (const alvo of this.game.alvosDe(caster)) {
      const d = alvo.body.pos.distanceTo(pos);
      if (d > raio) continue;
      const f = 1 - d / raio;
      this.game.aplicarDano(alvo, dano * f, caster, m.escola);
      const dirImp = alvo.body.pos.clone().sub(pos).normalize();
      dirImp.y = 0.55;
      alvo.body.aplicarImpulso(dirImp.multiplyScalar(dano * f * 45));
    }
    if (m.escola === 'agua') this.game.molharArea(pos, raio, 12);
    if (m.escola === 'fogo') this.game.incendiarArea(pos, raio);
  }

  spawnCadeia(id, caster, origem, dano, m) {
    const cor = new THREE.Color(ESCOLAS[m.escola].cor);
    let atual = origem.clone();
    const atingidos = new Set();
    let restante = 4, dmg = dano;
    const pontos = [atual.clone()];
    while (restante-- > 0) {
      let melhor = null, melhorD = 18;
      for (const alvo of this.game.alvosDe(caster)) {
        if (atingidos.has(alvo)) continue;
        const d = alvo.body.pos.distanceTo(atual);
        // alvos molhados/metálicos atraem a corrente
        const bias = (alvo.molhado > 0 ? 0.5 : 1) * (alvo.metalico ? 0.7 : 1);
        if (d * bias < melhorD) { melhorD = d * bias; melhor = alvo; }
      }
      if (!melhor) break;
      atingidos.add(melhor);
      const boost = melhor.molhado > 0 ? 1.8 : 1;
      this.game.aplicarDano(melhor, dmg * boost, caster, 'raio');
      melhor.stun = Math.max(melhor.stun || 0, 0.6);
      atual = melhor.body.pos.clone().setY(melhor.body.pos.y + 1);
      pontos.push(atual.clone());
      dmg *= 0.75;
    }
    if (pontos.length > 1) {
      const geo = new THREE.BufferGeometry().setFromPoints(pontos);
      const linha = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: cor, linewidth: 3 }));
      this.scene.add(linha);
      this.efeitos.push({ mesh: linha, t: 0, dur: 0.3, tipo: 'sumir' });
    }
  }

  spawnMuro(id, caster, pos, m, tipo) {
    const cor = new THREE.Color(ESCOLAS[m.escola].cor);
    pos.y = heightAt(pos.x, pos.z);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(12, 4.5, 0.7),
      new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 1.6, transparent: true, opacity: 0.6 }));
    mesh.position.copy(pos).add(new THREE.Vector3(0, 2.2, 0));
    mesh.lookAt(caster.body.pos.x, mesh.position.y, caster.body.pos.z);
    this.scene.add(mesh);
    this.muros.push({ mesh, dono: caster, dano: Math.abs(m.dano) * caster.ficha.poderMagico, t: 0, dur: 10, escola: m.escola });
  }

  utilidade(id, caster, origem, dir, m) {
    if (id === 'muro_pedra' || id === 'ponte_gelo') {
      const pos = origem.clone().addScaledVector(dir.clone().setY(0).normalize(), id === 'muro_pedra' ? 4.5 : 8);
      const solo = heightAt(pos.x, pos.z);
      const gelo = id === 'ponte_gelo';
      const geo = gelo ? new THREE.BoxGeometry(5, 0.6, 16) : new THREE.BoxGeometry(7, 4.5, 1.2);
      const mat = gelo
        ? new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.75, roughness: 0.1, metalness: 0.2 })
        : new THREE.MeshStandardMaterial({ color: 0x8a8272, roughness: 1, flatShading: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.set(pos.x, solo + (gelo ? 0.3 : 2.2), pos.z);
      mesh.rotation.y = Math.atan2(dir.x, dir.z);
      this.scene.add(mesh);
      // vira collider real (o motor de física respeita)
      const col = gelo
        ? { type: 'box', x: pos.x, y: solo, z: pos.z, hw: 2.5, hh: 0.6, hd: 8, rot: mesh.rotation.y, tag: 'gelo', temporario: true, mesh, vida: 25 }
        : { type: 'box', x: pos.x, y: solo, z: pos.z, hw: 3.5, hh: 4.5, hd: 0.7, rot: mesh.rotation.y, tag: 'muro', temporario: true, mesh, vida: 60 };
      this.game.colliders.push(col);
      this.game.estruturasTemp.push({ col, mesh, t: 0, dur: gelo ? 40 : 30 });
    }
    if (id === 'purificar') { caster.queimando = 0; caster.envenenado = 0; }
    if (id === 'runa_teleporte') {
      if (caster.marcaTeleporte) {
        caster.body.pos.copy(caster.marcaTeleporte);
        caster.marcaTeleporte = null;
        this.game.log('Você retorna à sua marca rúnica.');
      } else {
        caster.marcaTeleporte = caster.body.pos.clone();
        this.game.log('Marca rúnica fixada neste ponto.');
      }
    }
  }

  mobilidade(id, caster, dir, m) {
    if (id === 'salto_vento') {
      // impulso constante em N·s → massa importa (regra central)
      caster.body.aplicarImpulso(new THREE.Vector3(0, 1, 0).multiplyScalar(950));
      caster.body.grounded = false;
    } else if (id === 'passo_relampago' || id === 'passo_sombrio') {
      const d = dir.clone().setY(0).normalize().multiplyScalar(id === 'passo_relampago' ? 14 : 10);
      const destino = caster.body.pos.clone().add(d);
      destino.y = Math.max(heightAt(destino.x, destino.z), destino.y);
      caster.body.pos.copy(destino);
      caster.invulneravel = 0.25;
    }
  }

  buff(id, caster, m) {
    caster.buffs = caster.buffs || {};
    const dur = { pele_pedra: 25, regeneracao: 20, manto_sombra: 18, runa_escudo: 30, runa_amplificacao: 20 }[id] || 15;
    caster.buffs[id] = dur;
    if (id === 'pele_pedra') caster.body.massa *= 1.5;
    if (id === 'runa_escudo') caster.escudo = 60 * caster.ficha.poderMagico;
  }

  controle(id, caster, origem, dir, m, dano) {
    const alvo = this.game.alvoNaMira(caster, 30);
    if (!alvo) return;
    if (id === 'prisao_gelo') { alvo.congelado = 4; alvo.molhado = 8; }
    if (id === 'raizes') {
      const b = biomeAt(alvo.body.pos.x, alvo.body.pos.z);
      alvo.preso = (b === 'rock' || b === 'snow') ? 1.0 : 4.0;
    }
    if (id === 'medo') { alvo.medo = alvo.chefe ? 1.2 : 6; }
    if (dano) this.game.aplicarDano(alvo, dano, caster, m.escola);
  }

  cura(id, caster, valor) {
    const alvo = this.game.aliadoNaMira(caster) || caster;
    if (alvo.construto) { this.game.log('Vitalurgia não funciona em construtos.'); return; }
    alvo.vida = Math.min(alvo.ficha.vidaMax, alvo.vida + valor);
    alvo.fadiga = (alvo.fadiga || 0) + valor * 0.25;   // custo metabólico
    this.game.flutuante(alvo.body.pos, `+${Math.round(valor)}`, '#67e58a');
  }

  armadilha(id, caster, origem, dir, dano, m) {
    const pos = origem.clone().addScaledVector(dir.clone().setY(0).normalize(), 3);
    pos.y = heightAt(pos.x, pos.z) + 0.05;
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.5, 16).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.runas.push({ mesh, pos, dano, dono: caster, t: 0, dur: 90, raio: 3.5 });
  }

  // --- Atualização ---------------------------------------------------------
  update(dt) {
    // Projéteis
    for (let i = this.projeteis.length - 1; i >= 0; i--) {
      const p = this.projeteis[i];
      p.vida -= dt;
      if (p.gravidade > 0) p.body.vel.y += G * p.gravidade * dt;
      p.body.pos.addScaledVector(p.body.vel, dt);
      p.mesh.position.copy(p.body.pos);

      let colidiu = p.body.pos.y <= heightAt(p.body.pos.x, p.body.pos.z);
      let alvoHit = null;
      for (const alvo of this.game.alvosDe(p.dono)) {
        const d = alvo.body.pos.clone().setY(alvo.body.pos.y + alvo.body.altura * 0.5).distanceTo(p.body.pos);
        if (d < alvo.body.raio + 0.9) { alvoHit = alvo; break; }
      }
      // muros bloqueiam
      for (const c of this.game.colliders) {
        if (c.tag !== 'muro' || c.destruido) continue;
        if (Math.hypot(p.body.pos.x - c.x, p.body.pos.z - c.z) < 3.6 && p.body.pos.y < c.y + c.hh) { colidiu = true; }
      }

      if (alvoHit || colidiu || p.vida <= 0) {
        if (alvoHit) {
          let dmg = p.dano;
          if (p.escola === 'raio' && alvoHit.molhado > 0) dmg *= 1.8;
          if (p.escola === 'fogo' && alvoHit.molhado > 0) dmg *= 0.5;
          if (p.escola === 'fogo' && alvoHit.oleoso > 0) dmg *= 2.2;
          this.game.aplicarDano(alvoHit, dmg, p.dono, p.escola);
          // Impulso por momento linear: p = m·v (massa do projétil!)
          const imp = p.body.vel.clone().normalize().multiplyScalar(p.body.massa * p.body.vel.length() * 2.2);
          alvoHit.body.aplicarImpulso(imp);
          if (p.escola === 'fogo') alvoHit.queimando = Math.max(alvoHit.queimando || 0, 4);
          if (p.escola === 'agua') alvoHit.molhado = 10;
          if (p.escola === 'raio') alvoHit.stun = Math.max(alvoHit.stun || 0, 0.35);
        }
        this.explosaoVisual(p.body.pos, ESCOLAS[p.escola].cor, alvoHit ? 1.4 : 0.9);
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.projeteis.splice(i, 1);
      }
    }

    // Muros de chama
    for (let i = this.muros.length - 1; i >= 0; i--) {
      const w = this.muros[i];
      w.t += dt;
      w.mesh.material.opacity = 0.35 + Math.sin(w.t * 12) * 0.2;
      for (const alvo of this.game.alvosDe(w.dono)) {
        if (alvo.body.pos.distanceTo(w.mesh.position) < 6.5) {
          this.game.aplicarDano(alvo, w.dano * dt, w.dono, w.escola);
          alvo.queimando = 2;
        }
      }
      if (w.t > w.dur) { this.scene.remove(w.mesh); this.muros.splice(i, 1); }
    }

    // Runas armadilha
    for (let i = this.runas.length - 1; i >= 0; i--) {
      const r = this.runas[i];
      r.t += dt;
      r.mesh.material.opacity = 0.3 + Math.sin(r.t * 4) * 0.2;
      let disparou = false;
      for (const alvo of this.game.alvosDe(r.dono)) {
        if (alvo.body.pos.distanceTo(r.pos) < r.raio) {
          this.game.aplicarDano(alvo, r.dano, r.dono, 'runica');
          alvo.body.aplicarImpulso(new THREE.Vector3(0, 1, 0).multiplyScalar(r.dano * 30));
          disparou = true;
        }
      }
      if (disparou || r.t > r.dur) {
        if (disparou) this.explosaoVisual(r.pos, '#ff5533', 2.4);
        this.scene.remove(r.mesh); this.runas.splice(i, 1);
      }
    }

    // Efeitos visuais
    for (let i = this.efeitos.length - 1; i >= 0; i--) {
      const e = this.efeitos[i];
      e.t += dt;
      const k = e.t / e.dur;
      if (e.tipo === 'expandir') { e.mesh.scale.setScalar(0.1 + k * 1.1); e.mesh.material.opacity = 0.55 * (1 - k); if (e.luz) e.luz.intensity = 200 * (1 - k); }
      else if (e.tipo === 'sumir') { e.mesh.material.opacity = 1 - k; }
      else if (e.tipo === 'particula') {
        e.mesh.position.addScaledVector(e.vel, dt);
        e.vel.y += G * 0.4 * dt;
        e.mesh.material.opacity = 1 - k;
      }
      if (k >= 1) {
        this.scene.remove(e.mesh);
        if (e.luz) this.scene.remove(e.luz);
        this.efeitos.splice(i, 1);
      }
    }
  }

  explosaoVisual(pos, cor, escala = 1) {
    const c = new THREE.Color(cor);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.16 * escala, 6, 5),
        new THREE.MeshBasicMaterial({ color: c, transparent: true }));
      m.position.copy(pos);
      this.scene.add(m);
      const v = new THREE.Vector3((Math.random() - 0.5), Math.random(), (Math.random() - 0.5)).multiplyScalar(7 * escala);
      this.efeitos.push({ mesh: m, vel: v, t: 0, dur: 0.6, tipo: 'particula' });
    }
    const flash = new THREE.PointLight(c, 90 * escala, 20 * escala, 2);
    flash.position.copy(pos);
    this.scene.add(flash);
    const holder = new THREE.Mesh(new THREE.SphereGeometry(0.01), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
    this.scene.add(holder);
    this.efeitos.push({ mesh: holder, luz: flash, t: 0, dur: 0.25, tipo: 'expandir' });
  }
}
