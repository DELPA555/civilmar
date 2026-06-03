import { useState } from 'react'
import { Plus, Trash2, Edit2, X, Download, FileDown, ChevronRight, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { usePresupuestos, usePresupuestoDetalle, RUBROS, type ItemPresupuesto } from '@/hooks/usePresupuesto'
import { useEmprendimientos } from '@/hooks/useEmprendimientos'
import { fmtARS } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

// ── Modal nuevo presupuesto ───────────────────────────────────────────────────

function NuevoPresModal({ emprendimientos, onClose, onCreate }: {
  emprendimientos: { id: string; nombre: string }[]
  onClose: () => void
  onCreate: (input: { emprendimiento_id: string; descripcion: string; moneda: 'ARS'|'USD'; superficie_total: number; estado: 'borrador' }) => Promise<unknown>
}) {
  const [form, setForm] = useState({ emprendimiento_id: '', descripcion: '', moneda: 'ARS' as 'ARS'|'USD', superficie_total: '' })
  const [saving, setSaving] = useState(false)
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Nuevo presupuesto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div><label className={lb}>Emprendimiento *</label>
            <select className={fi} value={form.emprendimiento_id} onChange={e => setForm(p => ({ ...p, emprendimiento_id: e.target.value }))}>
              <option value="">— Seleccioná —</option>
              {emprendimientos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
          <div><label className={lb}>Descripción</label>
            <input className={fi} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Presupuesto inicial v1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Moneda</label>
              <select className={fi} value={form.moneda} onChange={e => setForm(p => ({ ...p, moneda: e.target.value as 'ARS'|'USD' }))}>
                <option value="ARS">ARS (pesos)</option><option value="USD">USD (dólares)</option>
              </select>
            </div>
            <div><label className={lb}>Superficie total (m²)</label>
              <input type="number" className={fi} value={form.superficie_total} onChange={e => setForm(p => ({ ...p, superficie_total: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button disabled={saving || !form.emprendimiento_id} onClick={async () => {
            setSaving(true)
            try {
              await onCreate({ ...form, superficie_total: Number(form.superficie_total) || 0, estado: 'borrador' })
              onClose()
            } catch (e) { alert(e instanceof Error ? e.message : 'Error') }
            finally { setSaving(false) }
          }} className="btn-primary disabled:opacity-50">{saving ? 'Creando...' : 'Crear presupuesto'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Modal agregar/editar ítem ─────────────────────────────────────────────────

function ItemModal({ presupuestoId, item, onClose, onSave }: {
  presupuestoId: string
  item?: ItemPresupuesto
  onClose: () => void
  onSave: (input: Omit<ItemPresupuesto, 'id'|'total'>) => Promise<void>
}) {
  const [form, setForm] = useState({
    presupuesto_id: presupuestoId,
    rubro: item?.rubro ?? RUBROS[0],
    descripcion: item?.descripcion ?? '',
    unidad: item?.unidad ?? 'm2',
    cantidad: item?.cantidad ?? 0,
    precio_unitario_materiales: item?.precio_unitario_materiales ?? 0,
    precio_unitario_mano_obra: item?.precio_unitario_mano_obra ?? 0,
    precio_unitario_equipos: item?.precio_unitario_equipos ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'
  const totalCalc = form.cantidad * (form.precio_unitario_materiales + form.precio_unitario_mano_obra + form.precio_unitario_equipos)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{item ? 'Editar ítem' : 'Agregar ítem'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div><label className={lb}>Rubro *</label>
            <select className={fi} value={form.rubro} onChange={e => setForm(p => ({ ...p, rubro: e.target.value }))}>
              {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div><label className={lb}>Descripción *</label>
            <input className={fi} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Unidad</label>
              <select className={fi} value={form.unidad} onChange={e => setForm(p => ({ ...p, unidad: e.target.value }))}>
                {['m2','m3','ml','kg','tn','unid','gl','hs','jorn'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div><label className={lb}>Cantidad</label>
              <input type="number" className={fi} value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([['Materiales','precio_unitario_materiales'],['Mano de obra','precio_unitario_mano_obra'],['Equipos','precio_unitario_equipos']] as [string, keyof typeof form][]).map(([label, key]) => (
              <div key={key}><label className={lb}>{label} ($/unit)</label>
                <input type="number" className={fi} value={form[key] as number} onChange={e => setForm(p => ({ ...p, [key]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
          <div className="p-3 bg-primary/5 rounded-lg text-center">
            <p className="text-xs text-gray-500">TOTAL ÍTEM</p>
            <p className="text-xl font-bold text-primary">{fmtARS(totalCalc)}</p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button disabled={saving || !form.descripcion.trim()} onClick={async () => {
            setSaving(true)
            try { await onSave(form); onClose() }
            catch (e) { alert(e instanceof Error ? e.message : 'Error') }
            finally { setSaving(false) }
          }} className="btn-primary disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar ítem'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Vista detalle del presupuesto ─────────────────────────────────────────────

function PresupuestoDetalle({ presId, onBack }: { presId: string; onBack: () => void }) {
  const { presupuesto, items, loading, reload, addItem, updateItem, deleteItem, totalesPorRubro, totalGeneral, costoPorM2 } = usePresupuestoDetalle(presId)
  const [modalItem, setModalItem] = useState<ItemPresupuesto | 'nuevo' | null>(null)

  const exportExcel = () => {
    if (!presupuesto) return
    const ws = XLSX.utils.json_to_sheet(items.map(i => ({
      Rubro: i.rubro, Descripción: i.descripcion, Unidad: i.unidad, Cantidad: i.cantidad,
      'Mat. $/unit': i.precio_unitario_materiales, 'M.O. $/unit': i.precio_unitario_mano_obra,
      'Equip. $/unit': i.precio_unitario_equipos, 'Total ($)': i.total,
    })))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'APU')
    XLSX.writeFile(wb, `presupuesto_${presupuesto.emprendimiento?.nombre?.replace(/\s+/g,'_') ?? 'obra'}.xlsx`)
  }

  const exportPDF = () => {
    if (!presupuesto) return
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFillColor(26,58,92); doc.rect(0,0,297,18,'F')
    doc.setTextColor(255); doc.setFontSize(13); doc.setFont('helvetica','bold')
    doc.text(`PRESUPUESTO APU — ${presupuesto.emprendimiento?.nombre?.toUpperCase() ?? ''}`, 15, 12)
    doc.setTextColor(0)
    autoTable(doc, {
      startY: 22,
      head: [['Rubro','Descripción','Unidad','Cant.','Mat.$/u','MO$/u','Eq.$/u','Total']],
      body: items.map(i => [i.rubro.slice(0,20), i.descripcion, i.unidad,
        i.cantidad.toLocaleString(), fmtARS(i.precio_unitario_materiales),
        fmtARS(i.precio_unitario_mano_obra), fmtARS(i.precio_unitario_equipos), fmtARS(i.total)]),
      foot: [['','','','','','','TOTAL GENERAL', fmtARS(totalGeneral)]],
      styles: { fontSize: 7 },
      headStyles: { fillColor: [26,58,92], textColor: 255 },
      footStyles: { fillColor: [201,168,76], textColor: [26,58,92], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248,249,250] },
      margin: { left: 10, right: 10 },
    })
    doc.save(`presupuesto_${presupuesto.emprendimiento?.nombre?.replace(/\s+/g,'_') ?? 'obra'}.pdf`)
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>

  const rubrosList = [...new Set(items.map(i => i.rubro))]

  return (
    <div className="flex-1 overflow-auto space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="btn-ghost text-sm flex items-center gap-1.5">← Volver</button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900">{presupuesto?.emprendimiento?.nombre}</h2>
          <p className="text-xs text-gray-400">{presupuesto?.descripcion ?? 'Sin descripción'}</p>
        </div>
        <button onClick={() => setModalItem('nuevo')} className="btn-primary flex items-center gap-2 text-sm"><Plus size={14}/> Agregar ítem</button>
        <button onClick={exportExcel} className="flex items-center gap-1.5 text-xs text-green-700 border border-green-200 hover:bg-green-50 px-3 py-1.5 rounded-lg"><FileDown size={12}/> Excel</button>
        <button onClick={exportPDF} className="flex items-center gap-1.5 text-xs text-primary border border-primary/20 hover:bg-primary/5 px-3 py-1.5 rounded-lg"><Download size={12}/> PDF</button>
        <button onClick={reload} className="text-gray-400 hover:text-primary"><RefreshCw size={14}/></button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total presupuesto', value: fmtARS(totalGeneral), cls: 'text-primary' },
          { label: 'Costo por m²', value: costoPorM2 > 0 ? fmtARS(costoPorM2) : '—', cls: 'text-blue-700' },
          { label: 'Ítems', value: String(items.length), cls: 'text-gray-700' },
          { label: 'Rubros', value: String(rubrosList.length), cls: 'text-gray-700' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className={cn('text-xl font-bold', s.cls)}>{s.value}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabla por rubro */}
      {rubrosList.length === 0 ? (
        <div className="card flex flex-col items-center py-12 text-gray-400">
          <p className="font-medium">Sin ítems cargados</p>
          <button onClick={() => setModalItem('nuevo')} className="btn-primary mt-4 text-sm"><Plus size={14}/> Agregar primer ítem</button>
        </div>
      ) : (
        rubrosList.map(rubro => {
          const rubroItems = items.filter(i => i.rubro === rubro)
          return (
            <div key={rubro} className="card overflow-hidden p-0">
              <div className="px-4 py-2.5 bg-primary/5 border-b border-primary/10 flex items-center justify-between">
                <span className="text-xs font-bold text-primary uppercase tracking-wide">{rubro}</span>
                <span className="text-xs font-bold text-primary">{fmtARS(totalesPorRubro[rubro] ?? 0)}</span>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="table-header">
                  <th className="px-4 py-2 text-left">Descripción</th>
                  <th className="px-4 py-2 text-center">Unidad</th>
                  <th className="px-4 py-2 text-right">Cantidad</th>
                  <th className="px-4 py-2 text-right">Materiales</th>
                  <th className="px-4 py-2 text-right">M. de obra</th>
                  <th className="px-4 py-2 text-right">Equipos</th>
                  <th className="px-4 py-2 text-right font-bold">Total</th>
                  <th className="px-4 py-2 w-16"/>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {rubroItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-2 text-gray-800">{item.descripcion}</td>
                      <td className="px-4 py-2 text-center text-gray-500">{item.unidad}</td>
                      <td className="px-4 py-2 text-right font-mono">{item.cantidad.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-600">{fmtARS(item.precio_unitario_materiales)}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-600">{fmtARS(item.precio_unitario_mano_obra)}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-600">{fmtARS(item.precio_unitario_equipos)}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-gray-900">{fmtARS(item.total)}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setModalItem(item)} className="p-1 text-gray-400 hover:text-primary rounded"><Edit2 size={12}/></button>
                          <button onClick={() => { if (confirm('¿Eliminar ítem?')) deleteItem(item.id) }} className="p-1 text-gray-400 hover:text-danger rounded"><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })
      )}

      {items.length > 0 && (
        <div className="card flex items-center justify-between bg-primary/5 border-primary/20">
          <span className="font-bold text-primary">TOTAL GENERAL</span>
          <span className="text-2xl font-bold text-primary">{fmtARS(totalGeneral)}</span>
        </div>
      )}

      {modalItem && (
        <ItemModal
          presupuestoId={presId}
          item={modalItem === 'nuevo' ? undefined : modalItem}
          onClose={() => setModalItem(null)}
          onSave={async input => {
            if (modalItem === 'nuevo') await addItem(input)
            else await updateItem((modalItem as ItemPresupuesto).id, input)
          }}
        />
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PresupuestoObra() {
  const { data: emps }                          = useEmprendimientos()
  const { data, loading, reload, create }       = usePresupuestos()
  const [showNew,   setShowNew]                 = useState(false)
  const [presSelId, setPresSelId]               = useState<string | null>(null)

  if (presSelId) return (
    <div className="flex flex-col h-full">
      <Header title="Presupuesto APU" subtitle="Detalle y edición" />
      <div className="flex-1 overflow-auto p-6">
        <PresupuestoDetalle presId={presSelId} onBack={() => setPresSelId(null)} />
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <Header title="Presupuesto APU" subtitle="Análisis de precios unitarios por emprendimiento"
        actions={<button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2"><Plus size={16}/> Nuevo presupuesto</button>}
      />
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
        ) : data.length === 0 ? (
          <div className="card flex flex-col items-center py-16 text-gray-400">
            <p className="font-medium">Sin presupuestos cargados</p>
            <button onClick={() => setShowNew(true)} className="btn-primary mt-4 text-sm"><Plus size={14}/> Crear primer presupuesto</button>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map(p => (
              <div key={p.id} onClick={() => setPresSelId(p.id)}
                className="card cursor-pointer hover:shadow-md hover:border-primary/20 transition-all flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{p.emprendimiento?.nombre ?? '—'}</p>
                  <p className="text-xs text-gray-400">{p.descripcion ?? 'Sin descripción'} · v{p.version} · {p.moneda}</p>
                </div>
                <span className={cn('badge text-[10px]',
                  p.estado === 'aprobado' ? 'badge-success' :
                  p.estado === 'revision' ? 'badge-warning' : 'badge-gray'
                )}>{p.estado}</span>
                <ChevronRight size={14} className="text-gray-300 shrink-0"/>
              </div>
            ))}
          </div>
        )}
      </div>
      {showNew && (
        <NuevoPresModal
          emprendimientos={emps.map(e => ({ id: e.id, nombre: e.nombre }))}
          onClose={() => setShowNew(false)}
          onCreate={async input => { await create(input as Parameters<typeof create>[0]); reload() }}
        />
      )}
    </div>
  )
}
