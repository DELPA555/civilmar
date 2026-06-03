import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  FileText, Download, Search, FileSignature, Receipt,
  Building2, AlertTriangle, Calculator, ArrowRightLeft,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmt } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'
import {
  jsPDF, autoTable, montoEnLetras, pdfHeader, pdfFooter,
  lineaDivisoria, seccion, parFila, ultimaY, type EmpresaInfo,
} from '@/lib/documentos'

// ── Tipos de documento ────────────────────────────────────────────────────────

type TipoDoc =
  | 'boleto'
  | 'recibo_sena'
  | 'cert_avance'
  | 'nota_debito'
  | 'liquidacion'
  | 'cesion'

interface TipoConfig {
  id: TipoDoc
  label: string
  icon: typeof FileText
  color: string
  desc: string
}

const TIPOS: TipoConfig[] = [
  { id: 'boleto',      label: 'Boleto de compraventa', icon: FileSignature, color: 'bg-primary',     desc: 'Template completo con cláusulas estándar' },
  { id: 'recibo_sena', label: 'Recibo de seña',        icon: Receipt,       color: 'bg-accent',      desc: 'Recibo numerado con monto en letras' },
  { id: 'cert_avance', label: 'Certificado de avance', icon: Building2,     color: 'bg-green-700',   desc: 'Estado de obra para entregar al cliente' },
  { id: 'nota_debito', label: 'Nota de débito — Mora', icon: AlertTriangle, color: 'bg-red-600',     desc: 'Intereses por días de atraso en cuotas' },
  { id: 'liquidacion', label: 'Liquidación final',     icon: Calculator,    color: 'bg-teal-700',    desc: 'Saldo total para escritura' },
  { id: 'cesion',      label: 'Cesión de boleto',      icon: ArrowRightLeft,color: 'bg-purple-700',  desc: 'Transferencia de contrato entre clientes' },
]

// ── Estado empresa ─────────────────────────────────────────────────────────────

async function getEmpresa(): Promise<EmpresaInfo> {
  const { data } = await supabase.from('empresas').select('*').limit(1).single()
  return data
    ? { nombre: data.nombre, cuit: data.cuit ?? '—', direccion: data.direccion, localidad: data.localidad, email: data.email, telefono: data.telefono }
    : { nombre: 'Civilmar S.A.', cuit: '30-12345678-9', localidad: 'Mar del Plata', telefono: '223-123-4567' }
}

// ── Generadores PDF ────────────────────────────────────────────────────────────

