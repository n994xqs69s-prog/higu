// ---------------------------------------------------------------------------
// MESTRE DO VÉU — bot "IA" de arbitragem.
//
// O jogador descreve uma ação improvisada em texto livre. O Mestre:
//   1. Extrai INTENÇÃO (o que o jogador quer fazer) e RECURSOS invocados.
//   2. Checa PLAUSIBILIDADE FÍSICA contra o estado real do mundo (bioma,
//      materiais por perto, massa, temperatura, condutividade, mana, distância).
//   3. Checa CAPACIDADE do personagem (atributos, escolas conhecidas, carga).
//   4. Checa QUALIDADE DO ARGUMENTO (causalidade citada, especificidade,
//      conhecimento real ou lore correta, ausência de pedido "mágico grátis").
//   5. Devolve veredicto: AUTOMÁTICO / TESTE (rolagem com DC) / IMPOSSÍVEL,
//      sempre com JUSTIFICATIVA didática e efeito mecânico aplicado ao jogo.
//
// Tudo roda offline e é determinístico-ish (semente pela rolagem).
// ---------------------------------------------------------------------------

import { biomeAt, heightAt, WATER_LEVEL, BIOME_INFO } from './world.js';
import { condutividade, inflamabilidade, capacidadeCarga, velocidadeArremesso, alcanceBalistico, G } from './physics.js';
import { ESCOLAS, MAGIAS } from './chardata.js';

const RACES_ELEM = { fogo: 'fogo', agua: 'agua', terra: 'terra', ar: 'ar' };

// --- Léxico -----------------------------------------------------------------
const LEXICO = {
  fogo:    ['fogo','chama','queimar','incendi','brasa','calor','derreter','fundir','pirom','combust','fumaça','tocha','fagulha','ignição'],
  agua:    ['água','agua','gelo','congelar','molhar','vapor','chuva','onda','hidro','umidade','líquido','liquido','inundar','fluido'],
  ar:      ['ar','vento','rajada','empurrar','soprar','vácuo','vacuo','pressão','aero','voar','planar','tornado','sufocar'],
  terra:   ['terra','pedra','rocha','muro','cavar','areia','solo','geo','soterrar','desabar','coluna','barro','montanha','túnel','tunel'],
  raio:    ['raio','elétric','eletric','choque','corrente','curto','condut','tesla','descarga','faísca','faisca','ímã','ima','magnet'],
  vida:    ['curar','cura','regenerar','sarar','veneno','planta','raiz','semente','crescer','orgânic','organic','sangue','músculo','musculo'],
  sombra:  ['sombra','escuro','invisív','invisiv','ocultar','furtiv','ilusão','ilusao','medo','noite','silenci','refra'],
  runica:  ['runa','gravar','selo','armadilha','glifo','inscri','encant','sigilo','condição','condicao','gatilho'],
};

const VERBOS_FISICOS = [
  'alavanca','alavancar','empurrar','puxar','arremessar','jogar','lançar','lancar','escalar','pular','saltar','cortar','quebrar',
  'derrubar','amarrar','prender','soterrar','afogar','esconder','distrair','enganar','bloquear','desviar','refletir','aparar',
  'inclinar','equilibrar','rolar','deslizar','escorregar','apoiar','sustentar','furar','perfurar','misturar','diluir','evaporar',
  'condensar','pressionar','comprimir','esticar','tensionar','rasgar','serrar','martelar','forjar','soldar','isolar','aterrar'
];

const CONECTIVOS_CAUSAIS = [
  'porque','já que','ja que','pois','portanto','logo','então','entao','assim','de modo que','para que','visto que',
  'uma vez que','dado que','como resultado','consequent','o que faz','isso faz','o que causa','fazendo com que','de forma que'
];

