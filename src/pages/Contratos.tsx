import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, Search, ChevronRight, RefreshCw } from 'lucide-react'
import { useContratos } from '@/hooks/useContratos'
import { fmt } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

const ESTADO_CFG: Record<string, { cls: string; label: string }> = {
  borrador:    { cls: 'badge-gray',    label: 'Borrador' },
  vigente:     { cls: 'badge-info',    label: 'Vigente' },
  cancelado:   { cls: 'badge-danger',  label: 'Cancelado' },
  rescindido:  { cls: 'badge-danger',  label: 'Rescindido' },
  escriturado: { cls: 'badge-success', label: 'Escriturado' },
}

export default function Contratos() {
  const navigate = useNavigate()
  const [search, setSearch]     = useState('')
  const [filtroEst, setFiltroEst] = useState('todos')
  const [filtroMon, setFiltroMon] = useState('todos')
  const { data, loading, error, reload } = useContratos()

  const filtrados = useMemo(() => {
    const q = search.toLowerCase()
    return data.filter(c => {
      if (filtroEst !== 'todos' && c.estado !== filtroEst) return false
      if (filtroMon !== 'todos' && c.moneda !== filtroMon) return false
      if (!q) return true
      const clienteNom = c.cliente ? `${c.cliente.apellido??''} ${c.cliente.nombre}`.toLowerCase() : ''
      return c.numero.includes(q) || clienteNom.includes(q) ||
        (c.emprendimiento?.nombre ?? '').toLowerCase().includes(q) ||
        (c.unidad?.identificador ?? '').toLowerCase().includes(q)
    })
  }, [data, search, filtroEst, filtroMon])

  const totalUSD = filtrados.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.precio_total, 0)

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Contratos"
        subtitle={`${data.length} contratos · ${data.filter(c => c.estado === 'vigente').length} vigentes`}
        actions={
          <button onClick={() => navigate('/contratos/nuevo')} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nuevo contrato
          </button>
        }
      />

      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="N° contrato, cliente, emprendimiento..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filtroEst} onChange={e => setFiltroEst(e.target.value)}>
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADO_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filtroMon} onChange={e => setFiltroMon(e.target.value)}>
          <option value="todos">USD y ARS</option>
          <option value="USD">Solo USD</option>
          <option value="ARS">Solo ARS</option>
        </select>
        <button onClick={reload} className="text-gray-400 hover:text-primary transition-colors"><RefreshCw size={15}/></button>
        <span className="ml-auto text-xs text-gray-400">{filtrados.length} · {fmt(totalUSD,'USD')}</span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm text-center py-10">{error}</div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">N° Contrato</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Emprendimiento / Unidad</th>
                  <th className="px-4 py-3 text-center">Tipo</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Precio total</th>
                  <th className="px-4 py-3 text-left">Firma</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map((c, i) => {
                  const est = ESTADO_CFG[c.estado] ?? { cls: 'badge-gray', label: c.estado }
                  return (
                    <tr key={c.id} onClick={() => navigate(`/contratos/${c.id}`)}
                      className={cn('cursor-pointer hover:bg-blue-50/40 transition-colors', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30')}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{c.numero}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 text-sm">
                          {c.cliente ? `${c.cliente.apellido ?? ''}, ${c.cliente.nombre}`.replace(/^,\s*/,'') : '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700 text-sm">{c.emprendimiento?.nombre ?? '—'}</p>
                        <p className="text-xs text-gray-400">Unidad {c.unidad?.identificador ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="badge badge-gray text-[10px] capitalize">{c.tipo}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('badge text-[10px]', est.cls)}>{est.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 tabular-nums">
                        {fmt(c.precio_total, c.moneda)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {c.fecha_firma ? format(new Date(c.fecha_firma), 'dd/MM/yy', { locale: es }) : '—'}
                      </td>
                      <td className="px-4 py-3"><ChevronRight size={14} className="text-gray-300" /></td>
                    </tr>
                  )
                })}
                {filtrados.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Sin contratos</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
