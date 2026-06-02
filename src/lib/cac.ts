// Motor de indexación CAC
// El CAC se aplica acumulativamente desde el mes de origen hasta el mes actual

export interface IndiceCAC {
  anio: number
  mes: number
  valor: number
}

// Calcula el factor acumulado entre dos fechas usando los valores del CAC
export function calcularFactorCac(
  indices: IndiceCAC[],
  desdeAnio: number,
  desdeMes: number,
  hastaAnio: number,
  hastaMes: number
): number {
  const sorted = [...indices].sort((a, b) =>
    a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes
  )

  let factor = 1
  let y = desdeAnio
  let m = desdeMes

  while (y < hastaAnio || (y === hastaAnio && m <= hastaMes)) {
    const idx = sorted.find(i => i.anio === y && i.mes === m)
    if (idx) {
      // Variación mensual: valor_actual / valor_anterior - 1
      // Pero aquí usamos el índice acumulado directamente
      const prev = sorted.find(i =>
        (m === 1 && i.anio === y - 1 && i.mes === 12) ||
        (m > 1  && i.anio === y     && i.mes === m - 1)
      )
      if (prev && prev.valor > 0) {
        factor *= idx.valor / prev.valor
      }
    }
    if (m === 12) { y++; m = 1 } else { m++ }
  }

  return factor
}

export function actualizarMontoCac(
  montoOriginal: number,
  indices: IndiceCAC[],
  anioOrigen: number,
  mesOrigen: number,
  anioActual: number,
  mesActual: number
): number {
  const factor = calcularFactorCac(indices, anioOrigen, mesOrigen, anioActual, mesActual)
  return montoOriginal * factor
}
