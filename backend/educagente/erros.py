"""Falhas dos casos de uso. `educagente/api.py` converte cada uma em status HTTP, com a
mensagem em `{"detail": ...}`, formato que o frontend lê."""


class NaoEncontrado(Exception):
    """404 — aluno ou projeto inexistente (ou de outro aluno)."""


class EntradaInvalida(Exception):
    """400 — pedido que o aluno pode corrigir."""


class ServicoIndisponivel(Exception):
    """502 — Ollama ou provedor de IA falhou."""
