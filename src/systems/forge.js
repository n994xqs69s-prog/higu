// ---------------------------------------------------------------------------
// FORJA DE PODERES — o jogador INVENTA o próprio poder em texto livre e o
// sistema o converte numa magia realmente jogável (custo, dano, cooldown,
// forma, cor, comportamento físico), obedecendo às mesmas leis do mundo.
//
// Não existe lista fechada: qualquer descrição vira mecânica. O mesmo motor
// de análise do Mestre do Véu é usado aqui, então um poder bem descrito
// (com mecanismo causal e física coerente) nasce mais forte e mais barato
// que um poder genérico — sem nunca permitir "eu ganho automaticamente".
// ---------------------------------------------------------------------------

import { ESCOLAS } from './chardata.js';

const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const tem = (t, lista) => lista.some(k => t.includes(norm(k)));
const conta = (t, lista) => lista.filter(k => t.includes(norm(k))).length;

// --- Dicionários de leitura ------------------------------------------------
const ESCOLA_CHAVES = {
  fogo:   ['fogo','chama','queim','brasa','incendi','calor','lava','magma','solar','explos','ígne','igne','fornalha','cinza','fumaça','fumaca'],
  agua:   ['agua','água','gelo','congel','neve','vapor','chuva','onda','mare','oceano','sangue','veneno líquido','hidro','fluido','tsunami','geada'],
  ar:     ['ar','vento','rajada','tempest','furacao','furacão','tornado','sopro','vacuo','vácuo','pressao','pressão','som','grito','voz','nuvem','ciclone'],
  terra:  ['terra','pedra','rocha','cristal','metal','areia','lama','montanha','muro','espinho','raiz mineral','gravidade','magnet','ferro','aço','aco'],
  raio:   ['raio','eletric','elétric','trovao','trovão','choque','plasma','faisca','faísca','corrente','energia pura','laser','feixe'],
  vida:   ['vida','cura','regener','planta','raiz','floresta','semente','sangue vital','carne','crescer','natureza','fungo','espinho vegetal','simbio'],
  sombra: ['sombra','escurid','trevas','noite','ilusao','ilusão','medo','pesadelo','invisi','void','vazio','abismo','alma','espirito','espírito','morte','necro'],
  runica: ['runa','selo','glifo','sigilo','encant','marca','contrato','pacto','lei','palavra','nome verdadeiro','tempo','espaco','espaço','portal','dimens'],
};

const FORMAS = {
  projetil:   { chaves: ['lanço','lanco','disparo','atiro','projet','flecha','bola','esfera','dardo','tiro','arremesso','jato','feixe','raio de'], nome: 'Projétil' },
  area:       { chaves: ['area','área','explos','ao redor','em volta','todos','circulo','círculo','onda de choque','nova','erupç','erupc','campo'], nome: 'Área' },
  cone:       { chaves: ['cone','sopro','leque','frente','varre','baforada','rajada frontal'], nome: 'Cone' },
  feixe:      ['feixe','laser','contínuo','continuo','canaliz','sustentado','fluxo'],
  toque:      { chaves: ['toque','toco','agarro','soco','golpe','corpo a corpo','lâmina','lamina','garra','punho','mão','mao'], nome: 'Toque' },
  muro:       { chaves: ['muro','barreira','parede','escudo','cupula','cúpula','protec','protej','bloqueio','domo'], nome: 'Barreira' },
  invocacao:  { chaves: ['invoco','invoc','convoco','cria uma criatura','servo','familiar','clone','copia','cópia','aliado','espirito guardiao'], nome: 'Invocação' },
  mobilidade: { chaves: ['teleport','salto','dash','corrida','voo','deslize','piscar','blink','movo','me movo','atravesso'], nome: 'Mobilidade' },
  buff:       { chaves: ['aumento','fortale','amplific','melhoro','acelero','potenci','me torno','ganho','transformo'], nome: 'Fortalecimento' },
  debuff:     { chaves: ['enfraque','lentid','paralis','congela o','atordoa','cega','silencia','maldi','amaldi','reduz'], nome: 'Enfraquecimento' },
  cura:       { chaves: ['curo','cura','restauro','sara','recupero','revivo','remendo'], nome: 'Cura' },
  armadilha:  { chaves: ['armadilha','mina','gatilho','quando pisar','ao se aproximar','emboscada','espera'], nome: 'Armadilha' },
  utilidade:  { chaves: ['ilumino','revelo','detecto','abro','fecho','construo','moldo','crio uma ponte','escavo'], nome: 'Utilidade' },
};

