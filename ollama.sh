#!/usr/bin/env bash
# Garante que o Ollama está rodando e acessível pelo container Docker da API.
#
# Por padrão o Ollama só aceita conexões de 127.0.0.1, e o container (que fala
# com ele via host.docker.internal) não alcança isso — precisa escutar em
# 0.0.0.0. Idempotente: se já está certo, não faz nada.
#
# A conferência olha a porta de verdade (ss), não a configuração: um "ollama serve"
# aberto à mão num terminal pode ocupar a porta em 127.0.0.1 mesmo com o serviço
# do systemd configurado certo.
set -e

PORTA=11434

# Endereço em que algum processo escuta na porta (vazio se ninguém escuta).
endereco_escutando() {
  ss -ltnH "sport = :$PORTA" 2>/dev/null | awk '{print $4}' | head -1
}

# Aceita 0.0.0.0, * e [::] (todas as interfaces); recusa 127.0.0.1 e ::1.
acessivel_pelo_docker() {
  case "$(endereco_escutando)" in
    0.0.0.0:*|\*:*|\[::\]:*) return 0 ;;
    *) return 1 ;;
  esac
}

esperar_porta() {
  for _ in $(seq 15); do
    acessivel_pelo_docker && return 0
    sleep 1
  done
  return 1
}

if acessivel_pelo_docker; then
  echo "Ollama já está rodando e acessível pelo Docker (porta $PORTA)."
  exit 0
fi

# Um Ollama em 127.0.0.1 (serviço sem a configuração ou "ollama serve" manual) prende a porta:
# precisa sair antes de subir de novo em 0.0.0.0.
if [ -n "$(endereco_escutando)" ]; then
  echo "Ollama está escutando só em $(endereco_escutando) — reiniciando acessível em 0.0.0.0..."
  if command -v systemctl >/dev/null && systemctl is-active --quiet ollama 2>/dev/null; then
    sudo systemctl stop ollama
  fi
  pkill -x ollama 2>/dev/null || sudo pkill -x ollama || true
  sleep 2
fi

# Instalação oficial (curl ... | sh) cria o serviço do systemd: a configuração vai no próprio
# serviço (matar o processo não adianta, o systemd o recria com o ambiente dele).
if command -v systemctl >/dev/null && systemctl cat ollama.service >/dev/null 2>&1; then
  if ! systemctl show ollama --property=Environment | grep -q "OLLAMA_HOST=0.0.0.0"; then
    echo "Configurando o serviço do Ollama para aceitar conexões do Docker (pede sudo)..."
    sudo mkdir -p /etc/systemd/system/ollama.service.d
    printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0:%s"\n' "$PORTA" | sudo tee /etc/systemd/system/ollama.service.d/educagente.conf >/dev/null
    sudo systemctl daemon-reload
  fi
  # enable: volta sozinho depois de reiniciar a máquina.
  sudo systemctl enable ollama >/dev/null 2>&1 || true
  sudo systemctl restart ollama
  if ! esperar_porta; then
    echo "O serviço do Ollama não ficou acessível em 0.0.0.0:$PORTA — veja: journalctl -u ollama -n 30" >&2
    exit 1
  fi
  echo "Ollama pronto em 0.0.0.0:$PORTA (serviço do systemd)."
  exit 0
fi

echo "Iniciando o Ollama em 0.0.0.0:$PORTA..."
OLLAMA_HOST=0.0.0.0:$PORTA nohup ollama serve > /tmp/ollama.log 2>&1 &
disown
if ! esperar_porta; then
  echo "Não consegui confirmar o Ollama em 0.0.0.0:$PORTA — veja /tmp/ollama.log" >&2
  exit 1
fi

echo "Ollama pronto em 0.0.0.0:$PORTA."
