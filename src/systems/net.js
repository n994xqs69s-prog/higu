import * as THREE from 'three';
import { buildAvatar, animarAvatar, computarFicha } from './character.js';

// ---------------------------------------------------------------------------
// Multiplayer leve por WebSocket: autoridade no cliente para o próprio avatar,
// interpolação para os remotos. Compartilha posição, animação, vida e
// eventos (magia lançada, chat, veredictos do Mestre).
// ---------------------------------------------------------------------------

export class Net {
  constructor(game, sala, nome) {
    this.game = game;
    this.sala = sala;
    this.nome = nome;
    this.id = null;
    this.ultimoEnvio = 0;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.url = `${proto}://${location.host}/ws`;
    this.conectar();
  }

  conectar() {
    try { this.ws = new WebSocket(this.url); } catch { return; }
    this.ws.onopen = () => {
      this.game.log('🌐 Conectado ao servidor do Véu.', 'dica');
      this.enviar({ t: 'join', sala: this.sala, nome: this.nome, build: this.game.player.build });
    };
    this.ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      this.receber(m);
    };
    this.ws.onclose = () => {
      this.game.log('🌐 Desconectado. Tentando reconectar…', 'aviso');
      setTimeout(() => this.conectar(), 3000);
    };
    this.ws.onerror = () => {};
  }

  enviar(o) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(o)); }

  enviarEstado(p) {
    const agora = performance.now();
    if (agora - this.ultimoEnvio < 60) return;   // ~16 Hz
    this.ultimoEnvio = agora;
    this.enviar({
      t: 'st',
      p: [+p.body.pos.x.toFixed(2), +p.body.pos.y.toFixed(2), +p.body.pos.z.toFixed(2)],
      r: +p.mesh.rotation.y.toFixed(2),
      v: +Math.hypot(p.body.vel.x, p.body.vel.z).toFixed(1),
      hp: Math.round(p.vida), hpm: p.ficha.vidaMax,
      ar: !p.body.grounded, cj: p.conjurando > 0, vivo: p.vivo,
    });
  }

  receber(m) {
    const g = this.game;
    switch (m.t) {
      case 'welcome':
        this.id = m.id;
        g.log(`Você entrou na sala "${this.sala}" (${m.jogadores} jogador(es)).`, 'dica');
        break;
      case 'join':
        if (m.id === this.id) return;
        this.addRemoto(m.id, m.nome, m.build);
        g.log(`👤 ${m.nome} entrou na sala.`, 'dica');
        break;
      case 'leave': {
        const r = g.remotos.get(m.id);
        if (r) { g.scene.remove(r.mesh); g.remotos.delete(m.id); g.log(`👤 ${r.nome} saiu.`, 'dica'); }
        break;
      }
      case 'st': {
        const r = g.remotos.get(m.id);
        if (!r) return;
        r.alvoPos.set(m.p[0], m.p[1], m.p[2]);
        r.alvoRot = m.r;
        r.velocidade = m.v;
        r.vida = m.hp; r.ficha.vidaMax = m.hpm;
        r.noAr = m.ar; r.conj = m.cj ? 0.3 : 0;
        r.vivo = m.vivo;
        break;
      }
      case 'chat':
        g.log(`💬 ${m.nome}: ${m.msg}`);
        break;
      case 'gm':
        g.log(`🜁 Mestre para ${m.nome}: ${m.titulo}`, 'quest');
        break;
      case 'estado_sala':
        (m.jogadores || []).forEach(j => { if (j.id !== this.id) this.addRemoto(j.id, j.nome, j.build); });
        break;
    }
  }

  addRemoto(id, nome, build) {
    const g = this.game;
    if (g.remotos.has(id)) return;
    const mesh = buildAvatar(build);
    g.scene.add(mesh);
    const r = {
      id, nome, build, mesh, ehJogador: true, vivo: true,
      ficha: computarFicha(build),
      vida: 100, velocidade: 0, noAr: false, conj: 0,
      alvoPos: new THREE.Vector3(), alvoRot: 0,
      body: { pos: mesh.position, vel: new THREE.Vector3(), massa: 80, raio: 0.42, altura: build.corpo.altura, aplicarImpulso() {} },
      molhado: 0, queimando: 0, stun: 0, escudo: 0, invulneravel: 0,
      cooldowns: {}, buffs: {},
    };
    g.remotos.set(id, r);
  }

  /** Interpolação dos remotos — chamado pelo loop do jogo. */
  interpolar(dt) {
    for (const r of this.game.remotos.values()) {
      r.mesh.position.lerp(r.alvoPos, Math.min(1, dt * 10));
      r.mesh.rotation.y += (r.alvoRot - r.mesh.rotation.y) * Math.min(1, dt * 10);
      animarAvatar(r.mesh, dt, { velocidade: r.velocidade, noAr: r.noAr, conjurando: r.conj, vivo: r.vivo });
    }
  }

  chat(msg) { this.enviar({ t: 'chat', msg }); }
}