// Conhecimentos reais que o Mestre reconhece e RECOMPENSA quando bem usados.
const CONHECIMENTO_REAL = [
  { chave: ['densidade','flutu','empuxo','arquimedes','arquimedes'], nome: 'Empuxo / princípio de Arquimedes', bonus: 3,
    nota: 'Corpos menos densos que o fluido flutuam; o empuxo é igual ao peso do volume deslocado.' },
  { chave: ['alavanca','fulcro','ponto de apoio','torque','momento'], nome: 'Alavanca e torque', bonus: 3,
    nota: 'Força × braço. Um ponto de apoio bem escolhido multiplica sua força efetiva.' },
  { chave: ['condut','aterrar','terra elétrica','curto','circuito','metal conduz','água conduz','agua conduz'], nome: 'Condutividade elétrica', bonus: 3,
    nota: 'Corrente segue o caminho de menor resistência: metal e água salgada conduzem, borracha e areia seca isolam.' },
  { chave: ['oxigên','oxigen','combustão','combustao','triângulo do fogo','triangulo do fogo','abafar','asfixi'], nome: 'Triângulo do fogo', bonus: 3,
    nota: 'Fogo precisa de combustível, comburente (O₂) e calor. Remova um e a chama morre.' },
  { chave: ['dilata','expande com o calor','contrai com o frio','choque térmico','choque termico','têmpera','tempera'], nome: 'Dilatação e choque térmico', bonus: 4,
    nota: 'Aquecer e resfriar bruscamente racha pedra e vidro; metal dilata e trava encaixes.' },
  { chave: ['centro de massa','centro de gravidade','inércia','inercia','momento linear','quantidade de movimento'], nome: 'Centro de massa e inércia', bonus: 3,
    nota: 'Desloque o centro de massa para fora da base de apoio e o corpo tomba sozinho.' },
  { chave: ['pressão','pressao','vácuo','vacuo','pascal','hidráulic','hidraulic'], nome: 'Pressão e hidráulica', bonus: 3,
    nota: 'Pressão = força/área. Pontas finas concentram força; fluidos transmitem pressão igualmente.' },
  { chave: ['atrito','fricção','friccao','lubrific','óleo no chão','oleo no chao'], nome: 'Atrito', bonus: 2,
    nota: 'Reduzir atrito derruba quem corre; aumentar atrito impede escorregões.' },
  { chave: ['evapora','condensa','ponto de ebulição','ponto de ebulicao','sublim','vapor expande'], nome: 'Mudança de estado', bonus: 3,
    nota: 'Água vira vapor e expande ~1700×: uma poça aquecida em espaço fechado é uma bomba.' },
  { chave: ['ressonân','ressonan','frequência','frequencia','vibração','vibracao'], nome: 'Ressonância', bonus: 4,
    nota: 'A frequência certa amplifica a vibração até a fratura do material.' },
  { chave: ['polia','roldana','plano inclinado','cunha','parafuso','engrenagem'], nome: 'Máquinas simples', bonus: 3,
    nota: 'Trocam distância por força: metade da força, o dobro do caminho.' },
  { chave: ['reflexão','reflexao','refração','refracao','espelho','lente','foco da luz'], nome: 'Óptica', bonus: 3,
    nota: 'Lentes concentram luz em um ponto; espelhos redirecionam feixes.' },
  { chave: ['osmose','sal','desidrat','salgar'], nome: 'Osmose', bonus: 3, nota: 'Sal desidrata tecidos vivos e é letal para lesmas e seres aquosos.' },
  { chave: ['queda livre','energia cinética','energia cinetica','mgh','altura da queda'], nome: 'Energia potencial/cinética', bonus: 3,
    nota: 'E = mgh. Dobrar a altura dobra a energia do impacto.' },
];

const LORE = [
  { chave: ['véu','veu','rasgado','arauto'], nome: 'Lore do Véu', bonus: 2, nota: 'O Véu é a membrana entre planos; perto dele a mana dobra e a causalidade afrouxa.' },
  { chave: ['runa','runolog','sigilo'], nome: 'Runologia', bonus: 2, nota: 'Runas são magia com condição de disparo: efeito adiado, custo pago adiantado.' },
  { chave: ['mana','fonte de mana','ley','linha de força'], nome: 'Teoria da mana', bonus: 2, nota: 'A densidade de mana varia por bioma; o Véu é o pico e o deserto o vale.' },
  { chave: ['golem','autômato','automato','núcleo','nucleo'], nome: 'Construtos', bonus: 2, nota: 'Construtos não têm metabolismo: veneno e cura orgânica não os afetam; o núcleo é o ponto fraco.' },
];

