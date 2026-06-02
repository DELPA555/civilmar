import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, MapPin, Calendar, ChevronRight, RefreshCw, X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useEmprendimientos, type Emprendimiento } from '@/hooks/useEmprendimientos'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

type EstadoEmp = 'en_proyecto' | 'en_obra' | 'terminado' | 'entregado'

const ESTADO_CFG: Record<EstadoEmp, { label: string; cls: string; dot: string }> = {
  en_proyecto: { label: 'En proyecto', cls: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
  en_obra:     { label: 'En obra',     cls: 'bg-blue-100 text-blue-800',     dot: 'bg-blue-500' },
  terminado:   { label: 'Terminado',   cls: 'bg-green-100 text-green-800',   dot: 'bg-green-500' },
  entregado:   { label: 'Entregado',   cls: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400' },
}

const ESTADO_UND: Record<string, string> = {
  disponible: 'bg-green-500', reservada: 'bg-yellow-400',
  vendida: 'bg-blue-500', escriturada: 'bg-gray-400', no_disponible: 'bg-red-500',
}

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'en_proyecto', label: 'En proyecto' },
  { value: 'en_obra', label: 'En obra' },
  { value: 'terminado', label: 'Terminados' },
  { value: 'entregado', label: 'Entregados' },
]

// ── Modal Nueva Obra ──────────────────────────────────────────────────────────

type EmpInput = Omit<Emprendimiento, 'id' | 'created_at' | 'updated_at' | 'unidades' | 'avance'>

