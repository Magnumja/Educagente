"""Cria uma oficina pronta para ensaiar: três perguntas sobre direitos na internet (LGPD e Marco
Civil da Internet), com as respostas de referência e uma fonte sugerida com os trechos das leis.

O tema foi escolhido porque um modelo pequeno, sem contexto, erra ou deixa de fora o detalhe que
importa (prazos e valores), e a fonte traz o texto exato da lei.

Uso: python manage.py criar_oficina_exemplo
"""
from pathlib import Path

from django.core.management.base import BaseCommand

from oficinas import services

FONTE = Path(__file__).resolve().parents[2] / "exemplos" / "direitos-digitais.txt"

PERGUNTAS = [
    {
        "texto": "Pelo Marco Civil da Internet, por quanto tempo a operadora de internet precisa guardar os registros "
        "de conexão do cliente?",
        "referencia": "Por 1 ano, sob sigilo (Marco Civil da Internet, art. 13). O prazo de 6 meses vale para "
        "aplicativos e sites, que guardam os registros de acesso (art. 15). Fonte: direitos-digitais.txt.",
    },
    {
        "texto": "Pela LGPD, se eu pedir a uma empresa a lista completa dos meus dados pessoais, quantos dias ela tem "
        "para responder?",
        "referencia": "Até 15 dias, contados da data do pedido (LGPD, art. 19, II); a lei não fala em dias úteis. "
        "No formato simplificado, a resposta é imediata (art. 19, I). Fonte: direitos-digitais.txt.",
    },
    {
        "texto": "Qual é o valor máximo da multa que a LGPD permite aplicar a uma empresa por infração?",
        "referencia": "Até 2% do faturamento da empresa no Brasil no último exercício, sem os tributos, limitada a "
        "R$ 50 milhões por infração (LGPD, art. 52, II). Fonte: direitos-digitais.txt.",
    },
]


class Command(BaseCommand):
    help = "Cria uma oficina de exemplo (direitos na internet: LGPD e Marco Civil) com perguntas, referências e uma fonte sugerida."

    def handle(self, *args, **options):
        oficina = services.criar_oficina("Seus direitos na internet (exemplo)", PERGUNTAS)
        services.adicionar_fonte_da_oficina(oficina, FONTE.name, FONTE.read_bytes())
        self.stdout.write(self.style.SUCCESS(f"Oficina criada. Código para os participantes: {oficina.codigo}"))