async function genBoleto(contrato: Record<string, unknown>, empresa: EmpresaInfo) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const numero = `BOL-${String(contrato.numero)}`
  const fecha  = format(new Date(), 'dd/MM/yyyy', { locale: es })
  const moneda = contrato.moneda as 'USD' | 'ARS'
  const fmtM   = (n: number) => fmt(n, moneda)

  let y = await pdfHeader(doc, 'BOLETO DE COMPRAVENTA', numero, fecha, empresa,
    `Contrato ${contrato.numero} | ${(contrato.cliente as Record<string,string>)?.nombre}`)

  // Partes
  y = seccion(doc, 'Partes del contrato', y)
  const cli = contrato.cliente as Record<string, string> | null
  parFila(doc, 'VENDEDOR',   empresa.nombre, 15, y)
  parFila(doc, 'CUIT',       empresa.cuit,   110, y); y += 6
  parFila(doc, 'COMPRADOR',  cli ? `${cli.apellido ?? ''}, ${cli.nombre}`.replace(/^,\s*/,'') : '—', 15, y)
  parFila(doc, 'DNI/CUIT',   cli?.dni ?? '—', 110, y); y += 10

  // Inmueble
  const emp = contrato.emprendimiento as Record<string, string> | null
  const uni = contrato.unidad as Record<string, string> | null
  y = seccion(doc, 'Objeto del contrato', y)
  parFila(doc, 'EMPRENDIMIENTO', emp?.nombre ?? '—', 15, y); y += 6
  parFila(doc, 'UNIDAD',  uni?.identificador ?? '—', 15, y)
  parFila(doc, 'TIPO',    uni?.tipo ?? '—', 110, y); y += 10

  // Condiciones económicas
  y = seccion(doc, 'Condiciones económicas', y)
  const precioTotal = contrato.precio_total as number ?? 0
  parFila(doc, 'PRECIO TOTAL', fmtM(precioTotal), 15, y); y += 6
  parFila(doc, 'EN LETRAS', montoEnLetras(precioTotal, moneda), 15, y, 20); y += 8
  parFila(doc, 'SEÑA', fmtM((contrato.sena_monto as number) ?? 0), 15, y); y += 6
  parFila(doc, 'TRAMO 1', `${contrato.tramo1_meses} cuotas de ${fmtM((contrato.tramo1_cuota as number) ?? 0)} desde ${format(new Date(contrato.tramo1_inicio as string), 'MM/yyyy')}`, 15, y); y += 6
  if ((contrato.tramo2_meses as number) > 0) {
    parFila(doc, 'TRAMO 2', `${contrato.tramo2_meses} cuotas de ${fmtM((contrato.tramo2_cuota as number) ?? 0)} post-obra`, 15, y); y += 6
  }
  y = lineaDivisoria(doc, y + 2)

  // Cláusulas
  y = seccion(doc, 'Cláusulas', y)
  const clausulas = [
    '1. El vendedor se obliga a escriturar el inmueble una vez finalizada la construcción y abonada la totalidad del precio de venta.',
    '2. El comprador acepta el cronograma de pagos detallado en el presente boleto y se obliga a cumplirlo en tiempo y forma.',
    '3. En caso de mora en el pago de cuotas, se aplicará un interés punitorio del 1,5% mensual sobre el saldo adeudado.',
    '4. El comprador autoriza al vendedor a rescindir el presente boleto en caso de incumplimiento de más de tres cuotas consecutivas.',
    '5. Cualquier modificación al presente instrumento deberá realizarse por escrito y con la firma de ambas partes.',
    '6. Las partes constituyen domicilio especial en los indicados precedentemente, sometiendo a la jurisdicción de los tribunales de Mar del Plata.',
  ]
  for (const clausula of clausulas) {
    const lines = doc.splitTextToSize(clausula, 178)
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal')
    doc.text(lines, 15, y)
    y += lines.length * 4 + 2
  }

  y = lineaDivisoria(doc, y + 4)

  // Firmas
  if (y < 240) {
    y += 10
    doc.setFontSize(8)
    doc.line(20, y + 15, 80, y + 15); doc.line(130, y + 15, 190, y + 15)
    doc.text('Firma del VENDEDOR', 50, y + 20, { align: 'center' })
    doc.text('Firma del COMPRADOR', 160, y + 20, { align: 'center' })
    doc.setFontSize(7); doc.setTextColor(120)
    doc.text(`Aclaración: ${empresa.nombre}`, 50, y + 25, { align: 'center' })
    doc.text(`Aclaración: ${cli ? `${cli.apellido ?? ''}, ${cli.nombre}`.replace(/^,\s*/,'') : '—'}`, 160, y + 25, { align: 'center' })
  }

  pdfFooter(doc, 1)
  doc.save(`boleto_${String(contrato.numero).replace(/\//g,'-')}.pdf`)
}

