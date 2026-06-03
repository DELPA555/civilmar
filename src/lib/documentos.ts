import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'

// ── Monto en letras (español argentino) ──────────────────────────────────────

const UNIDADES = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve',
  'diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve']
const DECENAS  = ['','diez','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa']
const CENTENAS = ['','cien','doscientos','trescientos','cuatrocientos','quinientos',
  'seiscientos','setecientos','ochocientos','novecientos']

function cientos(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100)
  const resto = n % 100
  let r = CENTENAS[c]
  if (resto === 0) return r
  if (resto < 20) return `${r} ${UNIDADES[resto]}`
  const d = Math.floor(resto / 10)
  const u = resto % 10
  r += ` ${DECENAS[d]}`
  if (u > 0) r += ` y ${UNIDADES[u]}`
  return r
}

export function montoEnLetras(monto: number, moneda: 'USD' | 'ARS' = 'USD'): string {
  const entero = Math.floor(monto)
  const centavos = Math.round((monto - entero) * 100)

  let resultado = ''
  if (entero >= 1_000_000) {
    const mill = Math.floor(entero / 1_000_000)
    resultado += `${mill === 1 ? 'un millón' : `${cientos(mill)} millones`} `
  }
  if (entero >= 1_000) {
    const mil = Math.floor((entero % 1_000_000) / 1_000)
    if (mil > 0) resultado += `${mil === 1 ? 'mil' : `${cientos(mil)} mil`} `
  }
  const resto = entero % 1_000
  if (resto > 0) resultado += cientos(resto)
  resultado = resultado.trim() || 'cero'

  const nombreMoneda = moneda === 'USD' ? 'DÓLARES ESTADOUNIDENSES' : 'PESOS ARGENTINOS'
  const nombreCentavos = moneda === 'USD' ? 'centavos' : 'centavos'

  if (centavos > 0) {
    return `${resultado.toUpperCase()} con ${centavos}/100 ${nombreCentavos} (${nombreMoneda})`
  }
  return `${resultado.toUpperCase()} con 00/100 ${nombreCentavos} (${nombreMoneda})`
}

// ── PDF header estándar Civilmar ──────────────────────────────────────────────

export interface EmpresaInfo {
  nombre: string
  cuit: string
  direccion?: string
  localidad?: string
  email?: string
  telefono?: string
}

export async function pdfHeader(
  doc: jsPDF,
  titulo: string,
  numero: string,
  fecha: string,
  empresa: EmpresaInfo,
  qrData?: string
): Promise<number> {
  // Franja superior azul marino
  doc.setFillColor(26, 58, 92)
  doc.rect(0, 0, 210, 38, 'F')

  // Franja dorada inferior del header
  doc.setFillColor(201, 168, 76)
  doc.rect(0, 38, 210, 3, 'F')

  // Nombre empresa
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.text(empresa.nombre.toUpperCase(), 15, 16)

  // Subtítulo empresa
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.setTextColor(201, 168, 76)
  doc.text(`CUIT: ${empresa.cuit} | ${empresa.localidad ?? ''} | ${empresa.telefono ?? ''}`, 15, 24)

  // Tipo de documento (derecha)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text(titulo.toUpperCase(), 195, 14, { align: 'right' })
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text(`N° ${numero}`, 195, 22, { align: 'right' })
  doc.text(`Fecha: ${fecha}`, 195, 29, { align: 'right' })

  // QR (si viene data)
  if (qrData) {
    try {
      const qrDataUrl = await QRCode.toDataURL(qrData, { width: 60, margin: 0 })
      doc.addImage(qrDataUrl, 'PNG', 168, 42, 20, 20)
    } catch {}
  }

  // Reset color
  doc.setTextColor(0, 0, 0)

  return 46 // Y inicial después del header
}

export function pdfFooter(doc: jsPDF, pageCount: number) {
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFillColor(26, 58, 92)
  doc.rect(0, pageH - 12, 210, 12, 'F')
  doc.setFontSize(7); doc.setTextColor(255, 255, 255)
  doc.text('Civilmar S.A. · Sistema ERP Inmobiliario · Documento generado digitalmente', 105, pageH - 5, { align: 'center' })
  doc.text(`Página ${pageCount}`, 195, pageH - 5, { align: 'right' })
  doc.setTextColor(0, 0, 0)
}

export function lineaDivisoria(doc: jsPDF, y: number): number {
  doc.setDrawColor(201, 168, 76)
  doc.setLineWidth(0.5)
  doc.line(15, y, 195, y)
  doc.setDrawColor(0)
  return y + 4
}

export function seccion(doc: jsPDF, titulo: string, y: number): number {
  doc.setFillColor(240, 244, 248)
  doc.rect(15, y, 180, 7, 'F')
  doc.setFontSize(8); doc.setFont('helvetica', 'bold')
  doc.setTextColor(26, 58, 92)
  doc.text(titulo.toUpperCase(), 17, y + 5)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  return y + 10
}

export function parFila(doc: jsPDF, label: string, value: string, x: number, y: number, xv = 60): void {
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 58, 92)
  doc.text(label + ':', x, y)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30)
  doc.text(value, x + xv, y)
}

export function ultimaY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 0
}

// ── Exportar ──────────────────────────────────────────────────────────────────

export { jsPDF, autoTable }
