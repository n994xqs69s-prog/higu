# HIGU — Crônicas do Véu

RPG 3D de mundo aberto no navegador, com **18 raças**, **12 classes**, magia governada por física real, construção de base, multiplayer P2P e um **Mestre de Jogo com IA** que arbitra ações improvisadas por argumentação.

**Site 100% estático, uma única dependência (`three`), ~195 kB gzipped.** Sem backend, sem banco de dados, sem variáveis de ambiente, sem custo. Roda em GitHub Pages, Vercel, Netlify, Cloudflare Pages ou itch.io sem alterar uma linha.

---

## Rodar e publicar

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # gera dist/ — pronto para qualquer host estático
npm run preview      # testa o build de produção
```

| Plataforma | Como publicar | Custo |
|---|---|---|
| **GitHub Pages** | `mkdir -p .github/workflows && git mv .github/deploy-pages.yml.template .github/workflows/deploy.yml`, commit, e ative Pages → *GitHub Actions* | grátis |
| **Vercel** | Importe o repo. `vercel.json` já define build e output | grátis |
| **Netlify** | Importe o repo. `netlify.toml` já configurado | grátis |
| **Cloudflare Pages** | Build `npm run build`, output `dist` | grátis |
| **itch.io** | Faça upload do `dist/` zipado como HTML5 | grátis |

`base: './'` no Vite garante caminhos relativos — funciona tanto na raiz quanto em subpasta (`usuario.github.io/higu/`).

### Leve e fluido em qualquer máquina

O jogo **detecta o hardware e se ajusta sozinho**:

- Lê `deviceMemory`, `hardwareConcurrency` e user-agent → define qualidade **alta / média / baixa**.
- Escala: densidade de vegetação (2600 → 728 árvores), resolução da malha do terreno, número de inimigos (95 → 35), tamanho do shadow map, distância de renderização (2200 → 700 m), antialiasing e pixel ratio.
- **Auto-degradação em tempo real:** se o FPS cair abaixo de 30 por 3 s, reduz a resolução e, se persistir, desliga sombras.
- Detecta ausência de WebGL e mostra aviso claro em vez de tela preta.

---

## Raças (18)

Cada raça tem **massa real, tolerância térmica, alcance e tags mecânicas** — nada é cosmético.

| Raça | Conceito | Identidade mecânica |
|---|---|---|
| **Humano** | Versátil | +1 em TODOS os atributos, +10% XP, ponto livre extra |
| **Elfo** | Ágil e mágico | −30% dano de queda, +15% precisão, imune a sono |
| **Anão** | Resistente | Imune a empurrão, +40% ao construir, resiste a veneno |
| **Halfling** | Pequeno e sortudo | **Rerrola falhas** do Mestre IA · só 25 kg |
| **Dragonborn** | Sopro elemental | Cone elemental + 50% de resistência ao próprio elemento |
| **Tiefling** | Descendência demoníaca | Imune a fogo · barganha vale como argumento |
| **Meio-Orc** | Forte e agressivo | Sobrevive a 0 PV 1×/descanso · +50% dano com pouca vida |
| **Meio-Elfo** | Humano + elfo | Ponto livre extra, visão noturna, queda suave |
| **Gnomo** | Pequeno e inteligente | **+2 no Mestre IA** em engenharia, mecanismos e química |
| **Tabaxi** | Povo felino | **Imune a dano de queda** (cai de pé) · escala paredes |
| **Aarakocra** | Pássaro humanoide | **Voo real** (segure Espaço) · ossos ocos (massa ×0,5) |
| **Genasi** | Ligado a um elemento | Escolha fogo/água/terra/ar: imunidade + 40% dano + 25% desconto |
| **Goliath** | Gigante humanoide | **Carga DOBRADA** (438 kg vs 129 do humano) · imune a frio |
| **Aasimar** | Sangue celestial | Curas +30%, resiste a radiante/necrótico, emite luz |
| **Kenku** | Corvo humanoide | **Mímica perfeita** — enganar é mecanismo válido · +25% furtivo |
| **Tortle** | Tartaruga humanoide | **+35% de armadura** (75% total — o maior do jogo) |
| **Leonin** | Povo leão | Rugido de medo em área · garras (+40% dano físico) |
| **Warforged** | Construto mecânico | Imune a veneno/sufocamento · **não cura** · **afunda na água** |

## Classes (12)

| Classe | Recurso | Identidade mecânica |
|---|---|---|
| **Bárbaro** | Fúria | +60% dano, −50% dano recebido enquanto enfurecido · **não conjura magia** |
| **Bardo** | Inspiração | Canções de buff/debuff em área · ressonância como argumento |
| **Bruxo** | Pacto | Mana −30%, mas **custo −35% e cooldown −25%** |
| **Clérigo** | Fé | Curas **+40%** · único que ressuscita aliados |
| **Druida** | Vínculo Natural | Forma Selvagem: urso/lobo/águia **mudam sua massa de verdade** |
| **Feiticeiro** | Fonte Arcana | **Metamagia** (Shift ao conjurar: dobra custo, dobra efeito) |
| **Guerreiro** | Fôlego | Interrompe conjurações · armadura pesada = **condutor de raio** |
| **Ladino** | Foco | Furtivo ×3 pelas costas · **vê pontos estruturais frágeis** (+3 no GM) |
| **Monge** | Ki | +2 m/s · imune a queda · devolve projéteis usando o momento original |
| **Paladino** | Juramento | Punição divina · aura de −20% dano a aliados em 10 m |
| **Patrulheiro** | Foco Natural | Maior alcance · ignora atrito de pântano e neve |
| **Mago** | Mana | **3 escolas** e combinação de elementos · +2 no GM por física/química |

**216 combinações raça × classe** validadas por teste automatizado: todas geram ficha coerente e avatar 3D montado.

---

## As leis do mundo

- **Massa domina tudo.** O mesmo impulso de 950 N·s: Halfling (25 kg) → **38,0 m/s**; Humano (78 kg) → **12,2 m/s**; Goliath (190 kg) → **5,0 m/s**; Warforged (240 kg) → **4,0 m/s**.
- **Queda = ½mv²**, modulada por `quedaMult` (Tabaxi/Aarakocra/Monge = 0, Elfo = 0,7).
- **Fogo** precisa de combustível e O₂ (inflamabilidade por bioma: floresta 1,0 → neve 0,0).
- **Eletricidade** segue o menor caminho: alvo molhado ou blindado leva ×1,8 e a corrente salta em cadeia.
- **Água pesa**, **terra não cria matéria**, **estruturas sem apoio desabam** em cascata.
- Empuxo de Arquimedes, atrito por bioma e ciclo dia/noite de 10 min.

## O Mestre do Véu (tecla G)

Descreva qualquer ação em texto livre. Ele lê o ambiente real (bioma, condutividade, inflamabilidade, materiais em 18 m, massa e fraqueza de cada inimigo), avalia o mecanismo contra **14 conhecimentos de física real**, aplica **bônus específicos da sua raça e classe**, detecta trapaça, rola d20 contra uma DC calculada e **mostra todo o raciocínio linha a linha**.

Taxas medidas (150–300 rolagens por caso):

| Situação | Sucesso |
|---|---|
| `"ataco ele"` (vago) | 10–28% |
| Gnomo citando polia e plano inclinado | **95%** |
| Tabaxi saltando penhasco ("caio de pé") | **94%** |
| Warforged atravessando veneno ("não respiro") | **82%** |
| Kenku imitando a voz do capitão inimigo | **69%** |
| Goliath erguendo 300 kg | **41%** (é pesado mesmo) |
| `"eu venço todos porque sou invencível"` | **0%** — recusado sem rolar |

## Multiplayer sem servidor

WebRTC via PeerJS: o broker público e gratuito faz só o handshake, o tráfego é **P2P direto entre navegadores**. Topologia em estrela com migração automática de host. O módulo é carregado por CDN sob demanda — quem joga sozinho nunca baixa esse código.

## Controles

`WASD` mover · `Mouse` olhar · `Espaço` pular/planar/voar · `Shift` correr · `1-8` magias · `Clique` conjurar · `F` corpo-a-corpo · `E` interagir · `B` construir (`Z`/`X`/`R`) · **`G` Mestre do Véu** · `C` ficha · `TAB` mapa · `M` salvar

## Estrutura

```
src/systems/  textures.js  world.js     physics.js   chardata.js
              character.js spells.js    enemies.js   gm.js
              quests.js    building.js  player.js    net.js
