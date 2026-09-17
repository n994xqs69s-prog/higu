import * as THREE from 'three';
import { buildWorld, heightAt, biomeAt, BIOME_INFO, WORLD_SIZE, HALF, WATER_LEVEL } from './systems/world.js';
import { Player } from './systems/player.js';
import { Enemy, BESTIARIO, CHEFES } from './systems/enemies.js';
import { SpellSystem } from './systems/spells.js';
import { GameMaster } from './systems/gm.js';
import { QuestSystem, MISSOES, PROLOGO } from './systems/quests.js';
import { BuildSystem, MATERIAIS, PECAS } from './systems/building.js';
import { Creator, buildPadrao } from './ui/creator.js';
import { MAGIAS, ESCOLAS, RACES, CLASSES, ORIGENS, TRACOS, ATTRS } from './systems/chardata.js';
import { computarFicha, xpParaNivel } from './systems/character.js';
import { raycastTerreno, temLinhaDeVisao } from './systems/physics.js';
import { Net } from './systems/net.js';

const $ = s => document.querySelector(s);
const SAVE_KEY = 'higu_save_v1';

class Game {
  constructor() {
    this.canvas = $('#game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 2200);
    this.clock = new THREE.Clock();

    this.horaDoDia = 0.32;
    this.clima = 'limpo';
    this.inimigos = [];
    this.remotos = new Map();
    this.estruturasTemp = [];
    this.flutuantes = [];
    this.rodando = false;
    this.camYaw = 0; this.camPitch = -0.2; this.camDist = 6.5;
    this.input = { frente: 0, tras: 0, esq: 0, dir: 0, pular: 0, correr: 0 };
    this.logs = [];

    addEventListener('resize', () => this.onResize());
    this.onResize();
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  // ======================= BOOT ==========================================
  async iniciarMundo() {
    const w = buildWorld(this.scene);
    Object.assign(this, w);
    this.spells = new SpellSystem(this.scene, this);
    this.gm = new GameMaster(this);
    this.quests = new QuestSystem(this);
    this.builder = new BuildSystem(this.scene, this);
    this.veilOrb = this.scene.getObjectByName('veilOrb');
  }

  criarJogador(build) {
    const p = this.village;
    const pos = new THREE.Vector3(p.x + 12, heightAt(p.x + 12, p.z + 12) + 1, p.z + 12);
    this.player = new Player(build, this.scene, pos);
    this.spawnInimigos();
    this.atualizarSpellbar();
    this.log(PROLOGO.split('\n\n')[0], 'lore');
    this.log('Pressione G para falar com o Mestre do Véu a qualquer momento.', 'dica');
  }

  spawnInimigos() {
    const tipos = Object.keys(BESTIARIO);
    for (let i = 0; i < 95; i++) {
      const x = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
      const z = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
      const b = biomeAt(x, z);
      if (b === 'water') continue;
      if (Math.hypot(x - this.village.x, z - this.village.z) < 70) continue;
      let tipo;
      if (b === 'forest') tipo = Math.random() < 0.5 ? 'lobo_veu' : 'aranha_mana';
      else if (b === 'desert') tipo = Math.random() < 0.6 ? 'goblin' : 'elemental_chama';
      else if (b === 'snow' || b === 'rock') tipo = Math.random() < 0.5 ? 'golem_pedra' : 'cavaleiro_caido';
      else if (b === 'veil') tipo = 'espectro';
      else tipo = tipos[Math.floor(Math.random() * tipos.length)];
      this.inimigos.push(new Enemy(tipo, new THREE.Vector3(x, heightAt(x, z), z), this.scene));
    }
    for (const [id, c] of Object.entries(CHEFES)) {
      const [x, z] = c.pos;
      this.inimigos.push(new Enemy(id, new THREE.Vector3(x, heightAt(x, z), z), this.scene, true));
    }
  }

  // ======================= HELPERS DE COMBATE =============================
  alvosDe(dono) {
    if (!dono) return this.inimigos.filter(e => e.vivo);
    if (dono === this.player || dono.ehJogador) return this.inimigos.filter(e => e.vivo);
    return [this.player, ...this.remotos.values()].filter(p => p && p.vivo);
  }

  jogadorMaisProximo(pos) {
    let melhor = null, d = 1e9;
    for (const p of [this.player, ...this.remotos.values()]) {
      if (!p || !p.vivo) continue;
      const dd = p.body.pos.distanceTo(pos);
      if (dd < d) { d = dd; melhor = p; }
    }
    return melhor;
  }

  alvoNaMira(caster, alcance = 30) {
    const origem = caster.body.pos.clone().setY(caster.body.pos.y + 1.4);
    const dir = this.dirMira();
    let melhor = null, melhorAng = 0.93;
    for (const e of this.alvosDe(caster)) {
      const v = e.body.pos.clone().setY(e.body.pos.y + 1).sub(origem);
      if (v.length() > alcance) continue;
      const cos = v.clone().normalize().dot(dir);
      if (cos > melhorAng) { melhorAng = cos; melhor = e; }
    }
    return melhor;
  }

  aliadoNaMira(caster) {
    const dir = this.dirMira();
    const origem = caster.body.pos.clone().setY(caster.body.pos.y + 1.4);
    for (const p of this.remotos.values()) {
      const v = p.body.pos.clone().sub(origem);
      if (v.length() < 25 && v.normalize().dot(dir) > 0.9) return p;
    }
    return null;
  }

  aplicarDano(alvo, dano, fonte, escola = 'fisico', direto = false) {
    if (!alvo || !alvo.vivo) return;
    if (alvo.invulneravel > 0 && !direto) return;
    let d = dano;
    if (alvo.danoFinal) d = alvo.danoFinal(dano, escola);
    else {
      const f = alvo.ficha;
      d *= 1 - (escola === 'fisico' ? f.armadura : f.resistMagica);
      if (alvo.molhado > 0 && escola === 'raio') d *= 1.6;
      if (alvo.molhado > 0 && escola === 'fogo') d *= 0.5;
      if (alvo.construto && escola === 'vida') d = 0;
    }
    if (alvo.escudo > 0) {
      const abs = Math.min(alvo.escudo, d);
      alvo.escudo -= abs; d -= abs;
    }
    alvo.vida -= d;
    if (alvo === this.player) this.shake = Math.min(0.5, (this.shake || 0) + d * 0.004);
    if (d > 0.9) this.flutuante(alvo.body.pos, `-${Math.round(d)}`, alvo === this.player ? '#ff6666' : '#ffdd66');
    if (escola !== 'fisico' && alvo.ultimaEscolaRecebida !== undefined) alvo.ultimaEscolaRecebida = escola;

    if (alvo.vida <= 0) this.morrer(alvo, fonte);
  }

  morrer(alvo, fonte) {
    alvo.vivo = false;
    if (alvo === this.player) {
      $('#deathTxt').textContent = 'Sua marca rúnica pulsa uma última vez antes de escurecer. O Véu não perdoa erros de cálculo.';
      $('#screen-death').classList.remove('hidden');
      document.exitPointerLock?.();
      return;
    }
    if (alvo.mesh) {
      alvo.mesh.traverse(o => { if (o.material) { o.material.transparent = true; } });
      this.spells.explosaoVisual(alvo.body.pos.clone().setY(alvo.body.pos.y + 1), alvo.chefe ? '#ffffff' : '#aa6644', alvo.chefe ? 5 : 1.5);
      setTimeout(() => this.scene.remove(alvo.mesh), 120);
    }
    if (alvo.def) {
      this.log(`☠ ${alvo.nome} foi derrotado.`, alvo.chefe ? 'boss' : '');
      this.ganharXP(alvo.def.xp);
      this.quests.matou(alvo.tipoId, alvo.chefe);
      if (alvo.chefe) {
        this.builder.recursos.cristal += 20;
        this.builder.recursos.metal += 40;
      } else {
        this.builder.recursos.madeira += 8;
        this.builder.recursos.pedra += 5;
      }
    }
  }

  ganharXP(v) {
    const p = this.player;
    p.xp += Math.round(v * (p.build.raca === 'humano' ? 1.1 : 1));
    let subiu = false;
    while (p.xp >= xpParaNivel(p.nivel)) {
      p.xp -= xpParaNivel(p.nivel);
      p.nivel++;
      p.build.nivel = p.nivel;
      p.build.pontosLivres = (p.build.pontosLivres || 0) + 2;
      subiu = true;
    }
    if (subiu) {
      p.ficha = computarFicha(p.build);
      p.vida = p.ficha.vidaMax; p.mana = p.ficha.manaMax; p.stam = p.ficha.stamMax;
      this.log(`⬆ NÍVEL ${p.nivel}! +2 pontos de atributo (pressione C para distribuir).`, 'quest');
      this.spells.explosaoVisual(p.body.pos.clone().setY(p.body.pos.y + 1), '#ffdd66', 3);
    }
  }

  recompensar(r) {
    if (!r) return;
    if (r.xp) this.ganharXP(r.xp);
    if (r.pontos) { this.player.build.pontosLivres = (this.player.build.pontosLivres || 0) + r.pontos; this.log(`+${r.pontos} ponto(s) de atributo.`, 'quest'); }
    if (r.magia && !this.player.magias.includes(r.magia)) {
      this.player.magias.push(r.magia);
      this.log(`✨ Nova magia aprendida: ${MAGIAS[r.magia].nome}`, 'quest');
      this.atualizarSpellbar();
    }
  }

  molharArea(pos, raio, dur) {
    for (const e of this.inimigos) if (e.vivo && e.body.pos.distanceTo(pos) < raio) e.molhado = dur;
    if (this.player.body.pos.distanceTo(pos) < raio) this.player.molhado = dur;
  }
  incendiarArea(pos, raio) {
    for (const e of this.inimigos) if (e.vivo && e.body.pos.distanceTo(pos) < raio && e.molhado <= 0) e.queimando = 4;
    this.builder.danificar(pos, raio, 30, 'fogo');
  }

  flutuante(pos, texto, cor) {
    const div = document.createElement('div');
    div.className = 'dmg';
    div.textContent = texto;
    div.style.color = cor;
    document.body.appendChild(div);
    this.flutuantes.push({ div, pos: pos.clone().setY(pos.y + 2), t: 0 });
  }

  log(msg, tipo = '') {
    this.logs.push({ msg, tipo, t: 0 });
    if (this.logs.length > 9) this.logs.shift();
    const el = $('#log');
    el.innerHTML = this.logs.map(l => `<div class="l ${l.tipo}">${l.msg}</div>`).join('');
  }

  dirMira() {
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    return d.normalize();
  }

  pontoMira(alcance = 60) {
    const origem = this.camera.position.clone();
    const dir = this.dirMira();
    const r = raycastTerreno(origem, dir, alcance, 0.8);
    return r.ponto;
  }

  // ======================= AÇÕES ==========================================
  conjurar() {
    const p = this.player;
    if (!p.vivo || p.stun > 0 || p.congelado > 0) return;
    const id = p.magiaSelecionada;
    if (!id) return;
    const dir = this.dirMira();
    const res = this.spells.conjurar(id, p, dir, this.pontoMira(50));
    if (!res.ok) { this.log(res.msg, 'aviso'); return; }
    p.ultimaEscola = MAGIAS[id].escola;
    if (res.notas?.length) this.log(`${res.nome}: ${res.notas.join(' · ')}`, 'dica');
    if (p.buffs?.runa_amplificacao) {
      p.buffs.runa_amplificacao_usos = (p.buffs.runa_amplificacao_usos || 3) - 1;
      if (p.buffs.runa_amplificacao_usos <= 0) delete p.buffs.runa_amplificacao;
    }
  }

  interagir() {
    const p = this.player;
    for (const it of this.interactables) {
      if (Math.hypot(p.body.pos.x - it.x, p.body.pos.z - it.z) > it.r) continue;
      if (it.kind === 'mana') {
        p.mana = p.ficha.manaMax; p.vida = Math.min(p.ficha.vidaMax, p.vida + p.ficha.vidaMax * 0.4);
        this.log('A Fonte de Mana te preenche. A runa na sua palma responde e brilha.', 'lore');
      } else if (it.kind === 'altar') {
        this.log('A pedra grava-se sozinha: "O Véu não nos protege. Ele o PRENDE."', 'lore');
      } else if (it.kind === 'boss') {
        this.log('A Torre do Véu se abre. O Arauto sabe o seu nome.', 'boss');
      }
      this.quests.interagiu(it.id);
      return true;
    }
    // recolher recursos de árvores/rochas próximas
    const alvo = this.pontoMira(6);
    for (const c of this.colliders) {
      if (c.destruido) continue;
      if (!['árvore', 'rocha', 'cristal'].includes(c.tag)) continue;
      if (Math.hypot(c.x - alvo.x, c.z - alvo.z) > 3.2) continue;
      const ganho = c.tag === 'árvore' ? ['madeira', 25] : c.tag === 'rocha' ? ['pedra', 18] : ['cristal', 4];
      this.builder.recursos[ganho[0]] += ganho[1];
      this.log(`+${ganho[1]} ${MATERIAIS[ganho[0]].nome}`, 'dica');
      return true;
    }
    this.log('Nada para interagir aqui.', 'aviso');
    return false;
  }

  finalDoJogo() {
    this.log('🜁 O Arauto caiu. O oitavo nome arde na sua palma. Devolva-o ao Véu (E na Torre) ou queime-o (Q).', 'boss');
  }

  // ======================= GM ============================================
  processarGM(texto) {
    const e = this.gm.avaliar(texto, this.player);
    const fmt = this.gm.formatar(e);
    for (const ef of e.efeitos) {
      if (ef.tipo === 'dano') {
        const alvo = e.env.inimigos[0]?.ref;
        if (alvo) this.aplicarDano(alvo, ef.valor, this.player, ef.escola);
      } else if (ef.tipo === 'dano_proprio') this.aplicarDano(this.player, ef.valor, null, 'fisico', true);
      else if (ef.tipo === 'mana') this.player.mana = Math.max(0, this.player.mana + ef.valor);
      else if (ef.tipo === 'stam') this.player.stam = Math.max(0, this.player.stam + ef.valor);
      else if (ef.tipo === 'xp') this.ganharXP(ef.valor);
    }
    if (['critico', 'sucesso_total', 'sucesso'].includes(e.veredicto)) this.quests.gmSucesso();
    return fmt;
  }

  // ======================= LOOP ==========================================
  update(dt) {
    const p = this.player;
    if (!p) return;

    // ciclo dia/noite
    this.horaDoDia = (this.horaDoDia + dt / 600) % 1;
    const ang = this.horaDoDia * Math.PI * 2 - Math.PI / 2;
    this.sun.position.set(Math.cos(ang) * 320, Math.sin(ang) * 320, 140);
    const luz = THREE.MathUtils.clamp(Math.sin(ang) * 1.6 + 0.25, 0.05, 1.6);
    this.sun.intensity = luz;
    this.sun.target.position.copy(p.body.pos);
    this.sun.position.add(p.body.pos.clone().setY(0));
    const nightC = new THREE.Color(0x0a1028), dayC = new THREE.Color(0x9fb6da);
    this.scene.fog.color.copy(nightC).lerp(dayC, THREE.MathUtils.clamp(luz, 0, 1));

    const info = p.update(dt, this.input, this, this.dirMira());

    for (const e of this.inimigos) e.update(dt, this);
    this.spells.update(dt);

    // estruturas temporárias
    for (let i = this.estruturasTemp.length - 1; i >= 0; i--) {
      const s = this.estruturasTemp[i];
      s.t += dt;
      if (s.t > s.dur) {
        s.col.destruido = true;
        this.scene.remove(s.mesh);
        this.estruturasTemp.splice(i, 1);
      }
    }

    if (this.veilOrb) { this.veilOrb.rotation.y += dt * 0.4; this.veilOrb.rotation.x += dt * 0.2; }
    if (this.water) this.water.material.opacity = 0.68 + Math.sin(performance.now() * 0.0008) * 0.05;

    // câmera 3ª pessoa com colisão de terreno
    const alvoCam = p.body.pos.clone().add(new THREE.Vector3(0, p.build.corpo.altura * 0.95, 0));
    const off = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      -Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch)
    ).multiplyScalar(this.camDist);
    const camPos = alvoCam.clone().sub(off);
    const solo = heightAt(camPos.x, camPos.z) + 1.0;
    if (camPos.y < solo) camPos.y = solo;
    this.camera.position.lerp(camPos, Math.min(1, dt * 14));
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.4);
    }
    this.camera.lookAt(alvoCam);

    // modo construção
    if (this.builder.ativo) this.builder.atualizarGhost(this.pontoMira(20));

    if (this.net) { this.net.enviarEstado(p); this.net.interpolar(dt); }
    this.atualizarHUD(info);
  }

  atualizarHUD(info) {
    const p = this.player, f = p.ficha;
    const pct = (a, b) => Math.max(0, Math.min(100, (a / b) * 100)) + '%';
    $('#hpFill').style.width = pct(p.vida, f.vidaMax);
    $('#mpFill').style.width = pct(p.mana, f.manaMax);
    $('#stFill').style.width = pct(p.stam, f.stamMax);
    $('#hpTxt').textContent = `${Math.max(0, Math.round(p.vida))}/${f.vidaMax}`;
    $('#mpTxt').textContent = `${Math.round(p.mana)}/${f.manaMax}`;
    $('#stTxt').textContent = `${Math.round(p.stam)}/${f.stamMax}`;

    // spellbar cooldowns
    this.spellEls?.forEach((el, i) => {
      const id = p.magias[i];
      if (!id) return;
      el.classList.toggle('on', i === p.magiaAtiva);
      const cd = p.cooldowns[id] || 0;
      el.querySelector('.cd').style.height = (cd / MAGIAS[id].cd * 100) + '%';
      const custo = this.spells.custoAjustado(id, p);
      el.querySelector('.cost').textContent = custo;
      el.classList.toggle('nomana', p.mana < custo);
    });

    // bússola + bioma
    const deg = ((-this.camYaw * 180 / Math.PI) % 360 + 360) % 360;
    const dirs = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
    const b = biomeAt(p.body.pos.x, p.body.pos.z);
    $('#compassTxt').innerHTML = `${dirs[Math.round(deg / 45) % 8]} · <b>${BIOME_INFO[b].nome}</b> <small>mana ×${BIOME_INFO[b].mana}</small>`;

    // quest tracker
    const ativas = this.quests.ativas().slice(0, 3);
    $('#questTracker').innerHTML = ativas.map(q => `
      <div class="q"><b>${q.nome}</b>${q.objetivos.map(o => {
        const pr = this.quests.estado[q.id].prog[o.id], mx = o.qtd || 1;
        return `<div class="o ${pr >= mx ? 'done' : ''}">${pr >= mx ? '✔' : '○'} ${o.texto} <span>${pr}/${mx}</span></div>`;
      }).join('')}</div>`).join('') +
      `<div class="lvl">Nv ${p.nivel} · ${p.xp}/${xpParaNivel(p.nivel)} XP</div>`;

    // alvo
    const alvo = this.alvoNaMira(p, 45);
    const ti = $('#targetInfo');
    if (alvo) {
      ti.classList.remove('hidden');
      $('#tName').textContent = `${alvo.nome}${alvo.chefe ? ` — Fase ${alvo.fase}` : ''}`;
      $('#tHp').style.width = pct(alvo.vida, alvo.ficha.vidaMax);
    } else ti.classList.add('hidden');

    // flutuantes
    for (let i = this.flutuantes.length - 1; i >= 0; i--) {
      const fl = this.flutuantes[i];
      fl.t += 1 / 60;
      const v = fl.pos.clone().project(this.camera);
      fl.div.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
      fl.div.style.top = ((-v.y * 0.5 + 0.5) * innerHeight - fl.t * 60) + 'px';
      fl.div.style.opacity = Math.max(0, 1 - fl.t);
      if (fl.t > 1 || v.z > 1) { fl.div.remove(); this.flutuantes.splice(i, 1); }
    }

    if (this.builder.ativo) this.atualizarBuildPanel();

    if (this.net) {
      $('#players').innerHTML = `🌐 sala "${this.net.sala}" · ${this.remotos.size + 1} jogador(es)` +
        [...this.remotos.values()].map(r => `<div>${r.nome} — ${Math.round(r.vida)} HP</div>`).join('');
    }
  }

  atualizarSpellbar() {
    const bar = $('#spellbar');
    bar.innerHTML = this.player.magias.slice(0, 8).map((id, i) => {
      const m = MAGIAS[id];
      return `<div class="slot" data-slot="${i}" style="--c:${ESCOLAS[m.escola].cor}">
        <span class="key">${i + 1}</span><span class="cd"></span>
        <span class="nm">${m.nome}</span><span class="cost">${m.custo}</span>
      </div>`;
    }).join('');
    this.spellEls = [...bar.querySelectorAll('.slot')];
    this.spellEls.forEach((el, i) => el.onclick = () => { this.player.magiaAtiva = i; });
  }

  atualizarBuildPanel() {
    const b = this.builder;
    $('#buildPanel').innerHTML = `
      <b>Modo Construção</b>
      <div class="bp-row">Peça [Z]: ${Object.keys(PECAS).map(k => `<span class="${b.peca === k ? 'on' : ''}">${PECAS[k].nome}</span>`).join('')}</div>
      <div class="bp-row">Material [X]: ${Object.keys(MATERIAIS).map(k => `<span class="${b.material === k ? 'on' : ''}">${MATERIAIS[k].nome} (${b.recursos[k]})</span>`).join('')}</div>
      <div class="bp-note">${MATERIAIS[b.material].nota}</div>
      <div class="bp-row small">Clique = colocar · Clique direito = remover · R = girar · B = sair</div>`;
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.creator && !$('#screen-creator').classList.contains('hidden')) this.creator.tick(dt);
    if (this.rodando) this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  // ======================= SAVE ==========================================
  salvar() {
    if (!this.player) return;
    const d = {
      player: this.player.serializar(),
      quests: this.quests.serializar(),
      build: this.builder.serializar(),
      hora: this.horaDoDia,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    this.log('💾 Progresso salvo.', 'dica');
  }

  carregar() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
}

