"""Núcleo RAG sem Django: corte em trechos, extração e busca."""
from unittest import TestCase

import numpy as np

from rag.busca import mais_parecidos
from rag.chunking import chunk_text
from rag.ingestion import ArquivoIlegivel, extrair_paginas


class Chunking(TestCase):
    def test_agrupa_paragrafos_curtos(self):
        self.assertEqual(chunk_text("um\n\ndois\n\ntrês", tamanho=100), ["um\ndois\ntrês"])

    def test_corta_paragrafo_longo_sem_passar_muito_do_limite(self):
        texto = " ".join(f"Frase número {i}." for i in range(200))
        trechos = chunk_text(texto, tamanho=200, sobreposicao=30)
        self.assertGreater(len(trechos), 5)
        self.assertTrue(all(len(t) <= 230 for t in trechos))

    def test_texto_sem_pontuacao_nem_quebra(self):
        trechos = chunk_text("a" * 2000, tamanho=500, sobreposicao=50)
        self.assertTrue(all(len(t) <= 500 for t in trechos))
        self.assertGreaterEqual(len(trechos), 4)

    def test_texto_vazio(self):
        self.assertEqual(chunk_text("  \n\n "), [])


class Busca(TestCase):
    def test_respeita_limiar_e_ordem(self):
        matriz = np.array([[1, 0], [0.8, 0.6], [0, 1]], dtype=np.float32)
        achados = mais_parecidos(np.array([1, 0], dtype=np.float32), matriz, top_k=3, limiar=0.5)
        self.assertEqual([i for i, _ in achados], [0, 1])

    def test_vetor_zerado_nao_quebra(self):
        matriz = np.zeros((2, 3), dtype=np.float32)
        self.assertEqual(mais_parecidos(np.ones(3, dtype=np.float32), matriz, 2, 0.1), [])


class Extracao(TestCase):
    def test_formato_nao_suportado(self):
        with self.assertRaises(ArquivoIlegivel):
            extrair_paginas("planilha.xlsx", b"")
