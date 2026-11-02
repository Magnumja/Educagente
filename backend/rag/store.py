"""Índice vetorial por projeto/etapa: JSONL com documento+página por trecho e busca por cosseno.

Abaixo do limiar de similaridade a busca não retorna o trecho — a resposta admite
"nada relevante encontrado" em vez de usar contexto fraco.
"""
from __future__ import annotations

import fcntl
import json
import os
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

from .embeddings import embed
from .schema import UsedChunk


@dataclass
class ChunkRecord:
    doc_id: str
    documento: str
    pagina: int
    texto: str
    vetor: list[float]


class ProjectIndex:
    def __init__(self, path: Path, embedding_model: str = "bge-m3"):
        self.path = path
        self.embedding_model = embedding_model
        self._registros: list[ChunkRecord] = []

    def load(self) -> None:
        self._registros = []
        if not self.path.exists():
            return
        for linha in self.path.read_text(encoding="utf-8").splitlines():
            if linha.strip():
                self._registros.append(ChunkRecord(**json.loads(linha)))

    def count(self) -> int:
        return len(self._registros)

    def add_document_chunks(self, doc_id: str, documento: str, paginas_trechos: list[tuple[int, str]]) -> int:
        """Substitui os trechos de `doc_id`. Os embeddings são gerados antes de travar o arquivo,
        para a trava durar só a leitura e a regravação."""
        vetores = embed([texto for _, texto in paginas_trechos], model=self.embedding_model) if paginas_trechos else []
        novos = [
            ChunkRecord(doc_id=doc_id, documento=documento, pagina=pagina, texto=texto, vetor=vetor)
            for (pagina, texto), vetor in zip(paginas_trechos, vetores)
        ]
        with self._trava():
            self.load()
            self._registros = [r for r in self._registros if r.doc_id != doc_id] + novos
            self._salvar()
        return len(novos)

    def search(self, pergunta: str, top_k: int, similarity_threshold: float) -> list[UsedChunk]:
        if not self._registros:
            return []
        [vetor_pergunta] = embed([pergunta], model=self.embedding_model)
        matriz = np.array([r.vetor for r in self._registros])
        consulta = np.array(vetor_pergunta)
        similaridades = matriz @ consulta / (np.linalg.norm(matriz, axis=1) * np.linalg.norm(consulta))

        resultado: list[UsedChunk] = []
        for posicao in np.argsort(-similaridades)[:top_k]:
            similaridade = float(similaridades[posicao])
            if similaridade < similarity_threshold:
                continue
            registro = self._registros[posicao]
            resultado.append(
                UsedChunk(
                    documento=registro.documento,
                    pagina=registro.pagina,
                    similaridade=round(similaridade, 3),
                    texto=registro.texto,
                )
            )
        return resultado

    @contextmanager
    def _trava(self):
        # Trava entre processos (gunicorn tem vários workers): dois uploads no mesmo
        # índice não podem ler-modificar-gravar ao mesmo tempo.
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.path.with_suffix(".lock"), "w") as arquivo_trava:
            fcntl.flock(arquivo_trava, fcntl.LOCK_EX)
            yield

    def _salvar(self) -> None:
        # Grava num temporário e troca de uma vez: quem lê nunca vê o arquivo pela metade.
        temporario = self.path.with_suffix(".tmp")
        with temporario.open("w", encoding="utf-8") as arquivo:
            for registro in self._registros:
                arquivo.write(json.dumps(asdict(registro), ensure_ascii=False) + "\n")
        os.replace(temporario, self.path)
