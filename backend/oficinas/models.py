"""Tabelas do banco (SQLite) e como se relacionam.

Uma oficina tem três perguntas fixas, fontes sugeridas pelo facilitador e participantes.
Cada participante faz as mesmas três perguntas duas vezes (sem contexto e com fontes) e
avalia a diferença entre as respostas. Nenhum dado pessoal além de um apelido.

  Oficina 1-N Pergunta            (as três perguntas, com a referência do facilitador)
  Oficina 1-N Documento           (fontes sugeridas: documento.oficina preenchido)
  Oficina 1-N Participante
  Participante 1-N Documento      (a base do participante: documento.participante preenchido)
  Documento 1-N Trecho            (pedaços de texto com o vetor do embedding)
  Participante + Pergunta -> Resposta (uma por tentativa) e Avaliacao (uma por pergunta)

Apagar uma oficina ou um participante apaga em cascata tudo o que depende dele.
"""
import secrets

import numpy as np
from django.db import models
from django.utils import timezone

# Sem 0/O, 1/I/L: o código é lido no projetor e digitado em PCs da escola.
ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


def gerar_codigo() -> str:
    return "".join(secrets.choice(ALFABETO_CODIGO) for _ in range(6))


class Oficina(models.Model):
    """Uma sessão da oficina; os participantes entram com o `codigo`."""

    titulo = models.CharField(max_length=120)
    codigo = models.CharField(max_length=6, unique=True, default=gerar_codigo)
    aberta = models.BooleanField(default=True, help_text="Fechada, ninguém novo entra.")
    criado_em = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-criado_em"]

    def __str__(self):
        return f"{self.titulo} ({self.codigo})"


class Pergunta(models.Model):
    oficina = models.ForeignKey(Oficina, on_delete=models.CASCADE, related_name="perguntas")
    ordem = models.PositiveSmallIntegerField()
    texto = models.CharField(max_length=300)
    referencia = models.TextField(
        blank=True, default="", help_text="Resposta conferida pelo facilitador, com a fonte. Aparece só depois da avaliação."
    )

    class Meta:
        ordering = ["ordem"]
        constraints = [models.UniqueConstraint(fields=["oficina", "ordem"], name="pergunta_ordem_unica")]

    def __str__(self):
        return f"{self.ordem}. {self.texto[:60]}"


class Participante(models.Model):
    """Quem entrou com um apelido. O token de acesso fica só no navegador; aqui, o hash dele."""

    oficina = models.ForeignKey(Oficina, on_delete=models.CASCADE, related_name="participantes")
    apelido = models.CharField(max_length=40)
    token_hash = models.CharField(max_length=64, unique=True)
    orientacao = models.TextField(blank=True, default="", help_text="Como o participante orientou a IA na etapa 2.")
    criado_em = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["criado_em"]

    def __str__(self):
        return f"{self.apelido} (#{self.pk})"


class Documento(models.Model):
    """Fonte de texto indexada. Pertence à oficina (sugerida) ou a um participante (a base dele)."""

    ENVIADO, COLADO, SUGERIDO = "enviado", "colado", "sugerido"

    oficina = models.ForeignKey(Oficina, null=True, blank=True, on_delete=models.CASCADE, related_name="fontes")
    participante = models.ForeignKey(
        Participante, null=True, blank=True, on_delete=models.CASCADE, related_name="documentos"
    )
    copia_de = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="copias")
    nome = models.CharField(max_length=160)
    origem = models.CharField(max_length=10, choices=[(ENVIADO, "Arquivo"), (COLADO, "Texto colado"), (SUGERIDO, "Sugerida")])
    paginas = models.PositiveIntegerField(default=1)
    criado_em = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["criado_em"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(oficina__isnull=False, participante__isnull=True)
                | models.Q(oficina__isnull=True, participante__isnull=False),
                name="documento_de_oficina_ou_participante",
            )
        ]

    def __str__(self):
        return self.nome


class Trecho(models.Model):
    """Um pedaço de uma fonte (chunk) e o vetor do seu embedding, usado na busca."""

    documento = models.ForeignKey(Documento, on_delete=models.CASCADE, related_name="trechos")
    pagina = models.PositiveIntegerField()
    texto = models.TextField()
    vetor = models.BinaryField()  # float32, gerado pelo embedding da plataforma

    class Meta:
        ordering = ["id"]

    def vetor_np(self) -> np.ndarray:
        """Converte os bytes gravados de volta no vetor numpy usado pela busca."""
        return np.frombuffer(self.vetor, dtype=np.float32)


class Resposta(models.Model):
    """O que a IA respondeu numa tentativa, com os trechos citados e as instruções enviadas."""

    SEM_CONTEXTO, COM_FONTES = 1, 2

    participante = models.ForeignKey(Participante, on_delete=models.CASCADE, related_name="respostas")
    pergunta = models.ForeignKey(Pergunta, on_delete=models.CASCADE, related_name="respostas")
    tentativa = models.PositiveSmallIntegerField(choices=[(SEM_CONTEXTO, "Sem contexto"), (COM_FONTES, "Com fontes")])
    texto = models.TextField()
    trechos = models.JSONField(default=list)
    nada_relevante = models.BooleanField(default=False)
    instrucoes_enviadas = models.TextField(blank=True, default="")
    tempo_segundos = models.FloatField(default=0)
    criado_em = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["pergunta__ordem", "tentativa"]
        constraints = [
            models.UniqueConstraint(fields=["participante", "pergunta", "tentativa"], name="uma_resposta_por_tentativa")
        ]


class Avaliacao(models.Model):
    """O que o participante concluiu ao comparar as duas respostas de uma pergunta."""

    VEREDITOS = [("correta", "Correta"), ("parcial", "Em parte"), ("errada", "Errada"), ("nao_sei", "Não sei dizer")]
    PREFERENCIAS = [("primeira", "Sem contexto"), ("segunda", "Com fontes"), ("nenhuma", "Nenhuma das duas")]

    participante = models.ForeignKey(Participante, on_delete=models.CASCADE, related_name="avaliacoes")
    pergunta = models.ForeignKey(Pergunta, on_delete=models.CASCADE, related_name="avaliacoes")
    primeira = models.CharField(max_length=10, choices=VEREDITOS)
    segunda = models.CharField(max_length=10, choices=VEREDITOS)
    mais_confiavel = models.CharField(max_length=10, choices=PREFERENCIAS)
    conferiu_fonte = models.BooleanField(default=False)
    observacao = models.TextField(blank=True, default="")
    atualizado_em = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["participante", "pergunta"], name="uma_avaliacao_por_pergunta")]
