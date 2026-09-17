import * as THREE from 'three';
import { Textures } from './textures.js';
import { heightAt } from './world.js';

// ---------------------------------------------------------------------------
// MASMORRAS PROCEDURAIS — geradas por semente. A mesma semente sempre produz
// a mesma masmorra, então uma "Cripta #8241" é a mesma para todo mundo e pode
// ser compartilhada só pelo número.
//
// Algoritmo: salas retangulares distribuídas sem sobreposição, ligadas por
// corredores em L, com salas especiais (tesouro, chefe, armadilha, santuário)
// e geometria 3D real — paredes viram colliders, portas são vãos de verdade.
// ---------------------------------------------------------------------------

const TIPOS = {
  cripta:    { nome: 'Cripta', cor: 0x5a5248, tex: 'stonebrick', luz: 0x6688aa, inimigos: ['espectro', 'cavaleiro_caido'], desc: 'Corredores de pedra e nichos funerários. O ar não se move.' },
  caverna:   { nome: 'Caverna', cor: 0x6a5a4a, tex: 'rock', luz: 0x88aa66, inimigos: ['aranha_mana', 'lobo_veu', 'golem_pedra'], desc: 'Túneis naturais escavados por água e algo mais.' },
  forja:     { nome: 'Forja Abandonada', cor: 0x7a4a32, tex: 'metal', luz: 0xff7733, inimigos: ['elemental_chama', 'golem_pedra'], desc: 'Fornalhas que ainda queimam sem combustível.' },
  santuario: { nome: 'Santuário Selado', cor: 0x4a4a7a, tex: 'runes', luz: 0xaa66ff, inimigos: ['espectro', 'cavaleiro_caido'], desc: 'Selado por dentro. Alguém quis manter algo aqui.' },
  covil:     { nome: 'Covil', cor: 0x4a3a2a, tex: 'dirt', luz: 0xaa6644, inimigos: ['goblin', 'lobo_veu'], desc: 'Ossos roídos, fogueiras recentes, cheiro forte.' },
  laboratorio:{ nome: 'Laboratório Arcano', cor: 0x3a5a5a, tex: 'crystal', luz: 0x44ccdd, inimigos: ['golem_pedra', 'aranha_mana', 'espectro'], desc: 'Experimentos que não deveriam ter continuado.' },
};

const NOMES_A = ['Cripta','Poço','Abrigo','Câmara','Galeria','Fossa','Santuário','Cova','Túnel','Refúgio','Catacumba','Silo'];
const NOMES_B = ['dos Esquecidos','de Ossar','do Lamento','Rúnica','do Primeiro Selo','Submersa','de Vhorn','das Mil Vozes','Inacabada','do Nome Perdido','de Ferro Frio','dos Sete'];

