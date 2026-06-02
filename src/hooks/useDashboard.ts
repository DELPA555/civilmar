import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { supabase } from '@/lib/supabase'

export interface DashboardStats {
  unidades: { total: number; disponibles: number; vendidas: number; reservadas: number; escrituradas: number }
  cobros:   { cobradoMesUSD: number; cobradoMesARS: number; vencidasQty: number; vencidasUSD: number }
  avance:   number   // % promedio obras activas
  contratos:{ vigentes: number; total: number }
}

export interface FlujoCaja {
  mes: string
  proyectado: number
  cobrado: number
}

export function useDashboard() {
  const [stats,   setStats]   = useState<DashboardStats | null>(null)
  const [flujo,   setFlujo]   = useState<FlujoCaja[]>([])
  const [vencidas, setVencidas] = useState<{
    cliente: string; unidad: string; vencida: string; dias: number; monto: number; moneda: string
  }[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const hoy        = new Date()
      const mesInicio  = format(startOfMonth(hoy), 'yyyy-MM-dd')
      const mesFin     = format(endOfMonth(hoy),   'yyyy-MM-dd')

      const [unidRes, cobMesRes, vencRes, etRes, coRes] = await Promise.all([
        supabase.from('unidades').select('estado'),
        supabase.from('cuotas')
          .select('estado, monto_pagado, monto_original, moneda:contrato_id(moneda)')
          .eq('estado', 'pagada')
          .gte('fecha_pago', mesInicio)
          .lte('fecha_pago', mesFin),
        supabase.from('cuotas')
          .select(`
            id, monto_original, fecha_vencimiento,
            contrato:contrato_id(
              moneda,
              cliente:cliente_id(nombre, apellido),
              unidad:unidad_id(identificador)
            )
          `)
          .eq('estado', 'vencida')
          .order('fecha_vencimiento'),
        supabase.from('etapas_obra')
          .select('avance_porcentaje, porcentaje_obra, emprendimiento:emprendimiento_id(estado)'),
        supabase.from('contratos').select('estado'),
      ])

      // Unidades
      const uds = unidRes.data ?? []
      const unidades = {
        total:        uds.length,
        disponibles:  uds.filter((u: { estado: string }) => u.estado === 'disponible').length,
        vendidas:     uds.filter((u: { estado: string }) => u.estado === 'vendida').length,
        reservadas:   uds.filter((u: { estado: string }) => u.estado === 'reservada').length,
        escrituradas: uds.filter((u: { estado: string }) => u.estado === 'escriturada').length,
      }

      // Cobros del mes — cast a any[] para evitar inferencia incorrecta de Supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cobMes = (cobMesRes.data ?? []) as any[]
      const cobradoMesUSD = cobMes.filter((c: any) => c.contrato?.moneda === 'USD').reduce((s: number, c: any) => s + (c.monto_pagado ?? c.monto_original), 0)
      const cobradoMesARS = cobMes.filter((c: any) => c.contrato?.moneda === 'ARS').reduce((s: number, c: any) => s + (c.monto_pagado ?? c.monto_original), 0)

      // Cuotas vencidas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vencs = (vencRes.data ?? []) as any[]
      const vencidasUSD = vencs
        .filter((c: any) => c.contrato?.moneda === 'USD')
        .reduce((s: number, c: any) => s + c.monto_original, 0)

      // Avance de obras activas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const etapas  = (etRes.data ?? []) as any[]
      const activas = etapas.filter((e: any) => e.emprendimiento?.estado === 'en_obra')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const avance  = activas.length
        ? activas.reduce((s: number, e: any) => s + (e.avance_porcentaje * (e.porcentaje_obra ?? 0)) / 100, 0)
        : 0

      // Contratos
      const cts     = coRes.data ?? []
      const contratos = { vigentes: cts.filter((c: { estado: string }) => c.estado === 'vigente').length, total: cts.length }

      setStats({
        unidades,
        cobros: { cobradoMesUSD, cobradoMesARS, vencidasQty: vencs.length, vencidasUSD },
        avance: Math.round(avance),
        contratos,
      })

      // Cuotas vencidas enriquecidas
      setVencidas(vencs.map((c: {
        monto_original: number
        fecha_vencimiento: string
        contrato: { moneda?: string; cliente?: { nombre: string; apellido?: string }; unidad?: { identificador: string } } | null
      }) => {
        const dias = Math.floor((hoy.getTime() - new Date(c.fecha_vencimiento).getTime()) / 86400000)
        const co   = c.contrato as { moneda?: string; cliente?: { nombre: string; apellido?: string }; unidad?: { identificador: string } } | null
        return {
          cliente: co?.cliente ? `${co.cliente.apellido ?? ''}, ${co.cliente.nombre}`.replace(/^,\s*/, '') : '—',
          unidad:  co?.unidad?.identificador ?? '—',
          vencida: c.fecha_vencimiento,
          dias,
          monto:   c.monto_original,
          moneda:  co?.moneda ?? 'USD',
        }
      }))

      // Flujo de caja últimos 6 meses
      const meses = await Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const d   = subMonths(hoy, 5 - i)
          const ini = format(startOfMonth(d), 'yyyy-MM-dd')
          const fin = format(endOfMonth(d),   'yyyy-MM-dd')
          const mes = format(d, 'MMM yy')
          return Promise.all([
            supabase.from('cuotas').select('monto_original').gte('fecha_vencimiento', ini).lte('fecha_vencimiento', fin),
            supabase.from('cuotas').select('monto_pagado, monto_original').eq('estado', 'pagada').gte('fecha_pago', ini).lte('fecha_pago', fin),
          ]).then(([proy, cob]) => ({
            mes,
            proyectado: Math.round((proy.data ?? []).reduce((s: number, c: { monto_original: number }) => s + c.monto_original, 0) / 1000),
            cobrado:    Math.round((cob.data ?? []).reduce((s: number, c: { monto_pagado?: number; monto_original: number }) => s + (c.monto_pagado ?? c.monto_original), 0) / 1000),
          }))
        })
      )
      setFlujo(meses)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { stats, flujo, vencidas, loading, error, reload: load }
}
