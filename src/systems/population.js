// ---------------------------------------------------------------------------
// POPULAÇÃO — 600.000+ NPCs únicos.
//
// Nenhum é guardado em memória. Cada NPC é DERIVADO de um id numérico por
// funções determinísticas: o mesmo id sempre produz o mesmo nome, raça,
// profissão, personalidade, história e localização — em qualquer sessão, em
// qualquer máquina, sem salvar nada.
//
// Só os NPCs num raio próximo do jogador viram objetos 3D reais. Os outros
// 599.9xx existem como "potencial": consultáveis pelo censo, pelo mapa e pelo
// Mestre do Véu, materializados apenas quando você chega perto.
// ---------------------------------------------------------------------------

import { RACES } from './chardata.js';
import { DIMENSOES, ORDEM_DIMENSOES } from './dimensions.js';

export const TOTAL_NPCS = 648000;

// --- PRNG determinístico por id ---------------------------------------------
function rng(seed) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

// --- Bancos de nomes por raça ------------------------------------------------
const SILABAS = {
  humano:     { a: ['Al','Ber','Cor','Dun','El','Fen','Gar','Hal','Ivo','Jor','Kel','Lom','Mar','Ner','Ost','Pel','Rud','Sev','Tor','Val'], b: ['and','bert','can','dric','fim','gar','hild','ion','lan','mund','nar','rick','san','ton','vin','wyn'] },
  elfo:       { a: ['Ae','Cael','El','Fae','Gal','Ith','Lae','My','Nae','Ori','Sy','Thal','Va','Yl'], b: ['andril','briel','driel','ethis','fiel','lian','mion','nari','rian','sariel','thien','wyn','yrra','zael'] },
  anao:       { a: ['Bal','Bro','Dur','Gim','Gro','Hjal','Kaz','Mor','Nor','Thra','Ur','Vol'], b: ['din','grim','ik','mund','nar','rak','rim','skar','thor','ulf','vald','zek'] },
  halfling:   { a: ['Bil','Cor','Dai','Fen','Gil','Hob','Mer','Nib','Per','Rose','Sam','Tol'], b: ['bo','by','cot','fut','kins','ly','mer','pin','sey','tuck','wise','zel'] },
  dragonborn: { a: ['Arj','Bala','Dona','Ghe','Kriv','Medr','Nadar','Pand','Rhog','Shamm','Torin','Zen'], b: ['ash','han','kar','mash','nax','rash','sar','thar','vex','xar','zash'] },
  tiefling:   { a: ['Ak','Bar','Dam','Eus','Iad','Kai','Leu','Mor','Nem','Or','Phel','Sar','Val','Zeb'], b: ['akai','ebus','ith','mona','nos','rios','sha','thos','ulia','vain','xis','zael'] },
  meio_orc:   { a: ['Dench','Feng','Gell','Henk','Imsh','Keth','Mhur','Ront','Shump','Thokk','Ugarth','Vrag'], b: ['ash','gash','krod','mak','nar','rok','shar','thag','urk','zog'] },
  meio_elfo:  { a: ['Ada','Ber','Cyn','Del','Eri','Fal','Hal','Kae','Lyn','Mir','Sel','Ther'], b: ['andra','driel','fin','ian','lith','mar','nis','rion','sara','thas','wen','ys'] },
  gnomo:      { a: ['Bim','Cog','Dim','Fizz','Gim','Jeb','Nack','Orry','Pip','Qual','Sni','Wren','Zook'], b: ['bell','dle','feather','gle','kin','nock','pock','sprocket','tock','wink','zle'] },
  tabaxi:     { a: ['Cloud','Dawn','Ember','Five','Jade','Moon','Nine','Quick','Shadow','Silent','Sky','Whisper'], b: ['-on-Water','-Chaser','-Claw','-of-Dusk','-Paw','-Runner','-Song','-Tail','-Whisker'] },
  aarakocra:  { a: ['Aeri','Cir','Ekka','Ghi','Ikki','Kili','Nyx','Oho','Rrik','Sska','Tzi','Wuu'], b: ['ka','kra','kree','llo','rra','shk','ssi','tka','wik','zzi'] },
  genasi:     { a: ['Ashan','Cinder','Ember','Gale','Ignis','Marid','Pyra','Quartz','Stone','Tide','Vortex','Zephyr'], b: ['-born','-heart','-soul','-veil','-wake','ion','is','os','ra','th'] },
  goliath:    { a: ['Aukan','Eglath','Gae','Ilo','Kavaki','Maveith','Nalla','Orilo','Paavu','Thalai','Uthal','Vaunea'], b: ['-Stonehand','-Skywatcher','-Cliffwalk','-Boulder','-Ironback','-Peakborn','-Frostjaw'] },
  aasimar:    { a: ['Ala','Cele','Dawn','Ely','Gabri','Halo','Lumi','Nath','Ori','Sera','Uri','Zadki'], b: ['el','iel','ine','nara','phim','stine','thiel','vara','yah','zael'] },
  kenku:      { a: ['Ash','Bone','Chalk','Clip','Dust','Ink','Latch','Nail','Pin','Rust','Smoke','Tock'], b: ['-Beak','-Caw','-Croak','-Feather','-Rattle','-Scratch','-Whistle'] },
  tortle:     { a: ['Bask','Coral','Deep','Grund','Krill','Moss','Reef','Shale','Slow','Tide','Wave','Zeb'], b: ['-Shell','-Shore','-Stone','-Tide','-Walker','ak','ok','um','us'] },
  leonin:     { a: ['Ajani','Bara','Dune','Golden','Kiora','Mane','Pride','Rakka','Savan','Tawny','Ura','Zuri'], b: ['-Claw','-Fang','-Mane','-Pride','-Roar','-Sun','ka','na','ra','za'] },
  warforged:  { a: ['Anvil','Bolt','Cog','Dent','Forge','Gear','Hammer','Iron','Latch','Pillar','Rivet','Shield','Vault'], b: ['-01','-Seven','-Delta','-Prime','-Nine','-Unit','-Mark','-Zero'] },
};

