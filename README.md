# HIGU — Crônicas do Véu

RPG 3D de mundo aberto, no navegador, com **criação de personagem detalhada**, **magia governada por física real**, **construção de base**, **multiplayer** e um **Mestre de Jogo com IA** que arbitra ações improvisadas com base em argumentos.

Feito em `three.js` puro, sem nenhum asset externo: **todo o mundo, texturas, avatares e criaturas são gerados proceduralmente em runtime**.

---

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173  (desenvolvimento)
npm run server     # servidor multiplayer em :3000 (o dev proxeia /ws para ele)
npm start          # build de produção + servidor único em :3000
```

Para multiplayer, rode `npm run server` junto com `npm run dev`.

---

## Criação de personagem

Seis abas com preview 3D girável em tempo real. **Nada é cosmético** — toda escolha altera números do motor.

| Aba | O que define |
|---|---|
| **Raça** | 7 raças (Humano, Elfo, Anão, Orc, Draconato, Feérico, Autômato Rúnico). Cada uma com massa base, faixa de altura/peso, tolerância térmica, alcance e uma passiva que muda as regras (o Autômato afunda na água e não regenera; o Feérico plana e é arremessado pelo vento). |
| **Origem & Classe** | 6 origens (o *conhecimento prévio* que o Mestre IA reconhece nos seus argumentos) × 6 classes (Arcanista, Guerreiro Rúnico, Patrulheiro, Clérigo, Invocador, Artífice). |
| **Atributos** | 6 atributos, 12 pontos + traços. Cada ponto muda valores reais: kg de carga, metros de pulo, mana máxima. 8 traços — defeitos **devolvem** pontos. |
| **Magia** | 8 escolas, cada uma com uma **lei física própria** documentada. 32 magias com custo, cooldown e comportamento distintos. |
| **Corpo & Aparência** | Sliders de altura (1,1–2,6 m), massa (25–400 kg), musculatura e ombros — alteram o modelo 3D *e* a simulação. Cores de pele/cabelo/olhos/vestes, nome e biografia. |
| **Revisão** | Ficha completa com os números derivados: velocidade em m/s e km/h, altura de pulo, carga máxima, velocidade e alcance balístico de um arremesso de 50 kg. |

**42 combinações raça × classe** validadas por teste automatizado.

---

## As leis do mundo

O motor físico não é decorativo — é a base da tática.

- **Massa importa.** Todo impulso é força ÷ massa. O mesmo `salto_vento` (950 N·s) dá **25,0 m/s** a um Feérico de 38 kg e **3,4 m/s** a um Autômato de 280 kg.
- **Queda = ½mv².** Acima de ~3 m você se machuca; uma queda de 40 m causa ~179 de dano.
- **Fogo precisa de combustível e O₂.** Inflamabilidade por bioma: floresta 1,0 · planície 0,7 · deserto 0,35 · pântano 0,25 · água/neve 0,0.
- **Eletricidade segue o menor caminho.** Condutividade por bioma; alvos molhados levam ×1,8 e a corrente salta em cadeia entre eles e quem veste metal.
- **Água pesa.** O volume que você move é limitado pelo Intelecto. No deserto o custo triplica.
- **Terra não cria matéria.** Sem solo, sem geomancia. Muros erguidos viram colisores reais.
- **Estruturas desabam.** Peças de construção sem apoio caem, e o colapso se propaga recursivamente.
- **Empuxo real** na água (Arquimedes), **atrito por superfície** (gelo escorrega, pântano suga), **ciclo dia/noite** de 10 min afetando magia de sombra.

---

## O Mestre do Véu (bot IA)

Tecla **G**. Descreva em texto livre uma ação que o jogo não tem botão para fazer. O Mestre:

1. **Lê o ambiente real** — bioma, densidade de mana, condutividade, inflamabilidade, materiais num raio de 18 m, e para cada inimigo próximo: nome, distância, massa, fraqueza, se está molhado, se é metálico/construto/etéreo.
2. **Extrai intenção e recursos** do seu texto (8 escolas mágicas, ~50 verbos de manipulação física).
3. **Checa capacidade** — atributos, escolas conhecidas, mana, e a massa que sua Força realmente ergue (com cálculo de velocidade de arremesso e alcance balístico).
4. **Avalia o argumento** — causalidade explícita ("porque", "de modo que"), especificidade, e **14 conhecimentos de física real** que dão bônus grandes quando bem aplicados: alavanca e torque, empuxo, condutividade, triângulo do fogo, dilatação e choque térmico, centro de massa, pressão/hidráulica, atrito, mudança de estado, ressonância, máquinas simples, óptica, osmose, energia potencial. Mais 4 entradas de lore do próprio jogo.
5. **Detecta trapaça** — declarar resultado em vez de ação, pedir matéria do nada, "sou invencível", teleporte sem âncora. Cada bandeira: DC +10 e perda de reputação.
6. **Rola d20 + bônus contra a DC** e aplica o efeito mecânico no jogo, mostrando **todo o raciocínio linha a linha** — cada +2, cada −6, e por quê. Depois te ensina a argumentar melhor.

Curva de dificuldade medida em 200 rolagens por caso:

| Proposta | Taxa de sucesso |
|---|---|
| `"ataco"` | 26% |
| `"jogo fogo nele"` | 36% |
| *"Molho o cavaleiro com um jato de água **porque** a armadura de metal dele vira um condutor perfeito, **de modo que** minha corrente encontra o caminho de menor resistência…"* | **98%** |
| *"Uso o tronco caído como **alavanca** com uma pedra de ponto de apoio, **de modo que** o **torque** multiplica minha força e desloca o **centro de massa** do golem para fora da base de apoio…"* | **96%** |
| `"Eu venço todos instantaneamente porque sou invencível"` | **0%** (recusa sem rolar) |

---

## Mundo e conteúdo

- **1200 × 1200 m** de terreno contínuo por heightmap fBm, com 8 biomas: Planícies de Ardel, Mata do Sussurro, Areias de Kharun, Pântano de Mir, Escarpas de Vhorn, Coroa Gélida, o Véu Rasgado e as águas. Montanhas até 73 m, cratera do Véu, vila de Pedravil, ruínas circulares e a Torre do Véu de 56 m.
- **Vegetação e rochas instanciadas** (milhares de árvores, pedras e cristais), todos com colisores reais.
- **7 criaturas** + **4 chefes** com 3 fases cada e fraquezas que exigem raciocínio: o Ancião-Raiz precisa ser **derrubado**, não empurrado; a Rainha das Areias só emerge em solo seco; o Tirano da Coroa Gélida afunda se você derreter o piso sob as 1,6 t dele; o **Arauto do Véu copia a última magia que você usou** — repetir escola é suicídio.
- **História central em 5 atos** + missões secundárias, com progressão, XP, níveis e pontos de atributo redistribuíveis.
- **Construção de base**: grade de 2 m, 6 tipos de peça, 4 materiais com massa/resistência/inflamabilidade/condutividade próprias — uma base toda de metal é um para-raios — e verificação de suporte estrutural com colapso em cascata.
- **Multiplayer** por WebSocket com salas, avatares remotos interpolados a 16 Hz e eventos compartilhados.

---

## Controles

`WASD` mover · `Mouse` olhar · `Espaço` pular/planar · `Shift` correr · `1-8` magias · `Clique` conjurar · `Clique dir./F` ataque físico · `E` interagir e coletar · `B` modo construção (`Z`/`X`/`R` peça/material/girar) · **`G` Mestre do Véu** · `C` ficha · `TAB` mapa · `M` salvar

---

## Estrutura

```
src/systems/  textures.js  world.js     physics.js   chardata.js
              character.js spells.js    enemies.js   gm.js
              quests.js    building.js  player.js    net.js
src/ui/       creator.js   style.css
server/       index.js     (WebSocket + host estático)
```
