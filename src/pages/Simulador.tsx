import { useMemo, useCallback } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { format, addMonths, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  FileDown, MessageCircle, FileText, Calculator,
  TrendingUp, Landmark, BadgeDollarSign, RefreshCw,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { calcularPlanDePagos, type PlanDePagos } from '@/lib/simulador'
import { fmt } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

// ── Mock data (reemplazar con queries Supabase) ────────────────────────────────
const EMPRENDIMIENTOS = [
  { id: 'e1', nombre: 'Torre Norte — Constitución 1230' },
  { id: 'e2', nombre: 'Costa Residences — Güemes 450' },
  { id: 'e3', nombre: 'Parque San Martín — Lote B' },
]
const UNIDADES: Record<string, { id: string; identificador: string; tipo: string; precio_usd: number }[]> = {
  e1: [
    { id: 'u1', identificador: '2B',   tipo: 'Departamento', precio_usd: 195000 },
    { id: 'u2', identificador: '3A',   tipo: 'Departamento', precio_usd: 220000 },
    { id: 'u3', identificador: 'PH 1', tipo: 'Penthouse',    precio_usd: 350000 },
    { id: 'u4', identificador: '1C',   tipo: 'Departamento', precio_usd: 168000 },
  ],
  e2: [
    { id: 'u5', identificador: 'Lote 5',  tipo: 'Lote', precio_usd: 85000 },
    { id: 'u6', identificador: 'Lote 12', tipo: 'Lote', precio_usd: 92000 },
  ],
  e3: [
    { id: 'u7', identificador: 'Casa A', tipo: 'Casa', precio_usd: 310000 },
    { id: 'u8', identificador: 'Casa B', tipo: 'Casa', precio_usd: 285000 },
  ],
}

// ── Tipos del formulario ───────────────────────────────────────────────────────
interface FormValues {
  emprendimientoId: string
  unidadId: string
  clienteNombre: string
  precioTotal: number
  moneda: 'USD' | 'ARS'
  sena: number
  fechaSena: string
  tramo1Meses: number
  tramo1Inicio: string
  tramo1ConCac: boolean
  tramo2Meses: number
  tramo2TasaAnual: number
}

const hoy      = format(new Date(), 'yyyy-MM-dd')
const proxMes  = format(addMonths(new Date(), 1), 'yyyy-MM-dd')

const DEFAULTS: FormValues = {
  emprendimientoId: '',
  unidadId: '',
  clienteNombre: '',
  precioTotal: 0,
  moneda: 'USD',
  sena: 0,
  fechaSena: hoy,
  tramo1Meses: 24,
  tramo1Inicio: proxMes,
  tramo1ConCac: false,
  tramo2Meses: 0,
  tramo2TasaAnual: 0,
}

// ── Helpers de formato ─────────────────────────────────────────────────────────
function fmtFechaCorta(d: Date): string { return format(d, 'dd/MM/yyyy') }
function fmtMesAnio(d: Date): string    { return format(d, 'MMM yyyy', { locale: es }) }
function fmtFechaISO(iso: string): string {
  try { return format(parseISO(iso), 'dd/MM/yyyy', { locale: es }) } catch { return iso }
}

// ── Badge de tramo ─────────────────────────────────────────────────────────────
function TramoBadge({ tramo }: { tramo: 'sena' | 'tramo1' | 'tramo2' }) {
  const cfg = {
    sena:   { label: 'Seña',      cls: 'bg-amber-100 text-amber-800' },
    tramo1: { label: 'Obra',      cls: 'bg-blue-100 text-blue-800' },
    tramo2: { label: 'Post-obra', cls: 'bg-green-100 text-green-800' },
  }[tramo]
  return <span className={`badge text-[10px] ${cfg.cls}`}>{cfg.label}</span>
}

// ── Generador de PDF ───────────────────────────────────────────────────────────
function generarPDF(values: FormValues, plan: PlanDePagos) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const fmtM  = (n: number) => fmt(n, values.moneda)
  const emp   = EMPRENDIMIENTOS.find(e => e.id === values.emprendimientoId)
  const uni   = UNIDADES[values.emprendimientoId]?.find(u => u.id === values.unidadId)

  // Encabezado
  doc.setFillColor(26, 58, 92)
  doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20); doc.setFont('helvetica', 'bold')
  doc.text('CIVILMAR', 15, 13)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text('Plan de Pagos', 15, 21)
  doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 195, 21, { align: 'right' })
  doc.setTextColor(0, 0, 0)

  let y = 38

  // Datos del inmueble y cliente
  if (emp || uni || values.clienteNombre) {
    doc.setFontSize(11); doc.setFont('helvetica', 'bold')
    doc.text('Datos de la operación', 15, y); y += 6
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    if (values.clienteNombre) { doc.text(`Cliente: ${values.clienteNombre}`, 15, y); y += 5 }
    if (emp) { doc.text(`Emprendimiento: ${emp.nombre}`, 15, y); y += 5 }
    if (uni) { doc.text(`Unidad: ${uni.identificador} · ${uni.tipo}`, 15, y); y += 5 }
    y += 4
  }

  // Resumen financiero
  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Monto', 'Detalle']],
    body: [
      ['Precio total de lista', fmtM(plan.resumen.totalConSena), `Moneda: ${values.moneda}`],
      ['Seña inicial', fmtM(plan.resumen.sena), values.fechaSena ? `Fecha: ${fmtFechaISO(values.fechaSena)}` : ''],
      ['Cuota Tramo 1 (durante obra)', fmtM(plan.resumen.cuotaTramo1), `${values.tramo1Meses} cuotas${values.tramo1ConCac ? ' · con ajuste CAC' : ''}`],
      ...(plan.resumen.cuotaTramo2 > 0
        ? [['Cuota Tramo 2 (post-obra)', fmtM(plan.resumen.cuotaTramo2), `${values.tramo2Meses} cuotas · TNA ${values.tramo2TasaAnual}%`]]
        : []),
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 }, 1: { halign: 'right', cellWidth: 40 } },
    margin: { left: 15, right: 15 },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text('Cronograma de pagos completo', 15, y); y += 4

  autoTable(doc, {
    startY: y,
    head: [['N°', 'Vencimiento', 'Monto', 'Tramo', 'CAC']],
    body: plan.cuotas.map(c => [
      String(c.numero),
      fmtFechaCorta(c.fechaVencimiento),
      fmtM(c.montoOriginal),
      c.tramo === 'sena' ? 'Seña' : c.tramo === 'tramo1' ? 'Tramo 1 — Obra' : 'Tramo 2 — Post-obra',
      c.conCac ? 'Sí' : '—',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 30 },
      2: { halign: 'right', cellWidth: 35 },
      3: { cellWidth: 52 },
      4: { halign: 'center', cellWidth: 15 },
    },
    margin: { left: 15, right: 15 },
    didDrawPage: (data) => {
      doc.setFontSize(7); doc.setTextColor(150)
      doc.text(`Civilmar ERP · Plan de pagos${values.clienteNombre ? ` · ${values.clienteNombre}` : ''} · Pág. ${data.pageNumber}`, 105, 289, { align: 'center' })
      doc.setTextColor(0)
    },
  })

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  if (finalY < 268) {
    doc.setFontSize(7); doc.setTextColor(130)
    const nota = values.tramo1ConCac
      ? '(*) Las cuotas del Tramo 1 serán actualizadas mensualmente según el Índice de la Construcción publicado por el INDEC.'
      : 'Simulación informativa. Los valores definitivos constarán en el instrumento contractual correspondiente.'
    doc.text(nota, 15, finalY + 8, { maxWidth: 180 })
  }

  const nombre = values.clienteNombre
    ? `plan_${values.clienteNombre.replace(/\s+/g, '_').toLowerCase()}.pdf`
    : 'plan_pagos_civilmar.pdf'
  doc.save(nombre)
}