// Escalas de intensidade declaradas pelo jogador
const INTENSIDADE = [
  { chaves: ['minúsculo','minusculo','fagulha','leve','pequeno','sutil','fraco','simples','rápido','rapido'], mult: 0.55, nome: 'menor' },
  { chaves: ['médio','medio','normal','comum','moderado'], mult: 1.0, nome: 'moderado' },
  { chaves: ['grande','forte','poderoso','intenso','pesado','massivo'], mult: 1.5, nome: 'maior' },
  { chaves: ['colossal','devastador','cataclism','apocalip','aniquil','absoluto','definitivo','supremo','divino','infinito','onipotent'], mult: 2.2, nome: 'catastrófico' },
];

// Custos/limitações que o jogador aceita voluntariamente → poder mais forte.
const LIMITACOES = [
  { chaves: ['me machuca','custa minha vida','sacrifico','recuo','perco vida','dor','queima minhas maos','queima minhas mãos'], nome: 'Custo de sangue', bonus: 0.35, efeito: 'recuo' },
  { chaves: ['preciso tocar','só funciona no toque','so funciona no toque','corpo a corpo'], nome: 'Exige contato', bonus: 0.3, efeito: 'toque' },
  { chaves: ['demora','lento','preparar','canalizar','concentrar','carregar'], nome: 'Conjuração lenta', bonus: 0.28, efeito: 'cast_lento' },
  { chaves: ['uma vez','raramente','longo descanso','só funciona quando','so funciona quando'], nome: 'Uso limitado', bonus: 0.4, efeito: 'cd_longo' },
  { chaves: ['fico vulner','baixo minha guarda','fico parado','imovel','imóvel','não posso me mover','nao posso me mover'], nome: 'Imobiliza você', bonus: 0.3, efeito: 'enraiza' },
  { chaves: ['só a noite','so a noite','só de dia','so de dia','só na chuva','so na chuva','só perto de','so perto de','apenas em'], nome: 'Condicional', bonus: 0.25, efeito: 'condicional' },
  { chaves: ['pode falhar','arriscado','instavel','instável','imprevis','caotic','caótic'], nome: 'Instável', bonus: 0.3, efeito: 'instavel' },
  { chaves: ['pouca mana sobra','drena toda','esgota'], nome: 'Drena tudo', bonus: 0.35, efeito: 'drena' },
];

const CAUSAIS = ['porque','pois','ja que','já que','de modo que','fazendo com que','o que causa','assim','portanto','entao','então','de forma que','logo','por isso','uma vez que'];

const MECANISMOS = [
  { chaves: ['pressao','pressão','vacuo','vácuo','compress'], nome: 'Pressão', bonus: 2 },
  { chaves: ['temperatura','calor','frio','congel','derrete','dilata','termic','térmic'], nome: 'Termodinâmica', bonus: 2 },
  { chaves: ['condut','eletric','elétric','aterr','circuito','metal conduz'], nome: 'Condutividade', bonus: 2 },
  { chaves: ['massa','peso','inercia','inércia','gravidade','centro de massa','momento'], nome: 'Mecânica', bonus: 2 },
  { chaves: ['vibra','frequen','frequên','ressona','ressonâ','onda sonora'], nome: 'Ressonância', bonus: 3 },
  { chaves: ['oxigen','oxigên','combustao','combustão','combustivel','combustível'], nome: 'Combustão', bonus: 2 },
  { chaves: ['atrito','friccao','fricção','lubrific'], nome: 'Atrito', bonus: 2 },
  { chaves: ['luz','refrac','refrat','reflex','optic','óptic','lente','espelho'], nome: 'Óptica', bonus: 2 },
  { chaves: ['densidade','empuxo','flutu','afunda'], nome: 'Densidade', bonus: 2 },
  { chaves: ['alavanca','torque','apoio','polia','engrenagem'], nome: 'Máquinas simples', bonus: 2 },
];

