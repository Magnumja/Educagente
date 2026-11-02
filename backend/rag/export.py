"""Exporta um projeto como zip, por allowlist explícita — nunca "pasta inteira menos
X", para não vazar embeddings ou arquivos de sessão por acidente.

Allowlist: config.json (sanitizado), prompt_final_exemplo.txt, documentos originais
enviados pelo aluno, README.md gerado.
"""
from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path


def build_export_zip(config_sanitizado: dict, prompt_final_exemplo: str, uploads_dir: Path, nome_projeto: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("config.json", json.dumps(config_sanitizado, ensure_ascii=False, indent=2))
        zf.writestr("prompt_final_exemplo.txt", prompt_final_exemplo or "(nenhuma pergunta feita ainda)")
        if uploads_dir.exists():
            for arquivo in sorted(uploads_dir.iterdir()):
                if arquivo.is_file():
                    zf.write(arquivo, arcname=f"documentos/{arquivo.name}")
        zf.writestr(
            "README.md",
            f"# {nome_projeto}\n\nExportado do Educagente. Contém a configuração do "
            f"projeto, um exemplo do prompt final montado e os documentos originais "
            f"enviados à base de conhecimento.\n",
        )
    return buf.getvalue()
