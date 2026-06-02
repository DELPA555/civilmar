import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Star, ChevronRight, RefreshCw } from 'lucide-react'
import { useProveedores } from '@/hooks/useProveedores'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

export default function Proveedores() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { data, loading, error, reload } = useProveedores()

  // Para proveedores sin totales enriquecidos, calculamos 0 como fallback
  const filtrados = data.filter(p =>
    !search ||
    p.razon_social.toLowerCase().includes(search.toLowerCase()) ||
    (p.rubro ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      <Header title="Proveedores"
        subtitle={`${data.filter(p => p.estado === 'activo').length} activos`}
        actions={<button className="btn-primary flex items-center gap-2"><Plus size={16}/> Nuevo proveedor</button>}
      />
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Buscar proveedor o rubro..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <button onClick={reload} className="text-gray-400 hover:text-primary transition-colors"><RefreshCw size={15}/></button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
        ) : error ? (
          <div className="text-red-400 text-sm text-center py-10">{error}</div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-left">Razón social</th>
                <th className="px-4 py-3 text-left">Rubro</th>
                <th className="px-4 py-3 text-left">Contacto</th>
                <th className="px-4 py-3 text-left">Cond. pago</th>
                <th className="px-4 py-3 text-center">Calif.</th>
                <th className="px-4 py-3 w-8"/>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map((p, i) => (
                  <tr key={p.id} onClick={() => navigate(`/proveedores/${p.id}`)}
                    className={cn('cursor-pointer hover:bg-blue-50/40 transition-colors', i%2===0?'bg-white':'bg-gray-50/30')}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800">{p.razon_social}</p>
                      {p.cuit&&<p className="text-[10px] text-gray-400">CUIT: {p.cuit}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.rubro ?? '—'}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-600">{p.nombre_contacto ?? '—'}</p>
                      {p.telefono&&<p className="text-[10px] text-gray-400">{p.telefono}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.condicion_pago ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        {Array.from({length:5},(_,j) => (
                          <Star key={j} size={10} className={j<(p.calificacion??0)?'text-amber-400 fill-amber-400':'text-gray-200'}/>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3"><ChevronRight size={14} className="text-gray-300"/></td>
                  </tr>
                ))}
                {filtrados.length===0&&<tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin proveedores</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
