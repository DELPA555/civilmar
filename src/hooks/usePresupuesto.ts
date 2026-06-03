import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface Presupuesto {
  id: string
  emprendimiento_id: string
  version: number
  descripcion?: string
  estado: 'borrador' | 'aprobado' | 'revision'
  moneda: 'ARS' | 'USD'
  superficie_total?: number
  created_at: string
  updated_at: string
  emprendimiento?: { nombre: string }
}

export interface ItemPresupuesto {
  id: string
  presupuesto_id: string
  rubro: string
  descripcion: string
  unidad: string
  cantidad: number
  precio_unitario_materiales: number
  precio_unitario_mano_obra: number
  precio_unitario_equipos: number
  total: number
}

export const RUBROS = [
  'Excavación y movimiento de suelos',
  'Estructura de hormigón',
  'Mampostería',
  'Instalaciones sanitarias',
  'Instalaciones eléctricas',
  'Instalaciones de gas',
  'Revestimientos y pisos',
  'Carpintería y aberturas',
  'Pintura y terminaciones',
  'Paisajismo y exteriores',
  'Equipamiento y mobiliario',
  'Honorarios profesionales',
  'Otros',
]

export function usePresupuestos(emprendimientoId?: string) {
  const [data,    setData]    = useState<Presupuesto[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('presupuesto_obra')
      .select('*, emprendimiento:emprendimiento_id(nombre)')
      .order('created_at', { ascending: false })
    if (emprendimientoId) q = q.eq('emprendimiento_id', emprendimientoId)
    const { data: rows, error: err } = await q
    if (err) setError(err.message); else setData(rows ?? [])
    setLoading(false)
  }, [emprendimientoId])

  useEffect(() => { load() }, [load])

  const create = async (input: Omit<Presupuesto, 'id' | 'created_at' | 'updated_at' | 'emprendimiento'>) => {
    const { data: row, error: err } = await supabase.from('presupuesto_obra').insert(input).select().single()
    if (err) throw new Error(err.message)
    await load(); return row
  }

  const update = async (id: string, input: Partial<Presupuesto>) => {
    const { error: err } = await supabase.from('presupuesto_obra').update(input).eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  return { data, loading, error, reload: load, create, update }
}

export function usePresupuestoDetalle(id: string | undefined) {
  const [presupuesto, setPres]   = useState<Presupuesto | null>(null)
  const [items,       setItems]  = useState<ItemPresupuesto[]>([])
  const [loading,     setLoading] = useState(true)
  const [error,       setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [pRes, iRes] = await Promise.all([
      supabase.from('presupuesto_obra').select('*, emprendimiento:emprendimiento_id(nombre)').eq('id', id).single(),
      supabase.from('items_presupuesto').select('*').eq('presupuesto_id', id).order('rubro').order('descripcion'),
    ])
    if (pRes.error) { setError(pRes.error.message); setLoading(false); return }
    setPres(pRes.data)
    setItems(iRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const addItem = async (input: Omit<ItemPresupuesto, 'id' | 'total'>) => {
    const { error: err } = await supabase.from('items_presupuesto').insert(input)
    if (err) throw new Error(err.message)
    await load()
  }

  const updateItem = async (itemId: string, input: Partial<ItemPresupuesto>) => {
    const { error: err } = await supabase.from('items_presupuesto').update(input).eq('id', itemId)
    if (err) throw new Error(err.message)
    await load()
  }

  const deleteItem = async (itemId: string) => {
    const { error: err } = await supabase.from('items_presupuesto').delete().eq('id', itemId)
    if (err) throw new Error(err.message)
    await load()
  }

  // Totales por rubro
  const totalesPorRubro = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.rubro] = (acc[item.rubro] ?? 0) + item.total
    return acc
  }, {})

  const totalGeneral  = items.reduce((s, i) => s + i.total, 0)
  const costoPorM2    = presupuesto?.superficie_total
    ? totalGeneral / presupuesto.superficie_total
    : 0

  return { presupuesto, items, loading, error, reload: load, addItem, updateItem, deleteItem, totalesPorRubro, totalGeneral, costoPorM2 }
}
