import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, AlertCircle, Info, Bell, CheckCircle,
  ChevronRight, RefreshCw,
} from 'lucide-react'
import { useAlertas, type Alerta, type NivelAlerta } from '@/hooks/useAlertas'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

const NIVEL_CFG: Record<NivelAlerta, { label: string; icon: typeof AlertTriangle; cls: string; badgeCls: string; border: string }> = {
  critico:  { label: 'Crítico',  icon: AlertCircle,   cls: 'text-red-400',    badgeCls: 'bg-red-500/10 text-red-400 border-red-500/30',       border: 'border-l-4 border-red-500/60' },
  urgente:  { label: 'Urgente',  icon: AlertTriangle, cls: 'text-orange-400', badgeCls: 'bg-orange-500/10 text-orange-400 border-orange-500/30', border: 'border-l-4 border-orange-500/60' },
  atencion: { label: 'Atención', icon: Bell,          cls: 'text-amber-400',  badgeCls: 'bg-amber-500/10 text-amber-400 border-amber-500/30',  border: 'border-l-4 border-amber-500/60' },
  info:     { label: 'Info',     icon: Info,          cls: 'text-blue-400',   badgeCls: 'bg-blue-500/10 text-blue-400 border-blue-500/30',     border: 'border-l-4 border-blue-500/60' },
}

// ── Widget resumido para Dashboard ────────────────────────────────────────────
export function AlertasWidget() {
  const navigate = useNavigate()
  const { loading, contadores } = useAlertas()
  const total = Object.values(contadores).reduce((s, v) => s + v, 0)
  if (loading || total === 0) return null
  return (
    <div className="card cursor-pointer hover:shadow-md hover:border-primary/20 transition-all"
      onClick={() => navigate('/alertas')}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-red-400" />
          <p className="font-semibold text-gray-800 text-sm">Centro de alertas</p>
        </div>
        <span className="badge bg-red-100 text-red-700 text-[10px]">{total} activas</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(Object.entries(contadores) as [NivelAlerta, number][]).map(([nivel, qty]) => {
          if (qty === 0) return null
          const cfg = NIVEL_CFG[nivel]
          return (
            <div key={nivel} className={cn('rounded-lg p-2 text-center border', cfg.badgeCls)}>
              <p className="text-lg font-bold tabular-nums">{qty}</p>
              <p className="text-[9px] uppercase tracking-wide">{cfg.label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Alertas() {
  const navigate = useNavigate()
  const { alertas, loading, reload, contadores } = useAlertas()
  const [filtroNivel, setFiltroNivel] = useState<NivelAlerta | 'todos'>('todos')
  const [gestionadas, setGestionadas] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    return alertas.filter(a => {
      if (gestionadas.has(a.id)) return false
      if (filtroNivel !== 'todos' && a.nivel !== filtroNivel) return false
      return true
    })
  }, [alertas, filtroNivel, gestionadas])

  const marcarGestionada = (id: string) => {
    setGestionadas(prev => new Set([...prev, id]))
  }

  const total = Object.values(contadores).reduce((s, v) => s + v, 0) - gestionadas.size

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Centro de Alertas"
        subtitle={`${total} alertas activas`}
        actions={
          <button onClick={reload} className="text-gray-400 hover:text-primary transition-colors">
            <RefreshCw size={15} />
          </button>
        }
      />

      {/* Resumen por nivel */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 flex-wrap">
        <button onClick={() => setFiltroNivel('todos')}
          className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            filtroNivel === 'todos' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50')}>
          Todas ({total})
        </button>
        {(Object.entries(NIVEL_CFG) as [NivelAlerta, typeof NIVEL_CFG.critico][]).map(([nivel, cfg]) => {
          const count = alertas.filter(a => a.nivel === nivel && !gestionadas.has(a.id)).length
          if (count === 0) return null
          return (
            <button key={nivel} onClick={() => setFiltroNivel(nivel)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                filtroNivel === nivel ? cfg.badgeCls : 'border-transparent text-gray-500 hover:bg-gray-50')}>
              <cfg.icon size={13} />
              {cfg.label} ({count})
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <CheckCircle size={40} className="mb-3 text-green-400" />
            <p className="font-semibold text-gray-600">Sin alertas activas</p>
            <p className="text-sm mt-1">Todo está bajo control</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(Object.entries(NIVEL_CFG) as [NivelAlerta, typeof NIVEL_CFG.critico][]).map(([nivel, cfg]) => {
              const items = filtered.filter(a => a.nivel === nivel)
              if (items.length === 0) return null
              const Icon = cfg.icon
              return (
                <div key={nivel}>
                  <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
                    <Icon size={14} className={cfg.cls} />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{cfg.label} — {items.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map(alerta => (
                      <AlertaCard
                        key={alerta.id}
                        alerta={alerta}
                        cfg={cfg}
                        onGestionar={() => marcarGestionada(alerta.id)}
                        onNavigate={path => path && navigate(path)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function AlertaCard({ alerta, cfg, onGestionar, onNavigate }: {
  alerta: Alerta
  cfg: typeof NIVEL_CFG.critico
  onGestionar: () => void
  onNavigate: (path: string | undefined) => void
}) {
  const Icon = cfg.icon
  return (
    <div className={cn('card py-3 px-4 flex items-center gap-3 transition-all', cfg.border)}>
      <Icon size={16} className={cn(cfg.cls, 'shrink-0')} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm">{alerta.titulo}</p>
        <p className="text-xs text-gray-500 mt-0.5">{alerta.descripcion}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {alerta.referencia_path && (
          <button onClick={() => onNavigate(alerta.referencia_path)}
            className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
            Ver <ChevronRight size={12} />
          </button>
        )}
        <button onClick={onGestionar}
          className="text-xs text-gray-400 hover:text-green-600 transition-colors px-2 py-1 rounded hover:bg-green-50">
          ✓ Gestionar
        </button>
      </div>
    </div>
  )
}
