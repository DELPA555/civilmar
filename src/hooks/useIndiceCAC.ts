import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface IndiceCAC {
  id: string
  anio: number
  mes: number
  valor: number
  variacion_mensual?: number
  variacion_anual?: number
  fuente: string
  created_at: string
}

export function useIndiceCAC() {
  const [data,    setData]    = useState<IndiceCAC[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('indice_cac')
      .select('*')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
    if (err) { setError(err.message) } else { setData(rows ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const insertar = async (input: { anio: number; mes: number; valor: number; fuente?: string }) => {
    // Calcular variación vs mes anterior
    const sorted  = [...data].sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes)
    const prev    = sorted[sorted.length - 1]
    const var_m   = prev ? ((input.valor - prev.valor) / prev.valor) * 100 : null
    const anioAnt = input.mes === 1 ? input.anio - 1 : input.anio
    const mesAnt  = input.mes === 1 ? 12 : input.mes - 12
    const prevAno = data.find(d => d.anio === anioAnt && d.mes === mesAnt)
    const var_a   = prevAno ? ((input.valor - prevAno.valor) / prevAno.valor) * 100 : null

    const { error: err } = await supabase.from('indice_cac').insert({
      ...input,
      fuente: input.fuente ?? 'INDEC',
      variacion_mensual: var_m,
      variacion_anual:   var_a,
    })
    if (err) throw new Error(err.message)
    await load()
  }

  // Actualizar cuotas ARS pendientes de un período
  const actualizarCuotasARS = async (anio: number, mes: number) => {
    const indice = data.find(d => d.anio === anio && d.mes === mes)
    if (!indice) throw new Error('Índice no encontrado para ese período')

    const mesStr = `${anio}-${String(mes).padStart(2, '0')}`

    // Obtener cuotas ARS del tramo1 con CAC pendientes de ese mes
    const { data: cuotas } = await supabase
      .from('cuotas')
      .select('id, monto_original, contrato:contrato_id(tramo1_con_cac, moneda)')
      .eq('tramo', 'tramo1')
      .eq('estado', 'pendiente')
      .gte('fecha_vencimiento', `${mesStr}-01`)
      .lt('fecha_vencimiento', `${anio}-${String(mes + 1).padStart(2, '0')}-01`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elegibles = ((cuotas ?? []) as any[]).filter((c: any) =>
      c.contrato?.tramo1_con_cac && c.contrato?.moneda === 'ARS'
    )

    if (!elegibles.length) return 0

    await Promise.all(
      elegibles.map((c: { id: string; monto_original: number }) =>
        supabase.from('cuotas').update({
          monto_actualizado: c.monto_original * (1 + (indice.variacion_mensual ?? 0) / 100),
          indice_cac_aplicado: indice.valor,
        }).eq('id', c.id)
      )
    )
    return elegibles.length
  }

  const ultimo = data[0]

  return { data, loading, error, ultimo, reload: load, insertar, actualizarCuotasARS }
}
