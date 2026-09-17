import * as THREE from 'three';
import { Textures } from './textures.js';
import { RACES, ORIGENS, CLASSES, ESCOLAS, TRACOS, ATTR_BASE } from './chardata.js';
import { capacidadeCarga } from './physics.js';

// ---------------------------------------------------------------------------
// Avatar 3D procedural: montado por proporções (altura, massa, musculatura,
// ombros) e cores escolhidas. Sem assets — é geometria pura articulada num
// esqueleto simples de grupos, animado por senoides (caminhada, corrida,
// conjuração, ataque).
// ---------------------------------------------------------------------------

export function buildAvatar(build) {
  const race = RACES[build.raca];
  const h = build.corpo.altura;
  const musc = build.corpo.musculo / 100;
  const ombros = 0.5 + build.corpo.ombros / 100;
  const densidade = build.corpo.massa / (h * 40);   // grosseiro: "gordura+músculo"
  const largura = THREE.MathUtils.clamp(0.16 + densidade * 0.055 + musc * 0.05, 0.14, 0.42);

  const pele = new THREE.MeshStandardMaterial({ color: new THREE.Color(build.cores.pele), roughness: 0.75 });
  const roupa = new THREE.MeshStandardMaterial({ map: Textures.get('cloth', 2), color: new THREE.Color(build.cores.roupa), roughness: 0.9 });
  const arma = new THREE.MeshStandardMaterial({ map: Textures.get('metal', 1), metalness: 0.7, roughness: 0.35 });
  const cabelo = new THREE.MeshStandardMaterial({ color: new THREE.Color(build.cores.cabelo), roughness: 0.85 });
  const brilho = new THREE.MeshStandardMaterial({
    color: new THREE.Color(ESCOLAS[build.escolas[0]]?.cor || '#88aaff'),
    emissive: new THREE.Color(ESCOLAS[build.escolas[0]]?.cor || '#88aaff'), emissiveIntensity: 1.6,
  });

  const root = new THREE.Group();
  const corpo = new THREE.Group();
  root.add(corpo);

  const torsoH = h * 0.32, pernaH = h * 0.46, bracoH = h * 0.32, cabecaR = h * 0.075;

  // Quadril / torso
  const quadril = new THREE.Group();
  quadril.position.y = pernaH;
  corpo.add(quadril);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(largura * ombros, torsoH * 0.72, 4, 12), roupa);
  torso.position.y = torsoH * 0.52;
  torso.scale.set(1.15, 1, 0.72);
  torso.castShadow = true;
  quadril.add(torso);

  // Ombreiras (denotam classe)
  const ombreiraGeo = new THREE.SphereGeometry(largura * 0.72, 10, 8);
  const omL = new THREE.Mesh(ombreiraGeo, build.classe === 'guerreiro' ? arma : roupa);
  const omR = omL.clone();
  omL.position.set(-largura * ombros * 1.25, torsoH * 0.92, 0);
  omR.position.set(largura * ombros * 1.25, torsoH * 0.92, 0);
  quadril.add(omL, omR);

  // Pescoço + cabeça
  const cabeca = new THREE.Group();
  cabeca.position.y = torsoH * 1.05;
  const craneo = new THREE.Mesh(new THREE.SphereGeometry(cabecaR, 16, 14), pele);
  craneo.scale.set(0.92, 1.1, 1.0);
  craneo.position.y = cabecaR;
  craneo.castShadow = true;
  cabeca.add(craneo);

  const cab = new THREE.Mesh(new THREE.SphereGeometry(cabecaR * 1.06, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), cabelo);
  cab.position.y = cabecaR * 1.05;
  cabeca.add(cab);

  // Olhos brilhantes
  const olhoGeo = new THREE.SphereGeometry(cabecaR * 0.16, 8, 6);
  const olhoMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(build.cores.olhos), emissive: new THREE.Color(build.cores.olhos), emissiveIntensity: 1.2 });
  const oL = new THREE.Mesh(olhoGeo, olhoMat), oR = new THREE.Mesh(olhoGeo, olhoMat);
  oL.position.set(-cabecaR * 0.33, cabecaR * 1.02, cabecaR * 0.84);
  oR.position.set(cabecaR * 0.33, cabecaR * 1.02, cabecaR * 0.84);
  cabeca.add(oL, oR);

  // Traços raciais
  if (build.raca === 'elfo' || build.raca === 'feerico') {
    const orelha = new THREE.Mesh(new THREE.ConeGeometry(cabecaR * 0.2, cabecaR * 0.9, 5), pele);
    const oe = orelha.clone(); 
    orelha.position.set(-cabecaR * 0.95, cabecaR * 1.1, 0); orelha.rotation.z = 0.9;
    oe.position.set(cabecaR * 0.95, cabecaR * 1.1, 0); oe.rotation.z = -0.9;
    cabeca.add(orelha, oe);
  }
  if (build.raca === 'draconato') {
    for (let i = 0; i < 4; i++) {
      const chifre = new THREE.Mesh(new THREE.ConeGeometry(cabecaR * 0.13, cabecaR * (0.8 - i * 0.12), 5),
        new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.6 }));
      chifre.position.set((i % 2 ? 1 : -1) * cabecaR * 0.5, cabecaR * (1.5 - Math.floor(i / 2) * 0.35), -cabecaR * 0.2 * Math.floor(i / 2));
      chifre.rotation.x = -0.5;
      cabeca.add(chifre);
    }
  }
  if (build.raca === 'orc') {
    const presa = new THREE.Mesh(new THREE.ConeGeometry(cabecaR * 0.09, cabecaR * 0.35, 4), new THREE.MeshStandardMaterial({ color: 0xf0eadc }));
    const p2 = presa.clone();
    presa.position.set(-cabecaR * 0.28, cabecaR * 0.66, cabecaR * 0.72);
    p2.position.set(cabecaR * 0.28, cabecaR * 0.66, cabecaR * 0.72);
    cabeca.add(presa, p2);
  }
  if (build.raca === 'anao') {
    const barba = new THREE.Mesh(new THREE.ConeGeometry(cabecaR * 0.78, cabecaR * 1.9, 8), cabelo);
    barba.position.set(0, cabecaR * 0.25, cabecaR * 0.44);
    barba.rotation.x = Math.PI;
    cabeca.add(barba);
  }
  if (build.raca === 'golem') {
    craneo.material = new THREE.MeshStandardMaterial({ map: Textures.get('rock', 1), roughness: 0.95, flatShading: true });
    torso.material = new THREE.MeshStandardMaterial({ map: Textures.get('rock', 2), roughness: 0.95, flatShading: true });
    const nucleo = new THREE.Mesh(new THREE.IcosahedronGeometry(largura * 0.4, 1), brilho);
    nucleo.position.set(0, torsoH * 0.55, largura * 0.62);
    quadril.add(nucleo);
  }
  if (build.raca === 'feerico') {
    const asaGeo = new THREE.CircleGeometry(h * 0.34, 12, 0, Math.PI);
    const asaMat = new THREE.MeshStandardMaterial({
      color: 0xbfe6ff, emissive: 0x88ccff, emissiveIntensity: 0.9,
      transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    });
    const a1 = new THREE.Mesh(asaGeo, asaMat), a2 = new THREE.Mesh(asaGeo, asaMat);
    a1.position.set(-largura, torsoH * 0.8, -largura * 0.6); a1.rotation.set(0.2, -0.9, 0.4);
    a2.position.set(largura, torsoH * 0.8, -largura * 0.6); a2.rotation.set(0.2, 0.9, -0.4);
    a1.name = 'asaL'; a2.name = 'asaR';
    quadril.add(a1, a2);
  }
  quadril.add(cabeca);

  // Braços
  function braco(lado) {
    const g = new THREE.Group();
    g.position.set(lado * largura * ombros * 1.3, torsoH * 0.9, 0);
    const sup = new THREE.Mesh(new THREE.CapsuleGeometry(largura * (0.3 + musc * 0.16), bracoH * 0.46, 3, 8), pele);
    sup.position.y = -bracoH * 0.28; sup.castShadow = true;
    const ante = new THREE.Group();
    ante.position.y = -bracoH * 0.52;
    const inf = new THREE.Mesh(new THREE.CapsuleGeometry(largura * (0.26 + musc * 0.13), bracoH * 0.42, 3, 8), pele);
    inf.position.y = -bracoH * 0.26;
    const mao = new THREE.Mesh(new THREE.SphereGeometry(largura * 0.3, 8, 6), pele);
    mao.position.y = -bracoH * 0.5;
    ante.add(inf, mao);
    g.add(sup, ante);
    g.userData.ante = ante; g.userData.mao = mao;
    return g;
  }
  const bL = braco(-1), bR = braco(1);
  quadril.add(bL, bR);

  // Arma / foco na mão direita conforme classe
  const foco = new THREE.Group();
  if (build.classe === 'guerreiro') {
    const lamina = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.55, 0.16), arma);
    lamina.position.y = h * 0.25;
    const guarda = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.1), arma);
    foco.add(lamina, guarda);
  } else if (build.classe === 'patrulheiro') {
    const arco = new THREE.Mesh(new THREE.TorusGeometry(h * 0.28, 0.035, 6, 14, Math.PI * 1.3),
      new THREE.MeshStandardMaterial({ map: Textures.get('wood', 1) }));
    arco.rotation.y = Math.PI / 2;
    foco.add(arco);
  } else if (build.classe === 'artifice') {
    const chave = new THREE.Mesh(new THREE.BoxGeometry(0.1, h * 0.3, 0.1), arma);
    chave.position.y = h * 0.14;
    const eng = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 6, 8), arma);
    eng.position.y = h * 0.3;
    foco.add(chave, eng);
  } else {
    const cajado = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, h * 0.95, 6),
      new THREE.MeshStandardMaterial({ map: Textures.get('wood', 1) }));
    cajado.position.y = h * 0.28;
    const gema = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.055, 1), brilho);
    gema.position.y = h * 0.76;
    gema.name = 'gema';
    foco.add(cajado, gema);
    const luz = new THREE.PointLight(new THREE.Color(ESCOLAS[build.escolas[0]]?.cor || '#88aaff'), 4, 12, 2);
    luz.position.y = h * 0.76;
    foco.add(luz);
  }
  foco.position.y = -bracoH * 0.5;
  foco.rotation.x = -0.25;
  bR.userData.ante.add(foco);

  // Pernas
  function perna(lado) {
    const g = new THREE.Group();
    g.position.set(lado * largura * 0.55, 0, 0);
    const coxa = new THREE.Mesh(new THREE.CapsuleGeometry(largura * (0.38 + musc * 0.14), pernaH * 0.42, 3, 8), roupa);
    coxa.position.y = -pernaH * 0.26; coxa.castShadow = true;
    const canela = new THREE.Group();
    canela.position.y = -pernaH * 0.5;
    const cm = new THREE.Mesh(new THREE.CapsuleGeometry(largura * (0.3 + musc * 0.1), pernaH * 0.4, 3, 8), roupa);
    cm.position.y = -pernaH * 0.24;
    const pe = new THREE.Mesh(new THREE.BoxGeometry(largura * 0.72, 0.09, largura * 1.5), arma);
    pe.position.set(0, -pernaH * 0.47, largura * 0.3);
    canela.add(cm, pe);
    g.add(coxa, canela);
    g.userData.canela = canela;
    return g;
  }
  const pL = perna(-1), pR = perna(1);
  quadril.add(pL, pR);

  // Aura da escola primária
  const aura = new THREE.Mesh(
    new THREE.RingGeometry(largura * 2.2, largura * 2.8, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(ESCOLAS[build.escolas[0]]?.cor || '#88aaff'),
      transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    })
  );
  aura.position.y = 0.05;
  corpo.add(aura);

  root.userData = {
    quadril, cabeca, bL, bR, pL, pR, aura, torso, foco,
    altura: h, torsoH, pernaH, bracoH,
    fase: 0,
  };
  return root;
}

