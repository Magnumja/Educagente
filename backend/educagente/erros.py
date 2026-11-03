"""Falhas dos casos de uso, levantadas por `oficinas/services.py`.

`educagente/api.py` converte cada uma em status HTTP, com a mensagem em
`{"detail": ...}`, que o frontend mostra como está: escreva para o participante.

Assim as regras não conhecem HTTP, e as rotas não precisam de try/except.
"""


class NaoEncontrado(Exception):
    """404: oficina, pergunta ou fonte inexistente (ou de outra pessoa)."""


class EntradaInvalida(Exception):
    """400: pedido que a pessoa consegue corrigir."""


class ServicoIndisponivel(Exception):
    """503: serviço fora do ar ou não configurado (Ollama, provedor de IA, senha do facilitador)."""
