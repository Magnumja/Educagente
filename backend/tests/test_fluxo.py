"""O fluxo da proposta: perguntar sem contexto, adicionar fontes, perguntar de novo e comparar."""
from tests.apoio import FONTE_PANTANAL, TesteDaApi


class FluxoDoParticipante(TesteDaApi):
    def setUp(self):
        super().setUp()
        self.oficina = self.criar_oficina()
        self.auth, self.estado = self.entrar(self.oficina["codigo"])
        self.perguntas = [p["id"] for p in self.estado["perguntas"]]

    def usar_fonte_sugerida(self) -> dict:
        fonte_id = self.estado["fontes_sugeridas"][0]["id"]
        r = self.json("post", f"/api/eu/fontes-sugeridas/{fonte_id}", **self.auth)
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()

    def test_estado_inicial_tem_tres_perguntas_e_esconde_as_referencias(self):
        self.assertEqual(len(self.estado["perguntas"]), 3)
        self.assertEqual(self.estado["referencias"], {})
        self.assertNotIn("referencia", self.estado["perguntas"][0])
        self.assertEqual(len(self.estado["fontes_sugeridas"]), 1)

    def test_primeira_tentativa_vai_sem_contexto(self):
        r = self.perguntar(self.auth, self.perguntas[0], 1)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["trechos"], [])
        self.assertNotIn("TRECHOS", self.modelo.chamadas[-1]["system"])

    def test_segunda_tentativa_exige_a_primeira_e_uma_fonte(self):
        r = self.perguntar(self.auth, self.perguntas[0], 2)
        self.assertEqual(r.status_code, 400)
        self.assertIn("sem contexto", r.json()["detail"])

        self.perguntar(self.auth, self.perguntas[0], 1)
        r = self.perguntar(self.auth, self.perguntas[0], 2)
        self.assertEqual(r.status_code, 400)
        self.assertIn("fonte", r.json()["detail"])

    def test_segunda_tentativa_usa_as_fontes_e_mostra_documento_e_pagina(self):
        self.usar_fonte_sugerida()
        self.json("put", "/api/eu/orientacao", {"orientacao": "Responda em uma frase."}, **self.auth)
        self.perguntar(self.auth, self.perguntas[0], 1)

        r = self.perguntar(self.auth, self.perguntas[0], 2).json()
        self.assertFalse(r["nada_relevante"])
        self.assertEqual(r["trechos"][0]["documento"], "pantanal.txt")
        self.assertEqual(r["trechos"][0]["pagina"], 1)
        self.assertIn("tuiuiú", r["trechos"][0]["texto"])
        sistema = self.modelo.chamadas[-1]["system"]
        self.assertIn("Responda em uma frase.", sistema)
        self.assertIn("(pantanal.txt, p. 1)", sistema)
        self.assertEqual(r["instrucoes_enviadas"], sistema)

    def test_sem_trecho_relevante_nao_chama_o_modelo(self):
        r = self.json("post", "/api/eu/textos", {"titulo": "Pantanal", "texto": FONTE_PANTANAL}, **self.auth)
        self.assertEqual(r.status_code, 200, r.content)
        self.perguntar(self.auth, self.perguntas[2], 1)
        chamadas = len(self.modelo.chamadas)

        r = self.perguntar(self.auth, self.perguntas[2], 2).json()
        self.assertTrue(r["nada_relevante"])
        self.assertIn("Não encontrei", r["texto"])
        self.assertEqual(len(self.modelo.chamadas), chamadas)

    def test_repetir_a_pergunta_substitui_a_resposta(self):
        self.perguntar(self.auth, self.perguntas[0], 1)
        self.perguntar(self.auth, self.perguntas[0], 1)
        estado = self.json("get", "/api/eu", **self.auth).json()
        self.assertEqual(len(estado["respostas"]), 1)

    def test_avaliacao_libera_a_referencia_do_facilitador(self):
        self.usar_fonte_sugerida()
        avaliacao = {"primeira": "nao_sei", "segunda": "correta", "mais_confiavel": "segunda", "conferiu_fonte": True}

        r = self.json("put", f"/api/eu/avaliacoes/{self.perguntas[0]}", avaliacao, **self.auth)
        self.assertEqual(r.status_code, 400)  # ainda sem as duas respostas

        self.perguntar(self.auth, self.perguntas[0], 1)
        self.perguntar(self.auth, self.perguntas[0], 2)
        r = self.json("put", f"/api/eu/avaliacoes/{self.perguntas[0]}", avaliacao, **self.auth)
        self.assertEqual(r.status_code, 200, r.content)

        estado = self.json("get", "/api/eu", **self.auth).json()
        self.assertEqual(estado["referencias"], {str(self.perguntas[0]): "O tuiuiú."})

    def test_fonte_sugerida_nao_duplica_e_pode_ser_removida(self):
        a = self.usar_fonte_sugerida()
        b = self.usar_fonte_sugerida()
        self.assertEqual(a["id"], b["id"])
        self.assertEqual(a["copia_de_id"], self.estado["fontes_sugeridas"][0]["id"])
        self.assertGreater(a["trechos"], 0)

        self.assertEqual(self.json("delete", f"/api/eu/documentos/{a['id']}", **self.auth).status_code, 204)
        estado = self.json("get", "/api/eu", **self.auth).json()
        self.assertEqual(estado["documentos"], [])
        self.assertEqual(len(estado["fontes_sugeridas"]), 1)  # a da oficina continua para os outros


class Documentos(TesteDaApi):
    def setUp(self):
        super().setUp()
        oficina = self.criar_oficina(com_fonte=False)
        self.auth, _ = self.entrar(oficina["codigo"])

    def test_aceita_txt_em_ansi_do_windows(self):
        conteudo = "Função exponencial: f(x) = a elevado a x, com a > 0.".encode("cp1252")
        r = self.enviar("/api/eu/documentos", "anotacoes.txt", conteudo, **self.auth)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["origem"], "enviado")

    def test_recusa_formato_e_tamanho(self):
        r = self.enviar("/api/eu/documentos", "foto.png", b"\x89PNG", **self.auth)
        self.assertEqual(r.status_code, 400)
        r = self.enviar("/api/eu/documentos", "grande.txt", b"a" * (5 * 1024 * 1024 + 1), **self.auth)
        self.assertEqual(r.status_code, 400)
        self.assertIn("5 MB", r.json()["detail"])

    def test_pdf_corrompido_vira_mensagem_clara(self):
        r = self.enviar("/api/eu/documentos", "quebrado.pdf", b"%PDF-1.4 isto nao e um pdf", **self.auth)
        self.assertEqual(r.status_code, 400)
        self.assertIn("PDF", r.json()["detail"])

    def test_arquivo_sem_texto(self):
        r = self.enviar("/api/eu/documentos", "vazio.txt", b"   \n  ", **self.auth)
        self.assertEqual(r.status_code, 400)

    def test_nome_com_caminho_e_limpo(self):
        r = self.enviar("/api/eu/documentos", "..\\..\\segredo.txt", b"Texto suficiente para virar um trecho.", **self.auth)
        self.assertEqual(r.json()["nome"], "segredo.txt")

    def test_limite_de_fontes_na_base(self):
        for i in range(6):
            r = self.json("post", "/api/eu/textos", {"titulo": f"t{i}", "texto": "conteúdo de teste " * 3}, **self.auth)
            self.assertEqual(r.status_code, 200, r.content)
        r = self.json("post", "/api/eu/textos", {"titulo": "extra", "texto": "conteúdo de teste " * 3}, **self.auth)
        self.assertEqual(r.status_code, 400)
