import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowLeft, Building2, MapPin, Calendar, Home, Calculator,
  X, Cloud, Sun, CloudRain, Wind, Users,
  FileText, ClipboardList, HardHat, FolderOpen, Upload,
  TrendingUp, CheckCircle, Clock, AlertTriangle, Edit2, Plus,
} from 'lucide-react'
import { useEmprendimientoDetalle, type Unidad, type EtapaObra } from '@/hooks/useEmprendimientos'
import type { EstadoUnidad } from '@/types'
type MockUnidad = Unidad
type MockEtapa  = EtapaObra
type MockContratista = { id: string; nombre: string; rubro?: string; etapa?: string; certificado: number; pagado: number; retencion: number; estado: string; telefono?: string }
import { fmtUSD, fmtARS } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

// ── Configuración visual de estados ──────────────────────────────────────────

const ESTADO_UNIDAD: Record<EstadoUnidad, { label: string; bg: string; border: string; text: string; badgeCls: string }> = {
  disponible:    { label: 'Disponible',    bg: 'bg-green-50',  border: 'border-green-300', text: 'text-green-700', badgeCls: 'bg-green-100 text-green-800' },
  reservada:     { label: 'Reservada',     bg: 'bg-yellow-50', border: 'border-yellow-300',text: 'text-yellow-700',badgeCls: 'bg-yellow-100 text-yellow-800' },
  vendida:       { label: 'Vendida',       bg: 'bg-blue-50',   border: 'border-blue-300',  text: 'text-blue-700', badgeCls: 'bg-blue-100 text-blue-800' },
  escriturada:   { label: 'Escriturada',   bg: 'bg-gray-50',   border: 'border-gray-300',  text: 'text-gray-600', badgeCls: 'bg-gray-100 text-gray-600' },
  no_disponible: { label: 'No disponible', bg: 'bg-red-50',    border: 'border-red-300',   text: 'text-red-700',  badgeCls: 'bg-red-100 text-red-700' },
}

const ESTADO_ETAPA_CFG = {
  pendiente:   { cls: 'badge-gray',    icon: Clock,         label: 'Pendiente' },
  en_curso:    { cls: 'badge-info',    icon: TrendingUp,    label: 'En curso' },
  terminada:   { cls: 'badge-success', icon: CheckCircle,   label: 'Terminada' },
  con_retraso: { cls: 'badge-danger',  icon: AlertTriangle, label: 'Con retraso' },
}

const CLIMA_ICON = { soleado: Sun, nublado: Cloud, lluvioso: CloudRain, ventoso: Wind, nevado: Cloud }

// ── Modal de unidad ───────────────────────────────────────────────────────────

