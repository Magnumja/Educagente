# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19 + Vite 8 + Tailwind 4 (+ `motion`, `lucide-react`, `next-themes`), já existente no
repositório (`frontend/`). Backend Django + Django Ninja (`backend/`), SQLite via ORM.
Decisão de evolução confirmada com o usuário: adaptador de modelo plugável (Ollama **e**
Anthropic), índice vetorial próprio (JSONL + cosine manual, substituindo o Chroma atual) e
ingestão de conhecimento por upload de PDF/TXT (substituindo o mecanismo atual de colar JSON).

## Users

Alunos de Ensino Médio de escolas públicas de Campo Grande (MS), sem conhecimento técnico
prévio, participando em grupo de oficinas curtas (30-60min) em laboratórios de informática
com PCs antigos e projetor. Tarefa: montar o próprio chatbot escolhendo um modelo de
linguagem, escrevendo instruções de prompt e enviando documentos para uma base de
conhecimento (RAG), depois comparar como cada camada muda a resposta.
Usuário secundário: o professor/facilitador da oficina, que acompanha respostas de todos os
alunos e exporta dados (painel "Pesquisa"/CSV) — parte do projeto de extensão da UCDB.

## Product Purpose

Educagente ("educa a gente") existe para ensinar uso crítico de IA a adolescentes: mostrar de
onde vem a informação que um chatbot usa, perceber quando o modelo "inventa", e entender que
a tecnologia é configurável e controlável — não mágica. Sucesso é o aluno conseguir comparar,
lado a lado, as respostas de modelo puro vs. modelo+prompt vs. modelo+prompt+RAG, e explicar
a diferença entre elas.

## Positioning

A plataforma não apenas "usa" um chatbot — o aluno constrói e inspeciona cada camada
(modelo, prompt, base de conhecimento) e vê exatamente qual trecho de qual documento/página
fundamentou cada resposta, com um limiar de similaridade explícito que admite "nada relevante
encontrado" em vez de forçar uma resposta. Essa transparência de fonte e a comparação
lado-a-lado das três camadas é o mecanismo que um chatbot genérico não oferece.

## Operating Context

Oficinas presenciais em grupo, sessão única de 30-60min, em laboratório escolar com hardware
antigo (sem GPU) e projetor (que desbota cor). Fluxo em etapas: Prompt → Conhecimento →
Conversar → Comparar → Exportar. Já existe no repositório uma página "Início" que é uma
apresentação/pitch acadêmico para a banca da disciplina (estatísticas de IA, como funciona
LLM/RAG, equipe) — ela permanece intocada como material de apresentação, separada da
plataforma real que os alunos usam.

## Capabilities and Constraints

- Função central única (contrato que não deve mudar sem checar com o usuário):
  `run(config, index, question, use_prompt, use_rag) -> EngineResult` com `answer`,
  `final_prompt_sent`, `used_chunks` (documento, página, similaridade), `time_seconds`,
  `tokens_in`, `tokens_out`, `no_relevant_knowledge`.
- Toda resposta que usa RAG deve mostrar a fonte (documento + página); abaixo do limiar de
  similaridade, a plataforma diz explicitamente que nada relevante foi encontrado, nunca
  força uma resposta fraca.
- Modelo de linguagem: adaptador plugável Ollama (ex.: `llama3.2:1b`) e Anthropic
  (ex.: `claude-haiku-5-5`, já em uso no protótipo atual).
- Embedding multilíngue (documentos reais em português) — ainda a definir o modelo exato ao
  portar o índice próprio.
- Upload de conhecimento em PDF/TXT com extração de texto por página (substitui o colar-JSON
  atual das etapas 2/3 do protótipo).
- LGPD: sem coleta de e-mail/dado pessoal; fluxo de consentimento por apelido+turma; aviso
  explícito para não enviar dados pessoais nos documentos.
- Limitação conhecida e aceita: hardware escolar sem GPU — tempos de resposta mais altos na
  camada com RAG são esperados e devem ser mostrados, não escondidos.
- Em aberto: qual embedding multilíngue exato será fixado na plataforma; esquema final de
  persistência do índice próprio (substituindo o Chroma).

## Brand Commitments

Nome do produto: "Educagente". Identidade visual já definida pelo usuário como conceito
"Pantanal com requinte técnico" (paleta, tipografia dupla, motivos de ficha catalográfica e
régua de similaridade) — a ser registrada em DESIGN.md separadamente, não aqui. A página
"Início" existente usa uma paleta e componentes diferentes (azul/amarelo/rosa/verde,
"unlumen-ui") porque é material de apresentação à banca, não a identidade da plataforma; as
duas coexistem no mesmo repositório sem conflito, já que atendem públicos e propósitos
diferentes.

## Evidence on Hand

- Protótipo funcional existente em `/home/robertoneto/development/faculdade/6_sem/dac/educagente`:
  fluxo fixo de 3 etapas, tela Comparar, painel do professor com export CSV
  (`backend/main.py`, `frontend/src/App.tsx`, `frontend/src/telas.tsx`).
- Notebook de referência para lógica de RAG (embedding/chat via Ollama, cosine similarity,
  chunking): `/home/robertoneto/development/faculdade/6_sem/dac/rag_implementation/simple_rag.ipynb`.
- Sem depoimentos, estudos de caso ou métricas de uso reais ainda — é um protótipo acadêmico
  pré-oficina; nada disso deve ser inventado em trabalho futuro.

## Product Principles

1. Sempre mostrar a fonte: toda resposta com RAG cita documento+página; nunca apresentar a IA
   como mágica ou uma caixa-preta.
2. Uma ação principal por tela — linguagem direta em português, 2ª pessoa, sem jargão técnico.
3. Transparência sobre performance e incerteza: tempo de resposta e "nada relevante
   encontrado" são informações do produto, não falhas a esconder.
4. A plataforma real nunca compete visualmente com o material de apresentação à banca —
   são produtos distintos no mesmo repositório.
5. Fidelidade pedagógica acima de robustez de produção: é um protótipo acadêmico sem fins
   comerciais imediatos.

## Accessibility & Inclusion

Alto contraste (pensado para projetor que desbota cor), fonte base grande, navegação por
teclado, nunca usar só cor para transmitir significado (ex.: vermelho de alerta nunca marca
sozinho a coluna "modelo puro" da comparação — precisa de rótulo/ícone também), aviso visível
contra envio de dados pessoais nos documentos enviados.