// Pedidos impossíveis — o poder é criado, mas *capado* nesses pontos.
const ABUSOS = [
  { chaves: ['mata instant','morte instant','one shot','mata na hora','insta kill','instakill','elimina qualquer'], nota: 'Morte instantânea foi convertida em dano alto — nada no Véu ignora pontos de vida.' },
  { chaves: ['invencivel','invencível','imune a tudo','indestrutivel','indestrutível','nada me afeta'], nota: 'Invencibilidade virou redução de dano temporária: nenhum ser é imune a tudo.' },
  { chaves: ['infinit','ilimitad','sem custo','sem mana','gratuito','para sempre','eterno'], nota: 'Recursos infinitos foram convertidos em custo baixo — energia sempre vem de algum lugar.' },
  { chaves: ['controla a mente','domino a mente','escravizo','obedece tudo','controle total'], nota: 'Controle mental total virou Medo/Confusão de curta duração.' },
  { chaves: ['volto no tempo','reverto o tempo','paro o tempo','tempo para'], nota: 'Manipulação temporal virou lentidão em área — o Véu não devolve o passado.' },
  { chaves: ['destruo o mundo','apago tudo','fim de tudo','deleto'], nota: 'Destruição absoluta foi convertida em dano massivo em área.' },
];

// --- Analisador -------------------------------------------------------------
export function analisarPoder(texto, ficha, build) {
  const t = norm(texto || '');
  const palavras = (texto || '').trim().split(/\s+/).filter(Boolean).length;
  const relatorio = [];

  // 1. Escola dominante (pode combinar duas)
  const pontuacao = {};
  for (const [esc, chaves] of Object.entries(ESCOLA_CHAVES)) {
    const n = conta(t, chaves);
    if (n) pontuacao[esc] = n;
  }
  const ordenadas = Object.entries(pontuacao).sort((a, b) => b[1] - a[1]);
  const escola = ordenadas[0]?.[0] || 'runica';
  const escolaSec = ordenadas[1]?.[0] || null;
  relatorio.push(ordenadas.length
    ? `Essência detectada: <b>${ESCOLAS[escola].nome}</b>${escolaSec ? ` combinada com <b>${ESCOLAS[escolaSec].nome}</b>` : ''}.`
    : 'Nenhum elemento claro — o poder será classificado como <b>Runologia</b> (magia de regra pura).');

  // 2. Forma
  let forma = 'projetil', formaNome = 'Projétil', melhor = 0;
  for (const [k, v] of Object.entries(FORMAS)) {
    if (!v.chaves) continue;
    const n = conta(t, v.chaves);
    if (n > melhor) { melhor = n; forma = k; formaNome = v.nome; }
  }
  if (!melhor) relatorio.push('Forma não declarada: assumindo <b>Projétil</b>. Diga "em área", "cone", "barreira", "invoco" ou "ao toque" para mudar.');
  else relatorio.push(`Forma de manifestação: <b>${formaNome}</b>.`);

  // 3. Intensidade
  let intens = 1.0, intensNome = 'moderado';
  for (const i of INTENSIDADE) if (tem(t, i.chaves)) { intens = i.mult; intensNome = i.nome; }
  relatorio.push(`Escala declarada: <b>${intensNome}</b> (×${intens.toFixed(2)} em potência e custo).`);

  // 4. Qualidade da descrição
  const causais = conta(t, CAUSAIS);
  const mecanismos = MECANISMOS.filter(m => tem(t, m.chaves));
  let qualidade = 0;
  if (palavras >= 40) { qualidade += 3; relatorio.push(`Descrição rica (${palavras} palavras): <b>+3 de eficiência</b>.`); }
  else if (palavras >= 18) { qualidade += 2; relatorio.push(`Boa descrição (${palavras} palavras): +2 de eficiência.`); }
  else if (palavras < 8) { qualidade -= 2; relatorio.push(`Descrição curta (${palavras} palavras): −2. Detalhe COMO o poder age.`); }
  if (causais >= 2) { qualidade += 3; relatorio.push(`Cadeia causal explícita (${causais} conectivos): <b>+3</b>.`); }
  else if (causais === 1) { qualidade += 1; relatorio.push('Uma relação causal declarada: +1.'); }
  else { qualidade -= 1; relatorio.push('Sem "porque / de modo que": −1. Explique o mecanismo e o poder fica mais barato.'); }
  mecanismos.forEach(m => { qualidade += m.bonus; relatorio.push(`★ Mecanismo real — <b>${m.nome}</b>: +${m.bonus}.`); });

  // 5. Limitações voluntárias → mais poder
  const limites = LIMITACOES.filter(l => tem(t, l.chaves));
  let multLimite = 1;
  limites.forEach(l => {
    multLimite += l.bonus;
    relatorio.push(`⚖ Limitação aceita — <b>${l.nome}</b>: potência +${Math.round(l.bonus * 100)}%.`);
  });

  // 6. Abusos → convertidos, nunca simplesmente negados
  const abusos = ABUSOS.filter(a => tem(t, a.chaves));
  abusos.forEach(a => relatorio.push(`⛔ <b>Ajuste do Véu:</b> ${a.nota}`));
  const penalAbuso = abusos.length ? 1 / (1 + abusos.length * 0.5) : 1;

  // 7. Números finais
  const efeitos = limites.map(l => l.efeito);
  const poderMag = ficha?.poderMagico || 1;
  const nivel = ficha?.nivel || 1;

  const baseDano = { projetil: 26, area: 34, cone: 30, toque: 40, muro: 8, invocacao: 18,
    mobilidade: 0, buff: 0, debuff: 10, cura: -34, armadilha: 44, utilidade: 0 }[forma] ?? 24;

  const eficiencia = 1 + qualidade * 0.06;
  let dano = Math.round(baseDano * intens * multLimite * eficiencia * penalAbuso);
  let custo = Math.round((10 + Math.abs(baseDano) * 0.42) * intens * (2 - Math.min(1.4, eficiencia)) * (1 + (multLimite - 1) * 0.5));
  let cd = +( { projetil: 0.9, area: 5.5, cone: 3.5, toque: 1.6, muro: 8, invocacao: 14,
    mobilidade: 3.5, buff: 12, debuff: 5, cura: 2.5, armadilha: 5, utilidade: 4 }[forma] ?? 2).toFixed(1);
  cd = +(cd * intens * (efeitos.includes('cd_longo') ? 3.5 : 1)).toFixed(1);

  // travas de equilíbrio
  custo = Math.max(4, Math.min(95, custo));
  dano = Math.max(forma === 'cura' ? -180 : 0, Math.min(190, dano));

  const vel = { projetil: 46, cone: 26, area: 0, toque: 0 }[forma] ?? 34;
  const raio = forma === 'area' ? +(6 + intens * 4).toFixed(1) : forma === 'cone' ? +(8 * intens).toFixed(1) : 0;

  return {
    escola, escolaSec, forma, formaNome, intens, intensNome,
    dano, custo, cd, vel, raio, efeitos, qualidade, eficiencia,
    relatorio, abusos: abusos.length, limites: limites.map(l => l.nome),
    mecanismos: mecanismos.map(m => m.nome), causais, palavras,
    cor: ESCOLAS[escola].cor,
    fisica: ESCOLAS[escola].fisica,
  };
}

