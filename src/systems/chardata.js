// ---------------------------------------------------------------------------
// Dados de criação de personagem: raças, origens, classes, escolas de magia,
// traços, aparência. Tudo com efeitos MECÂNICOS reais (usados por física,
// combate e pelo Mestre IA na avaliação de plausibilidade).
// ---------------------------------------------------------------------------

export const ATTRS = {
  forca:      { nome: 'Força',       desc: 'Carga máxima, dano corpo-a-corpo, quanto de massa você consegue erguer/arremessar com telecinese física.' },
  destreza:   { nome: 'Destreza',    desc: 'Velocidade, altura do pulo, esquiva, precisão de conjuração à distância.' },
  vigor:      { nome: 'Vigor',       desc: 'Vida máxima, estamina, resistência a frio/calor/veneno e a quedas.' },
  intelecto:  { nome: 'Intelecto',   desc: 'Mana máxima, potência mágica bruta e qualidade dos argumentos aceitos pelo Mestre IA.' },
  espirito:   { nome: 'Espírito',    desc: 'Regeneração de mana, resistência mágica, estabilidade perto do Véu.' },
  carisma:    { nome: 'Carisma',     desc: 'Preços, aliados, e o quanto o Mestre IA concede o benefício da dúvida.' },
};

export const RACES = {
  humano: {
    nome: 'Humano de Ardel', mods: { forca: 1, destreza: 1, vigor: 1, intelecto: 1, espirito: 1, carisma: 2 },
    altura: [1.6, 1.95], peso: [55, 105], cores: ['#f0c9a4', '#d9a066', '#8d5524', '#5a3317'],
    passiva: 'Adaptável: +10% XP e um ponto extra de perícia a cada nível.',
    desc: 'Versáteis, numerosos e politicamente dominantes. Nenhum extremo, nenhuma fraqueza fatal. O Mestre IA aceita de humanos soluções criativas com ferramentas mundanas com menos exigência.',
    fis: { massaBase: 78, alcance: 1.0, tolFrio: 1.0, tolCalor: 1.0 },
  },
  elfo: {
    nome: 'Elfo do Sussurro', mods: { destreza: 3, intelecto: 2, espirito: 2, vigor: -1, forca: -1 },
    altura: [1.7, 2.05], peso: [48, 78], cores: ['#f5e0c8', '#e8d3b0', '#cdbfa0'],
    passiva: 'Leitura do Vento: conjuração à distância +15% precisão, queda sofre -30% de dano.',
    desc: 'Longevos, leves, ligados à mana vegetal. Corpos frágeis mas com afinidade natural por ar e natureza. Argumentos que usem vento, folhagem ou equilíbrio ganham bônus com o Mestre.',
    fis: { massaBase: 62, alcance: 1.1, tolFrio: 0.9, tolCalor: 1.0 },
  },
  anao: {
    nome: 'Anão de Vhorn', mods: { forca: 3, vigor: 3, espirito: 1, destreza: -2, carisma: -1 },
    altura: [1.25, 1.55], peso: [70, 120], cores: ['#e0b48c', '#c98d5a', '#9a6b3f'],
    passiva: 'Pé de Pedra: imune a empurrão, +40% eficiência ao construir, enxerga no escuro.',
    desc: 'Baixos, densos, teimosos. Massa alta significa mais inércia: difíceis de mover, péssimos para saltos longos. Engenharia e estruturas resistem mais nas mãos deles.',
    fis: { massaBase: 95, alcance: 0.85, tolFrio: 1.4, tolCalor: 1.1 },
  },
  orc: {
    nome: 'Orc das Estepes', mods: { forca: 4, vigor: 2, intelecto: -2, carisma: -1 },
    altura: [1.85, 2.3], peso: [95, 170], cores: ['#6f8f5a', '#4f7040', '#87a06a'],
    passiva: 'Fúria de Sangue: abaixo de 30% de vida, +50% dano físico e -25% custo de estamina.',
    desc: 'Massa muscular brutal. Conseguem arremessar objetos que outros nem levantam — o Mestre IA calcula literalmente a massa que sua Força suporta.',
    fis: { massaBase: 120, alcance: 1.15, tolFrio: 1.1, tolCalor: 1.2 },
  },
  draconato: {
    nome: 'Draconato do Cinzeiro', mods: { forca: 2, vigor: 2, intelecto: 1, espirito: 1, destreza: -1 },
    altura: [1.8, 2.2], peso: [90, 150], cores: ['#a8332a', '#2f6b8f', '#3f7a45', '#b58a2a'],
    passiva: 'Sopro Ancestral: cone elemental (cooldown longo) e resistência 50% ao seu elemento.',
    desc: 'Descendentes de dragões. Escamas, sopro elemental e uma queda natural por barganhas. Imunidade parcial ao próprio elemento muda como você pode lutar (ex.: atravessar o próprio fogo).',
    fis: { massaBase: 110, alcance: 1.1, tolFrio: 1.2, tolCalor: 1.6 },
  },
  feerico: {
    nome: 'Feérico do Véu', mods: { intelecto: 3, espirito: 3, destreza: 1, forca: -3, vigor: -2 },
    altura: [1.1, 1.6], peso: [28, 50], cores: ['#d7c6ff', '#bde6ff', '#ffd9f0'],
    passiva: 'Corpo Tênue: planar no ar, atravessar grades estreitas, -25% dano mágico recebido.',
    desc: 'Metade carne, metade mana. Quase não pesam — o que os torna arremessáveis pelo vento e incapazes de segurar portas pesadas, mas mestres da manipulação de energia.',
    fis: { massaBase: 38, alcance: 0.95, tolFrio: 0.8, tolCalor: 0.8 },
  },
  golem: {
    nome: 'Autômato Rúnico', mods: { forca: 3, vigor: 4, espirito: 2, destreza: -3, carisma: -2 },
    altura: [1.9, 2.6], peso: [200, 400], cores: ['#8d8d96', '#6b5a48', '#3f4a55'],
    passiva: 'Corpo Inorgânico: não respira (imune a veneno/afogamento), mas afunda na água e não regenera vida naturalmente — precisa reparar.',
    desc: 'Construto senciente movido a núcleo de mana. Regras físicas diferentes: peso brutal quebra pisos frágeis, água é armadilha mortal, calor extremo dilata as juntas.',
    fis: { massaBase: 280, alcance: 1.2, tolFrio: 1.6, tolCalor: 0.7 },
  },
};