// ── WhatsApp ───────────────────────────────────────────────────────────────────
function abrirWhatsApp(values: FormValues, plan: PlanDePagos) {
  const fmtM = (n: number) => fmt(n, values.moneda)
  const emp  = EMPRENDIMIENTOS.find(e => e.id === values.emprendimientoId)
  const uni  = UNIDADES[values.emprendimientoId]?.find(u => u.id === values.unidadId)
  const { resumen } = plan

  const partes = [
    `*Plan de pagos — Civilmar*`,
    emp  ? `📍 ${emp.nombre}`                    : '',
    uni  ? `🏠 Unidad ${uni.identificador} (${uni.tipo})` : '',
    '',
    `💰 *Precio total:* ${fmtM(resumen.totalConSena)}`,
    resumen.sena > 0
      ? `✅ *Seña:* ${fmtM(resumen.sena)} — ${fmtFechaISO(values.fechaSena)}`
      : '',
    '',
    `📅 *Tramo 1 — Durante obra (${values.tramo1Meses} cuotas)*`,
    `   Cuota mensual fija: *${fmtM(resumen.cuotaTramo1)}*`,
    `   Inicio: ${fmtFechaISO(values.tramo1Inicio)}`,
    values.tramo1ConCac ? '   _(cuotas con ajuste CAC mensual)_' : '',
    resumen.cuotaTramo2 > 0
      ? [
          '',
          `📆 *Tramo 2 — Post-obra (${values.tramo2Meses} cuotas)*`,
          `   Cuota mensual: *${fmtM(resumen.cuotaTramo2)}*`,
          values.tramo2TasaAnual > 0 ? `   Tasa: ${values.tramo2TasaAnual}% TNA` : '',
        ].join('\n')
      : '',
    '',
    `📋 *Total de pagos:* ${plan.cuotas.length} cuotas`,
    `📆 *Período:* ${fmtMesAnio(plan.cuotas[0]?.fechaVencimiento)} → ${fmtMesAnio(plan.cuotas[plan.cuotas.length - 1]?.fechaVencimiento)}`,
    '',
    `_Generado por Civilmar ERP_`,
  ].filter(l => l !== '').join('\n')

  window.open(`https://wa.me/?text=${encodeURIComponent(partes)}`, '_blank')
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function Simulador() {
  const navigate = useNavigate()

  const { register, control, setValue, reset, getValues } = useForm<FormValues>({
    defaultValues: DEFAULTS,
  })
  const values = useWatch({ control }) as FormValues

  // Plan calculado en tiempo real — se recalcula con cada cambio de campo
  const plan = useMemo((): PlanDePagos | null => {
    const precio = Number(values.precioTotal)
    if (!precio || precio <= 0 || !Number(values.tramo1Meses)) return null
    try {
      return calcularPlanDePagos({
        precioTotal:     precio,
        moneda:          values.moneda || 'USD',
        sena:            Number(values.sena) || 0,
        fechaSena:       values.fechaSena ? parseISO(values.fechaSena) : new Date(),
        tramo1Meses:     Number(values.tramo1Meses) || 24,
        tramo1Inicio:    values.tramo1Inicio ? parseISO(values.tramo1Inicio) : addMonths(new Date(), 1),
        tramo1ConCac:    !!values.tramo1ConCac,
        tramo2Meses:     Number(values.tramo2Meses) || 0,
        tramo2TasaAnual: Number(values.tramo2TasaAnual) || 0,
      })
    } catch { return null }
  }, [values])

  const onUnidadChange = useCallback((uid: string, eid: string) => {
    const u = UNIDADES[eid]?.find(x => x.id === uid)
    if (u) setValue('precioTotal', u.precio_usd)
  }, [setValue])

  const moneda = values.moneda || 'USD'
  const fmtM   = (n: number) => fmt(n, moneda)
  const hasCac = moneda === 'ARS' && !!values.tramo1ConCac
  const hasT2  = Number(values.tramo2Meses) > 0

  const fieldCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white'
  const labelCls = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Simulador de ventas"
        subtitle="Los valores se actualizan en tiempo real mientras editás los campos"
        actions={
          <button onClick={() => reset(DEFAULTS)} className="btn-ghost flex items-center gap-1.5 text-xs">
            <RefreshCw size={13} /> Limpiar
          </button>
        }
      />

      <div className="flex-1 flex overflow-hidden">

        {/* ── Formulario (panel izquierdo fijo) ───────────────────────────────── */}
        <div className="w-[300px] shrink-0 overflow-y-auto bg-white border-r border-gray-100 p-5 space-y-6">

          {/* Inmueble */}
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest border-b border-gray-100 pb-1.5 mb-3">
              Inmueble
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Emprendimiento</label>
                <select
                  className={fieldCls}
                  {...register('emprendimientoId')}
                  onChange={e => { setValue('emprendimientoId', e.target.value); setValue('unidadId', '') }}
                >
                  <option value="">— Seleccioná —</option>
                  {EMPRENDIMIENTOS.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Unidad</label>
                <select
                  className={fieldCls}
                  {...register('unidadId')}
                  disabled={!values.emprendimientoId}
                  onChange={e => { setValue('unidadId', e.target.value); onUnidadChange(e.target.value, values.emprendimientoId) }}
                >
                  <option value="">— Seleccioná —</option>
                  {(UNIDADES[values.emprendimientoId] ?? []).map(u => (
                    <option key={u.id} value={u.id}>{u.identificador} — {u.tipo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Cliente (opcional)</label>
                <input className={fieldCls} placeholder="Nombre del cliente..." {...register('clienteNombre')} />
              </div>
            </div>
          </div>

          {/* Precio */}
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest border-b border-gray-100 pb-1.5 mb-3">
              Precio y seña
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Moneda de la operación</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 h-9">
                  {(['USD', 'ARS'] as const).map(m => (
                    <button key={m} type="button"
                      onClick={() => { setValue('moneda', m); if (m === 'USD') setValue('tramo1ConCac', false) }}
                      className={cn('flex-1 text-sm font-bold transition-colors',
                        moneda === m ? 'bg-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                      )}
                    >
                      {m === 'USD' ? 'U$D dólares' : '$ pesos ARS'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Precio de lista</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">
                    {moneda === 'USD' ? 'U$D' : '$'}
                  </span>
                  <input type="number" min="0" step="1000" placeholder="0"
                    className={cn(fieldCls, 'pl-10 font-mono')}
                    {...register('precioTotal', { valueAsNumber: true })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Seña</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-mono">
                      {moneda === 'USD' ? 'U$D' : '$'}
                    </span>
                    <input type="number" min="0" step="500" placeholder="0"
                      className={cn(fieldCls, 'pl-9 font-mono text-xs')}
                      {...register('sena', { valueAsNumber: true })} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Fecha seña</label>
                  <input type="date" className={cn(fieldCls, 'text-xs')} {...register('fechaSena')} />
                </div>
              </div>
              {Number(values.precioTotal) > 0 && Number(values.sena) > 0 && (
                <p className="text-[10px] text-gray-400 -mt-1">
                  {((Number(values.sena) / Number(values.precioTotal)) * 100).toFixed(1)}% del precio de lista
                </p>
              )}
            </div>
          </div>

          {/* Tramo 1 */}
          <div>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-1.5 mb-3">
              Tramo 1 — Durante la obra
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Meses de obra</label>
                  <input type="number" min="1" max="120" className={cn(fieldCls, 'text-center font-mono')}
                    {...register('tramo1Meses', { valueAsNumber: true })} />
                </div>
                <div>
                  <label className={labelCls}>Inicio cuotas</label>
                  <input type="date" className={cn(fieldCls, 'text-xs')} {...register('tramo1Inicio')} />
                </div>
              </div>
              {moneda === 'ARS' && (
                <label className="flex items-center gap-2.5 cursor-pointer select-none p-2.5 rounded-lg bg-orange-50 border border-orange-100">
                  <input type="checkbox" className="w-4 h-4 rounded accent-orange-500"
                    {...register('tramo1ConCac')} />
                  <span className="text-sm text-orange-800 font-medium leading-tight">
                    Ajuste CAC mensual
                    <span className="block text-[10px] text-orange-500 font-normal">Las cuotas se actualizan con el índice INDEC</span>
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Tramo 2 */}
          <div>
            <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest border-b border-green-50 pb-1.5 mb-3">
              Tramo 2 — Post-obra
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Meses de financiación <span className="text-gray-300">(0 = sin T2)</span></label>
                <input type="number" min="0" max="360" className={cn(fieldCls, 'text-center font-mono')}
                  {...register('tramo2Meses', { valueAsNumber: true })} />
              </div>
              {hasT2 && (
                <div>
                  <label className={labelCls}>Tasa anual incorporada (%)</label>
                  <div className="relative">
                    <input type="number" min="0" max="200" step="0.5" placeholder="0"
                      className={cn(fieldCls, 'pr-8 font-mono')}
                      {...register('tramo2TasaAnual', { valueAsNumber: true })} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Interés ya incorporado al precio — no se declara al cliente.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Preview en tiempo real (panel derecho) ──────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-bg">

          {!plan ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Calculator size={52} className="text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 font-semibold text-base">Ingresá el precio para ver el plan</p>
                <p className="text-gray-300 text-sm mt-1.5">El preview se actualiza mientras escribís</p>
              </div>
            </div>
          ) : (
            <>
              {/* Resumen financiero */}
              <div className="p-4 bg-white border-b border-gray-100 shrink-0">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

                  <div className="rounded-xl bg-primary/5 border border-primary/10 p-3">
                    <div className="flex items-center gap-1.5 text-primary mb-1.5">
                      <BadgeDollarSign size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wide">Precio total</span>
                    </div>
                    <p className="text-xl font-bold text-primary leading-none">{fmtM(plan.resumen.totalConSena)}</p>
                    {plan.resumen.sena > 0 && (
                      <p className="text-[10px] text-gray-400 mt-1">Seña: {fmtM(plan.resumen.sena)}</p>
                    )}
                  </div>

                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                    <div className="flex items-center gap-1.5 text-blue-700 mb-1.5">
                      <Landmark size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wide">Cuota Tramo 1</span>
                    </div>
                    <p className="text-xl font-bold text-blue-800 leading-none">{fmtM(plan.resumen.cuotaTramo1)}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {values.tramo1Meses} cuotas{hasCac ? ' · con CAC' : ''}
                    </p>
                  </div>

                  <div className={cn('rounded-xl border p-3', hasT2 ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100 opacity-50')}>
                    <div className={cn('flex items-center gap-1.5 mb-1.5', hasT2 ? 'text-green-700' : 'text-gray-400')}>
                      <TrendingUp size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wide">Cuota Tramo 2</span>
                    </div>
                    <p className={cn('text-xl font-bold leading-none', hasT2 ? 'text-green-800' : 'text-gray-300')}>
                      {hasT2 ? fmtM(plan.resumen.cuotaTramo2) : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {hasT2 ? `${values.tramo2Meses} cuotas · ${values.tramo2TasaAnual}% TNA` : 'Sin tramo 2'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                    <div className="flex items-center gap-1.5 text-amber-700 mb-1.5">
                      <FileText size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wide">Total cuotas</span>
                    </div>
                    <p className="text-xl font-bold text-amber-800 leading-none">{plan.cuotas.length}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {fmtMesAnio(plan.cuotas[0]?.fechaVencimiento)} →{' '}
                      {fmtMesAnio(plan.cuotas[plan.cuotas.length - 1]?.fechaVencimiento)}
                    </p>
                  </div>

                </div>
              </div>

              {/* Tabla de cuotas con scroll */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-primary text-white">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold w-12">N°</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold w-36">Vencimiento</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold w-40">Monto</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold w-28">Tramo</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold w-16">CAC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.cuotas.map((c, i) => (
                      <tr
                        key={c.numero}
                        className={cn(
                          'border-b border-gray-50 hover:bg-blue-50/40 transition-colors',
                          c.tramo === 'sena'   && 'bg-amber-50/50 hover:bg-amber-50',
                          c.tramo === 'tramo2' && 'bg-green-50/30 hover:bg-green-50/60',
                          c.tramo === 'tramo1' && i % 2 === 0 && 'bg-white',
                          c.tramo === 'tramo1' && i % 2 !== 0 && 'bg-gray-50/40',
                        )}
                      >
                        <td className="px-4 py-2 text-gray-400 font-mono text-xs">{c.numero}</td>
                        <td className="px-4 py-2">
                          <span className="text-gray-800 font-medium">{fmtFechaCorta(c.fechaVencimiento)}</span>
                          <span className="text-gray-300 text-xs ml-2">{fmtMesAnio(c.fechaVencimiento)}</span>
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-gray-900 tabular-nums font-mono">
                          {fmtM(c.montoOriginal)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <TramoBadge tramo={c.tramo} />
                        </td>
                        <td className="px-4 py-2 text-center">
                          {c.conCac
                            ? <span className="badge bg-orange-100 text-orange-700 text-[10px]">CAC</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Barra de acciones */}
              <div className="shrink-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => generarPDF(getValues(), plan)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-light transition-colors shadow-sm"
                >
                  <FileDown size={16} /> Exportar PDF
                </button>
                <button
                  onClick={() => abrirWhatsApp(getValues(), plan)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#25D366] text-white text-sm font-semibold hover:bg-[#20bc59] transition-colors shadow-sm"
                >
                  <MessageCircle size={16} /> Enviar por WhatsApp
                </button>
                <button
                  onClick={() => navigate('/contratos/nuevo', { state: { simulador: { ...getValues(), plan } } })}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg border-2 border-accent text-accent text-sm font-semibold hover:bg-accent hover:text-white transition-colors"
                >
                  <FileText size={16} /> Generar Contrato
                </button>
                <div className="ml-auto text-xs text-gray-400 text-right">
                  <span className="font-medium text-gray-600">{plan.cuotas.length}</span> cuotas ·
                  saldo {fmtM(plan.resumen.totalConSena - plan.resumen.sena)}
                  {hasCac && <span className="ml-2 badge bg-orange-100 text-orange-700">con CAC</span>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
