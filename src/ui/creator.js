import * as THREE from 'three';
import { RACES, ORIGENS, CLASSES, ESCOLAS, MAGIAS, TRACOS, ATTRS, CORPO, PONTOS_INICIAIS, ATTR_BASE } from '../systems/chardata.js';
import { analisarPoder, forjarMagia, dicasDoPoder } from '../systems/forge.js';
import { buildAvatar, animarAvatar, computarFicha } from '../systems/character.js';
import { Textures, skyTexture } from '../systems/textures.js';
import { capacidadeCarga, velocidadeArremesso, alcanceBalistico } from '../systems/physics.js';

// ---------------------------------------------------------------------------
// Criador de personagem em 6 abas, com preview 3D girável em tempo real e
// EXPLICAÇÃO DETALHADA de cada escolha (efeito mecânico + consequência física).
// ---------------------------------------------------------------------------

export function buildPadrao() {
  return {
    nome: 'Sem-Nome',
    raca: 'humano',
    origem: 'aldeao',
    classe: 'mago',
    elemento: 'fogo',
    escolas: ['fogo'],
    magias: ['brasa'],
    tracos: [],
    attrs: { forca: 0, destreza: 0, vigor: 0, intelecto: 0, espirito: 0, carisma: 0 },
    corpo: { altura: 1.78, massa: 78, musculo: 50, ombros: 50 },
    cores: { pele: '#d9a066', cabelo: '#2b1b12', olhos: '#4aa3ff', roupa: '#3a4a7a' },
    nivel: 1, xp: 0, pontosLivres: 0,
    biografia: '',
    poderes: [],
  };
}

export class Creator {
  constructor(root, onDone) {
    this.root = root;
    this.onDone = onDone;
    this.build = buildPadrao();
    this.aba = 0;
    this.abas = ['Raça', 'Origem & Classe', 'Atributos', 'Magia', 'Forja de Poderes', 'Corpo & Aparência', 'Revisão'];
    this.setupPreview();
    this.render();
  }