export const ORIGENS = {
  aldeao:    { nome: 'Aldeão Sobrevivente', bonus: { vigor: 1, carisma: 1 }, item: 'Foice gasta', desc: 'Conhece plantio, clima e como consertar coisas com pouco. Perícia: Sobrevivência.' },
  academico: { nome: 'Acadêmico da Torre',  bonus: { intelecto: 2 }, item: 'Grimório rasgado', desc: 'Sabe química, alavancas, densidade e o nome verdadeiro das coisas. Perícia: Arcana + Ciências.' },
  soldado:   { nome: 'Veterano de Guerra',  bonus: { forca: 1, vigor: 1 }, item: 'Espada de serviço', desc: 'Tática, formações, ferimentos. Perícia: Combate + Medicina de campo.' },
  ladrao:    { nome: 'Dedos Leves',         bonus: { destreza: 2 }, item: 'Adagas gêmeas', desc: 'Fechaduras, sombras, pontos fracos estruturais. Perícia: Furtividade + Engenharia improvisada.' },
  ermitao:   { nome: 'Ermitão do Véu',      bonus: { espirito: 2 }, item: 'Totem de osso', desc: 'Sonhos proféticos e conversas com coisas que não deveriam falar. Perícia: Ocultismo.' },
  ferreiro:  { nome: 'Ferreiro Rúnico',     bonus: { forca: 1, intelecto: 1 }, item: 'Martelo rúnico', desc: 'Metalurgia, temperaturas de fusão, encantamento. Perícia: Artesanato.' },
};

export const CLASSES = {
  arcanista: {
    nome: 'Arcanista', recurso: 'Mana', prim: 'intelecto',
    desc: 'Conjuração pura. Maior dano mágico bruto, corpo frágil. Ganha slots extras de magia e pode combinar duas escolas num único feitiço.',
    vida: 0.8, mana: 1.6, stam: 0.9, escolas: 2,
  },
  guerreiro: {
    nome: 'Guerreiro Rúnico', recurso: 'Fôlego', prim: 'forca',
    desc: 'Aço encantado. Golpes carregados que convertem estamina em dano e permitem interromper conjurações inimigas.',
    vida: 1.5, mana: 0.6, stam: 1.5, escolas: 1,
  },
  patrulheiro: {
    nome: 'Patrulheiro', recurso: 'Foco', prim: 'destreza',
    desc: 'Mobilidade e precisão. Flechas encantadas, rastreio, armadilhas e o melhor uso de terreno do jogo.',
    vida: 1.1, mana: 1.0, stam: 1.3, escolas: 1,
  },
  clerigo: {
    nome: 'Clérigo do Véu', recurso: 'Fé', prim: 'espirito',
    desc: 'Cura, escudos e dano radiante. Único capaz de ressuscitar aliados no multiplayer.',
    vida: 1.2, mana: 1.3, stam: 1.0, escolas: 2,
  },
  invocador: {
    nome: 'Invocador', recurso: 'Vínculo', prim: 'intelecto',
    desc: 'Luta por procuração: criaturas do Véu combatem por você. Frágil sozinho, devastador com o campo montado.',
    vida: 0.9, mana: 1.5, stam: 0.9, escolas: 2,
  },
  artifice: {
    nome: 'Artífice', recurso: 'Carga', prim: 'intelecto',
    desc: 'Constrói torres, pontes, armadilhas e engenhocas. A classe que mais se beneficia do sistema de construção e das leis físicas.',
    vida: 1.2, mana: 1.1, stam: 1.2, escolas: 1,
  },
};