function rng(seed) {
  let s = (seed ^ 0x6d2b79f5) >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Descreve uma masmorra a partir da semente (sem construir geometria). */
export function descreverMasmorra(seed) {
  const r = rng(seed);
  const tipos = Object.keys(TIPOS);
  const tipo = tipos[Math.floor(r() * tipos.length)];
  const nSalas = 5 + Math.floor(r() * 10);
  const nivel = 1 + Math.floor(r() * 18);
  return {
    seed, tipo, def: TIPOS[tipo],
    nome: `${NOMES_A[Math.floor(r() * NOMES_A.length)]} ${NOMES_B[Math.floor(r() * NOMES_B.length)]}`,
    nSalas, nivel,
    andares: 1 + Math.floor(r() * 3),
    temChefe: r() < 0.55,
    temTesouro: true,
    dificuldade: nivel < 5 ? 'Baixa' : nivel < 11 ? 'Média' : nivel < 16 ? 'Alta' : 'Letal',
  };
}

/** Constrói a geometria 3D da masmorra e devolve colliders + spawns. */
export function gerarMasmorra(seed, scene, origem = new THREE.Vector3(0, 0, 0)) {
  const info = descreverMasmorra(seed);
  const r = rng(seed ^ 0x1234);
  const D = info.def;
  const grupo = new THREE.Group();
  const colliders = [];
  const spawns = [];
  const salas = [];
  const H = 5;          // pé-direito
  const ESP = 0.6;      // espessura de parede

  const matChao = new THREE.MeshStandardMaterial({ map: Textures.get(D.tex, 6), color: D.cor, roughness: 0.96 });
  const matParede = new THREE.MeshStandardMaterial({ map: Textures.get(D.tex, 3), color: D.cor, roughness: 0.92 });
  const matTeto = new THREE.MeshStandardMaterial({ map: Textures.get(D.tex, 5), color: D.cor * 0.7, roughness: 1, side: THREE.DoubleSide });

  // --- 1. Distribui salas sem sobreposição ---------------------------------
  let tentativas = 0;
  while (salas.length < info.nSalas && tentativas++ < 400) {
    const w = 10 + Math.floor(r() * 16);
    const d = 10 + Math.floor(r() * 16);
    const x = (r() - 0.5) * 150;
    const z = (r() - 0.5) * 150;
    const nova = { x, z, w, d };
    const colide = salas.some(s =>
      Math.abs(s.x - x) < (s.w + w) / 2 + 7 && Math.abs(s.z - z) < (s.d + d) / 2 + 7);
    if (!colide) salas.push(nova);
  }
  if (!salas.length) salas.push({ x: 0, z: 0, w: 16, d: 16 });

  // Papéis: entrada, chefe (mais distante), tesouro, resto normal
  salas.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  salas[0].papel = 'entrada';
  if (info.temChefe && salas.length > 2) salas[salas.length - 1].papel = 'chefe';
  const idxTes = 1 + Math.floor(r() * Math.max(1, salas.length - 2));
  if (!salas[idxTes].papel) salas[idxTes].papel = 'tesouro';
  salas.forEach(s => { if (!s.papel) s.papel = r() < 0.25 ? 'armadilha' : 'normal'; });

  const yBase = origem.y;

  // --- 2. Piso e teto por sala ---------------------------------------------
  for (const s of salas) {
    const piso = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.5, s.d), matChao);
    piso.position.set(origem.x + s.x, yBase - 0.25, origem.z + s.z);
    piso.receiveShadow = true;
    grupo.add(piso);

    const teto = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.d).rotateX(Math.PI / 2), matTeto);
    teto.position.set(origem.x + s.x, yBase + H, origem.z + s.z);
    grupo.add(teto);

    // luz ambiente da sala
    const cor = s.papel === 'chefe' ? 0xff4444 : s.papel === 'tesouro' ? 0xffcc44 : D.luz;
    const luz = new THREE.PointLight(cor, s.papel === 'chefe' ? 55 : 26, Math.max(s.w, s.d) * 1.8, 2);
    luz.position.set(origem.x + s.x, yBase + H * 0.75, origem.z + s.z);
    grupo.add(luz);

    // Conteúdo por papel
    if (s.papel === 'tesouro') {
      const bau = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.2),
        new THREE.MeshStandardMaterial({ map: Textures.get('wood', 1), color: 0xc8a050, emissive: 0x442200, emissiveIntensity: 0.6 }));
      bau.position.set(origem.x + s.x, yBase + 0.6, origem.z + s.z);
      bau.castShadow = true;
      bau.userData.bau = { seed: seed ^ (s.x | 0), aberto: false };
      grupo.add(bau);
      spawns.push({ tipo: 'bau', x: origem.x + s.x, y: yBase, z: origem.z + s.z, mesh: bau });
    }
    if (s.papel === 'chefe') {
      const pilar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, H, 8),
        new THREE.MeshStandardMaterial({ map: Textures.get('runes', 2), emissive: 0x660022, emissiveIntensity: 1.2 }));
      pilar.position.set(origem.x + s.x, yBase + H / 2, origem.z + s.z - s.d / 2 + 2);
      grupo.add(pilar);
      spawns.push({ tipo: 'chefe', x: origem.x + s.x, y: yBase, z: origem.z + s.z,
        inimigo: D.inimigos[Math.floor(r() * D.inimigos.length)] });
    }
    if (s.papel === 'armadilha') {
      spawns.push({ tipo: 'armadilha', x: origem.x + s.x, y: yBase, z: origem.z + s.z, dano: 20 + info.nivel * 4 });
    }
    if (s.papel === 'normal' || s.papel === 'armadilha') {
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        spawns.push({
          tipo: 'inimigo',
          x: origem.x + s.x + (r() - 0.5) * s.w * 0.7,
          y: yBase, z: origem.z + s.z + (r() - 0.5) * s.d * 0.7,
          inimigo: D.inimigos[Math.floor(r() * D.inimigos.length)],
        });
      }
    }
    if (s.papel === 'entrada') {
      spawns.push({ tipo: 'entrada', x: origem.x + s.x, y: yBase, z: origem.z + s.z });
    }
  }

  // --- 3. Corredores em L ligando salas consecutivas -----------------------
  const corredores = [];
  for (let i = 1; i < salas.length; i++) {
    const a = salas[i - 1], b = salas[i];
    corredores.push({ x1: a.x, z1: a.z, x2: b.x, z2: a.z });
    corredores.push({ x1: b.x, z1: a.z, x2: b.x, z2: b.z });
  }
  // alguns atalhos extras
  for (let i = 0; i < Math.floor(salas.length / 3); i++) {
    const a = salas[Math.floor(r() * salas.length)], b = salas[Math.floor(r() * salas.length)];
    if (a !== b) { corredores.push({ x1: a.x, z1: a.z, x2: b.x, z2: a.z }); corredores.push({ x1: b.x, z1: a.z, x2: b.x, z2: b.z }); }
  }
  const LARG = 5;
  for (const c of corredores) {
    const cx = (c.x1 + c.x2) / 2, cz = (c.z1 + c.z2) / 2;
    const comp = Math.hypot(c.x2 - c.x1, c.z2 - c.z1) + LARG;
    if (comp < LARG + 0.5) continue;
    const horiz = Math.abs(c.x2 - c.x1) > Math.abs(c.z2 - c.z1);
    const w = horiz ? comp : LARG, d = horiz ? LARG : comp;
    const piso = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), matChao);
    piso.position.set(origem.x + cx, yBase - 0.25, origem.z + cz);
    piso.receiveShadow = true;
    grupo.add(piso);
    const teto = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2), matTeto);
    teto.position.set(origem.x + cx, yBase + H, origem.z + cz);
    grupo.add(teto);
    if (r() < 0.35) {
      const l = new THREE.PointLight(D.luz, 10, 14, 2);
      l.position.set(origem.x + cx, yBase + H * 0.7, origem.z + cz);
      grupo.add(l);
    }
  }

  // --- 4. Paredes: qualquer borda de sala que não dê para um corredor ------
  const dentroDeCorredor = (px, pz) => corredores.some(c => {
    const minx = Math.min(c.x1, c.x2) - LARG / 2, maxx = Math.max(c.x1, c.x2) + LARG / 2;
    const minz = Math.min(c.z1, c.z2) - LARG / 2, maxz = Math.max(c.z1, c.z2) + LARG / 2;
    return px >= minx && px <= maxx && pz >= minz && pz <= maxz;
  });

  for (const s of salas) {
    const lados = [
      { eixo: 'z', val: s.z - s.d / 2, ini: s.x - s.w / 2, fim: s.x + s.w / 2 },
      { eixo: 'z', val: s.z + s.d / 2, ini: s.x - s.w / 2, fim: s.x + s.w / 2 },
      { eixo: 'x', val: s.x - s.w / 2, ini: s.z - s.d / 2, fim: s.z + s.d / 2 },
      { eixo: 'x', val: s.x + s.w / 2, ini: s.z - s.d / 2, fim: s.z + s.d / 2 },
    ];
    for (const L of lados) {
      const passo = 2;
      for (let p = L.ini; p < L.fim; p += passo) {
        const px = L.eixo === 'z' ? p + passo / 2 : L.val;
        const pz = L.eixo === 'z' ? L.val : p + passo / 2;
        if (dentroDeCorredor(px, pz)) continue;   // é um vão de porta
        const w = L.eixo === 'z' ? passo : ESP;
        const d = L.eixo === 'z' ? ESP : passo;
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), matParede);
        m.position.set(origem.x + px, yBase + H / 2, origem.z + pz);
        m.castShadow = m.receiveShadow = true;
        grupo.add(m);
        colliders.push({ type: 'box', x: origem.x + px, y: yBase, z: origem.z + pz,
          hw: w / 2, hh: H, hd: d / 2, rot: 0, tag: 'parede_masmorra' });
      }
    }
  }

  scene.add(grupo);
  return { info, grupo, colliders, spawns, salas, origem: origem.clone() };
}

/** Distribui masmorras pelo mundo de forma determinística. */
export function masmorrasDoMundo(qtd = 40, tamanhoMundo = 1200) {
  const out = [];
  for (let i = 0; i < qtd; i++) {
    const r = rng(i * 7919 + 13);
    const x = (r() - 0.5) * tamanhoMundo * 0.9;
    const z = (r() - 0.5) * tamanhoMundo * 0.9;
    const seed = Math.floor(r() * 99999);
    out.push({ ...descreverMasmorra(seed), x, z, y: heightAt(x, z), entrada: true });
  }
  return out;
}

export { TIPOS as TIPOS_MASMORRA };