const BANDEIRAS_VERMELHAS = [
  { chave: ['eu venço','eu venco','eu ganho','ele morre','mato ele instant','instakill','morre na hora','apago ele'], nota: 'Você declarou o RESULTADO em vez da AÇÃO. Descreva o que seu corpo e sua magia fazem; o resultado é meu.' },
  { chave: ['crio do nada','surge do nada','invento uma magia nova','magia infinita','mana infinita','sem custo'], nota: 'Magia não cria matéria nem energia do nada. Aponte a fonte: matéria próxima, sua mana, ou calor do ambiente.' },
  { chave: ['sou imortal','imune a tudo','invencível','invencivel','nada me atinge'], nota: 'Nenhuma criatura do Véu é imune a tudo — nem você.' },
  { chave: ['teletransporto para o chefe','apareço atrás do chefe','apareco atras do chefe'], nota: 'Teleporte exige linha de visão ou marca prévia. Sem âncora, não há destino.' },
];

// --- Utilitários ------------------------------------------------------------
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const contem = (t, lista) => lista.some(k => t.includes(norm(k)));
const contagem = (t, lista) => lista.filter(k => t.includes(norm(k))).length;

function d20() { return 1 + Math.floor(Math.random() * 20); }

// --- Núcleo -----------------------------------------------------------------
export class GameMaster {
  constructor(game) {
    this.game = game;
    this.historico = [];
    this.reputacao = 0;     // argumentos bons aumentam; tentativas de trapaça derrubam
  }

