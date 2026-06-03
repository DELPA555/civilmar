import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, ChevronRight, Trophy, RefreshCw } from 'lucide-react'
import { useLicitaciones, useLicitacionDetalle, type Licitacion } from '@/hooks/useLicitaciones'
import { useEmprendimientos } from '@/hooks/useEmprendimientos'
import { useProveedores } from '@/hooks/useProveedores'
import { fmtARS, fmtUSD } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

const ESTADO_CFG = {
  abierta:       { cls: 'badge-info',    label: 'Abierta' },
  en_evaluacion: { cls: 'badge-warning', label: 'En evaluación' },
  adjudicada:    { cls: 'badge-success', label: 'Adjudicada' },
  cancelada:     { cls: 'badge-danger',  label: 'Cancelada' },
}

// ── Modal nueva licitación ────────────────────────────────────────────────────

function NuevaLicitModal({ emps, onClose, onCreate }: {
  emps: { id: string; nombre: string }[]
  onClose: () => void
  onCreate: (i: Omit<Licitacion,'id'|'created_at'|'emprendimiento'|'proveedor_adjudicado'>) => Promise<unknown>
}) {
  const [form, setForm] = useState({
    numero: `LIC-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100)}`,
    emprendimiento_id: '' as string|undefined, descripcion: '', fecha_solicitud: format(new Date(),'yyyy-MM-dd'),
    fecha_limite: '', estado: 'abierta' as Licitacion['estado'], notas: '',
  })
  const [saving, setSaving] = useState(false)
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Nueva solicitud de cotización</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400"/></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Número *</label><input className={fi} autoFocus value={form.numero} onChange={e=>setForm(p=>({...p,numero:e.target.value}))}/></div>
            <div><label className={lb}>Fecha solicitud</label><input type="date" className={fi} value={form.fecha_solicitud} onChange={e=>setForm(p=>({...p,fecha_solicitud:e.target.value}))}/></div>
          </div>
          <div><label className={lb}>Descripción *</label>
            <textarea className={fi} rows={2} value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))} placeholder="¿Qué se está licitando?"/>
          </div>
          <div><label className={lb}>Emprendimiento (opcional)</label>
            <select className={fi} value={form.emprendimiento_id??''} onChange={e=>setForm(p=>({...p,emprendimiento_id:e.target.value||undefined}))}>
              <option value="">— Sin asignar —</option>
              {emps.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
          <div><label className={lb}>Fecha límite cotización</label><input type="date" className={fi} value={form.fecha_limite} onChange={e=>setForm(p=>({...p,fecha_limite:e.target.value}))}/></div>
          <div><label className={lb}>Notas</label><textarea className={fi} rows={2} value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))}/></div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button disabled={saving||!form.descripcion||!form.numero} onClick={async()=>{
            setSaving(true)
            try{ await onCreate({...form, fecha_limite: form.fecha_limite||undefined}); onClose() }
            catch(e){ alert(e instanceof Error?e.message:'Error') }
            finally{ setSaving(false) }
          }} className="btn-primary disabled:opacity-50">{saving?'Creando...':'Crear licitación'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Detalle licitación ────────────────────────────────────────────────────────

function LicitacionDetalle({ id, onBack }: { id: string; onBack: () => void }) {
  const { licitacion, items, cotizaciones, loading, reload, addItem, addCotizacion, updateCotizacion, adjudicar } = useLicitacionDetalle(id)
  const { data: proveedores } = useProveedores()
  const [showAddItem,  setShowAddItem]  = useState(false)
  const [showAddCot,   setShowAddCot]   = useState(false)
  const [itemForm, setItemForm]   = useState({ licitacion_id: id, descripcion: '', unidad: '', cantidad: '', especificaciones: '' })
  const [cotForm,  setCotForm]    = useState({ licitacion_id: id, proveedor_id: '', fecha_cotizacion: format(new Date(),'yyyy-MM-dd'), estado: 'pendiente' as const, moneda: 'ARS' as 'ARS'|'USD', monto_total: '', plazo_entrega_dias: '', condicion_pago: '', observaciones: '' })
  const [saving, setSaving] = useState(false)

  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
  if (!licitacion) return <div className="text-gray-400 p-6">No encontrado</div>

  const cfg = ESTADO_CFG[licitacion.estado]
  const cotizacionesRecibidas = cotizaciones.filter(c => c.monto_total && c.estado !== 'rechazada')
  const minCot = cotizacionesRecibidas.length
    ? cotizacionesRecibidas.reduce((min, c) => (c.monto_total ?? Infinity) < (min.monto_total ?? Infinity) ? c : min)
    : null

  return (
    <div className="flex-1 overflow-auto space-y-5">
      {/* Header detalle */}
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={onBack} className="btn-ghost text-sm flex items-center gap-1.5 shrink-0">← Volver</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-gray-900">{licitacion.numero}</h2>
            <span className={cn('badge text-[10px]', cfg.cls)}>{cfg.label}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{licitacion.descripcion}</p>
          {licitacion.emprendimiento && <p className="text-xs text-gray-400">{licitacion.emprendimiento.nombre}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={reload} className="text-gray-400 hover:text-primary"><RefreshCw size={14}/></button>
          {licitacion.estado === 'abierta' && (
            <button onClick={()=>updateCotizacion(id, {estado:'en_evaluacion'} as unknown as Parameters<typeof updateCotizacion>[1])} className="btn-ghost text-sm border border-amber-200 text-amber-700 hover:bg-amber-50">
              Pasar a evaluación
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Items a cotizar */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 text-sm">Ítems a cotizar ({items.length})</h3>
            <button onClick={() => setShowAddItem(true)} className="btn-ghost text-xs flex items-center gap-1.5"><Plus size={12}/> Agregar ítem</button>
          </div>
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                <p className="font-medium text-gray-800">{item.descripcion}</p>
                {item.cantidad && <p className="text-xs text-gray-400 mt-0.5">{item.cantidad} {item.unidad}</p>}
                {item.especificaciones && <p className="text-xs text-gray-400 italic">{item.especificaciones}</p>}
              </div>
            ))}
            {!items.length && <p className="text-xs text-gray-400 text-center py-4">Sin ítems. Agregá los materiales/servicios a cotizar.</p>}
          </div>
        </div>

        {/* Cotizaciones */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 text-sm">Cotizaciones ({cotizaciones.length})</h3>
            <button onClick={() => setShowAddCot(true)} className="btn-ghost text-xs flex items-center gap-1.5"><Plus size={12}/> Agregar</button>
          </div>
          <div className="space-y-2">
            {cotizaciones.map(cot => {
              const prov = cot.proveedor as Record<string,string>|null
              const isMin = minCot?.id === cot.id
              return (
                <div key={cot.id} className={cn('p-3 rounded-lg border transition-all', isMin ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-gray-50')}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{prov?.razon_social ?? '—'}</p>
                      {cot.fecha_cotizacion && <p className="text-[10px] text-gray-400">{format(new Date(cot.fecha_cotizacion),'dd/MM/yyyy')}</p>}
                    </div>
                    <div className="text-right">
                      {cot.monto_total
                        ? <p className={cn('font-bold text-sm', isMin ? 'text-green-700' : 'text-gray-800')}>
                            {cot.moneda === 'USD' ? fmtUSD(cot.monto_total) : fmtARS(cot.monto_total)}
                            {isMin && <span className="ml-1 text-[9px] bg-green-600 text-white px-1 rounded">MENOR</span>}
                          </p>
                        : <span className="badge badge-warning text-[9px]">Pendiente</span>
                      }
                    </div>
                  </div>
                  {cot.plazo_entrega_dias && <p className="text-[10px] text-gray-400 mt-1">Plazo: {cot.plazo_entrega_dias} días · {cot.condicion_pago}</p>}
                  {cot.observaciones && <p className="text-[10px] text-gray-500 mt-1 italic">{cot.observaciones}</p>}
                  <div className="flex gap-2 mt-2">
                    {cot.estado === 'pendiente' && (
                      <button onClick={()=>updateCotizacion(cot.id, {estado:'recibida'})} className="text-xs text-primary hover:underline">Marcar recibida</button>
                    )}
                    {cot.estado !== 'adjudicada' && licitacion.estado !== 'adjudicada' && cot.monto_total && (
                      <button onClick={async()=>{ if(confirm(`¿Adjudicar a ${prov?.razon_social}?`)) { setSaving(true); try { await adjudicar(cot.id, cot.proveedor_id) } catch(e){alert(e instanceof Error?e.message:'Error')} finally{setSaving(false)} } }}
                        disabled={saving} className="flex items-center gap-1 text-xs text-green-700 hover:underline">
                        <Trophy size={10}/> Adjudicar
                      </button>
                    )}
                    {cot.estado === 'adjudicada' && <span className="badge badge-success text-[9px]">✓ Adjudicada</span>}
                  </div>
                </div>
              )
            })}
            {!cotizaciones.length && <p className="text-xs text-gray-400 text-center py-4">Sin cotizaciones recibidas aún.</p>}
          </div>
        </div>
      </div>

      {/* Tabla comparativa */}
      {cotizacionesRecibidas.length > 1 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Tabla comparativa de cotizaciones</h3>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right">Monto total</th>
                <th className="px-4 py-3 text-center">Plazo entrega</th>
                <th className="px-4 py-3 text-left">Cond. pago</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Ranking</th>
              </tr></thead>
              <tbody>
                {[...cotizacionesRecibidas]
                  .sort((a,b) => (a.monto_total ?? Infinity) - (b.monto_total ?? Infinity))
                  .map((cot, i) => {
                    const prov = cot.proveedor as Record<string,string>|null
                    return (
                      <tr key={cot.id} className={cn(i===0?'bg-green-50':'', i%2===0&&i>0?'bg-white':'bg-gray-50/40')}>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{prov?.razon_social ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold">{cot.moneda==='USD'?fmtUSD(cot.monto_total!):fmtARS(cot.monto_total!)}</td>
                        <td className="px-4 py-2.5 text-center text-gray-500">{cot.plazo_entrega_dias ? `${cot.plazo_entrega_dias}d` : '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500">{cot.condicion_pago ?? '—'}</td>
                        <td className="px-4 py-2.5 text-center"><span className={cn('badge text-[9px]', cot.estado==='adjudicada'?'badge-success':cot.estado==='rechazada'?'badge-danger':'badge-info')}>{cot.estado}</span></td>
                        <td className="px-4 py-2.5 text-center font-bold text-lg">{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}°`}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal agregar ítem */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="font-bold">Agregar ítem</h2><button onClick={()=>setShowAddItem(false)}><X size={18} className="text-gray-400"/></button></div>
            <div className="px-6 py-5 space-y-3">
              <div><label className={lb}>Descripción *</label><input className={fi} autoFocus value={itemForm.descripcion} onChange={e=>setItemForm(p=>({...p,descripcion:e.target.value}))}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lb}>Unidad</label><input className={fi} value={itemForm.unidad} onChange={e=>setItemForm(p=>({...p,unidad:e.target.value}))}/></div>
                <div><label className={lb}>Cantidad</label><input type="number" className={fi} value={itemForm.cantidad} onChange={e=>setItemForm(p=>({...p,cantidad:e.target.value}))}/></div>
              </div>
              <div><label className={lb}>Especificaciones</label><textarea className={fi} rows={2} value={itemForm.especificaciones} onChange={e=>setItemForm(p=>({...p,especificaciones:e.target.value}))}/></div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={()=>setShowAddItem(false)} className="btn-ghost">Cancelar</button>
              <button disabled={!itemForm.descripcion} onClick={async()=>{
                try{await addItem({licitacion_id:id,descripcion:itemForm.descripcion,unidad:itemForm.unidad||undefined,cantidad:itemForm.cantidad?Number(itemForm.cantidad):undefined,especificaciones:itemForm.especificaciones||undefined});setShowAddItem(false);setItemForm({licitacion_id:id,descripcion:'',unidad:'',cantidad:'',especificaciones:''})}catch(e){alert(e instanceof Error?e.message:'Error')}
              }} className="btn-primary disabled:opacity-50">Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar cotización */}
      {showAddCot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="font-bold">Cargar cotización</h2><button onClick={()=>setShowAddCot(false)}><X size={18} className="text-gray-400"/></button></div>
            <div className="px-6 py-5 space-y-3">
              <div><label className={lb}>Proveedor *</label>
                <select className={fi} value={cotForm.proveedor_id} onChange={e=>setCotForm(p=>({...p,proveedor_id:e.target.value}))}>
                  <option value="">— Seleccioná —</option>
                  {proveedores.map(p=><option key={p.id} value={p.id}>{p.razon_social}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={lb}>Fecha cotización</label><input type="date" className={fi} value={cotForm.fecha_cotizacion} onChange={e=>setCotForm(p=>({...p,fecha_cotizacion:e.target.value}))}/></div>
                <div><label className={lb}>Moneda</label>
                  <select className={fi} value={cotForm.moneda} onChange={e=>setCotForm(p=>({...p,moneda:e.target.value as 'ARS'|'USD'}))}>
                    <option value="ARS">ARS</option><option value="USD">USD</option>
                  </select>
                </div>
                <div><label className={lb}>Monto total</label><input type="number" className={fi} value={cotForm.monto_total} onChange={e=>setCotForm(p=>({...p,monto_total:e.target.value}))}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lb}>Plazo entrega (días)</label><input type="number" className={fi} value={cotForm.plazo_entrega_dias} onChange={e=>setCotForm(p=>({...p,plazo_entrega_dias:e.target.value}))}/></div>
                <div><label className={lb}>Condición de pago</label><input className={fi} value={cotForm.condicion_pago} onChange={e=>setCotForm(p=>({...p,condicion_pago:e.target.value}))}/></div>
              </div>
              <div><label className={lb}>Observaciones</label><textarea className={fi} rows={2} value={cotForm.observaciones} onChange={e=>setCotForm(p=>({...p,observaciones:e.target.value}))}/></div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={()=>setShowAddCot(false)} className="btn-ghost">Cancelar</button>
              <button disabled={!cotForm.proveedor_id} onClick={async()=>{
                try{
                  await addCotizacion({
                    licitacion_id:id,proveedor_id:cotForm.proveedor_id,
                    fecha_cotizacion:cotForm.fecha_cotizacion||undefined,
                    estado: cotForm.monto_total ? 'recibida' : 'pendiente',
                    moneda:cotForm.moneda,
                    monto_total:cotForm.monto_total?Number(cotForm.monto_total):undefined,
                    plazo_entrega_dias:cotForm.plazo_entrega_dias?Number(cotForm.plazo_entrega_dias):undefined,
                    condicion_pago:cotForm.condicion_pago||undefined,
                    observaciones:cotForm.observaciones||undefined,
                  })
                  setShowAddCot(false)
                }catch(e){alert(e instanceof Error?e.message:'Error')}
              }} className="btn-primary disabled:opacity-50">Cargar cotización</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function LicitacionesPage() {
  const { data: emps }               = useEmprendimientos()
  const { data, loading, reload, create } = useLicitaciones()
  const [showNew, setShowNew]        = useState(false)
  const [selId,   setSelId]          = useState<string | null>(null)
  const [filtro,  setFiltro]         = useState('todos')

  if (selId) return (
    <div className="flex flex-col h-full">
      <Header title="Licitaciones" subtitle="Detalle de cotización" />
      <div className="flex-1 overflow-auto p-6">
        <LicitacionDetalle id={selId} onBack={() => setSelId(null)} />
      </div>
    </div>
  )

  const lista = filtro === 'todos' ? data : data.filter(l => l.estado === filtro)

  return (
    <div className="flex flex-col h-full">
      <Header title="Licitaciones y cotizaciones" subtitle="Pedidos de cotización a proveedores"
        actions={<button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2"><Plus size={16}/> Nueva licitación</button>}
      />
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 flex-wrap">
        {['todos','abierta','en_evaluacion','adjudicada','cancelada'].map(f=>(
          <button key={f} onClick={()=>setFiltro(f)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
              filtro===f?'bg-primary text-white':'text-gray-500 hover:bg-gray-50')}>
            {f==='todos'?'Todas':ESTADO_CFG[f as keyof typeof ESTADO_CFG]?.label??f}
          </button>
        ))}
        <button onClick={reload} className="ml-auto text-gray-400 hover:text-primary"><RefreshCw size={14}/></button>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex justify-center h-48"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mt-20"/></div>
        ) : lista.length === 0 ? (
          <div className="card flex flex-col items-center py-16 text-gray-400">
            <p className="font-medium">Sin licitaciones</p>
            <button onClick={() => setShowNew(true)} className="btn-primary mt-4 text-sm"><Plus size={14}/> Nueva licitación</button>
          </div>
        ) : (
          <div className="space-y-3">
            {lista.map(l => {
              const cfg = ESTADO_CFG[l.estado]
              return (
                <div key={l.id} onClick={() => setSelId(l.id)}
                  className="card cursor-pointer hover:shadow-md hover:border-primary/20 transition-all flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 text-sm">{l.numero}</p>
                      <span className={cn('badge text-[10px]', cfg.cls)}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{l.descripcion}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {l.emprendimiento?.nombre && <span>{l.emprendimiento.nombre} · </span>}
                      Solicitud: {format(new Date(l.fecha_solicitud),'dd/MM/yyyy',{locale:es})}
                      {l.fecha_limite && ` · Límite: ${format(new Date(l.fecha_limite),'dd/MM/yyyy',{locale:es})}`}
                    </p>
                  </div>
                  {l.proveedor_adjudicado && (
                    <div className="text-right text-xs text-green-700 font-medium shrink-0">
                      <Trophy size={12} className="inline mr-1"/>
                      {(l.proveedor_adjudicado as Record<string,string>).razon_social}
                    </div>
                  )}
                  <ChevronRight size={14} className="text-gray-300 shrink-0"/>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {showNew && (
        <NuevaLicitModal
          emps={emps.map(e => ({ id: e.id, nombre: e.nombre }))}
          onClose={() => setShowNew(false)}
          onCreate={create}
        />
      )}
    </div>
  )
}
