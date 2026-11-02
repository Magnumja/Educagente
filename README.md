# Educagente — Oficina RAG

Plataforma da oficina "Inclusão Digital e Profissão em Ciência da Computação através do RAG Agêntico"
(projeto de extensão da UCDB, Campo Grande/MS). "Educagente" é o nome do projeto; "Oficina RAG" é o
rótulo do fluxo fixo de 3 etapas dentro dela — a plataforma tem dois fluxos:

### Oficina RAG (fluxo fixo, 3 etapas)

O aluno faz a mesma pergunta em três etapas e compara as respostas:

| Etapa | O que acontece |
|---|---|
| 1 · IA sem RAG | A LLM responde só com a memória do treino |
| 2 · RAG com dados errados | O aluno envia um PDF/TXT falso (gerado pelo GPT) e pergunta de novo |
| 3 · RAG com dados corretos | O aluno monta o PDF/TXT real e pergunta de novo |

A tela **Comparar** cruza as respostas salvas das três etapas para a mesma pergunta.
O **Painel do professor** mostra todas as respostas e exporta CSV para a pesquisa.

### Projeto (fluxo livre, aba "Projeto")

Modelo mais geral, com identidade visual própria "Pantanal" (ver `DESIGN.md`): o aluno cria até
3 projetos, escreve um prompt de 5 campos (persona/contexto/instrução/restrição/formato de saída),
sobe seus próprios documentos e compara **modelo puro** vs. **+prompt** vs. **+prompt+RAG** lado a
lado. Cinco telas: Prompt → Conhecimento → Conversar → Comparar → Exportar (zip com config +
documentos + exemplo do prompt final).

Cada projeto escolhe um provedor de IA na criação (fica fixo depois):

- **Ollama** — grátis, sem conta, usa o servidor Ollama compartilhado da turma.
- **Anthropic** / **OpenAI** — BYOK (*bring your own key*): o aluno cola a própria chave na tela
  **"Minha IA"** (botão no topo da área Projeto). A chave fica só no `localStorage` do navegador,
  nunca é enviada ao nosso banco nem aparece em log — viaja só por requisição, direto pro provedor.
  Um botão "Testar e salvar" valida a chave antes de guardá-la, e um botão **"Como conseguir?"**
  abre o passo a passo de onde criar a chave em cada provedor.

Não existe "Entrar com Anthropic/OpenAI" por OAuth2 — nenhum dos dois provedores expõe um fluxo
público de terceiros que delegue uso/créditos da conta (a OpenAI tem "Sign in with ChatGPT", mas é
só identidade — `openid profile email`, nunca um token pra chamar a API). Colar a chave é o caminho
real disponível hoje.

## Rodar

```bash
./iniciar.sh
```

Abre em http://localhost:5173. É o **modo local** (`DJANGO_DEBUG=1`, `runserver`): o script cria o
ambiente Python, instala `backend/requirements.txt`, roda `migrate` e `importar_banco_legado` e sobe
a API na porta 8000. Na primeira pergunta com RAG, o modelo de embedding (`bge-m3`, via Ollama) é
usado para indexar e buscar.

Sem Ollama local nem `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`, o site roda em **modo demonstração**: tudo
funciona, mas no lugar da resposta da IA aparecem os trechos encontrados. Para usar a IA de verdade
na Oficina RAG (3 etapas), configure `backend/.env` (veja `backend/.env.example`):

