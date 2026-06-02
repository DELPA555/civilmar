import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, CheckCircle, Clock, X, DollarSign, TrendingUp, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTodasLasCuotas } from '@/hooks/useContratos'
import { useDashboard } from '@/hooks/useDashboard'
import { fmt } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

type SemaforoT = 'verde'|'amarillo'|'rojo'
function semaforo(estado: string, fv: string): SemaforoT {
  if (estado === 'pagada') return 'verde'
  const dias = Math.floor((new Date().getTime() - new Date(fv).getTime()) / 86400000)
  if (dias > 0) return 'rojo'
  if (dias > -8) return 'amarillo'
  return 'verde'
}
const SEM_DOT: Record<SemaforoT, string> = { verde: 'bg-green-500', amarillo: 'bg-yellow-400', rojo: 'bg-red-500' }

function PagoModal({ cuota, onClose, onPago }: {
  cuota: { id: string; monto_original: number; moneda?: 'USD'|'ARS'; numero_cuota?: number }
  onClose: () => void
  onPago: (id: string, data: { fecha_pago: string; monto_pagado: number; medio_pago: string; numero_recibo?: string; notas?: string }) => Promise<void>
}) {
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState({ fecha: hoy, monto: String(cuota.monto_original), medio: 'transferencia', recibo: '', notas: '' })
  const [saving, setSaving] = useState(false)
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'

  const save = async () => {
    setSaving(true)
    try {
      await onPago(cuota.id, { fecha_pago: form.fecha, monto_pagado: Number(form.monto), medio_pago: form.medio, numero_recibo: form.recibo || undefined, notas: form.notas || undefined })
      onClose()
    } catch (e) { alert(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-sm">Registrar cobro — cuota {cuota.numero_cuota}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Fecha cobro</label><input type="date" className={fi} value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))}/></div>
            <div><label className={lb}>Monto ({cuota.moneda??'USD'})</label><input type="number" className={fi} value={form.monto} onChange={e=>setForm(p=>({...p,monto:e.target.value}))}/></div>
          </div>
          <div><label className={lb}>Medio de cobro</label>
            <select className={fi} value={form.medio} onChange={e=>setForm(p=>({...p,medio:e.target.value}))}>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="cheque">Cheque</option>
              <option value="criptos">Criptomonedas</option>
            </select>
          </div>
          <div><label className={lb}>N° recibo</label><input className={fi} placeholder="REC-000001" value={form.recibo} onChange={e=>setForm(p=>({...p,recibo:e.target.value}))}/></div>
          <div><label className={lb}>Notas</label><textarea className={fi} rows={2} value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))}/></div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            <CheckCircle size={14}/>{saving ? 'Guardando...' : 'Confirmar cobro'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Cobros() {
  const [filtroEst,  setFiltroEst]  = useState('pendiente+vencida')
  const [filtroEmp,  setFiltroEmp]  = useState('todos')
  const [filtroMon,  setFiltroMon]  = useState('todos')
  const [filtroMes,  setFiltroMes]  = useState('')
  const [pagoModal,  setPagoModal]  = useState<typeof data[0] | null>(null)
  const { data, loading, reload, registrarPago } = useTodasLasCuotas()
  const { flujo } = useDashboard()

  const emprendimientos = [...new Set(data.map(c => c.emprendimiento).filter(Boolean))]
  const vencidas    = data.filter(c => c.estado === 'vencida')
  const cobradoMes  = data.filter(c => c.estado === 'pagada' && c.fecha_pago?.startsWith(format(new Date(),'yyyy-MM'))).reduce((s,c) => s+(c.monto_pagado??c.monto_original), 0)

  const filtradas = useMemo(() => {
    return data.filter(c => {
      if (filtroEst === 'pendiente+vencida') { if (c.estado!=='pendiente'&&c.estado!=='vencida') return false }
      else if (filtroEst !== 'todos') { if (c.estado !== filtroEst) return false }
      if (filtroEmp !== 'todos' && c.emprendimiento !== filtroEmp) return false
      if (filtroMon !== 'todos' && c.moneda !== filtroMon) return false
      if (filtroMes && !c.fecha_vencimiento.startsWith(filtroMes)) return false
      return true
    }).sort((a,b)=>a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))
  }, [data, filtroEst, filtroEmp, filtroMon, filtroMes])

  return (
    <div className="flex flex-col h-full">
      <Header title="Cobros / Cuotas" subtitle={`${vencidas.length} cuotas vencidas`}
        actions={<button onClick={reload} className="btn-ghost flex items-center gap-1.5 text-xs"><RefreshCw size={13}/> Actualizar</button>}/>
      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Resumen */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Vencidas',        value: vencidas.length, sub: fmt(vencidas.reduce((s,c)=>s+c.monto_original,0),'USD'), cls: 'text-danger', icon: AlertTriangle, bg: 'bg-red-50' },
            { label: 'Por vencer (7d)', value: data.filter(c=>{const d=(new Date(c.fecha_vencimiento).getTime()-new Date().getTime())/86400000;return c.estado==='pendiente'&&d>=0&&d<=7}).length, sub:'', cls: 'text-warning', icon: Clock, bg: 'bg-yellow-50' },
            { label: 'Cobrado este mes',value: fmt(cobradoMes,'USD'), sub:'', cls: 'text-success', icon: CheckCircle, bg: 'bg-green-50' },
            { label: 'Total pendiente', value: fmt(data.filter(c=>c.estado==='pendiente'||c.estado==='vencida').reduce((s,c)=>s+c.monto_original,0),'USD'), sub:'', cls: 'text-primary', icon: DollarSign, bg: 'bg-primary/5' },
          ].map(s=>{
            const Icon = s.icon
            return (
              <div key={s.label} className="card flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', s.bg)}>
                  <Icon size={18} className={s.cls}/>
                </div>
                <div>
                  <p className={cn('text-xl font-bold', s.cls)}>{s.value}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</p>
                  {s.sub&&<p className="text-[10px] text-gray-400">{s.sub}</p>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Panel vencidas */}
        {vencidas.length > 0 && (
          <div className="card border-l-4 border-red-500 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-500"/>
              <h3 className="font-bold text-red-700 text-sm">Cuotas vencidas urgentes ({vencidas.length})</h3>
            </div>
            <div className="space-y-2">
              {vencidas.slice(0,5).map(c=>{
                const dias = Math.floor((new Date().getTime()-new Date(c.fecha_vencimiento).getTime())/86400000)
                return (
                  <div key={c.id} className="flex items-center gap-3 text-sm">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', dias>30?'bg-red-600':'bg-red-400')}/>
                    <span className="flex-1 font-medium text-gray-800 truncate">{c.cliente}</span>
                    <span className="text-gray-500 text-xs">{c.contrato_numero}</span>
                    <span className="font-mono font-semibold text-gray-900">{fmt(c.monto_original, c.moneda??'USD')}</span>
                    <span className="badge bg-red-100 text-red-700 text-[9px]">{dias}d mora</span>
                    <button onClick={()=>setPagoModal(c)} className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg hover:bg-red-700">Cobrar</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Gráfico */}
        {flujo.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-primary"/>
              <h3 className="font-semibold text-gray-800 text-sm">Cobrado vs. proyectado — últimos 6 meses (U$D miles)</h3>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={flujo} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="mes" tick={{fontSize:11,fill:'#9ca3af'}}/>
                <YAxis tick={{fontSize:11,fill:'#9ca3af'}} tickFormatter={v=>`${v}k`}/>
                <Tooltip formatter={(v:number)=>[`${v}k U$D`]}/>
                <Bar dataKey="proyectado" name="Proyectado" fill="#e2e8f0" radius={[4,4,0,0]}/>
                <Bar dataKey="cobrado"    name="Cobrado"    fill="#1a3a5c" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Filtros */}
        <div className="flex items-center gap-3 flex-wrap bg-white rounded-xl border border-gray-100 px-4 py-3">
          <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" value={filtroEst} onChange={e=>setFiltroEst(e.target.value)}>
            <option value="todos">Todos los estados</option>
            <option value="pendiente+vencida">Pendientes + Vencidas</option>
            <option value="pendiente">Solo pendientes</option>
            <option value="vencida">Solo vencidas</option>
            <option value="pagada">Pagadas</option>
          </select>
          <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" value={filtroEmp} onChange={e=>setFiltroEmp(e.target.value)}>
            <option value="todos">Todos los emprendimientos</option>
            {emprendimientos.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
          <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" value={filtroMon} onChange={e=>setFiltroMon(e.target.value)}>
            <option value="todos">USD y ARS</option>
            <option value="USD">Solo USD</option>
            <option value="ARS">Solo ARS</option>
          </select>
          <input type="month" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" value={filtroMes} onChange={e=>setFiltroMes(e.target.value)}/>
          <span className="ml-auto text-xs text-gray-400">{filtradas.length} cuotas</span>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-center w-8">⚡</th>
                <th className="px-4 py-3 text-left">Contrato</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Emprendimiento</th>
                <th className="px-4 py-3 text-center">N°</th>
                <th className="px-4 py-3 text-left">Vencimiento</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 w-32"/>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {filtradas.slice(0,100).map((c,i)=>{
                  const sem = semaforo(c.estado, c.fecha_vencimiento)
                  const dias = c.estado==='vencida' ? Math.floor((new Date().getTime()-new Date(c.fecha_vencimiento).getTime())/86400000) : 0
                  return (
                    <tr key={c.id} className={cn(i%2===0?'bg-white':'bg-gray-50/30', sem==='rojo'&&'bg-red-50/40')}>
                      <td className="px-4 py-2.5 text-center"><span className={cn('w-2.5 h-2.5 rounded-full inline-block',SEM_DOT[sem])}/></td>
                      <td className="px-4 py-2.5 text-xs font-mono text-primary font-semibold">{c.contrato_numero}</td>
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-800">{c.cliente}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{c.emprendimiento}</td>
                      <td className="px-4 py-2.5 text-center text-xs text-gray-500">{c.numero_cuota}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">
                        {format(new Date(c.fecha_vencimiento),'dd/MM/yyyy',{locale:es})}
                        {dias>0&&<span className="ml-1 text-[9px] text-red-600 font-bold">{dias}d mora</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-900 tabular-nums">{fmt(c.monto_original, c.moneda??'USD')}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn('badge text-[9px]',c.estado==='pagada'?'badge-success':c.estado==='vencida'?'badge-danger':'badge-info')}>
                          {c.estado.charAt(0).toUpperCase()+c.estado.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {(c.estado==='pendiente'||c.estado==='vencida')&&(
                          <button onClick={()=>setPagoModal(c)}
                            className={cn('text-xs text-white px-3 py-1.5 rounded-lg font-medium transition-colors',
                              c.estado==='vencida'?'bg-red-600 hover:bg-red-700':'bg-primary hover:bg-primary-light')}>
                            Registrar cobro
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filtradas.length===0&&<tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Sin cuotas que coincidan</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagoModal && (
        <PagoModal
          cuota={pagoModal}
          onClose={()=>setPagoModal(null)}
          onPago={async(id, pago) => { await registrarPago(id, pago) }}
        />
      )}
    </div>
  )
}
