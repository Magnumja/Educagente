from django.db import models
from django.utils import timezone

from oficina.models import Aluno


class Projeto(models.Model):
    """Assistente montado pelo aluno: provedor fixo, prompt de 5 campos e base de conhecimento própria."""

    aluno = models.ForeignKey(Aluno, on_delete=models.CASCADE, related_name="projetos")
    nome = models.CharField(max_length=80)
    descricao = models.TextField(null=True, blank=True)
    cenario_id = models.CharField(max_length=80, null=True, blank=True)
    model_provider = models.CharField(max_length=20)
    model_name = models.CharField(max_length=80)
    embedding_model = models.CharField(max_length=80)
    prompt_persona = models.TextField(blank=True, default="")
    prompt_context = models.TextField(blank=True, default="")
    prompt_instruction = models.TextField(blank=True, default="")
    prompt_restriction = models.TextField(blank=True, default="")
    prompt_output_format = models.TextField(blank=True, default="")
    chunk_max_chars = models.PositiveIntegerField(default=600)
    chunk_overlap_chars = models.PositiveIntegerField(default=80)
    top_k = models.PositiveIntegerField(default=4)
    similarity_threshold = models.FloatField(default=0.5)
    criado_em = models.DateTimeField(default=timezone.now)
    atualizado_em = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.nome} (#{self.pk})"


class ProjetoDocumento(models.Model):
    projeto = models.ForeignKey(Projeto, on_delete=models.CASCADE, related_name="documentos")
    nome_arquivo = models.CharField(max_length=255)
    paginas = models.PositiveIntegerField()
    chunk_count = models.PositiveIntegerField()
    status = models.CharField(max_length=30)  # "pronto" | "sem_texto_extraido"
    criado_em = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["id"]
        # Reenviar o mesmo arquivo substitui os trechos no índice; o registro acompanha.
        constraints = [models.UniqueConstraint(fields=["projeto", "nome_arquivo"], name="documento_unico_por_projeto")]

    def __str__(self):
        return self.nome_arquivo


class ProjetoResposta(models.Model):
    """Uma resposta em uma das três camadas: "puro", "prompt" ou "prompt_rag"."""

    projeto = models.ForeignKey(Projeto, on_delete=models.CASCADE, related_name="respostas")
    pergunta = models.TextField()
    modo = models.CharField(max_length=20)
    resposta = models.TextField()
    trechos = models.JSONField(default=list)
    tempo_segundos = models.FloatField()
    tokens_in = models.PositiveIntegerField()
    tokens_out = models.PositiveIntegerField()
    nada_relevante = models.BooleanField()
    criado_em = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.modo} — {self.pergunta[:60]}"