const PROFISSOES = [
  { n: 'Ferreiro', t: 'comercio', fala: 'Aço bom custa caro. Aço rúnico custa mais.' },
  { n: 'Alquimista', t: 'comercio', fala: 'Tenho frascos que curam e frascos que não. Cuidado ao escolher.' },
  { n: 'Taverneiro', t: 'social', fala: 'Sente-se. Bebida primeiro, história depois.' },
  { n: 'Guarda', t: 'militar', fala: 'Circulando. Não quero problema no meu turno.' },
  { n: 'Caçador', t: 'campo', fala: 'As bestas estão diferentes desde a rachadura.' },
  { n: 'Curandeira', t: 'cura', fala: 'Sente aqui. Isso vai doer menos do que parece.' },
  { n: 'Escriba', t: 'saber', fala: 'Cada runa gravada errado é uma cidade a menos.' },
  { n: 'Mineiro', t: 'campo', fala: 'A pedra canta quando tem cristal atrás.' },
  { n: 'Agricultor', t: 'campo', fala: 'A terra endureceu. Nada quer crescer.' },
  { n: 'Mercador', t: 'comercio', fala: 'Preço justo, amigo. Para você, quase justo.' },
  { n: 'Batedor', t: 'militar', fala: 'Vi luzes roxas no horizonte. Não eram tochas.' },
  { n: 'Sacerdote', t: 'cura', fala: 'O Véu chora. Poucos ouvem.' },
  { n: 'Pescador', t: 'campo', fala: 'A água está errada. Os peixes fogem da margem.' },
  { n: 'Ladrão', t: 'crime', fala: 'Não vi nada. Você também não viu.' },
  { n: 'Bardo', t: 'social', fala: 'Uma moeda e eu canto. Duas e eu paro.' },
  { n: 'Arquivista', t: 'saber', fala: 'Está tudo registrado. Encontrar é outro problema.' },
  { n: 'Estalajadeiro', t: 'social', fala: 'Quarto limpo, cama dura, porta que tranca.' },
  { n: 'Carpinteiro', t: 'comercio', fala: 'Madeira do Sussurro não apodrece. Nem obedece.' },
  { n: 'Runólogo', t: 'saber', fala: 'Uma runa mal fechada é uma boca aberta.' },
  { n: 'Domador', t: 'campo', fala: 'Elas mordem. Todas mordem. A questão é quando.' },
  { n: 'Coveiro', t: 'crime', fala: 'Ando enterrando gente que não quer ficar enterrada.' },
  { n: 'Cartógrafo', t: 'saber', fala: 'Redesenhei este mapa três vezes este mês. A terra se move.' },
  { n: 'Mercenário', t: 'militar', fala: 'Meu preço é alto porque eu volto vivo.' },
  { n: 'Tecelã', t: 'comercio', fala: 'Fio de mana num manto comum. Discreto e caro.' },
  { n: 'Refugiado', t: 'social', fala: 'Minha aldeia não existe mais. Só isso eu sei dizer.' },
  { n: 'Eremita', t: 'saber', fala: 'Vim para cá para não falar. Você está atrapalhando.' },
  { n: 'Capitão', t: 'militar', fala: 'Formação fechada. Ninguém avança sozinho.' },
  { n: 'Joalheiro', t: 'comercio', fala: 'Cristal do Véu lapidado. Não olhe muito tempo.' },
  { n: 'Padeiro', t: 'comercio', fala: 'Pão quente. A única coisa normal que sobrou.' },
  { n: 'Vidente', t: 'saber', fala: 'Eu já vi a sua morte. Não é hoje. Provavelmente.' },
];

