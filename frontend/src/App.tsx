import { useEffect, useState } from 'react'
import { Cabecalho } from '@/components/Cabecalho'
import { Aviso, botaoCls, larguraCls } from '@/components/ui'
import { api, type Saude } from '@/lib/api'
import { href, useRota } from '@/lib/rota'
import { cn } from '@/lib/utils'
import { ComoFunciona } from '@/paginas/ComoFunciona'
import { Entrar } from '@/paginas/Entrar'
import { Facilitador } from '@/paginas/facilitador/Facilitador'
import { Inicio } from '@/paginas/Inicio'
import { Oficina } from '@/paginas/Oficina'

export default function App() {
  const partes = useRota()
  const [saude, setSaude] = useState<Saude | null>(null)
  const [semServidor, setSemServidor] = useState(false)

  useEffect(() => {
    api
      .saude()
      .then(setSaude)
      .catch(() => setSemServidor(true))
  }, [])

  const [pagina, ...resto] = partes

  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecalho rotaAtual={pagina ?? ''} />
      {semServidor && (
        <div className={cn(larguraCls, 'pt-4')}>
          <Aviso tom="erro" titulo="O servidor da oficina não respondeu">
            Confira se a API está ligada (veja o README) e recarregue a página.
          </Aviso>
        </div>
      )}
      {saude?.demonstracao && (
        <p role="status" className="border-b border-alerta/30 bg-alerta-fundo px-4 py-1.5 text-center text-sm">
          <strong>Modo demonstração:</strong> nenhuma IA real está ligada; as respostas são simuladas para ensaiar.
        </p>
      )}
      <main
        id="conteudo"
        tabIndex={-1}
        className={cn(larguraCls, 'flex-1 focus:outline-none', pagina === 'oficina' ? 'py-5 sm:py-6' : 'py-8 sm:py-12')}
      >
        <div key={pagina === 'oficina' ? 'oficina' : partes.join('/')} className="entrar-pagina">
          <Pagina pagina={pagina} resto={resto} />
        </div>
      </main>
    </div>
  )
}

function Pagina({ pagina, resto }: { pagina?: string; resto: string[] }) {
  switch (pagina) {
    case undefined:
      return <Inicio />
    case 'entrar':
      return resto[0] ? <Entrar key={resto[0]} codigo={resto[0].toUpperCase()} /> : <Inicio />
    case 'oficina':
      return <Oficina etapa={resto[0] ? Number(resto[0]) : null} />
    case 'como-funciona':
      return <ComoFunciona />
    case 'facilitador':
      return <Facilitador partes={resto} />
    default:
      return (
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Página não encontrada</h1>
          <a href={href('/')} className={botaoCls('primario')}>
            Ir para o início
          </a>
        </div>
      )
  }
}