// ===========================================================================
// UI / BOOTSTRAP
// ===========================================================================
const game = new Game();
window.game = game;

function tela(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  if (id) $(id).classList.remove('hidden');
}

async function boot() {
  const lb = $('#lbar');
  for (let i = 0; i <= 100; i += 20) { lb.style.width = i + '%'; await new Promise(r => setTimeout(r, 40)); }
  await game.iniciarMundo();
  game.loop();
  tela('#screen-title');
  $('#btnContinue').disabled = !game.carregar();
}

$('#btnNew').onclick = () => {
  tela('#screen-creator');
  game.creator = new Creator($('#screen-creator'), build => comecar(build));
};

$('#btnContinue').onclick = () => {
  const d = game.carregar();
  if (!d) return;
  comecar(d.player.build, d);
};

$('#btnMulti').onclick = () => {
  const nome = prompt('Nome da sala multiplayer (todos na mesma sala jogam juntos):', 'ardel');
  if (!nome) return;
  game.salaMulti = nome;
  tela('#screen-creator');
  game.creator = new Creator($('#screen-creator'), build => comecar(build, null, nome));
};

$('#btnLore').onclick = () => { tela('#screen-lore'); renderLore(); };

document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => {
  $('#' + b.dataset.close).classList.add('hidden');
  if (game.rodando) game.canvas.requestPointerLock();
});

