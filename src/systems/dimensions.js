// ---------------------------------------------------------------------------
// DIMENSÕES — 8 planos com regras FÍSICAS diferentes. Trocar de plano não é
// trocar de cenário: muda gravidade, densidade de mana, atrito, cor da luz,
// o que cresce e o que consegue existir ali.
// ---------------------------------------------------------------------------

export const DIMENSOES = {
  ardel: {
    nome: 'Ardel — o Mundo Desperto', ordem: 0,
    gravidade: -22, manaMult: 1.0, luz: 1.0, atritoMult: 1.0,
    ceu: ['#2a4a8f', '#c8d6f0'], neblina: 0x9fb6da, densidadeNeblina: 0.0022,
    desc: 'O plano material. Física de referência: gravidade 22 m/s², mana neutra, clima e ciclo dia/noite normais.',
    regra: 'Tudo que você aprender aqui é a linha de base para comparar os outros planos.',
    acesso: 'Plano inicial.',
    inimigos: ['lobo_veu', 'goblin', 'golem_pedra', 'cavaleiro_caido', 'aranha_mana'],
    cor: '#7fae5a',
  },
  penumbra: {
    nome: 'Penumbra — o Reflexo', ordem: 1,
    gravidade: -14, manaMult: 1.4, luz: 0.35, atritoMult: 0.6,
    ceu: ['#0a0818', '#2a2440'], neblina: 0x1a1830, densidadeNeblina: 0.008,
    desc: 'Cópia sombria de Ardel com gravidade a 64%. Você salta muito mais alto, cai mais devagar e o atrito quase some — correr vira deslizar.',
    regra: 'Umbramancia custa metade. Piromancia mal acende: não há oxigênio suficiente. Tudo que morre aqui volta.',
    acesso: 'Atravesse qualquer sombra profunda ao anoitecer, ou use um Portal Rúnico.',
    inimigos: ['espectro', 'lobo_veu', 'aranha_mana'],
    cor: '#4a3a6a', escolaBarata: 'sombra', escolaCara: 'fogo',
  },
  forja: {
    nome: 'A Forja Eterna', ordem: 2,
    gravidade: -30, manaMult: 0.8, luz: 1.4, atritoMult: 1.5,
    ceu: ['#5a1a08', '#d86a2a'], neblina: 0x8a3a12, densidadeNeblina: 0.006,
    desc: 'Plano elemental de fogo e metal. Gravidade 36% mais forte: você pesa mais, pula menos, cai com muito mais força.',
    regra: 'Piromancia é gratuita e dobra de dano. Hidromancia evapora antes de formar. Metal aquece e queima quem o veste.',
    acesso: 'Fornalhas rúnicas nas Escarpas de Vhorn.',
    inimigos: ['elemental_chama', 'golem_pedra', 'cavaleiro_caido'],
    cor: '#d8642a', escolaBarata: 'fogo', escolaCara: 'agua',
  },
  marejada: {
    nome: 'Marejada — o Oceano Suspenso', ordem: 3,
    gravidade: -9, manaMult: 1.2, luz: 0.7, atritoMult: 2.6,
    ceu: ['#062a4a', '#2a7aa8'], neblina: 0x1a5a7a, densidadeNeblina: 0.012,
    desc: 'Um oceano sem fundo nem superfície. Gravidade de 9 m/s² e atrito altíssimo: tudo se move como se estivesse submerso.',
    regra: 'Hidromancia é gratuita. Fulguromancia atinge TODOS num raio enorme — inclusive você. Fogo é impossível.',
    acesso: 'Mergulhe no ponto mais fundo do Pântano de Mir.',
    inimigos: ['aranha_mana', 'espectro'],
    cor: '#2a7aa8', escolaBarata: 'agua', escolaCara: 'fogo',
  },
  verdejante: {
    nome: 'O Verdejante Primordial', ordem: 4,
    gravidade: -20, manaMult: 1.5, luz: 0.85, atritoMult: 1.2,
    ceu: ['#1a4a1a', '#8ac86a'], neblina: 0x3a7a3a, densidadeNeblina: 0.007,
    desc: 'A floresta antes das florestas. Tudo é vivo, inclusive o chão — que respira e se move lentamente.',
    regra: 'Vitalurgia dobra de potência e curas afetam área. Fogo se alastra sem controle: você pode incendiar o plano inteiro.',
    acesso: 'Altar de raízes no coração da Mata do Sussurro.',
    inimigos: ['lobo_veu', 'aranha_mana', 'espectro'],
    cor: '#3a8a3a', escolaBarata: 'vida', escolaCara: 'sombra',
  },
  vazio: {
    nome: 'O Vazio Entre', ordem: 5,
    gravidade: -3, manaMult: 2.0, luz: 0.2, atritoMult: 0.15,
    ceu: ['#000000', '#1a0a2a'], neblina: 0x0a0514, densidadeNeblina: 0.02,
    desc: 'Nem espaço nem tempo. Gravidade quase nula e atrito desprezível: uma vez em movimento, você NÃO PARA até bater em algo.',
    regra: 'Toda magia custa metade e é 60% mais forte — mas cada conjuração tem 12% de chance de falha caótica. Sem chão fixo.',
    acesso: 'Somente pela Torre do Véu, após enfrentar o Arauto.',
    inimigos: ['espectro'],
    cor: '#6a2a8a', escolaBarata: null, escolaCara: null, caos: 0.12,
  },
  aurora: {
    nome: 'Aurora — o Plano Celestial', ordem: 6,
    gravidade: -16, manaMult: 1.3, luz: 1.8, atritoMult: 0.9,
    ceu: ['#d8e8ff', '#fff4d0'], neblina: 0xe8f0ff, densidadeNeblina: 0.004,
    desc: 'Luz sem fonte, nuvens sólidas, silêncio absoluto. Gravidade reduzida permite pontes entre ilhas flutuantes.',
    regra: 'Curas +60% e magia radiante amplificada. Umbramancia é praticamente impossível: não existe sombra aqui.',
    acesso: 'Erga uma construção a mais de 120 m de altitude na Coroa Gélida.',
    inimigos: ['cavaleiro_caido', 'espectro'],
    cor: '#e8d88a', escolaBarata: 'vida', escolaCara: 'sombra',
  },
  ossario: {
    nome: 'O Ossário', ordem: 7,
    gravidade: -24, manaMult: 1.1, luz: 0.4, atritoMult: 1.1,
    ceu: ['#1a1410', '#4a3a2a'], neblina: 0x2a2018, densidadeNeblina: 0.01,
    desc: 'Onde vão as coisas que morreram e não foram lembradas. Paisagem feita de camadas de ossos comprimidos.',
    regra: 'Necromancia e Umbramancia amplificadas. Vitalurgia NÃO funciona: nada vivo pode ser restaurado aqui.',
    acesso: 'Cave abaixo de 40 m de profundidade em qualquer cemitério antigo.',
    inimigos: ['espectro', 'cavaleiro_caido', 'golem_pedra'],
    cor: '#6a5a42', escolaBarata: 'sombra', escolaCara: 'vida',
  },
};

export const ORDEM_DIMENSOES = Object.keys(DIMENSOES).sort((a, b) => DIMENSOES[a].ordem - DIMENSOES[b].ordem);

/** Modificador de custo de magia no plano atual. */
export function custoNoPlano(dim, escola, custoBase) {
  const d = DIMENSOES[dim] || DIMENSOES.ardel;
  let m = 1 / (d.manaMult || 1);
  if (d.escolaBarata === escola) m *= 0.5;
  if (d.escolaCara === escola) m *= 3.0;
  return Math.max(1, Math.round(custoBase * m));
}

export function danoNoPlano(dim, escola, danoBase) {
  const d = DIMENSOES[dim] || DIMENSOES.ardel;
  let m = 1;
  if (d.escolaBarata === escola) m *= 1.6;
  if (d.escolaCara === escola) m *= 0.35;
  if (dim === 'vazio') m *= 1.6;
  return danoBase * m;
}