```
MODEL_PROVIDER=anthropic   # ou "openai", ou "ollama"
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

e reinicie. Essa chave do `.env` fica só no servidor e é o fallback de demonstração/turma — no fluxo
"Projeto", cada aluno normalmente usa a própria chave, colada na tela "Minha IA" (ver acima), que
nunca passa pelo `.env` nem pelo banco.

### Rodar com Docker

A API roda em container; o Ollama fica no **host**, não containerizado. O frontend também roda
fora do container (ele não precisa de Docker).

1. **Garanta os modelos baixados** (uma vez):
   ```bash
   ollama pull bge-m3        # embedding, sempre necessário
   ollama pull llama3.2:1b   # só se for usar MODEL_PROVIDER=ollama no chat
   ```

2. **Configure `backend/.env`** (copie de `backend/.env.example` se ainda não existir) e escolha o
   provedor de chat (`MODEL_PROVIDER=ollama`, `anthropic` + `ANTHROPIC_API_KEY`, ou `openai` +
   `OPENAI_API_KEY`) — isso é só o fallback de demonstração/turma da Oficina RAG; no Projeto, cada
   aluno normalmente usa a própria chave via "Minha IA".

3. **Suba tudo:**
   ```bash
   ./docker-up.sh
   ```
   Esse script:
   - gera uma `DJANGO_SECRET_KEY` em `backend/.env` se ela estiver vazia (obrigatória com
     `DJANGO_DEBUG=0`, o modo de produção usado no container);
   - chama `ollama.sh` (garante o Ollama do host escutando em `0.0.0.0`, já que por padrão ele só
     aceita conexões de `127.0.0.1` e o container não alcança isso — idempotente, não mexe em nada
     se já estiver certo);
   - roda `docker compose up --build -d` e espera a API responder.

   Ao subir, o container (`backend/entrypoint.sh`) roda `migrate`, depois `importar_banco_legado`
   (ver "Banco de dados" abaixo) e então o gunicorn. A API sobe em `http://localhost:8000`,
   acessando o Ollama do host via `http://host.docker.internal:11434` (já configurado no
   `docker-compose.yml`, inclusive o `extra_hosts` necessário no Linux). Confirme com:
   ```bash
   curl http://localhost:8000/api/saude
   docker compose ps          # STATUS deve mostrar "healthy"
   ```
   A documentação interativa da API fica em `http://localhost:8000/api/docs`.
   Pra só garantir o Ollama acessível sem subir a API (ex.: rodando `./iniciar.sh` em vez de
   Docker), chame `./ollama.sh` sozinho.

4. **Suba o frontend** (fora do Docker):
   ```bash
   cd frontend && npm install && npm run dev
   ```
   Abre em `http://localhost:5173` — o Vite já proxia `/api` para `localhost:8000`, então funciona
   igual estando a API em Docker ou rodando direto no host.

Para derrubar tudo: `docker compose down` (API) + `Ctrl+C` no terminal do `npm run dev` (frontend).

**Problema comum:** se o upload de documento (etapa 2/3) der erro 502/500 mencionando
`ConnectionError`/"Failed to connect to Ollama", é quase sempre o Ollama do host reiniciado sem a
variável (acontece depois de um reboot, por exemplo) — rode `./ollama.sh` de novo, ele detecta e
corrige sozinho.

### Usar no laboratório

O Vite já escuta na rede. Rode no computador do professor e os alunos acessam
`http://IP-DO-PROFESSOR:5173`. As chamadas `/api` passam pelo Vite até o backend (com `changeOrigin`,
então o Django sempre recebe `Host: localhost:8000`), por isso não é preciso mexer em CORS nem em
`DJANGO_ALLOWED_HOSTS`.

### Painel administrativo (professor)

O Django Admin em `http://localhost:8000/admin` mostra alunos, respostas, projetos e documentos, com
login. Crie o usuário uma vez:

```bash
docker compose exec api python manage.py createsuperuser
```

As rotas `/api/professor/*` (tela "Pesquisa" e CSV) continuam abertas como antes — ver "Limitações".

### Banco de dados e migração da versão FastAPI

O banco agora é `backend/data/educagente.sqlite3`, com schema controlado pelas migrations do Django.
O banco da versão anterior (`backend/data/oficina.db`) **não é alterado**: o comando abaixo copia os
dados para o banco novo **mantendo os ids** (índices `data/indices/`, `data/projetos/<id>/` e o
aluno salvo no navegador continuam válidos). Antes da primeira cópia ele faz um backup em
`backend/data/backups/`. Rodar de novo não duplica nem sobrescreve nada, e no fim ele imprime as
contagens `legado=N django=N` de cada tabela para conferência.

```bash
docker compose exec api python manage.py migrate                 # já roda sozinho ao subir
docker compose exec api python manage.py importar_banco_legado   # idem
```

Para voltar à versão anterior basta voltar o código: o `oficina.db` continua intacto.

### Testes

Os testes usam o test runner do Django, com Ollama e provedores de IA simulados (nenhuma chamada
real ou paga). Rodam dentro da imagem:

```bash
docker compose run --rm --no-deps api python manage.py test tests
```

### Publicar na Vercel (só para apresentar)

Na Vercel roda só o site. Sem o backend, ele entra sozinho em **modo demonstração**: a busca e as
respostas são simuladas no navegador, com os mesmos passos do RAG de verdade. Cada visitante vê só os seus dados.

1. Em vercel.com → **Add New → Project**, importe este repositório.
2. Em **Root Directory**, escolha `frontend`. O preset Vite é detectado sozinho.
3. Clique em **Deploy**.

O botão **Demonstração em 1 clique** roda as três etapas com os exemplos prontos e abre a comparação.

## Como funciona

