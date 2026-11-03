# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19 + Vite 8 + TypeScript + Tailwind 4 + `lucide-react` (`frontend/`). Backend Django 5.2 +
Django Ninja (`backend/`), SQLite via ORM, núcleo RAG próprio em `backend/rag/` (sem Django).
Um container entrega a API e o site compilado na mesma porta.

## Users

Adolescentes e adultos sem conhecimento técnico, em oficinas presenciais de 30 a 60 minutos, em
laboratórios com PCs antigos e projetor. Usuário secundário: o facilitador, que cria a oficina
(três perguntas, referências, fontes sugeridas), acompanha a turma e exporta os dados da pesquisa.

## Product Purpose

Seguir a proposta do projeto DAC ("Inclusão digital crítica: uso consciente de IA com RAG e
NotebookLM"): mostrar, por comparação, que uma resposta de IA sem contexto pode estar errada ou
sem suporte, que fontes confiáveis e orientação mudam o resultado, e levar esse raciocínio para
o estudo com o NotebookLM. Sucesso é a pessoa comparar as duas respostas de cada pergunta,
conferir o trecho citado e justificar em qual confiaria. O projeto não ensina a programar RAG.

## Positioning

A plataforma faz a mesma pergunta duas vezes, sem e com fontes, e mostra exatamente qual trecho
de qual documento e página sustentou a segunda resposta. Abaixo do limiar de similaridade ela
diz que as fontes não falam do assunto em vez de deixar a IA completar de memória.

## Operating Context

Fluxo de 5 etapas: Sem contexto → Fontes → Com fontes → Comparar → NotebookLM. A configuração
do modelo é da equipe (`backend/.env`); o participante nunca escolhe modelo nem informa chave.

## Capabilities and Constraints

- Exatamente três perguntas por oficina; a 2ª tentativa exige a 1ª e pelo menos uma fonte.
- Toda resposta com fontes cita documento + página; sem trecho relevante, a IA não é chamada.
- Modelos: Ollama (padrão, local) ou Anthropic; embeddings bge-m3 via Ollama (ou "local" só
  para demonstração).
- Fontes: PDF/TXT até 5 MB e 60 páginas, ou texto colado; o arquivo original não é guardado.
- LGPD: só apelido + termo explícito; o participante apaga os próprios dados; aviso contra
  dados pessoais nos documentos.
- Hardware sem GPU: o tempo de resposta aparece na tela, não é escondido.

## Brand Commitments

Nome "Educagente". Identidade descrita em DESIGN.md: claro por padrão, alto contraste, fontes do
sistema, marca-texto reservado à evidência.

## Evidence on Hand

Protótipo acadêmico pré-oficina. O dado de "70%" de uso de IA por jovens, citado na concepção,
não tem fonte confirmada e não deve aparecer na interface. Nenhum depoimento ou métrica real.

## Product Principles

1. Sempre mostrar a fonte; nunca apresentar a IA como mágica.
2. Uma etapa por vez, linguagem direta em português, segunda pessoa, sem jargão (o técnico fica
   atrás de "com detalhes técnicos").
3. Demora e "nada encontrado" são informação do produto, não falhas a esconder.
4. Ter fonte não garante acerto: a interface sempre pede conferência.
5. Fidelidade à proposta acima de recursos extras.

## Accessibility & Inclusion

Contraste AA ou melhor nos dois temas, texto ajustável em três tamanhos, navegação completa por
teclado (rádios nativos, foco visível, link para pular ao conteúdo), estado nunca só por cor,
`prefers-reduced-motion` respeitado.
