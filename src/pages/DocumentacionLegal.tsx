import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, FileText, AlertTriangle, CheckCircle, Clock, Search, RefreshCw, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useEmprendimientos } from '@/hooks/useEmprendimientos'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

interface DocLegal {
  id: string
  tipo: string
  entidad_tipo: string
  entidad_id: string
  descripcion?: string
  fecha_emision?: string
  fecha_vencimiento?: string
  documento_url?: string
  notas?: string
  created_at: string
  entidad_nombre?: string  // joined
}

const TIPO_LABELS: Record<string, string> = {
  habilitacion_municipal: 'Habilitación municipal',
  seguro_obra:            'Seguro de obra',
  art:                    'ART',
  poliza_caucion:         'Póliza de caución',
  plano_aprobado:         'Plano aprobado',
  permiso_construccion:   'Permiso de construcción',
  certificado_afip:       'Certificado AFIP',
  otro:                   'Otro',
}

function estadoDoc(fechaVenc?: string): { label: string; cls: string; icon: typeof CheckCircle; dias: number | null } {
  if (!fechaVenc) return { label: 'Sin vencimiento', cls: 'badge-gray', icon: CheckCircle, dias: null }
  const dias = differenceInDays(new Date(fechaVenc), new Date())
  if (dias < 0)  return { label: `Vencido (${Math.abs(dias)}d)`,  cls: 'bg-red-100 text-red-700',    icon: AlertTriangle, dias }
  if (dias <= 7) return { label: `Vence en ${dias}d`,             cls: 'bg-orange-100 text-orange-700', icon: AlertTriangle, dias }
  if (dias <= 30) return { label: `Vence en ${dias}d`,            cls: 'bg-amber-100 text-amber-700',  icon: Clock,         dias }
  return { label: `Vence ${format(new Date(fechaVenc), 'dd/MM/yyyy')}`, cls: 'badge-success', icon: CheckCircle, dias }
}

function NuevoDocModal({ onClose, onSave }: { onClose: () => void; onSave: (d: Omit<DocLegal, 'id' | 'created_at' | 'entidad_nombre'>) => Promise<void> }) {
  const { data: emps } = useEmprendimientos()
  const [contratistas, setContratistas] = useState<{id: string; razon_social: string}[]>([])
  const [form, setForm] = useState({
    tipo: 'seguro_obra', entidad_tipo: 'emprendimiento', entidad_id: '',
    descripcion: '', fecha_emision: '', fecha_vencimiento: '', notas: '',
  })
  const [saving, setSaving] = useState(false)
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'

  useEffect(() => {
    supabase.from('contratistas').select('id, razon_social').eq('estado', 'activo').then(({ data }) => setContratistas(data ?? []))
  }, [])

  const entidades = form.entidad_tipo === 'emprendimiento' ? emps.map(e => ({ id: e.id, nombre: e.nombre }))
    : form.entidad_tipo === 'contratista' ? contratistas.map(c => ({ id: c.id, nombre: c.razon_social }))
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Nuevo documento legal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Tipo de documento *</label>
              <select className={fi} value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className={lb}>Entidad</label>
              <select className={fi} value={form.entidad_tipo} onChange={e => setForm(p => ({ ...p, entidad_tipo: e.target.value, entidad_id: '' }))}>
                <option value="emprendimiento">Emprendimiento</option>
                <option value="contratista">Contratista</option>
              </select>
            </div>
          </div>
          <div><label className={lb}>{form.entidad_tipo === 'emprendimiento' ? 'Emprendimiento' : 'Contratista'} *</label>
            <select className={fi} value={form.entidad_id} onChange={e => setForm(p => ({ ...p, entidad_id: e.target.value }))}>
              <option value="">— Seleccioná —</option>
              {entidades.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
          <div><label className={lb}>Descripción</label>
            <input className={fi} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Ej: Póliza N° 12345 — Aseguradora X" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Fecha de emisión</label>
              <input type="date" className={fi} value={form.fecha_emision} onChange={e => setForm(p => ({ ...p, fecha_emision: e.target.value }))} />
            </div>
            <div><label className={lb}>Fecha de vencimiento</label>
              <input type="date" className={fi} value={form.fecha_vencimiento} onChange={e => setForm(p => ({ ...p, fecha_vencimiento: e.target.value }))} />
            </div>
          </div>
          <div><label className={lb}>Notas</label>
            <textarea className={fi} rows={2} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button disabled={saving || !form.entidad_id} onClick={async () => {
            setSaving(true)
            try { await onSave(form); onClose() }
            catch (e) { alert(e instanceof Error ? e.message : 'Error') }
            finally { setSaving(false) }
          }} className="btn-primary disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar documento'}</button>
        </div>
      </div>
    </div>
  )
}

