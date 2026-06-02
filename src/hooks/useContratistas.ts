import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface Contratista {
  id: string
  razon_social: string
  nombre_contacto?: string
  cuit?: string
  rubro?: string
  email?: string
  telefono?: string
  direccion?: string
  estado: 'activo' | 'inactivo'
  calificacion?: number
  notas?: string
  created_at: string
}

export interface Certificacion {
  id: string
  emprendimiento_id: string
  etapa_id?: string
  contratista_id: string
  numero_certificado?: string
  fecha: string
  descripcion?: string
  monto_certificado: number
  moneda: 'USD' | 'ARS'
  porcentaje_retencion: number
  monto_retencion?: number
  monto_neto?: number
  estado: 'pendiente' | 'aprobado' | 'pagado'
  fecha_pago?: string
  notas?: string
  created_at: string
  emprendimiento?: { nombre: string }
  etapa?: { nombre: string }
}

export function useContratistas() {
  const [data,    setData]    = useState<Contratista[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('contratistas').select('*').eq('estado', 'activo').order('razon_social')
    if (err) { setError(err.message) } else { setData(rows ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Sumar totales de certificaciones para cada contratista
  const [totales, setTotales] = useState<Record<string, { cert: number; pag: number; ret: number }>>({})

  useEffect(() => {
    if (!data.length) return
    supabase.from('certificaciones').select('contratista_id, monto_certificado, monto_retencion, monto_neto, estado')
      .in('contratista_id', data.map(c => c.id))
      .then(({ data: certs }) => {
        const map: Record<string, { cert: number; pag: number; ret: number }> = {}
        ;(certs ?? []).forEach((c: { contratista_id: string; monto_certificado: number; monto_neto?: number; monto_retencion?: number; estado: string }) => {
          if (!map[c.contratista_id]) map[c.contratista_id] = { cert: 0, pag: 0, ret: 0 }
          map[c.contratista_id].cert += c.monto_certificado
          map[c.contratista_id].ret  += c.monto_retencion ?? 0
          if (c.estado === 'pagado') map[c.contratista_id].pag += c.monto_neto ?? 0
        })
        setTotales(map)
      })
  }, [data])

  const create = async (input: Omit<Contratista, 'id' | 'created_at'>) => {
    const { data: row, error: err } = await supabase.from('contratistas').insert(input).select().single()
    if (err) throw new Error(err.message)
    await load(); return row
  }

  return { data, loading, error, totales, reload: load, create }
}

export function useContratistaDetalle(id: string | undefined) {
  const [contratista, setContratista] = useState<Contratista | null>(null)
  const [certs,       setCerts]       = useState<Certificacion[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [ctRes, ceRes] = await Promise.all([
      supabase.from('contratistas').select('*').eq('id', id).single(),
      supabase.from('certificaciones')
        .select('*, emprendimiento:emprendimiento_id(nombre), etapa:etapa_id(nombre)')
        .eq('contratista_id', id).order('fecha', { ascending: false }),
    ])
    if (ctRes.error) { setError(ctRes.error.message); setLoading(false); return }
    setContratista(ctRes.data)
    setCerts(ceRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const addCert = async (input: Omit<Certificacion, 'id' | 'created_at' | 'emprendimiento' | 'etapa'>) => {
    const retencion = (input.monto_certificado * input.porcentaje_retencion) / 100
    const neto      = input.monto_certificado - retencion
    const { error: err } = await supabase.from('certificaciones').insert({
      ...input, monto_retencion: retencion, monto_neto: neto,
    })
    if (err) throw new Error(err.message)
    await load()
  }

  const aprobarCert = async (certId: string) => {
    const { error: err } = await supabase.from('certificaciones').update({ estado: 'aprobado' }).eq('id', certId)
    if (err) throw new Error(err.message)
    await load()
  }

  const pagarCert = async (certId: string, fechaPago: string) => {
    const { error: err } = await supabase.from('certificaciones').update({ estado: 'pagado', fecha_pago: fechaPago }).eq('id', certId)
    if (err) throw new Error(err.message)
    await load()
  }

  const totalCert = certs.reduce((s, c) => s + c.monto_certificado, 0)
  const totalRet  = certs.reduce((s, c) => s + (c.monto_retencion ?? 0), 0)
  const totalPag  = certs.filter(c => c.estado === 'pagado').reduce((s, c) => s + (c.monto_neto ?? 0), 0)
  const saldo     = certs.filter(c => c.estado !== 'pagado').reduce((s, c) => s + (c.monto_neto ?? 0), 0)

  return { contratista, certs, totalCert, totalRet, totalPag, saldo, loading, error, reload: load, addCert, aprobarCert, pagarCert }
}