const TRACOS_PERS = ['ranzinza','falante','desconfiado','generoso','covarde','arrogante','gentil','sarcástico','melancólico','entusiasmado','paranoico','sereno','ambicioso','distraído','leal','oportunista'];
const OBJETIVOS = ['juntar dinheiro para fugir da região','encontrar um irmão desaparecido','provar a inocência do pai','abrir o próprio negócio','vingar a aldeia destruída','decifrar um livro que não deveria existir','esquecer o que viu na fenda','proteger a filha','voltar para casa','descobrir quem é de verdade','pagar uma dívida antiga','ser lembrado por algo'];
const SEGREDOS = ['esconde uma marca de runa no braço','já esteve do outro lado do Véu','deve dinheiro a gente perigosa','não é quem diz ser','viu o Arauto e sobreviveu','rouba pequenas coisas compulsivamente','tem medo de dormir','guarda um item que não lhe pertence','sabe onde há uma masmorra selada','perdeu a fé recentemente','é procurado em outra cidade','não envelhece desde a rachadura'];

// Sobrenomes/epítetos: combinados com o primeiro nome dão centenas de milhares
// de identidades distintas sem armazenar nenhuma lista gigante.
const SOBRENOMES = ['Vensk','Duradelo','Corvorrubro','Pedraforte','Mãolonga','Saraiva','Vale','Corrente',
  'Bracerro','Cinzalva','Talhamar','Verdemanto','Frialma','Sétima','Rochanegra','Ventosul','Malacara',
  'Espinhaço','Lençol','Ferrolho','Cordovil','Trigueiro','Amanhecer','Pesadelo','Tramela','Salgueiro',
  'Pratesco','Urze','Boqueirão','Candeia','Rebolo','Pinhal','Tormenta','Escarpa','Lodo','Alvorada',
  'Reixa','Cavalo','Bezerra','Couraça','Viúva','Marreco','Sombra','Andrajo','Colmeia','Tenaz','Ourives',
  'Vigília','Cravo','Naufrágio','Baluarte','Tição','Gavião','Arruda','Quintanilha','Beirada','Trovisco'];
const EPITETOS = ['o Torto','a Paciente','de Uma Mão','o Tardio','a Pequena','o Grisalho','a Muda',
  'o Cauteloso','de Três Dedos','a Ruiva','o Sem Sorte','a Firme','o Rachado','a Seca','o Gago',
  'a Bem-Falante','o Magro','a Curvada','o Mais Novo','a Velha'];

