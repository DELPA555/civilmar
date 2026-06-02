import { addMonths } from 'date-fns'

export interface SimuladorInput {
  precioTotal: number
  moneda: 'USD' | 'ARS'
  sena: number
  fechaSena: Date
  tramo1Meses: number
  tramo1Inicio: Date
  tramo1ConCac: boolean
  tramo2Meses: number
  tramo2TasaAnual: number // ya incorporada al precio
  tramo2Inicio?: Date
}

export interface Cuota {
  numero: number
  tramo: 'sena' | 'tramo1' | 'tramo2'
  fechaVencimiento: Date
  montoOriginal: number
  montoConCac?: number
  conCac: boolean
}

export interface PlanDePagos {
  cuotas: Cuota[]
  resumen: {
    sena: number
    cuotaTramo1: number
    cuotaTramo2: number
    totalTramo1: number
    totalTramo2: number
    totalConSena: number
    moneda: 'USD' | 'ARS'
  }
}

export function calcularPlanDePagos(input: SimuladorInput): PlanDePagos {
  const {
    precioTotal, moneda, sena, fechaSena,
    tramo1Meses, tramo1Inicio, tramo1ConCac,
    tramo2Meses, tramo2TasaAnual,
  } = input

  const cuotas: Cuota[] = []
  let numero = 1

  // Seña
  if (sena > 0) {
    cuotas.push({
      numero: numero++,
      tramo: 'sena',
      fechaVencimiento: fechaSena,
      montoOriginal: sena,
      conCac: false,
    })
  }

  const saldo = precioTotal - sena

  // Determinar split tramo1 / tramo2
  let montoTramo1Total: number
  let montoTramo2Total: number

  if (tramo2Meses === 0) {
    montoTramo1Total = saldo
    montoTramo2Total = 0
  } else {
    // Proporción: tramo1 financia una parte, tramo2 el resto
    const proporcion = tramo1Meses / (tramo1Meses + tramo2Meses)
    montoTramo1Total = saldo * proporcion
    montoTramo2Total = saldo * (1 - proporcion)
  }

  const cuotaTramo1 = tramo1Meses > 0 ? montoTramo1Total / tramo1Meses : 0

  // Generar cuotas tramo 1
  for (let i = 0; i < tramo1Meses; i++) {
    cuotas.push({
      numero: numero++,
      tramo: 'tramo1',
      fechaVencimiento: addMonths(tramo1Inicio, i),
      montoOriginal: cuotaTramo1,
      conCac: tramo1ConCac && moneda === 'ARS',
    })
  }

  // Generar cuotas tramo 2 (con tasa incorporada — sistema francés simplificado)
  let cuotaTramo2 = 0
  if (tramo2Meses > 0 && montoTramo2Total > 0) {
    const tramo2Inicio = input.tramo2Inicio ?? addMonths(tramo1Inicio, tramo1Meses)
    const tasaMensual = tramo2TasaAnual / 100 / 12

    if (tasaMensual === 0) {
      cuotaTramo2 = montoTramo2Total / tramo2Meses
    } else {
      // Sistema francés: cuota fija con amortización + interés
      cuotaTramo2 =
        montoTramo2Total * (tasaMensual * Math.pow(1 + tasaMensual, tramo2Meses)) /
        (Math.pow(1 + tasaMensual, tramo2Meses) - 1)
    }

    for (let i = 0; i < tramo2Meses; i++) {
      cuotas.push({
        numero: numero++,
        tramo: 'tramo2',
        fechaVencimiento: addMonths(tramo2Inicio, i),
        montoOriginal: cuotaTramo2,
        conCac: false,
      })
    }
  }

  return {
    cuotas,
    resumen: {
      sena,
      cuotaTramo1,
      cuotaTramo2,
      totalTramo1: montoTramo1Total,
      totalTramo2: montoTramo2Total,
      totalConSena: precioTotal,
      moneda,
    },
  }
}
