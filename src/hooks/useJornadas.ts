import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type CategoriaUOCRA = 'oficial' | 'oficial_especializado' | 'medio_oficial' | 'ayudante' | 'capataz' | 'otro'

export const CATEGORIAS_UOCRA: Record<CategoriaUOCRA, { label: string; coeficiente: number }> = {
  capataz:              { label: 'Capataz',              coeficiente: 1.4  },
  oficial_especializado:{ label: 'Oficial especializado',coeficiente: 1.25 },
  oficial:              { label: 'Oficial',              coeficiente: 1.0  },
  medio_oficial:        { label: 'Medio oficial',        coeficiente: 0.85 },
  ayudante:             { label: 'Ayudante',             coeficiente: 0.70 },
  otro:                 { label: 'Otro',                 coeficiente: 1.0  },
}

export interface Operario {
  id: string
  nombre: string
  apellido: string
  dni?: string
  categoria: CategoriaUOCRA
  cuil?: string
  telefono?: string
  fecha_ingreso?: string
  jornal_base: number
  activo: boolean
  created_at: string
}

export interface Jornada {
  id: string
  operario_id: string
  emprendimiento_id: string
  fecha: string
  estado: 'presente' | 'ausente' | 'medio_dia' | 'horas_extra' | 'feriado'
  horas: number
  jornal_aplicado?: number
  notas?: string
  usuario_id?: string
  created_at: string
  operario?: { nombre: string; apellido: string; categoria: CategoriaUOCRA; jornal_base: number }
  emprendimiento?: { nombre: string }
}

export function useOperarios() {
  const [data,    setData]    = useState<Operario[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('operarios').select('*').eq('activo', true).order('apellido').order('nombre')
    if (err) setError(err.message); else setData(rows ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (input: Omit<Operario, 'id' | 'created_at'>) => {
    const { data: row, error: err } = await supabase.from('operarios').insert(input).select().single()
    if (err) throw new Error(err.message)
    await load(); return row
  }

  const update = async (id: string, input: Partial<Operario>) => {
    const { error: err } = await supabase.from('operarios').update(input).eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  return { data, loading, error, reload: load, create, update }
}

export function useJornadas(emprendimientoId?: string, fechaDesde?: string, fechaHasta?: string) {
  const [data,    setData]    = useState<Jornada[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('jornadas')
      .select('*, operario:operario_id(nombre, apellido, categoria, jornal_base), emprendimiento:emprendimiento_id(nombre)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (emprendimientoId) q = q.eq('emprendimiento_id', emprendimientoId)
    if (fechaDesde) q = q.gte('fecha', fechaDesde)
    if (fechaHasta) q = q.lte('fecha', fechaHasta)
    const { data: rows, error: err } = await q.limit(500)
    if (err) setError(err.message); else setData(rows ?? [])
    setLoading(false)
  }, [emprendimientoId, fechaDesde, fechaHasta])

  useEffect(() => { load() }, [load])

  const registrar = async (input: Omit<Jornada, 'id' | 'created_at' | 'operario' | 'emprendimiento'>) => {
    const { error: err } = await supabase.from('jornadas').upsert(input, {
      onConflict: 'operario_id,emprendimiento_id,fecha',
    })
    if (err) throw new Error(err.message)
    await load()
  }

  const totalJornales = data
    .filter(j => j.estado !== 'ausente')
    .reduce((s, j) => s + (j.jornal_aplicado ?? 0), 0)

  return { data, loading, error, reload: load, registrar, totalJornales }
}