$('#btnRespawn').onclick = () => {
  const p = game.player;
  p.vivo = true;
  p.vida = p.ficha.vidaMax * 0.5;
  p.mana = p.ficha.manaMax * 0.5;
  p.body.pos.set(game.village.x, game.village.y + 1, game.village.z);
  p.body.vel.set(0, 0, 0);
  p.mesh.userData.quadril.rotation.x = 0;
  tela(null);
  $('#hud').classList.remove('hidden');
  game.canvas.requestPointerLock();
};

function comecar(build, save = null, sala = null) {
  tela(null);
  $('#hud').classList.remove('hidden');
  game.criarJogador(build);
  if (save) {
    game.quests.carregar(save.quests);
    game.builder.carregar(save.build);
    game.player.vida = save.player.vida;
    game.player.mana = save.player.mana;
    game.player.nivel = save.player.nivel;
    game.player.xp = save.player.xp;
    game.player.magias = save.player.magias || game.player.magias;
    game.player.body.pos.fromArray(save.player.pos);
    game.horaDoDia = save.hora ?? 0.32;
    game.atualizarSpellbar();
  }
  game.rodando = true;
  if (sala) {
    game.net = new Net(game, sala, build.nome);
    game.log(`🌐 Conectando à sala "${sala}"…`, 'dica');
  }
  game.canvas.requestPointerLock();
  setInterval(() => game.salvar(), 45000);
}

