#!/usr/bin/env bash
# Teste de fumaça de um servidor no ar: site, IA, busca nas fontes e acesso do facilitador.
# Cria uma oficina temporária, faz uma pergunta sem e com fontes e apaga tudo no fim.
#
# Uso:  ./testar-producao.sh https://oficina.exemplo.com.br
#       ./testar-producao.sh http://localhost:8000
# A senha do facilitador é pedida na hora (ou venha em FACILITADOR_SENHA).
set -euo pipefail
cd "$(dirname "$0")"

BASE="${1:?Informe o endereço, ex.: ./testar-producao.sh https://oficina.exemplo.com.br}"
BASE="${BASE%/}"
API="$BASE/api"
PY=python3; command -v python3 >/dev/null || PY=python
export PYTHONIOENCODING=utf-8
# Corpos JSON só com ASCII (acentos como ã): o Git Bash do Windows estraga UTF-8 em argumentos.
TMP=$(mktemp -d)
OFICINA=""
AUTH=""

passo() { printf '\n\033[1;34m%s\033[0m\n' "$1"; }
ok() { printf '  \033[0;32m✓\033[0m %s\n' "$1"; }
falha() { printf '  \033[0;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }
campo() { $PY -c "import json,sys; d=json.load(sys.stdin); print($1)"; }

# Chama a API e falha com a mensagem do servidor se o status não for 2xx.
chamar() {
  local status
  status=$(curl -s -o "$TMP/resposta" -w '%{http_code}' "$@") || falha "sem conexão com $BASE"
  [[ "$status" == 2* ]] || falha "HTTP $status: $(cat "$TMP/resposta")"
  cat "$TMP/resposta"
}

limpar() {
  if [ -n "$OFICINA" ] && [ -n "$AUTH" ]; then
    curl -s -o /dev/null -X DELETE -H "$AUTH" "$API/facilitador/oficinas/$OFICINA" && echo "  (oficina de teste apagada)"
  fi
  rm -rf "$TMP"
}
trap limpar EXIT

if [ -z "${FACILITADOR_SENHA:-}" ]; then
  read -r -s -p "Senha do facilitador: " FACILITADOR_SENHA
  echo
fi

passo "1. Servidor e configuração"
SAUDE=$(chamar "$API/saude")
echo "$SAUDE" | campo "'  modelo: ' + str(d['modelo']) + ' | demonstração: ' + str(d['demonstracao']) + ' | embeddings locais: ' + str(d['embeddings_locais'])"
[ "$(echo "$SAUDE" | campo "d['demonstracao']")" = "False" ] || echo "  aviso: servidor em modo demonstração (sem IA real)"
[ "$(echo "$SAUDE" | campo "d['facilitador_configurado']")" = "True" ] || falha "FACILITADOR_SENHA não está configurada no servidor"
ok "API respondendo"

[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")" = 200 ] || falha "o site (/) não abriu"
ok "site abrindo"

passo "2. Acesso do facilitador"
TOKEN=$(chamar -X POST "$API/facilitador/entrar" -H 'Content-Type: application/json' \
  -d "$($PY -c "import json,sys; print(json.dumps({'senha': sys.argv[1]}))" "$FACILITADOR_SENHA")" | campo "d['token']")
AUTH="Authorization: Bearer $TOKEN"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$API/facilitador/oficinas")" = 401 ] || falha "painel abriu sem login"
ok "login funciona e o painel exige senha"

passo "3. Oficina temporária com fonte sugerida (testa os embeddings)"
OFICINA=$(chamar -X POST "$API/facilitador/oficinas" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "titulo": "Teste de fuma\u00e7a (apagar)",
  "perguntas": [
    {"texto": "Napole\u00e3o Bonaparte chegou a visitar o Brasil?", "referencia": ""},
    {"texto": "Por que a fam\u00edlia real portuguesa veio para o Brasil em 1808?", "referencia": ""},
    {"texto": "Napole\u00e3o Bonaparte era muito baixo para a \u00e9poca dele?", "referencia": ""}
  ]}' | campo "d['id']")
CODIGO=$(chamar -H "$AUTH" "$API/facilitador/oficinas/$OFICINA" | campo "d['codigo']")
chamar -X POST -H "$AUTH" -F "arquivo=@backend/oficinas/exemplos/napoleao.txt" "$API/facilitador/oficinas/$OFICINA/fontes" \
  | campo "'  fonte com ' + str(d['trechos']) + ' trechos'"
ok "oficina $CODIGO criada"

passo "4. Participante"
ENTRADA=$(chamar -X POST "$API/oficinas/$CODIGO/entrar" -H 'Content-Type: application/json' -d '{"apelido": "teste", "consentimento": true}')
PART="X-Participante: $(echo "$ENTRADA" | campo "d['token']")"
PERGUNTA=$(echo "$ENTRADA" | campo "d['estado']['perguntas'][0]['id']")
FONTE=$(echo "$ENTRADA" | campo "d['estado']['fontes_sugeridas'][0]['id']")
ok "entrou com apelido e consentimento"

passo "5. Pergunta sem contexto (testa o modelo de chat)"
chamar -X POST "$API/eu/perguntar" -H "$PART" -H 'Content-Type: application/json' -d "{\"pergunta_id\": $PERGUNTA, \"tentativa\": 1}" \
  | campo "'  (' + str(round(d['tempo_segundos'])) + ' s) ' + d['texto'][:200].replace(chr(10), ' ')"

passo "6. Pergunta com fontes (testa a busca)"
chamar -X POST -H "$PART" "$API/eu/fontes-sugeridas/$FONTE" > /dev/null
chamar -X POST "$API/eu/perguntar" -H "$PART" -H 'Content-Type: application/json' -d "{\"pergunta_id\": $PERGUNTA, \"tentativa\": 2}" \
  | campo "'  (' + str(round(d['tempo_segundos'])) + ' s, ' + str(len(d['trechos'])) + ' trechos, nada relevante: ' + str(d['nada_relevante']) + ') ' + d['texto'][:200].replace(chr(10), ' ')"

passo "7. Exportação"
chamar -H "$AUTH" "$API/facilitador/oficinas/$OFICINA/export.csv" > "$TMP/export.csv"
ok "CSV exportado ($(wc -c < "$TMP/export.csv") bytes)"

printf '\n\033[1;32mTudo certo.\033[0m\n'