  // --- Preview 3D --------------------------------------------------------
  setupPreview() {
    this.pScene = new THREE.Scene();
    this.pScene.background = skyTexture('#1a2340', '#5a6a95');
    this.pCam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.pCam.position.set(0, 1.4, 4.2);
    this.pRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.pRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.pRenderer.shadowMap.enabled = true;
    this.pRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const key = new THREE.DirectionalLight(0xfff0dd, 2.4);
    key.position.set(3, 5, 4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.9);
    fill.position.set(-4, 2, -3);
    const rim = new THREE.PointLight(0xaa66ff, 40, 20, 2);
    rim.position.set(0, 3, -3);
    this.pScene.add(key, fill, rim, new THREE.HemisphereLight(0x8899cc, 0x332222, 0.7));

    const chao = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 0.2, 40),
      new THREE.MeshStandardMaterial({ map: Textures.get('runes', 2), roughness: 0.7, emissive: 0x221144, emissiveIntensity: 0.6 })
    );
    chao.position.y = -0.1; chao.receiveShadow = true;
    this.pScene.add(chao);

    this.pPivot = new THREE.Group();
    this.pScene.add(this.pPivot);
    this.rotY = 0.5;
    this.dragging = false;
    this.rebuildAvatar();
  }

  rebuildAvatar() {
    if (this.avatar) this.pPivot.remove(this.avatar);
    this.avatar = buildAvatar(this.build);
    this.avatar.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.pPivot.add(this.avatar);
    const h = this.build.corpo.altura;
    this.pCam.position.set(0, h * 0.62, h * 2.35);
    this.pCam.lookAt(0, h * 0.5, 0);
  }

  tick(dt) {
    if (!this.canvas || !this.root.offsetParent) return;
    const w = this.canvas.clientWidth, hh = this.canvas.clientHeight;
    if (w && hh && (this.canvas.width !== w * devicePixelRatio || this.canvas.height !== hh * devicePixelRatio)) {
      this.pRenderer.setSize(w, hh, false);
      this.pCam.aspect = w / hh;
      this.pCam.updateProjectionMatrix();
    }
    if (!this.dragging) this.rotY += dt * 0.35;
    this.pPivot.rotation.y = this.rotY;
    animarAvatar(this.avatar, dt, { velocidade: 0, conjurando: 0.2 });
    this.pRenderer.render(this.pScene, this.pCam);
  }

  // --- Pontos ------------------------------------------------------------
  pontosGastos() { return Object.values(this.build.attrs).reduce((a, b) => a + b, 0); }
  pontosTraco() { return this.build.tracos.reduce((a, t) => a + TRACOS[t].pts, 0); }
  pontosDisp() { return PONTOS_INICIAIS + this.pontosTraco() - this.pontosGastos(); }

  // --- Render ------------------------------------------------------------
  render() {
    const b = this.build;
    this.root.innerHTML = `
      <div class="creator">
        <div class="cr-left">
          <div class="cr-preview"><canvas id="prevCanvas"></canvas>
            <div class="cr-prev-hint">arraste para girar</div>
          </div>
          <div class="cr-stats" id="crStats"></div>
        </div>
        <div class="cr-right">
          <div class="cr-tabs">${this.abas.map((a, i) => `<button class="cr-tab ${i === this.aba ? 'on' : ''}" data-tab="${i}">${i + 1}. ${a}</button>`).join('')}</div>
          <div class="cr-body" id="crBody"></div>
          <div class="cr-foot">
            <button id="crPrev" ${this.aba === 0 ? 'disabled' : ''}>◀ Voltar</button>
            <div class="cr-pts">Pontos livres: <b id="crPts">${this.pontosDisp()}</b></div>
            ${this.aba === this.abas.length - 1
              ? `<button id="crDone" class="primary">Entrar no Véu ▶</button>`
              : `<button id="crNext" class="primary">Avançar ▶</button>`}
          </div>
        </div>
      </div>`;

    this.canvas = this.root.querySelector('#prevCanvas');
    const dpr = Math.min(devicePixelRatio, 2);
    this.pRenderer.setPixelRatio(dpr);
    this.canvas.replaceWith(this.pRenderer.domElement);
    this.pRenderer.domElement.id = 'prevCanvas';
    this.canvas = this.pRenderer.domElement;

    let lastX = 0;
    this.canvas.addEventListener('pointerdown', e => { this.dragging = true; lastX = e.clientX; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', e => { if (this.dragging) { this.rotY += (e.clientX - lastX) * 0.012; lastX = e.clientX; } });
    this.canvas.addEventListener('pointerup', () => { this.dragging = false; });

    this.root.querySelectorAll('.cr-tab').forEach(t => t.onclick = () => { this.aba = +t.dataset.tab; this.render(); });
    const prev = this.root.querySelector('#crPrev'); if (prev) prev.onclick = () => { this.aba = Math.max(0, this.aba - 1); this.render(); };
    const next = this.root.querySelector('#crNext'); if (next) next.onclick = () => { this.aba = Math.min(this.abas.length - 1, this.aba + 1); this.render(); };
    const done = this.root.querySelector('#crDone'); if (done) done.onclick = () => this.finalizar();

    this.renderBody();
    this.renderStats();
  }

  renderBody() {
    const el = this.root.querySelector('#crBody');
    el.innerHTML = [
      () => this.abaRaca(), () => this.abaOrigem(), () => this.abaAttrs(),
      () => this.abaMagia(), () => this.abaForja(), () => this.abaCorpo(), () => this.abaRevisao(),
    ][this.aba]();
    this.bind();
  }

  abaRaca() {
    const b = this.build;
    return `
      <h3>Escolha sua Raça</h3>
      <p class="hint">A raça define sua <b>biologia</b>: massa, tolerância térmica, alcance e regras físicas próprias. Não é cosmético — um Autômato de 280 kg afunda na água, um Feérico de 38 kg é levado pelo vento.</p>
      <div class="grid cards">
        ${Object.entries(RACES).map(([k, r]) => `
          <div class="card ${b.raca === k ? 'sel' : ''}" data-race="${k}">
            <h4>${r.nome}</h4>
            <div class="mods">${Object.entries(r.mods).map(([a, v]) => `<span class="${v > 0 ? 'p' : 'n'}">${ATTRS[a].nome} ${v > 0 ? '+' : ''}${v}</span>`).join('')}</div>
            <p class="desc">${r.desc}</p>
            <p class="passiva">⚑ ${r.passiva}</p>
            ${r.elementos ? `<div class="elem-pick">${Object.entries(r.elementos).map(([ek, ev]) =>
              `<button class="elem ${b.elemento === ek ? 'on' : ''}" data-elem="${ek}" style="--c:${ev.cor}">${ev.nome.replace('Genasi d','D')}</button>`).join('')}
              <small>${r.elementos[b.elemento]?.passiva || ''}</small></div>` : ''}
            <div class="fis">
              <span title="Massa típica da raça">Massa base ${r.fis.massaBase} kg</span>
              <span>Altura ${r.altura[0]}–${r.altura[1]} m</span>
              <span>Tolerância ao frio ×${r.fis.tolFrio}</span>
              <span>ao calor ×${r.fis.tolCalor}</span>
            </div>
          </div>`).join('')}
      </div>`;
  }

  abaOrigem() {
    const b = this.build;
    return `
      <h3>Origem</h3>
      <p class="hint">Sua origem é o <b>conhecimento prévio</b> que o Mestre IA reconhece nos seus argumentos. Um Acadêmico pode citar densidade e ponto de fusão; um Aldeão sabe onde a terra é mole.</p>
      <div class="grid cards small">
        ${Object.entries(ORIGENS).map(([k, o]) => `
          <div class="card ${b.origem === k ? 'sel' : ''}" data-origem="${k}">
            <h4>${o.nome}</h4>
            <div class="mods">${Object.entries(o.bonus).map(([a, v]) => `<span class="p">${ATTRS[a].nome} +${v}</span>`).join('')}</div>
            <p class="desc">${o.desc}</p>
            <p class="passiva">🎒 Item inicial: ${o.item}</p>
          </div>`).join('')}
      </div>
      <h3>Classe</h3>
      <p class="hint">A classe define <b>como você gasta recursos</b> e quantas escolas de magia consegue dominar.</p>
      <div class="grid cards small">
        ${Object.entries(CLASSES).map(([k, c]) => `
          <div class="card ${b.classe === k ? 'sel' : ''}" data-classe="${k}">
            <h4>${c.nome}</h4>
            <div class="mods"><span class="p">${ATTRS[c.prim].nome}</span><span>${c.recurso}</span><span>${c.escolas === 0 ? 'sem magia' : c.escolas + ' escola(s)'}</span></div>
            <p class="desc">${c.desc}</p>
            <p class="passiva">⚙ ${c.mecanica}</p>
            <div class="fis"><span>Vida ×${c.vida}</span><span>Mana ×${c.mana}</span><span>Estamina ×${c.stam}</span></div>
          </div>`).join('')}
      </div>`;
  }

  abaAttrs() {
    const b = this.build;
    const race = RACES[b.raca], orig = ORIGENS[b.origem];
    return `
      <h3>Atributos <small>(base ${ATTR_BASE} · ${PONTOS_INICIAIS} pontos + traços)</small></h3>
      <p class="hint">Cada ponto muda números reais do motor: capacidade de carga em kg, altura de pulo em metros, mana máxima. Passe o mouse para ver o cálculo.</p>
      <div class="attrs">
        ${Object.entries(ATTRS).map(([k, a]) => {
          const inv = b.attrs[k], mod = (race.mods[k] || 0) + (orig.bonus[k] || 0);
          const total = ATTR_BASE + inv + mod;
          return `
          <div class="attr-row">
            <div class="attr-name" title="${a.desc}">${a.nome}<small>${a.desc}</small></div>
            <div class="attr-ctrl">
              <button data-attr="${k}" data-d="-1" ${inv <= 0 ? 'disabled' : ''}>−</button>
              <span class="attr-val">${total}</span>
              <button data-attr="${k}" data-d="1" ${this.pontosDisp() <= 0 || inv >= 10 ? 'disabled' : ''}>+</button>
              <span class="attr-break">${ATTR_BASE} base ${inv ? `+${inv} investido` : ''} ${mod ? `${mod > 0 ? '+' : ''}${mod} raça/origem` : ''}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
      <h3>Traços</h3>
      <p class="hint">Defeitos <b>devolvem pontos</b>; virtudes custam. Traços mudam como o Mestre IA julga você.</p>
      <div class="grid cards tiny">
        ${Object.entries(TRACOS).map(([k, t]) => `
          <div class="card ${b.tracos.includes(k) ? 'sel' : ''} ${t.tipo}" data-traco="${k}">
            <h4>${t.nome} <span class="pts">${t.pts > 0 ? `+${t.pts} pts` : t.pts < 0 ? `${t.pts} pts` : '0 pts'}</span></h4>
            <p class="desc">${t.desc}</p>
          </div>`).join('')}
      </div>`;
  }

  abaMagia() {
    const b = this.build;
    const maxEsc = CLASSES[b.classe].escolas;
    if (maxEsc === 0) return `
      <h3>${CLASSES[b.classe].nome} não conjura magia</h3>
      <p class="hint">${CLASSES[b.classe].desc}</p>
      <p class="hint">⚙ <b>${CLASSES[b.classe].mecanica}</b></p>
      <p class="hint">Isso não te deixa em desvantagem: o <b>Mestre do Véu (G)</b> aceita soluções puramente físicas —
      alavanca, massa, atrito, estrutura — e a sua Força alta amplia exatamente esse tipo de argumento.
      Enquanto um mago derruba o golem com magia, você derruba com um tronco e um ponto de apoio.</p>`;
    const disponiveis = b.escolas.flatMap(e => ESCOLAS[e].magias);
    const maxMagias = 4 + Math.floor((ATTR_BASE + b.attrs.intelecto) / 6);
    return `
      <h3>Escolas de Magia <small>(escolha até ${maxEsc})</small></h3>
      <p class="hint">Cada escola tem uma <b>lei física própria</b>. Ler isso é a diferença entre vencer e morrer — o Mestre IA cobra coerência com essas leis.</p>
      <div class="grid cards small">
        ${Object.entries(ESCOLAS).map(([k, e]) => `
          <div class="card escola ${b.escolas.includes(k) ? 'sel' : ''}" data-escola="${k}" style="--c:${e.cor}">
            <h4><i style="background:${e.cor}"></i> ${e.nome}</h4>
            <p class="desc fisica">⚗ ${e.fisica}</p>
          </div>`).join('')}
      </div>
      <h3>Magias Iniciais <small>(${b.magias.length}/${maxMagias})</small></h3>
      <div class="grid cards tiny">
        ${disponiveis.map(id => {
          const m = MAGIAS[id];
          return `<div class="card magia ${b.magias.includes(id) ? 'sel' : ''}" data-magia="${id}" style="--c:${ESCOLAS[m.escola].cor}">
            <h4>${m.nome}</h4>
            <div class="mods"><span>${m.custo} mana</span><span>${m.dano > 0 ? m.dano + ' dano' : m.dano < 0 ? Math.abs(m.dano) + ' cura' : 'utilidade'}</span><span>${m.cd}s</span></div>
            <p class="desc">${m.desc}</p>
          </div>`;
        }).join('') || '<p class="hint">Escolha ao menos uma escola acima.</p>'}
      </div>`;
  }


  abaForja() {
    const b = this.build;
    const a = this.previaPoder;
    return `
      <h3>Forja de Poderes <small>— invente os seus, não escolha de uma lista</small></h3>
      <p class="hint">Escreva o poder que você <b>imaginou</b>. A Forja lê a sua descrição e a converte
      numa magia jogável de verdade: elemento, forma, dano, custo e recarga saem do que você escreveu.
      Não existe catálogo fechado — se você consegue descrever, o Véu consegue manifestar.</p>
      <p class="hint">
        <b>Quanto melhor a descrição, melhor o poder:</b> explique o mecanismo com "porque" / "de modo que",
        cite física real (pressão, temperatura, condutividade, massa, ressonância, atrito, óptica) e
        <b>aceite uma limitação</b> ("me machuca", "preciso tocar", "demora a carregar", "fico imóvel") —
        limitações aumentam muito a potência.
      </p>

      <div class="forja">
        <div class="forja-in">
          <label>Nome do poder</label>
          <input type="text" id="fjNome" maxlength="34" placeholder="Ex.: Sopro do Inverno Faminto" value="${(this.poderNome || '').replace(/"/g, '&quot;')}">
          <label>Descreva o que acontece</label>
          <textarea id="fjTexto" rows="7" placeholder="Ex.: Eu prendo a respiração e puxo todo o calor do ar à minha frente, de modo que a umidade congela instantaneamente num cone de lâminas de gelo. Como estou roubando energia térmica do meu próprio corpo para isso, minhas mãos racham e eu perco vida a cada uso.">${(this.poderTexto || '')}</textarea>
          <div class="forja-btns">
            <button id="fjAnalisar">🔍 Analisar</button>
            <button id="fjCriar" class="primary" ${a ? '' : 'disabled'}>⚒ Forjar poder</button>
          </div>
          <div class="forja-ex">
            <b>Exemplos para inspirar:</b>
            ${[
              'Invoco uma matilha de lobos de fumaça que perseguem pelo cheiro; some se chover.',
              'Transformo meu sangue em espinhos de ferro que disparo — cada disparo me fere.',
              'Grito numa frequência que faz a pedra ressoar até rachar, porque encontro a frequência natural do material.',
              'Marco o chão com uma runa que inverte a gravidade de quem pisar nela.',
            ].map(e => `<span class="ex" data-ex="${e.replace(/"/g, '&quot;')}">${e}</span>`).join('')}
          </div>
        </div>

        <div class="forja-out">
          ${a ? `
            <div class="fj-card" style="--c:${a.cor}">
              <h4>${this.poderNome || 'Poder sem nome'}</h4>
              <div class="fj-tags">
                <span style="background:${a.cor}">${ESCOLAS[a.escola].nome}</span>
                ${a.escolaSec ? `<span style="background:${ESCOLAS[a.escolaSec].cor}">${ESCOLAS[a.escolaSec].nome}</span>` : ''}
                <span class="neutro">${a.formaNome}</span>
                <span class="neutro">escala ${a.intensNome}</span>
              </div>
              <div class="fj-nums">
                <div><label>Custo</label><b>${a.custo}</b><small>mana</small></div>
                <div><label>${a.dano < 0 ? 'Cura' : 'Dano'}</label><b>${Math.abs(a.dano)}</b><small>${a.dano < 0 ? 'PV' : 'pontos'}</small></div>
                <div><label>Recarga</label><b>${a.cd}</b><small>seg</small></div>
                ${a.raio ? `<div><label>Raio</label><b>${a.raio}</b><small>metros</small></div>` : ''}
              </div>
              <div class="fj-fisica"><b>Lei física herdada:</b> ${a.fisica}</div>
              <div class="fj-rel"><b>Como a Forja leu o seu texto:</b>${a.relatorio.map(l => `<div>${l}</div>`).join('')}</div>
              <div class="fj-dicas"><b>Para melhorar:</b> ${dicasDoPoder(a).join(' ')}</div>
            </div>` : `<div class="fj-vazio">Escreva o seu poder e clique em <b>Analisar</b>.<br><br>
              A Forja vai mostrar aqui o elemento detectado, a forma, o dano, o custo e
              <b>exatamente por que</b> chegou a esses números.</div>`}

          ${b.poderes.length ? `<div class="fj-lista"><b>Seus poderes forjados (${b.poderes.length}/6)</b>
            ${b.poderes.map((p, i) => `<div class="fj-item" style="--c:${p.cor}">
              <span class="fj-nm">${p.nome}</span>
              <span class="fj-meta">${ESCOLAS[p.escola].nome} · ${p.formaNome} · ${p.custo} mana · ${p.dano < 0 ? '+' + Math.abs(p.dano) + ' PV' : p.dano + ' dano'} · ${p.cd}s</span>
              <button class="fj-del" data-del="${i}">✕</button></div>`).join('')}</div>` : ''}
        </div>
      </div>`;
  }

  abaCorpo() {
    const b = this.build, r = RACES[b.raca];
    const sliders = [
      ['altura', b.corpo.altura, r.altura[0], r.altura[1], 0.01, v => v.toFixed(2) + ' m'],
      ['massa', b.corpo.massa, r.peso[0], r.peso[1], 1, v => v + ' kg'],
      ['musculo', b.corpo.musculo, 0, 100, 1, v => v + '%'],
      ['ombros', b.corpo.ombros, 0, 100, 1, v => v + '%'],
    ];
    return `
      <h3>Corpo</h3>
      <p class="hint">Proporções afetam o modelo 3D <b>e</b> a simulação: massa define inércia e dano de queda; altura define alcance e hitbox.</p>
      ${sliders.map(([k, v, min, max, step, fmt]) => `
        <div class="slider-row">
          <label>${CORPO[k].label} <b>${fmt(v)}</b></label>
          <input type="range" data-corpo="${k}" min="${min}" max="${max}" step="${step}" value="${v}">
          <small>${CORPO[k].desc}</small>
        </div>`).join('')}
      <h3>Aparência</h3>
      <div class="cores">
        ${[['pele', 'Pele'], ['cabelo', 'Cabelo'], ['olhos', 'Olhos (brilho arcano)'], ['roupa', 'Vestes']].map(([k, l]) => `
          <div class="cor-row"><label>${l}</label><input type="color" data-cor="${k}" value="${b.cores[k]}"></div>`).join('')}
        <div class="cor-row swatches">${r.cores.map(c => `<button class="sw" data-sw="${c}" style="background:${c}"></button>`).join('')}</div>
      </div>
      <h3>Identidade</h3>
      <div class="slider-row"><label>Nome</label><input type="text" id="crNome" maxlength="24" value="${b.nome}"></div>
      <div class="slider-row"><label>Biografia <small>— o Mestre IA lê isso e aceita referências ao seu passado como argumento</small></label>
        <textarea id="crBio" rows="4" placeholder="Ex.: Cresci numa ferraria; sei a que temperatura o aço perde a têmpera e como um cabo de polia se prende sem nó.">${b.biografia}</textarea></div>`;
  }

  abaRevisao() {
    const b = this.build;
    const f = computarFicha(b);
    const cap = f.carga;
    const vArr = velocidadeArremesso(cap, 50);
    return `
      <h3>Ficha de ${b.nome}</h3>
      <p class="hint">${RACES[b.raca].nome} · ${ORIGENS[b.origem].nome} · ${CLASSES[b.classe].nome} · Nível 1</p>
      <div class="review">
        <div class="rev-col">
          <h4>Recursos</h4>
          <ul>
            <li>Vida máxima: <b>${f.vidaMax}</b></li>
            <li>Mana máxima: <b>${f.manaMax}</b> (regen ${f.regenMana.toFixed(1)}/s)</li>
            <li>Estamina: <b>${f.stamMax}</b> (regen ${f.regenStam.toFixed(1)}/s)</li>
            <li>Armadura: <b>${(f.armadura * 100).toFixed(0)}%</b> · Resistência mágica: <b>${(f.resistMagica * 100).toFixed(0)}%</b></li>
          </ul>
          <h4>Física do seu corpo</h4>
          <ul>
            <li>Massa: <b>${f.massa.toFixed(0)} kg</b> — vento e explosões te movem ${(80 / f.massa).toFixed(2)}× o padrão</li>
            <li>Velocidade: <b>${f.veloc.toFixed(1)} m/s</b> (${(f.veloc * 3.6).toFixed(0)} km/h)</li>
            <li>Altura de pulo: <b>${(f.pulo * f.pulo / 44).toFixed(2)} m</b></li>
            <li>Carga máxima: <b>${cap.toFixed(0)} kg</b></li>
            <li>Arremesso de 50 kg: <b>${vArr.toFixed(1)} m/s</b>, alcance ~<b>${alcanceBalistico(vArr).toFixed(0)} m</b></li>
            <li>Dano de queda começa acima de <b>~3,2 m</b> e escala com ½mv²</li>
          </ul>
        </div>
        <div class="rev-col">
          <h4>Magia</h4>
          <ul>${b.escolas.map(e => `<li><b style="color:${ESCOLAS[e].cor}">${ESCOLAS[e].nome}</b> — ${ESCOLAS[e].fisica}</li>`).join('')}</ul>
          <h4>Grimório</h4>
          <ul>${b.magias.map(m => `<li>${MAGIAS[m].nome} — ${MAGIAS[m].custo} mana · ${MAGIAS[m].desc}</li>`).join('') || '<li>Nenhuma magia de escola</li>'}</ul>
          <h4>Poderes forjados por você</h4>
          <ul>${b.poderes.length ? b.poderes.map(p => `<li><b style="color:${p.cor}">${p.nome}</b> — ${ESCOLAS[p.escola].nome} · ${p.formaNome} · ${p.custo} mana · ${p.dano < 0 ? '+' + Math.abs(p.dano) + ' PV' : p.dano + ' dano'} · ${p.cd}s<br><small>${p.desc}</small></li>`).join('') : '<li>Nenhum — volte à aba <b>Forja de Poderes</b> e invente o seu.</li>'}</ul>
          <h4>Traços</h4>
          <ul>${b.tracos.length ? b.tracos.map(t => `<li>${TRACOS[t].nome} — ${TRACOS[t].desc}</li>`).join('') : '<li>Nenhum</li>'}</ul>
        </div>
      </div>
      <p class="hint">Tudo pronto. No mundo: <b>WASD</b> mover · <b>Espaço</b> pular · <b>Shift</b> correr · <b>1-6</b> magias · <b>clique</b> conjurar · <b>B</b> construir · <b>G</b> Mestre IA · <b>TAB</b> mapa · <b>C</b> ficha.</p>`;
  }

  renderStats() {
    const f = computarFicha(this.build);
    const b = this.build;
    this.root.querySelector('#crStats').innerHTML = `
      <div class="st-name">${b.nome}</div>
      <div class="st-sub">${RACES[b.raca].nome} · ${CLASSES[b.classe].nome}</div>
      <div class="st-grid">
        <div><label>Vida</label><b>${f.vidaMax}</b></div>
        <div><label>Mana</label><b>${f.manaMax}</b></div>
        <div><label>Estamina</label><b>${f.stamMax}</b></div>
        <div><label>Massa</label><b>${f.massa.toFixed(0)}kg</b></div>
        <div><label>Veloc.</label><b>${f.veloc.toFixed(1)}m/s</b></div>
        <div><label>Carga</label><b>${f.carga.toFixed(0)}kg</b></div>
      </div>
      <div class="st-esc">${b.escolas.map(e => `<span style="background:${ESCOLAS[e].cor}">${ESCOLAS[e].nome}</span>`).join('')}</div>`;
  }

  bind() {
    const b = this.build, R = () => { this.rebuildAvatar(); this.renderBody(); this.renderStats(); this.root.querySelector('#crPts').textContent = this.pontosDisp(); };

    this.root.querySelectorAll('[data-race]').forEach(el => el.onclick = () => {
      b.raca = el.dataset.race;
      const r = RACES[b.raca];
      b.corpo.altura = +(((r.altura[0] + r.altura[1]) / 2)).toFixed(2);
      b.corpo.massa = Math.round((r.peso[0] + r.peso[1]) / 2);
      b.cores.pele = r.cores[0];
      if (r.elementos && !r.elementos[b.elemento]) b.elemento = Object.keys(r.elementos)[0];
      // reequilibra pontos se raça mudou limites
      R();
    });
    this.root.querySelectorAll('[data-elem]').forEach(el => el.onclick = ev => {
      ev.stopPropagation(); b.elemento = el.dataset.elem; R();
    });
    this.root.querySelectorAll('[data-origem]').forEach(el => el.onclick = () => { b.origem = el.dataset.origem; R(); });
    this.root.querySelectorAll('[data-classe]').forEach(el => el.onclick = () => {
      b.classe = el.dataset.classe;
      const max = CLASSES[b.classe].escolas;
      if (max === 0) { b.escolas = []; b.magias = []; }
      else {
        if (!b.escolas.length) b.escolas = ['fogo'];
        if (b.escolas.length > max) b.escolas = b.escolas.slice(0, max);
        b.magias = b.magias.filter(m => b.escolas.includes(MAGIAS[m].escola));
        if (!b.magias.length) b.magias = [ESCOLAS[b.escolas[0]].magias[0]];
      }
      R();
    });
    this.root.querySelectorAll('[data-attr]').forEach(el => el.onclick = () => {
      const k = el.dataset.attr, d = +el.dataset.d;
      if (d > 0 && this.pontosDisp() <= 0) return;
      b.attrs[k] = Math.max(0, Math.min(10, b.attrs[k] + d));
      R();
    });
    this.root.querySelectorAll('[data-traco]').forEach(el => el.onclick = () => {
      const k = el.dataset.traco;
      const i = b.tracos.indexOf(k);
      if (i >= 0) {
        // remover pode gerar pontos negativos se já gastou
        const novoDisp = PONTOS_INICIAIS + (this.pontosTraco() - TRACOS[k].pts) - this.pontosGastos();
        if (novoDisp < 0) return;
        b.tracos.splice(i, 1);
      } else b.tracos.push(k);
      R();
    });
    this.root.querySelectorAll('[data-escola]').forEach(el => el.onclick = () => {
      const k = el.dataset.escola, max = CLASSES[b.classe].escolas;
      const i = b.escolas.indexOf(k);
      if (i >= 0) { if (b.escolas.length > 1) b.escolas.splice(i, 1); }
      else { if (b.escolas.length >= max) b.escolas.shift(); b.escolas.push(k); }
      b.magias = b.magias.filter(m => b.escolas.includes(MAGIAS[m].escola));
      if (!b.magias.length) b.magias = [ESCOLAS[b.escolas[0]].magias[0]];
      R();
    });
    this.root.querySelectorAll('[data-magia]').forEach(el => el.onclick = () => {
      const k = el.dataset.magia;
      const maxMagias = 4 + Math.floor((ATTR_BASE + b.attrs.intelecto) / 6);
      const i = b.magias.indexOf(k);
      if (i >= 0) { if (b.magias.length > 1) b.magias.splice(i, 1); }
      else if (b.magias.length < maxMagias) b.magias.push(k);
      R();
    });
    this.root.querySelectorAll('[data-corpo]').forEach(el => el.oninput = () => {
      b.corpo[el.dataset.corpo] = +el.value;
      this.rebuildAvatar(); this.renderStats();
      el.previousElementSibling.querySelector('b').textContent =
        el.dataset.corpo === 'altura' ? (+el.value).toFixed(2) + ' m'
        : el.dataset.corpo === 'massa' ? el.value + ' kg' : el.value + '%';
    });
    this.root.querySelectorAll('[data-cor]').forEach(el => el.oninput = () => { b.cores[el.dataset.cor] = el.value; this.rebuildAvatar(); });
    this.root.querySelectorAll('[data-sw]').forEach(el => el.onclick = () => { b.cores.pele = el.dataset.sw; this.rebuildAvatar(); this.renderBody(); });

    // --- Forja de Poderes ---
    const fjT = this.root.querySelector('#fjTexto');
    const fjN = this.root.querySelector('#fjNome');
    if (fjT) {
      fjT.oninput = () => { this.poderTexto = fjT.value; };
      fjN.oninput = () => { this.poderNome = fjN.value; };
      const analisar = () => {
        this.poderTexto = fjT.value; this.poderNome = fjN.value;
        if (!this.poderTexto.trim()) return;
        this.previaPoder = analisarPoder(this.poderTexto, computarFicha(b), b);
        this.renderBody();
      };
      this.root.querySelector('#fjAnalisar').onclick = analisar;
      fjT.onkeydown = e => { if (e.code === 'Enter' && e.ctrlKey) analisar(); };
      this.root.querySelector('#fjCriar').onclick = () => {
        if (!this.previaPoder || b.poderes.length >= 6) return;
        const nome = (this.poderNome || '').trim() || 'Poder Inominado';
        const id = 'custom_' + Date.now().toString(36) + Math.floor(Math.random() * 999).toString(36);
        b.poderes.push(forjarMagia(id, nome, this.poderTexto, this.previaPoder));
        this.previaPoder = null; this.poderTexto = ''; this.poderNome = '';
        this.renderBody(); this.renderStats();
      };
      this.root.querySelectorAll('[data-ex]').forEach(el => el.onclick = () => {
        fjT.value = el.dataset.ex; this.poderTexto = el.dataset.ex; analisar();
      });
      this.root.querySelectorAll('[data-del]').forEach(el => el.onclick = () => {
        b.poderes.splice(+el.dataset.del, 1); this.renderBody();
      });
    }

    const nome = this.root.querySelector('#crNome'); if (nome) nome.oninput = () => { b.nome = nome.value || 'Sem-Nome'; this.renderStats(); };
    const bio = this.root.querySelector('#crBio'); if (bio) bio.oninput = () => { b.biografia = bio.value; };
  }

  finalizar() {
    this.build.pontosLivres = this.pontosDisp();
    this.onDone(JSON.parse(JSON.stringify(this.build)));
  }
}