export default function DocumentacionLegal() {
  const [docs,     setDocs]     = useState<DocLegal[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showNew,  setShowNew]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [filtroEst, setFiltroEst] = useState('todos')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('documentos_legales').select('*').order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    // Enriquecer con nombres de entidades
    const enriched: DocLegal[] = await Promise.all((data ?? []).map(async doc => {
      let entidad_nombre = doc.entidad_id
      if (doc.entidad_tipo === 'emprendimiento') {
        const { data: emp } = await supabase.from('emprendimientos').select('nombre').eq('id', doc.entidad_id).single()
        entidad_nombre = emp?.nombre ?? doc.entidad_id
      } else if (doc.entidad_tipo === 'contratista') {
        const { data: ct } = await supabase.from('contratistas').select('razon_social').eq('id', doc.entidad_id).single()
        entidad_nombre = ct?.razon_social ?? doc.entidad_id
      }
      return { ...doc, entidad_nombre } as DocLegal
    }))
    setDocs(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const guardar = async (input: Omit<DocLegal, 'id' | 'created_at' | 'entidad_nombre'>) => {
    const { error } = await supabase.from('documentos_legales').insert(input)
    if (error) throw new Error(error.message)
    await load()
  }

  const porVencer = docs.filter(d => {
    if (!d.fecha_vencimiento) return false
    const dias = differenceInDays(new Date(d.fecha_vencimiento), new Date())
    return dias >= 0 && dias <= 30
  })

  const vencidos = docs.filter(d => {
    if (!d.fecha_vencimiento) return false
    return differenceInDays(new Date(d.fecha_vencimiento), new Date()) < 0
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return docs.filter(d => {
      const matchSearch = !q || d.entidad_nombre?.toLowerCase().includes(q) || d.descripcion?.toLowerCase().includes(q) || TIPO_LABELS[d.tipo]?.toLowerCase().includes(q)
      if (!matchSearch) return false
      if (filtroEst === 'vencido')   return differenceInDays(new Date(d.fecha_vencimiento ?? '9999'), new Date()) < 0
      if (filtroEst === 'por_vencer') return d.fecha_vencimiento && differenceInDays(new Date(d.fecha_vencimiento), new Date()) >= 0 && differenceInDays(new Date(d.fecha_vencimiento), new Date()) <= 30
      if (filtroEst === 'vigente')    return !d.fecha_vencimiento || differenceInDays(new Date(d.fecha_vencimiento), new Date()) > 30
      return true
    })
  }, [docs, search, filtroEst])

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Documentación Legal"
        subtitle="Vencimientos y control de documentos"
        actions={
          <div className="flex gap-2">
            <button onClick={load} className="text-gray-400 hover:text-primary"><RefreshCw size={15} /></button>
            <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Nuevo documento
            </button>
          </div>
        }
      />

      {/* Alertas críticas */}
      {(vencidos.length > 0 || porVencer.length > 0) && (
        <div className="mx-6 mt-4 grid grid-cols-2 gap-3">
          {vencidos.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
              <AlertTriangle size={15} className="shrink-0" />
              <strong>{vencidos.length} documento{vencidos.length > 1 ? 's' : ''} vencido{vencidos.length > 1 ? 's' : ''}</strong>
            </div>
          )}
          {porVencer.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-sm text-amber-700">
              <Clock size={15} className="shrink-0" />
              <strong>{porVencer.length} vencen en los próximos 30 días</strong>
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 flex-wrap mt-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['todos', 'vencido', 'por_vencer', 'vigente'].map(f => (
          <button key={f} onClick={() => setFiltroEst(f)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filtroEst === f ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50')}>
            {f === 'todos' ? 'Todos' : f === 'vencido' ? 'Vencidos' : f === 'por_vencer' ? 'Por vencer' : 'Vigentes'}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} documentos</span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex justify-center h-48 items-center">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <FileText size={36} className="mb-3 text-gray-200" />
            <p className="font-medium">Sin documentos en este filtro</p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Entidad</th>
                  <th className="px-4 py-3 text-left">Descripción</th>
                  <th className="px-4 py-3 text-center">Vencimiento</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((doc, i) => {
                  const est = estadoDoc(doc.fecha_vencimiento)
                  const EstIcon = est.icon
                  return (
                    <tr key={doc.id} className={cn(i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30')}>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-gray-700">{TIPO_LABELS[doc.tipo] ?? doc.tipo}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-800">{doc.entidad_nombre}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{doc.descripcion || '—'}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {doc.fecha_vencimiento ? format(new Date(doc.fecha_vencimiento), 'dd/MM/yyyy', { locale: es }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('badge text-[10px] flex items-center gap-1 w-fit mx-auto', est.cls)}>
                          <EstIcon size={9} /> {est.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {doc.notas && (
                          <button title={doc.notas}
                            className="p-1 text-gray-300 hover:text-gray-600 transition-colors">
                            <MessageCircle size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && <NuevoDocModal onClose={() => setShowNew(false)} onSave={guardar} />}
    </div>
  )
}