/** Converte a análise numa entrada de magia usável pelo SpellSystem. */
export function forjarMagia(id, nome, texto, analise) {
  const tipoMap = {
    projetil: 'projetil', area: 'area', cone: 'area', toque: 'projetil',
    muro: 'muro', invocacao: 'invocacao', mobilidade: 'mobilidade',
    buff: 'buff', debuff: 'controle', cura: 'cura', armadilha: 'armadilha',
    utilidade: 'utilidade',
  };
  return {
    id, nome, custom: true,
    escola: analise.escola, escolaSec: analise.escolaSec,
    custo: analise.custo, dano: analise.dano, cd: analise.cd,
    tipo: tipoMap[analise.forma] || 'projetil',
    vel: analise.vel || 40, raio: analise.raio || 8,
    efeitos: analise.efeitos,
    desc: texto.slice(0, 260),
    forma: analise.forma, formaNome: analise.formaNome,
    cor: analise.cor,
  };
}

/** Sugestões para o jogador melhorar o próprio poder. */
export function dicasDoPoder(a) {
  const d = [];
  if (a.causais === 0) d.push('Adicione "porque" ou "de modo que" explicando o mecanismo — reduz o custo de mana.');
  if (!a.mecanismos.length) d.push('Cite uma física real (pressão, temperatura, condutividade, massa, ressonância, atrito, óptica) para ganhar eficiência.');
  if (!a.limites.length) d.push('Aceite uma limitação ("me machuca", "preciso tocar", "demora a carregar", "fico imóvel") e o poder fica bem mais forte.');
  if (a.palavras < 18) d.push('Descreva o que se VÊ e o que ACONTECE — descrições longas geram poderes melhores.');
  if (a.abusos) d.push('Evite absolutos ("infinito", "invencível", "mata na hora"): o Véu sempre converte isso em algo menor.');
  if (!d.length) d.push('Poder muito bem construído. Nada a corrigir.');
  return d;
}
