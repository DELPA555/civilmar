import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { format, addMonths, parseISO } from 'date-fns'
import { ArrowLeft, Save, Calculator } from 'lucide-react'
import { calcularPlanDePagos } from '@/lib/simulador'
import { useContratos } from '@/hooks/useContratos'
import { useEmprendimientos } from '@/hooks/useEmprendimientos'
import { useClientes, type Cliente } from '@/hooks/useClientes'
import { supabase } from '@/lib/supabase'
import { fmt } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

interface Unidad { id: string; identificador: string; tipo?: string; estado: string }

interface FormValues {
  numero: string; emprendimientoId: string; unidadId: string; clienteId: string
  tipo: string; moneda: 'USD' | 'ARS'
  precioTotal: number; senaMonto: number; senaFecha: string
  tramo1Meses: number; tramo1Inicio: string; tramo1ConCac: boolean
  tramo2Meses: number; tramo2TasaAnual: number; notas: string
}

const hoy     = format(new Date(), 'yyyy-MM-dd')
const proxMes = format(addMonths(new Date(), 1), 'yyyy-MM-dd')

function nombreCliente(c: Cliente): string {
  if (c.tipo === 'persona_juridica') return c.razon_social ?? c.nombre
  return [c.apellido, c.nombre].filter(Boolean).join(', ')
}