// --- Controles --------------------------------------------------------------
const KEYMAP = { KeyW: 'frente', KeyS: 'tras', KeyA: 'esq', KeyD: 'dir', Space: 'pular', ShiftLeft: 'correr' };

addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
    if (e.code === 'Escape') e.target.blur();
    return;
  }
  if (KEYMAP[e.code]) { game.input[KEYMAP[e.code]] = 1; e.preventDefault(); }
  if (!game.rodando) return;

  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5) - 1;
    if (n >= 0 && n < game.player.magias.length) game.player.magiaAtiva = n;
  }
  switch (e.code) {
    case 'KeyE': game.interagir(); break;
    case 'KeyF': game.player.ataqueFisico(game, game.dirMira()); break;
    case 'KeyB': {
      const on = game.builder.toggle();
      $('#buildPanel').classList.toggle('hidden', !on);
      $('#modeTag').innerHTML = `Modo: ${on ? 'Construção' : 'Combate'} <small>(B = alternar · G = Mestre IA · TAB = mapa · C = ficha)</small>`;
      break;
    }
    case 'KeyZ': if (game.builder.ativo) { const k = Object.keys(PECAS); game.builder.peca = k[(k.indexOf(game.builder.peca) + 1) % k.length]; game.builder.criarGhost(); } break;
    case 'KeyX': if (game.builder.ativo) { const k = Object.keys(MATERIAIS); game.builder.material = k[(k.indexOf(game.builder.material) + 1) % k.length]; } break;
    case 'KeyR': if (game.builder.ativo) game.builder.rot += Math.PI / 2; break;
    case 'KeyG': abrirGM(); break;
    case 'KeyC': abrirFicha(); break;
    case 'KeyM': game.salvar(); break;
    case 'Tab': e.preventDefault(); abrirMapa(); break;
    case 'Escape': document.exitPointerLock?.(); break;
  }
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) game.input[KEYMAP[e.code]] = 0; });

