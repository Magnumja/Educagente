"""Quem pode ver e mudar o quê."""
from oficinas.models import Documento, Participante, Resposta, Trecho
from tests.apoio import PERGUNTAS, TesteDaApi


class Acesso(TesteDaApi):
    def test_rotas_do_participante_exigem_token(self):
        self.assertEqual(self.json("get", "/api/eu").status_code, 401)
        self.assertEqual(self.json("get", "/api/eu", **{"X-Participante": "inventado"}).status_code, 401)

    def test_rotas_do_facilitador_exigem_login(self):
        self.assertEqual(self.json("get", "/api/facilitador/oficinas").status_code, 401)
        r = self.json("get", "/api/facilitador/oficinas", **{"Authorization": "Bearer falso"})
        self.assertEqual(r.status_code, 401)
        self.assertEqual(self.json("post", "/api/facilitador/entrar", {"senha": "errada"}).status_code, 400)

    def test_token_de_participante_nao_abre_o_painel(self):
        oficina = self.criar_oficina(com_fonte=False)
        auth, _ = self.entrar(oficina["codigo"])
        r = self.json("get", "/api/facilitador/oficinas", **{"Authorization": f"Bearer {auth['X-Participante']}"})
        self.assertEqual(r.status_code, 401)

    def test_token_nao_fica_guardado_em_texto_puro(self):
        oficina = self.criar_oficina(com_fonte=False)
        auth, _ = self.entrar(oficina["codigo"])
        self.assertFalse(Participante.objects.filter(token_hash=auth["X-Participante"]).exists())

    def test_um_participante_nao_mexe_na_base_do_outro(self):
        oficina = self.criar_oficina(com_fonte=False)
        ana, _ = self.entrar(oficina["codigo"], "ana")
        bia, _ = self.entrar(oficina["codigo"], "bia")
        doc = self.json("post", "/api/eu/textos", {"titulo": "da Ana", "texto": "texto da ana " * 5}, **ana).json()

        self.assertEqual(self.json("delete", f"/api/eu/documentos/{doc['id']}", **bia).status_code, 404)
        self.assertEqual(self.json("get", "/api/eu", **bia).json()["documentos"], [])
        self.assertEqual(len(self.json("get", "/api/eu", **ana).json()["documentos"]), 1)

    def test_pergunta_de_outra_oficina_e_recusada(self):
        a = self.criar_oficina(com_fonte=False)
        b = self.criar_oficina(com_fonte=False)
        auth, _ = self.entrar(a["codigo"])
        self.assertEqual(self.perguntar(auth, b["perguntas"][0]["id"], 1).status_code, 404)

    def test_fonte_sugerida_de_outra_oficina_e_recusada(self):
        a = self.criar_oficina(com_fonte=False)
        b = self.criar_oficina(com_fonte=True)
        auth, _ = self.entrar(a["codigo"])
        fonte_de_b = self.json("get", f"/api/facilitador/oficinas/{b['id']}", **self.como_facilitador()).json()["fontes"][0]
        self.assertEqual(self.json("post", f"/api/eu/fontes-sugeridas/{fonte_de_b['id']}", **auth).status_code, 404)

    def test_oficina_fechada_nao_aceita_novos(self):
        oficina = self.criar_oficina(com_fonte=False)
        self.json("patch", f"/api/facilitador/oficinas/{oficina['id']}", {"aberta": False}, **self.como_facilitador())
        r = self.json("post", f"/api/oficinas/{oficina['codigo']}/entrar", {"apelido": "x", "consentimento": True})
        self.assertEqual(r.status_code, 400)

    def test_entrar_exige_consentimento(self):
        oficina = self.criar_oficina(com_fonte=False)
        r = self.json("post", f"/api/oficinas/{oficina['codigo']}/entrar", {"apelido": "x", "consentimento": False})
        self.assertEqual(r.status_code, 400)

    def test_participante_apaga_os_proprios_dados(self):
        oficina = self.criar_oficina(com_fonte=False)
        auth, estado = self.entrar(oficina["codigo"])
        self.json("post", "/api/eu/textos", {"titulo": "t", "texto": "um texto qualquer " * 3}, **auth)
        self.perguntar(auth, estado["perguntas"][0]["id"], 1)

        self.assertEqual(self.json("delete", "/api/eu", **auth).status_code, 204)
        self.assertEqual(Participante.objects.count(), 0)
        self.assertEqual(Documento.objects.filter(participante__isnull=False).count(), 0)
        self.assertEqual(Trecho.objects.count(), 0)
        self.assertEqual(Resposta.objects.count(), 0)
        self.assertEqual(self.json("get", "/api/eu", **auth).status_code, 401)

    def test_limite_de_tentativas_no_login_do_facilitador(self):
        for _ in range(5):
            self.json("post", "/api/facilitador/entrar", {"senha": "errada"})
        self.assertEqual(self.json("post", "/api/facilitador/entrar", {"senha": "errada"}).status_code, 429)

    def test_sem_senha_configurada_o_painel_fica_desligado(self):
        with self.settings(FACILITADOR_SENHA=""):
            self.assertEqual(self.json("post", "/api/facilitador/entrar", {"senha": "x"}).status_code, 503)


