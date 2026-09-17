import * as THREE from 'three';
import { buildAvatar, animarAvatar, computarFicha } from './character.js';

// ---------------------------------------------------------------------------
// MULTIPLAYER SEM SERVIDOR PRÓPRIO.
//
// Usa WebRTC via PeerJS, cujo broker público e gratuito cuida apenas do
// handshake inicial — o tráfego do jogo é P2P direto entre os navegadores.
// Isso permite hospedar o jogo como site 100% estático (GitHub Pages, Vercel,
// Netlify, itch.io) sem nenhum backend, custo ou limite de horas.
//
// Topologia: estrela. O primeiro a entrar na sala vira HOST (id determinístico
// "higu-<sala>") e repassa o estado entre todos. Se o host cair, o próximo
// jogador assume automaticamente.
//
// O PeerJS é carregado sob demanda por CDN: quem joga só single-player nunca
// baixa esse código.
// ---------------------------------------------------------------------------

const PEERJS_CDN = 'https://esm.sh/peerjs@1.5.4';
const TICK = 60;   // ms entre envios (~16 Hz)

export class Net {
  constructor(game, sala, nome) {
    this.game = game;
    this.sala = (sala || 'ardel').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'ardel';
    this.nome = nome;
    this.hostId = `higu-${this.sala}-host`;
    this.ehHost = false;
    this.conns = new Map();
    this.ultimoEnvio = 0;
    this.estado = 'conectando';
    this.iniciar();
  }

  async iniciar() {
    let Peer;
    try {
      ({ default: Peer } = await import(/* @vite-ignore */ PEERJS_CDN));
    } catch {
      this.game.log('🌐 Não foi possível carregar o módulo de rede. Jogando offline.', 'aviso');
      this.estado = 'offline';
      return;
    }
    this.Peer = Peer;
    this.tentarHost();
  }

  /** Tenta reservar o id de host da sala. Se já existir, entra como cliente. */
  tentarHost() {
    this.peer = new this.Peer(this.hostId, { debug: 0 });
    this.peer.on('open', () => {
      this.ehHost = true;
      this.estado = 'host';
      this.game.log(`🌐 Sala "${this.sala}" criada — você é o anfitrião. Compartilhe o nome da sala.`, 'dica');
      this.peer.on('connection', c => this.aceitar(c));
    });
    this.peer.on('error', err => {
      if (err.type === 'unavailable-id') {
        // Já existe host: vira cliente.
        try { this.peer.destroy(); } catch {}
        this.entrarComoCliente();
      } else if (err.type === 'peer-unavailable') {
        this.game.log('🌐 O anfitrião saiu. Assumindo a sala…', 'aviso');
        setTimeout(() => this.tentarHost(), 800);
      } else if (this.estado === 'conectando') {
        this.game.log('🌐 Rede indisponível — jogando offline.', 'aviso');
        this.estado = 'offline';
      }
    });
  }

  entrarComoCliente() {
    this.peer = new this.Peer(undefined, { debug: 0 });
    this.peer.on('open', () => {
      const c = this.peer.connect(this.hostId, { reliable: false, metadata: { nome: this.nome } });
      this.aceitar(c, true);
      this.estado = 'cliente';
    });
    this.peer.on('error', err => {
      if (err.type === 'peer-unavailable') setTimeout(() => this.tentarHost(), 600);
    });
    this.peer.on('connection', c => this.aceitar(c));
  }

  aceitar(conn, souCliente = false) {
    conn.on('open', () => {
      this.conns.set(conn.peer, conn);
      conn.send({ t: 'ola', id: this.peer.id, nome: this.nome, build: this.game.player.build });
      if (souCliente) this.game.log('🌐 Conectado ao anfitrião da sala.', 'dica');
    });
    conn.on('data', d => this.receber(d, conn));
    conn.on('close', () => {
      this.conns.delete(conn.peer);
      const r = this.game.remotos.get(conn.peer);
      if (r) { this.game.scene.remove(r.mesh); this.game.remotos.delete(conn.peer); this.game.log(`👤 ${r.nome} saiu.`, 'dica'); }
      if (!this.ehHost && conn.peer === this.hostId) {
        this.game.log('🌐 Anfitrião caiu. Tentando assumir…', 'aviso');
        try { this.peer.destroy(); } catch {}
        setTimeout(() => this.tentarHost(), 400 + Math.random() * 1200);
      }
    });
    conn.on('error', () => {});
  }