async function genReciboSena(contrato: Record<string, unknown>, empresa: EmpresaInfo) {
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const num  = `RS-${String(contrato.numero)}-${new Date().getFullYear()}`
  const fecha = format(new Date(), 'dd/MM/yyyy', { locale: es })
  const moneda = contrato.moneda as 'USD' | 'ARS'
  const fmtM = (n: number) => fmt(n, moneda)
  const monto = (contrato.sena_monto as number) ?? 0

  let y = await pdfHeader(doc, 'RECIBO DE SEÑA', num, fecha, empresa, `Seña boleto ${contrato.numero}`)

  y = seccion(doc, 'Datos del recibo', y)
  const cli = contrato.cliente as Record<string, string> | null
  parFila(doc, 'RECIBIMOS DE',  cli ? `${cli.apellido ?? ''}, ${cli.nombre}`.replace(/^,\s*/,'') : '—', 15, y); y += 6
  parFila(doc, 'LA SUMA DE',    fmtM(monto), 15, y); y += 6
  parFila(doc, 'EN LETRAS',     montoEnLetras(monto, moneda), 15, y, 20); y += 8
  parFila(doc, 'CONCEPTO',      `Seña por compra de ${(contrato.emprendimiento as Record<string,string>)?.nombre ?? ''} - Unidad ${(contrato.unidad as Record<string,string>)?.identificador ?? ''}`, 15, y, 20); y += 6
  parFila(doc, 'CONTRATO Nº',   String(contrato.numero), 15, y); y += 6
  parFila(doc, 'PRECIO TOTAL',  fmtM((contrato.precio_total as number) ?? 0), 15, y); y += 10

  // Recuadro monto destacado
  doc.setFillColor(26, 58, 92)
  doc.rect(15, y, 180, 14, 'F')
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(201, 168, 76)
  doc.text(fmtM(monto), 105, y + 9, { align: 'center' })
  doc.setTextColor(0); y += 20

  y = lineaDivisoria(doc, y)
  parFila(doc, 'ACLARACIÓN', 'El presente recibo no es comprobante fiscal. Se emite como constancia de pago de seña de boleto de compraventa.', 15, y, 20); y += 12

  doc.line(20, y + 10, 80, y + 10); doc.line(130, y + 10, 190, y + 10)
  doc.setFontSize(8)
  doc.text('Firma del VENDEDOR', 50, y + 15, { align: 'center' })
  doc.text('Conformidad del COMPRADOR', 160, y + 15, { align: 'center' })

  pdfFooter(doc, 1)
  doc.save(`recibo_sena_${String(contrato.numero).replace(/\//g,'-')}.pdf`)
}