class Facilitador(TesteDaApi):
    def test_oficina_precisa_de_tres_perguntas(self):
        dados = {"titulo": "Curta", "perguntas": PERGUNTAS[:2]}
        self.assertEqual(self.json("post", "/api/facilitador/oficinas", dados, **self.como_facilitador()).status_code, 422)

    def test_codigo_sem_caracteres_ambiguos(self):
        codigo = self.criar_oficina(com_fonte=False)["codigo"]
        self.assertEqual(len(codigo), 6)
        self.assertFalse(set(codigo) & set("01OIL"))

    def test_nao_muda_texto_de_pergunta_ja_respondida(self):
        oficina = self.criar_oficina(com_fonte=False)
        auth, estado = self.entrar(oficina["codigo"])
        self.perguntar(auth, estado["perguntas"][0]["id"], 1)
        novas = [dict(p) for p in PERGUNTAS]
        novas[0]["texto"] = "Outra pergunta qualquer?"
        r = self.json("patch", f"/api/facilitador/oficinas/{oficina['id']}", {"perguntas": novas}, **self.como_facilitador())
        self.assertEqual(r.status_code, 400)

    def test_relatorio_e_csv(self):
        oficina = self.criar_oficina()
        auth, estado = self.entrar(oficina["codigo"], "ana")
        self.json("post", f"/api/eu/fontes-sugeridas/{estado['fontes_sugeridas'][0]['id']}", **auth)
        pid = estado["perguntas"][0]["id"]
        self.perguntar(auth, pid, 1)
        self.perguntar(auth, pid, 2)
        avaliacao = {"primeira": "errada", "segunda": "correta", "mais_confiavel": "segunda"}
        self.json("put", f"/api/eu/avaliacoes/{pid}", avaliacao, **auth)

        facilitador = self.como_facilitador()
        detalhe = self.json("get", f"/api/facilitador/oficinas/{oficina['id']}", **facilitador).json()
        linha = detalhe["relatorio"][0]
        self.assertEqual(linha["apelido"], "ana")
        self.assertEqual(linha["perguntas"][0]["avaliacao"]["mais_confiavel"], "segunda")
        self.assertEqual(detalhe["perguntas"][0]["referencia"], "O tuiuiú.")

        r = self.client.get(f"/api/facilitador/oficinas/{oficina['id']}/export.csv", headers=facilitador)
        self.assertEqual(r.status_code, 200)
        csv = r.content.decode("utf-8-sig")
        self.assertIn("pantanal.txt p.1", csv)
        self.assertIn("ana", csv)
        self.assertEqual(len(csv.strip().splitlines()), 1 + 3)  # cabeçalho + 3 perguntas

    def test_csv_neutraliza_formulas(self):
        oficina = self.criar_oficina(com_fonte=False)
        self.entrar(oficina["codigo"], '=HYPERLINK("http://x","y")')
        r = self.client.get(f"/api/facilitador/oficinas/{oficina['id']}/export.csv", headers=self.como_facilitador())
        self.assertIn("'=HYPERLINK", r.content.decode("utf-8-sig"))

    def test_apagar_participante(self):
        oficina = self.criar_oficina(com_fonte=False)
        auth, estado = self.entrar(oficina["codigo"])
        r = self.json("delete", f"/api/facilitador/oficinas/{oficina['id']}/participantes/{estado['id']}", **self.como_facilitador())
        self.assertEqual(r.status_code, 204)
        self.assertEqual(self.json("get", "/api/eu", **auth).status_code, 401)
