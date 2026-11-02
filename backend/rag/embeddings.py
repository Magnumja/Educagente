"""Embedding multilíngue fixo da plataforma, sempre via Ollama (`bge-m3`).

Não é plugável como o chat: a Anthropic não tem API de embedding e os documentos das
oficinas são em português.
"""
from __future__ import annotations


def embed(textos: list[str], model: str = "bge-m3") -> list[list[float]]:
    import ollama

    return ollama.embed(model=model, input=textos)["embeddings"]