/** Animação procedural do avatar. */
export function animarAvatar(root, dt, estado) {
  const u = root.userData;
  const { velocidade = 0, noAr = false, conjurando = 0, atacando = 0, vivo = true } = estado;
  u.fase += dt * (2.2 + velocidade * 0.9);
  const sw = Math.sin(u.fase) * Math.min(1, velocidade / 5);
  const bob = Math.abs(Math.cos(u.fase)) * Math.min(1, velocidade / 6);

  if (!vivo) {
    u.quadril.rotation.x = THREE.MathUtils.lerp(u.quadril.rotation.x, -1.4, dt * 4);
    return;
  }

  u.pL.rotation.x = sw * 0.75;
  u.pR.rotation.x = -sw * 0.75;
  u.pL.userData.canela.rotation.x = Math.max(0, -sw) * 0.85;
  u.pR.userData.canela.rotation.x = Math.max(0, sw) * 0.85;
  u.quadril.position.y = u.pernaH + bob * 0.06;
  u.quadril.rotation.y = sw * 0.09;

  if (conjurando > 0) {
    u.bR.rotation.x = THREE.MathUtils.lerp(u.bR.rotation.x, -1.9, dt * 12);
    u.bR.rotation.z = THREE.MathUtils.lerp(u.bR.rotation.z, -0.35, dt * 12);
    u.bL.rotation.x = THREE.MathUtils.lerp(u.bL.rotation.x, -0.7, dt * 8);
  } else if (atacando > 0) {
    u.bR.rotation.x = THREE.MathUtils.lerp(u.bR.rotation.x, -2.6 + (1 - atacando) * 3.4, dt * 22);
    u.bL.rotation.x = THREE.MathUtils.lerp(u.bL.rotation.x, 0.5, dt * 10);
  } else {
    u.bR.rotation.x = THREE.MathUtils.lerp(u.bR.rotation.x, -sw * 0.6, dt * 8);
    u.bR.rotation.z = THREE.MathUtils.lerp(u.bR.rotation.z, 0.12, dt * 8);
    u.bL.rotation.x = THREE.MathUtils.lerp(u.bL.rotation.x, sw * 0.6, dt * 8);
  }
  if (noAr) {
    u.pL.rotation.x = THREE.MathUtils.lerp(u.pL.rotation.x, -0.5, dt * 8);
    u.pR.rotation.x = THREE.MathUtils.lerp(u.pR.rotation.x, 0.35, dt * 8);
  }
  if (u.aura) u.aura.rotation.y += dt * (0.6 + conjurando * 6);
}

