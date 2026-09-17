import * as THREE from 'three';
import { Textures } from './textures.js';
import { RACES, ORIGENS, CLASSES, ESCOLAS, TRACOS, ATTR_BASE } from './chardata.js';
import { capacidadeCarga } from './physics.js';

// ---------------------------------------------------------------------------
// Avatar 3D procedural, 100% data-driven: as peças anatômicas vêm de
// RACES[x].visual e a arma de CLASSES[x].arma. Nenhum `if (raca === '...')`.
// Sem assets: tudo é geometria gerada em runtime.
// ---------------------------------------------------------------------------

const ARMAS = {
  espada:         { tipo: 'lamina', comp: 0.55, cor: 0xc8ccd4 },
  espada_sagrada: { tipo: 'lamina', comp: 0.6, cor: 0xffe9b0, brilho: true },
  machado:        { tipo: 'machado', comp: 0.5, cor: 0xb0b4bc },
  maca:           { tipo: 'maca', comp: 0.45, cor: 0xa8a29a },
  adagas:         { tipo: 'adagas', comp: 0.22, cor: 0xd0d4dc },
  arco:           { tipo: 'arco', comp: 0.3, cor: 0x8a6a42 },
  cajado:         { tipo: 'cajado', comp: 0.95, cor: 0x7a5a3a },
  cajado_natural: { tipo: 'cajado', comp: 0.95, cor: 0x4a6a3a, folhas: true },
  grimorio:       { tipo: 'grimorio', comp: 0.3, cor: 0x3a2a4a },
  alaude:         { tipo: 'alaude', comp: 0.45, cor: 0xa07840 },
  foco_cristal:   { tipo: 'orbe', comp: 0.2, cor: 0xaa88ff },
  punhos:         { tipo: 'nenhuma' },
};

