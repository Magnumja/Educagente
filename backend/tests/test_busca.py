"""A busca por dentro (esquema da etapa 3): precisa bater com o que `perguntar` faz de verdade."""
from tests.apoio import TesteDaApi


class BuscaDaPergunta(TesteDaApi):
    def setUp(self):
        super().setUp()
        self.oficina = self.criar_oficina()
        self.auth, self.estado = self.entrar(self.oficina["codigo"])
        self.pergunta = self.estado["perguntas"][0]["id"]

    def url(self, pergunta=None):
        return f"/api/eu/perguntas/{pergunta or self.pergunta}/busca"

    def usar_fonte(self, auth=None, estado=None):
        fonte = (estado or self.estado)["fontes_sugeridas"][0]["id"]
        return self.json("post", f"/api/eu/fontes-sugeridas/{fonte}", **(auth or self.auth))

    def test_sem_fonte_nao_ha_trechos(self):
        corpo = self.json("get", self.url(), **self.auth).json()
        self.assertEqual(corpo["total"], 0)
        self.assertEqual(corpo["trechos"], [])
        self.assertFalse(corpo["mudou_desde_a_resposta"])

    def test_usados_sao_os_mesmos_da_resposta_de_verdade(self):
        self.usar_fonte()
        self.perguntar(self.auth, self.pergunta, 1)
        resposta = self.perguntar(self.auth, self.pergunta, 2).json()

        corpo = self.json("get", self.url(), **self.auth).json()
        usados = [t for t in corpo["trechos"] if t["situacao"] == "usado"]
        self.assertEqual([t["texto"] for t in usados], [t["texto"] for t in resposta["trechos"]])
        self.assertEqual([t["similaridade"] for t in usados], [t["similaridade"] for t in resposta["trechos"]])
        self.assertFalse(corpo["mudou_desde_a_resposta"])

    def test_vem_do_mais_parecido_para_o_menos_e_explica_quem_ficou_de_fora(self):
        self.usar_fonte()
        corpo = self.json("get", self.url(), **self.auth).json()
        notas = [t["similaridade"] for t in corpo["trechos"]]
        self.assertEqual(notas, sorted(notas, reverse=True))
        self.assertEqual(corpo["total"], len(corpo["trechos"]))
        for t in corpo["trechos"]:
            if t["similaridade"] < corpo["limiar"]:
                self.assertEqual(t["situacao"], "abaixo_do_minimo")
        self.assertLessEqual(sum(t["situacao"] == "usado" for t in corpo["trechos"]), corpo["top_k"])

    def test_passou_do_minimo_mas_nao_entrou_fica_como_fora_do_limite(self):
        self.usar_fonte()
        with self.settings(TOP_K=1, SIMILARITY_THRESHOLD=-1.0):
            corpo = self.json("get", self.url(), **self.auth).json()
        situacoes = [t["situacao"] for t in corpo["trechos"]]
        self.assertEqual(situacoes[0], "usado")
        self.assertTrue(all(s == "fora_do_limite" for s in situacoes[1:]))

    def test_avisa_quando_a_base_mudou_depois_da_resposta(self):
        doc = self.usar_fonte().json()
        self.perguntar(self.auth, self.pergunta, 1)
        self.perguntar(self.auth, self.pergunta, 2)
        self.json("delete", f"/api/eu/documentos/{doc['id']}", **self.auth)
        self.assertTrue(self.json("get", self.url(), **self.auth).json()["mudou_desde_a_resposta"])

    def test_nao_chama_o_modelo_de_chat_nem_grava_resposta(self):
        self.usar_fonte()
        self.json("get", self.url(), **self.auth)
        self.assertEqual(self.modelo.chamadas, [])
        estado = self.json("get", "/api/eu", **self.auth).json()
        self.assertEqual(estado["respostas"], [])

    def test_cada_um_so_ve_a_propria_base(self):
        self.usar_fonte()
        outro_auth, _ = self.entrar(self.oficina["codigo"], "bia")
        corpo = self.json("get", self.url(), **outro_auth).json()
        self.assertEqual(corpo["trechos"], [])

    def test_pergunta_de_outra_oficina_da_404(self):
        outra = self.criar_oficina()
        _, estado_outro = self.entrar(outra["codigo"], "caio")
        r = self.json("get", self.url(estado_outro["perguntas"][0]["id"]), **self.auth)
        self.assertEqual(r.status_code, 404)

    def test_sem_token_e_recusado(self):
        self.assertEqual(self.json("get", self.url()).status_code, 401)