export default function ContratoNuevo() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const simData   = (location.state as { simulador?: Partial<FormValues> } | null)?.simulador

  const { create }                        = useContratos()
  const { data: emprendimientos }         = useEmprendimientos()
  const { data: clientes }                = useClientes()
  const [unidades, setUnidades]           = useState<Unidad[]>([])
  const [saving,   setSaving]             = useState(false)

  const [form, setForm] = useState<FormValues>({
    numero: `${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
    emprendimientoId: simData?.emprendimientoId ?? '',
    unidadId: '', clienteId: '', tipo: 'boleto',
    moneda: simData?.moneda ?? 'USD',
    precioTotal: Number(simData?.precioTotal ?? 0),
    senaMonto: Number((simData as Record<string, unknown>)?.sena ?? 0),
    senaFecha: hoy,
    tramo1Meses: Number(simData?.tramo1Meses ?? 24),
    tramo1Inicio: simData?.tramo1Inicio ?? proxMes,
    tramo1ConCac: simData?.tramo1ConCac ?? false,
    tramo2Meses: Number(simData?.tramo2Meses ?? 0),
    tramo2TasaAnual: Number(simData?.tramo2TasaAnual ?? 0),
    notas: '',
  })

  const F = (k: keyof FormValues, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  // Cargar unidades disponibles cuando cambia el emprendimiento
  useEffect(() => {
    if (!form.emprendimientoId) { setUnidades([]); F('unidadId', ''); return }
    supabase.from('unidades')
      .select('id, identificador, tipo, estado')
      .eq('emprendimiento_id', form.emprendimientoId)
      .in('estado', ['disponible', 'reservada'])
      .order('identificador')
      .then(({ data }) => { setUnidades(data ?? []); F('unidadId', '') })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.emprendimientoId])

  // Prellenar precio desde la unidad seleccionada
  useEffect(() => {
    if (!form.unidadId) return
    supabase.from('unidades')
      .select('precio_lista_usd, precio_lista_ars, moneda_venta')
      .eq('id', form.unidadId)
      .single()
      .then(({ data }) => {
        if (!data) return
        const precio = data.moneda_venta === 'ARS' ? data.precio_lista_ars : data.precio_lista_usd
        if (precio) {
          F('precioTotal', precio)
          F('moneda', data.moneda_venta as 'USD' | 'ARS')
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.unidadId])

  const plan = useMemo(() => {
    if (!form.precioTotal || !form.tramo1Meses) return null
    try {
      return calcularPlanDePagos({
        precioTotal: form.precioTotal, moneda: form.moneda,
        sena: form.senaMonto, fechaSena: parseISO(form.senaFecha),
        tramo1Meses: form.tramo1Meses,
        tramo1Inicio: parseISO(form.tramo1Inicio),
        tramo1ConCac: form.tramo1ConCac,
        tramo2Meses: form.tramo2Meses,
        tramo2TasaAnual: form.tramo2TasaAnual,
      })
    } catch { return null }
  }, [form])

  const guardar = async () => {
    if (!form.emprendimientoId || !form.unidadId || !form.clienteId || !form.precioTotal || !plan) return
    setSaving(true)
    try {
      const contrato = await create({
        numero:            form.numero,
        emprendimiento_id: form.emprendimientoId,
        unidad_id:         form.unidadId,
        cliente_id:        form.clienteId,
        tipo:              form.tipo as 'reserva' | 'boleto' | 'escritura' | 'cesion',
        estado:            'vigente',
        moneda:            form.moneda,
        precio_total:      form.precioTotal,
        sena_monto:        form.senaMonto,
        sena_fecha:        form.senaFecha || undefined,
        tramo1_meses:      form.tramo1Meses,
        tramo1_cuota:      plan.resumen.cuotaTramo1,
        tramo1_inicio:     form.tramo1Inicio,
        tramo1_con_cac:    form.tramo1ConCac,
        tramo2_meses:      form.tramo2Meses,
        tramo2_cuota:      plan.resumen.cuotaTramo2,
        tramo2_tasa_anual: form.tramo2TasaAnual,
        total_tramo1:      plan.resumen.totalTramo1,
        total_tramo2:      plan.resumen.totalTramo2,
        fecha_firma:       hoy,
        notas:             form.notas || undefined,
      })

      // Insertar cuotas generadas por el simulador
      const cuotasInput = plan.cuotas.map(c => ({
        contrato_id:       contrato.id,
        numero_cuota:      c.numero,
        tramo:             c.tramo,
        fecha_vencimiento: format(c.fechaVencimiento, 'yyyy-MM-dd'),
        monto_original:    c.montoOriginal,
        estado:            (c.tramo === 'sena' ? 'pagada' : 'pendiente') as 'pendiente' | 'pagada',
        mora_dias:         0,
        mora_monto:        0,
      }))
      const { error: cuotasErr } = await supabase.from('cuotas').insert(cuotasInput)
      if (cuotasErr) throw new Error(`Contrato creado pero error en cuotas: ${cuotasErr.message}`)

      // Marcar la unidad como vendida
      await supabase.from('unidades').update({ estado: 'vendida' }).eq('id', form.unidadId)

      navigate(`/contratos/${contrato.id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al guardar el contrato')
    } finally {
      setSaving(false)
    }
  }

  const fi  = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
  const lb  = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'
  const fmtM = (n: number) => fmt(n, form.moneda)

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Nuevo contrato"
        subtitle={simData ? 'Pre-llenado desde simulador' : 'Completá los datos del contrato'}
        actions={
          <div className="flex items-center gap-2">
            {simData && (
              <span className="flex items-center gap-1.5 text-xs text-accent bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-lg">
                <Calculator size={12} /> Datos del simulador
              </span>
            )}
            <button onClick={() => navigate('/contratos')} className="btn-ghost flex items-center gap-1.5 text-sm">
              <ArrowLeft size={15} /> Volver
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario */}
          <div className="space-y-5">
            {/* Identificación */}
            <div className="card space-y-4">
              <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-gray-100 pb-2">Identificación</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lb}>N° Contrato</label><input className={fi} value={form.numero} onChange={e => F('numero', e.target.value)} /></div>
                <div><label className={lb}>Tipo</label>
                  <select className={fi} value={form.tipo} onChange={e => F('tipo', e.target.value)}>
                    <option value="reserva">Reserva</option><option value="boleto">Boleto</option>
                    <option value="escritura">Escritura</option><option value="cesion">Cesión</option>
                  </select>
                </div>
              </div>
              <div><label className={lb}>Emprendimiento</label>
                <select className={fi} value={form.emprendimientoId} onChange={e => F('emprendimientoId', e.target.value)}>
                  <option value="">— Seleccioná —</option>
                  {emprendimientos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div><label className={lb}>Unidad</label>
                <select className={fi} value={form.unidadId} onChange={e => F('unidadId', e.target.value)} disabled={!form.emprendimientoId}>
                  <option value="">— {form.emprendimientoId ? 'Seleccioná unidad' : 'Primero elegí emprendimiento'} —</option>
                  {unidades.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.identificador}{u.tipo ? ` (${u.tipo})` : ''} — {u.estado}
                    </option>
                  ))}
                </select>
                {form.emprendimientoId && unidades.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Sin unidades disponibles en este emprendimiento</p>
                )}
              </div>
              <div><label className={lb}>Cliente</label>
                <select className={fi} value={form.clienteId} onChange={e => F('clienteId', e.target.value)}>
                  <option value="">— Seleccioná —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{nombreCliente(c)}</option>)}
                </select>
              </div>
            </div>

            {/* Precio y seña */}
            <div className="card space-y-4">
              <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-gray-100 pb-2">Precio y seña</h3>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 h-9">
                {(['USD', 'ARS'] as const).map(m => (
                  <button key={m} type="button" onClick={() => F('moneda', m)}
                    className={cn('flex-1 text-sm font-semibold transition-colors', form.moneda === m ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50')}>
                    {m === 'USD' ? 'U$D' : '$ ARS'}
                  </button>
                ))}
              </div>
              <div><label className={lb}>Precio total ({form.moneda})</label><input type="number" className={fi} value={form.precioTotal} onChange={e => F('precioTotal', Number(e.target.value))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lb}>Seña</label><input type="number" className={fi} value={form.senaMonto} onChange={e => F('senaMonto', Number(e.target.value))} /></div>
                <div><label className={lb}>Fecha seña</label><input type="date" className={fi} value={form.senaFecha} onChange={e => F('senaFecha', e.target.value)} /></div>
              </div>
            </div>

            {/* Tramos */}
            <div className="card space-y-4">
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-2">Tramo 1 — Durante obra</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lb}>Meses de obra</label><input type="number" min="1" className={cn(fi, 'text-center')} value={form.tramo1Meses} onChange={e => F('tramo1Meses', Number(e.target.value))} /></div>
                <div><label className={lb}>Inicio cuotas</label><input type="date" className={fi} value={form.tramo1Inicio} onChange={e => F('tramo1Inicio', e.target.value)} /></div>
              </div>
              {form.moneda === 'ARS' && (
                <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg bg-orange-50 border border-orange-100">
                  <input type="checkbox" className="accent-orange-500" checked={form.tramo1ConCac} onChange={e => F('tramo1ConCac', e.target.checked)} />
                  <span className="text-sm text-orange-800 font-medium">Ajuste CAC mensual</span>
                </label>
              )}
              <h3 className="text-xs font-bold text-green-600 uppercase tracking-widest border-b border-green-50 pb-2 pt-2">Tramo 2 — Post-obra</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lb}>Meses post-obra (0 = sin T2)</label><input type="number" min="0" className={cn(fi, 'text-center')} value={form.tramo2Meses} onChange={e => F('tramo2Meses', Number(e.target.value))} /></div>
                {form.tramo2Meses > 0 && <div><label className={lb}>Tasa anual (%)</label><input type="number" min="0" className={fi} value={form.tramo2TasaAnual} onChange={e => F('tramo2TasaAnual', Number(e.target.value))} /></div>}
              </div>
            </div>

            <div className="card">
              <label className={lb}>Notas</label>
              <textarea className={fi} rows={3} value={form.notas} onChange={e => F('notas', e.target.value)} />
            </div>

            <button
              disabled={saving || !form.emprendimientoId || !form.unidadId || !form.clienteId || !form.precioTotal || !plan}
              onClick={guardar}
              className="btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={16} /> {saving ? 'Guardando...' : 'Crear contrato'}
            </button>
          </div>

          {/* Preview del plan */}
          <div className="space-y-4">
            {plan ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Cuota Tramo 1', value: fmtM(plan.resumen.cuotaTramo1) },
                    { label: plan.resumen.cuotaTramo2 > 0 ? 'Cuota Tramo 2' : 'Sin tramo 2', value: plan.resumen.cuotaTramo2 > 0 ? fmtM(plan.resumen.cuotaTramo2) : '—' },
                    { label: 'Total cuotas', value: `${plan.cuotas.length}` },
                    { label: 'Total a pagar', value: fmtM(plan.resumen.totalConSena) },
                  ].map(s => (
                    <div key={s.label} className="card text-center py-3">
                      <p className="text-lg font-bold text-primary">{s.value}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="card overflow-hidden p-0">
                  <div className="px-4 py-2.5 border-b border-gray-100 text-xs font-semibold text-gray-500">
                    Preview plan de cuotas
                  </div>
                  <div className="overflow-auto max-h-80">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-primary text-white">
                        <tr>
                          <th className="px-3 py-2 text-left">N°</th>
                          <th className="px-3 py-2 text-left">Vencimiento</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                          <th className="px-3 py-2 text-center">Tramo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {plan.cuotas.map((c, i) => (
                          <tr key={c.numero} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                            <td className="px-3 py-1.5 text-gray-400 font-mono">{c.numero}</td>
                            <td className="px-3 py-1.5 text-gray-700">{format(c.fechaVencimiento, 'dd/MM/yyyy')}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-semibold">{fmtM(c.montoOriginal)}</td>
                            <td className="px-3 py-1.5 text-center">
                              <span className={cn('badge text-[9px]',
                                c.tramo === 'sena' ? 'bg-amber-100 text-amber-800' :
                                c.tramo === 'tramo1' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                              )}>{c.tramo}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
                <Calculator size={40} className="mb-3 text-gray-200" />
                <p className="font-medium">El plan de cuotas aparecerá aquí</p>
                <p className="text-sm mt-1">Ingresá el precio y los meses</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
