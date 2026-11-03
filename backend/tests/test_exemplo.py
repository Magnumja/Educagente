"""A oficina de exemplo (direitos na internet): o comando cria tudo e a fonte separa os prazos."""
from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings

from oficinas.models import Oficina, Trecho


@override_settings(EMBEDDING_PROVIDER="local")
class OficinaDeExemplo(TestCase):
    def setUp(self):
        call_command("criar_oficina_exemplo", stdout=StringIO())
        self.oficina = Oficina.objects.get()

    def test_cria_tres_perguntas_com_referencia(self):
        perguntas = list(self.oficina.perguntas.all())
        self.assertEqual(len(perguntas), 3)
        for pergunta in perguntas:
            self.assertIn("art.", pergunta.referencia)  # toda referência cita o artigo da lei

    def test_fonte_sugerida_vira_trechos(self):
        fonte = self.oficina.fontes.get()
        self.assertEqual(fonte.nome, "direitos-digitais.txt")
        self.assertGreater(fonte.trechos.count(), 1)

    def test_prazo_da_operadora_e_dos_aplicativos_ficam_em_trechos_separados(self):
        # Se os dois prazos caírem no mesmo trecho, a resposta com fontes pode trocar 1 ano por 6 meses.
        textos = Trecho.objects.filter(documento__oficina=self.oficina).values_list("texto", flat=True)
        um_ano = [t for t in textos if "1 (um) ano" in t]
        seis_meses = [t for t in textos if "6 (seis) meses" in t]
        self.assertTrue(um_ano and seis_meses)
        self.assertFalse(set(um_ano) & set(seis_meses))
