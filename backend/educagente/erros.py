"""Falhas dos casos de uso. `educagente/api.py` converte cada uma em status HTTP, com a
mensagem em `{"detail": ...}`, que o frontend mostra como está: escreva para o participante."""


class NaoEncontrado(Exception):
    """404: oficina, pergunta ou fonte inexistente (ou de outra pessoa)."""


class EntradaInvalida(Exception):
    """400: pedido que a pessoa consegue corrigir."""


class ServicoIndisponivel(Exception):
    """503: Ollama ou provedor de IA fora do ar."""
