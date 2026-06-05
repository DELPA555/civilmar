import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface Empresa {
  id: string
  nombre: string
  cuit?: string
  razon_social?: string
  direccion?: string
  telefono?: string
  email?: string
  logo_url?: string
  color_primario?: string
  color_acento?: string
  condicion_iva?: string
  ingresos_brutos?: string
  moneda_default: string
  activo: boolean
  created_at: string
}

export interface UsuarioEmpresa {
  id: string
  usuario_id: string
  empresa_id: string
  rol: string
  activo: boolean
  empresa?: Empresa
}

export function useEmpresas() {
  const [data,    setData]    = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('empresas').select('*').eq('activo', true).order('nombre')
    if (err) setError(err.message); else setData(rows ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (input: Omit<Empresa, 'id' | 'created_at'>) => {
    const { data: row, error: err } = await supabase.from('empresas').insert(input).select().single()
    if (err) throw new Error(err.message)
    await load(); return row
  }

  const update = async (id: string, input: Partial<Empresa>) => {
    const { error: err } = await supabase.from('empresas').update(input).eq('id', id)
    if (err) throw new Error(err.message)
    await load()
  }

  return { data, loading, error, reload: load, create, update }
}

export function useEmpresasUsuario(usuarioId: string | undefined) {
  const [data,    setData]    = useState<UsuarioEmpresa[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!usuarioId) { setData([]); setLoading(false); return }
    setLoading(true)
    const { data: rows } = await supabase
      .from('usuarios_empresas')
      .select('*, empresa:empresa_id(*)')
      .eq('usuario_id', usuarioId)
      .eq('activo', true)
    setData((rows ?? []) as UsuarioEmpresa[])
    setLoading(false)
  }, [usuarioId])

  useEffect(() => { load() }, [load])

  const asignar = async (empresaId: string, rol: string) => {
    if (!usuarioId) return
    const { error: err } = await supabase.from('usuarios_empresas').upsert(
      { usuario_id: usuarioId, empresa_id: empresaId, rol, activo: true },
      { onConflict: 'usuario_id,empresa_id' }
    )
    if (err) throw new Error(err.message)
    await load()
  }

  return { data, loading, reload: load, asignar }
}
