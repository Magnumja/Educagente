"""Cria uma oficina pronta para ensaiar: três perguntas sobre Napoleão Bonaparte, com as
respostas de referência e uma fonte sugerida com os fatos conferidos.

Uso: python manage.py criar_oficina_exemplo
"""
from pathlib import Path

from django.core.management.base import BaseCommand

from oficinas import services

FONTE = Path(__file__).resolve().parents[2] / "exemplos" / "napoleao.txt"

PERGUNTAS = [
    {
        "texto": "Napoleão Bonaparte chegou a visitar o Brasil?",
        "referencia": "Não. Napoleão nunca esteve no Brasil; a ligação é indireta, pela invasão francesa a Portugal "
        "em 1807 (fonte: napoleao.txt, parágrafo 4).",
    },
    {
        "texto": "Por que a família real portuguesa veio para o Brasil em 1808?",
        "referencia": "Porque tropas de Napoleão, comandadas por Junot, invadiram Portugal em novembro de 1807. A corte "
        "fugiu escoltada pelos ingleses e chegou a Salvador em janeiro e ao Rio em março de 1808 (napoleao.txt, parágrafo 5).",
    },
    {
        "texto": "Napoleão Bonaparte era muito baixo para a época dele?",
        "referencia": "Não. Media cerca de 1,69 m, altura comum na França da época; o mito vem da confusão entre "
        "polegadas francesas e inglesas e das caricaturas inglesas (napoleao.txt, último parágrafo).",
    },
]


class Command(BaseCommand):
    help = "Cria uma oficina de exemplo (Napoleão Bonaparte) com perguntas, referências e uma fonte sugerida."

    def handle(self, *args, **options):
        oficina = services.criar_oficina("Napoleão e o Brasil (exemplo)", PERGUNTAS)
        services.adicionar_fonte_da_oficina(oficina, FONTE.name, FONTE.read_bytes())
        self.stdout.write(self.style.SUCCESS(f"Oficina criada. Código para os participantes: {oficina.codigo}"))
