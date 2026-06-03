import { useState, useMemo } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, Users, Download, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useOperarios, useJornadas, CATEGORIAS_UOCRA, type Operario, type CategoriaUOCRA } from '@/hooks/useJornadas'
import { useEmprendimientos } from '@/hooks/useEmprendimientos'
import { useAuth } from '@/context/AuthContext'
import { fmtARS } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

const ESTADO_CFG = {
  presente:    { label: 'Presente',    cls: 'bg-green-100 text-green-800',  short: 'P',  horas: 8 },
  ausente:     { label: 'Ausente',     cls: 'bg-red-100 text-red-700',      short: 'A',  horas: 0 },
  medio_dia:   { label: 'Medio día',   cls: 'bg-yellow-100 text-yellow-800',short: 'MD', horas: 4 },
  horas_extra: { label: 'H. extra',    cls: 'bg-blue-100 text-blue-700',    short: 'HE', horas: 10 },
  feriado:     { label: 'Feriado',     cls: 'bg-purple-100 text-purple-800',short: 'F',  horas: 0 },
}

function NuevoOperarioModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (input: Omit<Operario,'id'|'created_at'>) => Promise<void>
}) {
  const [form, setForm] = useState({ nombre:'', apellido:'', dni:'', categoria:'oficial' as CategoriaUOCRA, cuil:'', telefono:'', fecha_ingreso:'', jornal_base:0, activo:true })
  const [saving, setSaving] = useState(false)
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Nuevo operario</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400"/></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Nombre *</label><input className={fi} autoFocus value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
            <div><label className={lb}>Apellido *</label><input className={fi} value={form.apellido} onChange={e=>setForm(p=>({...p,apellido:e.target.value}))}/></div>
            <div><label className={lb}>DNI</label><input className={fi} value={form.dni} onChange={e=>setForm(p=>({...p,dni:e.target.value}))}/></div>
            <div><label className={lb}>CUIL</label><input className={fi} value={form.cuil} onChange={e=>setForm(p=>({...p,cuil:e.target.value}))}/></div>
          </div>
          <div><label className={lb}>Categoría UOCRA *</label>
            <select className={fi} value={form.categoria} onChange={e=>setForm(p=>({...p,categoria:e.target.value as CategoriaUOCRA}))}>
              {(Object.entries(CATEGORIAS_UOCRA) as [CategoriaUOCRA, {label:string}][]).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Jornal base (ARS/día)</label><input type="number" className={fi} value={form.jornal_base} onChange={e=>setForm(p=>({...p,jornal_base:Number(e.target.value)}))}/></div>
            <div><label className={lb}>Fecha ingreso</label><input type="date" className={fi} value={form.fecha_ingreso} onChange={e=>setForm(p=>({...p,fecha_ingreso:e.target.value}))}/></div>
          </div>
          <div><label className={lb}>Teléfono</label><input className={fi} value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))}/></div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button disabled={saving||!form.nombre||!form.apellido} onClick={async()=>{setSaving(true);try{await onCreate(form);onClose()}catch(e){alert(e instanceof Error?e.message:'Error')}finally{setSaving(false)}}} className="btn-primary disabled:opacity-50">{saving?'Guardando...':'Crear operario'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Jornadas() {
  const [tab, setTab]       = useState<'planilla'|'resumen'|'operarios'>('planilla')
  const [semana, setSemana] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [empId, setEmpId]   = useState('')
  const [showNew, setShowNew] = useState(false)
  const { user }            = useAuth()

  const finSemana   = endOfWeek(semana, { weekStartsOn: 1 })
  const diasSemana  = eachDayOfInterval({ start: semana, end: finSemana })

  const { data: operarios, reload: reloadOps, create: createOp } = useOperarios()
  const { data: emps } = useEmprendimientos()

  const fechaDesde = format(semana, 'yyyy-MM-dd')
  const fechaHasta = format(finSemana, 'yyyy-MM-dd')
  const { data: jornadas, loading, registrar, totalJornales, reload: reloadJor } = useJornadas(empId || undefined, fechaDesde, fechaHasta)

  // Mapa por operario+fecha
  const jornadaMap = useMemo(() => {
    const m: Record<string, string> = {}
    jornadas.forEach(j => { m[`${j.operario_id}_${j.fecha}`] = j.estado })
    return m
  }, [jornadas])

  const cambiarEstado = async (operarioId: string, fecha: string) => {
    if (!empId) { alert('Seleccioná un emprendimiento primero'); return }
    const op = operarios.find(o => o.id === operarioId)
    if (!op) return
    const estados = Object.keys(ESTADO_CFG) as (keyof typeof ESTADO_CFG)[]
    const actual  = (jornadaMap[`${operarioId}_${fecha}`] as keyof typeof ESTADO_CFG) ?? null
    const idx     = actual ? estados.indexOf(actual) : -1
    const nuevo   = estados[(idx + 1) % estados.length]
    const cfg     = ESTADO_CFG[nuevo]
    const jornal  = nuevo !== 'ausente' && nuevo !== 'feriado'
      ? op.jornal_base * (cfg.horas / 8) * CATEGORIAS_UOCRA[op.categoria].coeficiente
      : 0

    await registrar({
      operario_id: operarioId, emprendimiento_id: empId, fecha,
      estado: nuevo, horas: cfg.horas, jornal_aplicado: jornal, usuario_id: user?.id,
    })
  }

  const exportarPlanilla = () => {
    const rows = operarios.flatMap(op =>
      diasSemana.map(dia => {
        const f = format(dia, 'yyyy-MM-dd')
        const estado = (jornadaMap[`${op.id}_${f}`] as keyof typeof ESTADO_CFG) ?? 'ausente'
        return {
          Apellido: op.apellido, Nombre: op.nombre, Categoría: CATEGORIAS_UOCRA[op.categoria].label,
          Fecha: format(dia, 'dd/MM/yyyy'), Estado: ESTADO_CFG[estado]?.label ?? '—',
          Horas: ESTADO_CFG[estado]?.horas ?? 0,
          Jornal: op.jornal_base * ((ESTADO_CFG[estado]?.horas ?? 0) / 8) * CATEGORIAS_UOCRA[op.categoria].coeficiente,
        }
      })
    )
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Planilla')
    XLSX.writeFile(wb, `jornadas_${fechaDesde}.xlsx`)
  }

  // Resumen mensual por operario
  const { data: jornadasMes } = useJornadas(empId || undefined,
    format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  const resumenMes = useMemo(() => {
    return operarios.map(op => {
      const jorOp = jornadasMes.filter(j => j.operario_id === op.id && j.estado !== 'ausente' && j.estado !== 'feriado')
      const totalHoras  = jorOp.reduce((s,j) => s + j.horas, 0)
      const totalJornal = jorOp.reduce((s,j) => s + (j.jornal_aplicado ?? 0), 0)
      return { op, totalHoras, totalJornal, diasTrabajados: jorOp.length }
    })
  }, [operarios, jornadasMes])

  return (
    <div className="flex flex-col h-full">
      <Header title="Jornadas y personal" subtitle="Control de asistencia y cálculo de jornales"
        actions={
          <div className="flex gap-2">
            <button onClick={exportarPlanilla} className="flex items-center gap-1.5 text-xs text-green-700 border border-green-200 hover:bg-green-50 px-3 py-1.5 rounded-lg"><Download size={12}/> Excel</button>
            <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={15}/> Operario</button>
          </div>
        }
      />

      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4 flex-wrap">
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={empId} onChange={e => setEmpId(e.target.value)}>
          <option value="">Todos los emprendimientos</option>
          {emps.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <div className="flex items-center gap-1 ml-auto">
          {(['planilla','resumen','operarios'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                tab === t ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50')}>
              {t === 'planilla' ? 'Planilla semanal' : t === 'resumen' ? 'Resumen mensual' : 'Operarios'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* ── PLANILLA ── */}
        {tab === 'planilla' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setSemana(d => subMonths(d, 0) && new Date(d.getTime() - 7*86400000))} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"><ChevronLeft size={16}/></button>
                <span className="text-sm font-medium text-gray-700">
                  Semana del {format(semana, "d 'de' MMMM", {locale:es})} al {format(finSemana, "d 'de' MMMM yyyy", {locale:es})}
                </span>
                <button onClick={() => setSemana(d => new Date(d.getTime() + 7*86400000))} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"><ChevronRight size={16}/></button>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500">Total jornales semana:</span>
                <span className="font-bold text-primary">{fmtARS(totalJornales)}</span>
                <button onClick={() => { reloadOps(); reloadJor() }} className="text-gray-400 hover:text-primary"><RefreshCw size={14}/></button>
              </div>
            </div>

            {loading ? <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div> : (
              <div className="card overflow-hidden p-0 overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3 text-left sticky left-0 bg-gray-50">Operario</th>
                      <th className="px-4 py-3 text-center">Categoría</th>
                      {diasSemana.map(dia => (
                        <th key={dia.toISOString()} className={cn('px-3 py-3 text-center min-w-[80px]',
                          format(dia,'yyyy-MM-dd') === format(new Date(),'yyyy-MM-dd') && 'text-primary')}>
                          <div>{format(dia,'EEE',{locale:es}).toUpperCase()}</div>
                          <div className="text-xs font-normal">{format(dia,'d/MM')}</div>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right">Jornal semana</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {operarios.map((op, i) => {
                      const jorSemana = diasSemana.reduce((s, dia) => {
                        const f = format(dia,'yyyy-MM-dd')
                        const estado = jornadaMap[`${op.id}_${f}`] as keyof typeof ESTADO_CFG | undefined
                        if (!estado || estado === 'ausente' || estado === 'feriado') return s
                        const cfg = ESTADO_CFG[estado]
                        return s + op.jornal_base * (cfg.horas/8) * CATEGORIAS_UOCRA[op.categoria].coeficiente
                      }, 0)

                      return (
                        <tr key={op.id} className={i%2===0?'bg-white':'bg-gray-50/40'}>
                          <td className="px-4 py-2.5 sticky left-0 bg-inherit">
                            <p className="font-semibold text-gray-800 text-sm">{op.apellido}, {op.nombre}</p>
                            <p className="text-[10px] text-gray-400">{CATEGORIAS_UOCRA[op.categoria].label}</p>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="badge badge-gray text-[9px]">{CATEGORIAS_UOCRA[op.categoria].label.slice(0,3).toUpperCase()}</span>
                          </td>
                          {diasSemana.map(dia => {
                            const f = format(dia,'yyyy-MM-dd')
                            const estado = (jornadaMap[`${op.id}_${f}`] as keyof typeof ESTADO_CFG) ?? null
                            const cfg = estado ? ESTADO_CFG[estado] : null
                            return (
                              <td key={f} className="px-2 py-2.5 text-center">
                                <button
                                  onClick={() => cambiarEstado(op.id, f)}
                                  title={cfg?.label ?? 'Sin registro'}
                                  className={cn('w-10 h-8 rounded-lg text-[11px] font-bold transition-all hover:scale-110',
                                    cfg ? cfg.cls : 'bg-gray-100 text-gray-400 hover:bg-gray-200')}>
                                  {cfg?.short ?? '—'}
                                </button>
                              </td>
                            )
                          })}
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-success text-sm">
                            {fmtARS(jorSemana)}
                          </td>
                        </tr>
                      )
                    })}
                    {operarios.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Sin operarios registrados</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-3 flex-wrap text-xs text-gray-500">
              {(Object.entries(ESTADO_CFG) as [string, typeof ESTADO_CFG.presente][]).map(([k,v])=>(
                <span key={k} className={cn('badge text-[10px]', v.cls)}>{v.short} = {v.label} ({v.horas}h)</span>
              ))}
              <span className="text-gray-400 ml-2">· Clic en la celda para cambiar el estado</span>
            </div>
          </div>
        )}

        {/* ── RESUMEN MES ── */}
        {tab === 'resumen' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm">{format(new Date(), "MMMM yyyy", {locale:es})} — {empId ? emps.find(e=>e.id===empId)?.nombre : 'Todos los emprendimientos'}</h3>
              <span className="font-bold text-primary">{fmtARS(resumenMes.reduce((s,r)=>s+r.totalJornal,0))} total mes</span>
            </div>
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead><tr className="table-header">
                  <th className="px-4 py-3 text-left">Operario</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-center">Días trabajados</th>
                  <th className="px-4 py-3 text-center">Horas totales</th>
                  <th className="px-4 py-3 text-right">Jornal del mes</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {resumenMes.map(({ op, totalHoras, totalJornal, diasTrabajados }, i) => (
                    <tr key={op.id} className={i%2===0?'bg-white':'bg-gray-50/40'}>
                      <td className="px-4 py-3 font-medium text-gray-800">{op.apellido}, {op.nombre}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{CATEGORIAS_UOCRA[op.categoria].label}</td>
                      <td className="px-4 py-3 text-center font-mono">{diasTrabajados}</td>
                      <td className="px-4 py-3 text-center font-mono">{totalHoras}h</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-success">{fmtARS(totalJornal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-primary/5">
                  <tr>
                    <td colSpan={3} className="px-4 py-2.5 font-bold text-primary text-xs uppercase">Total del mes</td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold">{resumenMes.reduce((s,r)=>s+r.totalHoras,0)}h</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-success">{fmtARS(resumenMes.reduce((s,r)=>s+r.totalJornal,0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── OPERARIOS ── */}
        {tab === 'operarios' && (
          <div className="space-y-4">
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead><tr className="table-header">
                  <th className="px-4 py-3 text-left">Operario</th>
                  <th className="px-4 py-3 text-left">DNI</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-right">Jornal base</th>
                  <th className="px-4 py-3 text-left">Teléfono</th>
                  <th className="px-4 py-3 text-left">Ingreso</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {operarios.map((op, i) => (
                    <tr key={op.id} className={i%2===0?'bg-white':'bg-gray-50/40'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {op.nombre[0]}{op.apellido[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{op.apellido}, {op.nombre}</p>
                            {op.cuil && <p className="text-[10px] text-gray-400">CUIL: {op.cuil}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{op.dni ?? '—'}</td>
                      <td className="px-4 py-3"><span className="badge badge-info text-[10px]">{CATEGORIAS_UOCRA[op.categoria].label}</span></td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-800">{fmtARS(op.jornal_base)}/día</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{op.telefono ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{op.fecha_ingreso ? format(new Date(op.fecha_ingreso),'dd/MM/yyyy') : '—'}</td>
                    </tr>
                  ))}
                  {operarios.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400"><Users size={24} className="mx-auto mb-2 text-gray-200"/><p>Sin operarios registrados</p></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showNew && (
        <NuevoOperarioModal
          onClose={() => setShowNew(false)}
          onCreate={async input => { await createOp(input); reloadOps() }}
        />
      )}
    </div>
  )
}
