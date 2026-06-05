import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Building2, TrendingUp, DollarSign, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtUSD, fmtARS } from '@/lib/currency'
import { cn } from '@/utils/cn'

const COLORES_ESTADO = { disponible: '#2d7a4f', reservada: '#b8860b', vendida: '#2d5a8e', escriturada: '#6b7280', no_disponible: '#c0392b' }

export default function InversorDashboard() {
  const { token } = useParams<{ token: string }>()
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [empData,   setEmpData]   = useState<Record<string, unknown> | null>(null)
  const [tokenInfo, setTokenInfo] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (!token) { setError('Token inválido'); setLoading(false); return }

    const load = async () => {
      // Verificar token
      const { data: tk } = await supabase
        .from('inversores_tokens')
        .select('*, emprendimiento:emprendimiento_id(*)')
        .eq('token', token)
        .eq('activo', true)
        .single()

      if (!tk) { setError('Link inválido o expirado'); setLoading(false); return }

      // Actualizar último acceso
      await supabase.from('inversores_tokens').update({ ultimo_acceso: new Date().toISOString() }).eq('token', token)

      setTokenInfo(tk)
      const emp = tk.emprendimiento as Record<string, unknown>

      // Cargar datos del emprendimiento
      const [unidRes, etaRes, cuotasRes, certRes] = await Promise.all([
        supabase.from('unidades').select('id, estado, precio_lista_usd').eq('emprendimiento_id', emp.id),
        supabase.from('etapas_obra').select('nombre, estado, avance_porcentaje, porcentaje_obra, presupuesto, costo_real, fecha_inicio_estimada, fecha_fin_estimada').eq('emprendimiento_id', String(emp.id)).order('orden'),
        supabase.from('cuotas')
          .select('monto_pagado, monto_original, estado, fecha_vencimiento, contrato:contrato_id(emprendimiento_id)')
          .limit(500),
        supabase.from('certificaciones')
          .select('monto_certificado, estado, fecha')
          .eq('emprendimiento_id', String(emp.id)),
      ])

      const unids = unidRes.data ?? []
      const etapas = etaRes.data ?? []
      const cuotas = (cuotasRes.data ?? []).filter(c => (c.contrato as {emprendimiento_id?:string}|null)?.emprendimiento_id === String(emp.id))
      const certs  = certRes.data ?? []

      const totalVendido  = unids.filter(u => u.estado === 'vendida' || u.estado === 'escriturada').reduce((s, u) => s + (u.precio_lista_usd ?? 0), 0)
      const cobrado       = cuotas.filter(c => c.estado === 'pagada').reduce((s, c) => s + (c.monto_pagado ?? c.monto_original ?? 0), 0)
      const costoObra     = etapas.reduce((s, e) => s + (e.costo_real ?? 0), 0)
      const avance        = etapas.reduce((s, e) => s + ((e.avance_porcentaje as number) * ((e.porcentaje_obra as number) ?? 0)) / 100, 0)
      const rentProy      = totalVendido > 0 ? ((totalVendido - costoObra) / totalVendido * 100).toFixed(1) : '—'

      // Flujo mensual últimos 6 meses
      const now = new Date()
      const flujoMensual = Array.from({ length: 6 }, (_, i) => {
        const m = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
        const mesStr = m.toISOString().slice(0, 7)
        const ing = cuotas.filter(c => c.estado === 'pagada' && c.fecha_vencimiento?.startsWith(mesStr)).reduce((s, c) => s + (c.monto_pagado ?? c.monto_original ?? 0), 0)
        const egr = certs.filter(c => c.fecha?.startsWith(mesStr) && c.estado === 'pagado').reduce((s, c) => s + (c.monto_certificado ?? 0), 0)
        return { mes: m.toLocaleString('es-AR', { month: 'short' }), ingresos: Math.round(ing), egresos: Math.round(egr) }
      })

      const estadosPie = Object.entries(
        unids.reduce<Record<string, number>>((acc, u) => { acc[u.estado] = (acc[u.estado] ?? 0) + 1; return acc }, {})
      ).map(([estado, value]) => ({ estado, value }))

      setEmpData({ ...emp, unids, etapas, totalVendido, cobrado, costoObra, avance: Math.round(avance), rentProy, flujoMensual, estadosPie })
      setLoading(false)
    }

    load().catch(() => { setError('Error al cargar datos'); setLoading(false) })
  }, [token])

  if (loading) return (
    <div className="min-h-screen bg-[#0d1929] flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin" style={{ borderColor: '#c9a84c', borderTopColor: 'transparent' }} />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[#0d1929] flex items-center justify-center text-center p-8">
      <div>
        <Building2 size={48} className="mx-auto mb-4" style={{ color: '#c9a84c' }} />
        <p className="text-white text-xl font-bold mb-2">Acceso inválido</p>
        <p className="text-blue-300">{error}</p>
      </div>
    </div>
  )

  if (!empData) return null
  const emp = empData

  return (
    <div className="min-h-screen bg-[#0d1929] text-white">
      {/* Header */}
      <div className="bg-[#1a3a5c] border-b border-[#c9a84c]/20 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={20} style={{ color: '#c9a84c' }} />
              <span className="text-xs text-blue-300 uppercase tracking-wider">Panel del Inversor</span>
            </div>
            <h1 className="text-2xl font-bold">{String(emp.nombre ?? '')}</h1>
            <p className="text-blue-300 text-sm mt-0.5">{String(tokenInfo?.inversor_nombre ?? '')}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-400">Avance de obra</p>
            <p className="text-3xl font-bold" style={{ color: '#c9a84c' }}>{String(emp.avance ?? 0)}%</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total vendido', value: fmtUSD(emp.totalVendido as number), icon: Package, color: 'text-white' },
            { label: 'Total cobrado', value: fmtUSD(emp.cobrado as number), icon: DollarSign, color: 'text-green-400' },
            { label: 'Costo de obra', value: fmtARS(emp.costoObra as number), icon: TrendingUp, color: 'text-blue-300' },
            { label: 'Rentabilidad proyectada', value: `${String(emp.rentProy)}%`, icon: TrendingUp, color: '#c9a84c' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#1a3a5c]/60 border border-[#c9a84c]/10 rounded-xl p-4">
              <p className="text-xs text-blue-400 mb-1">{label}</p>
              <p className={cn('text-xl font-bold tabular-nums', typeof color === 'string' && color.startsWith('#') ? '' : color)}
                style={typeof color === 'string' && color.startsWith('#') ? { color } : {}}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Torta + Flujo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-[#1a3a5c]/60 border border-[#c9a84c]/10 rounded-xl p-4">
            <p className="text-xs text-blue-400 uppercase tracking-wider mb-3">Estado de unidades</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={(emp.estadosPie as {estado:string;value:number}[])} dataKey="value" nameKey="estado"
                  cx="50%" cy="50%" outerRadius={80} label={({ estado, value }) => `${estado}: ${value}`} labelLine={false}>
                  {(emp.estadosPie as {estado:string}[]).map((e, i) => (
                    <Cell key={i} fill={COLORES_ESTADO[e.estado as keyof typeof COLORES_ESTADO] ?? '#888'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#1a3a5c]/60 border border-[#c9a84c]/10 rounded-xl p-4">
            <p className="text-xs text-blue-400 uppercase tracking-wider mb-3">Flujo de fondos — últimos 6 meses</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={emp.flujoMensual as Record<string,unknown>[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f3a5c" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#93c5fd' }} />
                <YAxis tick={{ fontSize: 10, fill: '#93c5fd' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`]} />
                <Bar dataKey="ingresos" name="Ingresos" fill="#2d7a4f" radius={[3,3,0,0]} />
                <Bar dataKey="egresos"  name="Egresos"  fill="#c0392b" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cronograma */}
        <div className="bg-[#1a3a5c]/60 border border-[#c9a84c]/10 rounded-xl p-4">
          <p className="text-xs text-blue-400 uppercase tracking-wider mb-4">Cronograma de obra</p>
          <div className="space-y-3">
            {(emp.etapas as Record<string,unknown>[]).map(etapa => (
              <div key={String(etapa.id)}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-white">{String(etapa.nombre)}</span>
                  <span className="text-blue-300 text-xs">{String(etapa.avance_porcentaje ?? 0)}%</span>
                </div>
                <div className="h-2 bg-[#0d1929] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${etapa.avance_porcentaje ?? 0}%`,
                      background: etapa.estado === 'terminada' ? '#2d7a4f' : etapa.estado === 'con_retraso' ? '#c0392b' : '#c9a84c',
                    }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-center py-6 text-blue-500 text-xs">
        Civilmar ERP · Vista exclusiva para inversores · Información confidencial
      </div>
    </div>
  )
}
