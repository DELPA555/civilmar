// Formateo de moneda al estilo argentino
export function fmtUSD(n: number | null | undefined): string {
  if (n == null) return 'U$D —'
  return 'U$D ' + new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export function fmtARS(n: number | null | undefined): string {
  if (n == null) return '$ —'
  return '$ ' + new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export function fmt(n: number | null | undefined, moneda: 'USD' | 'ARS'): string {
  return moneda === 'USD' ? fmtUSD(n) : fmtARS(n)
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-AR').format(n)
}