export function buildAvatar(build) {
  const race = RACES[build.raca] || RACES.humano;
  const cls = CLASSES[build.classe] || CLASSES.mago;
  const V = race.visual || {};
  const tags = race.tags || [];
  const h = build.corpo.altura;
  const musc = build.corpo.musculo / 100;
  const ombros = 0.5 + build.corpo.ombros / 100;
  const densidade = build.corpo.massa / (h * 40);
  let largura = THREE.MathUtils.clamp(0.16 + densidade * 0.055 + musc * 0.05, 0.13, 0.46);
  if (V.atarracado) largura *= 1.22;
  if (V.musculoso) largura *= 1.14;

  const escolaCor = ESCOLAS[build.escolas?.[0]]?.cor || '#88aaff';
  const corElem = build.elemento && race.elementos?.[build.elemento]?.cor;
  const corAura = corElem || escolaCor;

  const pele = new THREE.MeshStandardMaterial({
    color: new THREE.Color(build.cores.pele),
    roughness: V.escamas ? 0.55 : V.pelePetrea ? 0.95 : V.pelagem ? 0.88 : 0.75,
    flatShading: !!(V.pelePetrea || V.placas),
    ...(V.escamas ? { map: Textures.get('rock', 3), metalness: 0.12 } : {}),
    ...(V.placas ? { map: Textures.get('metal', 2), metalness: 0.65, roughness: 0.42 } : {}),
    ...(V.pelePetrea ? { map: Textures.get('rock', 2) } : {}),
  });
  const roupa = new THREE.MeshStandardMaterial({ map: Textures.get('cloth', 2), color: new THREE.Color(build.cores.roupa), roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ map: Textures.get('metal', 1), metalness: 0.7, roughness: 0.35 });
  const cabeloMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(build.cores.cabelo), roughness: 0.85 });
  const brilho = new THREE.MeshStandardMaterial({ color: new THREE.Color(corAura), emissive: new THREE.Color(corAura), emissiveIntensity: 1.8 });

  const root = new THREE.Group();
  const corpo = new THREE.Group();
  root.add(corpo);

  const torsoH = h * 0.32, pernaH = h * (V.atarracado ? 0.38 : 0.46), bracoH = h * 0.32;
  const cabecaR = h * (V.atarracado ? 0.088 : 0.075);

  const quadril = new THREE.Group();
  quadril.position.y = pernaH;
  corpo.add(quadril);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(largura * ombros, torsoH * 0.72, 4, 12), V.placas ? pele : roupa);
  torso.position.y = torsoH * 0.52;
  torso.scale.set(1.15, 1, 0.72);
  torso.castShadow = true;
  quadril.add(torso);

  // Casco (Tortle)
  if (V.casco) {
    const casco = new THREE.Mesh(new THREE.SphereGeometry(largura * 1.9, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ map: Textures.get('rock', 2), color: 0x5a6a3a, roughness: 0.9, flatShading: true }));
    casco.rotation.x = Math.PI * 0.52;
    casco.position.set(0, torsoH * 0.5, -largura * 0.75);
    casco.scale.set(1, 1.25, 1);
    casco.castShadow = true;
    quadril.add(casco);
    const peito = casco.clone();
    peito.rotation.x = -Math.PI * 0.52;
    peito.position.z = largura * 0.72;
    peito.scale.set(0.9, 1.1, 0.8);
    quadril.add(peito);
  }

  const ombreiraGeo = new THREE.SphereGeometry(largura * 0.72, 10, 8);
  const matOmb = (cls.tags || []).includes('metalico') ? metal : roupa;
  const omL = new THREE.Mesh(ombreiraGeo, matOmb), omR = new THREE.Mesh(ombreiraGeo, matOmb);
  omL.position.set(-largura * ombros * 1.25, torsoH * 0.92, 0);
  omR.position.set(largura * ombros * 1.25, torsoH * 0.92, 0);
  quadril.add(omL, omR);

  // Núcleo de mana (Warforged)
  if (V.nucleo) {
    const n = new THREE.Mesh(new THREE.IcosahedronGeometry(largura * 0.4, 1), brilho);
    n.position.set(0, torsoH * 0.6, largura * 0.66);
    quadril.add(n);
    quadril.add(new THREE.PointLight(new THREE.Color(corAura), 6, 6, 2).translateY(torsoH * 0.6));
  }
  if (V.juntas) {
    for (let i = 0; i < 2; i++) {
      const j = new THREE.Mesh(new THREE.TorusGeometry(largura * 0.4, largura * 0.07, 6, 10), metal);
      j.position.set((i ? 1 : -1) * largura * ombros * 1.25, torsoH * 0.92, 0);
      j.rotation.y = Math.PI / 2;
      quadril.add(j);
    }
  }
  if (V.veias || V.aura) {
    const anel = new THREE.Mesh(new THREE.TorusGeometry(largura * 1.5, largura * 0.05, 6, 24),
      new THREE.MeshStandardMaterial({ color: corAura, emissive: corAura, emissiveIntensity: 2, transparent: true, opacity: 0.75 }));
    anel.rotation.x = Math.PI / 2;
    anel.position.y = torsoH * 0.5;
    anel.name = 'anelElemental';
    quadril.add(anel);
  }

  // --- Cabeça ------------------------------------------------------------
  const cabeca = new THREE.Group();
  cabeca.position.y = torsoH * 1.05;
  const craneo = new THREE.Mesh(new THREE.SphereGeometry(cabecaR, 16, 14), pele);
  craneo.scale.set(0.92, 1.1, 1.0);
  craneo.position.y = cabecaR;
  craneo.castShadow = true;
  cabeca.add(craneo);

  if (!V.bico && !V.casco) {
    const cab = new THREE.Mesh(new THREE.SphereGeometry(cabecaR * 1.06, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), cabeloMat);
    cab.position.y = cabecaR * 1.05;
    cabeca.add(cab);
  }
  if (V.penas) {
    for (let i = 0; i < 7; i++) {
      const p = new THREE.Mesh(new THREE.ConeGeometry(cabecaR * 0.12, cabecaR * 0.9, 4), cabeloMat);
      p.position.set((i - 3) * cabecaR * 0.2, cabecaR * 1.6, -cabecaR * 0.35);
      p.rotation.x = -0.9 + Math.abs(i - 3) * 0.1;
      cabeca.add(p);
    }
  }
  if (V.juba) {
    const juba = new THREE.Mesh(new THREE.TorusGeometry(cabecaR * 1.25, cabecaR * 0.52, 7, 16), cabeloMat);
    juba.rotation.x = Math.PI / 2;
    juba.position.y = cabecaR * 1.0;
    juba.castShadow = true;
    cabeca.add(juba);
  }
  if (V.halo) {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(cabecaR * 1.2, cabecaR * 0.08, 8, 26),
      new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffdd77, emissiveIntensity: 3 }));
    halo.rotation.x = Math.PI / 2.1;
    halo.position.y = cabecaR * 2.5;
    halo.name = 'halo';
    cabeca.add(halo);
    const l = new THREE.PointLight(0xffe0a0, 5, 8, 2);
    l.position.y = cabecaR * 2.4;
    cabeca.add(l);
  }
  if (V.auraLuz) {
    const l = new THREE.PointLight(0xfff0c8, 9, 14, 2);
    l.position.y = cabecaR;
    cabeca.add(l);
  }

  // Olhos
  const corOlhos = new THREE.Color(build.cores.olhos);
  const olhoMat = new THREE.MeshStandardMaterial({
    color: corOlhos, emissive: corOlhos,
    emissiveIntensity: (V.olhosBrilhantes || V.olhosSemPupila) ? 2.6 : 1.1,
  });
  const olhoGeo = new THREE.SphereGeometry(cabecaR * (V.olhosSemPupila ? 0.2 : 0.16), 8, 6);
  const oL = new THREE.Mesh(olhoGeo, olhoMat), oR = new THREE.Mesh(olhoGeo, olhoMat);
  const oy = cabecaR * (V.bico ? 1.1 : 1.02), oz = cabecaR * 0.84;
  oL.position.set(-cabecaR * 0.33, oy, oz);
  oR.position.set(cabecaR * 0.33, oy, oz);
  cabeca.add(oL, oR);

  if (V.bico) {
    const bico = new THREE.Mesh(new THREE.ConeGeometry(cabecaR * 0.3, cabecaR * 1.0, 6),
      new THREE.MeshStandardMaterial({ color: 0xe8c04a, roughness: 0.5 }));
    bico.rotation.x = Math.PI / 2;
    bico.position.set(0, cabecaR * 0.92, cabecaR * 1.0);
    cabeca.add(bico);
  }
  if (V.focinho) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(cabecaR * 0.34, cabecaR * 0.42, 3, 8), pele);
    f.rotation.x = Math.PI / 2;
    f.position.set(0, cabecaR * 0.82, cabecaR * 0.78);
    cabeca.add(f);
    const nariz = new THREE.Mesh(new THREE.SphereGeometry(cabecaR * 0.12, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x2a1a18, roughness: 0.4 }));
    nariz.position.set(0, cabecaR * 0.88, cabecaR * 1.12);
    cabeca.add(nariz);
  }
  if (V.orelhas) {
    const comp = V.orelhas === 'pontudas' ? 0.95 : 0.55;
    for (let i = 0; i < 2; i++) {
      const o = new THREE.Mesh(new THREE.ConeGeometry(cabecaR * 0.2, cabecaR * comp, 5), pele);
      o.position.set((i ? 1 : -1) * cabecaR * 0.95, cabecaR * 1.1, 0);
      o.rotation.z = (i ? -1 : 1) * 0.9;
      cabeca.add(o);
    }
  }
  if (V.orelhasAnimais) {
    for (let i = 0; i < 2; i++) {
      const o = new THREE.Mesh(new THREE.ConeGeometry(cabecaR * 0.3, cabecaR * 0.62, 5), pele);
      o.position.set((i ? 1 : -1) * cabecaR * 0.55, cabecaR * 1.85, 0);
      o.rotation.z = (i ? -1 : 1) * 0.28;
      cabeca.add(o);
    }
  }
  if (V.chifres) {
    for (let i = 0; i < 2; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(cabecaR * 0.16, cabecaR * 1.1, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.6 }));
      c.position.set((i ? 1 : -1) * cabecaR * 0.58, cabecaR * 1.75, -cabecaR * 0.15);
      c.rotation.set(-0.42, 0, (i ? -1 : 1) * 0.3);
      cabeca.add(c);
    }
  }
  if (V.presas) {
    for (let i = 0; i < 2; i++) {
      const p = new THREE.Mesh(new THREE.ConeGeometry(cabecaR * 0.1, cabecaR * 0.38, 4),
        new THREE.MeshStandardMaterial({ color: 0xf0eadc }));
      p.position.set((i ? 1 : -1) * cabecaR * 0.28, cabecaR * 0.62, cabecaR * 0.72);
      cabeca.add(p);
    }
  }
  if (V.barba) {
    const b = new THREE.Mesh(new THREE.ConeGeometry(cabecaR * 0.8, cabecaR * 1.9, 8), cabeloMat);
    b.position.set(0, cabecaR * 0.2, cabecaR * 0.42);
    b.rotation.x = Math.PI;
    cabeca.add(b);
  }
  if (V.marcasPele) {
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(cabecaR * (0.4 + i * 0.12), cabecaR * 0.05, 5, 12),
        new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 1 }));
      m.position.set(0, cabecaR * (0.7 + i * 0.22), cabecaR * 0.5);
      m.rotation.x = Math.PI / 2.4;
      cabeca.add(m);
    }
  }
  quadril.add(cabeca);

  // --- Asas (Aarakocra) ---------------------------------------------------
  if (V.asas) {
    const asaMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(build.cores.cabelo), roughness: 0.85, side: THREE.DoubleSide, flatShading: true,
    });
    for (let i = 0; i < 2; i++) {
      const asa = new THREE.Group();
      for (let p = 0; p < 5; p++) {
        const pena = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.026, h * (0.55 - p * 0.06), 3, 5), asaMat);
        pena.position.set((i ? 1 : -1) * (h * 0.1 + p * h * 0.055), -p * h * 0.03, -h * 0.04);
        pena.rotation.z = (i ? -1 : 1) * (0.5 + p * 0.16);
        pena.castShadow = true;
        asa.add(pena);
      }
      asa.position.set((i ? 1 : -1) * largura * 0.9, torsoH * 0.85, -largura * 0.55);
      asa.name = i ? 'asaR' : 'asaL';
      quadril.add(asa);
    }
  }

  // --- Braços -------------------------------------------------------------
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
    // Garras (Leonin / Tabaxi)
    if (tags.includes('garras') || V.orelhasAnimais) {
      for (let i = 0; i < 3; i++) {
        const gr = new THREE.Mesh(new THREE.ConeGeometry(largura * 0.055, largura * 0.3, 4),
          new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.4 }));
        gr.position.set((i - 1) * largura * 0.16, -bracoH * 0.62, largura * 0.12);
        gr.rotation.x = 0.5;
        ante.add(gr);
      }
    }
    g.add(sup, ante);
    g.userData.ante = ante; g.userData.mao = mao;
    return g;
  }
  const bL = braco(-1), bR = braco(1);
  quadril.add(bL, bR);

  // --- Arma da classe ------------------------------------------------------
  const armaDef = ARMAS[cls.arma] || ARMAS.cajado;
  const foco = new THREE.Group();
  const armaMat = new THREE.MeshStandardMaterial({
    map: Textures.get('metal', 1), color: armaDef.cor ?? 0xffffff, metalness: 0.7, roughness: 0.35,
    ...(armaDef.brilho ? { emissive: 0xffcc66, emissiveIntensity: 0.9 } : {}),
  });
  const madeiraMat = new THREE.MeshStandardMaterial({ map: Textures.get('wood', 1), color: armaDef.cor ?? 0xffffff });
  const T = armaDef.tipo;
  if (T === 'lamina') {
    const lam = new THREE.Mesh(new THREE.BoxGeometry(0.075, h * armaDef.comp, 0.16), armaMat);
    lam.position.y = h * armaDef.comp * 0.5;
    const gu = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.1), armaMat);
    foco.add(lam, gu);
    if (armaDef.brilho) foco.add(new THREE.PointLight(0xffcc66, 5, 8, 2).translateY(h * 0.3));
  } else if (T === 'machado') {
    const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, h * armaDef.comp, 6), madeiraMat);
    cabo.position.y = h * armaDef.comp * 0.45;
    const lam = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8, 1, false, 0, Math.PI), armaMat);
    lam.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    lam.position.set(0.11, h * armaDef.comp * 0.85, 0);
    foco.add(cabo, lam);
  } else if (T === 'maca') {
    const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, h * armaDef.comp, 6), madeiraMat);
    cabo.position.y = h * armaDef.comp * 0.45;
    const cab = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), armaMat);
    cab.position.y = h * armaDef.comp * 0.92;
    foco.add(cabo, cab);
  } else if (T === 'adagas') {
    const d = new THREE.Mesh(new THREE.ConeGeometry(0.045, h * 0.24, 4), armaMat);
    d.position.y = h * 0.12;
    foco.add(d);
  } else if (T === 'arco') {
    const arco = new THREE.Mesh(new THREE.TorusGeometry(h * armaDef.comp, 0.032, 6, 16, Math.PI * 1.35), madeiraMat);
    arco.rotation.y = Math.PI / 2;
    const corda = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, h * armaDef.comp * 1.72, 3),
      new THREE.MeshStandardMaterial({ color: 0xded8c4 }));
    corda.position.z = h * armaDef.comp * 0.38;
    foco.add(arco, corda);
  } else if (T === 'cajado') {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, h * armaDef.comp, 6), madeiraMat);
    c.position.y = h * 0.28;
    const gema = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.055, 1), brilho);
    gema.position.y = h * 0.76;
    gema.name = 'gema';
    foco.add(c, gema, new THREE.PointLight(new THREE.Color(corAura), 4, 12, 2).translateY(h * 0.76));
    if (armaDef.folhas) {
      for (let i = 0; i < 5; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(h * 0.035, 6, 5),
          new THREE.MeshStandardMaterial({ map: Textures.get('leaf', 1), flatShading: true }));
        f.position.set(Math.cos(i * 1.26) * h * 0.06, h * (0.68 + (i % 2) * 0.05), Math.sin(i * 1.26) * h * 0.06);
        foco.add(f);
      }
    }
  } else if (T === 'grimorio') {
    const livro = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.07),
      new THREE.MeshStandardMaterial({ map: Textures.get('runes', 1), color: armaDef.cor, emissive: 0x6622cc, emissiveIntensity: 1.1 }));
    livro.position.y = h * 0.1;
    foco.add(livro, new THREE.PointLight(0x9955ff, 4, 9, 2).translateY(h * 0.1));
  } else if (T === 'alaude') {
    const corpoA = new THREE.Mesh(new THREE.SphereGeometry(h * 0.11, 10, 8), madeiraMat);
    corpoA.scale.set(1, 1.15, 0.55);
    corpoA.position.y = h * 0.1;
    const braco2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, h * 0.3, 0.04), madeiraMat);
    braco2.position.y = h * 0.3;
    foco.add(corpoA, braco2);
  } else if (T === 'orbe') {
    const orbe = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.07, 2), brilho);
    orbe.position.y = h * 0.1;
    orbe.name = 'gema';
    foco.add(orbe, new THREE.PointLight(new THREE.Color(corAura), 6, 11, 2).translateY(h * 0.1));
  }
  if (T !== 'nenhuma') {
    foco.position.y = -bracoH * 0.5;
    foco.rotation.x = -0.25;
    bR.userData.ante.add(foco);
  }

  // --- Pernas ---------------------------------------------------------------
  function perna(lado) {
    const g = new THREE.Group();
    g.position.set(lado * largura * 0.55, 0, 0);
    const coxa = new THREE.Mesh(new THREE.CapsuleGeometry(largura * (0.38 + musc * 0.14), pernaH * 0.42, 3, 8), V.placas ? pele : roupa);
    coxa.position.y = -pernaH * 0.26; coxa.castShadow = true;
    const canela = new THREE.Group();
    canela.position.y = -pernaH * 0.5;
    const cm = new THREE.Mesh(new THREE.CapsuleGeometry(largura * (0.3 + musc * 0.1), pernaH * 0.4, 3, 8), V.placas ? pele : roupa);
    cm.position.y = -pernaH * 0.24;
    const escala = V.pesLargos ? 1.35 : 1;
    const pe = new THREE.Mesh(new THREE.BoxGeometry(largura * 0.72 * escala, 0.09, largura * 1.5 * escala), V.placas ? pele : metal);
    pe.position.set(0, -pernaH * 0.47, largura * 0.3);
    canela.add(cm, pe);
    g.add(coxa, canela);
    g.userData.canela = canela;
    return g;
  }
  const pL = perna(-1), pR = perna(1);
  quadril.add(pL, pR);

  // Cauda
  let cauda = null;
  if (V.cauda) {
    cauda = new THREE.Group();
    let pai = cauda;
    const segs = [];
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Group();
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(largura * (0.19 - i * 0.026), h * 0.1, 3, 6), pele);
      m.rotation.x = Math.PI / 2;
      m.position.z = -h * 0.055;
      s.position.z = i === 0 ? -largura * 0.5 : -h * 0.1;
      s.add(m);
      pai.add(s);
      pai = s; segs.push(s);
    }
    cauda.position.set(0, torsoH * 0.12, -largura * 0.4);
    quadril.add(cauda);
    cauda.userData.segs = segs;
  }

  // Aura no chão
  const aura = new THREE.Mesh(
    new THREE.RingGeometry(largura * 2.2, largura * 2.8, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(corAura), transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  aura.position.y = 0.05;
  corpo.add(aura);

  root.userData = {
    quadril, cabeca, bL, bR, pL, pR, aura, torso, foco, cauda,
    asaL: quadril.getObjectByName('asaL'), asaR: quadril.getObjectByName('asaR'),
    halo: cabeca.getObjectByName('halo'), anel: quadril.getObjectByName('anelElemental'),
    altura: h, torsoH, pernaH, bracoH, fase: 0, tags,
  };
  return root;
}

export function animarAvatar(root, dt, estado) {
  const u = root.userData;
  if (!u || !u.quadril) return;
  const { velocidade = 0, noAr = false, conjurando = 0, atacando = 0, vivo = true } = estado;
  u.fase += dt * (2.2 + velocidade * 0.9);
  const sw = Math.sin(u.fase) * Math.min(1, velocidade / 5);
  const bob = Math.abs(Math.cos(u.fase)) * Math.min(1, velocidade / 6);

  if (u.halo) u.halo.rotation.z += dt * 0.7;
  if (u.anel) u.anel.rotation.z += dt * 1.1;
  if (u.cauda) u.cauda.userData.segs.forEach((s, i) => { s.rotation.y = Math.sin(u.fase * 0.9 + i * 0.5) * 0.22; });
  if (u.asaL) {
    const flap = noAr ? Math.sin(u.fase * 5) * 0.75 : Math.sin(u.fase * 0.7) * 0.12;
    u.asaL.rotation.z = flap; u.asaR.rotation.z = -flap;
    u.asaL.rotation.y = noAr ? 0.2 : 0.55; u.asaR.rotation.y = noAr ? -0.2 : -0.55;
  }

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
// Ficha derivada — tudo por TAGS, sem casos especiais por nome de raça.
// ---------------------------------------------------------------------------
export function computarFicha(build) {
  const race = RACES[build.raca] || RACES.humano;
  const origem = ORIGENS[build.origem] || Object.values(ORIGENS)[0];
  const cls = CLASSES[build.classe] || CLASSES.mago;
  const tags = race.tags || [];
  const ctags = cls.tags || [];
  const tem = t => tags.includes(t);
  const cTem = t => ctags.includes(t);

  const attrs = {};
  for (const k of ['forca', 'destreza', 'vigor', 'intelecto', 'espirito', 'carisma']) {
    attrs[k] = ATTR_BASE + (build.attrs[k] || 0) + (race.mods[k] || 0) + (origem.bonus[k] || 0);
  }

  let massa = build.corpo.massa;
  if (build.tracos.includes('peso_leve')) massa *= 0.75;
  const massaEfetiva = massa * (tem('leve') ? 0.5 : 1);   // ossos ocos

  const vidaMax = Math.round((60 + attrs.vigor * 9 + massa * 0.22) * cls.vida * (build.tracos.includes('cicatrizes') ? 1.15 : 1));
  const manaMax = Math.round((40 + attrs.intelecto * 11 + attrs.espirito * 5) * cls.mana
    * (build.tracos.includes('maldicao_veu') ? 1.25 : 1) * (cTem('pacto') ? 0.7 : 1));
  const stamMax = Math.round((50 + attrs.vigor * 6 + attrs.destreza * 4) * cls.stam);

  let veloc = 4.2 + attrs.destreza * 0.19 - (massa - 80) * 0.006;
  if (tem('agil')) veloc += 1.0;
  if (cTem('mobilidade')) veloc += 2.0;
  if (tem('lento')) veloc -= 0.8;
  veloc = THREE.MathUtils.clamp(veloc, 2.0, 11);

  const pulo = THREE.MathUtils.clamp(6.4 + attrs.destreza * 0.19 - (massaEfetiva - 80) * 0.008, 3.0, 12);

  let carga = capacidadeCarga(attrs.forca, massa, build.corpo.musculo);
  if (tem('carga_dobrada')) carga *= 2;

  let armadura = 0.02 * attrs.vigor;
  if (tem('casco')) armadura += 0.35;
  if (tem('construto')) armadura += 0.18;
  if (tem('escamas')) armadura += 0.08;
  if (tem('pelePetrea')) armadura += 0.06;
  if (cTem('metalico')) armadura += 0.25;

  let resistMagica = 0.02 * attrs.espirito;
  if (tem('resist_sombra')) resistMagica += 0.15;
  if (tem('elemental')) resistMagica += 0.1;

  // Multiplicadores de queda: 1 = normal, 0 = imune
  let quedaMult = 1;
  if (tem('queda_suave')) quedaMult = 0.7;
  if (tem('cai_de_pe') || cTem('cai_de_pe') || tem('voo')) quedaMult = 0;

  return {
    attrs, massa, massaEfetiva, vidaMax, manaMax, stamMax, veloc, pulo, carga, quedaMult,
    regenMana: (1.6 + attrs.espirito * 0.32) * (cTem('pacto') ? 1.5 : 1),
    regenStam: 7 + attrs.vigor * 0.55,
    poderMagico: (0.55 + attrs.intelecto * 0.075 + attrs[cls.prim] * 0.02) * (cTem('nuker') ? 1.2 : 1),
    poderFisico: (0.5 + attrs.forca * 0.09 + build.corpo.musculo / 220)
      * (tem('garras') ? 1.4 : 1) * (cTem('marcial') ? 1.25 : 1) * (cTem('desarmado') ? 1.3 : 1),
    armadura: Math.min(0.75, armadura),
    resistMagica: Math.min(0.7, resistMagica),
    curaMult: (tem('cura_ampliada') ? 1.3 : 1) * (cTem('cura') ? 1.4 : 1),
    custoMagiaMult: cTem('pacto') ? 0.65 : 1,
    cooldownMult: cTem('pacto') ? 0.75 : 1,
    alcance: race.fis.alcance * (build.corpo.altura / 1.8),
    tolFrio: tem('imune_frio') ? 99 : race.fis.tolFrio * (1 + (100 - build.corpo.musculo) / 400),
    tolCalor: tem('resist_fogo') ? 99 : race.fis.tolCalor,
    nivel: build.nivel || 1, xp: build.xp || 0,
    tags, ctags,
  };
}

export function xpParaNivel(n) { return Math.round(100 * Math.pow(n, 1.55)); }
