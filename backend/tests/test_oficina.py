import os
from unittest import mock

from django.test import override_settings

from oficina.services import SYSTEM_LIVRE, SYSTEM_RAG_INSTRUCAO
from tests.apoio import DOCUMENTO_PANTANAL, PERGUNTA_COM_RESPOSTA, TesteDaApi


class SaudeTest(TesteDaApi):
    def test_sem_chave_no_servidor_indica_modo_demonstracao(self):
        corpo = self.client.get("/api/saude").json()
        self.assertEqual(corpo, {"ok": True, "provedor": "anthropic", "modelo": "modelo-teste", "llm_configurada": False})

    def test_com_chave_no_servidor_indica_llm_configurada(self):
        with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "chave-do-servidor"}):
            self.assertTrue(self.client.get("/api/saude").json()["llm_configurada"])

    @override_settings(MODEL_PROVIDER="openai")
    def test_openai_sem_chave_tambem_e_demonstracao(self):
        self.assertFalse(self.client.get("/api/saude").json()["llm_configurada"])


class AlunoTest(TesteDaApi):
    def test_exige_consentimento(self):
        resposta = self.post_json("/api/alunos", {"apelido": "a", "consentimento": False})
        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(resposta.json(), {"detail": "É preciso aceitar o termo de consentimento."})

    def test_aluno_inexistente(self):
        resposta = self.client.get("/api/alunos/999")
        self.assertEqual(resposta.status_code, 404)
        self.assertEqual(resposta.json()["detail"], "Aluno não encontrado")

    def test_validacao_devolve_lista_com_msg(self):
        aluno_id = self.criar_aluno()
        resposta = self.post_json(f"/api/alunos/{aluno_id}/perguntar", {"etapa": 4, "pergunta": "oi"})
        self.assertEqual(resposta.status_code, 422)
        self.assertIn("msg", resposta.json()["detail"][0])


class EtapasTest(TesteDaApi):
    def setUp(self):
        super().setUp()
        self.aluno_id = self.criar_aluno()
        self.url = f"/api/alunos/{self.aluno_id}"

    def enviar_documento(self, etapa=2, nome="pantanal.txt", conteudo=DOCUMENTO_PANTANAL):
        return self.enviar_arquivo(f"{self.url}/documentos", nome, conteudo, etapa=etapa)

    def test_etapa_1_responde_sem_rag(self):
        resposta = self.post_json(f"{self.url}/perguntar", {"etapa": 1, "pergunta": PERGUNTA_COM_RESPOSTA})
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["trechos"], [])
        self.assertEqual(self.llm.chamadas[0]["system"], SYSTEM_LIVRE)

    def test_etapa_2_exige_documento(self):
        resposta = self.post_json(f"{self.url}/perguntar", {"etapa": 2, "pergunta": PERGUNTA_COM_RESPOSTA})
        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(resposta.json()["detail"], "Envie o documento da etapa 2 antes de perguntar.")

    def test_upload_indexa_e_pergunta_recupera_trecho_com_pagina(self):
        enviado = self.enviar_documento()
        self.assertEqual(enviado.status_code, 200, enviado.content)
        self.assertEqual(enviado.json()["trechos"], 3)
        self.assertEqual(self.client.get(self.url).json()["trechos"], {"2": 3, "3": 0})

        corpo = self.post_json(f"{self.url}/perguntar", {"etapa": 2, "pergunta": PERGUNTA_COM_RESPOSTA}).json()
        self.assertFalse(corpo["nada_relevante"])
        self.assertEqual(corpo["trechos"][0]["documento"], "pantanal.txt")
        self.assertEqual(corpo["trechos"][0]["pagina"], 1)
        self.assertIn("tuiuiú", corpo["trechos"][0]["texto"])
        self.assertTrue(self.llm.chamadas[0]["system"].startswith(SYSTEM_RAG_INSTRUCAO))
        self.assertTrue((self.data_dir / "uploads" / f"aluno{self.aluno_id}_etapa2.txt").exists())

    def test_formato_e_etapa_invalidos(self):
        self.assertEqual(self.enviar_documento(nome="planilha.xlsx").json()["detail"], "Envie um arquivo PDF ou TXT.")
        self.assertEqual(self.enviar_documento(etapa=1).json()["detail"], "Etapa inválida (use 2 ou 3).")

    def test_arquivo_sem_texto(self):
        resposta = self.enviar_documento(conteudo="   ")
        self.assertEqual(resposta.status_code, 400)

    def test_falha_do_ollama_nao_deixa_arquivo_nem_indice(self):
        self.embed.side_effect = ConnectionError("Failed to connect to Ollama")
        resposta = self.enviar_documento()
        self.assertEqual(resposta.status_code, 502)
        self.assertIn("Ollama", resposta.json()["detail"])
        self.assertEqual(list((self.data_dir / "uploads").iterdir()), [])
        self.assertEqual(self.client.get(self.url).json()["trechos"], {"2": 0, "3": 0})

    def test_falha_do_provedor_vira_502(self):
        self.llm.erro = RuntimeError("provedor fora do ar")
        resposta = self.post_json(f"{self.url}/perguntar", {"etapa": 1, "pergunta": "oi"})
        self.assertEqual(resposta.status_code, 502)
        self.assertEqual(resposta.json()["detail"], "Falha ao chamar a LLM: provedor fora do ar")

    def test_modo_demonstracao_responde_com_os_trechos(self):
        self.llm.usar_real = True  # sem chave no servidor, build_adapter devolve o DemoAdapter
        self.enviar_documento()
        corpo = self.post_json(f"{self.url}/perguntar", {"etapa": 2, "pergunta": PERGUNTA_COM_RESPOSTA}).json()
        self.assertTrue(corpo["resposta"].startswith("[modo demonstração"))
        self.assertIn("tuiuiú", corpo["resposta"])

    def test_comparacao_respostas_e_painel_do_professor(self):
        self.enviar_documento()
        self.post_json(f"{self.url}/perguntar", {"etapa": 1, "pergunta": PERGUNTA_COM_RESPOSTA})
        self.post_json(f"{self.url}/perguntar", {"etapa": 2, "pergunta": PERGUNTA_COM_RESPOSTA.upper() + "  "})

        self.assertEqual(len(self.client.get(f"{self.url}/respostas").json()), 2)
        grupos = self.client.get(f"{self.url}/comparacao").json()
        self.assertEqual(len(grupos), 1)
        self.assertEqual(set(grupos[0]["etapas"]), {"1", "2"})

        todas = self.client.get("/api/professor/respostas").json()
        self.assertEqual(todas[0]["apelido"], "visitante")
        csv = self.client.get("/api/professor/export.csv")
        self.assertEqual(csv["Content-Disposition"], "attachment; filename=respostas-oficina.csv")
        linhas = csv.content.decode("utf-8").splitlines()
        self.assertTrue(linhas[0].startswith("﻿id,aluno_id,apelido"))
        self.assertEqual(len(linhas), 3)
