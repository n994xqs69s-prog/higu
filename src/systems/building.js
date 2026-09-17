import * as THREE from 'three';
import { Textures } from './textures.js';
import { heightAt } from './world.js';

// ---------------------------------------------------------------------------
// Construção de base com grade 2 m, snap ao terreno, materiais com
// propriedades físicas reais (massa, resistência, condutividade,
// inflamabilidade) e verificação de SUPORTE ESTRUTURAL: peças sem apoio caem.
// ---------------------------------------------------------------------------

export const GRID = 2;

export const MATERIAIS = {
  madeira: { nome: 'Madeira', tex: 'plank', massa: 45, vida: 60, inflam: 0.9, cond: 0.05, custo: 4, cor: 0xa8895f,
    nota: 'Leve e barata. Queima fácil e conduz mal eletricidade — bom isolante, péssimo contra fogo.' },
  pedra: { nome: 'Pedra', tex: 'stonebrick', massa: 320, vida: 200, inflam: 0.0, cond: 0.2, custo: 8, cor: 0x9a9a9a,
    nota: 'Pesada e resistente. Exige base sólida: pedra sem apoio desaba com o próprio peso.' },
  metal: { nome: 'Aço Rúnico', tex: 'metal', massa: 260, vida: 320, inflam: 0.0, cond: 1.0, custo: 16, cor: 0xb0b8c0,
    nota: 'O mais forte — e um para-raios perfeito. Uma base toda de metal eletrocuta quem está dentro.' },
  cristal: { nome: 'Cristal de Mana', tex: 'crystal', massa: 90, vida: 120, inflam: 0.0, cond: 0.6, custo: 24, cor: 0x88ccff,
    nota: 'Regenera mana de quem estiver perto e brilha à noite. Estilhaça sob impacto pesado.' },
};

export const PECAS = {
  piso:    { nome: 'Piso',    dim: [GRID, 0.3, GRID], offset: [0, 0.15, 0] },
  parede:  { nome: 'Parede',  dim: [GRID, GRID, 0.3], offset: [0, GRID / 2, 0] },
  pilar:   { nome: 'Pilar',   dim: [0.45, GRID, 0.45], offset: [0, GRID / 2, 0] },
  rampa:   { nome: 'Rampa',   dim: [GRID, 0.3, GRID * 1.42], offset: [0, GRID / 2, 0], rampa: true },
  teto:    { nome: 'Teto',    dim: [GRID, 0.3, GRID], offset: [0, GRID, 0] },
  porta:   { nome: 'Portal',  dim: [GRID, GRID, 0.3], offset: [0, GRID / 2, 0], vazado: true },
};

