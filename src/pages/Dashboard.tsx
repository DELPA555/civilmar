import { Building2, Home, CreditCard, AlertTriangle, RefreshCw, type LucideIcon } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { fmtUSD, fmtARS } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { useDashboard } from '@/hooks'
import { cn } from '@/utils/cn'

const UNIDAD_COLORES = {
  disponibles:  '#2d7a4f',
  vendidas:     '#2d5a8e',
  reservadas:   '#b8860b',
  escrituradas: '#6b7280',
}

function KpiCard({ icon: Icon, label, value, sub, color, bg }: {
  icon: LucideIcon
  label: string; value: string; sub?: string; color: string; bg: string
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', bg)}>
        <Icon size={20} className={color} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function Dashboard() {
  const { stats, flujo, vencidas, loading, error, reload } = useDashboard()

  if (loading) return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" subtitle="Resumen ejecutivo" />
      <Spinner />
    </div>
  )

  if (error || !stats) return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" subtitle="Error al cargar" actions={
        <button onClick={reload} className="btn-ghost flex items-center gap-1.5 text-sm"><RefreshCw size={14} /> Reintentar</button>
      } />
      <div className="flex-1 flex items-center justify-center text-red-400">
        <p>{error ?? 'Sin datos'}</p>
      </div>
    </div>
  )

  const { unidades, cobros, contratos } = stats

  const donutData = [
    { name: 'Disponibles', value: unidades.disponibles,  color: UNIDAD_COLORES.disponibles },
    { name: 'Vendidas',    value: unidades.vendidas,     color: UNIDAD_COLORES.vendidas },
    { name: 'Reservadas',  value: unidades.reservadas,   color: UNIDAD_COLORES.reservadas },
    { name: 'Escrituradas',value: unidades.escrituradas, color: UNIDAD_COLORES.escrituradas },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle={`Resumen ejecutivo — ${format(new Date(), 'MMMM yyyy', { locale: es })}`}
        actions={
          <button onClick={reload} className="btn-ghost flex items-center gap-1.5 text-xs">
            <RefreshCw size={13} /> Actualizar
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Home}  label="Disponibles"    value={String(unidades.disponibles)} sub={`de ${unidades.total} totales`} color="text-success" bg="bg-green-50" />
          <KpiCard icon={Building2} label="Vendidas/Escrituradas" value={`${unidades.vendidas}/${unidades.escrituradas}`} sub={`${contratos.vigentes} contratos vigentes`} color="text-blue-600" bg="bg-blue-50" />
          <KpiCard icon={CreditCard} label="Cobrado este mes" value={fmtUSD(cobros.cobradoMesUSD)} sub={fmtARS(cobros.cobradoMesARS)} color="text-accent" bg="bg-amber-50" />
          <KpiCard icon={AlertTriangle} label="Cuotas vencidas" value={String(cobros.vencidasQty)} sub={fmtUSD(cobros.vencidasUSD) + ' pendiente'} color="text-danger" bg="bg-red-50" />
        </div>

        {/* Gráficos fila 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card lg:col-span-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Flujo de caja — Proyectado vs Cobrado (U$D miles)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={flujo} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `${v}k`} />
                <Tooltip formatter={(v: number) => [`${v}k U$D`]} />
                <Bar dataKey="proyectado" name="Proyectado" fill="#e2e8f0" radius={[4,4,0,0]} />
                <Bar dataKey="cobrado"    name="Cobrado"    fill="#1a3a5c" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Estado de unidades</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {donutData.map(e => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {donutData.map(e => (
                <div key={e.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.color }} />
                  {e.name}: <span className="font-semibold">{e.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cuotas vencidas */}
        {vencidas.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cuotas vencidas — Urgente</p>
              <a href="/cobros" className="text-xs text-primary-light hover:underline font-medium">Ver todas →</a>
            </div>
            <div className="space-y-2">
              {vencidas.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 hover:bg-red-50 transition-colors">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', c.dias > 60 ? 'bg-danger' : c.dias > 30 ? 'bg-warning' : 'bg-yellow-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.cliente}</p>
                    <p className="text-xs text-gray-500">Unidad {c.unidad}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-800">{c.moneda === 'USD' ? fmtUSD(c.monto) : fmtARS(c.monto)}</p>
                    <span className={cn('badge text-[10px]', c.dias > 60 ? 'badge-danger' : 'badge-warning')}>{c.dias}d</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Avance de obras */}
        <div className="card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Avance de obras activas</p>
          <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0 text-white font-bold text-lg">
              {stats.avance}%
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Avance promedio ponderado</p>
              <p className="text-xs text-gray-500">Calculado sobre etapas de todas las obras en curso</p>
            </div>
            <div className="flex-1">
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', stats.avance >= 70 ? 'bg-success' : stats.avance >= 40 ? 'bg-accent' : 'bg-primary')}
                  style={{ width: `${stats.avance}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
