"""Etapa 6 do RAG: enviar as instruções e a pergunta ao modelo de chat.

Entrada: o prompt de sistema (de `prompts.py`) e o texto da pergunta. Saída: um
`RespostaDoModelo` com o texto, os tokens gastos e o tempo.

Cada provedor tem um adaptador com o mesmo método `conversar`, então o resto do sistema
não sabe (nem precisa saber) qual IA está do outro lado. O modelo é escolhido pela
equipe no `backend/.env`; o participante nunca escolhe modelo nem informa chave.
"""
from __future__ import annotations

import time
from dataclasses import dataclass

from rag.prompts import MARCADOR_TRECHOS

MAX_TOKENS_RESPOSTA = 700


@dataclass
class RespostaDoModelo:
    texto: str
    tokens_entrada: int
    tokens_saida: int
    tempo_segundos: float


class FalhaDoProvedor(Exception):
    """O provedor de IA não respondeu. A mensagem já vem pronta para o participante."""


class AdaptadorDeChat:
    """Interface comum: recebe as instruções e a pergunta, devolve a resposta."""

    def conversar(self, sistema: str, pergunta: str) -> RespostaDoModelo:
        raise NotImplementedError


class AdaptadorOllama(AdaptadorDeChat):
    """Modelo aberto rodando no servidor da turma (sem custo, sem internet)."""

    def __init__(self, modelo: str):
        self.modelo = modelo

    def conversar(self, sistema: str, pergunta: str) -> RespostaDoModelo:
        import ollama

        inicio = time.monotonic()
        try:
            resposta = ollama.chat(
                model=self.modelo,
                messages=[{"role": "system", "content": sistema}, {"role": "user", "content": pergunta}],
                stream=False,
            )
        except Exception as erro:
            raise FalhaDoProvedor("O servidor de IA da turma (Ollama) não respondeu. Avise o facilitador.") from erro
        return RespostaDoModelo(
            texto=resposta["message"]["content"],
            tokens_entrada=resposta.get("prompt_eval_count", 0) or 0,
            tokens_saida=resposta.get("eval_count", 0) or 0,
            tempo_segundos=time.monotonic() - inicio,
        )


class AdaptadorAnthropic(AdaptadorDeChat):
    """Modelo Claude pela API da Anthropic (precisa de ANTHROPIC_API_KEY no servidor)."""

    def __init__(self, modelo: str, chave: str):
        self.modelo = modelo
        self.chave = chave

    def conversar(self, sistema: str, pergunta: str) -> RespostaDoModelo:
        import anthropic

        inicio = time.monotonic()
        try:
            mensagem = anthropic.Anthropic(api_key=self.chave).messages.create(
                model=self.modelo,
                max_tokens=MAX_TOKENS_RESPOSTA,
                system=sistema,
                messages=[{"role": "user", "content": pergunta}],
            )
        except anthropic.RateLimitError as erro:
            raise FalhaDoProvedor("Muitas perguntas ao mesmo tempo. Espere alguns segundos e tente de novo.") from erro
        except anthropic.AuthenticationError as erro:
            raise FalhaDoProvedor("A chave de IA do servidor é inválida. Avise o facilitador.") from erro
        except anthropic.APIError as erro:
            raise FalhaDoProvedor("O serviço de IA não respondeu agora. Tente de novo em instantes.") from erro
        return RespostaDoModelo(
            texto="".join(bloco.text for bloco in mensagem.content if bloco.type == "text"),
            tokens_entrada=mensagem.usage.input_tokens,
            tokens_saida=mensagem.usage.output_tokens,
            tempo_segundos=time.monotonic() - inicio,
        )


class AdaptadorDemonstracao(AdaptadorDeChat):
    """Sem modelo de verdade: devolve os trechos recebidos, para o fluxo funcionar offline."""

    AVISO = "[Modo demonstração: nenhuma IA real foi consultada.]\n\n"

    def conversar(self, sistema: str, pergunta: str) -> RespostaDoModelo:
        if MARCADOR_TRECHOS in sistema:
            # Repete o começo do trecho [1] (o mais parecido), citando-o, como uma IA obediente faria.
            primeiro = sistema.split(MARCADOR_TRECHOS, 1)[1].split("\n[2]", 1)[0]
            texto = " ".join(primeiro.split(") ", 1)[-1].split())  # tira o "[1] (documento, p. N)"
            resposta = self.AVISO + f"Segundo as fontes: {texto[:280].rstrip()}… [1]"
        else:
            resposta = (
                self.AVISO + "Uma IA real responderia de memória aqui, e poderia acertar, errar ou inventar "
                "detalhes com toda a segurança."
            )
        return RespostaDoModelo(texto=resposta, tokens_entrada=0, tokens_saida=0, tempo_segundos=0.0)


def modo_demonstracao(provedor: str, chave: str = "") -> bool:
    """Verdadeiro quando não há IA real configurada (provedor "demo", desconhecido ou Anthropic sem chave)."""
    return not (provedor == "ollama" or (provedor == "anthropic" and chave))


def criar_adaptador(provedor: str, modelo: str, chave: str = "") -> AdaptadorDeChat:
    if modo_demonstracao(provedor, chave):
        return AdaptadorDemonstracao()
    if provedor == "ollama":
        return AdaptadorOllama(modelo)
    return AdaptadorAnthropic(modelo, chave)
