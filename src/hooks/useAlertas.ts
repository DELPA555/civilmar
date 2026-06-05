import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type NivelAlerta = 'critico' | 'urgente' | 'atencion' | 'info'

export interface Alerta {
  id: string
  nivel: NivelAlerta
  tipo: string
  titulo: string
  descripcion: string
  referencia_tipo?: string
  referencia_id?: string
  referencia_path?: string
  estado: 'pendiente' | 'vista' | 'gestionada'
}

export function useAlertas() {
  const [alertas,  setAlertas]  = useState<Alerta[]>([])
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const hoy = new Date().toISOString().split('T')[0]
    const en30 = new Date(Date.now() + 30*86400000).toISOString().split('T')[0]
    const en7  = new Date(Date.now() +  7*86400000).toISOString().split('T')[0]
    const semana = new Date(Date.now() +  7*86400000).toISOString()

    const lista: Alerta[] = []

    // Cuotas vencidas >30 dÃ­as â€” CRÃTICO
    const { data: criticas } = await supabase.from('cuotas')
      .select('id, numero_cuota, fecha_vencimiento, monto_original, contrato:contrato_id(numero, cliente:cliente_id(nombre,apellido))')
      .eq('estado', 'vencida')
      .lt('fecha_vencimiento', new Date(Date.now()-30*86400000).toISOString().split('T')[0])
      .limit(20)
    ;(criticas ?? []).forEach(c => {
      const cli = (c.contrato as unknown as Record<string,unknown>)?.cliente as Record<string,string> | null
      lista.push({
        id: `cuota-crit-${c.id}`, nivel: 'critico',
        tipo: 'cuota_vencida_critico',
        titulo: `Cuota +30 dÃ­as â€” ${cli?.apellido ?? ''}, ${cli?.nombre ?? ''}`.replace(/^,\s*/,''),
        descripcion: `Cuota NÂ°${c.numero_cuota} â€” vto. ${c.fecha_vencimiento}`,
        referencia_tipo: 'cuota', referencia_id: c.id, referencia_path: '/cobros',
        estado: 'pendiente',
      })
    })

    // Documentos vencidos â€” CRÃTICO
    const { data: docsVenc } = await supabase.from('documentos_legales')
      .select('id, tipo, descripcion, entidad_tipo, entidad_id, fecha_vencimiento')
      .lt('fecha_vencimiento', hoy).limit(20)
    ;(docsVenc ?? []).forEach(d => {
      lista.push({
        id: `doc-venc-${d.id}`, nivel: 'critico', tipo: 'documento_vencido',
        titulo: `Documento vencido: ${d.tipo.replace(/_/g,' ')}`,
        descripcion: d.descripcion ?? `${d.entidad_tipo} â€” vto. ${d.fecha_vencimiento}`,
        referencia_tipo: 'documento', referencia_id: d.id, referencia_path: '/documentacion-legal',
        estado: 'pendiente',
      })
    })

    // Cuotas vencidas 1-30 dÃ­as â€” URGENTE
    const { data: urgentes } = await supabase.from('cuotas')
      .select('id, numero_cuota, fecha_vencimiento, contrato:contrato_id(numero, cliente:cliente_id(nombre,apellido))')
      .eq('estado', 'vencida')
      .gte('fecha_vencimiento', new Date(Date.now()-30*86400000).toISOString().split('T')[0])
      .limit(20)
    ;(urgentes ?? []).forEach(c => {
      const cli = (c.contrato as unknown as Record<string,unknown>)?.cliente as Record<string,string> | null
      lista.push({
        id: `cuota-urg-${c.id}`, nivel: 'urgente', tipo: 'cuota_vencida',
        titulo: `Cuota vencida â€” ${cli?.apellido ?? ''}, ${cli?.nombre ?? ''}`.replace(/^,\s*/,''),
        descripcion: `Cuota NÂ°${c.numero_cuota} â€” vto. ${c.fecha_vencimiento}`,
        referencia_tipo: 'cuota', referencia_id: c.id, referencia_path: '/cobros',
        estado: 'pendiente',
      })
    })

    // Documentos por vencer en 7 dÃ­as â€” URGENTE
    const { data: docs7 } = await supabase.from('documentos_legales')
      .select('id, tipo, descripcion, fecha_vencimiento')
      .gte('fecha_vencimiento', hoy).lte('fecha_vencimiento', en7).limit(10)
    ;(docs7 ?? []).forEach(d => {
      lista.push({
        id: `doc-7-${d.id}`, nivel: 'urgente', tipo: 'documento_por_vencer_7',
        titulo: `Documento vence en 7 dÃ­as: ${d.tipo.replace(/_/g,' ')}`,
        descripcion: `${d.descripcion ?? ''} â€” vto. ${d.fecha_vencimiento}`,
        referencia_tipo: 'documento', referencia_id: d.id, referencia_path: '/documentacion-legal',
        estado: 'pendiente',
      })
    })

    // Etapas con retraso â€” ATENCIÃ“N
    const { data: etapas } = await supabase.from('etapas_obra')
      .select('id, nombre, emprendimiento:emprendimiento_id(nombre)')
      .eq('estado', 'con_retraso').limit(10)
    ;(etapas ?? []).forEach(e => {
      const emp = (e.emprendimiento as unknown as Record<string,string>|null)?.nombre ?? '—'
      lista.push({
        id: `etapa-${e.id}`, nivel: 'atencion', tipo: 'etapa_retraso',
        titulo: `Etapa retrasada: ${e.nombre}`,
        descripcion: `Emprendimiento: ${emp}`,
        referencia_tipo: 'etapa', referencia_id: e.id, referencia_path: '/emprendimientos',
        estado: 'pendiente',
      })
    })

    // Documentos por vencer en 30 dÃ­as â€” ATENCIÃ“N
    const { data: docs30 } = await supabase.from('documentos_legales')
      .select('id, tipo, descripcion, fecha_vencimiento')
      .gte('fecha_vencimiento', en7).lte('fecha_vencimiento', en30).limit(10)
    ;(docs30 ?? []).forEach(d => {
      lista.push({
        id: `doc-30-${d.id}`, nivel: 'atencion', tipo: 'documento_por_vencer_30',
        titulo: `Documento vence en 30 dÃ­as: ${d.tipo.replace(/_/g,' ')}`,
        descripcion: `${d.descripcion ?? ''} â€” vto. ${d.fecha_vencimiento}`,
        referencia_tipo: 'documento', referencia_id: d.id, referencia_path: '/documentacion-legal',
        estado: 'pendiente',
      })
    })

    // Cuotas que vencen esta semana â€” INFO
    const { data: proximas } = await supabase.from('cuotas')
      .select('id, numero_cuota, fecha_vencimiento, monto_original, contrato:contrato_id(cliente:cliente_id(nombre,apellido))')
      .eq('estado', 'pendiente')
      .gte('fecha_vencimiento', hoy)
      .lte('fecha_vencimiento', semana.split('T')[0])
      .limit(15)
    ;(proximas ?? []).forEach(c => {
      const cli = ((c.contrato as unknown as Record<string,unknown>)?.cliente as Record<string,string>|null)
      lista.push({
        id: `cuota-prox-${c.id}`, nivel: 'info', tipo: 'cuota_proxima',
        titulo: `Cuota prÃ³xima â€” ${cli?.apellido ?? ''}, ${cli?.nombre ?? ''}`.replace(/^,\s*/,''),
        descripcion: `NÂ°${c.numero_cuota} â€” vto. ${c.fecha_vencimiento}`,
        referencia_tipo: 'cuota', referencia_id: c.id, referencia_path: '/cobros',
        estado: 'pendiente',
      })
    })

    setAlertas(lista)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const contadores = {
    critico:  alertas.filter(a => a.nivel === 'critico'  && a.estado === 'pendiente').length,
    urgente:  alertas.filter(a => a.nivel === 'urgente'  && a.estado === 'pendiente').length,
    atencion: alertas.filter(a => a.nivel === 'atencion' && a.estado === 'pendiente').length,
    info:     alertas.filter(a => a.nivel === 'info'     && a.estado === 'pendiente').length,
  }

  return { alertas, loading, reload: load, contadores }
}

