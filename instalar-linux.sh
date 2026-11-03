#!/usr/bin/env bash
# Instala e sobe a plataforma num Linux, com o backend/.env preenchido automaticamente.
# As senhas são geradas aqui, na própria máquina: nunca passam pelo git nem pelo chat.
#
#   ./instalar-linux.sh                          # rede local (laboratório): http://IP:8000
#   ./instalar-linux.sh oficina.seudominio.com   # internet, com HTTPS (o DNS já deve apontar para cá)
#
# Pode rodar de novo sem medo: o que já está no .env é mantido.
set -euo pipefail
cd "$(dirname "$0")"

DOMINIO="${1:-}"
MODELO_CHAT="${LLM_MODEL:-llama3.2:3b}"
ENV=backend/.env

passo() { printf '\n\033[1;34m%s\033[0m\n' "$1"; }
erro() { printf '\033[0;31m%s\033[0m\n' "$1" >&2; exit 1; }

# Troca o valor de CHAVE no .env (ou acrescenta a linha).
definir() {
  if grep -qE "^$1=" "$ENV"; then sed -i "s|^$1=.*|$1=$2|" "$ENV"; else echo "$1=$2" >> "$ENV"; fi
}
valor() { grep -E "^$1=" "$ENV" | head -1 | cut -d= -f2-; }
gerar() { python3 -c "import secrets; print(secrets.token_urlsafe($1))"; }

passo "1. Conferindo o que precisa estar instalado"
for programa in docker curl python3; do
  command -v "$programa" >/dev/null || erro "Falta instalar: $programa"
done
docker info >/dev/null 2>&1 || erro "O Docker não respondeu. Rode: sudo usermod -aG docker \$USER, saia e entre de novo."
echo "  docker, curl e python3 ok"

passo "2. Preenchendo o $ENV"
[ -f "$ENV" ] || cp backend/.env.example "$ENV"
chmod 600 "$ENV"
[ -n "$(valor DJANGO_SECRET_KEY)" ] || definir DJANGO_SECRET_KEY "$(gerar 50)"
SENHA_NOVA=""
if [ -z "$(valor FACILITADOR_SENHA)" ]; then
  SENHA_NOVA="$(gerar 18)"
  definir FACILITADOR_SENHA "$SENHA_NOVA"
fi
definir DJANGO_DEBUG 0
definir MODEL_PROVIDER "$(valor MODEL_PROVIDER | grep . || echo ollama)"
definir LLM_MODEL "$MODELO_CHAT"
definir EMBEDDING_PROVIDER ollama
definir EMBEDDING_MODEL bge-m3

IP="$(hostname -I | awk '{print $1}')"
if [ -n "$DOMINIO" ]; then
  definir DOMINIO "$DOMINIO"
  definir DJANGO_ALLOWED_HOSTS "$DOMINIO"
  ENDERECO="https://$DOMINIO"
else
  definir DJANGO_ALLOWED_HOSTS "localhost,127.0.0.1,$IP"
  ENDERECO="http://$IP:8000"
fi
echo "  .env pronto (permissão 600: só o seu usuário lê)"

if [ -n "$DOMINIO" ]; then
  COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

  passo "3. Subindo API, Ollama e HTTPS (a primeira vez demora alguns minutos)"
  "${COMPOSE[@]}" up -d --build

  passo "4. Baixando os modelos no Ollama do container"
  "${COMPOSE[@]}" exec -T ollama ollama pull bge-m3
  "${COMPOSE[@]}" exec -T ollama ollama pull "$MODELO_CHAT"

  echo "  aguardando o certificado HTTPS..."
  for _ in $(seq 40); do curl -fs "$ENDERECO/api/saude" >/dev/null && break; sleep 3; done
else
  passo "3. Ollama no host"
  command -v ollama >/dev/null || curl -fsSL https://ollama.com/install.sh | sh
  ./ollama.sh
  ollama pull bge-m3
  ollama pull "$MODELO_CHAT"

  passo "4. Subindo a plataforma (a primeira vez demora alguns minutos)"
  ./docker-up.sh
fi

passo "5. Teste de ponta a ponta"
FACILITADOR_SENHA="$(valor FACILITADOR_SENHA)" ./testar-producao.sh "$ENDERECO"

passo "Pronto"
echo "  Alunos:     $ENDERECO"
echo "  Professor:  $ENDERECO/#/facilitador"
if [ -n "$SENHA_NOVA" ]; then
  echo "  Senha do professor (anote e guarde): $SENHA_NOVA"
else
  echo "  Senha do professor: a que já estava em $ENV (FACILITADOR_SENHA)"
fi
echo "  Para ver a senha de novo: grep FACILITADOR_SENHA $ENV"