export class BuildSystem {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.pecas = [];
    this.ativo = false;
    this.peca = 'parede';
    this.material = 'madeira';
    this.rot = 0;
    this.ghost = null;
    this.recursos = { madeira: 200, pedra: 120, metal: 40, cristal: 12 };
  }

  toggle() {
    this.ativo = !this.ativo;
    if (this.ativo) this.criarGhost(); else this.removerGhost();
    return this.ativo;
  }

  removerGhost() { if (this.ghost) { this.scene.remove(this.ghost); this.ghost = null; } }

  criarGhost() {
    this.removerGhost();
    const p = PECAS[this.peca];
    const geo = new THREE.BoxGeometry(...p.dim);
    const mat = new THREE.MeshBasicMaterial({ color: 0x66ff99, transparent: true, opacity: 0.4, wireframe: false });
    this.ghost = new THREE.Mesh(geo, mat);
    this.scene.add(this.ghost);
  }

  snap(pos) {
    return new THREE.Vector3(
      Math.round(pos.x / GRID) * GRID,
      0,
      Math.round(pos.z / GRID) * GRID
    );
  }

  /** Verificação estrutural: peça precisa estar no solo ou adjacente a outra. */
  temSuporte(pos, y) {
    if (y <= heightAt(pos.x, pos.z) + 0.6) return true;
    for (const pc of this.pecas) {
      if (pc.destruida) continue;
      const d = Math.hypot(pc.pos.x - pos.x, pc.pos.z - pos.z);
      const dy = Math.abs(pc.pos.y - y);
      if (d <= GRID * 1.05 && dy <= GRID * 1.05) return true;
    }
    return false;
  }

  atualizarGhost(alvoPos) {
    if (!this.ativo || !this.ghost) return null;
    const p = PECAS[this.peca];
    const s = this.snap(alvoPos);
    let y = heightAt(s.x, s.z);
    // empilhar sobre peça existente
    for (const pc of this.pecas) {
      if (pc.destruida) continue;
      if (Math.abs(pc.pos.x - s.x) < 0.1 && Math.abs(pc.pos.z - s.z) < 0.1) {
        y = Math.max(y, pc.pos.y + (PECAS[pc.peca].dim[1] || GRID));
      }
    }
    const pos = new THREE.Vector3(s.x, y + p.offset[1], s.z);
    this.ghost.position.copy(pos);
    this.ghost.rotation.y = this.rot;
    const ok = this.temSuporte(s, y) && this.recursos[this.material] >= MATERIAIS[this.material].custo;
    this.ghost.material.color.setHex(ok ? 0x66ff99 : 0xff5555);
    return { pos, base: y, ok };
  }

  colocar(alvoPos) {
    const info = this.atualizarGhost(alvoPos);
    if (!info || !info.ok) return { ok: false, msg: info && !info.ok ? 'Sem suporte estrutural ou recursos insuficientes.' : '' };
    const m = MATERIAIS[this.material];
    this.recursos[this.material] -= m.custo;

    const p = PECAS[this.peca];
    const geo = new THREE.BoxGeometry(...p.dim);
    const mat = new THREE.MeshStandardMaterial({
      map: Textures.get(m.tex, this.peca === 'pilar' ? 1 : 2), color: m.cor,
      roughness: this.material === 'metal' ? 0.35 : 0.9,
      metalness: this.material === 'metal' ? 0.7 : 0.05,
      emissive: this.material === 'cristal' ? 0x2266aa : 0x000000,
      emissiveIntensity: this.material === 'cristal' ? 0.8 : 0,
      transparent: this.material === 'cristal', opacity: this.material === 'cristal' ? 0.85 : 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(info.pos);
    mesh.rotation.y = this.rot;
    if (p.rampa) mesh.rotation.x = -0.6;
    mesh.castShadow = mesh.receiveShadow = true;
    this.scene.add(mesh);

    const col = {
      type: 'box', x: info.pos.x, y: info.base, z: info.pos.z,
      hw: p.dim[0] / 2, hh: p.dim[1], hd: p.dim[2] / 2, rot: this.rot,
      tag: 'construcao', mesh,
    };
    this.game.colliders.push(col);

    const peca = {
      peca: this.peca, material: this.material, pos: info.pos.clone(), rot: this.rot,
      mesh, col, vida: m.vida, vidaMax: m.vida, massa: m.massa, destruida: false,
    };
    this.pecas.push(peca);
    if (this.material === 'cristal') {
      const l = new THREE.PointLight(0x66aaff, 12, 14, 2);
      l.position.copy(info.pos);
      this.scene.add(l);
      peca.luz = l;
    }
    this.game.quests.construiu();
    return { ok: true, peca };
  }

  remover(alvoPos) {
    let melhor = null, dist = 3.5;
    for (const pc of this.pecas) {
      if (pc.destruida) continue;
      const d = pc.pos.distanceTo(alvoPos);
      if (d < dist) { dist = d; melhor = pc; }
    }
    if (!melhor) return false;
    this.destruir(melhor, true);
    return true;
  }

  danificar(pos, raio, dano, escola) {
    let atingiu = 0;
    for (const pc of this.pecas) {
      if (pc.destruida) continue;
      if (pc.pos.distanceTo(pos) > raio) continue;
      const m = MATERIAIS[pc.material];
      let d = dano;
      if (escola === 'fogo') d *= 0.5 + m.inflam * 1.8;
      if (escola === 'raio') d *= 0.5 + m.cond * 1.2;
      if (escola === 'terra') d *= 1.4;
      pc.vida -= d;
      atingiu++;
      if (pc.vida <= 0) this.destruir(pc);
    }
    if (atingiu) this.colapsar();
    return atingiu;
  }

  destruir(pc, devolver = false) {
    pc.destruida = true;
    pc.col.destruido = true;
    this.scene.remove(pc.mesh);
    if (pc.luz) this.scene.remove(pc.luz);
    if (devolver) this.recursos[pc.material] += Math.floor(MATERIAIS[pc.material].custo * 0.6);
  }

  /** Propaga colapso: peças que perderam suporte caem. */
  colapsar() {
    let mudou = true, voltas = 0;
    while (mudou && voltas++ < 6) {
      mudou = false;
      for (const pc of this.pecas) {
        if (pc.destruida) continue;
        const baseY = pc.pos.y - (PECAS[pc.peca].offset[1] || 0);
        if (!this.temSuporteExcluindo(pc, baseY)) {
          this.game.log(`💥 ${MATERIAIS[pc.material].nome} sem apoio: a estrutura desaba.`, 'aviso');
          this.destruir(pc);
          mudou = true;
        }
      }
    }
  }

  temSuporteExcluindo(alvo, y) {
    if (y <= heightAt(alvo.pos.x, alvo.pos.z) + 0.8) return true;
    for (const pc of this.pecas) {
      if (pc.destruida || pc === alvo) continue;
      const d = Math.hypot(pc.pos.x - alvo.pos.x, pc.pos.z - alvo.pos.z);
      const dy = pc.pos.y - alvo.pos.y;
      if (d <= GRID * 1.05 && dy < 0.1 && dy > -GRID * 1.1) return true;
      if (d < 0.2 && Math.abs(dy) <= GRID * 1.05) return true;
    }
    return false;
  }

  serializar() {
    return {
      recursos: this.recursos,
      pecas: this.pecas.filter(p => !p.destruida).map(p => ({
        peca: p.peca, material: p.material, x: p.pos.x, y: p.pos.y, z: p.pos.z, rot: p.rot,
      })),
    };
  }

  carregar(d) {
    if (!d) return;
    Object.assign(this.recursos, d.recursos || {});
    const bkPeca = this.peca, bkMat = this.material, bkRot = this.rot;
    (d.pecas || []).forEach(p => {
      this.peca = p.peca; this.material = p.material; this.rot = p.rot;
      this.colocarEm(new THREE.Vector3(p.x, p.y, p.z));
    });
    this.peca = bkPeca; this.material = bkMat; this.rot = bkRot;
  }

  colocarEm(pos) {
    const p = PECAS[this.peca], m = MATERIAIS[this.material];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...p.dim), new THREE.MeshStandardMaterial({
      map: Textures.get(m.tex, 2), color: m.cor, roughness: 0.9,
    }));
    mesh.position.copy(pos); mesh.rotation.y = this.rot;
    mesh.castShadow = mesh.receiveShadow = true;
    this.scene.add(mesh);
    const base = pos.y - p.offset[1];
    const col = { type: 'box', x: pos.x, y: base, z: pos.z, hw: p.dim[0] / 2, hh: p.dim[1], hd: p.dim[2] / 2, rot: this.rot, tag: 'construcao', mesh };
    this.game.colliders.push(col);
    this.pecas.push({ peca: this.peca, material: this.material, pos: pos.clone(), rot: this.rot, mesh, col, vida: m.vida, vidaMax: m.vida, massa: m.massa, destruida: false });
  }
}
