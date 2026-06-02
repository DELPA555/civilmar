import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface Proveedor {
  id: string
  razon_social: string
  nombre_contacto?: string
  cuit?: string
  rubro?: string
  email?: string
  telefono?: string
  direccion?: string
  condicion_pago?: string
  estado: 'activo' | 'inactivo'
  calificacion?: number
  notas?: string
  created_at: string
}

export interface OrdenCompra {
  id: string
  numero: string
  emprendimiento_id?: string
  proveedor_id: string
  fecha: string
  descripcion?: string
  estado: string
  moneda: 'USD' | 'ARS'
  subtotal?: number
  iva?: number
  total?: number
  condicion_pago?: string
  fecha_entrega_estimada?: string
  fecha_entrega_real?: string
  notas?: string
  created_at: string
  emprendimiento?: { nombre: string }
}

export interface PagoProveedor {
  id: string
  tipo_beneficiario: 'proveedor' | 'contratista' | 'profesional'
  beneficiario_id: string
  emprendimiento_id?: string
  orden_compra_id?: string
  fecha: string
  concepto: string
  moneda: 'USD' | 'ARS'
  monto: number
  medio_pago?: string
  numero_comprobante?: string
  notas?: string
  created_at: string
}

// ── Lista de proveedores ──────────────────────────────────────────────────────

export function useProveedores() {
  const [data,    setData]    = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('proveedores')
      .select('*')
      .eq('estado', 'activo')
      .order('razon_social')
    if (err) { setError(err.message) } else { setData(rows ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (input: Omit<Proveedor, 'id' | 'created_at'>) => {
    const { data: row, error: err } = await supabase.from('proveedores').insert(input).select().single()
    if (err) throw new Error(err.message)
    await load(); return row
  }

  const update = async (id: string, input: Partial<Proveedor>) => {
    const { error: err } = await supabase.from('proveedores').update(input).eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  return { data, loading, error, reload: load, create, update }
}

// ── Detalle de proveedor ──────────────────────────────────────────────────────

export function useProveedorDetalle(id: string | undefined) {
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [ordenes,   setOrdenes]   = useState<OrdenCompra[]>([])
  const [pagos,     setPagos]     = useState<PagoProveedor[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [pvRes, ocRes, pgRes] = await Promise.all([
      supabase.from('proveedores').select('*').eq('id', id).single(),
      supabase.from('ordenes_compra')
        .select('*, emprendimiento:emprendimiento_id(nombre)')
        .eq('proveedor_id', id).order('fecha', { ascending: false }),
      supabase.from('pagos_proveedores')
        .select('*').eq('beneficiario_id', id).eq('tipo_beneficiario', 'proveedor')
        .order('fecha', { ascending: false }),
    ])
    if (pvRes.error) { setError(pvRes.error.message); setLoading(false); return }
    setProveedor(pvRes.data)
    setOrdenes(ocRes.data ?? [])
    setPagos(pgRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const registrarPago = async (input: Omit<PagoProveedor, 'id' | 'created_at'>) => {
    const { error: err } = await supabase.from('pagos_proveedores').insert(input)
    if (err) throw new Error(err.message)
    await load()
  }

  const crearOrden = async (input: Omit<OrdenCompra, 'id' | 'created_at' | 'emprendimiento'>) => {
    const { error: err } = await supabase.from('ordenes_compra').insert(input)
    if (err) throw new Error(err.message)
    await load()
  }

  const totalOC  = ordenes.reduce((s, o) => s + (o.total ?? 0), 0)
  const totalPag = pagos.reduce((s, p) => s + p.monto, 0)
  const saldo    = totalOC - totalPag

  return { proveedor, ordenes, pagos, totalOC, totalPag, saldo, loading, error, reload: load, registrarPago, crearOrden }
}