game.canvas.addEventListener('click', () => {
  if (!game.rodando) return;
  if (document.pointerLockElement !== game.canvas) { game.canvas.requestPointerLock(); return; }
  if (game.builder.ativo) {
    const r = game.builder.colocar(game.pontoMira(20));
    if (!r.ok && r.msg) game.log(r.msg, 'aviso');
  } else game.conjurar();
});
game.canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (!game.rodando) return;
  if (game.builder.ativo) game.builder.remover(game.pontoMira(20));
  else game.player.ataqueFisico(game, game.dirMira());
});
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== game.canvas) return;
  game.camYaw -= e.movementX * 0.0022;
  game.camPitch = THREE.MathUtils.clamp(game.camPitch - e.movementY * 0.0022, -1.2, 0.9);
});
addEventListener('wheel', e => {
  if (!game.rodando) return;
  game.camDist = THREE.MathUtils.clamp(game.camDist + e.deltaY * 0.006, 2.2, 14);
});

// --- Telas auxiliares -------------------------------------------------------
function abrirGM() {
  const s = $('#screen-gm');
  const abrindo = s.classList.contains('hidden');
  s.classList.toggle('hidden');
  if (abrindo) {
    document.exitPointerLock?.();
    const env = game.gm.lerAmbiente(game.player);
    $('#gmHints').innerHTML = `
      <b>O Mestre observa:</b> ${env.biomaNome} · densidade de mana ×${env.densidadeMana} ·
      condutividade ${env.condutividade} · inflamabilidade ${env.inflamabilidade} ·
      ${env.noite ? 'noite' : 'dia'} · materiais próximos: ${env.materiais.join(', ') || 'nenhum'}.
      ${env.inimigos.length ? `<br><b>Inimigos:</b> ${env.inimigos.slice(0, 3).map(i => `${i.nome} a ${i.dist} m (${i.massa} kg${i.fraqueza ? `, fraco a ${ESCOLAS[i.fraqueza].nome}` : ''}${i.molhado ? ', MOLHADO' : ''}${i.metalico ? ', blindado em metal' : ''})`).join(' · ')}` : ''}
      <br><i>Dica: descreva o MECANISMO e ligue causa e efeito ("porque", "de modo que"). Citar física real (alavanca, empuxo, condutividade, dilatação, centro de massa) dá bônus grandes.</i>`;
    setTimeout(() => $('#gmText').focus(), 50);
  } else if (game.rodando) game.canvas.requestPointerLock();
}

