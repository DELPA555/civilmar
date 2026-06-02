import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Truck, ShoppingCart, CreditCard } from 'lucide-react'
import { useProveedorDetalle } from '@/hooks/useProveedores'
import { fmtARS } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

const TABS = [
  { id: 'datos',   label: 'Datos',     icon: Truck },
  { id: 'ordenes', label: 'Órdenes de compra', icon: ShoppingCart },
  { id: 'pagos',   label: 'Pagos y saldo', icon: CreditCard },
] as const
type TabId = typeof TABS[number]['id']

const ESTADO_OC: Record<string, string> = { borrador: 'badge-gray', aprobada: 'badge-info', recibida: 'badge-success', cancelada: 'badge-danger' }

export default function ProveedorDetalle() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<TabId>('datos')
  const { proveedor: prov, ordenes, pagos, totalOC, totalPag, saldo, loading } = useProveedorDetalle(id)

  if (loading) return <div className="flex flex-col h-full"><Header title="Cargando..." /><div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div></div>
  if (!prov) return <div className="flex flex-col h-full"><Header title="No encontrado" /><div className="flex-1 flex items-center justify-center text-gray-400">No encontrado <Link to="/proveedores" className="ml-2 text-primary underline">Volver</Link></div></div>

  return (
    <div className="flex flex-col h-full">
      <Header title={prov.razon_social} subtitle={prov.rubro}
        actions={<Link to="/proveedores" className="btn-ghost flex items-center gap-1.5 text-sm"><ArrowLeft size={15} /> Volver</Link>} />
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="flex">
          {TABS.map(t => { const Icon = t.icon; return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors', tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              <Icon size={15} />{t.label}
            </button>
          )})}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {tab === 'datos' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card space-y-3">
              <h4 className="font-semibold text-gray-800">Información del proveedor</h4>
              {[['CUIT', prov.cuit ?? '—'], ['Rubro', prov.rubro], ['Contacto', prov.nombre_contacto ?? '—'], ['Email', prov.email ?? '—'], ['Teléfono', prov.telefono ?? '—'], ['Cond. pago', prov.condicion_pago ?? '—'], ['Estado', prov.estado]].map(([l, v]) => (
                <div key={l} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0 text-sm">
                  <span className="text-gray-400 text-xs">{l}</span>
                  <span className="font-medium text-gray-800">{v}</span>
                </div>
              ))}
              {prov.notas && <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-gray-700">{prov.notas}</div>}
            </div>
            <div className="card">
              <h4 className="font-semibold text-gray-800 mb-4">Cuenta corriente</h4>
              {[['Total órdenes de compra', fmtARS(totalOC), ''], ['Total pagado', fmtARS(totalPag), 'text-success'], ['Saldo pendiente', fmtARS(saldo), saldo > 0 ? 'text-danger' : 'text-success']].map(([l, v, cls]) => (
                <div key={l} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-500">{l}</span>
                  <span className={cn('font-bold font-mono', cls || 'text-gray-900')}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'ordenes' && (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead><tr className="table-header"><th className="px-4 py-3 text-left">N° Orden</th><th className="px-4 py-3 text-left">Emprendimiento</th><th className="px-4 py-3 text-left">Descripción</th><th className="px-4 py-3 text-left">Fecha</th><th className="px-4 py-3 text-center">Estado</th><th className="px-4 py-3 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {ordenes.map((o, i) => (
                  <tr key={o.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    <td className="px-4 py-3 text-xs font-mono font-semibold text-primary">{o.numero}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{o.emprendimiento?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-xs">{o.descripcion}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{format(new Date(o.fecha), 'dd/MM/yy', { locale: es })}</td>
                    <td className="px-4 py-3 text-center"><span className={cn('badge text-[10px]', ESTADO_OC[o.estado] ?? 'badge-gray')}>{o.estado}</span></td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{fmtARS(o.total ?? 0)}</td>
                  </tr>
                ))}
                {ordenes.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin órdenes de compra</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'pagos' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[['Comprado', fmtARS(totalOC), 'text-primary'], ['Pagado', fmtARS(totalPag), 'text-success'], ['Saldo', fmtARS(saldo), saldo > 0 ? 'text-danger' : 'text-success']].map(([l, v, cls]) => (
                <div key={l} className="card text-center py-3">
                  <p className={cn('text-xl font-bold', cls)}>{v}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{l}</p>
                </div>
              ))}
            </div>
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead><tr className="table-header"><th className="px-4 py-3 text-left">Fecha</th><th className="px-4 py-3 text-left">Concepto</th><th className="px-4 py-3 text-left">Medio</th><th className="px-4 py-3 text-left">Comprobante</th><th className="px-4 py-3 text-right">Monto</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {pagos.map((p, i) => (
                    <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                      <td className="px-4 py-3 text-xs text-gray-500">{format(new Date(p.fecha), 'dd/MM/yyyy', { locale: es })}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{p.concepto}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{p.medio_pago}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{p.numero_comprobante ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-success">{fmtARS(p.monto)}</td>
                    </tr>
                  ))}
                  {pagos.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin pagos registrados</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
