from django.db import models
from django.utils import timezone


class Aluno(models.Model):
    """Participante anônimo: só apelido e turma (LGPD)."""

    apelido = models.CharField(max_length=40)
    turma = models.CharField(max_length=40, null=True, blank=True)
    consentimento = models.BooleanField()
    criado_em = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.apelido} (#{self.pk})"


class Resposta(models.Model):
    """Resposta de uma etapa da Oficina RAG: 1 = sem RAG, 2 = documento errado, 3 = documento real."""

    aluno = models.ForeignKey(Aluno, on_delete=models.CASCADE, related_name="respostas")
    etapa = models.PositiveSmallIntegerField()
    pergunta = models.TextField()
    resposta = models.TextField()
    trechos = models.JSONField(default=list)
    criado_em = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"Etapa {self.etapa} — {self.pergunta[:60]}"
