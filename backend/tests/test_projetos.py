import io
import zipfile

from projetos.models import ProjetoDocumento, ProjetoResposta
from tests.apoio import DOCUMENTO_PANTANAL, PERGUNTA_COM_RESPOSTA, PERGUNTA_SEM_RESPOSTA, TesteDaApi

CHAVE_DO_ALUNO = "sk-chave-de-teste-do-aluno"


class ProjetoTest(TesteDaApi):
    def setUp(self):
        super().setUp()
        self.aluno_id = self.criar_aluno()
        self.base = f"/api/alunos/{self.aluno_id}/projetos"

    def criar_projeto(self, provedor="ollama", nome="Guia do Pantanal", base=None) -> dict:
        resposta = self.post_json(base or self.base, {"nome": nome, "model_provider": provedor})
        self.assertEqual(resposta.status_code, 200, resposta.content)
        return resposta.json()

    def enviar(self, projeto_id, nome="pantanal.txt", conteudo=DOCUMENTO_PANTANAL):
        return self.enviar_arquivo(f"{self.base}/{projeto_id}/documentos", nome, conteudo)

    def test_criar_listar_e_atualizar(self):
        projeto = self.criar_projeto()
        self.assertEqual(projeto["aluno_id"], self.aluno_id)
        self.assertEqual(projeto["model_name"], "llama3.2:1b")
        self.assertEqual(projeto["top_k"], 4)

        atualizado = self.client.patch(
            f"{self.base}/{projeto['id']}", {"prompt_persona": "Você é um guia.", "top_k": 2}, content_type="application/json"
        ).json()
        self.assertEqual((atualizado["prompt_persona"], atualizado["top_k"]), ("Você é um guia.", 2))
        invalido = self.client.patch(f"{self.base}/{projeto['id']}", {"top_k": 0}, content_type="application/json")
        self.assertEqual(invalido.status_code, 422)
        self.assertEqual(len(self.client.get(self.base).json()), 1)

    def test_provedor_invalido_e_limite_de_projetos(self):
        self.assertEqual(self.post_json(self.base, {"nome": "x", "model_provider": "gemini"}).status_code, 400)
        for numero in range(3):
            self.criar_projeto(nome=f"Projeto {numero}")
        resposta = self.post_json(self.base, {"nome": "Quarto"})
        self.assertEqual(resposta.json()["detail"], "Limite de 3 projetos por aluno atingido.")

    def test_upload_usa_so_o_nome_do_arquivo_e_reenvio_nao_duplica(self):
        projeto_id = self.criar_projeto()["id"]
        documento = self.enviar(projeto_id, nome="../../fora.txt").json()
        self.assertEqual((documento["nome_arquivo"], documento["status"], documento["chunk_count"]), ("fora.txt", "pronto", 3))
        self.assertTrue((self.data_dir / "projetos" / str(projeto_id) / "uploads" / "fora.txt").exists())
        self.assertFalse((self.data_dir / "fora.txt").exists())

        self.enviar(projeto_id, nome="fora.txt", conteudo="Só um parágrafo agora.")
        detalhe = self.client.get(f"{self.base}/{projeto_id}").json()
        self.assertEqual([(d["nome_arquivo"], d["chunk_count"]) for d in detalhe["documentos"]], [("fora.txt", 1)])
        indice = self.data_dir / "projetos" / str(projeto_id) / "index.jsonl"
        self.assertEqual(len(indice.read_text(encoding="utf-8").splitlines()), 1)

    def test_arquivo_sem_texto_fica_registrado_sem_trechos(self):
        projeto_id = self.criar_projeto()["id"]
        documento = self.enviar(projeto_id, conteudo="  ").json()
        self.assertEqual((documento["status"], documento["chunk_count"]), ("sem_texto_extraido", 0))

    def test_isolamento_entre_alunos_e_entre_projetos(self):
        projeto_com_doc = self.criar_projeto()["id"]
        projeto_vazio = self.criar_projeto(nome="Outro")["id"]
        self.enviar(projeto_com_doc)

        outro_aluno = f"/api/alunos/{self.criar_aluno()}/projetos"
        for caminho in ("", "/comparacoes", "/exportar"):
            self.assertEqual(self.client.get(f"{outro_aluno}/{projeto_com_doc}{caminho}").status_code, 404)
        self.assertEqual(self.enviar_arquivo(f"{outro_aluno}/{projeto_com_doc}/documentos", "x.txt", "x").status_code, 404)

        corpo = self.post_json(f"{self.base}/{projeto_vazio}/perguntar", {"pergunta": PERGUNTA_COM_RESPOSTA}).json()
        self.assertEqual(corpo["trechos"], [])
        self.assertTrue(corpo["nada_relevante"])

    def test_sem_evidencia_admite_nada_relevante(self):
        projeto_id = self.criar_projeto()["id"]
        self.enviar(projeto_id)
        corpo = self.post_json(f"{self.base}/{projeto_id}/perguntar", {"pergunta": PERGUNTA_SEM_RESPOSTA}).json()
        self.assertTrue(corpo["nada_relevante"])
        self.assertIn("Nenhum trecho relevante", self.llm.chamadas[-1]["system"])

    def test_chave_do_aluno_vai_so_ao_provedor(self):
        projeto_id = self.criar_projeto(provedor="anthropic")["id"]
        self.enviar(projeto_id)
        url = f"{self.base}/{projeto_id}/perguntar"

        sem_chave = self.post_json(url, {"pergunta": PERGUNTA_COM_RESPOSTA})
        self.assertEqual(sem_chave.status_code, 400)
        self.assertIn("Minha IA", sem_chave.json()["detail"])
        self.assertEqual(self.llm.chamadas, [])

        resposta = self.post_json(url, {"pergunta": PERGUNTA_COM_RESPOSTA}, **{"X-Provider-Api-Key": CHAVE_DO_ALUNO})
        self.assertEqual(resposta.status_code, 200, resposta.content)
        self.assertEqual(self.llm.chamadas[0]["api_key"], CHAVE_DO_ALUNO)
        self.assertNotIn(CHAVE_DO_ALUNO, str(list(ProjetoResposta.objects.values())))
        exportado = self.client.get(f"{self.base}/{projeto_id}/exportar").content
        with zipfile.ZipFile(io.BytesIO(exportado)) as arquivo_zip:
            conteudo = b"".join(arquivo_zip.read(nome) for nome in arquivo_zip.namelist())
        self.assertNotIn(CHAVE_DO_ALUNO.encode(), conteudo)

    def test_comparar_tres_camadas(self):
        projeto_id = self.criar_projeto()["id"]
        self.client.patch(f"{self.base}/{projeto_id}", {"prompt_persona": "Você é um guia."}, content_type="application/json")
        self.enviar(projeto_id)

        corpo = self.post_json(f"{self.base}/{projeto_id}/comparar", {"pergunta": PERGUNTA_COM_RESPOSTA}).json()
        self.assertEqual(set(corpo["camadas"]), {"puro", "prompt", "prompt_rag"})
        prompts = [chamada["system"] for chamada in self.llm.chamadas]
        self.assertNotIn("Você é um guia.", prompts[0])
        self.assertEqual(prompts[1], "Você é um guia.")
        self.assertIn("Trechos da base de conhecimento", prompts[2])
        self.assertEqual(corpo["camadas"]["prompt_rag"]["trechos"][0]["pagina"], 1)

        grupos = self.client.get(f"{self.base}/{projeto_id}/comparacoes").json()
        self.assertEqual([(g["pergunta"], len(g["camadas"])) for g in grupos], [(PERGUNTA_COM_RESPOSTA, 3)])

    def test_falha_do_provedor_vira_502(self):
        projeto_id = self.criar_projeto()["id"]
        self.llm.erro = TimeoutError("tempo esgotado")
        resposta = self.post_json(f"{self.base}/{projeto_id}/perguntar", {"pergunta": "oi"})
        self.assertEqual(resposta.status_code, 502)
        self.assertEqual(ProjetoResposta.objects.count(), 0)

    def test_exportar_zip_com_allowlist(self):
        projeto = self.criar_projeto(nome="Onça Pintada")
        self.enviar(projeto["id"])
        resposta = self.client.get(f"{self.base}/{projeto['id']}/exportar")
        self.assertEqual(resposta["Content-Type"], "application/zip")
        self.assertIn("attachment", resposta["Content-Disposition"])
        with zipfile.ZipFile(io.BytesIO(resposta.content)) as arquivo_zip:
            nomes = sorted(arquivo_zip.namelist())
        self.assertEqual(nomes, ["README.md", "config.json", "documentos/pantanal.txt", "prompt_final_exemplo.txt"])
        self.assertEqual(ProjetoDocumento.objects.count(), 1)
