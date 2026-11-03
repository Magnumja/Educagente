import { useState } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import { Aviso, Botao, Caixa } from '@/components/ui'
import { api } from '@/lib/api'
import { usePreferencias } from '@/lib/preferencias'
import { navegar } from '@/lib/rota'
import { CabecalhoEtapa, type PropsEtapa } from '../Oficina'

const PASSOS = [
  {
    titulo: 'Junte o material de referência',
    texto: 'Comece pelo que o professor passou: apostila, slides, capítulo do livro. É a sua fonte principal.',
  },
  {
    titulo: 'Procure mais uma fonte para conferir',
    texto:
      'Um site oficial, um livro didático ou um vídeo de uma instituição conhecida. Duas fontes que concordam valem mais que uma.',
  },
  {
    titulo: 'Crie um caderno no NotebookLM e adicione as fontes',
    texto:
      'Entre com uma conta Google, crie um caderno novo e envie os PDFs, links ou textos que você reuniu. Contas de escola ou de menores de idade podem ter regras próprias: confira antes.',
  },
  {
    titulo: 'Pergunte com base nas fontes',
    texto: 'Peça explicações, exemplos e exercícios. Diga o que você já sabe e onde está a sua dúvida.',
  },
  {
    titulo: 'Clique nas citações e confira',
    texto: 'O NotebookLM mostra de onde tirou cada parte. Abra a citação e veja se o trecho diz mesmo aquilo.',
  },
  {
    titulo: 'Desconfie do que não tem citação',
    texto: 'Se a resposta não aponta para uma fonte, trate como palpite. Volte ao material ou pergunte ao professor.',
  },
]

const CHAVE = 'educagente:notebooklm'

function lerFeitos(): number[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? '[]')
  } catch {
    return []
  }
}

export function NotebookLM({ estado }: PropsEtapa) {
  const { prefs } = usePreferencias()
  const [feitos, setFeitos] = useState<number[]>(lerFeitos)
  const [confirmando, setConfirmando] = useState(false)
  const [apagando, setApagando] = useState(false)
  const [erro, setErro] = useState('')

  function alternar(i: number) {
    const novo = feitos.includes(i) ? feitos.filter((f) => f !== i) : [...feitos, i]
    setFeitos(novo)
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novo))
    } catch {
      /* ignora */
    }
  }

  async function apagar() {
    setApagando(true)
    try {
      await api.apagarMeusDados()
      navegar('/')
    } catch (e) {
      setErro((e as Error).message)
      setApagando(false)
    }
  }

  return (
    <div>
      <CabecalhoEtapa n={5}>
        <p>
          O que você fez aqui é o mesmo raciocínio de um bom estudo com IA: escolher fontes confiáveis, perguntar com base nelas
          e conferir. O <strong className="text-tinta">NotebookLM</strong>, do Google, responde usando os documentos que você
          adiciona e mostra as citações.
        </p>
      </CabecalhoEtapa>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <section aria-labelledby="passo-a-passo" className="space-y-4">
          <h2 id="passo-a-passo" className="text-xl font-semibold">
            Passo a passo
          </h2>
          <ol className="space-y-3">
            {PASSOS.map((p, i) => (
              <li key={p.titulo}>
                <label className="flex gap-4 rounded-caixa border bg-superficie p-4 transition-colors has-[:checked]:bg-ok-fundo">
                  <input
                    type="checkbox"
                    checked={feitos.includes(i)}
                    onChange={() => alternar(i)}
                    className="mt-1 size-5 shrink-0 accent-[var(--ok)]"
                  />
                  <span className="space-y-1">
                    <span className="block font-semibold">
                      {i + 1}. {p.titulo}
                    </span>
                    <span className="block text-tinta-2">{p.texto}</span>
                  </span>
                </label>
              </li>
            ))}
          </ol>
          <a
            href="https://notebooklm.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-p border-[1.5px] border-transparent bg-acao px-4 font-semibold text-acao-tinta hover:bg-acao-hover"
          >
            Abrir o NotebookLM <ExternalLink className="size-4" aria-hidden />
            <span className="sr-only">(abre em outra aba)</span>
          </a>
        </section>

        <div className="space-y-6">
          <Caixa className="space-y-3">
            <h2 className="text-lg font-semibold">Exemplo: estudar função exponencial</h2>
            <ol className="list-decimal space-y-1.5 pl-5 text-tinta-2">
              <li>Adicione o material que o professor enviou sobre função exponencial.</li>
              <li>Adicione um capítulo de livro didático sobre o mesmo tema, para conferir.</li>
              <li>
                Pergunte: “Com base nas fontes, explique a diferença entre crescimento linear e exponencial, com um exemplo.”
              </li>
              <li>Peça: “Crie três exercícios no estilo do material do professor, com as respostas separadas.”</li>
              <li>Abra as citações. Os exemplos batem com o material?</li>
            </ol>
          </Caixa>

          <Caixa className="space-y-3 bg-superficie-2">
            <h2 className="text-lg font-semibold">Cuidados que continuam valendo</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-tinta-2">
              <li>Citação não é garantia: a IA pode resumir errado um trecho certo.</li>
              <li>Fonte ruim gera resposta ruim. Escolha bem o que entra no caderno.</li>
              <li>Não envie documentos com dados pessoais seus ou de outras pessoas.</li>
              <li>
                Usar outro chatbot para achar materiais pode ajudar, mas confira cada link antes de usar como fonte.
              </li>
            </ul>
            {prefs.detalhe === 'tecnico' && (
              <p className="text-sm text-tinta-2">
                O NotebookLM também trabalha com recuperação de trechos das fontes, mas os detalhes internos dele não são
                públicos; o que vimos nesta oficina é uma versão simplificada e aberta do mesmo princípio.
              </p>
            )}
          </Caixa>
        </div>
      </div>

      <Caixa className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">Terminou, {estado.apelido}?</h2>
        <p className="max-w-[68ch] text-tinta-2">
          Suas respostas e avaliações ajudam o projeto a entender como as pessoas avaliam a IA. Se preferir, você pode apagar
          tudo agora: apelido, fontes, respostas e avaliações.
        </p>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {confirmando ? (
          <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Confirmar exclusão">
            <p className="font-semibold">Apagar tudo? Isso não pode ser desfeito.</p>
            <Botao variante="perigo" onClick={apagar} carregando={apagando}>
              <Trash2 className="size-4" aria-hidden /> Sim, apagar meus dados
            </Botao>
            <Botao variante="discreto" onClick={() => setConfirmando(false)} disabled={apagando}>
              Cancelar
            </Botao>
          </div>
        ) : (
          <Botao variante="perigo" onClick={() => setConfirmando(true)}>
            <Trash2 className="size-4" aria-hidden /> Apagar meus dados
          </Botao>
        )}
      </Caixa>
    </div>
  )
}
