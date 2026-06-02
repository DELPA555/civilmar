import { useState } from 'react'
import { TrendingUp, Plus, RefreshCw, X, AlertTriangle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useIndiceCAC } from '@/hooks/useIndiceCAC'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function NuevoPeriodoModal({ onClose, onGuardar }: { onClose: () => void; onGuardar: (d: {anio:number;mes:number;valor:number;fuente?:string}) => Promise<void> }) {
  const [form, setForm] = useState({ anio:'2026', mes:'6', valor:'', fuente:'INDEC' })
  const [saving, setSaving] = useState(false)
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'
  const save = async () => {
    setSaving(true)
    try { await onGuardar({ anio: Number(form.anio), mes: Number(form.mes), valor: Number(form.valor), fuente: form.fuente }); onClose() }
    catch(e) { alert(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Cargar nuevo índice CAC</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Año</label><input type="number" className={fi} value={form.anio} onChange={e=>setForm(p=>({...p,anio:e.target.value}))}/></div>
            <div><label className={lb}>Mes</label>
              <select className={fi} value={form.mes} onChange={e=>setForm(p=>({...p,mes:e.target.value}))}>
                {MESES.map((m,i)=><option key={i} value={String(i+1)}>{m}</option>)}
              </select>
            </div>
          </div>
          <div><label className={lb}>Valor del índice *</label><input type="number" step="0.01" className={fi} placeholder="Ej: 2252.40" autoFocus value={form.valor} onChange={e=>setForm(p=>({...p,valor:e.target.value}))}/></div>
          <div><label className={lb}>Fuente</label><input className={fi} value={form.fuente} onChange={e=>setForm(p=>({...p,fuente:e.target.value}))}/></div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button disabled={!form.valor||saving} onClick={save} className="btn-primary disabled:opacity-50">
            {saving?'Guardando...':'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ActualizarCACModal({ onClose, onActualizar, data }: {
  onClose: () => void;
  onActualizar: (a: number, m: number) => Promise<number>;
  data: ReturnType<typeof useIndiceCAC>['data']
}) {
  const [periodo, setPeriodo] = useState(data[0] ? `${data[0].anio}-${String(data[0].mes).padStart(2,'0')}` : '')
  const [result, setResult] = useState<number|null>(null)
  const [saving, setSaving] = useState(false)
  const sel = data.find(d => `${d.anio}-${String(d.mes).padStart(2,'0')}` === periodo)

  const run = async () => {
    if (!periodo||!sel) return
    setSaving(true)
    try { const n = await onActualizar(sel.anio, sel.mes); setResult(n) }
    catch(e) { alert(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Actualizar cuotas ARS con CAC</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {result !== null ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
              <p className="text-green-700 font-bold text-lg">{result} cuota{result!==1?'s':''} actualizadas</p>
              <p className="text-green-600 text-sm mt-1">CAC de {periodo} aplicado correctamente</p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
                Actualizará el monto de todas las cuotas ARS pendientes del período seleccionado.
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Período</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={periodo} onChange={e=>setPeriodo(e.target.value)}>
                  {data.map(d=><option key={d.id} value={`${d.anio}-${String(d.mes).padStart(2,'0')}`}>{MESES[d.mes-1]} {d.anio} — {d.valor.toFixed(2)}</option>)}
                </select>
              </div>
              {sel && <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl text-sm text-gray-600">
                <p>Variación mensual: <strong className="text-success">+{sel.variacion_mensual?.toFixed(1)}%</strong></p>
              </div>}
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">{result !== null ? 'Cerrar' : 'Cancelar'}</button>
          {result === null && <button onClick={run} disabled={saving||!periodo} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            <RefreshCw size={14}/>{saving?'Aplicando...':'Aplicar CAC'}
          </button>}
        </div>
      </div>
    </div>
  )
}

export default function IndiceCAC() {
  const { data, loading, error, ultimo, insertar, actualizarCuotasARS } = useIndiceCAC()
  const [showNuevo,      setShowNuevo]      = useState(false)
  const [showActualizar, setShowActualizar] = useState(false)

  const chartData = data.slice(0,12).reverse().map(d => ({
    label: `${MESES[d.mes-1]} ${String(d.anio).slice(2)}`,
    valor: d.valor,
  }))

  return (
    <div className="flex flex-col h-full">
      <Header title="Índice CAC" subtitle="Índice de la Construcción — INDEC"
        actions={
          <div className="flex gap-2">
            <button onClick={()=>setShowActualizar(true)} className="btn-ghost border border-orange-200 text-orange-700 hover:bg-orange-50 flex items-center gap-2 text-sm">
              <RefreshCw size={14}/> Actualizar cuotas ARS
            </button>
            <button onClick={()=>setShowNuevo(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16}/> Cargar período
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-auto p-6 space-y-5">
        {ultimo && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: `Último valor (${MESES[ultimo.mes-1]} ${ultimo.anio})`, value: ultimo.valor.toLocaleString('es-AR',{maximumFractionDigits:2}), cls: 'text-primary' },
              { label: 'Variación mensual', value: `+${ultimo.variacion_mensual?.toFixed(1)?? '—'}%`, cls: 'text-success' },
              { label: 'Variación anual', value: `+${ultimo.variacion_anual?.toFixed(1)?? '—'}%`, cls: 'text-amber-700' },
            ].map(s=>(
              <div key={s.label} className="card text-center py-3">
                <p className={cn('text-2xl font-bold',s.cls)}>{s.value}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {chartData.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-primary"/> Evolución últimos 12 meses</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="label" tick={{fontSize:10,fill:'#9ca3af'}}/>
                <YAxis tick={{fontSize:10,fill:'#9ca3af'}} domain={['auto','auto']}/>
                <Tooltip formatter={(v:number)=>[v.toFixed(2),'Valor CAC']}/>
                <Line type="monotone" dataKey="valor" stroke="#1a3a5c" strokeWidth={2.5} dot={{r:3}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
        ) : error ? (
          <div className="text-red-400 text-sm text-center">{error}</div>
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0"><tr className="table-header">
                  <th className="px-4 py-3 text-left">Período</th>
                  <th className="px-4 py-3 text-right">Valor índice</th>
                  <th className="px-4 py-3 text-right">Var. mensual</th>
                  <th className="px-4 py-3 text-right">Var. anual</th>
                  <th className="px-4 py-3 text-center">Fuente</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {data.map((d,i)=>(
                    <tr key={d.id} className={i%2===0?'bg-white':'bg-gray-50/40'}>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{MESES[d.mes-1]} {d.anio}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-900">{d.valor.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={cn('font-semibold',(d.variacion_mensual??0)<=3?'text-success':(d.variacion_mensual??0)<=8?'text-amber-700':'text-danger')}>
                          +{d.variacion_mensual?.toFixed(1)??'—'}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-700">+{d.variacion_anual?.toFixed(1)??'—'}%</td>
                      <td className="px-4 py-2.5 text-center"><span className="badge badge-gray text-[10px]">{d.fuente}</span></td>
                    </tr>
                  ))}
                  {!data.length&&<tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin datos de CAC. Cargá el primer período.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showNuevo && <NuevoPeriodoModal onClose={()=>setShowNuevo(false)} onGuardar={insertar}/>}
      {showActualizar && <ActualizarCACModal onClose={()=>setShowActualizar(false)} onActualizar={actualizarCuotasARS} data={data}/>}
    </div>
  )
}
