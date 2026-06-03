import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, AlertTriangle, Package, ArrowUp, ArrowDown, RotateCcw, Search, RefreshCw } from 'lucide-react'
import { useMateriales, useDepositos, useMovimientosStock, useStockActual, type MovimientoStock } from '@/hooks/usePanol'
import { useAuth } from '@/context/AuthContext'
import { useEmprendimientos } from '@/hooks/useEmprendimientos'
import { fmtARS } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

const TIPO_CFG = {
  ingreso:    { label: 'Ingreso',     icon: ArrowUp,     cls: 'text-green-600 bg-green-50',  badgeCls: 'badge-success' },
  egreso:     { label: 'Egreso',      icon: ArrowDown,   cls: 'text-red-600 bg-red-50',      badgeCls: 'badge-danger' },
  devolucion: { label: 'Devolución',  icon: RotateCcw,   cls: 'text-blue-600 bg-blue-50',    badgeCls: 'badge-info' },
  ajuste:     { label: 'Ajuste',      icon: Package,     cls: 'text-gray-600 bg-gray-50',    badgeCls: 'badge-gray' },
}

type Tab = 'stock' | 'movimientos' | 'materiales' | 'depositos'

function MovimientoModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (m: Omit<MovimientoStock, 'id' | 'created_at' | 'material' | 'deposito'>) => Promise<void>
}) {
  const { data: materiales } = useMateriales()
  const { data: depositos  } = useDepositos()
  const { data: emps }       = useEmprendimientos()
  const { user }             = useAuth()
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState({
    material_id: '', deposito_id: '', emprendimiento_id: '',
    tipo: 'ingreso' as MovimientoStock['tipo'],
    cantidad: '', costo_unitario: '', fecha: hoy,
    descripcion: '', remito: '',
  })
  const [saving, setSaving] = useState(false)
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Registrar movimiento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            {(Object.entries(TIPO_CFG) as [MovimientoStock['tipo'], typeof TIPO_CFG.ingreso][]).map(([tipo, cfg]) => {
              const Icon = cfg.icon
              return (
                <button key={tipo} type="button" onClick={() => setForm(p => ({ ...p, tipo }))}
                  className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                    form.tipo === tipo ? 'bg-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}>
                  <Icon size={12}/> {cfg.label}
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className={lb}>Material *</label>
              <select className={fi} value={form.material_id} onChange={e => setForm(p => ({ ...p, material_id: e.target.value }))}>
                <option value="">— Seleccioná —</option>
                {materiales.map(m => <option key={m.id} value={m.id}>{m.codigo ? `[${m.codigo}] ` : ''}{m.descripcion} ({m.unidad})</option>)}
              </select>
            </div>
            <div><label className={lb}>Depósito *</label>
              <select className={fi} value={form.deposito_id} onChange={e => setForm(p => ({ ...p, deposito_id: e.target.value }))}>
                <option value="">— Seleccioná —</option>
                {depositos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
            <div><label className={lb}>Obra (opcional)</label>
              <select className={fi} value={form.emprendimiento_id} onChange={e => setForm(p => ({ ...p, emprendimiento_id: e.target.value }))}>
                <option value="">— Sin asignar —</option>
                {emps.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div><label className={lb}>Cantidad *</label>
              <input type="number" min="0.001" step="0.001" className={fi} value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))}/>
            </div>
            <div><label className={lb}>Costo unitario (ARS)</label>
              <input type="number" min="0" className={fi} value={form.costo_unitario} onChange={e => setForm(p => ({ ...p, costo_unitario: e.target.value }))}/>
            </div>
            <div><label className={lb}>Fecha *</label>
              <input type="date" className={fi} value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}/>
            </div>
            <div><label className={lb}>N° remito / factura</label>
              <input className={fi} value={form.remito} onChange={e => setForm(p => ({ ...p, remito: e.target.value }))}/>
            </div>
            <div className="col-span-2"><label className={lb}>Descripción / tarea *</label>
              <input className={fi} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} autoFocus/>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button disabled={saving || !form.material_id || !form.deposito_id || !form.cantidad || !form.descripcion}
            onClick={async () => {
              setSaving(true)
              try {
                await onSave({
                  material_id: form.material_id, deposito_id: form.deposito_id,
                  emprendimiento_id: form.emprendimiento_id || undefined,
                  tipo: form.tipo, cantidad: Number(form.cantidad),
                  costo_unitario: form.costo_unitario ? Number(form.costo_unitario) : undefined,
                  fecha: form.fecha, descripcion: form.descripcion,
                  remito: form.remito || undefined, usuario_id: user?.id,
                })
                onClose()
              } catch (e) { alert(e instanceof Error ? e.message : 'Error') }
              finally { setSaving(false) }
            }} className="btn-primary disabled:opacity-50">{saving ? 'Guardando...' : 'Registrar'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Panol() {
  const [tab, setTab] = useState<Tab>('stock')
  const [search, setSearch] = useState('')
  const [showMov, setShowMov] = useState(false)
  const [nuevoMaterial, setNuevoMaterial] = useState(false)
  const [nuevoDeposito, setNuevoDeposito] = useState(false)

  const { data: stock, loading: loadStock, reload: reloadStock, alertas } = useStockActual()
  const { data: movs, loading: loadMov, registrar } = useMovimientosStock()
  const { data: mats, loading: loadMat, reload: reloadMat, create: createMat } = useMateriales()
  const { data: deps, reload: reloadDep, create: createDep } = useDepositos()

  const stockFiltrado = useMemo(() => {
    const q = search.toLowerCase()
    return stock.filter(s => !q || s.descripcion.toLowerCase().includes(q) || (s.codigo ?? '').toLowerCase().includes(q))
  }, [stock, search])

  const TABS_CFG = [
    { id: 'stock' as Tab, label: `Stock actual${alertas.length ? ` (${alertas.length} ⚠)` : ''}` },
    { id: 'movimientos' as Tab, label: 'Movimientos' },
    { id: 'materiales' as Tab, label: 'Materiales' },
    { id: 'depositos' as Tab, label: 'Depósitos' },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header title="Pañol y depósito" subtitle="Control de stock de materiales y herramientas"
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowMov(true)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={15}/> Movimiento</button>
          </div>
        }
      />

      {alertas.length > 0 && (
        <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle size={15} className="shrink-0"/>
          <strong>{alertas.length} material{alertas.length > 1 ? 'es' : ''}</strong> con stock mínimo o por debajo:
          <span className="text-xs">{alertas.slice(0,3).map(a => a.descripcion).join(', ')}{alertas.length > 3 ? '...' : ''}</span>
        </div>
      )}

      <div className="bg-white border-b border-gray-100 px-6">
        <div className="flex gap-0">
          {TABS_CFG.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* ── STOCK ── */}
        {tab === 'stock' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
              <button onClick={reloadStock} className="text-gray-400 hover:text-primary"><RefreshCw size={14}/></button>
            </div>
            {loadStock ? <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div> : (
              <div className="card overflow-hidden p-0">
                <table className="w-full text-sm">
                  <thead><tr className="table-header">
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-4 py-3 text-left">Material</th>
                    <th className="px-4 py-3 text-left">Categoría</th>
                    <th className="px-4 py-3 text-left">Depósito</th>
                    <th className="px-4 py-3 text-center">Unidad</th>
                    <th className="px-4 py-3 text-right">Stock actual</th>
                    <th className="px-4 py-3 text-right">Stock mínimo</th>
                    <th className="px-4 py-3 text-right">Valor (costo prom.)</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {stockFiltrado.map((s, i) => {
                      const bajo = s.stock_actual <= s.stock_minimo && s.stock_minimo > 0
                      const valor = s.stock_actual * s.costo_promedio
                      return (
                        <tr key={`${s.material_id}-${s.deposito_id}`} className={cn(i%2===0?'bg-white':'bg-gray-50/40', bajo && 'bg-amber-50/60')}>
                          <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{s.codigo ?? '—'}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-800">{s.descripcion}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{s.categoria ?? '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{s.deposito}</td>
                          <td className="px-4 py-2.5 text-center text-xs text-gray-500">{s.unidad}</td>
                          <td className={cn('px-4 py-2.5 text-right font-mono font-semibold', bajo ? 'text-amber-600' : 'text-gray-900')}>{s.stock_actual.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-xs text-gray-400 font-mono">{s.stock_minimo.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">{fmtARS(valor)}</td>
                          <td className="px-4 py-2.5 text-center">
                            {bajo
                              ? <span className="badge badge-warning text-[9px]">⚠ Bajo</span>
                              : <span className="badge badge-success text-[9px]">OK</span>}
                          </td>
                        </tr>
                      )
                    })}
                    {stockFiltrado.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Sin materiales</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── MOVIMIENTOS ── */}
        {tab === 'movimientos' && (
          loadMov ? <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div> : (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead><tr className="table-header">
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Material</th>
                  <th className="px-4 py-3 text-left">Depósito</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-left">Descripción</th>
                  <th className="px-4 py-3 text-left">Remito</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {movs.map((m, i) => {
                    const cfg = TIPO_CFG[m.tipo]
                    const Icon = cfg.icon
                    return (
                      <tr key={m.id} className={i%2===0?'bg-white':'bg-gray-50/40'}>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{format(new Date(m.fecha), 'dd/MM/yy', {locale:es})}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn('badge text-[10px] flex items-center gap-1 w-fit', cfg.badgeCls)}>
                            <Icon size={9}/> {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-800">{(m.material as Record<string,string>|null)?.descripcion ?? '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{(m.deposito as Record<string,string>|null)?.nombre ?? '—'}</td>
                        <td className={cn('px-4 py-2.5 text-right font-mono font-semibold', m.tipo === 'egreso' ? 'text-red-600' : 'text-green-600')}>
                          {m.tipo === 'egreso' ? '-' : '+'}{m.cantidad.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 max-w-xs truncate">{m.descripcion}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{m.remito ?? '—'}</td>
                      </tr>
                    )
                  })}
                  {movs.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Sin movimientos registrados</td></tr>}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── MATERIALES ── */}
        {tab === 'materiales' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setNuevoMaterial(true)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={14}/> Nuevo material</button>
            </div>
            {loadMat ? <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div> : (
              <div className="card overflow-hidden p-0">
                <table className="w-full text-sm">
                  <thead><tr className="table-header">
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-4 py-3 text-left">Descripción</th>
                    <th className="px-4 py-3 text-left">Categoría</th>
                    <th className="px-4 py-3 text-center">Unidad</th>
                    <th className="px-4 py-3 text-right">Stock mínimo</th>
                    <th className="px-4 py-3 text-right">Costo promedio</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {mats.map((m, i) => (
                      <tr key={m.id} className={i%2===0?'bg-white':'bg-gray-50/40'}>
                        <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{m.codigo ?? '—'}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{m.descripcion}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{m.categoria ?? '—'}</td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-500">{m.unidad}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600">{m.stock_minimo.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600">{fmtARS(m.costo_promedio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── DEPÓSITOS ── */}
        {tab === 'depositos' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setNuevoDeposito(true)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={14}/> Nuevo depósito</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deps.map(d => (
                <div key={d.id} className="card">
                  <p className="font-semibold text-gray-900">{d.nombre}</p>
                  <p className="text-xs text-gray-400 mt-1">{d.descripcion ?? 'Sin descripción'}</p>
                </div>
              ))}
              {deps.length === 0 && <p className="text-gray-400 text-sm">Sin depósitos configurados</p>}
            </div>
          </div>
        )}
      </div>

      {showMov && <MovimientoModal onClose={() => setShowMov(false)} onSave={async m => { await registrar(m); reloadStock() }} />}

      {nuevoMaterial && (
        <NuevoMaterialModal onClose={() => setNuevoMaterial(false)} onCreate={async input => { await createMat(input); reloadMat(); reloadStock() }} />
      )}
      {nuevoDeposito && (
        <NuevoDepositoModal onClose={() => setNuevoDeposito(false)} onCreate={async input => { await createDep(input); reloadDep() }} />
      )}
    </div>
  )
}

function NuevoMaterialModal({ onClose, onCreate }: { onClose: () => void; onCreate: (i: Parameters<ReturnType<typeof useMateriales>['create']>[0]) => Promise<void> }) {
  const [form, setForm] = useState({ descripcion: '', codigo: '', unidad: 'm2', categoria: '', stock_minimo: 0, costo_promedio: 0, activo: true })
  const [saving, setSaving] = useState(false)
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Nuevo material</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400"/></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Código</label><input className={fi} value={form.codigo} onChange={e => setForm(p=>({...p,codigo:e.target.value}))}/></div>
            <div><label className={lb}>Unidad</label>
              <select className={fi} value={form.unidad} onChange={e => setForm(p=>({...p,unidad:e.target.value}))}>
                {['m2','m3','ml','kg','tn','unid','gl','hs','litro','bolsa'].map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div><label className={lb}>Descripción *</label><input className={fi} autoFocus value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))}/></div>
          <div><label className={lb}>Categoría</label><input className={fi} value={form.categoria} onChange={e=>setForm(p=>({...p,categoria:e.target.value}))} placeholder="ferretería, eléctrico, sanitario..."/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Stock mínimo</label><input type="number" className={fi} value={form.stock_minimo} onChange={e=>setForm(p=>({...p,stock_minimo:Number(e.target.value)}))}/></div>
            <div><label className={lb}>Costo prom. inicial</label><input type="number" className={fi} value={form.costo_promedio} onChange={e=>setForm(p=>({...p,costo_promedio:Number(e.target.value)}))}/></div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button disabled={saving||!form.descripcion} onClick={async()=>{setSaving(true);try{await onCreate(form);onClose()}catch(e){alert(e instanceof Error?e.message:'Error')}finally{setSaving(false)}}} className="btn-primary disabled:opacity-50">{saving?'Guardando...':'Crear'}</button>
        </div>
      </div>
    </div>
  )
}

function NuevoDepositoModal({ onClose, onCreate }: { onClose: () => void; onCreate: (i: Parameters<ReturnType<typeof useDepositos>['create']>[0]) => Promise<void> }) {
  const { data: emps } = useEmprendimientos()
  const [form, setForm] = useState({ nombre: '', descripcion: '', emprendimiento_id: '' as string|undefined, activo: true })
  const [saving, setSaving] = useState(false)
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Nuevo depósito</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400"/></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div><label className={lb}>Nombre *</label><input className={fi} autoFocus value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
          <div><label className={lb}>Descripción</label><textarea className={fi} rows={2} value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))}/></div>
          <div><label className={lb}>Emprendimiento (opcional)</label>
            <select className={fi} value={form.emprendimiento_id??''} onChange={e=>setForm(p=>({...p,emprendimiento_id:e.target.value||undefined}))}>
              <option value="">— Sin asignar —</option>
              {emps.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button disabled={saving||!form.nombre} onClick={async()=>{setSaving(true);try{await onCreate(form);onClose()}catch(e){alert(e instanceof Error?e.message:'Error')}finally{setSaving(false)}}} className="btn-primary disabled:opacity-50">{saving?'Guardando...':'Crear'}</button>
        </div>
      </div>
    </div>
  )
}
