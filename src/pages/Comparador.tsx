import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts'
import { Download, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { fmtUSD } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

interface EmpRow {
  id: string
  nombre: string
  estado: string
  avance: number
  total: number
  vendidas: number
  disponibles: number
  reservadas: number
  pctVendido: number
  ingresosCobrados: number
  costosAcumulados: number
  rentabilidadPct: number
  flujoCajaUlt: number[]
}

type ColKey = keyof EmpRow

const SEMAFORO = (val: number, umbrales: [number, number]) =>
  val >= umbrales[1] ? 'text-green-600' : val >= umbrales[0] ? 'text-amber-600' : 'text-red-500'

export default function Comparador() {
  const [data,    setData]    = useState<EmpRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortCol, setSortCol] = useState<ColKey>('nombre')
  const [sortAsc, setSortAsc] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: emps } = await supabase
        .from('emprendimientos')
        .select('id, nombre, estado')
        .in('estado', ['en_proyecto', 'en_obra', 'terminado'])
        .order('nombre')

      if (!emps?.length) { setData([]); return }

      const rows: EmpRow[] = await Promise.all(emps.map(async emp => {
        const [unidRes, etaRes, cuotasRes] = await Promise.all([
          supabase.from('unidades').select('id, estado, precio_lista_usd').eq('emprendimiento_id', emp.id),
          supabase.from('etapas_obra').select('avance_porcentaje, porcentaje_obra, presupuesto, costo_real').eq('emprendimiento_id', emp.id),
          supabase.from('cuotas')
            .select('monto_pagado, monto_original, estado, fecha_vencimiento, contrato:contrato_id(emprendimiento_id)')
            .order('fecha_vencimiento', { ascending: false })
            .limit(200),
        ])

        const unids = unidRes.data ?? []
        const etapas = etaRes.data ?? []

        const avance = etapas.reduce((s, e) => s + (e.avance_porcentaje * (e.porcentaje_obra ?? 0)) / 100, 0)
        const costosAcumulados = etapas.reduce((s, e) => s + (e.costo_real ?? 0), 0)

        const cuotasEmp = (cuotasRes.data ?? []).filter(c => {
          const contr = c.contrato as { emprendimiento_id?: string } | null
          return contr?.emprendimiento_id === emp.id
        })
        const ingresosCobrados = cuotasEmp
          .filter(c => c.estado === 'pagada')
          .reduce((s, c) => s + (c.monto_pagado ?? c.monto_original ?? 0), 0)

        // Flujo últimos 6 meses
        const now = new Date()
        const flujoCajaUlt = Array.from({ length: 6 }, (_, i) => {
          const m = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
          const mesStr = m.toISOString().slice(0, 7)
          return cuotasEmp
            .filter(c => c.estado === 'pagada' && c.fecha_vencimiento?.startsWith(mesStr))
            .reduce((s, c) => s + (c.monto_pagado ?? c.monto_original ?? 0), 0)
        })

        const total = unids.length
        const vendidas = unids.filter(u => u.estado === 'vendida' || u.estado === 'escriturada').length
        const disponibles = unids.filter(u => u.estado === 'disponible').length
        const reservadas = unids.filter(u => u.estado === 'reservada').length
        const pctVendido = total > 0 ? Math.round(vendidas / total * 100) : 0
        const rentabilidadPct = ingresosCobrados > 0 && costosAcumulados > 0
          ? Math.round((ingresosCobrados - costosAcumulados) / ingresosCobrados * 100)
          : 0

        return {
          id: emp.id, nombre: emp.nombre, estado: emp.estado,
          avance: Math.round(avance), total, vendidas, disponibles, reservadas,
          pctVendido, ingresosCobrados, costosAcumulados, rentabilidadPct,
          flujoCajaUlt,
        }
      }))

      setData(rows)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const va = a[sortCol], vb = b[sortCol]
      const cmp = typeof va === 'string' ? va.localeCompare(String(vb)) : Number(va) - Number(vb)
      return sortAsc ? cmp : -cmp
    })
  }, [data, sortCol, sortAsc])

  const toggleSort = (col: ColKey) => {
    if (sortCol === col) setSortAsc(v => !v)
    else { setSortCol(col); setSortAsc(false) }
  }

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(sorted.map(r => ({
      Emprendimiento: r.nombre, Estado: r.estado,
      'Avance %': r.avance, 'Total unidades': r.total,
      Vendidas: r.vendidas, Disponibles: r.disponibles,
      '% Vendido': r.pctVendido,
      'Ingresos cobrados': r.ingresosCobrados,
      'Costos acumulados': r.costosAcumulados,
      'Rentabilidad %': r.rentabilidadPct,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Comparativa')
    XLSX.writeFile(wb, `comparativa_emprendimientos.xlsx`)
  }

  const Th = ({ col, label, right }: { col: ColKey; label: string; right?: boolean }) => (
    <th onClick={() => toggleSort(col)}
      className={cn('px-4 py-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:text-primary select-none transition-colors',
        right ? 'text-right' : 'text-left',
        sortCol === col ? 'text-primary' : 'text-gray-500')}>
      {label} {sortCol === col ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  )

  const rentaData = sorted.map(r => ({ name: r.nombre.slice(0, 12), pct: r.rentabilidadPct }))

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Comparador de Emprendimientos"
        subtitle="Vista ejecutiva comparativa"
        actions={
          <div className="flex gap-2">
            <button onClick={load} className="text-gray-400 hover:text-primary"><RefreshCw size={15}/></button>
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 text-xs text-green-700 border border-green-200 hover:bg-green-50 px-3 py-1.5 rounded-lg">
              <Download size={12}/> Excel
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Gráfico rentabilidad */}
        {rentaData.length > 0 && (
          <div className="card">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Rentabilidad proyectada por emprendimiento (%)</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={rentaData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#a1a1aa' }} width={100} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Rentabilidad']} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]}
                  fill="#1a3a5c"
                  label={{ position: 'right', fontSize: 10, fill: '#6b7280', formatter: (v: number) => `${v}%` }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabla comparativa */}
        {loading ? (
          <div className="flex justify-center h-48 items-center">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr className="table-header">
                    <Th col="nombre"           label="Emprendimiento" />
                    <Th col="estado"           label="Estado" />
                    <Th col="avance"           label="Avance" right />
                    <Th col="total"            label="Total" right />
                    <Th col="vendidas"         label="Vendidas" right />
                    <Th col="disponibles"      label="Dispon." right />
                    <Th col="pctVendido"       label="% Vend." right />
                    <Th col="ingresosCobrados" label="Cobrado" right />
                    <Th col="costosAcumulados" label="Costos" right />
                    <Th col="rentabilidadPct"  label="Rent. %" right />
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 text-right">Flujo 6m</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map((r, i) => (
                    <tr key={r.id} className={cn(i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30', 'hover:bg-blue-50/30 transition-colors')}>
                      <td className="px-4 py-3 font-semibold text-gray-900">{r.nombre}</td>
                      <td className="px-4 py-3">
                        <span className={cn('badge text-[10px]',
                          r.estado === 'en_obra' ? 'badge-info' :
                          r.estado === 'terminado' ? 'badge-success' : 'badge-gray')}>
                          {r.estado.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={SEMAFORO(r.avance, [30, 70])}>{r.avance}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{r.total}</td>
                      <td className="px-4 py-3 text-right text-blue-600 font-semibold tabular-nums">{r.vendidas}</td>
                      <td className="px-4 py-3 text-right text-green-600 tabular-nums">{r.disponibles}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={SEMAFORO(r.pctVendido, [40, 70])}>{r.pctVendido}%</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-900">{fmtUSD(r.ingresosCobrados)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-500">{fmtUSD(r.costosAcumulados)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.rentabilidadPct >= 0
                            ? <TrendingUp size={12} className="text-green-500" />
                            : <TrendingDown size={12} className="text-red-500" />}
                          <span className={SEMAFORO(r.rentabilidadPct, [10, 25])}>{r.rentabilidadPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {/* Mini sparkline */}
                        {r.flujoCajaUlt.some(v => v > 0) ? (
                          <div className="inline-block w-20 h-6">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={r.flujoCajaUlt.map((v, idx) => ({ v, idx }))}>
                                <Line type="monotone" dataKey="v" stroke="#1a3a5c" strokeWidth={1.5} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
