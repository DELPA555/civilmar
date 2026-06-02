import { useNavigate } from 'react-router-dom'
import { ChevronRight, Star, RefreshCw } from 'lucide-react'
import { useContratistas } from '@/hooks/useContratistas'
import { fmtARS } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

export default function Contratistas() {
  const navigate = useNavigate()
  const { data, loading, error, totales, reload } = useContratistas()

  return (
    <div className="flex flex-col h-full">
      <Header title="Contratistas"
        subtitle={`${data.filter(c => c.estado === 'activo').length} activos`}
        actions={<button onClick={reload} className="btn-ghost flex items-center gap-1.5 text-xs"><RefreshCw size={13}/> Actualizar</button>}
      />
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
        ) : error ? (
          <div className="text-red-400 text-sm text-center py-10">{error}</div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-left">Contratista</th>
                <th className="px-4 py-3 text-left">Rubro</th>
                <th className="px-4 py-3 text-right">Certificado</th>
                <th className="px-4 py-3 text-right">Pagado</th>
                <th className="px-4 py-3 text-right">Retenido</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-center">Calif.</th>
                <th className="px-4 py-3 w-8"/>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((c, i) => {
                  const t = totales[c.id] ?? { cert: 0, pag: 0, ret: 0 }
                  const saldo = t.cert - t.pag - t.ret
                  return (
                    <tr key={c.id} onClick={() => navigate(`/contratistas/${c.id}`)}
                      className={cn('cursor-pointer hover:bg-blue-50/40 transition-colors', i%2===0?'bg-white':'bg-gray-50/30')}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800">{c.razon_social}</p>
                        {c.nombre_contacto&&<p className="text-[10px] text-gray-400">{c.nombre_contacto}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.rubro ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-900">{fmtARS(t.cert)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-success">{fmtARS(t.pag)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-amber-700">{fmtARS(t.ret)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-bold">
                        <span className={saldo>0?'text-red-600':'text-green-600'}>{fmtARS(saldo)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {Array.from({length:5},(_,j)=><Star key={j} size={10} className={j<(c.calificacion??0)?'text-amber-400 fill-amber-400':'text-gray-200'}/>)}
                        </div>
                      </td>
                      <td className="px-4 py-3"><ChevronRight size={14} className="text-gray-300"/></td>
                    </tr>
                  )
                })}
                {!data.length&&<tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Sin contratistas</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
