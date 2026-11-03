/**
 * Etapa 2: o participante adiciona uma fonte dele, enviando um PDF/TXT (POST /eu/documentos)
 * ou colando um texto (POST /eu/textos). O servidor lê o texto e corta em trechos.
 */
import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { FileUp, ShieldAlert } from 'lucide-react'
import { entradaCls } from '@/components/classes'
import { Botao, Campo, Segmentado } from '@/components/ui'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Executar } from './executar'

type Modo = 'arquivo' | 'texto'

export function AdicionarPropria({ ocupado, executar, temSugeridas }: { ocupado: string | null; executar: Executar; temSugeridas: boolean }) {
  const [modo, setModo] = useState<Modo>('arquivo')
  return (
    <div className="space-y-4">
      {temSugeridas && (
        <div className="flex items-center gap-3 text-sm text-tinta-2" aria-hidden>
          <span className="h-px flex-1 bg-linha" /> ou adicione uma sua <span className="h-px flex-1 bg-linha" />
        </div>
      )}
      <Segmentado<Modo>
        legenda="Como você quer adicionar?"
        compacto
        valor={modo}
        aoMudar={setModo}
        opcoes={[
          { valor: 'arquivo', rotulo: 'Enviar arquivo PDF ou TXT' },
          { valor: 'texto', rotulo: 'Colar um texto' },
        ]}
      />
      {/* key={modo}: ao trocar de modo o formulário remonta e entra com a animação .surgir. */}
      <div key={modo} className="surgir">
        {modo === 'arquivo' ? (
          <EnviarArquivo
            ocupado={ocupado === 'arquivo'}
            aoEnviar={(arquivo) => executar('arquivo', () => api.enviarArquivo(arquivo), `“${arquivo.name}” entrou na sua base.`)}
          />
        ) : (
          <ColarTexto
            ocupado={ocupado === 'texto'}
            aoEnviar={(titulo, texto) => executar('texto', () => api.colarTexto(titulo, texto), `“${titulo}” entrou na sua base.`)}
          />
        )}
      </div>
      <p className="flex items-start gap-2 text-sm text-tinta-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-alerta" aria-hidden />
        <span>
          <strong className="text-tinta">Não envie dados pessoais</strong> (nome completo, CPF, endereço, fotos de pessoas).
        </span>
      </p>
    </div>
  )
}

/** Área de soltar arquivo; também é um <label> do input escondido, então clicar abre o seletor. */
function EnviarArquivo({ ocupado, aoEnviar }: { ocupado: boolean; aoEnviar: (f: File) => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  function soltar(e: DragEvent) {
    e.preventDefault()
    setArrastando(false)
    const f = e.dataTransfer.files?.[0]
    if (f) setArquivo(f)
  }

  function enviar() {
    if (!arquivo) return
    aoEnviar(arquivo)
    // Limpa a escolha para o mesmo arquivo poder ser escolhido de novo, se precisar.
    setArquivo(null)
    if (entrada.current) entrada.current.value = ''
  }

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault() // sem isso o navegador abre o arquivo em vez de soltar aqui
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={soltar}
        className={cn(
          'flex min-h-36 flex-col items-center justify-center gap-2 rounded-caixa border-2 border-dashed p-6 text-center transition-[background-color,border-color,transform] duration-200',
          'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-foco',
          arrastando ? 'scale-[1.01] border-acao bg-acao-suave' : 'border-linha-forte bg-superficie-2/50 hover:border-acao/60 hover:bg-acao-suave/50',
        )}
      >
        <span className="grid size-11 place-items-center rounded-full bg-superficie text-acao shadow-caixa" aria-hidden>
          <FileUp className="size-5" />
        </span>
        <span className="font-semibold">{arquivo ? arquivo.name : 'Escolher um PDF ou TXT'}</span>
        <span className="text-sm text-tinta-2">ou arraste o arquivo para cá · até 5 MB</span>
        <input
          ref={entrada}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          className="sr-only"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-2">PDF escaneado (foto de página) não tem texto: nesse caso, cole o texto.</p>
        <Botao variante="primario" disabled={!arquivo} carregando={ocupado} onClick={enviar}>
          {ocupado ? 'Lendo e cortando em trechos…' : 'Adicionar à minha base'}
        </Botao>
      </div>
    </div>
  )
}

/** Formulário de título + texto colado. Valida aqui antes de enviar (título e ao menos 20 caracteres). */
function ColarTexto({ ocupado, aoEnviar }: { ocupado: boolean; aoEnviar: (titulo: string, texto: string) => void }) {
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [tentou, setTentou] = useState(false)
  const curto = texto.trim().length < 20

  function enviar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (!titulo.trim() || curto) return
    aoEnviar(titulo.trim(), texto)
    setTitulo('')
    setTexto('')
    setTentou(false)
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <Campo
        rotulo="De onde é esse texto?"
        dica="Ex.: Livro de História, cap. 3"
        erro={tentou && !titulo.trim() ? 'Dê um nome à fonte, para saber de onde veio cada trecho.' : undefined}
      >
        {(p) => <input {...p} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} className={entradaCls} />}
      </Campo>
      <Campo
        rotulo="Texto"
        dica={`${texto.length.toLocaleString('pt-BR')} de 20.000 caracteres`}
        erro={tentou && curto ? 'Cole pelo menos uma ou duas frases.' : undefined}
      >
        {(p) => (
          <textarea {...p} value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} maxLength={20000} className={cn(entradaCls, 'resize-y')} />
        )}
      </Campo>
      <div className="flex justify-end">
        <Botao type="submit" variante="primario" carregando={ocupado}>
          Adicionar à minha base
        </Botao>
      </div>
    </form>
  )
}