function UnidadModal({ unidad, empId, onClose }: { unidad: MockUnidad; empId: string; onClose: () => void }) {
  const navigate = useNavigate()
  const est = ESTADO_UNIDAD[unidad.estado as EstadoUnidad] ?? ESTADO_UNIDAD.disponible
  const precio = unidad.precio_usd ? fmtUSD(unidad.precio_usd) : unidad.precio_ars ? fmtARS(unidad.precio_ars) : '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Unidad {unidad.identificador}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Estado */}
          <div className={cn('rounded-xl p-3 border', est.bg, est.border)}>
            <div className="flex items-center justify-between">
              <span className={cn('font-bold text-base', est.text)}>{est.label}</span>
              <span className={cn('badge', est.badgeCls)}>{unidad.tipo}</span>
            </div>
            {unidad.cliente && (
              <p className={cn('text-sm mt-1', est.text)}>
                {unidad.estado === 'reservada' ? '📋 Reservada por:' : '✅ Comprador:'} <strong>{unidad.cliente}</strong>
              </p>
            )}
            {unidad.contrato_numero && (
              <p className={cn('text-xs mt-0.5', est.text)}>Contrato N° {unidad.contrato_numero}</p>
            )}
          </div>

          {/* Datos */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Precio',       value: precio },
              { label: 'Planta',       value: unidad.planta != null ? (unidad.planta === -1 ? 'Subsuelo' : `Piso ${unidad.planta}`) : '—' },
              { label: 'M² cubiertos', value: unidad.metros_cubiertos ? `${unidad.metros_cubiertos} m²` : '—' },
              { label: 'M² semicub.',  value: unidad.metros_semicubiertos ? `${unidad.metros_semicubiertos} m²` : '—' },
              { label: 'M² totales',   value: unidad.metros_totales ? `${unidad.metros_totales} m²` : unidad.metros_cubiertos ? `${unidad.metros_cubiertos} m²` : '—' },
              { label: 'Ambientes',    value: unidad.ambientes ? `${unidad.ambientes} amb.` : '—' },
              { label: 'Orientación',  value: unidad.orientacion ?? '—' },
              { label: 'Moneda',       value: unidad.moneda_venta },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{label}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="px-6 py-4 border-t border-gray-100 flex flex-col gap-2">
          {(unidad.estado === 'disponible' || unidad.estado === 'reservada') && (
            <button
              onClick={() => { onClose(); navigate('/simulador', { state: { empId, unidadId: unidad.id } }) }}
              className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
            >
              <Calculator size={16} /> Simular venta
            </button>
          )}
          {(unidad.estado === 'vendida' || unidad.estado === 'reservada') && unidad.contrato_numero && (
            <button
              onClick={() => { onClose(); navigate('/contratos') }}
              className="w-full btn-ghost border border-gray-200 flex items-center justify-center gap-2 py-2.5 text-sm"
            >
              <FileText size={15} /> Ver contrato {unidad.contrato_numero}
            </button>
          )}
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 text-center py-1">Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ── TAB 1: Grilla de unidades ─────────────────────────────────────────────────

interface EmpConUnidades { id: string; nombre: string; unidades: MockUnidad[]; etapas: MockEtapa[]; diario: DiarioEntry[]; contratistas: MockContratista[] }
interface DiarioEntry { id: string; fecha: string; condiciones_clima?: string; temperatura_min?: number; temperatura_max?: number; personal_presente?: number; tareas_realizadas: string; materiales_utilizados?: string; incidentes?: string; observaciones?: string; usuario_id?: string }

function TabGeneral({ emp }: { emp: EmpConUnidades }) {
  const [selected, setSelected] = useState<MockUnidad | null>(null)

  // Agrupar por planta si hay planta definida
  const porPlanta = emp.unidades.reduce<Record<string, MockUnidad[]>>((acc, u) => {
    const key = u.planta != null
      ? u.planta === -1 ? 'Subsuelo' : `Piso ${u.planta}`
      : 'Sin planta'
    if (!acc[key]) acc[key] = []
    acc[key].push(u)
    return acc
  }, {})

  const hayPlantas = Object.keys(porPlanta).length > 1

  const disponibles  = emp.unidades.filter(u => u.estado === 'disponible').length
  const vendidas     = emp.unidades.filter(u => u.estado === 'vendida').length
  const reservadas   = emp.unidades.filter(u => u.estado === 'reservada').length
  const escrituradas = emp.unidades.filter(u => u.estado === 'escriturada').length

  return (
    <div className="space-y-5">
      {/* Info general */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Disponibles',  value: disponibles,  cls: 'text-green-600' },
          { label: 'Vendidas',     value: vendidas,     cls: 'text-blue-600' },
          { label: 'Reservadas',   value: reservadas,   cls: 'text-yellow-600' },
          { label: 'Escrituradas', value: escrituradas, cls: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className={cn('text-2xl font-bold', s.cls)}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
        {Object.entries(ESTADO_UNIDAD).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={cn('w-3 h-3 rounded-sm border', v.bg, v.border)} />
            {v.label}
          </span>
        ))}
        <span className="text-gray-300 text-[10px]">· Click en una celda para ver detalle</span>
      </div>

      {/* Mapa de unidades */}
      <div className="card">
        {hayPlantas ? (
          <div className="space-y-4">
            {Object.entries(porPlanta)
              .sort((a, b) => {
                const na = a[0] === 'Subsuelo' ? -99 : parseInt(a[0].replace('Piso ', '')) || 0
                const nb = b[0] === 'Subsuelo' ? -99 : parseInt(b[0].replace('Piso ', '')) || 0
                return nb - na
              })
              .map(([planta, uds]) => (
                <div key={planta}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{planta}</p>
                  <div className="flex flex-wrap gap-2">
                    {uds.map(u => {
                      const est = ESTADO_UNIDAD[u.estado as EstadoUnidad] ?? ESTADO_UNIDAD.disponible
                      return (
                        <button
                          key={u.id}
                          onClick={() => setSelected(u)}
                          className={cn(
                            'min-w-[88px] border-2 rounded-xl p-2.5 text-left hover:scale-105 hover:shadow-md transition-all cursor-pointer group',
                            est.bg, est.border
                          )}
                        >
                          <p className={cn('text-sm font-bold', est.text)}>{u.identificador}</p>
                          <p className="text-[10px] text-gray-400 capitalize">{u.tipo}</p>
                          {u.metros_cubiertos && <p className="text-[10px] text-gray-400">{u.metros_cubiertos} m²</p>}
                          {u.precio_usd && <p className={cn('text-[10px] font-semibold mt-0.5', est.text)}>U$D {(u.precio_usd/1000).toFixed(0)}k</p>}
                          {u.cliente && (
                            <p className="text-[9px] text-gray-400 truncate max-w-[80px] mt-0.5" title={u.cliente}>
                              {u.cliente.split(',')[0]}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            }
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {emp.unidades.map(u => {
              const est = ESTADO_UNIDAD[u.estado as EstadoUnidad] ?? ESTADO_UNIDAD.disponible
              return (
                <button
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className={cn(
                    'min-w-[96px] border-2 rounded-xl p-3 text-left hover:scale-105 hover:shadow-md transition-all cursor-pointer',
                    est.bg, est.border
                  )}
                >
                  <p className={cn('text-sm font-bold', est.text)}>{u.identificador}</p>
                  <p className="text-[10px] text-gray-400">{u.metros_totales ?? u.metros_cubiertos ? `${u.metros_totales ?? u.metros_cubiertos} m²` : u.tipo}</p>
                  {u.precio_usd && <p className={cn('text-[10px] font-semibold mt-1', est.text)}>U$D {(u.precio_usd/1000).toFixed(0)}k</p>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selected && <UnidadModal unidad={selected} empId={emp.id} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ── TAB 2: Etapas de obra ─────────────────────────────────────────────────────

function EtapaUpdateModal({ etapa, onClose }: { etapa: MockEtapa; onClose: () => void }) {
  const [avance, setAvance] = useState(etapa.avance_porcentaje)
  const [estado, setEstado] = useState(etapa.estado)
  const [costo, setCosto]   = useState(etapa.costo_real)
  const [notas, setNotas]   = useState('')
  const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Actualizar etapa</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm font-semibold text-primary">{etapa.nombre}</p>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
              Avance: <span className="text-primary">{avance}%</span>
            </label>
            <input type="range" min="0" max="100" value={avance} onChange={e => setAvance(Number(e.target.value))}
              className="w-full accent-primary" />
            <div className="h-3 bg-gray-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${avance}%` }} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Estado</label>
            <select className={field} value={estado} onChange={e => setEstado(e.target.value as MockEtapa['estado'])}>
              <option value="pendiente">Pendiente</option>
              <option value="en_curso">En curso</option>
              <option value="terminada">Terminada</option>
              <option value="con_retraso">Con retraso</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Costo real acumulado (ARS)</label>
            <input type="number" className={field} value={costo} onChange={e => setCosto(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Notas / Observaciones</label>
            <textarea className={field} rows={2} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones del período..." />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={() => { alert('Guardado (conectar Supabase)'); onClose() }} className="btn-primary">
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}

function TabEtapas({ etapas }: { etapas: MockEtapa[] }) {
  const [editando, setEditando] = useState<MockEtapa | null>(null)

  const totalPresupuesto = etapas.reduce((s, e) => s + (e.presupuesto ?? 0), 0)
  const totalCosto       = etapas.reduce((s, e) => s + e.costo_real, 0)
  const avanceGlobal     = etapas.reduce((s, e) => s + e.avance_porcentaje * (e.porcentaje_obra ?? 0), 0) / 100

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-xl font-bold text-primary">{avanceGlobal.toFixed(1)}%</p>
          <p className="text-xs text-gray-400">Avance global ponderado</p>
        </div>
        <div className="card text-center">
          <p className="text-xl font-bold text-gray-700">{fmtARS(totalPresupuesto)}</p>
          <p className="text-xs text-gray-400">Presupuesto total</p>
        </div>
        <div className="card text-center">
          <p className={cn('text-xl font-bold', totalCosto > totalPresupuesto ? 'text-danger' : 'text-success')}>
            {fmtARS(totalCosto)}
          </p>
          <p className="text-xs text-gray-400">Costo real acumulado</p>
        </div>
      </div>

      {/* Lista de etapas */}
      <div className="space-y-3">
        {etapas.map(e => {
          const cfg = ESTADO_ETAPA_CFG[e.estado as keyof typeof ESTADO_ETAPA_CFG] ?? ESTADO_ETAPA_CFG.pendiente
          const Icon = cfg.icon
          const desviacion = e.costo_real - ((e.presupuesto ?? 0) * e.avance_porcentaje / 100)
          return (
            <div key={e.id} className="card">
              <div className="flex items-start gap-4">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold mt-0.5',
                  e.estado === 'terminada' ? 'bg-green-500' : e.estado === 'en_curso' ? 'bg-blue-500' : e.estado === 'con_retraso' ? 'bg-red-500' : 'bg-gray-300'
                )}>
                  {e.orden}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h4 className="font-semibold text-gray-900 text-sm">{e.nombre}</h4>
                    <span className={cn('badge text-[10px]', cfg.cls)}>
                      <Icon size={10} className="mr-1" />{cfg.label}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-auto">{e.porcentaje_obra}% de la obra</span>
                  </div>

                  {/* Barra de avance */}
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div
                      className={cn('h-full rounded-full transition-all', e.avance_porcentaje === 100 ? 'bg-green-500' : e.estado === 'con_retraso' ? 'bg-red-400' : 'bg-blue-500')}
                      style={{ width: `${e.avance_porcentaje}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mb-2">
                    <span>{e.avance_porcentaje}% completado</span>
                    <span>{100 - e.avance_porcentaje}% restante</span>
                  </div>

                  {/* Fechas y costos */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide font-semibold">Inicio estimado</p>
                      <p className="text-gray-700">{e.fecha_inicio_estimada ? format(new Date(e.fecha_inicio_estimada), 'dd/MM/yy', { locale: es }) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide font-semibold">Fin estimado</p>
                      <p className="text-gray-700">{e.fecha_fin_estimada ? format(new Date(e.fecha_fin_estimada), 'dd/MM/yy', { locale: es }) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide font-semibold">Inicio real</p>
                      <p className="text-gray-700">{e.fecha_inicio_real ? format(new Date(e.fecha_inicio_real), 'dd/MM/yy', { locale: es }) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide font-semibold">Fin real</p>
                      <p className="text-gray-700">{e.fecha_fin_real ? format(new Date(e.fecha_fin_real), 'dd/MM/yy', { locale: es }) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide font-semibold">Presupuesto</p>
                      <p className="text-gray-700">{fmtARS(e.presupuesto ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 uppercase tracking-wide font-semibold">Costo real</p>
                      <p className={e.costo_real > (e.presupuesto ?? 0) ? 'text-danger font-semibold' : 'text-gray-700'}>{fmtARS(e.costo_real)}</p>
                    </div>
                    {e.avance_porcentaje > 0 && e.costo_real > 0 && (
                      <div className="col-span-2">
                        <p className="text-gray-400 uppercase tracking-wide font-semibold">Desvío vs. avance</p>
                        <p className={desviacion > 0 ? 'text-danger font-semibold' : 'text-success font-semibold'}>
                          {desviacion > 0 ? '+' : ''}{fmtARS(desviacion)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón editar */}
                <button
                  onClick={() => setEditando(e)}
                  className="p-2 text-gray-300 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors shrink-0"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editando && <EtapaUpdateModal etapa={editando} onClose={() => setEditando(null)} />}
    </div>
  )
}

// ── TAB 3: Diario de obra ─────────────────────────────────────────────────────

function NuevoDiarioModal({ onClose }: { onClose: () => void }) {
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState({ fecha: hoy, clima: 'soleado', temp_min: '', temp_max: '', personal: '', tareas: '', materiales: '', incidentes: '', observaciones: '' })
  const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
  const label = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Nuevo registro de diario</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Fecha *</label>
              <input type="date" className={field} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div>
              <label className={label}>Clima</label>
              <select className={field} value={form.clima} onChange={e => setForm(f => ({ ...f, clima: e.target.value }))}>
                <option value="soleado">☀️ Soleado</option>
                <option value="nublado">☁️ Nublado</option>
                <option value="lluvioso">🌧️ Lluvioso</option>
                <option value="ventoso">💨 Ventoso</option>
                <option value="nevado">🌨️ Nevado</option>
              </select>
            </div>
            <div>
              <label className={label}>Temperatura mín (°C)</label>
              <input type="number" className={field} placeholder="0" value={form.temp_min} onChange={e => setForm(f => ({ ...f, temp_min: e.target.value }))} />
            </div>
            <div>
              <label className={label}>Temperatura máx (°C)</label>
              <input type="number" className={field} placeholder="0" value={form.temp_max} onChange={e => setForm(f => ({ ...f, temp_max: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={label}>Personal presente *</label>
            <input type="number" min="0" className={field} placeholder="0" value={form.personal} onChange={e => setForm(f => ({ ...f, personal: e.target.value }))} />
          </div>
          <div>
            <label className={label}>Tareas realizadas *</label>
            <textarea className={field} rows={3} placeholder="Descripción detallada de los trabajos realizados..."
              value={form.tareas} onChange={e => setForm(f => ({ ...f, tareas: e.target.value }))} />
          </div>
          <div>
            <label className={label}>Materiales utilizados</label>
            <textarea className={field} rows={2} placeholder="Materiales consumidos hoy..."
              value={form.materiales} onChange={e => setForm(f => ({ ...f, materiales: e.target.value }))} />
          </div>
          <div>
            <label className={label}>Incidentes / Novedades</label>
            <textarea className={field} rows={2} placeholder="Incidentes, accidentes, problemas..."
              value={form.incidentes} onChange={e => setForm(f => ({ ...f, incidentes: e.target.value }))} />
          </div>
          <div>
            <label className={label}>Observaciones</label>
            <textarea className={field} rows={2} placeholder="Observaciones generales..."
              value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button disabled={!form.tareas.trim() || !form.personal}
            onClick={() => { alert('Guardado (conectar Supabase)'); onClose() }}
            className="btn-primary disabled:opacity-50">
            Guardar registro
          </button>
        </div>
      </div>
    </div>
  )
}

function TabDiario({ diario }: { diario: DiarioEntry[] }) {
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Nuevo registro
        </button>
      </div>

      {diario.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12 text-gray-400">
          <ClipboardList size={36} className="mb-3 text-gray-200" />
          <p className="font-medium">Sin registros en el diario</p>
          <p className="text-sm mt-1">Cargá el primer registro del día</p>
        </div>
      ) : (
        <div className="relative pl-6">
          {/* Línea vertical */}
          <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-5">
            {diario.map(d => {
              const ClimaIcon = CLIMA_ICON[d.condiciones_clima as keyof typeof CLIMA_ICON] ?? Cloud
              return (
                <div key={d.id} className="relative">
                  <div className="absolute -left-5 w-4 h-4 rounded-full bg-primary border-2 border-white shadow-sm" />
                  <div className="card ml-2">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-bold text-primary text-sm">
                        {format(new Date(d.fecha), "EEEE d 'de' MMMM yyyy", { locale: es })}
                      </span>
                      <div className="flex items-center gap-1.5 text-gray-400 text-xs ml-auto">
                        <ClimaIcon size={13} className="text-amber-400" />
                        {(d.condiciones_clima ?? '').charAt(0).toUpperCase() + (d.condiciones_clima ?? '').slice(1)}
                        {d.temperatura_min != null && d.temperatura_max != null && (
                          <span className="ml-1">{d.temperatura_min}°–{d.temperatura_max}°C</span>
                        )}
                        <Users size={12} className="ml-2" />
                        {d.personal_presente ?? 0} operarios
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tareas realizadas</span>
                        <p className="mt-0.5 leading-relaxed">{d.tareas_realizadas}</p>
                      </div>
                      {d.materiales_utilizados && (
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Materiales</span>
                          <p className="mt-0.5 text-gray-600">{d.materiales_utilizados}</p>
                        </div>
                      )}
                      {d.incidentes && (
                        <div className="p-2 bg-red-50 rounded-lg border border-red-100">
                          <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">⚠️ Incidentes</span>
                          <p className="mt-0.5 text-red-700 text-sm">{d.incidentes}</p>
                        </div>
                      )}
                      {d.observaciones && (
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Observaciones</span>
                          <p className="mt-0.5 text-gray-500">{d.observaciones}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-300 mt-3 text-right">{d.usuario_id ?? ''}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {showNew && <NuevoDiarioModal onClose={() => setShowNew(false)} />}
    </div>
  )
}

// ── TAB 4: Contratistas ───────────────────────────────────────────────────────

function TabContratistas({ contratistas }: { contratistas: MockContratista[] }) {
  const estadoCls = { pendiente: 'badge-warning', aprobado: 'badge-info', pagado: 'badge-success' }

  if (!contratistas.length) return (
    <div className="card flex flex-col items-center justify-center py-12 text-gray-400">
      <HardHat size={36} className="mb-3 text-gray-200" />
      <p className="font-medium">Sin contratistas asignados</p>
    </div>
  )

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="table-header">
            <th className="px-4 py-3 text-left">Contratista</th>
            <th className="px-4 py-3 text-left">Rubro / Etapa</th>
            <th className="px-4 py-3 text-right">Certificado</th>
            <th className="px-4 py-3 text-right">Pagado</th>
            <th className="px-4 py-3 text-right">Retención</th>
            <th className="px-4 py-3 text-center">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {contratistas.map((c, i) => {
            const saldo = c.certificado - c.pagado - c.retencion
            return (
              <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-800">{c.nombre ?? ''}</p>
                  {c.telefono && <p className="text-xs text-gray-400">{c.telefono}</p>}
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-700">{c.rubro}</p>
                  <p className="text-xs text-gray-400">{c.etapa}</p>
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">{fmtARS(c.certificado)}</td>
                <td className="px-4 py-3 text-right font-mono text-green-600 font-semibold">{fmtARS(c.pagado)}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-600">{fmtARS(c.retencion)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={cn('badge text-[10px]', estadoCls[c.estado as keyof typeof estadoCls] ?? 'badge-gray')}>
                    {c.estado.charAt(0).toUpperCase() + c.estado.slice(1)}
                  </span>
                  {saldo > 0 && c.estado !== 'pagado' && (
                    <p className="text-[10px] text-red-500 mt-0.5">Saldo: {fmtARS(saldo)}</p>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="bg-primary/5 border-t border-primary/10">
          <tr>
            <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-primary uppercase tracking-wide">Total</td>
            <td className="px-4 py-2.5 text-right font-bold text-gray-900 font-mono">{fmtARS(contratistas.reduce((s, c) => s + c.certificado, 0))}</td>
            <td className="px-4 py-2.5 text-right font-bold text-green-700 font-mono">{fmtARS(contratistas.reduce((s, c) => s + c.pagado, 0))}</td>
            <td className="px-4 py-2.5 text-right font-bold text-amber-700 font-mono">{fmtARS(contratistas.reduce((s, c) => s + c.retencion, 0))}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── TAB 5: Documentos ─────────────────────────────────────────────────────────

const MOCK_DOCS = [
  { nombre: 'Plano_PB_aprobado.pdf',   tipo: 'PDF',  fecha: '01/03/2024', tamanio: '4.2 MB', categoria: 'Planos' },
  { nombre: 'Permiso_construccion.pdf', tipo: 'PDF',  fecha: '15/02/2024', tamanio: '1.8 MB', categoria: 'Permisos' },
  { nombre: 'Fotos_avance_mayo.zip',    tipo: 'ZIP',  fecha: '31/05/2026', tamanio: '48 MB',  categoria: 'Fotos' },
  { nombre: 'Contrato_terreno.pdf',     tipo: 'PDF',  fecha: '10/01/2024', tamanio: '2.1 MB', categoria: 'Legal' },
  { nombre: 'Presupuesto_obra.xlsx',    tipo: 'XLSX', fecha: '01/03/2024', tamanio: '0.8 MB', categoria: 'Presupuestos' },
]

const DOC_COLORS: Record<string, string> = {
  PDF: 'bg-red-100 text-red-700', ZIP: 'bg-purple-100 text-purple-700',
  XLSX: 'bg-green-100 text-green-700', DOCX: 'bg-blue-100 text-blue-700',
}

function TabDocumentos() {
  return (
    <div className="space-y-4">
      {/* Zona de drop */}
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer">
        <Upload size={28} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">Arrastrá archivos aquí o</p>
        <button className="mt-2 btn-primary text-sm px-5">Seleccionar archivos</button>
        <p className="text-xs text-gray-400 mt-2">PDF, imágenes, DWG, ZIP hasta 100 MB</p>
      </div>

      {/* Lista de documentos */}
      <div className="card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-widest">
          Documentos cargados ({MOCK_DOCS.length})
        </div>
        <div className="divide-y divide-gray-50">
          {MOCK_DOCS.map((doc, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
              <span className={cn('badge text-[10px] w-12 justify-center font-bold', DOC_COLORS[doc.tipo] ?? 'bg-gray-100 text-gray-600')}>
                {doc.tipo}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{doc.nombre}</p>
                <p className="text-xs text-gray-400">{doc.categoria} · {doc.tamanio} · {doc.fecha}</p>
              </div>
              <button className="text-xs text-primary hover:underline font-medium shrink-0">Descargar</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',      label: 'General',     icon: Home },
  { id: 'etapas',       label: 'Etapas',      icon: TrendingUp },
  { id: 'diario',       label: 'Diario',      icon: ClipboardList },
  { id: 'contratistas', label: 'Contratistas',icon: HardHat },
  { id: 'documentos',   label: 'Documentos',  icon: FolderOpen },
] as const

type TabId = typeof TABS[number]['id']

const ESTADO_EMP_CFG = {
  en_proyecto: { label: 'En proyecto', cls: 'bg-purple-100 text-purple-800' },
  en_obra:     { label: 'En obra',     cls: 'bg-blue-100 text-blue-800' },
  terminado:   { label: 'Terminado',   cls: 'bg-green-100 text-green-800' },
  entregado:   { label: 'Entregado',   cls: 'bg-gray-100 text-gray-600' },
}

export default function EmprendimientoDetalle() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<TabId>('general')
  const { emprendimiento: emp, unidades, etapas, diario, loading } = useEmprendimientoDetalle(id)

  if (loading) return (
    <div className="flex flex-col h-full">
      <Header title="Cargando..." />
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
      </div>
    </div>
  )

  if (!emp) return (
    <div className="flex flex-col h-full">
      <Header title="Emprendimiento no encontrado" />
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <Building2 size={40} className="mx-auto mb-3 text-gray-200" />
          <p>No se encontró el emprendimiento</p>
          <Link to="/emprendimientos" className="text-primary text-sm hover:underline mt-2 block">← Volver a emprendimientos</Link>
        </div>
      </div>
    </div>
  )

  const estCfg = ESTADO_EMP_CFG[emp.estado as keyof typeof ESTADO_EMP_CFG] ?? ESTADO_EMP_CFG.en_proyecto
  const avance = emp.avance ?? 0
  const avanceColor = avance >= 70 ? 'bg-green-500' : avance >= 40 ? 'bg-amber-400' : 'bg-blue-500'

  return (
    <div className="flex flex-col h-full">
      <Header
        title={emp.nombre}
        subtitle={`${emp.direccion} · ${emp.localidad}`}
        actions={
          <Link to="/emprendimientos" className="btn-ghost flex items-center gap-1.5 text-sm">
            <ArrowLeft size={15} /> Volver
          </Link>
        }
      />

      {/* Info rápida */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-6 flex-wrap text-sm">
        <span className={cn('badge', estCfg.cls)}>{estCfg.label}</span>
        <div className="flex items-center gap-2 text-gray-500">
          <span className="text-xs text-gray-400">Avance:</span>
          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', avanceColor)} style={{ width: `${avance}%` }} />
          </div>
          <span className="text-xs font-semibold text-gray-700">{avance}%</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
          <MapPin size={12} /> {emp.localidad}
        </div>
        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
          <Calendar size={12} /> Entrega: {emp.fecha_fin_estimada ? format(new Date(emp.fecha_fin_estimada), 'MMM yyyy', { locale: es }) : '—'}
        </div>
        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
          <Home size={12} /> {unidades.length} unidades
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="flex gap-0">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                )}
              >
                <Icon size={15} />
                {t.label}
                {t.id === 'diario' && diario.length > 0 && (
                  <span className="ml-1 badge bg-primary/10 text-primary text-[10px]">{diario.length}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Contenido del tab */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'general'      && <TabGeneral emp={{ ...emp, unidades, etapas, diario, contratistas: [] }} />}
        {tab === 'etapas'       && <TabEtapas etapas={etapas} />}
        {tab === 'diario'       && <TabDiario diario={diario} />}
        {tab === 'contratistas' && <TabContratistas contratistas={[]} />}
        {tab === 'documentos'   && <TabDocumentos />}
      </div>
    </div>
  )
}