$('#gmSend').onclick = enviarGM;
$('#gmText').addEventListener('keydown', e => {
  if (e.code === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarGM(); }
});

function enviarGM() {
  const txt = $('#gmText').value.trim();
  if (!txt) return;
  const r = game.processarGM(txt);
  const log = $('#gmLog');
  log.insertAdjacentHTML('beforeend', `
    <div class="gm-you"><b>Você:</b> ${txt.replace(/</g, '&lt;')}</div>
    <div class="gm-m">
      <div class="gm-title">${r.titulo} <span class="roll">${r.linha}</span></div>
      <div class="gm-reason">${r.raciocinio.map(p => `<div>${p}</div>`).join('')}</div>
      <div class="gm-narr">${r.narracao}</div>
      <div class="gm-tips"><b>Mestre:</b> ${r.dicas.join(' ')}</div>
    </div>`);
  log.scrollTop = log.scrollHeight;
  $('#gmText').value = '';
}

function abrirFicha() {
  const s = $('#screen-sheet');
  if (!s.classList.contains('hidden')) { s.classList.add('hidden'); if (game.rodando) game.canvas.requestPointerLock(); return; }
  document.exitPointerLock?.();
  renderFicha();
  s.classList.remove('hidden');
}

function renderFicha() {
  const p = game.player, b = p.build, f = p.ficha;
  $('#sheetBody').innerHTML = `
    <h2>${b.nome} <small>Nv ${p.nivel} · ${RACES[b.raca].nome} · ${ORIGENS[b.origem].nome} · ${CLASSES[b.classe].nome}</small></h2>
    <div class="sheet-grid">
      <div>
        <h4>Atributos ${b.pontosLivres ? `<span class="pts">${b.pontosLivres} ponto(s) livres</span>` : ''}</h4>
        ${Object.entries(ATTRS).map(([k, a]) => `
          <div class="sh-attr"><span title="${a.desc}">${a.nome}</span><b>${f.attrs[k]}</b>
          ${b.pontosLivres ? `<button data-up="${k}">+</button>` : ''}</div>`).join('')}
        <h4>Corpo</h4>
        <ul class="sh-list">
          <li>Massa ${f.massa.toFixed(0)} kg · Altura ${b.corpo.altura.toFixed(2)} m</li>
          <li>Carga máxima ${f.carga.toFixed(0)} kg</li>
          <li>Velocidade ${f.veloc.toFixed(1)} m/s · Pulo ${(f.pulo * f.pulo / 44).toFixed(2)} m</li>
          <li>Armadura ${(f.armadura * 100).toFixed(0)}% · Resist. mágica ${(f.resistMagica * 100).toFixed(0)}%</li>
        </ul>
      </div>
      <div>
        <h4>Grimório</h4>
        ${p.magias.map(m => `<div class="sh-sp" style="--c:${ESCOLAS[MAGIAS[m].escola].cor}"><b>${MAGIAS[m].nome}</b> <span>${MAGIAS[m].custo} mana · ${MAGIAS[m].cd}s</span><p>${MAGIAS[m].desc}</p></div>`).join('')}
        <h4>Escolas</h4>
        ${b.escolas.map(e => `<div class="sh-esc" style="--c:${ESCOLAS[e].cor}"><b>${ESCOLAS[e].nome}</b><p>${ESCOLAS[e].fisica}</p></div>`).join('')}
        <h4>Traços</h4>
        ${b.tracos.length ? b.tracos.map(t => `<div class="sh-tr"><b>${TRACOS[t].nome}</b> ${TRACOS[t].desc}</div>`).join('') : '<p>Nenhum</p>'}
      </div>
      <div>
        <h4>Missões</h4>
        ${MISSOES.map(q => {
          const st = game.quests.estado[q.id];
          return `<div class="sh-q ${st.status}"><b>${q.nome}</b> <i>${st.status}</i><p>${q.desc}</p>
            ${st.status !== 'bloqueada' ? q.objetivos.map(o => `<div class="o">${st.prog[o.id] >= (o.qtd || 1) ? '✔' : '○'} ${o.texto} (${st.prog[o.id]}/${o.qtd || 1})</div>`).join('') : ''}</div>`;
        }).join('')}
      </div>
    </div>
    <button class="close" id="shClose">Fechar (C)</button>`;
  $('#sheetBody').querySelectorAll('[data-up]').forEach(btn => btn.onclick = () => {
    const k = btn.dataset.up;
    game.player.build.attrs[k]++;
    game.player.build.pontosLivres--;
    game.player.ficha = computarFicha(game.player.build);
    renderFicha();
  });
  $('#shClose').onclick = () => { $('#screen-sheet').classList.add('hidden'); if (game.rodando) game.canvas.requestPointerLock(); };
}

