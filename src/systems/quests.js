// ---------------------------------------------------------------------------
// História central + missões. Arco em 5 atos, com missões secundárias e
// desbloqueio por progresso.
// ---------------------------------------------------------------------------

export const PROLOGO = `Há mil anos, os Sete Arquimagos costuraram o Véu — a membrana que separa Ardel do plano bruto da mana.
A costura era feita de nomes: cada mago deu o seu, e o Véu segurou.

Sete noites atrás, uma rachadura abriu no deserto de Kharun. Da fenda saiu o Arauto:
uma coisa que não conjura magia, mas a DEVOLVE. Aldeias inteiras morreram pelos próprios feitiços.

Você acordou na enfermaria de Pedravil sem lembrar como chegou lá — com uma marca de runa
queimada na palma da mão. A curandeira diz que é o oitavo nome. O nome que faltava.`;

export const MISSOES = [
  {
    id: 'q1_despertar', ato: 1, nome: 'O Oitavo Nome', obrigatoria: true,
    desc: 'Você acorda em Pedravil marcado por uma runa. A curandeira Vesna quer que você prove que consegue controlá-la.',
    objetivos: [
      { id: 'falar_fonte', texto: 'Tocar a Fonte de Mana na praça (E)', tipo: 'interagir', alvo: 'fonte_mana' },
      { id: 'matar_lobos', texto: 'Abater 3 Lobos do Véu nos arredores', tipo: 'matar', alvo: 'lobo_veu', qtd: 3 },
    ],
    recompensa: { xp: 120, pontos: 1 },
    concl: 'A runa responde ao seu comando. Vesna empalidece: "Então é verdade. Você é o selo, não o portador."',
  },
  {
    id: 'q2_ruinas', ato: 2, nome: 'As Ruínas que Lembram', obrigatoria: true, requer: 'q1_despertar',
    desc: 'O altar nas Ruínas de Ossar guarda a memória do Quarto Arquimago. Ele pode dizer o que a runa significa.',
    objetivos: [
      { id: 'altar', texto: 'Examinar o Altar Esquecido a oeste', tipo: 'interagir', alvo: 'altar_ruinas' },
      { id: 'goblins', texto: 'Limpar os saqueadores das ruínas (5 Goblins)', tipo: 'matar', alvo: 'goblin', qtd: 5 },
    ],
    recompensa: { xp: 240, pontos: 1, magia: 'runa_escudo' },
    concl: 'A memória fala: "O Véu não foi costurado para nos proteger. Foi costurado para prendê-LO. E ele tem fome."',
  },
  {
    id: 'q3_anciao', ato: 3, nome: 'O Ancião-Raiz', obrigatoria: true, requer: 'q2_ruinas', chefe: 'ancião_raiz',
    desc: 'A Mata do Sussurro enlouqueceu. O Ancião-Raiz absorveu mana do Véu e agora estrangula a floresta inteira.',
    objetivos: [
      { id: 'boss1', texto: 'Derrotar o Ancião-Raiz de Sussurro', tipo: 'chefe', alvo: 'ancião_raiz', qtd: 1 },
    ],
    recompensa: { xp: 600, pontos: 2, magia: 'raizes' },
    concl: 'Ao cair, a árvore sussurra o segundo nome. Sua runa arde: ela está COLECIONANDO os nomes de volta.',
  },
  {
    id: 'q4_rainha', ato: 3, nome: 'A Rainha sob a Areia', requer: 'q2_ruinas', chefe: 'rainha_areia',
    desc: 'A fenda original fica sob Kharun, e algo colossal a guarda desde então.',
    objetivos: [
      { id: 'boss2', texto: 'Derrotar a Rainha das Areias', tipo: 'chefe', alvo: 'rainha_areia', qtd: 1 },
    ],
    recompensa: { xp: 800, pontos: 2, magia: 'tremor' },
    concl: 'Sob a carcaça, a fenda original. Dela sai um vento que fala com a sua voz.',
  },
  {
    id: 'q5_tirano', ato: 4, nome: 'A Coroa Gélida', requer: 'q3_anciao', chefe: 'tirano_gelo',
    desc: 'O Sexto Arquimago se congelou vivo para não ser devorado. Ainda está lá em cima — e não está sozinho.',
    objetivos: [
      { id: 'boss3', texto: 'Derrotar o Tirano da Coroa Gélida', tipo: 'chefe', alvo: 'tirano_gelo', qtd: 1 },
    ],
    recompensa: { xp: 1000, pontos: 2, magia: 'prisao_gelo' },
    concl: 'O gelo racha e o Sexto Arquimago desperta por três segundos. Diz apenas: "Não devolva o nome. Queime-o."',
  },
  {
    id: 'q6_arauto', ato: 5, nome: 'O Véu Rasgado', obrigatoria: true, requer: 'q5_tirano', chefe: 'arauto_veu',
    desc: 'A Torre do Véu se abriu. O Arauto espera — e ele espelha tudo que você é. Chegou a hora de escolher: devolver o oitavo nome e refazer o Véu (e morrer dentro dele), ou queimá-lo e deixar os planos se fundirem.',
    objetivos: [
      { id: 'boss4', texto: 'Enfrentar o Arauto do Véu Rasgado', tipo: 'chefe', alvo: 'arauto_veu', qtd: 1 },
    ],
    recompensa: { xp: 2500, pontos: 4 },
    concl: 'O Arauto se desfaz. Sua mão arde com o oitavo nome. A escolha é sua — e o mundo vai lembrar dela.',
    escolhaFinal: true,
  },
  // --- Secundárias -------------------------------------------------------
  {
    id: 's1_construtor', ato: 1, nome: 'Fortificar Pedravil', requer: 'q1_despertar',
    desc: 'Mestre Torvald quer muralhas antes da próxima lua. Use o modo construção (B).',
    objetivos: [{ id: 'construir', texto: 'Erguer 12 peças de estrutura', tipo: 'construir', qtd: 12 }],
    recompensa: { xp: 180, pontos: 1 },
    concl: 'Torvald bate no seu ombro com uma força desnecessária. Pedravil tem muralhas.',
  },
  {
    id: 's2_naturalista', ato: 2, nome: 'Catálogo do Véu', requer: 'q1_despertar',
    desc: 'A acadêmica Ilise paga bem por observações de campo: mate ao menos uma criatura de 4 espécies distintas.',
    objetivos: [{ id: 'especies', texto: 'Catalogar 4 espécies diferentes', tipo: 'especies', qtd: 4 }],
    recompensa: { xp: 300, pontos: 1, magia: 'purificar' },
    concl: 'Ilise anota tudo, murmura "então a mana MUTA os corpos", e te entrega um frasco.',
  },
  {
    id: 's3_mestre', ato: 2, nome: 'Improviso Comprovado', requer: 'q1_despertar',
    desc: 'O Mestre do Véu quer ver você resolver 3 situações com argumentos válidos (tecla G) — sem repetir o mecanismo.',
    objetivos: [{ id: 'gm_sucessos', texto: 'Obter 3 sucessos com o Mestre IA', tipo: 'gm', qtd: 3 }],
    recompensa: { xp: 350, pontos: 2, magia: 'runa_amplificacao' },
    concl: 'O Mestre concede: "Você não decora magias. Você entende o mundo. Isso é mais raro."',
  },
];