// --- Escolas de magia: cada uma com regra física explícita -----------------
export const ESCOLAS = {
  fogo: {
    nome: 'Piromancia', cor: '#ff6a2a',
    fisica: 'Calor. Precisa de combustível e oxigênio: dobra de dano em floresta seca e contra teias de óleo, falha debaixo d\'água ou na chuva forte. Aquece metal (armaduras viram armadilhas) e cria correntes de ar ascendentes que você pode usar para planar.',
    magias: ['brasa', 'lanca_fogo', 'explosao', 'muro_chamas'],
  },
  agua: {
    nome: 'Hidromancia', cor: '#3aa6ff',
    fisica: 'Massa e pressão. Água pesa 1 kg/litro: o volume que você move é limitado pelo seu Intelecto. Congela a 0 °C (pontes, prisões), conduz eletricidade e apaga fogo. Em desertos você precisa extrair umidade do ar — custo triplicado.',
    magias: ['jato', 'prisao_gelo', 'onda', 'ponte_gelo'],
  },
  ar: {
    nome: 'Aeromancia', cor: '#b9e3ff',
    fisica: 'Força vetorial. Empurrão real: a aceleração aplicada depende da MASSA do alvo. Um feérico voa longe, um golem nem se move. Cria vácuo (sufoca), reduz atrito e permite saltos duplos.',
    magias: ['rajada', 'salto_vento', 'vacuo', 'lamina_ar'],
  },
  terra: {
    nome: 'Geomancia', cor: '#b98a4a',
    fisica: 'Estrutura e gravidade. Você não cria matéria: molda a que existe. Precisa de solo/rocha por perto. Muros erguidos podem desabar sobre você se mal apoiados — o motor simula o colapso.',
    magias: ['muro_pedra', 'lanca_pedra', 'tremor', 'pele_pedra'],
  },
  raio: {
    nome: 'Fulguromancia', cor: '#ffe14a',
    fisica: 'Eletricidade busca o caminho de menor resistência. Salta entre alvos molhados ou de armadura metálica, é absorvido por terra/borracha, e paralisa músculos (stun) antes de queimar.',
    magias: ['choque', 'corrente', 'tempestade', 'passo_relampago'],
  },
  vida: {
    nome: 'Vitalurgia', cor: '#67e58a',
    fisica: 'Reorganiza matéria orgânica. Cura acelera processos naturais — não recria membros nem funciona em construtos. Cada cura tem custo metabólico: o alvo sente fome e fadiga depois.',
    magias: ['curar', 'regeneracao', 'raizes', 'purificar'],
  },
  sombra: {
    nome: 'Umbramancia', cor: '#8a5cd8',
    fisica: 'Manipula luz e percepção. Invisibilidade é refração: você ainda faz som, deixa pegadas e desloca ar. Precisa de sombra para teleporte curto. Em pleno sol, custo dobrado.',
    magias: ['manto_sombra', 'passo_sombrio', 'garra_negra', 'medo'],
  },
  runica: {
    nome: 'Runologia', cor: '#d9b3ff',
    fisica: 'Magia gravada: efeito retardado com condição de disparo. Você desenha a runa (leva tempo, fica visível) e ela dispara quando a condição ocorre. A base das armadilhas e das defesas de base.',
    magias: ['runa_explosiva', 'runa_escudo', 'runa_teleporte', 'runa_amplificacao'],
  },
};

