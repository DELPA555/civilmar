import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface Licitacion {
  id: string
  emprendimiento_id?: string
  numero: string
  descripcion: string
  fecha_solicitud: string
  fecha_limite?: string
  estado: 'abierta' | 'en_evaluacion' | 'adjudicada' | 'cancelada'
  proveedor_adjudicado_id?: string
  orden_compra_id?: string
  notas?: string
  created_at: string
  emprendimiento?: { nombre: string }
  proveedor_adjudicado?: { razon_social: string }
}

export interface ItemLicitacion {
  id: string
  licitacion_id: string
  descripcion: string
  unidad?: string
  cantidad?: number
  especificaciones?: string
}

export interface CotizacionProveedor {
  id: string
  licitacion_id: string
  proveedor_id: string
  fecha_cotizacion?: string
  estado: 'pendiente' | 'recibida' | 'adjudicada' | 'rechazada'
  moneda: 'ARS' | 'USD'
  monto_total?: number
  plazo_entrega_dias?: number
  condicion_pago?: string
  observaciones?: string
  created_at: string
  proveedor?: { razon_social: string; email?: string; telefono?: string }
  items?: ItemCotizacion[]
}

export interface ItemCotizacion {
  id: string
  cotizacion_id: string
  item_licitacion_id?: string
  descripcion: string
  cantidad?: number
  precio_unitario?: number
  total?: number
}

export function useLicitaciones(emprendimientoId?: string) {
  const [data,    setData]    = useState<Licitacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('licitaciones')
      .select('*, emprendimiento:emprendimiento_id(nombre), proveedor_adjudicado:proveedor_adjudicado_id(razon_social)')
      .order('created_at', { ascending: false })
    if (emprendimientoId) q = q.eq('emprendimiento_id', emprendimientoId)
    const { data: rows, error: err } = await q
    if (err) setError(err.message); else setData(rows ?? [])
    setLoading(false)
  }, [emprendimientoId])

  useEffect(() => { load() }, [load])

  const create = async (input: Omit<Licitacion, 'id' | 'created_at' | 'emprendimiento' | 'proveedor_adjudicado'>) => {
    const { data: row, error: err } = await supabase.from('licitaciones').insert(input).select().single()
    if (err) throw new Error(err.message)
    await load(); return row
  }

  const update = async (id: string, input: Partial<Licitacion>) => {
    const { error: err } = await supabase.from('licitaciones').update(input).eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  return { data, loading, error, reload: load, create, update }
}

export function useLicitacionDetalle(id: string | undefined) {
  const [licitacion, setLic]   = useState<Licitacion | null>(null)
  const [items,      setItems] = useState<ItemLicitacion[]>([])
  const [cotizaciones, setCot] = useState<CotizacionProveedor[]>([])
  const [loading,    setLoad]  = useState(true)
  const [error,      setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoad(true)
    const [lRes, iRes, cRes] = await Promise.all([
      supabase.from('licitaciones')
        .select('*, emprendimiento:emprendimiento_id(nombre), proveedor_adjudicado:proveedor_adjudicado_id(razon_social)')
        .eq('id', id).single(),
      supabase.from('items_licitacion').select('*').eq('licitacion_id', id),
      supabase.from('cotizaciones_proveedores')
        .select('*, proveedor:proveedor_id(razon_social, email, telefono), items:items_cotizacion(*)')
        .eq('licitacion_id', id).order('monto_total'),
    ])
    if (lRes.error) { setError(lRes.error.message); setLoad(false); return }
    setLic(lRes.data)
    setItems(iRes.data ?? [])
    setCot(cRes.data ?? [])
    setLoad(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const addItem = async (input: Omit<ItemLicitacion, 'id'>) => {
    const { error: err } = await supabase.from('items_licitacion').insert(input)
    if (err) throw new Error(err.message)
    await load()
  }

  const addCotizacion = async (input: Omit<CotizacionProveedor, 'id' | 'created_at' | 'proveedor' | 'items'>) => {
    const { error: err } = await supabase.from('cotizaciones_proveedores').insert(input)
    if (err) throw new Error(err.message)
    await load()
  }

  const updateCotizacion = async (cotId: string, input: Partial<CotizacionProveedor>) => {
    const { error: err } = await supabase.from('cotizaciones_proveedores').update(input).eq('id', cotId)
    if (err) throw new Error(err.message)
    await load()
  }

  const adjudicar = async (cotizacionId: string, proveedorId: string) => {
    await Promise.all([
      supabase.from('licitaciones').update({ estado: 'adjudicada', proveedor_adjudicado_id: proveedorId }).eq('id', id!),
      supabase.from('cotizaciones_proveedores').update({ estado: 'adjudicada' }).eq('id', cotizacionId),
      supabase.from('cotizaciones_proveedores').update({ estado: 'rechazada' })
        .eq('licitacion_id', id!).neq('id', cotizacionId),
    ])
    await load()
  }

  return { licitacion, items, cotizaciones, loading, error, reload: load, addItem, addCotizacion, updateCotizacion, adjudicar }
}