export class QuestSystem {
  constructor(game) {
    this.game = game;
    this.estado = {};      // id -> {status, progresso:{}}
    this.especiesVistas = new Set();
    this.gmSucessos = 0;
    this.construidos = 0;
    MISSOES.forEach(q => {
      this.estado[q.id] = { status: q.requer ? 'bloqueada' : 'ativa', prog: {} };
      q.objetivos.forEach(o => { this.estado[q.id].prog[o.id] = 0; });
    });
    this.destravar();
  }

  destravar() {
    for (const q of MISSOES) {
      const st = this.estado[q.id];
      if (st.status === 'bloqueada' && (!q.requer || this.estado[q.requer]?.status === 'completa')) {
        st.status = 'ativa';
        this.game.log(`📜 Nova missão: ${q.nome}`, 'quest');
      }
    }
  }

  ativas() { return MISSOES.filter(q => this.estado[q.id].status === 'ativa'); }

  progresso(tipo, alvo, qtd = 1) {
    for (const q of this.ativas()) {
      for (const o of q.objetivos) {
        if (o.tipo !== tipo) continue;
        if (o.alvo && o.alvo !== alvo) continue;
        const st = this.estado[q.id];
        const max = o.qtd || 1;
        if (st.prog[o.id] >= max) continue;
        st.prog[o.id] = Math.min(max, st.prog[o.id] + qtd);
        this.game.log(`▸ ${o.texto} (${st.prog[o.id]}/${max})`, 'quest');
        this.checar(q);
      }
    }
  }

  checar(q) {
    const st = this.estado[q.id];
    const done = q.objetivos.every(o => st.prog[o.id] >= (o.qtd || 1));
    if (done && st.status === 'ativa') {
      st.status = 'completa';
      this.game.log(`🏆 MISSÃO COMPLETA: ${q.nome}`, 'quest');
      this.game.log(q.concl, 'lore');
      this.game.recompensar(q.recompensa);
      this.destravar();
      if (q.escolhaFinal) this.game.finalDoJogo();
    }
  }

  matou(tipoId, chefe) {
    this.especiesVistas.add(tipoId);
    this.progresso(chefe ? 'chefe' : 'matar', tipoId, 1);
    this.setContador('especies', this.especiesVistas.size);
  }

  interagiu(id) { this.progresso('interagir', id, 1); }
  construiu() { this.construidos++; this.setContador('construir', this.construidos); }
  gmSucesso() { this.gmSucessos++; this.setContador('gm', this.gmSucessos); }

  setContador(tipo, valor) {
    for (const q of this.ativas()) {
      for (const o of q.objetivos) {
        if (o.tipo !== tipo) continue;
        const st = this.estado[q.id];
        if (st.prog[o.id] === valor) continue;
        st.prog[o.id] = Math.min(o.qtd || 1, valor);
        this.game.log(`▸ ${o.texto} (${st.prog[o.id]}/${o.qtd})`, 'quest');
        this.checar(q);
      }
    }
  }

  serializar() {
    return { estado: this.estado, especies: [...this.especiesVistas], gm: this.gmSucessos, build: this.construidos };
  }
  carregar(d) {
    if (!d) return;
    Object.assign(this.estado, d.estado || {});
    this.especiesVistas = new Set(d.especies || []);
    this.gmSucessos = d.gm || 0;
    this.construidos = d.build || 0;
  }
}
