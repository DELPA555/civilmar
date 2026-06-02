import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { EstadoCRM } from '@/types'

export interface Cliente {
  id: string
  tipo: 'persona_fisica' | 'persona_juridica'
  nombre: string
  apellido?: string
  razon_social?: string
  dni?: string
  cuit?: string
  email?: string
  telefono?: string
  whatsapp?: string
  direccion?: string
  localidad?: string
  provincia?: string
  pais: string
  estado_crm: EstadoCRM
  origen?: string
  notas?: string
  vendedor_id?: string
  created_at: string
  updated_at: string
  // Joined
  vendedor?: { id: string; nombre: string; apellido: string }
}

export interface Interaccion {
  id: string
  cliente_id: string
  tipo: string
  fecha: string
  descripcion: string
  resultado?: string
  proxima_accion?: string
  proxima_fecha?: string
  usuario_id?: string
  created_at: string
}

export type ClienteInput = Omit<Cliente, 'id' | 'created_at' | 'updated_at' | 'vendedor'>

// ── Lista de clientes ─────────────────────────────────────────────────────────

export function useClientes() {
  const [data,    setData]    = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('clientes')
      .select(`
        *,
        vendedor:vendedor_id(id, nombre, apellido)
      `)
      .order('apellido').order('nombre')
    if (err) { setError(err.message) } else { setData(rows ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (input: ClienteInput) => {
    const { data: row, error: err } = await supabase.from('clientes').insert(input).select().single()
    if (err) throw new Error(err.message)
    await load()
    return row
  }

  const update = async (id: string, input: Partial<ClienteInput>) => {
    const { error: err } = await supabase.from('clientes').update(input).eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('clientes').update({ estado_crm: 'inactivo' }).eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  return { data, loading, error, reload: load, create, update, remove }
}

// ── Detalle de cliente (con interacciones) ────────────────────────────────────

export interface ContratoResumen {
  id: string; numero: string; emprendimiento: string; unidad: string
  tipo: string; estado: string; moneda: 'USD'|'ARS'; precio_total: number
  cuota_t1: number; cuotas_pagadas: number; cuotas_total: number
  proximo_vencimiento?: string; fecha_firma?: string
}

export interface CuotaResumen {
  id: string; contrato_numero: string; numero: number; tramo: string
  fecha_vencimiento: string; monto_original: number; moneda: 'USD'|'ARS'
  estado: 'pendiente'|'pagada'|'vencida'|'refinanciada'
  fecha_pago?: string; monto_pagado?: number; mora_dias?: number
}

export function useClienteDetalle(id: string | undefined) {
  const [cliente,       setCliente]       = useState<Cliente | null>(null)
  const [interacciones, setInteracciones] = useState<Interaccion[]>([])
  const [contratos,     setContratos]     = useState<ContratoResumen[]>([])
  const [cuotas,        setCuotas]        = useState<CuotaResumen[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [cliRes, intRes, coRes] = await Promise.all([
      supabase.from('clientes').select('*, vendedor:vendedor_id(id, nombre, apellido)').eq('id', id).single(),
      supabase.from('interacciones').select('*').eq('cliente_id', id).order('fecha', { ascending: false }),
      supabase.from('contratos')
        .select(`id, numero, tipo, estado, moneda, precio_total, tramo1_cuota, fecha_firma,
          emprendimiento:emprendimiento_id(nombre), unidad:unidad_id(identificador)`)
        .eq('cliente_id', id).order('created_at', { ascending: false }),
    ])
    if (cliRes.error) { setError(cliRes.error.message); setLoading(false); return }
    setCliente(cliRes.data)
    setInteracciones(intRes.data ?? [])

    const cosRaw = coRes.data ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setContratos((cosRaw as any[]).map((c: any) => ({
      id: c.id, numero: c.numero, tipo: c.tipo, estado: c.estado,
      moneda: c.moneda as 'USD'|'ARS', precio_total: c.precio_total,
      cuota_t1: c.tramo1_cuota, cuotas_pagadas: 0, cuotas_total: 0,
      fecha_firma: c.fecha_firma,
      emprendimiento: (c.emprendimiento as {nombre:string}|null)?.nombre ?? '—',
      unidad: (c.unidad as {identificador:string}|null)?.identificador ?? '—',
    })))

    // Cuotas de todos sus contratos
    if (cosRaw.length) {
      const contratoIds = cosRaw.map((c: { id: string }) => c.id)
      const { data: cuotasRes } = await supabase
        .from('cuotas')
        .select('id, contrato_id, numero_cuota, tramo, fecha_vencimiento, monto_original, estado, fecha_pago, monto_pagado, mora_dias, contrato:contrato_id(numero, moneda)')
        .in('contrato_id', contratoIds)
        .order('fecha_vencimiento')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCuotas(((cuotasRes ?? []) as any[]).map((c: any) => ({
        id: c.id, contrato_numero: (c.contrato as {numero?:string}|null)?.numero ?? '',
        numero: c.numero_cuota, tramo: c.tramo,
        fecha_vencimiento: c.fecha_vencimiento, monto_original: c.monto_original,
        moneda: ((c.contrato as {moneda?:string}|null)?.moneda ?? 'USD') as 'USD'|'ARS',
        estado: c.estado as CuotaResumen['estado'],
        fecha_pago: c.fecha_pago, monto_pagado: c.monto_pagado, mora_dias: c.mora_dias,
      })))
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const addInteraccion = async (input: Omit<Interaccion, 'id' | 'created_at'>) => {
    const { error: err } = await supabase.from('interacciones').insert(input)
    if (err) throw new Error(err.message)
    await load()
  }

  const updateCliente = async (input: Partial<ClienteInput>) => {
    if (!id) return
    const { error: err } = await supabase.from('clientes').update(input).eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  const registrarPago = async (cuotaId: string, pago: { fecha_pago: string; monto_pagado: number; medio_pago: string; numero_recibo?: string }) => {
    const { error: err } = await supabase.from('cuotas').update({ ...pago, estado: 'pagada' }).eq('id', cuotaId)
    if (err) throw new Error(err.message)
    await load()
  }

  return { cliente, interacciones, contratos, cuotas, loading, error, reload: load, addInteraccion, updateCliente, registrarPago }
}