src/ui/       creator.js   style.css
```

---

## v3 — Liberdade e escala

### ⚒ Forja de Poderes — invente a sua própria magia

O grimório pronto é só o começo. Em **qualquer momento do jogo** (tecla `J`) ou na
criação de personagem (aba *Forja de Poderes*) você **escreve em português o que
o seu poder faz** e o sistema o transforma numa magia jogável de verdade: escola,
forma, dano, custo de mana, recarga, raio, cor e efeitos colaterais.

O analisador lê o seu texto e extrai:

| O que ele procura | Efeito |
|---|---|
| Vocabulário de 8 escolas | define escola primária e secundária |
| 12 formas (projétil, área, cone, toque, muro, invocação, mobilidade, buff, debuff, cura, armadilha, utilidade) | define como a magia se comporta em jogo |
| Palavras de intensidade | escala de ×0,55 a ×2,2 |
| Conectivos causais ("porque", "de modo que") | +qualidade → mais eficiência |
| Menções a física real (ressonância, condução, empuxo, pressão, combustão…) | +2 a +3 de qualidade cada |
| **Limitações que você aceita** | **+25% a +40% de potência** |

**Limitar o próprio poder o torna mais forte.** Custo de sangue, exigir contato,
conjuração lenta, uso limitado, ficar imóvel, condicional, instável, drenar toda a
mana — cada uma dá um bônus real *e é aplicada de verdade na conjuração*: se você
escreveu que o poder te machuca, ele tira os seus PV.

**Absolutos não são recusados — são convertidos.** Pedir "mato todos
instantaneamente e sou invencível com poder infinito" não gera erro; o sistema
traduz em dano alto, redução temporária de dano e custo baixo, com penalidade de
potência por abuso. Você nunca bate numa parede dizendo "não pode".

Máximo de 6 poderes por personagem.

### 🌀 Oito planos com física própria

Tecla `P` abre a viagem planar. Cada plano muda **a simulação**, não o cenário:

| Plano | Gravidade | Mana | Atrito | Regra |
|---|---|---|---|---|
| Ardel | 22 m/s² | ×1,0 | ×1,0 | o mundo material |
| Penumbra | 14 | ×1,4 | ×0,6 | sombra barata, fogo caro |
| Forja | 30 | ×1,0 | ×1,5 | fogo barato, água cara |
| Marejada | 9 | ×1,0 | ×2,6 | água barata, fogo caríssimo |
| Verdejante | 20 | ×1,5 | ×1,0 | vida barata, sombra cara |
| Vazio | 3 | ×2,0 | ×0,15 | dano ×1,6, custo pela metade, caos |
| Aurora | 16 | ×1,0 | ×1,0 | vida barata, sombra cara |
| Ossário | 24 | ×1,0 | ×1,0 | sombra barata, vida impossível |

A queda livre foi validada contra `√(2h/g)`: 48 m levam 1,78 s na Forja, 2,08 s em
Ardel e 5,73 s no Vazio. **O Mestre IA sabe em que plano você está** e ajusta o
veredito: o mesmo salto acrobático ganha bônus no Vazio e o fogo é penalizado na
Marejada.

### 👥 648.000 habitantes

Nenhum deles está na memória. Cada NPC é derivado do seu número de registro por um
PRNG determinístico: nome e sobrenome, raça (distribuição ponderada, humanos
maioria), profissão, idade, nível, personalidade, objetivo e um segredo. Em 30.000
amostrados saem **26.605 nomes distintos**. Apenas os ~22 mais próximos viram
modelos 3D; os outros existem como potencial. Tecla `N` abre o censo, com busca por
número de registro. São 17 assentamentos espalhados por todos os planos, da capital
Aurelian (42.000) à Âncora no Vazio (300).

### ⛓ Masmorras procedurais

Obeliscos rúnicos marcam 40 entradas no mundo; `E` desce, `L` sobe. Cada semente
gera geometria 3D real — salas sem sobreposição, corredores em L, paredes sólidas
com vãos de porta, colliders e spawns (entrada, chefe, tesouro, armadilha). Seis
tipos: cripta, caverna, forja, santuário, covil e laboratório. Uma semente de teste
produziu 11 salas, 339 meshes e 263 colliders. Lá dentro o Mestre muda de postura:
ressonância nas colunas ganha bônus, relâmpago "do céu" é bloqueado.

### Teclas novas

`J` Forja de Poderes · `P` viagem planar · `N` censo · `L` sair da masmorra