function abrirMapa() {
  const s = $('#screen-map');
  if (!s.classList.contains('hidden')) { s.classList.add('hidden'); if (game.rodando) game.canvas.requestPointerLock(); return; }
  document.exitPointerLock?.();
  desenharMapa();
  s.classList.remove('hidden');
}

let mapaCache = null;
function desenharMapa() {
  const c = $('#mapCanvas'), ctx = c.getContext('2d');
  const N = c.width;
  if (!mapaCache) {
    const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const wx = (x / N - 0.5) * WORLD_SIZE, wz = (y / N - 0.5) * WORLD_SIZE;
        const h = heightAt(wx, wz);
        const b = biomeAt(wx, wz);
        const col = new THREE.Color(b === 'water' ? '#26527d' : BIOME_INFO[b].cor);
        const sh = 0.6 + Math.min(1, Math.max(0, h / 80)) * 0.7;
        const i = (y * N + x) * 4;
        img.data[i] = col.r * 255 * sh; img.data[i + 1] = col.g * 255 * sh; img.data[i + 2] = col.b * 255 * sh; img.data[i + 3] = 255;
      }
    }
    const off = document.createElement('canvas'); off.width = off.height = N;
    off.getContext('2d').putImageData(img, 0, 0);
    mapaCache = off;
  }
  ctx.drawImage(mapaCache, 0, 0);
  const w2m = (x, z) => [(x / WORLD_SIZE + 0.5) * N, (z / WORLD_SIZE + 0.5) * N];

  // chefes
  ctx.font = 'bold 11px sans-serif';
  for (const [id, b] of Object.entries(CHEFES)) {
    const [px, py] = w2m(b.pos[0], b.pos[1]);
    const morto = !game.inimigos.find(e => e.tipoId === id && e.vivo);
    ctx.fillStyle = morto ? '#555' : '#ff4444';
    ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(b.nome, px + 10, py + 4);
  }
  // vila
  const [vx, vy] = w2m(game.village.x, game.village.z);
  ctx.fillStyle = '#ffdd55'; ctx.beginPath(); ctx.arc(vx, vy, 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText('Pedravil', vx + 9, vy + 4);
  // jogador
  const [px, py] = w2m(game.player.body.pos.x, game.player.body.pos.z);
  ctx.fillStyle = '#66ff99'; ctx.beginPath(); ctx.arc(px, py, 5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px, py);
  ctx.lineTo(px + Math.sin(game.camYaw) * -14, py + Math.cos(game.camYaw) * -14); ctx.stroke();

  $('#mapLegend').innerHTML = Object.entries(BIOME_INFO).map(([k, v]) =>
    `<span><i style="background:${v.cor}"></i>${v.nome} <small>mana ×${v.mana} — ${v.desc}</small></span>`).join('');
}