// --- Assentamentos: onde os NPCs vivem ---------------------------------------
export const ASSENTAMENTOS = [
  { id: 'pedravil',  nome: 'Pedravil',            x: 0,    z: 60,   pop: 1400,   tipo: 'vila',    dim: 'ardel' },
  { id: 'vhorn',     nome: 'Vhorn, a Funda',      x: -120, z: -380, pop: 9600,   tipo: 'cidade',  dim: 'ardel' },
  { id: 'kharun',    nome: 'Kharun das Areias',   x: 420,  z: 60,   pop: 7200,   tipo: 'cidade',  dim: 'ardel' },
  { id: 'sussurro',  nome: 'Corte do Sussurro',   x: -380, z: -40,  pop: 5100,   tipo: 'cidade',  dim: 'ardel' },
  { id: 'mir',       nome: 'Palafitas de Mir',    x: -280, z: 300,  pop: 2300,   tipo: 'vila',    dim: 'ardel' },
  { id: 'coroa',     nome: 'Posto da Coroa',      x: -60,  z: -470, pop: 900,    tipo: 'posto',   dim: 'ardel' },
  { id: 'ossar',     nome: 'Ruínas de Ossar',     x: -320, z: -180, pop: 220,    tipo: 'ruina',   dim: 'ardel' },
  { id: 'porto',     nome: 'Porto Cinzento',      x: 480,  z: 420,  pop: 6400,   tipo: 'cidade',  dim: 'ardel' },
  { id: 'capital',   nome: 'Aurelian, a Capital', x: 180,  z: 300,  pop: 42000,  tipo: 'capital', dim: 'ardel' },
  { id: 'veu',       nome: 'Acampamento do Véu',  x: 260,  z: -240, pop: 640,    tipo: 'posto',   dim: 'ardel' },
  // Outros planos
  { id: 'penumbra_c', nome: 'Cidade-Espelho',     x: 0,    z: 60,   pop: 38000,  tipo: 'capital', dim: 'penumbra' },
  { id: 'forja_c',    nome: 'Bigorna Eterna',     x: 100,  z: -100, pop: 21000,  tipo: 'cidade',  dim: 'forja' },
  { id: 'marejada_c', nome: 'Bolha de Coral',     x: -150, z: 150,  pop: 16000,  tipo: 'cidade',  dim: 'marejada' },
  { id: 'verde_c',    nome: 'Trono de Raízes',    x: 200,  z: 200,  pop: 12000,  tipo: 'cidade',  dim: 'verdejante' },
  { id: 'aurora_c',   nome: 'Coro de Aurora',     x: -200, z: -200, pop: 9000,   tipo: 'cidade',  dim: 'aurora' },
  { id: 'ossario_c',  nome: 'Necrópole',          x: 300,  z: 100,  pop: 14000,  tipo: 'cidade',  dim: 'ossario' },
  { id: 'vazio_c',    nome: 'Âncora no Vazio',    x: 0,    z: 0,    pop: 300,    tipo: 'posto',   dim: 'vazio' },
];

// População nômade/rural fora dos assentamentos
const POP_DISPERSA = TOTAL_NPCS - ASSENTAMENTOS.reduce((a, s) => a + s.pop, 0);

