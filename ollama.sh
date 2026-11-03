#!/usr/bin/env bash
# Garante que o Ollama está rodando e acessível pelo container Docker da API.
#
# Por padrão o Ollama só aceita conexões de 127.0.0.1, e o container (que fala
# com ele via host.docker.internal) não alcança isso — precisa escutar em
# 0.0.0.0. Idempotente: se já está certo, não faz nada.
set -e

PORTA=11434

pid_ollama() {
  # -x (nome exato do processo, não -f) evita pegar o próprio wrapper de shell
  # que às vezes contém o texto "ollama serve" dentro do comando executado.
  pgrep -x ollama | head -1
}

ollama_acessivel() {
  local pid="$1"
  [ -n "$pid" ] && grep -qz "OLLAMA_HOST=0.0.0.0" "/proc/$pid/environ" 2>/dev/null
}

# Instalação oficial (curl ... | sh) roda o Ollama como serviço do systemd: matar o processo não
# adianta (o systemd o recria em 127.0.0.1). Nesse caso a configuração vai no próprio serviço.
if command -v systemctl >/dev/null && systemctl cat ollama.service >/dev/null 2>&1; then
  if systemctl show ollama --property=Environment | grep -q "OLLAMA_HOST=0.0.0.0"; then
    echo "Ollama (serviço do systemd) já está acessível pelo Docker (porta $PORTA)."
    exit 0
  fi
  echo "Configurando o serviço do Ollama para aceitar conexões do Docker (pede sudo)..."
  sudo mkdir -p /etc/systemd/system/ollama.service.d
  printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0:%s"\n' "$PORTA" | sudo tee /etc/systemd/system/ollama.service.d/educagente.conf >/dev/null
  sudo systemctl daemon-reload
  sudo systemctl restart ollama
  sleep 2
  echo "Ollama pronto em 0.0.0.0:$PORTA (serviço do systemd)."
  exit 0
fi

pid="$(pid_ollama || true)"

if [ -n "$pid" ] && ollama_acessivel "$pid"; then
  echo "Ollama já está rodando e acessível pelo Docker (porta $PORTA)."
  exit 0
fi

if [ -n "$pid" ]; then
  echo "Ollama está rodando só em 127.0.0.1 — reiniciando acessível em 0.0.0.0..."
  pkill -x ollama
  sleep 1
else
  echo "Ollama não está rodando — iniciando..."
fi

OLLAMA_HOST=0.0.0.0:$PORTA nohup ollama serve > /tmp/ollama.log 2>&1 &
disown
sleep 2

novo_pid="$(pid_ollama || true)"
if ! ollama_acessivel "$novo_pid"; then
  echo "Não consegui confirmar o Ollama em 0.0.0.0:$PORTA — veja /tmp/ollama.log" >&2
  exit 1
fi

echo "Ollama pronto em 0.0.0.0:$PORTA (pid $novo_pid)."