function renderLore() {
  $('#loreBody').innerHTML = `
    <h2>Códice do Véu</h2>
    <pre class="prologo">${PROLOGO}</pre>
    <h3>Controles</h3>
    <div class="keys">
      ${[['WASD', 'Mover'], ['Mouse', 'Olhar'], ['Espaço', 'Pular / planar (raças leves)'], ['Shift', 'Correr (gasta estamina)'],
         ['1–8', 'Selecionar magia'], ['Clique esq.', 'Conjurar / colocar peça'], ['Clique dir.', 'Ataque físico / remover peça'],
         ['F', 'Ataque corpo-a-corpo'], ['E', 'Interagir / coletar recursos'], ['B', 'Modo construção'],
         ['Z / X / R', 'Peça / material / girar'], ['G', 'Mestre do Véu (IA)'], ['C', 'Ficha'], ['TAB', 'Mapa'], ['M', 'Salvar']].map(([k, v]) =>
        `<div><kbd>${k}</kbd> ${v}</div>`).join('')}
    </div>
    <h3>As Leis do Mundo</h3>
    <ul class="leis">
      <li><b>Massa importa.</b> Todo impulso é força ÷ massa. Um golem de 280 kg ignora rajadas que arremessam um feérico de 38 kg a 20 metros.</li>
      <li><b>Queda = ½mv².</b> Acima de ~3 m você começa a se machucar; a escala é quadrática na velocidade.</li>
      <li><b>Fogo precisa de combustível e oxigênio.</b> Na floresta seca ele se alastra; na água ou na neve simplesmente não pega.</li>
      <li><b>Eletricidade segue o menor caminho.</b> Molhe o alvo, ou ataque quem veste metal: o dano multiplica e salta em cadeia.</li>
      <li><b>Água pesa.</b> O volume que você move é limitado pelo seu Intelecto. No deserto você extrai do ar — custo triplo.</li>
      <li><b>Terra não cria matéria.</b> Você molda o que existe. Sem solo, sem geomancia.</li>
      <li><b>Estruturas desabam.</b> Peças de construção sem apoio caem, e o colapso se propaga.</li>
      <li><b>O bioma muda tudo.</b> Densidade de mana, atrito do chão, condutividade e temperatura variam por região.</li>
    </ul>
    <h3>O Mestre do Véu</h3>
    <p>Pressione <kbd>G</kbd> a qualquer momento e descreva uma ação que o jogo não tem botão para fazer. O Mestre lê o ambiente real
    (bioma, materiais num raio de 18 m, massa e fraquezas dos inimigos, sua mana e carga), avalia se o mecanismo que você
    descreveu é fisicamente coerente, e rola um d20 contra uma dificuldade calculada. Ele mostra <b>todo o raciocínio</b>:
    cada +2, cada −6, e por quê.</p>
    <p><b>O que ganha bônus:</b> citar mecanismos reais (alavanca e torque, empuxo, condutividade, triângulo do fogo,
    dilatação térmica, centro de massa, pressão, atrito, ressonância, óptica, osmose, energia potencial), ligar causa e efeito
    com "porque / de modo que / fazendo com que", usar sua escola de magia, aproveitar o bioma, e atacar a fraqueza certa.</p>
    <p><b>O que perde:</b> declarar o resultado em vez da ação ("eu venço"), pedir matéria do nada, ignorar a massa dos objetos,
    ou ser vago.</p>
    <h3>Chefes</h3>
    ${Object.values(CHEFES).map(b => `<div class="lore-boss"><b>${b.nome}</b> <small>${b.vida} HP · ${b.massa} kg${b.fraqueza ? ` · fraco a ${ESCOLAS[b.fraqueza].nome}` : ' · sem fraqueza conhecida'}</small>
      <p>${b.desc}</p><ul>${b.fases.map(f => `<li>${f}</li>`).join('')}</ul></div>`).join('')}
    <button class="close" onclick="document.querySelector('#screen-lore').classList.add('hidden');document.querySelector('#screen-title').classList.remove('hidden')">Voltar</button>`;
}

boot();
