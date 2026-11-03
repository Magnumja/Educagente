/** Aba "Roteiro da apresentação": texto fixo de apoio ao facilitador, sem chamadas à API. */

const ROTEIRO = [
  { tempo: '1–2 min', titulo: 'O problema', texto: 'Muita gente usa IA para estudar sem conferir fontes nem a correção das respostas.' },
  { tempo: '3–5 min', titulo: 'Demonstração', texto: 'As três etapas na plataforma: sem contexto, com fontes e a comparação lado a lado.' },
  { tempo: '2 min', titulo: 'O que é RAG', texto: 'A diferença entre dar contexto e recuperar trechos de documentos (página “Como a IA usa fontes”).' },
  { tempo: '1–2 min', titulo: 'NotebookLM', texto: 'O mesmo raciocínio aplicado ao estudo, e os cuidados de verificação que continuam valendo.' },
]

export function Roteiro() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <section aria-labelledby="roteiro" className="space-y-3">
        <h2 id="roteiro" className="text-xl font-semibold">
          Apresentação de 10 minutos
        </h2>
        <ol className="divide-y rounded-caixa border bg-superficie">
          {ROTEIRO.map((r) => (
            <li key={r.titulo} className="grid grid-cols-[5.5rem_1fr] gap-4 p-4">
              <span className="font-mono text-sm font-semibold text-tinta-2">{r.tempo}</span>
              <span>
                <span className="block font-semibold">{r.titulo}</span>
                <span className="text-tinta-2">{r.texto}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="cuidados" className="space-y-3">
        <h2 id="cuidados" className="text-xl font-semibold">
          Antes de começar
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-tinta-2">
          <li>Teste as três perguntas com o modelo configurado: não dá para supor que a etapa 1 sempre erra nem que a 3 sempre acerta.</li>
          <li>Tenha a resposta de referência com a fonte para cada pergunta.</li>
          <li>Só use estatísticas na fala se tiver a fonte (por exemplo, percentuais de uso de IA por jovens).</li>
          <li>Se a IA responder algo inesperado, use isso na discussão: é exatamente o ponto da oficina.</li>
          <li>Feche a oficina para novos participantes quando a turma inteira tiver entrado.</li>
        </ul>
      </section>
    </div>
  )
}