// ---------------------------------------------------------------------------
// Ficha derivada: transforma as escolhas em números que o jogo usa.
// ---------------------------------------------------------------------------
export function computarFicha(build) {
  const race = RACES[build.raca];
  const origem = ORIGENS[build.origem];
  const cls = CLASSES[build.classe];

  const attrs = {};
  for (const k of ['forca', 'destreza', 'vigor', 'intelecto', 'espirito', 'carisma']) {
    attrs[k] = ATTR_BASE + (build.attrs[k] || 0) + (race.mods[k] || 0) + (origem.bonus[k] || 0);
  }
  let massa = build.corpo.massa;
  if (build.tracos.includes('peso_leve')) massa *= 0.75;

  const vidaMax = Math.round((60 + attrs.vigor * 9 + massa * 0.22) * cls.vida * (build.tracos.includes('cicatrizes') ? 1.15 : 1));
  const manaMax = Math.round((40 + attrs.intelecto * 11 + attrs.espirito * 5) * cls.mana * (build.tracos.includes('maldicao_veu') ? 1.25 : 1));
  const stamMax = Math.round((50 + attrs.vigor * 6 + attrs.destreza * 4) * cls.stam);

  const veloc = THREE.MathUtils.clamp(4.2 + attrs.destreza * 0.19 - (massa - 80) * 0.006, 2.2, 9.5);
  const pulo = THREE.MathUtils.clamp(6.4 + attrs.destreza * 0.19 - (massa - 80) * 0.008, 3.0, 12);
  const carga = capacidadeCarga(attrs.forca, massa, build.corpo.musculo);

  return {
    attrs, massa, vidaMax, manaMax, stamMax, veloc, pulo, carga,
    regenMana: 1.6 + attrs.espirito * 0.32,
    regenStam: 7 + attrs.vigor * 0.55,
    poderMagico: 0.55 + attrs.intelecto * 0.075,
    poderFisico: 0.5 + attrs.forca * 0.09 + build.corpo.musculo / 220,
    armadura: 0.02 * attrs.vigor + (build.raca === 'golem' ? 0.22 : 0) + (build.raca === 'draconato' ? 0.08 : 0),
    resistMagica: 0.02 * attrs.espirito + (build.raca === 'feerico' ? 0.25 : 0),
    alcance: race.fis.alcance * (build.corpo.altura / 1.8),
    tolFrio: race.fis.tolFrio * (1 + (100 - build.corpo.musculo) / 400),
    tolCalor: race.fis.tolCalor,
    nivel: build.nivel || 1,
    xp: build.xp || 0,
  };
}

export function xpParaNivel(n) { return Math.round(100 * Math.pow(n, 1.55)); }
