import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface Material {
  id: string
  codigo?: string
  descripcion: string
  unidad: string
  categoria?: string
  stock_minimo: number
  costo_promedio: number
  activo: boolean
  created_at: string
}

export interface Deposito {
  id: string
  nombre: string
  descripcion?: string
  emprendimiento_id?: string
  activo: boolean
  created_at: string
}

export interface MovimientoStock {
  id: string
  material_id: string
  deposito_id: string
  emprendimiento_id?: string
  tipo: 'ingreso' | 'egreso' | 'devolucion' | 'ajuste'
  cantidad: number
  costo_unitario?: number
  fecha: string
  descripcion: string
  remito?: string
  usuario_id?: string
  created_at: string
  material?: { descripcion: string; unidad: string; codigo?: string }
  deposito?: { nombre: string }
}

export interface StockActual {
  material_id: string
  codigo?: string
  descripcion: string
  unidad: string
  categoria?: string
  stock_minimo: number
  costo_promedio: number
  deposito_id: string
  deposito: string
  stock_actual: number
}

export function useMateriales() {
  const [data,    setData]    = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('materiales').select('*').eq('activo', true).order('descripcion')
    if (err) setError(err.message); else setData(rows ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (input: Omit<Material, 'id' | 'created_at'>) => {
    const { data: row, error: err } = await supabase.from('materiales').insert(input).select().single()
    if (err) throw new Error(err.message)
    await load(); return row
  }

  const update = async (id: string, input: Partial<Material>) => {
    const { error: err } = await supabase.from('materiales').update(input).eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  return { data, loading, error, reload: load, create, update }
}

export function useDepositos() {
  const [data,    setData]    = useState<Deposito[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase.from('depositos').select('*').eq('activo', true).order('nombre')
    setData(rows ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (input: Omit<Deposito, 'id' | 'created_at'>) => {
    const { data: row, error: err } = await supabase.from('depositos').insert(input).select().single()
    if (err) throw new Error(err.message)
    await load(); return row
  }

  return { data, loading, reload: load, create }
}

export function useMovimientosStock(depositoId?: string) {
  const [data,    setData]    = useState<MovimientoStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('movimientos_stock')
      .select('*, material:material_id(descripcion, unidad, codigo), deposito:deposito_id(nombre)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)
    if (depositoId) q = q.eq('deposito_id', depositoId)
    const { data: rows, error: err } = await q
    if (err) setError(err.message); else setData(rows ?? [])
    setLoading(false)
  }, [depositoId])

  useEffect(() => { load() }, [load])

  const registrar = async (input: Omit<MovimientoStock, 'id' | 'created_at' | 'material' | 'deposito'>) => {
    const { error: err } = await supabase.from('movimientos_stock').insert(input)
    if (err) throw new Error(err.message)

    // Actualizar costo promedio si es ingreso
    if (input.tipo === 'ingreso' && input.costo_unitario) {
      const { data: mat } = await supabase.from('materiales').select('costo_promedio').eq('id', input.material_id).single()
      if (mat) {
        const nuevo = mat.costo_promedio > 0
          ? (mat.costo_promedio + input.costo_unitario) / 2
          : input.costo_unitario
        await supabase.from('materiales').update({ costo_promedio: nuevo }).eq('id', input.material_id)
      }
    }
    await load()
  }

  return { data, loading, error, reload: load, registrar }
}

export function useStockActual() {
  const [data,    setData]    = useState<StockActual[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase.from('stock_actual').select('*').order('descripcion')
    setData((rows ?? []) as StockActual[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const alertas = data.filter(s => s.stock_actual <= s.stock_minimo && s.stock_minimo > 0)

  return { data, loading, reload: load, alertas }
}