- `frontend/`: React + Vite + Tailwind.
  - `src/App.tsx`: cabeçalho compartilhado (logo "Educagente", navegação) e a página Início. A barra
    tem 3 itens — Início, **Oficina RAG** (menu suspenso com Etapa 1-3, Comparar e Pesquisa) e
    Projeto — mas a paleta azul/amarelo/rosa/verde do cabeçalho é a mesma da Início (apresentação à
    banca) e não foi alterada de propósito, mesmo com a aba Projeto usando a paleta Pantanal.
  - Início + Etapas (Oficina RAG): componentes do [unlumen UI](https://ui.unlumen.com)
    (`src/components/unlumen-ui/`: ShimmeringText, GlowingBadge, ThemeSwitch, ShimmerSkeleton,
    CountUp, TextReveal) e `src/components/slide.tsx`, `src/telas.tsx`.
  - Projeto: identidade visual própria "Pantanal" (`src/pantanal.css`,
    `src/components/pantanal.tsx`, `src/telasProjeto.tsx`) — ver `DESIGN.md` para paleta, tipografia
    (Baloo 2 + IBM Plex Mono) e os componentes (ficha catalográfica, régua de similaridade, botão de
    seleção animado). Nunca compartilha estilo com a Início/Etapas.
- `backend/`: Django 5.2 (LTS) + Django Ninja, servido por gunicorn (WSGI, com threads porque cada
  pergunta espera a LLM). Organizado por funcionalidade:
  - `educagente/`: configuração (`settings.py`, tudo por variável de ambiente), rotas (`urls.py`:
    `/api/` e `/admin/`) e `api.py` — monta os routers, `/api/saude`, `/api/validar-chave` (testa
    uma chave Anthropic/OpenAI sem persistir) e converte as falhas de `erros.py` em 400/404/502 no
    formato `{"detail": ...}` que o frontend lê.
  - `oficina/`: Oficina RAG (3 etapas fixas) e painel do professor — `models.py` (Aluno, Resposta),
    `services.py` (casos de uso), `api.py` (rotas) e o comando `importar_banco_legado`.
  - `projetos/`: modelo "Projeto" — `models.py` (Projeto, ProjetoDocumento, ProjetoResposta),
    `schemas.py`, `services.py` (criar, indexar documento, responder nas 3 camadas, comparar,
    exportar zip) e `api.py`. Todo acesso parte de `aluno + projeto_id` (projeto de outro aluno
    responde 404).
  - `rag/`: núcleo RAG sem dependência de Django nem de HTTP — contrato central
    `rag/engine.py::run(config, index, question, use_prompt, use_rag, api_key=None)`.
    - `llm.py`: adaptadores de chat `OllamaAdapter`, `AnthropicAdapter`, `OpenAIAdapter` e
      `DemoAdapter` — cada um aceita uma `api_key` por chamada (BYOK) com fallback pro `.env`.
    - `indexacao.py`: extrai o texto por página (`ingestion.py`), corta em trechos (`chunking.py`) e
      indexa (`store.py`: JSONL por projeto/etapa + embedding `bge-m3` via Ollama, sempre local);
      o arquivo só é gravado no destino depois de indexado. O índice é regravado de forma atômica e
      com trava de arquivo, então dois uploads simultâneos não se atropelam.
    - Na pergunta, a busca usa os `TOP_K` trechos mais próximos acima de `SIMILARITY_THRESHOLD`;
      abaixo disso a resposta admite "nada relevante encontrado".
  - `tests/`: testes da API, do isolamento entre projetos e da importação do banco legado.

## LGPD

O aluno entra só com apelido e turma e precisa marcar o consentimento. Não há outros dados pessoais.
Para zerar tudo, apague `backend/data/`. A chave de IA (BYOK) que o aluno cola em "Minha IA" nunca é
coletada pela plataforma — fica só no navegador dele, viaja no header `X-Provider-Api-Key` só nas
chamadas à LLM e não vai para banco, histórico, exportação nem log.

## Limitações conhecidas

- Não há login de aluno: o aluno é anônimo e identificado pelo id salvo no navegador, e as rotas
  `/api/professor/*` são abertas. Para uso fora da rede do laboratório, o próximo passo é exigir
  login de staff (o Django Admin já tem) nessas rotas.
- Num projeto Anthropic/OpenAI sem chave (nem do aluno nem do `.env`), perguntar devolve 400
  pedindo a chave em "Minha IA" — não há mais resposta simulada no lugar da IA. O modo
  demonstração continua valendo para a Oficina RAG quando o servidor não tem provedor configurado.
- Mudar o tamanho dos trechos de um projeto não reindexa os documentos já enviados (reenvie-os).