async function genCertAvance(emprendimiento: Record<string, unknown>, etapas: Record<string, unknown>[], empresa: EmpresaInfo) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const num   = `CA-${String(emprendimiento.id).slice(0,8).toUpperCase()}`
  const fecha = format(new Date(), 'dd/MM/yyyy', { locale: es })
  const avance = etapas.reduce((s, e) => s + ((e.avance_porcentaje as number) * ((e.porcentaje_obra as number) ?? 0)) / 100, 0)

  let y = await pdfHeader(doc, 'CERTIFICADO DE AVANCE', num, fecha, empresa, `Avance ${avance.toFixed(1)}% - ${emprendimiento.nombre}`)

  y = seccion(doc, 'Datos del emprendimiento', y)
  parFila(doc, 'PROYECTO',       String(emprendimiento.nombre), 15, y); y += 6
  parFila(doc, 'DIRECCIÓN',      String(emprendimiento.direccion ?? '—'), 15, y); y += 6
  parFila(doc, 'LOCALIDAD',      String(emprendimiento.localidad ?? '—'), 15, y)
  parFila(doc, 'FECHA INICIO',   emprendimiento.fecha_inicio ? format(new Date(emprendimiento.fecha_inicio as string), 'dd/MM/yyyy') : '—', 110, y); y += 8

  // Avance global destacado
  doc.setFillColor(26, 58, 92)
  doc.rect(15, y, 180, 16, 'F')
  doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(201, 168, 76)
  doc.text(`AVANCE GLOBAL: ${avance.toFixed(1)}%`, 105, y + 11, { align: 'center' })
  doc.setTextColor(0); y += 22

  // Barra de avance visual
  doc.setFillColor(230, 230, 230)
  doc.rect(15, y, 180, 8, 'F')
  doc.setFillColor(45, 90, 142)
  doc.rect(15, y, Math.min(180, 180 * avance / 100), 8, 'F')
  y += 14

  // Tabla de etapas
  y = seccion(doc, 'Detalle por etapas', y)
  autoTable(doc, {
    startY: y,
    head: [['Etapa', 'Estado', '% Obra', 'Avance', 'Presupuesto', 'Costo real']],
    body: etapas.map(e => [
      String(e.nombre ?? ''),
      String(e.estado ?? '').replace('_', ' '),
      `${e.porcentaje_obra ?? 0}%`,
      `${e.avance_porcentaje ?? 0}%`,
      `$${Number(e.presupuesto ?? 0).toLocaleString('es-AR')}`,
      `$${Number(e.costo_real ?? 0).toLocaleString('es-AR')}`,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: { 3: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  })

  y = ultimaY(doc) + 12
  doc.setFontSize(8)
  doc.text('Certificado emitido por:', 15, y)
  doc.line(15, y + 15, 90, y + 15)
  doc.text('Director/a Técnico/a de Obra', 50, y + 19, { align: 'center' })

  pdfFooter(doc, 1)
  doc.save(`cert_avance_${String(emprendimiento.nombre).replace(/\s+/g,'_')}_${fecha.replace(/\//g,'-')}.pdf`)
}

async function genNotaDebito(cuota: Record<string, unknown>, empresa: EmpresaInfo) {
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const num    = `ND-${String(cuota.contrato_id ?? '').slice(0,8).toUpperCase()}-${cuota.numero_cuota}`
  const fecha  = format(new Date(), 'dd/MM/yyyy', { locale: es })
  const moneda = (cuota.moneda ?? 'USD') as 'USD' | 'ARS'
  const fmtM   = (n: number) => fmt(n, moneda)
  const diasMora   = (cuota.mora_dias as number) ?? 0
  const montoOrig  = (cuota.monto_original as number) ?? 0
  const tasaMora   = 0.015  // 1.5% mensual
  const interesMes = (tasaMora * diasMora) / 30
  const montoMora  = Math.round(montoOrig * interesMes * 100) / 100
  const totalDeuda = montoOrig + montoMora

  let y = await pdfHeader(doc, 'NOTA DE DÉBITO — MORA', num, fecha, empresa, `Mora cuota ${cuota.numero_cuota}`)

  y = seccion(doc, 'Deudor', y)
  parFila(doc, 'CLIENTE', String(cuota.cliente ?? '—'), 15, y); y += 6
  parFila(doc, 'CONTRATO', String(cuota.contrato_numero ?? '—'), 15, y); y += 10

  y = seccion(doc, 'Concepto de la mora', y)
  parFila(doc, 'N° CUOTA',      String(cuota.numero_cuota), 15, y); y += 6
  parFila(doc, 'VENCIMIENTO',   String(cuota.fecha_vencimiento ?? '—'), 15, y); y += 6
  parFila(doc, 'DÍAS DE MORA',  `${diasMora} días`, 15, y); y += 8

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Detalle', 'Importe']],
    body: [
      ['Capital adeudado', `Cuota N° ${cuota.numero_cuota}`, fmtM(montoOrig)],
      ['Interés por mora', `${diasMora} días × 1,5% mensual = ${(interesMes * 100).toFixed(2)}%`, fmtM(montoMora)],
      ['TOTAL A PAGAR', '', fmtM(totalDeuda)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [192, 57, 43], textColor: 255 },
    bodyStyles: { fontStyle: 'normal' },
    columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didParseCell: (data: any) => {
      if (data.row.index === 2) { data.cell.styles.fillColor = [26, 58, 92]; data.cell.styles.textColor = [255,255,255] }
    },
    margin: { left: 15, right: 15 },
  })

  y = ultimaY(doc) + 8
  parFila(doc, 'EN LETRAS', montoEnLetras(totalDeuda, moneda), 15, y, 20); y += 10
  doc.setFontSize(7.5)
  doc.text('La regularización de este monto liberará al cliente de cargos adicionales por el período indicado.', 15, y)

  pdfFooter(doc, 1)
  doc.save(`nota_debito_${String(cuota.contrato_numero ?? '').replace(/\//g,'-')}_c${cuota.numero_cuota}.pdf`)
}

async function genLiquidacion(contrato: Record<string, unknown>, cuotas: Record<string, unknown>[], empresa: EmpresaInfo) {
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const num    = `LF-${String(contrato.numero)}`
  const fecha  = format(new Date(), 'dd/MM/yyyy', { locale: es })
  const moneda = (contrato.moneda ?? 'USD') as 'USD' | 'ARS'
  const fmtM   = (n: number) => fmt(n, moneda)

  const pagadas   = cuotas.filter(c => c.estado === 'pagada')
  const pendientes = cuotas.filter(c => c.estado !== 'pagada')
  const totalPag   = pagadas.reduce((s,c) => s + ((c.monto_pagado as number) ?? (c.monto_original as number) ?? 0), 0)
  const totalPend  = pendientes.reduce((s,c) => s + ((c.monto_actualizado as number) ?? (c.monto_original as number) ?? 0), 0)

  const cli = contrato.cliente as Record<string,string> | null
  let y = await pdfHeader(doc, 'LIQUIDACIÓN FINAL', num, fecha, empresa, `Liquidación ${contrato.numero}`)

  y = seccion(doc, 'Datos del contrato', y)
  parFila(doc, 'COMPRADOR', cli ? `${cli.apellido ?? ''}, ${cli.nombre}`.replace(/^,\s*/,'') : '—', 15, y); y += 6
  parFila(doc, 'UNIDAD',    (contrato.unidad as Record<string,string>)?.identificador ?? '—', 15, y)
  parFila(doc, 'CONTRATO',  String(contrato.numero), 110, y); y += 8

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Monto']],
    body: [
      ['Precio total de venta', fmtM((contrato.precio_total as number) ?? 0)],
      [`Cuotas pagadas (${pagadas.length})`, fmtM(totalPag)],
      [`Saldo pendiente (${pendientes.length} cuotas)`, fmtM(totalPend)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [45, 122, 79], textColor: 255 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didParseCell: (data: any) => {
      if (data.row.index === 2) { data.cell.styles.fillColor = [26, 58, 92]; data.cell.styles.textColor = [255, 255, 255] }
    },
    margin: { left: 15, right: 15 },
  })

  y = ultimaY(doc) + 6
  parFila(doc, 'SALDO EN LETRAS', montoEnLetras(totalPend, moneda), 15, y, 30); y += 10

  // Cuotas pendientes
  if (pendientes.length > 0) {
    y = seccion(doc, 'Cuotas pendientes de pago', y)
    autoTable(doc, {
      startY: y,
      head: [['N°', 'Tramo', 'Vencimiento', 'Monto original', 'Monto actualizado']],
      body: pendientes.slice(0, 30).map(c => [
        String(c.numero_cuota), String(c.tramo), String(c.fecha_vencimiento),
        fmtM((c.monto_original as number) ?? 0),
        fmtM((c.monto_actualizado as number) ?? (c.monto_original as number) ?? 0),
      ]),
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      margin: { left: 15, right: 15 },
    })
  }

  pdfFooter(doc, 1)
  doc.save(`liquidacion_${String(contrato.numero).replace(/\//g,'-')}.pdf`)
}

async function genCesion(contrato: Record<string, unknown>, cesionario: { nombre: string; apellido: string; dni: string }, empresa: EmpresaInfo) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const num   = `CES-${String(contrato.numero)}-${Date.now().toString().slice(-4)}`
  const fecha = format(new Date(), 'dd/MM/yyyy', { locale: es })
  const cli   = contrato.cliente as Record<string,string> | null

  let y = await pdfHeader(doc, 'CESIÓN DE BOLETO', num, fecha, empresa, `Cesión contrato ${contrato.numero}`)

  y = seccion(doc, 'Partes', y)
  parFila(doc, 'CEDENTE', cli ? `${cli.apellido ?? ''}, ${cli.nombre}`.replace(/^,\s*/,'') : '—', 15, y)
  parFila(doc, 'DNI', cli?.dni ?? '—', 110, y); y += 6
  parFila(doc, 'CESIONARIO', `${cesionario.apellido}, ${cesionario.nombre}`, 15, y)
  parFila(doc, 'DNI', cesionario.dni, 110, y); y += 8

  y = seccion(doc, 'Objeto de la cesión', y)
  parFila(doc, 'CONTRATO', String(contrato.numero), 15, y); y += 6
  parFila(doc, 'UNIDAD',   (contrato.unidad as Record<string,string>)?.identificador ?? '—', 15, y); y += 6
  parFila(doc, 'PROYECTO', (contrato.emprendimiento as Record<string,string>)?.nombre ?? '—', 15, y); y += 6
  parFila(doc, 'PRECIO ORIGINAL', fmt((contrato.precio_total as number) ?? 0, contrato.moneda as 'USD' | 'ARS'), 15, y); y += 10

  const clausulas = [
    '1. El cedente transfiere al cesionario todos los derechos y obligaciones emergentes del boleto de compraventa indicado.',
    '2. El cesionario acepta la cesión en las mismas condiciones y términos pactados originalmente.',
    '3. El cedente garantiza que no existen gravámenes ni deudas pendientes sobre los derechos que se ceden.',
    '4. La presente cesión queda perfeccionada con la firma de ambas partes y notificación al vendedor.',
    '5. El vendedor presta conformidad a la presente cesión mediante su firma al pie.',
  ]
  y = seccion(doc, 'Cláusulas', y)
  for (const c of clausulas) {
    const lines = doc.splitTextToSize(c, 178)
    doc.setFontSize(7.5); doc.text(lines, 15, y); y += lines.length * 4 + 2
  }

  y = lineaDivisoria(doc, y + 4)
  if (y < 230) {
    y += 8
    const posL = [[20, 70, 15], [80, 140, 15], [150, 190, 15]]
    const names = ['CEDENTE', 'CESIONARIO', 'VENDEDOR (Conformidad)']
    posL.forEach(([x1, x2], i) => {
      doc.line(x1, y + 12, x2, y + 12)
      doc.setFontSize(7.5); doc.text(names[i], (x1 + x2) / 2, y + 16, { align: 'center' })
    })
  }

  pdfFooter(doc, 1)
  doc.save(`cesion_${String(contrato.numero).replace(/\//g,'-')}.pdf`)
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Documentos() {
  const [tipoSel, setTipoSel] = useState<TipoDoc>('boleto')
  const [contratos, setContratos] = useState<Record<string, unknown>[]>([])
  const [emps,      setEmps]      = useState<Record<string, unknown>[]>([])
  const [contSelId, setContSelId] = useState('')
  const [empSelId,  setEmpSelId]  = useState('')
  const [cuotas,    setCuotas]    = useState<Record<string, unknown>[]>([])
  const [loading,   setLoading]   = useState(false)
  // Cesión extra
  const [cesNombre,   setCesNombre]   = useState('')
  const [cesApellido, setCesApellido] = useState('')
  const [cesDni,      setCesDni]      = useState('')

  useEffect(() => {
    supabase.from('contratos')
      .select('*, cliente:cliente_id(nombre, apellido, dni), unidad:unidad_id(identificador, tipo), emprendimiento:emprendimiento_id(nombre)')
      .order('numero')
      .then(({ data }) => setContratos((data ?? []) as Record<string, unknown>[]))
    supabase.from('emprendimientos')
      .select('*, etapas_obra(*)')
      .order('nombre')
      .then(({ data }) => setEmps((data ?? []) as Record<string, unknown>[]))
  }, [])

  useEffect(() => {
    if (!contSelId) { setCuotas([]); return }
    supabase.from('cuotas').select('*').eq('contrato_id', contSelId).order('numero_cuota')
      .then(({ data }) => setCuotas((data ?? []) as Record<string, unknown>[]))
  }, [contSelId])

  const contSel = contratos.find(c => c.id === contSelId)
  const empSel  = emps.find(e => e.id === empSelId)

  const needsContrato = ['boleto','recibo_sena','nota_debito','liquidacion','cesion'].includes(tipoSel)
  const needsEmp      = tipoSel === 'cert_avance'
  const vencidas      = cuotas.filter(c => c.estado === 'vencida')

  const generar = async () => {
    setLoading(true)
    try {
      const empresa = await getEmpresa()
      switch (tipoSel) {
        case 'boleto':
          if (contSel) await genBoleto(contSel, empresa)
          break
        case 'recibo_sena':
          if (contSel) await genReciboSena(contSel, empresa)
          break
        case 'cert_avance':
          if (empSel) await genCertAvance(empSel, (empSel.etapas_obra as Record<string, unknown>[]) ?? [], empresa)
          break
        case 'nota_debito':
          if (vencidas.length) {
            const enriched = { ...vencidas[0], contrato_numero: contSel?.numero, cliente: contSel?.cliente ? `${(contSel.cliente as Record<string,string>).apellido}, ${(contSel.cliente as Record<string,string>).nombre}` : '—', moneda: contSel?.moneda }
            await genNotaDebito(enriched, empresa)
          }
          break
        case 'liquidacion':
          if (contSel) await genLiquidacion(contSel, cuotas, empresa)
          break
        case 'cesion':
          if (contSel && cesNombre && cesApellido && cesDni)
            await genCesion(contSel, { nombre: cesNombre, apellido: cesApellido, dni: cesDni }, empresa)
          break
      }
    } catch (e) { alert(e instanceof Error ? e.message : 'Error al generar') }
    finally { setLoading(false) }
  }

  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'

  const canGenerate = (needsContrato && !!contSel && (tipoSel !== 'nota_debito' || vencidas.length > 0) && (tipoSel !== 'cesion' || (!!cesNombre && !!cesApellido && !!cesDni)))
    || (needsEmp && !!empSel)

  return (
    <div className="flex flex-col h-full">
      <Header title="Documentos comerciales" subtitle="Generación de documentos PDF con firma y QR" />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Selector tipo */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {TIPOS.map(t => {
            const Icon = t.icon
            const active = tipoSel === t.id
            return (
              <button key={t.id} onClick={() => { setTipoSel(t.id); setContSelId(''); setEmpSelId('') }}
                className={cn('card text-left p-4 transition-all hover:shadow-md', active && 'ring-2 ring-primary border-primary')}>
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', t.color)}>
                  <Icon size={18} className="text-white" />
                </div>
                <p className={cn('font-semibold text-sm', active ? 'text-primary' : 'text-gray-800')}>{t.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{t.desc}</p>
              </button>
            )
          })}
        </div>

        {/* Parámetros */}
        <div className="card space-y-4">
          <h3 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center gap-2">
            <Search size={13} /> Selección de datos
          </h3>

          {needsContrato && (
            <div>
              <label className={lb}>Contrato</label>
              <select className={fi} value={contSelId} onChange={e => setContSelId(e.target.value)}>
                <option value="">— Seleccioná un contrato —</option>
                {contratos.map(c => {
                  const nombre = c.cliente ? `${(c.cliente as Record<string,string>).apellido ?? ''}, ${(c.cliente as Record<string,string>).nombre}`.replace(/^,\s*/,'') : '—'
                  return <option key={c.id as string} value={c.id as string}>N° {c.numero as string} — {nombre} — {(c.emprendimiento as Record<string,string>)?.nombre}</option>
                })}
              </select>
            </div>
          )}

          {needsEmp && (
            <div>
              <label className={lb}>Emprendimiento</label>
              <select className={fi} value={empSelId} onChange={e => setEmpSelId(e.target.value)}>
                <option value="">— Seleccioná un emprendimiento —</option>
                {emps.map(e => <option key={e.id as string} value={e.id as string}>{e.nombre as string}</option>)}
              </select>
            </div>
          )}

          {tipoSel === 'nota_debito' && contSel && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-medium">{vencidas.length} cuota{vencidas.length !== 1 ? 's' : ''} vencida{vencidas.length !== 1 ? 's' : ''}</p>
              {vencidas.length === 0 && <p className="text-xs text-gray-500 mt-1">Este contrato no tiene cuotas vencidas para generar nota de débito.</p>}
            </div>
          )}

          {tipoSel === 'cesion' && contSel && (
            <div className="space-y-3 p-4 bg-purple-50 border border-purple-100 rounded-lg">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Datos del cesionario (nuevo titular)</p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={lb}>Nombre *</label><input className={fi} value={cesNombre} onChange={e => setCesNombre(e.target.value)} /></div>
                <div><label className={lb}>Apellido *</label><input className={fi} value={cesApellido} onChange={e => setCesApellido(e.target.value)} /></div>
                <div><label className={lb}>DNI *</label><input className={fi} value={cesDni} onChange={e => setCesDni(e.target.value)} /></div>
              </div>
            </div>
          )}

          {contSel && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg">
              {[
                { label: 'Cliente', value: contSel.cliente ? `${(contSel.cliente as Record<string,string>).apellido ?? ''}, ${(contSel.cliente as Record<string,string>).nombre}`.replace(/^,\s*/,'') : '—' },
                { label: 'Unidad', value: (contSel.unidad as Record<string,string>)?.identificador ?? '—' },
                { label: 'Precio', value: fmt((contSel.precio_total as number) ?? 0, contSel.moneda as 'USD'|'ARS') },
                { label: 'Estado', value: String(contSel.estado) },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-[9px] font-bold text-gray-400 uppercase">{s.label}</p>
                  <p className="text-sm font-semibold text-gray-800">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          <button
            disabled={loading || !canGenerate}
            onClick={generar}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
            <Download size={16} />
            {loading ? 'Generando PDF...' : `Generar ${TIPOS.find(t => t.id === tipoSel)?.label}`}
          </button>
        </div>

        {/* Info del tipo seleccionado */}
        <div className="card p-4 bg-blue-50 border border-blue-100">
          <div className="flex items-start gap-3">
            <FileText size={18} className="text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-primary text-sm">{TIPOS.find(t => t.id === tipoSel)?.label}</p>
              <p className="text-xs text-gray-500 mt-1">
                {tipoSel === 'boleto'      && 'Genera el boleto con datos del comprador, unidad, precio total, plan de pagos completo y cláusulas estándar de compraventa.'}
                {tipoSel === 'recibo_sena' && 'Recibo oficial numerado con monto en letras y números, concepto, datos fiscales y campo de firma.'}
                {tipoSel === 'cert_avance' && 'Certificado de estado de obra con avance por etapas, barra de progreso visual y espacio para firma del director de obra.'}
                {tipoSel === 'nota_debito' && 'Nota de débito calculada automáticamente: capital adeudado + intereses al 1,5% mensual según días de atraso.'}
                {tipoSel === 'liquidacion' && 'Resumen total del contrato: cuotas pagadas, saldo pendiente, monto en letras y detalle de cuotas para escritura.'}
                {tipoSel === 'cesion'      && 'Documento de cesión de derechos del boleto: cedente, cesionario, objeto y cláusulas de transferencia.'}
              </p>
              <p className="text-[10px] text-blue-600 mt-1">Todos los documentos incluyen: encabezado Civilmar, número correlativo, fecha, QR de referencia y espacio de firma.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
