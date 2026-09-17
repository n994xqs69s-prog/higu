// Servidor multiplayer + host estático do build.
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('/health', (_, res) => res.json({ ok: true, salas: [...salas.keys()] }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const salas = new Map();   // nome -> Map(id -> {ws, nome, build, st})
let seq = 1;

function broadcast(sala, msg, exceto) {
  const m = salas.get(sala);
  if (!m) return;
  const data = JSON.stringify(msg);
  for (const [id, c] of m) {
    if (id === exceto) continue;
    if (c.ws.readyState === 1) c.ws.send(data);
  }
}

wss.on('connection', ws => {
  const id = 'p' + (seq++);
  let sala = null;

  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }

    if (m.t === 'join') {
      sala = String(m.sala || 'ardel').slice(0, 24);
      if (!salas.has(sala)) salas.set(sala, new Map());
      const s = salas.get(sala);
      s.set(id, { ws, nome: String(m.nome || 'Viajante').slice(0, 24), build: m.build, st: null });
      ws.send(JSON.stringify({ t: 'welcome', id, jogadores: s.size }));
      ws.send(JSON.stringify({
        t: 'estado_sala',
        jogadores: [...s.entries()].filter(([i]) => i !== id).map(([i, c]) => ({ id: i, nome: c.nome, build: c.build })),
      }));
      broadcast(sala, { t: 'join', id, nome: s.get(id).nome, build: m.build }, id);
      return;
    }
    if (!sala || !salas.has(sala)) return;
    const c = salas.get(sala).get(id);
    if (!c) return;

    if (m.t === 'st') { c.st = m; broadcast(sala, { ...m, id }, id); }
    else if (m.t === 'chat') broadcast(sala, { t: 'chat', id, nome: c.nome, msg: String(m.msg).slice(0, 200) });
    else if (m.t === 'gm') broadcast(sala, { t: 'gm', id, nome: c.nome, titulo: m.titulo }, id);
  });

  ws.on('close', () => {
    if (!sala || !salas.has(sala)) return;
    salas.get(sala).delete(id);
    broadcast(sala, { t: 'leave', id });
    if (!salas.get(sala).size) salas.delete(sala);
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`HIGU rodando em http://0.0.0.0:${PORT}`));