function NuevaObraModal({ onClose, onCreate }: { onClose: () => void; onCreate: (i: EmpInput) => Promise<unknown> }) {
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: '', descripcion: '', direccion: '', localidad: 'Mar del Plata',
    provincia: 'Buenos Aires', tipo: 'edificio', estado: 'en_proyecto',
    fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
    fecha_fin_estimada: '', meses_obra: 24, total_unidades: 0,
  })
  const F = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      await onCreate({
        nombre: form.nombre, descripcion: form.descripcion, direccion: form.direccion,
        localidad: form.localidad, provincia: form.provincia,
        tipo: form.tipo as Emprendimiento['tipo'],
        estado: form.estado as Emprendimiento['estado'],
        fecha_inicio: form.fecha_inicio || undefined,
        fecha_fin_estimada: form.fecha_fin_estimada || undefined,
        meses_obra: Number(form.meses_obra),
        total_unidades: 0,
      } as EmpInput)
      onClose()
    } catch (e) { alert(e instanceof Error ? e.message : 'Error al guardar') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Nueva obra</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div><label className={lb}>Nombre *</label><input className={fi} autoFocus value={form.nombre} onChange={e => F('nombre', e.target.value)} placeholder="Ej: Torre Norte" /></div>
          <div><label className={lb}>Descripción</label><textarea className={fi} rows={2} value={form.descripcion} onChange={e => F('descripcion', e.target.value)} /></div>
          <div><label className={lb}>Dirección</label><input className={fi} value={form.direccion} onChange={e => F('direccion', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Localidad</label><input className={fi} value={form.localidad} onChange={e => F('localidad', e.target.value)} /></div>
            <div><label className={lb}>Provincia</label><input className={fi} value={form.provincia} onChange={e => F('provincia', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Tipo</label>
              <select className={fi} value={form.tipo} onChange={e => F('tipo', e.target.value)}>
                <option value="edificio">Edificio</option><option value="countries">Countries</option>
                <option value="loteo">Loteo</option><option value="duplex">Dúplex</option><option value="otro">Otro</option>
              </select>
            </div>
            <div><label className={lb}>Estado inicial</label>
              <select className={fi} value={form.estado} onChange={e => F('estado', e.target.value)}>
                <option value="en_proyecto">En proyecto</option><option value="en_obra">En obra</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={lb}>Inicio obra</label><input type="date" className={fi} value={form.fecha_inicio} onChange={e => F('fecha_inicio', e.target.value)} /></div>
            <div><label className={lb}>Entrega estimada</label><input type="date" className={fi} value={form.fecha_fin_estimada} onChange={e => F('fecha_fin_estimada', e.target.value)} /></div>
            <div><label className={lb}>Meses de obra</label><input type="number" min="1" className={fi} value={form.meses_obra} onChange={e => F('meses_obra', e.target.value)} /></div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={save} disabled={saving || !form.nombre.trim()} className="btn-primary disabled:opacity-50">
            {saving ? 'Guardando...' : 'Crear emprendimiento'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EmpCard({ emp }: { emp: Emprendimiento }) {
  const navigate  = useNavigate()
  const cfg       = ESTADO_CFG[emp.estado as EstadoEmp] ?? ESTADO_CFG.en_proyecto
  const unids     = emp.unidades ?? []
  const disponibles = unids.filter(u => u.estado === 'disponible').length
  const vendidas    = unids.filter(u => u.estado === 'vendida' || u.estado === 'escriturada').length
  const avance      = emp.avance ?? 0
  const avanceColor = avance >= 70 ? 'bg-green-500' : avance >= 40 ? 'bg-amber-400' : 'bg-blue-500'

  return (
    <div onClick={() => navigate(`/emprendimientos/${emp.id}`)}
      className="card cursor-pointer hover:shadow-md hover:border-primary/20 transition-all group">
      <div className="h-40 -mx-5 -mt-5 mb-4 rounded-t-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center overflow-hidden relative">
        {emp.imagen_url
          ? <img src={emp.imagen_url} alt={emp.nombre} className="w-full h-full object-cover" />
          : <Building2 size={48} className="text-white/20" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute bottom-3 left-4">
          <span className={cn('badge text-[10px] font-semibold', cfg.cls)}>{cfg.label}</span>
        </div>
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="bg-white/90 text-primary rounded-full p-1 flex"><ChevronRight size={14} /></span>
        </div>
      </div>
      <h3 className="font-bold text-gray-900 text-base mb-1 truncate group-hover:text-primary transition-colors">{emp.nombre}</h3>
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
        <MapPin size={11} /> {emp.direccion ?? ''} · {emp.localidad}
      </div>
      {avance > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Avance de obra</span>
            <span className="font-semibold text-gray-700">{avance}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', avanceColor)} style={{ width: `${avance}%` }} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        {[{ label: 'Total', value: unids.length, cls: 'text-gray-700' },
          { label: 'Disponibles', value: disponibles, cls: 'text-green-600 font-semibold' },
          { label: 'Vendidas', value: vendidas, cls: 'text-blue-600 font-semibold' }
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-lg p-1.5">
            <p className={cn('text-base font-bold', s.cls)}>{s.value}</p>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {unids.map((u, i) => (
          <span key={i} className={cn('w-3 h-3 rounded-sm', ESTADO_UND[u.estado] ?? 'bg-gray-200')} title={u.estado} />
        ))}
      </div>
      {emp.fecha_fin_estimada && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-3 pt-3 border-t border-gray-50">
          <Calendar size={11} />
          Entrega: {format(new Date(emp.fecha_fin_estimada), 'MMM yyyy', { locale: es })}
        </div>
      )}
    </div>
  )
}

export default function Emprendimientos() {
  const [filtro,   setFiltro]   = useState('todos')
  const [showNew,  setShowNew]  = useState(false)
  const { data, loading, error, reload, create } = useEmprendimientos()

  const lista = filtro === 'todos' ? data : data.filter(e => e.estado === filtro)

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Emprendimientos"
        subtitle={`${data.length} proyectos`}
        actions={
          <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nueva obra
          </button>
        }
      />

      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex gap-1">
          {FILTROS.map(f => (
            <button key={f.value} onClick={() => setFiltro(f.value)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                filtro === f.value ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50')}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={reload} className="text-gray-400 hover:text-primary transition-colors">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 text-red-400">
            <p className="text-sm">{error}</p>
            <button onClick={reload} className="mt-3 btn-ghost text-sm">Reintentar</button>
          </div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Building2 size={36} className="mb-3 text-gray-200" />
            <p className="font-medium">Sin emprendimientos en este estado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {lista.map(emp => <EmpCard key={emp.id} emp={emp} />)}
          </div>
        )}
      </div>
      {showNew && <NuevaObraModal onClose={() => setShowNew(false)} onCreate={create} />}
    </div>
  )
}
