import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MessageCircle, RefreshCw, CheckCircle, X, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useClientes } from '@/hooks/useClientes'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

interface NotifLog {
  id: string; cliente_id?: string; tipo: string; mensaje: string
  telefono?: string; estado: string; fecha_envio?: string; created_at: string
  cliente?: { nombre: string; apellido?: string } | null
}

interface NotifConfig {
  id: string; tipo: string; activo: boolean; plantilla: string; dias_anticipacion: number
}

const TIPO_LABELS: Record<string, string> = {
  vencimiento_5dias:  '5 días antes de vencimiento',
  vencimiento_hoy:    'Día del vencimiento',
  pago_confirmado:    'Confirmación de pago',
  actualizacion_cac:  'Actualización CAC',
  avance_obra:        'Avance de obra mensual',
  manual:             'Mensaje manual',
}

const ESTADO_CFG: Record<string, { cls: string; icon: typeof CheckCircle }> = {
  enviado:   { cls: 'badge-success', icon: CheckCircle },
  pendiente: { cls: 'badge-warning',  icon: RefreshCw },
  fallido:   { cls: 'badge-danger',  icon: AlertCircle },
  cancelado: { cls: 'badge-gray',    icon: X },
}

// ── Construir URL de WhatsApp ──────────────────────────────────────────────────
function buildWaUrl(phone: string, mensaje: string): string {
  const clean = phone.replace(/\D/g, '')
  const num = clean.startsWith('54') ? clean : `54${clean.startsWith('0') ? clean.slice(1) : clean}`
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`
}

function reemplazarVariables(plantilla: string, vars: Record<string, string>): string {
  return plantilla.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

export default function Notificaciones() {
  const [tab,    setTab]    = useState<'historial'|'config'|'envio'>('historial')
  const [logs,   setLogs]   = useState<NotifLog[]>([])
  const [config, setConfig] = useState<NotifConfig[]>([])
  const [loading, setLoading] = useState(true)

  // Envío manual
  const { data: clientes } = useClientes()
  const [selCliente, setSelCliente] = useState('')
  const [selTipo,    setSelTipo]    = useState('manual')
  const [mensajeM,   setMensajeM]   = useState('')
  const [enviando,   setEnviando]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [logsRes, cfgRes] = await Promise.all([
      supabase.from('notificaciones_log')
        .select('*, cliente:cliente_id(nombre, apellido)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('notificaciones_config').select('*').order('tipo'),
    ])
    setLogs((logsRes.data ?? []) as NotifLog[])
    setConfig(cfgRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggleActivo = async (cfg: NotifConfig) => {
    await supabase.from('notificaciones_config').update({ activo: !cfg.activo }).eq('id', cfg.id)
    await load()
  }

  const updatePlantilla = async (id: string, plantilla: string) => {
    await supabase.from('notificaciones_config').update({ plantilla }).eq('id', id)
    await load()
  }

  const enviarManual = async () => {
    if (!selCliente || !mensajeM.trim()) return
    setEnviando(true)
    const cliente = clientes.find(c => c.id === selCliente)
    const phone = cliente?.whatsapp || cliente?.telefono || ''
    try {
      await supabase.from('notificaciones_log').insert({
        cliente_id: selCliente, tipo: selTipo, mensaje: mensajeM,
        telefono: phone, estado: phone ? 'enviado' : 'pendiente',
        fecha_envio: new Date().toISOString(),
      })
      if (phone) {
        window.open(buildWaUrl(phone, mensajeM), '_blank', 'noopener,noreferrer')
      }
      setMensajeM(''); setSelCliente('')
      await load()
    } finally { setEnviando(false) }
  }

  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'

  return (
    <div className="flex flex-col h-full">
      <Header title="Notificaciones WhatsApp" subtitle="Mensajes automáticos y manuales a clientes" />

      <div className="bg-white border-b border-gray-100 px-6">
        <div className="flex gap-0">
          {[
            { id: 'historial', label: 'Historial' },
            { id: 'config',    label: 'Plantillas' },
            { id: 'envio',     label: 'Envío manual' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              className={cn('px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              {t.label}
            </button>
          ))}
          <button onClick={load} className="ml-auto my-2 text-gray-400 hover:text-primary px-2"><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* ── HISTORIAL ─────────────────────────────────── */}
        {tab === 'historial' && (
          loading ? <div className="flex justify-center h-48 items-center"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> : (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead><tr className="table-header">
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Mensaje</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log, i) => {
                    const est = ESTADO_CFG[log.estado] ?? ESTADO_CFG.pendiente
                    const EstIcon = est.icon
                    const cli = log.cliente as Record<string, string> | null
                    return (
                      <tr key={log.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                        <td className="px-4 py-2.5 font-medium text-gray-800">
                          {cli ? `${cli.apellido ?? ''}, ${cli.nombre}`.replace(/^,\s*/,'') : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{TIPO_LABELS[log.tipo] ?? log.tipo}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 max-w-xs truncate" title={log.mensaje}>{log.mensaje}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn('badge text-[10px] flex items-center gap-1 w-fit mx-auto', est.cls)}>
                            <EstIcon size={9} /> {log.estado}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">
                          {log.fecha_envio ? format(new Date(log.fecha_envio), 'dd/MM/yy HH:mm', { locale: es }) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Sin mensajes enviados</td></tr>}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── PLANTILLAS ────────────────────────────────── */}
        {tab === 'config' && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
              <strong>Variables disponibles:</strong> {'{{nombre}}'}, {'{{numero_cuota}}'}, {'{{emprendimiento}}'}, {'{{fecha}}'}, {'{{monto}}'}, {'{{portal_link}}'}, {'{{numero_recibo}}'}, {'{{porcentaje}}'}
            </div>
            {config.map(cfg => (
              <div key={cfg.id} className="card space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-800 text-sm">{TIPO_LABELS[cfg.tipo] ?? cfg.tipo}</p>
                  <button onClick={() => toggleActivo(cfg)}
                    className={cn('relative w-10 h-5 rounded-full transition-colors shrink-0', cfg.activo ? 'bg-primary' : 'bg-gray-300')}>
                    <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', cfg.activo ? 'translate-x-5' : 'translate-x-0.5')} />
                  </button>
                </div>
                <textarea
                  className={cn(fi, 'text-xs h-20 resize-none', !cfg.activo && 'opacity-50')}
                  value={cfg.plantilla}
                  disabled={!cfg.activo}
                  onChange={e => setConfig(prev => prev.map(c => c.id === cfg.id ? { ...c, plantilla: e.target.value } : c))}
                  onBlur={e => updatePlantilla(cfg.id, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── ENVÍO MANUAL ──────────────────────────────── */}
        {tab === 'envio' && (
          <div className="max-w-lg space-y-4">
            <div><label className={lb}>Cliente</label>
              <select className={fi} value={selCliente} onChange={e => setSelCliente(e.target.value)}>
                <option value="">— Seleccioná un cliente —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}</option>)}
              </select>
            </div>
            <div><label className={lb}>Tipo de mensaje</label>
              <select className={fi} value={selTipo} onChange={e => {
                setSelTipo(e.target.value)
                const tmpl = config.find(c => c.tipo === e.target.value)
                if (tmpl && selCliente) {
                  const cli = clientes.find(c => c.id === selCliente)
                  const vars = { nombre: cli?.nombre ?? '', emprendimiento: 'la obra' }
                  setMensajeM(reemplazarVariables(tmpl.plantilla, vars))
                }
              }}>
                {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className={lb}>Mensaje *</label>
              <textarea className={cn(fi, 'h-28 resize-none')} value={mensajeM}
                onChange={e => setMensajeM(e.target.value)}
                placeholder="Escribí el mensaje que se enviará por WhatsApp..." />
              <p className="text-[10px] text-gray-400 mt-1">{mensajeM.length} caracteres</p>
            </div>
            {selCliente && (() => {
              const cli = clientes.find(c => c.id === selCliente)
              const phone = cli?.whatsapp || cli?.telefono
              return (
                <div className={cn('p-3 rounded-lg border text-xs', phone ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700')}>
                  {phone ? `📱 Teléfono: ${phone}` : '⚠ Este cliente no tiene teléfono/WhatsApp cargado. El mensaje se guardará como pendiente.'}
                </div>
              )
            })()}
            <button onClick={enviarManual} disabled={enviando || !selCliente || !mensajeM.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50">
              <MessageCircle size={16} />
              {enviando ? 'Enviando...' : 'Enviar por WhatsApp'}
            </button>
            <p className="text-xs text-gray-400 text-center">
              Se abrirá WhatsApp Web con el mensaje prellenado. El envío queda registrado en el historial.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
