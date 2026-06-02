import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, FileDown, RefreshCw, AlertTriangle, CheckCircle, Clock, X } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useContratoDetalle, type Contrato, type Cuota } from '@/hooks/useContratos'
import { fmt } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

const ESTADO_CUOTA: Record<string, { cls: string; label: string }> = {
  pendiente: { cls: 'badge-info',    label: 'Pendiente' },
  pagada:    { cls: 'badge-success', label: 'Pagada' },
  vencida:   { cls: 'badge-danger',  label: 'Vencida' },
  refinanciada: { cls: 'badge-warning', label: 'Refi.' },
}

function ActualizarCACModal({ onClose }: { onClose: () => void }) {
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'))
  const [valor, setValor] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Actualizar cuotas con CAC</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">Aplicará el índice CAC del período seleccionado a todas las cuotas ARS pendientes de este contrato.</p>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Período a aplicar</label>
            <input type="month" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={mes} onChange={e => setMes(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Valor índice CAC ese mes</label>
            <input type="number" placeholder="Ej: 1250.45" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={valor} onChange={e => setValor(e.target.value)} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={() => { alert('Cuotas actualizadas con CAC (conectar Supabase)'); onClose() }} className="btn-primary flex items-center gap-2">
            <RefreshCw size={14} /> Aplicar CAC
          </button>
        </div>
      </div>
    </div>
  )
}

function generarPDFContrato(contrato: Contrato, cuotas: Cuota[]) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const fmtM  = (n: number) => fmt(n, contrato.moneda)

  // Encabezado
  doc.setFillColor(26, 58, 92)
  doc.rect(0, 0, 210, 32, 'F')
  doc.setTextColor(255)
  doc.setFontSize(20); doc.setFont('helvetica', 'bold')
  doc.text('CIVILMAR', 15, 14)
  doc.setFontSize(11); doc.setFont('helvetica', 'normal')
  doc.text('Desarrolladora Inmobiliaria', 15, 22)
  doc.text(`Contrato N° ${contrato.numero}`, 195, 14, { align: 'right' })
  doc.text(format(new Date(contrato.fecha_firma ?? new Date()), 'dd/MM/yyyy', { locale: es }), 195, 22, { align: 'right' })
  doc.setTextColor(0)

  let y = 42
  doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text(`BOLETO DE COMPRAVENTA`, 105, y, { align: 'center' }); y += 10

  // Partes
  doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.text('VENDEDOR:', 15, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Civilmar S.A. — CUIT 30-12345678-9', 50, y); y += 6
  doc.setFont('helvetica', 'bold')
  doc.text('COMPRADOR:', 15, y)
  doc.setFont('helvetica', 'normal')
  const clienteNom = contrato.cliente ? `${contrato.cliente.apellido ?? ''}, ${contrato.cliente.nombre}`.replace(/^,\s*/, '') : '—'
  doc.text(`${clienteNom}${contrato.cliente?.dni ? ` — DNI/CUIT: ${contrato.cliente.dni}` : ''}`, 50, y); y += 6
  y += 3

  // Inmueble
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('INMUEBLE:', 15, y); doc.setFont('helvetica', 'normal')
  doc.text(`${contrato.emprendimiento?.nombre ?? '—'} — Unidad ${contrato.unidad?.identificador ?? '—'} (${contrato.unidad?.tipo ?? ''})`, 50, y); y += 10

  // Condiciones económicas
  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Monto']],
    body: [
      ['Precio total de venta', fmtM(contrato.precio_total)],
      ['Seña inicial', fmtM(contrato.sena_monto)],
      [`Tramo 1 — ${contrato.tramo1_meses} cuotas fijas (durante obra)`, fmtM(contrato.tramo1_cuota) + '/mes'],
      ...(contrato.tramo2_meses > 0 ? [[`Tramo 2 — ${contrato.tramo2_meses} cuotas post-obra (${contrato.tramo2_tasa_anual}% TNA)`, fmtM(contrato.tramo2_cuota) + '/mes']] : []),
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
    margin: { left: 15, right: 15 },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // Cronograma (primeras 20 cuotas)
  doc.setFont('helvetica', 'bold'); doc.text('Cronograma de pagos (primeras cuotas)', 15, y); y += 4

  const cuotasArr = Array.isArray(cuotas) ? cuotas : []
  autoTable(doc, {
    startY: y,
    head: [['N°', 'Vencimiento', 'Monto', 'Tramo']],
    body: cuotasArr.slice(0, 20).map(c => [
      String(c.numero_cuota),
      format(new Date(c.fecha_vencimiento), 'dd/MM/yyyy', { locale: es }),
      fmtM(c.monto_original),
      c.tramo === 'sena' ? 'Seña' : c.tramo === 'tramo1' ? 'Tramo 1' : 'Tramo 2',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    margin: { left: 15, right: 15 },
  })

  // Firmas
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  if (finalY < 240) {
    const fy = finalY + 15
    doc.setFontSize(9)
    doc.line(20, fy + 15, 90, fy + 15); doc.line(120, fy + 15, 190, fy + 15)
    doc.text('Firma del VENDEDOR', 55, fy + 20, { align: 'center' })
    doc.text('Firma del COMPRADOR', 155, fy + 20, { align: 'center' })
    doc.setFontSize(7); doc.setTextColor(120)
    doc.text('Civilmar S.A. · Mar del Plata · Generado por Civilmar ERP', 105, 286, { align: 'center' })
  }

  doc.save(`contrato_${contrato.numero.replace(/\//g, '-')}.pdf`)
}

export default function ContratoDetalle() {
  const { id } = useParams<{ id: string }>()
  const [showCac, setShowCac] = useState(false)
  const [pagoModal, setPagoModal] = useState<string | null>(null)

  const { contrato, cuotas: rawCuotas, loading, registrarPago } = useContratoDetalle(id)

  if (loading) return (
    <div className="flex flex-col h-full">
      <Header title="Cargando contrato..." />
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
      </div>
    </div>
  )

  if (!contrato) return (
    <div className="flex flex-col h-full">
      <Header title="Contrato no encontrado" />
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center"><p>No se encontró el contrato</p>
          <Link to="/contratos" className="text-primary text-sm hover:underline mt-2 block">← Volver</Link>
        </div>
      </div>
    </div>
  )

  const cuotas = rawCuotas
  const vencidas  = cuotas.filter(c => c.estado === 'vencida').length
  const pagadas   = cuotas.filter(c => c.estado === 'pagada').length
  const pendientes = cuotas.filter(c => c.estado === 'pendiente').length
  const fmtM = (n: number) => fmt(n, contrato.moneda)

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`Contrato N° ${contrato.numero}`}
        subtitle={`${contrato.cliente ? `${contrato.cliente.apellido ?? ''}, ${contrato.cliente.nombre}`.replace(/^,\s*/, '') : '—'} · ${contrato.emprendimiento?.nombre ?? '—'} — ${contrato.unidad?.identificador ?? '—'}`}
        actions={
          <div className="flex items-center gap-2">
            {contrato.tramo1_con_cac && (
              <button onClick={() => setShowCac(true)} className="btn-ghost flex items-center gap-2 text-sm border border-orange-200 text-orange-700 hover:bg-orange-50">
                <RefreshCw size={14} /> Actualizar CAC
              </button>
            )}
            <button onClick={() => generarPDFContrato(contrato, cuotas)} className="btn-primary flex items-center gap-2 text-sm">
              <FileDown size={15} /> Exportar PDF
            </button>
            <Link to="/contratos" className="btn-ghost flex items-center gap-1.5 text-sm"><ArrowLeft size={15} /> Volver</Link>
          </div>
        }
      />

      {vencidas > 0 && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle size={14} /> <strong>{vencidas} cuota{vencidas !== 1 ? 's' : ''} vencida{vencidas !== 1 ? 's' : ''}</strong> — requiere atención inmediata
        </div>
      )}

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Resumen */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Precio total',     value: fmtM(contrato.precio_total),  cls: 'text-primary' },
            { label: 'Cuota Tramo 1',    value: fmtM(contrato.tramo1_cuota),  cls: 'text-blue-700' },
            { label: contrato.tramo2_meses > 0 ? 'Cuota Tramo 2' : 'Sin tramo 2',
              value: contrato.tramo2_meses > 0 ? fmtM(contrato.tramo2_cuota) : '—', cls: 'text-green-700' },
            { label: 'Avance de pago',   value: `${pagadas}/${cuotas.length} cuotas`, cls: 'text-amber-700' },
          ].map(s => (
            <div key={s.label} className="card text-center py-3">
              <p className={cn('text-xl font-bold', s.cls)}>{s.value}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Info del contrato */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card">
            <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Partes</h4>
            {[
              ['Comprador', contrato.cliente ? `${contrato.cliente.apellido ?? ''}, ${contrato.cliente.nombre}`.replace(/^,\s*/, '') : '—'],
              ['DNI/CUIT', contrato.cliente?.dni ?? '—'],
              ['Vendedor', contrato.vendedor_id ?? '—'],
              ['Tipo', contrato.tipo.charAt(0).toUpperCase() + contrato.tipo.slice(1)],
              ['Moneda', contrato.moneda],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0 text-sm">
                <span className="text-gray-400 text-xs">{l}</span>
                <span className="font-medium text-gray-800">{v}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Estructura de pago</h4>
            {[
              ['Seña', fmtM(contrato.sena_monto)],
              ['Tramo 1 total', fmtM(contrato.total_tramo1 ?? 0)],
              ['Tramo 1 meses', `${contrato.tramo1_meses} cuotas`],
              ['Con ajuste CAC', contrato.tramo1_con_cac ? 'Sí' : 'No'],
              ['Tramo 2 total', contrato.tramo2_meses > 0 ? fmtM(contrato.total_tramo2 ?? 0) : '—'],
              ['Tramo 2 meses', contrato.tramo2_meses > 0 ? `${contrato.tramo2_meses} cuotas` : '—'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0 text-sm">
                <span className="text-gray-400 text-xs">{l}</span>
                <span className="font-medium text-gray-800">{v}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Fechas y estado</h4>
            {[
              ['Estado', contrato.estado],
              ['Firma', contrato.fecha_firma ? format(new Date(contrato.fecha_firma), 'dd/MM/yyyy', { locale: es }) : '—'],
              ['Escritura est.', contrato.fecha_escritura_estimada ? format(new Date(contrato.fecha_escritura_estimada), 'dd/MM/yyyy', { locale: es }) : '—'],
              ['Cuotas pagadas', `${pagadas}`],
              ['Cuotas pendientes', `${pendientes}`],
              ['Cuotas vencidas', `${vencidas}`],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0 text-sm">
                <span className="text-gray-400 text-xs">{l}</span>
                <span className={cn('font-medium', l === 'Cuotas vencidas' && vencidas > 0 ? 'text-danger' : 'text-gray-800')}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan de cuotas */}
        <div className="card overflow-hidden p-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h4 className="font-semibold text-gray-800 text-sm">Plan de cuotas completo ({cuotas.length} cuotas)</h4>
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><CheckCircle size={11} className="text-green-500" /> {pagadas} pagadas</span>
              <span className="flex items-center gap-1"><Clock size={11} className="text-blue-500" /> {pendientes} pendientes</span>
              {vencidas > 0 && <span className="flex items-center gap-1"><AlertTriangle size={11} className="text-red-500" /> {vencidas} vencidas</span>}
            </div>
          </div>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs text-gray-500 font-semibold">N°</th>
                  <th className="px-4 py-2.5 text-left text-xs text-gray-500 font-semibold">Vencimiento</th>
                  <th className="px-4 py-2.5 text-right text-xs text-gray-500 font-semibold">Monto</th>
                  <th className="px-4 py-2.5 text-center text-xs text-gray-500 font-semibold">Tramo</th>
                  <th className="px-4 py-2.5 text-center text-xs text-gray-500 font-semibold">Estado</th>
                  <th className="px-4 py-2.5 text-xs text-gray-500 font-semibold">Pago</th>
                  <th className="px-4 py-2.5 w-32" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cuotas.map((c, i) => {
                  const cfg = ESTADO_CUOTA[c.estado]
                  const esVenc = c.estado === 'vencida'
                  return (
                    <tr key={c.id} className={cn(i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40', esVenc && 'bg-red-50/60')}>
                      <td className="px-4 py-2 text-xs text-gray-400 font-mono">{c.numero_cuota}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {format(new Date(c.fecha_vencimiento), 'dd/MM/yyyy', { locale: es })}
                        {(c.mora_dias ?? 0) > 0 && <span className="ml-1 text-[10px] text-red-600 font-semibold">{c.mora_dias}d</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900 tabular-nums">{fmtM(c.monto_original)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={cn('badge text-[9px]',
                          c.tramo === 'sena' ? 'bg-amber-100 text-amber-800' :
                          c.tramo === 'tramo1' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        )}>
                          {c.tramo === 'sena' ? 'Seña' : c.tramo === 'tramo1' ? 'T1' : 'T2'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center"><span className={cn('badge text-[9px]', cfg.cls)}>{cfg.label}</span></td>
                      <td className="px-4 py-2 text-xs text-gray-400">
                        {c.fecha_pago ? <span className="text-green-600">{format(new Date(c.fecha_pago), 'dd/MM/yy', { locale: es })}</span> : '—'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {(c.estado === 'pendiente' || c.estado === 'vencida') && (
                          <button onClick={() => setPagoModal(c.id)}
                            className="text-xs bg-primary text-white hover:bg-primary-light px-2.5 py-1 rounded-lg font-medium transition-colors">
                            Cobrar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCac && <ActualizarCACModal onClose={() => setShowCac(false)} />}
      {pagoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-bold text-gray-900 mb-4">Registrar pago</h3>
            <p className="text-sm text-gray-600 mb-4">Cuota {pagoModal} — {fmtM(cuotas.find(c => c.id === pagoModal)?.monto_original ?? 0)}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setPagoModal(null)} className="btn-ghost">Cancelar</button>
              <button onClick={async () => {
                try { await registrarPago(pagoModal, { fecha_pago: new Date().toISOString().split('T')[0], monto_pagado: cuotas.find(c => c.id === pagoModal)?.monto_original ?? 0, medio_pago: 'transferencia' }); setPagoModal(null) }
                catch (e) { alert(e instanceof Error ? e.message : 'Error al registrar pago') }
              }} className="btn-primary">Confirmar pago</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
