import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Emprendimiento {
  id: string
  nombre: string
  descripcion?: string
  direccion?: string
  localidad: string
  provincia: string
  tipo?: string
  estado: string
  fecha_inicio?: string
  fecha_fin_estimada?: string
  fecha_fin_real?: string
  meses_obra: number
  total_unidades: number
  imagen_url?: string
  plano_url?: string
  created_at: string
  updated_at: string
  // Calculados al listar
  unidades?: Unidad[]
  avance?: number
}

export interface Unidad {
  id: string
  emprendimiento_id: string
  identificador: string
  tipo?: string
  planta?: number
  metros_cubiertos?: number
  metros_semicubiertos?: number
  metros_totales?: number
  ambientes?: number
  orientacion?: string
  descripcion?: string
  estado: string
  precio_lista_usd?: number
  precio_lista_ars?: number
  /** aliases para compatibilidad con componentes existentes */
  precio_usd?: number
  precio_ars?: number
  moneda_venta: string
  created_at: string
  /** Populados via join con contratos/clientes */
  cliente?: string
  contrato_numero?: string
}

export interface EtapaObra {
  id: string
  emprendimiento_id: string
  nombre: string
  orden: number
  porcentaje_obra?: number
  fecha_inicio_estimada?: string
  fecha_fin_estimada?: string
  fecha_inicio_real?: string
  fecha_fin_real?: string
  estado: string
  avance_porcentaje: number
  presupuesto?: number
  costo_real: number
  notas?: string
}

export interface DiarioObra {
  id: string
  emprendimiento_id: string
  fecha: string
  temperatura_min?: number
  temperatura_max?: number
  condiciones_clima?: string
  personal_presente?: number
  tareas_realizadas: string
  materiales_utilizados?: string
  incidentes?: string
  observaciones?: string
  usuario_id?: string
  created_at: string
}

// ── Hook lista ────────────────────────────────────────────────────────────────

export function useEmprendimientos() {
  const [data,    setData]    = useState<Emprendimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('emprendimientos')
      .select(`
        *,
        unidades(id, estado, precio_lista_usd)
      `)
      .order('created_at', { ascending: false })

    if (err) { setError(err.message); setLoading(false); return }

    // Calcular avance promedio de etapas para cada emprendimiento
    const ids = (rows ?? []).map(r => r.id as string)
    let avanceMap: Record<string, number> = {}
    if (ids.length) {
      const { data: etapas } = await supabase
        .from('etapas_obra')
        .select('emprendimiento_id, avance_porcentaje, porcentaje_obra')
        .in('emprendimiento_id', ids)
      ;(etapas ?? []).forEach((e: { emprendimiento_id: string; avance_porcentaje: number; porcentaje_obra: number }) => {
        avanceMap[e.emprendimiento_id] = (avanceMap[e.emprendimiento_id] ?? 0) +
          (e.avance_porcentaje * (e.porcentaje_obra ?? 0)) / 100
      })
    }

    setData((rows ?? []).map(r => ({ ...r, avance: Math.round(avanceMap[r.id] ?? 0) })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (input: Omit<Emprendimiento, 'id' | 'created_at' | 'updated_at' | 'unidades' | 'avance'>) => {
    const { data: row, error: err } = await supabase.from('emprendimientos').insert(input).select().single()
    if (err) throw new Error(err.message)
    await load()
    return row
  }

  const update = async (id: string, input: Partial<Emprendimiento>) => {
    const { error: err } = await supabase.from('emprendimientos').update(input).eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  return { data, loading, error, reload: load, create, update }
}

// ── Hook detalle (con unidades, etapas, diario) ───────────────────────────────

export function useEmprendimientoDetalle(id: string | undefined) {
  const [emprendimiento, setEmprendimiento] = useState<Emprendimiento | null>(null)
  const [unidades,       setUnidades]       = useState<Unidad[]>([])
  const [etapas,         setEtapas]         = useState<EtapaObra[]>([])
  const [diario,         setDiario]         = useState<DiarioObra[]>([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const [empRes, unidRes, etaRes, diaRes] = await Promise.all([
      supabase.from('emprendimientos').select('*').eq('id', id).single(),
      supabase.from('unidades').select('*').eq('emprendimiento_id', id).order('planta').order('identificador'),
      supabase.from('etapas_obra').select('*').eq('emprendimiento_id', id).order('orden'),
      supabase.from('diario_obra').select('*').eq('emprendimiento_id', id).order('fecha', { ascending: false }),
    ])

    if (empRes.error) { setError(empRes.error.message); setLoading(false); return }
    setEmprendimiento(empRes.data)
    setUnidades(unidRes.data ?? [])
    setEtapas(etaRes.data ?? [])
    setDiario(diaRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const updateUnidad = async (unidadId: string, input: Partial<Unidad>) => {
    const { error: err } = await supabase.from('unidades').update(input).eq('id', unidadId)
    if (err) throw new Error(err.message)
    await load()
  }

  const addUnidad = async (input: Omit<Unidad, 'id' | 'created_at'>) => {
    const { error: err } = await supabase.from('unidades').insert(input)
    if (err) throw new Error(err.message)
    await load()
  }

  const updateEtapa = async (etapaId: string, input: Partial<EtapaObra>) => {
    const { error: err } = await supabase.from('etapas_obra').update(input).eq('id', etapaId)
    if (err) throw new Error(err.message)
    await load()
  }

  const addDiario = async (input: Omit<DiarioObra, 'id' | 'created_at'>) => {
    const { error: err } = await supabase.from('diario_obra').insert(input)
    if (err) throw new Error(err.message)
    await load()
  }

  return { emprendimiento, unidades, etapas, diario, loading, error, reload: load, updateUnidad, addUnidad, updateEtapa, addDiario }
}