export const MAGIAS = {
  brasa:            { nome: 'Brasa',                escola: 'fogo',   custo: 6,  dano: 14, cd: 0.5, tipo: 'projetil', vel: 40, desc: 'Projétil rápido e barato. Incendeia alvos secos.' },
  lanca_fogo:       { nome: 'Lança Flamejante',     escola: 'fogo',   custo: 18, dano: 42, cd: 2.0, tipo: 'projetil', vel: 55, desc: 'Perfura e continua queimando (dano por tempo).' },
  explosao:         { nome: 'Detonação',            escola: 'fogo',   custo: 34, dano: 60, cd: 5.0, tipo: 'area', raio: 8, desc: 'Explosão em área. Onda de choque empurra por massa.' },
  muro_chamas:      { nome: 'Muro de Chamas',       escola: 'fogo',   custo: 28, dano: 18, cd: 8.0, tipo: 'muro', desc: 'Barreira de fogo. Consome oxigênio em espaços fechados.' },
  jato:             { nome: 'Jato Pressurizado',    escola: 'agua',   custo: 9,  dano: 18, cd: 0.7, tipo: 'projetil', vel: 45, desc: 'Corta e empurra. Apaga fogo.' },
  prisao_gelo:      { nome: 'Prisão de Gelo',       escola: 'agua',   custo: 24, dano: 12, cd: 6.0, tipo: 'controle', desc: 'Congela o alvo. Quebra com dano físico ou calor.' },
  onda:             { nome: 'Maremoto',             escola: 'agua',   custo: 38, dano: 34, cd: 9.0, tipo: 'area', raio: 12, desc: 'Empurra em massa e molha tudo (sinergia com raio).' },
  ponte_gelo:       { nome: 'Ponte de Gelo',        escola: 'agua',   custo: 20, dano: 0,  cd: 5.0, tipo: 'utilidade', desc: 'Cria plataforma sólida. Suporta peso limitado.' },
  rajada:           { nome: 'Rajada',               escola: 'ar',     custo: 7,  dano: 10, cd: 0.6, tipo: 'projetil', vel: 60, desc: 'Empurrão proporcional ao inverso da massa do alvo.' },
  salto_vento:      { nome: 'Salto do Vento',       escola: 'ar',     custo: 14, dano: 0,  cd: 2.5, tipo: 'mobilidade', desc: 'Impulso vertical. Quanto mais leve você for, mais alto.' },
  vacuo:            { nome: 'Vácuo',                escola: 'ar',     custo: 30, dano: 26, cd: 7.0, tipo: 'area', raio: 7, desc: 'Suga o ar: sufoca e apaga chamas.' },
  lamina_ar:        { nome: 'Lâmina de Ar',         escola: 'ar',     custo: 20, dano: 38, cd: 2.2, tipo: 'projetil', vel: 80, desc: 'Corte invisível de alta velocidade.' },
  muro_pedra:       { nome: 'Muro de Pedra',        escola: 'terra',  custo: 22, dano: 0,  cd: 5.0, tipo: 'utilidade', desc: 'Ergue cobertura sólida do solo. Colapsável.' },
  lanca_pedra:      { nome: 'Lança de Pedra',       escola: 'terra',  custo: 12, dano: 28, cd: 1.2, tipo: 'projetil', vel: 35, desc: 'Massa alta: dano por impacto, queda balística.' },
  tremor:           { nome: 'Tremor',               escola: 'terra',  custo: 32, dano: 40, cd: 8.0, tipo: 'area', raio: 10, desc: 'Derruba alvos no chão e desestabiliza estruturas.' },
  pele_pedra:       { nome: 'Pele de Pedra',        escola: 'terra',  custo: 20, dano: 0,  cd: 12,  tipo: 'buff', desc: '+60% armadura, -30% velocidade (massa aumenta).' },
  choque:           { nome: 'Choque',               escola: 'raio',   custo: 8,  dano: 16, cd: 0.6, tipo: 'projetil', vel: 90, desc: 'Instantâneo. Stun curto.' },
  corrente:         { nome: 'Corrente Elétrica',    escola: 'raio',   custo: 22, dano: 30, cd: 3.0, tipo: 'cadeia', desc: 'Salta entre alvos molhados/metálicos.' },
  tempestade:       { nome: 'Tempestade',           escola: 'raio',   custo: 44, dano: 22, cd: 14,  tipo: 'area', raio: 14, desc: 'Raios contínuos na área. Devastador na chuva.' },
  passo_relampago:  { nome: 'Passo Relâmpago',      escola: 'raio',   custo: 16, dano: 0,  cd: 3.0, tipo: 'mobilidade', desc: 'Dash elétrico atravessando inimigos.' },
  curar:            { nome: 'Curar',                escola: 'vida',   custo: 18, dano: -45, cd: 2.0, tipo: 'cura', desc: 'Restaura vida. Não funciona em construtos.' },
  regeneracao:      { nome: 'Regeneração',          escola: 'vida',   custo: 26, dano: -8, cd: 10,  tipo: 'buff', desc: 'Cura contínua por 20s.' },
  raizes:           { nome: 'Raízes',               escola: 'vida',   custo: 16, dano: 6,  cd: 5.0, tipo: 'controle', desc: 'Prende ao solo. Inútil em pedra pura.' },
  purificar:        { nome: 'Purificar',            escola: 'vida',   custo: 14, dano: 0,  cd: 6.0, tipo: 'utilidade', desc: 'Remove veneno, queimadura e maldição.' },
  manto_sombra:     { nome: 'Manto de Sombras',     escola: 'sombra', custo: 22, dano: 0,  cd: 10,  tipo: 'buff', desc: 'Quase invisível parado; o movimento revela.' },
  passo_sombrio:    { nome: 'Passo Sombrio',        escola: 'sombra', custo: 18, dano: 0,  cd: 4.0, tipo: 'mobilidade', desc: 'Teleporte curto entre sombras.' },
  garra_negra:      { nome: 'Garra Negra',          escola: 'sombra', custo: 15, dano: 34, cd: 1.5, tipo: 'projetil', vel: 50, desc: 'Dano que ignora armadura física.' },
  medo:             { nome: 'Terror',               escola: 'sombra', custo: 26, dano: 0,  cd: 9.0, tipo: 'controle', desc: 'Inimigos fogem. Chefes resistem.' },
  runa_explosiva:   { nome: 'Runa Explosiva',       escola: 'runica', custo: 20, dano: 55, cd: 4.0, tipo: 'armadilha', desc: 'Detona por proximidade. Some no chão.' },
  runa_escudo:      { nome: 'Runa de Escudo',       escola: 'runica', custo: 24, dano: 0,  cd: 8.0, tipo: 'buff', desc: 'Barreira que absorve dano fixo.' },
  runa_teleporte:   { nome: 'Runa de Retorno',      escola: 'runica', custo: 30, dano: 0,  cd: 20,  tipo: 'utilidade', desc: 'Marca um ponto; volte a ele depois.' },
  runa_amplificacao:{ nome: 'Runa de Amplificação', escola: 'runica', custo: 28, dano: 0,  cd: 15,  tipo: 'buff', desc: 'Próximas 3 magias custam -50% e causam +40%.' },
};

