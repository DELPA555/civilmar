import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface Contrato {
  id: string
  numero: string
  emprendimiento_id: string
  unidad_id: string
  cliente_id: string
  vendedor_id?: string
  tipo: string
  estado: string
  moneda: 'USD' | 'ARS'
  precio_total: number
  sena_monto: number
  sena_fecha?: string
  tramo1_meses: number
  tramo1_cuota: number
  tramo1_inicio: string
  tramo1_con_cac: boolean
  tramo2_meses: number
  tramo2_cuota: number
  tramo2_tasa_anual: number
  total_tramo1?: number
  total_tramo2?: number
  fecha_firma?: string
  fecha_escritura_estimada?: string
  notas?: string
  created_at: string
  updated_at: string
  // Joined
  cliente?:        { id: string; nombre: string; apellido?: string; dni?: string; email?: string }
  unidad?:         { id: string; identificador: string; tipo?: string }
  emprendimiento?: { id: string; nombre: string }
}

export interface Cuota {
  id: string
  contrato_id: string
  numero_cuota: number
  tramo: 'sena' | 'tramo1' | 'tramo2'
  fecha_vencimiento: string
  monto_original: number
  monto_actualizado?: number
  indice_cac_aplicado?: number
  estado: 'pendiente' | 'pagada' | 'vencida' | 'refinanciada'
  fecha_pago?: string
  monto_pagado?: number
  medio_pago?: string
  numero_recibo?: string
  mora_dias: number
  mora_monto: number
  notas?: string
  created_at: string
}

// ── Lista de contratos ────────────────────────────────────────────────────────

export function useContratos() {
  const [data,    setData]    = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('contratos')
      .select(`
        *,
        cliente:cliente_id(id, nombre, apellido, dni, email),
        unidad:unidad_id(id, identificador, tipo),
        emprendimiento:emprendimiento_id(id, nombre)
      `)
      .order('created_at', { ascending: false })
    if (err) { setError(err.message) } else { setData(rows ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (input: Omit<Contrato, 'id' | 'created_at' | 'updated_at' | 'cliente' | 'unidad' | 'emprendimiento'>) => {
    const { data: row, error: err } = await supabase.from('contratos').insert(input).select().single()
    if (err) throw new Error(err.message)
    await load()
    return row
  }

  const update = async (id: string, input: Partial<Contrato>) => {
    const { error: err } = await supabase.from('contratos').update(input).eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  return { data, loading, error, reload: load, create, update }
}

// ── Detalle de contrato (con cuotas) ─────────────────────────────────────────

export function useContratoDetalle(id: string | undefined) {
  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [cuotas,   setCuotas]   = useState<Cuota[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [coRes, cuRes] = await Promise.all([
      supabase.from('contratos')
        .select('*, cliente:cliente_id(id, nombre, apellido, dni, email, telefono), unidad:unidad_id(id, identificador, tipo), emprendimiento:emprendimiento_id(id, nombre)')
        .eq('id', id).single(),
      supabase.from('cuotas').select('*').eq('contrato_id', id).order('numero_cuota'),
    ])
    if (coRes.error) { setError(coRes.error.message); setLoading(false); return }
    setContrato(coRes.data)
    setCuotas(cuRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Generar cuotas desde el plan del simulador (se llama tras crear el contrato)
  const insertarCuotas = async (cuotasInput: Omit<Cuota, 'id' | 'created_at'>[]) => {
    const { error: err } = await supabase.from('cuotas').insert(cuotasInput)
    if (err) throw new Error(err.message)
    await load()
  }

  const registrarPago = async (cuotaId: string, pago: {
    fecha_pago: string
    monto_pagado: number
    medio_pago: string
    numero_recibo?: string
    notas?: string
  }) => {
    const { error: err } = await supabase.from('cuotas')
      .update({ ...pago, estado: 'pagada' })
      .eq('id', cuotaId)
    if (err) throw new Error(err.message)
    await load()
  }

  const actualizarCac = async (cuotaId: string, montoActualizado: number, indiceCac: number) => {
    const { error: err } = await supabase.from('cuotas')
      .update({ monto_actualizado: montoActualizado, indice_cac_aplicado: indiceCac })
      .eq('id', cuotaId)
    if (err) throw new Error(err.message)
    await load()
  }

  return { contrato, cuotas, loading, error, reload: load, insertarCuotas, registrarPago, actualizarCac }
}

// ── Todas las cuotas (para Cobros) ────────────────────────────────────────────

export function useTodasLasCuotas() {
  const [data,    setData]    = useState<(Cuota & { contrato_numero?: string; cliente?: string; emprendimiento?: string; moneda?: 'USD' | 'ARS' })[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    // Cuotas con su contrato, cliente y emprendimiento
    const { data: rows, error: err } = await supabase
      .from('cuotas')
      .select(`
        *,
        contrato:contrato_id(
          numero, moneda,
          cliente:cliente_id(nombre, apellido),
          emprendimiento:emprendimiento_id(nombre)
        )
      `)
      .order('fecha_vencimiento')

    if (err) { setError(err.message); setLoading(false); return }

    const enriched = (rows ?? []).map((c: Cuota & { contrato?: { numero?: string; moneda?: string; cliente?: { nombre: string; apellido?: string }; emprendimiento?: { nombre: string } } }) => ({
      ...c,
      contrato_numero: c.contrato?.numero,
      moneda:          (c.contrato?.moneda as 'USD' | 'ARS') ?? 'USD',
      cliente:         c.contrato?.cliente
        ? `${c.contrato.cliente.apellido ?? ''}, ${c.contrato.cliente.nombre}`.trim().replace(/^,\s*/, '')
        : '',
      emprendimiento:  c.contrato?.emprendimiento?.nombre ?? '',
    }))

    setData(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const registrarPago = async (cuotaId: string, pago: {
    fecha_pago: string; monto_pagado: number; medio_pago: string; numero_recibo?: string; notas?: string
  }) => {
    const { error: err } = await supabase.from('cuotas').update({ ...pago, estado: 'pagada' }).eq('id', cuotaId)
    if (err) throw new Error(err.message)
    await load()
  }

  return { data, loading, error, reload: load, registrarPago }
}