  /** Host repassa tudo que recebe para os demais (relay em estrela). */
  repassar(msg, origem) {
    if (!this.ehHost) return;
    for (const [id, c] of this.conns) {
      if (id === origem) continue;
      try { c.send(msg); } catch {}
    }
  }

  broadcast(msg) {
    for (const c of this.conns.values()) { try { c.send(msg); } catch {} }
  }

  receber(m, conn) {
    const g = this.game;
    const id = m.id || conn.peer;
    switch (m.t) {
      case 'ola':
        this.addRemoto(id, m.nome, m.build);
        g.log(`👤 ${m.nome} entrou na sala.`, 'dica');
        // host apresenta os já conectados ao recém-chegado e vice-versa
        if (this.ehHost) {
          for (const r of g.remotos.values()) {
            if (r.id === id) continue;
            try { conn.send({ t: 'ola', id: r.id, nome: r.nome, build: r.build }); } catch {}
          }
          this.repassar(m, conn.peer);
        }
        break;
      case 'st': {
        const r = g.remotos.get(id);
        if (r) {
          r.alvoPos.set(m.p[0], m.p[1], m.p[2]);
          r.alvoRot = m.r; r.velocidade = m.v;
          r.vida = m.hp; r.ficha.vidaMax = m.hpm;
          r.noAr = m.ar; r.conj = m.cj ? 0.3 : 0; r.vivo = m.vivo;
        }
        this.repassar(m, conn.peer);
        break;
      }
      case 'chat':
        g.log(`💬 ${m.nome}: ${m.msg}`);
        this.repassar(m, conn.peer);
        break;
      case 'gm':
        g.log(`🜁 Mestre para ${m.nome}: ${m.titulo}`, 'quest');
        this.repassar(m, conn.peer);
        break;
    }
  }

  enviarEstado(p) {
    if (!this.conns.size) return;
    const agora = performance.now();
    if (agora - this.ultimoEnvio < TICK) return;
    this.ultimoEnvio = agora;
    this.broadcast({
      t: 'st', id: this.peer?.id,
      p: [+p.body.pos.x.toFixed(2), +p.body.pos.y.toFixed(2), +p.body.pos.z.toFixed(2)],
      r: +p.mesh.rotation.y.toFixed(2),
      v: +Math.hypot(p.body.vel.x, p.body.vel.z).toFixed(1),
      hp: Math.round(p.vida), hpm: p.ficha.vidaMax,
      ar: !p.body.grounded, cj: p.conjurando > 0, vivo: p.vivo,
    });
  }

  addRemoto(id, nome, build) {
    const g = this.game;
    if (g.remotos.has(id) || id === this.peer?.id) return;
    const mesh = buildAvatar(build);
    g.scene.add(mesh);
    g.remotos.set(id, {
      id, nome, build, mesh, ehJogador: true, vivo: true,
      ficha: computarFicha(build), vida: 100, velocidade: 0, noAr: false, conj: 0,
      alvoPos: new THREE.Vector3(), alvoRot: 0,
      body: { pos: mesh.position, vel: new THREE.Vector3(), massa: 80, raio: 0.42, altura: build.corpo.altura, aplicarImpulso() {} },
      molhado: 0, queimando: 0, stun: 0, escudo: 0, invulneravel: 0, cooldowns: {}, buffs: {},
    });
  }

  interpolar(dt) {
    for (const r of this.game.remotos.values()) {
      r.mesh.position.lerp(r.alvoPos, Math.min(1, dt * 10));
      r.mesh.rotation.y += (r.alvoRot - r.mesh.rotation.y) * Math.min(1, dt * 10);
      animarAvatar(r.mesh, dt, { velocidade: r.velocidade, noAr: r.noAr, conjurando: r.conj, vivo: r.vivo });
    }
  }

  chat(msg) {
    this.broadcast({ t: 'chat', id: this.peer?.id, nome: this.nome, msg });
    this.game.log(`💬 ${this.nome}: ${msg}`);
  }

  desconectar() { try { this.peer?.destroy(); } catch {} }
}
