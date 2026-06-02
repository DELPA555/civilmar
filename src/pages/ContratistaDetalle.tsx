import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, HardHat, FileText, CreditCard } from 'lucide-react'
import { useContratistaDetalle } from '@/hooks/useContratistas'
import { fmtARS } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

const TABS = [{ id: 'datos', label: 'Datos', icon: HardHat }, { id: 'certs', label: 'Certificaciones', icon: FileText }, { id: 'cuenta', label: 'Cuenta corriente', icon: CreditCard }] as const
type TabId = typeof TABS[number]['id']
const CERT_CFG: Record<string, string> = { pendiente: 'badge-warning', aprobado: 'badge-info', pagado: 'badge-success' }

export default function ContratistaDetalle() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<TabId>('datos')
  const { contratista: ct, certs, totalCert, totalRet, totalPag, saldo, loading } = useContratistaDetalle(id)

  if (loading) return <div className="flex flex-col h-full"><Header title="Cargando..." /><div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div></div>
  if (!ct) return <div className="p-6 text-gray-400">No encontrado. <Link to="/contratistas" className="text-primary underline">Volver</Link></div>
  // totalPag y saldo vienen del hook

  return (
    <div className="flex flex-col h-full">
      <Header title={ct.razon_social} subtitle={ct.rubro}
        actions={<Link to="/contratistas" className="btn-ghost flex items-center gap-1.5 text-sm"><ArrowLeft size={15} /> Volver</Link>} />
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
          <div className="card max-w-lg">
            <h4 className="font-semibold text-gray-800 mb-4">Datos del contratista</h4>
            {[['CUIT', ct.cuit ?? '—'], ['Contacto', ct.nombre_contacto ?? '—'], ['Email', ct.email ?? '—'], ['Teléfono', ct.telefono ?? '—'], ['Estado', ct.estado]].map(([l, v]) => (
              <div key={l} className="flex justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
                <span className="text-gray-400 text-xs">{l}</span><span className="font-medium text-gray-800">{v}</span>
              </div>
            ))}
            {ct.notas && <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-gray-700">{ct.notas}</div>}
          </div>
        )}
        {tab === 'certs' && (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead><tr className="table-header"><th className="px-4 py-3 text-left">N° Cert.</th><th className="px-4 py-3 text-left">Emprendimiento / Etapa</th><th className="px-4 py-3 text-left">Fecha</th><th className="px-4 py-3 text-right">Certificado</th><th className="px-4 py-3 text-right">Retención</th><th className="px-4 py-3 text-right">Neto</th><th className="px-4 py-3 text-center">Estado</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {certs.map((c, i) => (
                  <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    <td className="px-4 py-3 text-xs font-mono font-semibold text-primary">{c.numero_certificado ?? '—'}</td>
                    <td className="px-4 py-3"><p className="text-sm text-gray-800">{c.emprendimiento?.nombre ?? '—'}</p><p className="text-xs text-gray-400">{c.etapa?.nombre ?? '—'}</p></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{format(new Date(c.fecha), 'dd/MM/yyyy', { locale: es })}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-900">{fmtARS(c.monto_certificado)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-amber-700">{fmtARS(c.monto_retencion ?? 0)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-bold text-gray-900">{fmtARS(c.monto_neto ?? 0)}</td>
                    <td className="px-4 py-3 text-center"><span className={cn('badge text-[10px]', CERT_CFG[c.estado] ?? 'badge-gray')}>{c.estado}</span></td>
                  </tr>
                ))}
                {certs.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin certificaciones</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'cuenta' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[['Total certificado', fmtARS(totalCert), 'text-primary'], ['Retención total', fmtARS(totalRet), 'text-amber-700'], ['Total pagado', fmtARS(totalPag), 'text-success'], ['Saldo pendiente', fmtARS(saldo), saldo > 0 ? 'text-danger' : 'text-success']].map(([l, v, cls]) => (
                <div key={l} className="card text-center py-3">
                  <p className={cn('text-xl font-bold', cls)}>{v}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{l}</p>
                </div>
              ))}
            </div>
            <div className="card">
              <p className="text-sm text-gray-600">La retención de garantía ({certs[0]?.porcentaje_retencion ?? 5}%) se libera al finalizar la obra y verificación final. Las certificaciones aprobadas aún no pagadas representan el saldo actual.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
