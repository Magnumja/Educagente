"""Instruções enviadas ao modelo em cada tentativa.

Tentativa 1 (sem contexto): a configuração pré-definida, sem materiais.
Tentativa 2 (com fontes): a orientação do participante + os trechos recuperados da base.
"""
from __future__ import annotations

from dataclasses import dataclass

SISTEMA_SEM_CONTEXTO = "Você é um assistente. Responda em português do Brasil, em até dois parágrafos curtos."

SISTEMA_COM_FONTES = (
    "Você é um assistente de estudo. Responda em português do Brasil, em até dois parágrafos curtos, "
    "usando SOMENTE as informações dos trechos das fontes abaixo. Indique de qual trecho veio cada "
    "informação com o número entre colchetes, por exemplo [1]. Se os trechos não trouxerem a resposta, "
    "diga claramente que as fontes não falam sobre isso. Não complete com conhecimento próprio."
)

NADA_RELEVANTE = (
    "Não encontrei nada sobre essa pergunta nas fontes que você adicionou, então não vou responder. "
    "Confira se as fontes tratam desse assunto ou adicione outra fonte."
)


@dataclass
class TrechoUsado:
    documento: str
    pagina: int
    similaridade: float
    texto: str


def sistema_com_fontes(orientacao: str, trechos: list[TrechoUsado]) -> str:
    blocos = [SISTEMA_COM_FONTES]
    if orientacao.strip():
        blocos.append(f"ORIENTAÇÃO DO ESTUDANTE:\n{orientacao.strip()}")
    linhas = "\n".join(f"[{i}] ({t.documento}, p. {t.pagina}) {t.texto}" for i, t in enumerate(trechos, 1))
    blocos.append(f"TRECHOS DAS FONTES:\n{linhas}")
    return "\n\n".join(blocos)
