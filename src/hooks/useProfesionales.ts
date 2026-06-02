import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface Profesional {
  id: string
  nombre: string
  apellido: string
  especialidad?: string
  matricula?: string
  cuit?: string
  email?: string
  telefono?: string
  whatsapp?: string
  estado: 'activo' | 'inactivo'
  notas?: string
  created_at: string
}

export function useProfesionales() {
  const [data,    setData]    = useState<Profesional[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('profesionales').select('*').order('apellido').order('nombre')
    if (err) { setError(err.message) } else { setData(rows ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (input: Omit<Profesional, 'id' | 'created_at'>) => {
    const { data: row, error: err } = await supabase.from('profesionales').insert(input).select().single()
    if (err) throw new Error(err.message)
    await load(); return row
  }

  const update = async (id: string, input: Partial<Profesional>) => {
    const { error: err } = await supabase.from('profesionales').update(input).eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  return { data, loading, error, reload: load, create, update }
}