/** Gera o NPC de id `n`. Determinístico: mesmo id = mesmo NPC, sempre. */
export function npcPorId(n) {
  const r = rng(n * 2654435761);
  // localização
  let acc = 0, lar = null;
  for (const s of ASSENTAMENTOS) {
    if (n >= acc && n < acc + s.pop) { lar = s; break; }
    acc += s.pop;
  }
  const disperso = !lar;
  if (!lar) lar = { id: 'ermo', nome: 'Terras Ermas', x: 0, z: 0, tipo: 'ermo', dim: 'ardel' };

  const racasChave = Object.keys(RACES);
  // distribuição realista: humanos maioria, raças exóticas raras
  const pesos = { humano: 34, meio_elfo: 9, elfo: 8, anao: 8, halfling: 7, meio_orc: 6, gnomo: 6,
    tiefling: 5, dragonborn: 4, tabaxi: 3, goliath: 3, aasimar: 2, genasi: 2, kenku: 2,
    tortle: 1.5, leonin: 1.5, aarakocra: 1.5, warforged: 1.5 };
  let soma = 0, alvo = r() * Object.values(pesos).reduce((a, b) => a + b, 0), raca = 'humano';
  for (const k of racasChave) { soma += pesos[k] || 1; if (alvo <= soma) { raca = k; break; } }

  const sil = SILABAS[raca] || SILABAS.humano;
  const primeiro = pick(r, sil.a) + pick(r, sil.b);
  // ~1 em 9 carrega um epíteto em vez de sobrenome de família
  const rotulo = r() < 0.11 ? pick(r, EPITETOS) : pick(r, SOBRENOMES);
  const nome = rotulo.startsWith('o ') || rotulo.startsWith('a ') || rotulo.startsWith('de ')
    ? `${primeiro}, ${rotulo}` : `${primeiro} ${rotulo}`;
  const prof = pick(r, PROFISSOES);
  const idade = Math.floor(16 + r() * (raca === 'elfo' ? 600 : raca === 'anao' ? 250 : raca === 'warforged' ? 40 : 65));
  const nivel = Math.max(1, Math.floor(r() * (prof.t === 'militar' ? 14 : 7)) + (lar.tipo === 'capital' ? 2 : 0));

  return {
    id: n, nome, primeiro, raca, racaNome: RACES[raca]?.nome || 'Humano',
    profissao: prof.n, tipo: prof.t, fala: prof.fala,
    idade, nivel, disperso,
    lar: lar.nome, larId: lar.id, dim: lar.dim || 'ardel',
    x: lar.x + (r() - 0.5) * (disperso ? 900 : lar.tipo === 'capital' ? 120 : lar.tipo === 'cidade' ? 70 : 40),
    z: lar.z + (r() - 0.5) * (disperso ? 900 : lar.tipo === 'capital' ? 120 : lar.tipo === 'cidade' ? 70 : 40),
    personalidade: pick(r, TRACOS_PERS),
    objetivo: pick(r, OBJETIVOS),
    segredo: pick(r, SEGREDOS),
    amigavel: prof.t !== 'crime' || r() > 0.4,
    comerciante: prof.t === 'comercio',
    curandeiro: prof.t === 'cura',
    dadorDeMissao: r() < 0.22,
  };
}

/** NPCs "vivos" perto de uma posição — só estes viram objetos 3D. */
export function npcsProximos(x, z, dim, raio = 70, limite = 24) {
  const out = [];
  for (const s of ASSENTAMENTOS) {
    if ((s.dim || 'ardel') !== dim) continue;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d > raio + 140) continue;
    let base = 0;
    for (const a of ASSENTAMENTOS) { if (a.id === s.id) break; base += a.pop; }
    const amostra = Math.min(s.pop, 260);
    for (let i = 0; i < amostra && out.length < limite; i++) {
      const passo = Math.floor(s.pop / amostra);
      const npc = npcPorId(base + i * passo);
      if (Math.hypot(npc.x - x, npc.z - z) < raio) out.push(npc);
    }
  }
  return out;
}

export function censo() {
  const porRaca = {}, porProf = {}, porDim = {};
  const amostra = 20000;
  for (let i = 0; i < amostra; i++) {
    const n = npcPorId(Math.floor(i * (TOTAL_NPCS / amostra)));
    porRaca[n.racaNome] = (porRaca[n.racaNome] || 0) + 1;
    porProf[n.profissao] = (porProf[n.profissao] || 0) + 1;
    porDim[n.dim] = (porDim[n.dim] || 0) + 1;
  }
  const esc = TOTAL_NPCS / amostra;
  const fmt = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v * esc)]);
  return { total: TOTAL_NPCS, porRaca: fmt(porRaca), porProf: fmt(porProf), porDim: fmt(porDim), assentamentos: ASSENTAMENTOS };
}

export { POP_DISPERSA };