  /** Estado do mundo em torno do jogador — o "sensor" do Mestre. */
  lerAmbiente(p) {
    const pos = p.body.pos;
    const bioma = biomeAt(pos.x, pos.z);
    const info = BIOME_INFO[bioma];
    const alt = heightAt(pos.x, pos.z);
    const perto = [];
    for (const c of this.game.colliders) {
      if (c.destruido) continue;
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d < 18) perto.push({ tag: c.tag, d: +d.toFixed(1), col: c });
    }
    perto.sort((a, b) => a.d - b.d);
    const inimigos = this.game.inimigos
      .filter(e => e.vivo && e.body.pos.distanceTo(pos) < 60)
      .map(e => ({
        nome: e.nome, dist: +e.body.pos.distanceTo(pos).toFixed(1), massa: e.def.massa,
        fraqueza: e.def.fraqueza, resist: e.def.resist, molhado: e.molhado > 0,
        metalico: e.metalico, construto: e.construto, etereo: e.etereo, ref: e,
      }))
      .sort((a, b) => a.dist - b.dist);
    return {
      bioma, biomaNome: info.nome, densidadeMana: info.mana, altitude: +alt.toFixed(1),
      naAgua: p.body.naAgua, aguaPerto: alt < WATER_LEVEL + 3,
      condutividade: +condutividade(pos).toFixed(2),
      inflamabilidade: +inflamabilidade(pos).toFixed(2),
      materiais: [...new Set(perto.slice(0, 10).map(o => o.tag))],
      objetosPerto: perto.slice(0, 6),
      inimigos, noite: this.game.horaDoDia < 0.25 || this.game.horaDoDia > 0.75,
      chuva: this.game.clima === 'chuva', hora: this.game.horaDoDia,
    };
  }

  /** Avalia uma proposta em texto livre. */
  avaliar(textoOriginal, jogador) {
    const t = norm(textoOriginal);
    const env = this.lerAmbiente(jogador);
    const f = jogador.ficha;
    const build = jogador.build;

    const passos = [];        // raciocínio exibido ao jogador
    let dificuldade = 11;     // DC base
    let bonus = 0;
    const efeitos = [];
    let custoMana = 0, custoStam = 0;

    // ---- 1. Intenção / escolas invocadas --------------------------------
    const escolasCitadas = Object.keys(LEXICO).filter(e => contem(t, LEXICO[e]));
    const escolasConhecidas = build?.escolas || [];
    const usaMagia = escolasCitadas.length > 0;
    const verbosFisicos = contagem(t, VERBOS_FISICOS);

    if (usaMagia) {
      passos.push(`Intenção mágica detectada: ${escolasCitadas.map(e => ESCOLAS[e].nome).join(', ')}.`);
    }
    if (verbosFisicos > 0) {
      passos.push(`Ação física detectada (${verbosFisicos} verbo(s) de manipulação). Vou checar massa, apoio e alcance.`);
    }
    if (!usaMagia && verbosFisicos === 0) {
      passos.push('Não identifiquei nem conjuração nem manipulação física clara. Descreva o *mecanismo*, não só o desejo.');
      dificuldade += 5;
    }

    // ---- 2. Capacidade do personagem ------------------------------------
    let jaPenalizouEscola = false;
    for (const e of escolasCitadas) {
      if (escolasConhecidas.includes(e)) {
        bonus += 2;
        passos.push(`✔ Você domina ${ESCOLAS[e].nome}: +2.`);
        custoMana += 14;
      } else if (!jaPenalizouEscola) {
        // Penaliza uma única vez: combinar elementos é *incentivado*, não punido em cascata.
        jaPenalizouEscola = true;
        dificuldade += 5;
        custoMana += 22;
        passos.push(`✘ ${ESCOLAS[e].nome} não é sua escola. Improvisar fora do seu treino: DC +5 e custo de mana maior.`);
      } else {
        custoMana += 10;
        passos.push(`≈ ${ESCOLAS[e].nome} também está fora do seu treino, mas combinar elementos é bem-visto: só custo extra de mana.`);
      }
    }
    if (escolasCitadas.length >= 2) {
      bonus += 2;
      passos.push('✔ Combo de duas escolas (sinergia elemental): +2.');
    }
    if (custoMana > jogador.mana) {
      passos.push(`⚠ Mana insuficiente (${Math.round(jogador.mana)} de ${custoMana}). Vou permitir a tentativa, mas com penalidade de exaustão.`);
      dificuldade += 4;
    }

    // ---- 3. Plausibilidade ambiental ------------------------------------
    if (escolasCitadas.includes('fogo')) {
      if (env.inflamabilidade > 0.7) { bonus += 3; passos.push(`✔ ${env.biomaNome}: vegetação seca (inflamabilidade ${env.inflamabilidade}). O fogo se alastra sozinho: +3.`); }
      else if (env.inflamabilidade === 0 || env.naAgua) { dificuldade += 8; passos.push(`✘ Aqui não há o que queimar (inflamabilidade ${env.inflamabilidade}) ou você está na água: DC +8.`); }
      if (env.chuva) { dificuldade += 4; passos.push('✘ Está chovendo: chama aberta perde intensidade (DC +4).'); }
    }
    if (escolasCitadas.includes('agua')) {
      if (env.bioma === 'desert') { dificuldade += 7; passos.push('✘ Areias de Kharun: extrair água do ar seco é brutal (DC +7).'); }
      if (env.aguaPerto || env.naAgua) { bonus += 3; passos.push('✔ Há água em volume ao seu alcance: +3.'); }
    }
    if (escolasCitadas.includes('raio')) {
      if (env.condutividade > 0.8) { bonus += 4; passos.push(`✔ Superfície altamente condutora (${env.condutividade}): a corrente se espalha: +4.`); }
      if (env.condutividade < 0.2) { dificuldade += 5; passos.push(`✘ Areia seca isola (${env.condutividade}): DC +5.`); }
      const alvoMolhado = env.inimigos.some(i => i.molhado) || env.inimigos.some(i => i.metalico);
      if (alvoMolhado) { bonus += 3; passos.push('✔ Há alvo molhado ou blindado em metal por perto: +3.'); }
    }
    if (escolasCitadas.includes('terra')) {
      if (env.bioma === 'water') { dificuldade += 8; passos.push('✘ Sem solo firme para moldar: DC +8.'); }
      if (env.materiais.includes('rocha') || env.bioma === 'rock') { bonus += 3; passos.push('✔ Rocha disponível a poucos metros: +3.'); }
    }
    if (escolasCitadas.includes('sombra')) {
      if (env.noite) { bonus += 3; passos.push('✔ É noite: sombras profundas, +3.'); }
      else { dificuldade += 4; passos.push('✘ Pleno dia: pouca sombra para ancorar (DC +4).'); }
    }
    if (env.bioma === 'veil') {
      bonus += 2; dificuldade += 2;
      passos.push('≈ O Véu Rasgado: mana dobrada (+2) mas causalidade instável (DC +2).');
    }

    // ---- 4. Massa, carga e alcance --------------------------------------
    const massaCitada = t.match(/(\d+)\s*(kg|quilos?|toneladas?|t\b)/);
    if (massaCitada || contem(t, ['levanto','ergo','carrego','arremesso','jogo','empurro a pedra','arrasto'])) {
      let m = 0;
      if (massaCitada) {
        m = parseFloat(massaCitada[1]);
        if (/tonelada|^t$/.test(massaCitada[2])) m *= 1000;
      } else if (contem(t, ['pedra','rocha'])) m = 120;
      else if (contem(t, ['tronco','árvore','arvore'])) m = 400;
      else if (contem(t, ['barril','caixa'])) m = 60;
      else m = 50;
      const cap = capacidadeCarga(f.attrs.forca, f.massa, build.corpo.musculo);
      if (m <= cap) {
        bonus += 2;
        const v = velocidadeArremesso(cap, m);
        passos.push(`✔ Massa estimada ${m} kg ≤ sua capacidade ${Math.round(cap)} kg. Arremesso a ~${v.toFixed(1)} m/s, alcance balístico ~${alcanceBalistico(v).toFixed(0)} m: +2.`);
      } else if (m <= cap * 2.5) {
        dificuldade += 6;
        passos.push(`≈ ${m} kg contra capacidade ${Math.round(cap)} kg: possível só com alavanca, rolagem ou magia de apoio. DC +6, custo de estamina alto.`);
        custoStam += 35;
      } else {
        dificuldade += 14;
        passos.push(`✘ ${m} kg é ${(m / cap).toFixed(1)}× sua capacidade (${Math.round(cap)} kg). Força bruta está fora de questão — proponha um mecanismo (alavanca, polia, plano inclinado, geomancia).`);
      }
    }

    const distCitada = t.match(/(\d+)\s*(m|metros?)/);
    if (distCitada) {
      const d = parseFloat(distCitada[1]);
      if (d > 60) { dificuldade += 6; passos.push(`✘ ${d} m é longe demais para mira confiável (DC +6).`); }
      else if (d <= 25) { bonus += 1; passos.push(`✔ ${d} m está dentro do alcance eficaz: +1.`); }
    }

    // ---- 5. Qualidade do argumento --------------------------------------
    const causais = contagem(t, CONECTIVOS_CAUSAIS);
    if (causais >= 2) { bonus += 3; passos.push(`✔ Cadeia causal explícita (${causais} conectivos): você explicou *por que* funcionaria: +3.`); }
    else if (causais === 1) { bonus += 1; passos.push('✔ Há uma relação causal declarada: +1.'); }
    else { dificuldade += 3; passos.push('✘ Você não explicou o mecanismo causal. "Porque", "de modo que", "fazendo com que" valem pontos aqui.'); }

    const palavras = textoOriginal.trim().split(/\s+/).length;
    if (palavras >= 25) { bonus += 2; passos.push(`✔ Descrição detalhada (${palavras} palavras): +2.`); }
    else if (palavras < 8) { dificuldade += 3; passos.push(`✘ Descrição curta demais (${palavras} palavras): DC +3.`); }

    const conhecimentos = [];
    for (const c of CONHECIMENTO_REAL) {
      if (contem(t, c.chave)) { conhecimentos.push(c); bonus += c.bonus; }
    }
    for (const c of LORE) {
      if (contem(t, c.chave)) { conhecimentos.push(c); bonus += c.bonus; }
    }
    conhecimentos.forEach(c => passos.push(`★ Conhecimento aplicado — ${c.nome} (+${c.bonus}): ${c.nota}`));

    const bandeiras = BANDEIRAS_VERMELHAS.filter(b => contem(t, b.chave));
    bandeiras.forEach(b => { dificuldade += 10; passos.push(`⛔ ${b.nota} (DC +10)`); });
    if (bandeiras.length) this.reputacao = Math.max(-5, this.reputacao - 1);

    // ---- 6. Atributos e traços -------------------------------------------
    const modInt = Math.floor((f.attrs.intelecto - 10) / 2);
    const modCar = Math.floor((f.attrs.carisma - 10) / 2);
    const modDex = Math.floor((f.attrs.destreza - 10) / 2);
    const modFor = Math.floor((f.attrs.forca - 10) / 2);
    let modAtributo = modInt;
    if (verbosFisicos > escolasCitadas.length) modAtributo = Math.max(modFor, modDex);
    bonus += modAtributo;
    passos.push(`Modificador do atributo relevante: ${modAtributo >= 0 ? '+' : ''}${modAtributo}.`);
    if (build.tracos.includes('memoria_total')) { bonus += 1; passos.push('✔ Memória Eidética: +1 e direito a relance.'); }

    // --- Bônus por raça e classe (tags) ---------------------------------
    const rtags = f.tags || [], ctags = f.ctags || [];
    if (rtags.includes('engenhoso') && contem(t, ['alavanca','polia','engrenagem','pressao','pressão','mecanismo','quimic','químic','reacao','reação','parafuso','cunha','plano inclinado'])) {
      bonus += 2; passos.push('✔ Esperteza Gnômica: mecanismos e química são sua língua nativa (+2).');
    }
    if (ctags.includes('erudito') && conhecimentos.length) {
      bonus += 2; passos.push('✔ Mago: você ESTUDOU isso formalmente (+2 sobre conhecimento aplicado).');
    }
    if (ctags.includes('estruturas') && contem(t, ['estrutura','ponto fraco','frágil','fragil','apoio','viga','pilar','fundacao','fundação','rachadura','junta'])) {
      bonus += 3; passos.push('✔ Ladino: você VÊ onde as coisas quebram (+3).');
    }
    if (rtags.includes('mimica') && contem(t, ['imito','imitar','voz','som','distra','engano','enganar','finjo','fingir','grito','chamado'])) {
      bonus += 3; passos.push('✔ Mímica Kenku: imitação perfeita é um mecanismo legítimo (+3).');
    }
    if (rtags.includes('barganha') && contem(t, ['negoci','barganha','acordo','proposta','intimid','ameaco','ameaço','convenco','convenço','pacto'])) {
      bonus += 2; passos.push('✔ Legado Infernal: barganha e intimidação contam como ação válida (+2).');
    }
    if (rtags.includes('voo') && contem(t, ['voo','voar','alto','acima','mergulho','planar','altitude','de cima'])) {
      bonus += 3; passos.push('✔ Aarakocra: a dimensão vertical está realmente disponível para você (+3).');
    }
    if (rtags.includes('carga_dobrada') && contem(t, ['levanto','ergo','arremesso','carrego','empurro','arrasto','jogo'])) {
      bonus += 2; passos.push('✔ Goliath: capacidade de carga DOBRADA no cálculo (+2).');
    }
    if (rtags.includes('construto') && contem(t, ['veneno','respirar','sufoc','afogar','fadiga','sono','dormir','doenca','doença'])) {
      bonus += 3; passos.push('✔ Warforged: você não respira nem metaboliza — essa ameaça não se aplica a você (+3).');
    }
    if (rtags.includes('cai_de_pe') && contem(t, ['pulo','salto','caio','queda','despenco','desco','precipicio','precipício','penhasco'])) {
      bonus += 3; passos.push('✔ Reflexos felinos: você não sofre dano de queda — a altura é uma rota, não um risco (+3).');
    }
    if (rtags.includes('sorte')) {
      passos.push('🍀 Sorte de Halfling: se falhar, você rerrola automaticamente.');
    }
    if (rtags.includes('elemental') && build.elemento) {
      const el = RACES_ELEM[build.elemento];
      if (el && escolasCitadas.includes(el)) { bonus += 3; passos.push(`✔ Genasi: ${ESCOLAS[el].nome} é o seu elemento natal (+3).`); }
    }
    if (modCar >= 2) { bonus += 1; passos.push(`✔ Carisma alto: benefício da dúvida +1.`); }
    bonus += Math.round(this.reputacao * 0.5);

    // ---- 7. Veredicto -----------------------------------------------------
    const total = bonus;
    const dc = Math.max(5, dificuldade);
    let rolagem = d20();
    let usouRelance = false;
    const podeRelance = build.tracos.includes('memoria_total') || (f.tags || []).includes('sorte');
    if (podeRelance && rolagem + total < dc) {
      const r2 = d20();
      if (r2 > rolagem) { rolagem = r2; usouRelance = true; }
    }
    const resultado = rolagem + total;
    let veredicto, margem = resultado - dc;

    if (dc >= 30 && total < 10) veredicto = 'impossivel';
    else if (rolagem === 20) veredicto = 'critico';
    else if (rolagem === 1) veredicto = 'falha_critica';
    else if (margem >= 8) veredicto = 'sucesso_total';
    else if (margem >= 0) veredicto = 'sucesso';
    else if (margem >= -4) veredicto = 'sucesso_custo';
    else veredicto = 'falha';

    // ---- 8. Efeito mecânico -----------------------------------------------
    const alvo = env.inimigos[0];
    const potencia = f.poderMagico * (1 + Math.max(0, margem) * 0.12);
    let danoBase = (usaMagia ? 30 : 18) * potencia;
    if (alvo && escolasCitadas.includes(alvo.fraqueza)) { danoBase *= 1.8; passos.push(`★ ${alvo.nome} é fraco a ${ESCOLAS[alvo.fraqueza].nome}: dano ×1,8.`); }
    if (alvo && escolasCitadas.includes(alvo.resist)) { danoBase *= 0.45; passos.push(`✘ ${alvo.nome} resiste a ${ESCOLAS[alvo.resist].nome}: dano ×0,45.`); }

    const desc = [];
    switch (veredicto) {
      case 'critico':
        efeitos.push({ tipo: 'dano', valor: danoBase * 2.2, escola: escolasCitadas[0] || 'fisico' });
        efeitos.push({ tipo: 'xp', valor: 60 });
        desc.push('SUCESSO CRÍTICO. Funciona melhor do que você imaginou — e o Véu registra o feito.');
        this.reputacao = Math.min(5, this.reputacao + 1);
        break;
      case 'sucesso_total':
        efeitos.push({ tipo: 'dano', valor: danoBase * 1.5, escola: escolasCitadas[0] || 'fisico' });
        efeitos.push({ tipo: 'xp', valor: 35 });
        desc.push('Sucesso completo: o mecanismo que você descreveu se sustenta em todos os pontos.');
        this.reputacao = Math.min(5, this.reputacao + 1);
        break;
      case 'sucesso':
        efeitos.push({ tipo: 'dano', valor: danoBase, escola: escolasCitadas[0] || 'fisico' });
        efeitos.push({ tipo: 'xp', valor: 20 });
        desc.push('Funciona. Não é elegante, mas a física coopera.');
        break;
      case 'sucesso_custo':
        efeitos.push({ tipo: 'dano', valor: danoBase * 0.6, escola: escolasCitadas[0] || 'fisico' });
        efeitos.push({ tipo: 'dano_proprio', valor: 8 + Math.abs(margem) * 2 });
        efeitos.push({ tipo: 'xp', valor: 12 });
        desc.push('Funciona parcialmente, mas cobra o seu preço: você se machuca no processo.');
        break;
      case 'falha':
        efeitos.push({ tipo: 'stam', valor: -25 });
        desc.push('Não funciona. A ideia era plausível, a execução não acompanhou.');
        break;
      case 'falha_critica':
        efeitos.push({ tipo: 'dano_proprio', valor: 22 });
        efeitos.push({ tipo: 'stam', valor: -40 });
        desc.push('FALHA CRÍTICA. Sai tudo errado e a consequência recai sobre você.');
        break;
      case 'impossivel':
        desc.push('Isso não é possível como descrito. Não vou rolar dado: reformule com um mecanismo real.');
        break;
    }
    if (custoMana) efeitos.push({ tipo: 'mana', valor: -custoMana });
    if (custoStam) efeitos.push({ tipo: 'stam', valor: -custoStam });

    const entrada = {
      texto: textoOriginal, veredicto, rolagem, bonus: total, dc, resultado, margem,
      passos, desc: desc.join(' '), efeitos, env, usouRelance,
      sugestao: this.sugerir(env, escolasCitadas, escolasConhecidas, veredicto),
    };
    this.historico.push(entrada);
    return entrada;
  }

  /** Dica proativa: o Mestre ensina o jogador a argumentar melhor. */
  sugerir(env, citadas, conhecidas, veredicto) {
    const dicas = [];
    if (veredicto === 'falha' || veredicto === 'impossivel' || veredicto === 'falha_critica') {
      dicas.push('Cite um mecanismo físico concreto (alavanca, empuxo, condutividade, dilatação térmica, centro de massa).');
      dicas.push('Use "porque/de modo que" ligando causa e efeito.');
    }
    const alvo = env.inimigos[0];
    if (alvo && alvo.fraqueza && !citadas.includes(alvo.fraqueza)) {
      dicas.push(`${alvo.nome} é vulnerável a ${ESCOLAS[alvo.fraqueza].nome} — ${ESCOLAS[alvo.fraqueza].fisica.split('.')[0]}.`);
    }
    if (env.condutividade > 0.8 && !citadas.includes('raio')) dicas.push('O chão aqui conduz eletricidade muito bem. Pense em combos molhar → eletrocutar.');
    if (env.inflamabilidade > 0.8 && !citadas.includes('fogo')) dicas.push('Vegetação seca em volta: uma faísca aqui vira incêndio de área.');
    if (env.materiais.length) dicas.push(`Material aproveitável a até 18 m: ${env.materiais.join(', ')}.`);
    if (!dicas.length) dicas.push('Boa leitura do ambiente. Continue encadeando causa e efeito.');
    return dicas;
  }

  /** Resposta narrativa formatada. */
  formatar(e) {
    const titulos = {
      critico: '🌟 SUCESSO CRÍTICO', sucesso_total: '✅ SUCESSO TOTAL', sucesso: '✅ SUCESSO',
      sucesso_custo: '⚠️ SUCESSO COM CUSTO', falha: '❌ FALHA', falha_critica: '💀 FALHA CRÍTICA',
      impossivel: '🚫 IMPOSSÍVEL',
    };
    return {
      titulo: titulos[e.veredicto],
      linha: e.veredicto === 'impossivel'
        ? 'Sem rolagem.'
        : `d20 ${e.rolagem}${e.usouRelance ? ' (relance)' : ''} ${e.bonus >= 0 ? '+' : ''}${e.bonus} = ${e.resultado} contra DC ${e.dc} (margem ${e.margem >= 0 ? '+' : ''}${e.margem})`,
      raciocinio: e.passos,
      narracao: e.desc,
      dicas: e.sugestao,
    };
  }
}
