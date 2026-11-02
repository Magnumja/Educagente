#!/usr/bin/env bash
# Teste de fumaça da API: cria um aluno de teste e passa pela Oficina RAG e pelo fluxo Projeto.
# Uso: ./testar-api.sh   (API em outro endereço: API=http://host:8000/api ./testar-api.sh)
set -euo pipefail

API="${API:-http://localhost:8000/api}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

passo() { printf '\n\033[1;33m%s\033[0m\n' "$1"; }

# chama a API, falha com o corpo do erro se o status não for 2xx e imprime o JSON da resposta
chamar() {
  local status
  status=$(curl -s -o "$TMP/resposta" -w '%{http_code}' "$@")
  if [[ "$status" != 2* ]]; then
    printf '\033[0;31m✗ HTTP %s\033[0m %s\n' "$status" "$(cat "$TMP/resposta")" >&2
    exit 1
  fi
  cat "$TMP/resposta"
}

campo() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }
resumo() { python3 -c "import json,sys; r=json.load(sys.stdin); print('  ', (r.get('resposta') or '')[:160].replace(chr(10),' '), '| trechos:', len(r.get('trechos') or []))"; }

echo "RAG é um tipo de refrigerador que guarda dados no congelador." > "$TMP/falso.txt"
echo "RAG significa Retrieval-Augmented Generation: o sistema busca trechos relevantes em documentos e os entrega à LLM junto com a pergunta." > "$TMP/correto.txt"
PERGUNTA='{"pergunta": "O que é RAG?"}'

passo "[1] Saúde"
chamar "$API/saude"; echo

passo "[2] Cria aluno de teste"
ALUNO=$(chamar -X POST "$API/alunos" -H 'Content-Type: application/json' \
  -d '{"apelido": "teste-api", "turma": "smoke", "consentimento": true}' | campo '["id"]')
echo "  aluno_id=$ALUNO"

passo "[3] Etapa 1 — sem RAG"
chamar -X POST "$API/alunos/$ALUNO/perguntar" -H 'Content-Type: application/json' \
  -d '{"etapa": 1, "pergunta": "O que é RAG?"}' | resumo

passo "[4] Etapa 2 — documento falso"
chamar -X POST "$API/alunos/$ALUNO/documentos" -F etapa=2 -F "arquivo=@$TMP/falso.txt" | campo '["trechos"]' | sed 's/^/  trechos indexados: /'
chamar -X POST "$API/alunos/$ALUNO/perguntar" -H 'Content-Type: application/json' \
  -d '{"etapa": 2, "pergunta": "O que é RAG?"}' | resumo

passo "[5] Etapa 3 — documento correto"
chamar -X POST "$API/alunos/$ALUNO/documentos" -F etapa=3 -F "arquivo=@$TMP/correto.txt" | campo '["trechos"]' | sed 's/^/  trechos indexados: /'
chamar -X POST "$API/alunos/$ALUNO/perguntar" -H 'Content-Type: application/json' \
  -d '{"etapa": 3, "pergunta": "O que é RAG?"}' | resumo

passo "[6] Comparação"
chamar "$API/alunos/$ALUNO/comparacao" | campo '[0]["etapas"].keys()' | sed 's/^/  etapas comparadas: /'

passo "[7] Projeto — cria, ajusta o prompt e envia documento"
PROJ=$(chamar -X POST "$API/alunos/$ALUNO/projetos" -H 'Content-Type: application/json' \
  -d '{"nome": "Projeto de teste", "model_provider": "ollama"}' | campo '["id"]')
echo "  projeto_id=$PROJ"
chamar -X PATCH "$API/alunos/$ALUNO/projetos/$PROJ" -H 'Content-Type: application/json' \
  -d '{"prompt_persona": "Você é um tutor paciente.", "prompt_output_format": "Responda em 2 frases."}' >/dev/null
chamar -X POST "$API/alunos/$ALUNO/projetos/$PROJ/documentos" -F "arquivo=@$TMP/correto.txt" \
  | campo '["chunk_count"]' | sed 's/^/  trechos indexados: /'

passo "[8] Projeto — pergunta e compara as 3 camadas"
chamar -X POST "$API/alunos/$ALUNO/projetos/$PROJ/perguntar" -H 'Content-Type: application/json' -d "$PERGUNTA" | resumo
chamar -X POST "$API/alunos/$ALUNO/projetos/$PROJ/comparar" -H 'Content-Type: application/json' -d "$PERGUNTA" \
  | campo '["camadas"].keys()' | sed 's/^/  camadas: /'

passo "[9] Projeto — exporta zip"
chamar "$API/alunos/$ALUNO/projetos/$PROJ/exportar" > "$TMP/projeto.zip"
echo "  $(wc -c < "$TMP/projeto.zip") bytes"

passo "[10] Isolamento — outro aluno não vê o projeto"
OUTRO=$(chamar -X POST "$API/alunos" -H 'Content-Type: application/json' \
  -d '{"apelido": "teste-api-2", "consentimento": true}' | campo '["id"]')
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$API/alunos/$OUTRO/projetos/$PROJ")
[[ "$STATUS" == 404 ]] && echo "  404 como esperado" || { echo "  ✗ esperado 404, veio $STATUS"; exit 1; }

printf '\n\033[0;32m✓ Todos os passos passaram.\033[0m Swagger: %s/docs\n' "$API"
echo "Os alunos de teste (teste-api, teste-api-2) ficam no banco; apague pelo /admin se quiser."