export const TRACOS = {
  pirofobia:     { nome: 'Pirofobia',        tipo: 'defeito', desc: 'Pânico perto de fogo grande: -20% precisão. Ganha 2 pontos extras.', pts: 2 },
  sangue_frio:   { nome: 'Sangue-Frio',      tipo: 'virtude', desc: 'Imune a medo, +15% dano com pouca vida.', pts: -2 },
  memoria_total: { nome: 'Memória Eidética', tipo: 'virtude', desc: 'O Mestre IA aceita referências a fatos vistos há muito tempo; +1 relance em argumentos.', pts: -3 },
  maldicao_veu:  { nome: 'Marcado pelo Véu', tipo: 'misto',   desc: '+25% mana máxima, mas 5% de chance de falha caótica em cada magia.', pts: 0 },
  peso_leve:     { nome: 'Ossos Ocos',       tipo: 'misto',   desc: '-25% massa: pula mais, é empurrado mais longe.', pts: 0 },
  cicatrizes:    { nome: 'Coberto de Cicatrizes', tipo: 'virtude', desc: '+15% vida máxima, -1 Carisma.', pts: -1 },
  mao_firme:     { nome: 'Mão Firme',        tipo: 'virtude', desc: 'Conjuração não é interrompida por dano leve.', pts: -2 },
  falastrao:     { nome: 'Falastrão',        tipo: 'defeito', desc: 'Inimigos te notam 40% mais longe. Ganha 2 pontos.', pts: 2 },
};

export const CORPO = {
  altura:   { min: 1.1, max: 2.6, step: 0.01, label: 'Altura (m)', desc: 'Afeta alcance, altura de pulo, hitbox e o quanto você cabe em passagens estreitas.' },
  massa:    { min: 25, max: 400, step: 1, label: 'Massa (kg)', desc: 'Inércia real: define quanto o vento te move, o dano de queda e se pisos frágeis quebram.' },
  musculo:  { min: 0, max: 100, step: 1, label: 'Musculatura', desc: 'Divide sua massa entre músculo e gordura. Músculo = força; gordura = isolamento térmico.' },
  ombros:   { min: 0, max: 100, step: 1, label: 'Largura dos ombros', desc: 'Visual + hitbox horizontal.' },
};

export const PONTOS_INICIAIS = 12;
export const ATTR_BASE = 8;
