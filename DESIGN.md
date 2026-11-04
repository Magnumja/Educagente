# Design

## Cena

Um facilitador projeta a tela num laboratório de escola pública, com a luz acesa, enquanto
adolescentes e adultos em PCs antigos leem respostas de IA e conferem de onde veio cada
informação. Daí: **fundo claro por padrão**, alto contraste, texto base grande (17 px), fontes
do sistema (o laboratório pode estar sem internet) e nenhuma animação que atrase a tarefa.

## Princípios

1. **Procedência sempre visível.** Toda resposta tem um selo com texto e ícone: "Sem fonte"
   (borda tracejada), "Com fontes: N trechos" (marca-texto) ou "Nada encontrado nas fontes".
   Cor nunca é o único sinal.
2. **Marca-texto é exclusivo da evidência.** O amarelo `--evidencia` só aparece em trechos de
   fonte e nos números de citação. Não é usado para decorar.
3. **Uma etapa por vez.** A oficina tem cinco etapas; a trilha lateral (no celular, horizontal)
   diz qual está feita, qual é a atual e o que falta, por escrito.
4. **Mesma oficina, leitores diferentes.** Ajustes de leitura na engrenagem do cabeçalho:
   tamanho do texto e modo noturno.

## Tokens (`frontend/src/index.css`)

Estratégia contida: neutros levemente frios + um azul de ação + o marca-texto da evidência.

| Token | Uso |
|---|---|
| `--fundo`, `--superficie`, `--superficie-2` | Página, caixas, painéis secundários |
| `--tinta`, `--tinta-2` | Texto principal e secundário (≥ 7:1 e ≥ 4.5:1 no fundo) |
| `--linha`, `--linha-forte` | Bordas; a forte delimita campos e botões |
| `--acao`, `--acao-suave` | Botão principal, links, item selecionado |
| `--evidencia`, `--evidencia-tinta` | Trechos de fonte e citações |
| `--alerta`, `--erro`, `--ok` (+ `-fundo`) | Estados |

Tudo em OKLCH, com versão escura em `[data-tema="escuro"]`. Tamanho do texto em
`html[data-tamanho]` (100 %, 112 %, 129 % do base).

## Tipografia

Uma família (pilha do sistema: Segoe UI no Windows, Roboto no Android) e uma monoespaçada para
códigos e números de citação. Escala ~1.2. Títulos com `text-wrap: balance`, texto corrido em
até ~70 caracteres por linha.

## Componentes (`components/ui.tsx`)

`Botao` (primário, secundário, discreto, perigo; estado carregando), `Aviso` (info, alerta,
erro, ok, com `role` adequado), `Campo` (rótulo, dica e erro ligados por `aria-describedby`),
`Segmentado` (rádios nativos com cara de botões, setas do teclado funcionam), `Caixa`, `Dica`, `NumeroDoPasso`,
`Carregando` (esqueleto). Alvos de toque com pelo menos 44 px.

## Layout

- Largura única para todas as páginas (`larguraCls` em `components/ui.tsx`): ocupa a tela até
  ~1760 px, com margens laterais que crescem com ela. Texto corrido continua limitado em `ch`.
- Oficina: **barra lateral fixa** à esquerda (nome da oficina, progresso, as 5 etapas com ícone e
  estado escrito) e o conteúdo à direita. No celular a barra vira uma faixa horizontal no topo.
- Cada etapa abre com um cabeçalho compacto (ícone, "Etapa N de 5", título, uma frase). O que é
  bom saber, mas não é a tarefa, vai em **cartões de dica** (`Dica`), um assunto por cartão.
- Respostas longas ficam num bloco baixo com "Ler a resposta inteira"; os trechos das fontes
  aparecem como etiquetas ("doc · p. 1") e só abrem quando a pessoa pede.
- Compare e confira é **paginado**: uma pergunta por vez, em três páginas (ler, avaliar,
  conferir a referência), para caber na tela sem rolar.

## Movimento

Só CSS, sem biblioteca (os PCs da escola são antigos). Curvas `--ease-saida` e `--ease-expo`.

- **Assinatura:** o marca-texto "passa" sobre o trecho que sustenta a resposta (`.marca-texto`).
- Troca de página/etapa com leve deslize e desfoque (`.entrar-pagina`); listas entram em
  sequência (`.surgir` com `--i`).
- Cartões clicáveis sobem 2 px no hover (`.levanta`); botões afundam ao clicar.
- IA escrevendo: três pontos e esqueleto com brilho, mais um relógio em segundos (demora é
  informação, não falha). Etapa concluída: ✓ com um pequeno estalo.
- Tudo some com `prefers-reduced-motion`.
