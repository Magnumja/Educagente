"""Núcleo RAG (Retrieval-Augmented Generation), sem dependência do Django.

Cada módulo é uma etapa do caminho de um documento até a resposta da IA:

  ingestion.py   arquivo (bytes)        -> páginas de texto
  chunking.py    texto de uma página    -> trechos (chunks)
  embeddings.py  trechos ou pergunta    -> vetores numéricos
  busca.py       vetor da pergunta      -> trechos mais parecidos (acima do limiar)
  prompts.py     trechos escolhidos     -> instruções (prompt de sistema) para a IA
  llm.py         instruções + pergunta  -> resposta do modelo de chat

Quem junta as etapas e grava no banco é `oficinas/services.py`.
"""
