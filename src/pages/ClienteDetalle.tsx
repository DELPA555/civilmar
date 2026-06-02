import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowLeft, MessageCircle, Phone, Mail,
  User, Clock, FileText, CreditCard, Edit2, Plus, X,
  CheckCircle, AlertTriangle, Calendar,
  PhoneCall, MessageSquare, Users, Building2, Layers,
} from 'lucide-react'
import { useClienteDetalle, type Cliente, type Interaccion, type ContratoResumen, type CuotaResumen } from '@/hooks/useClientes'
import { fmt } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { CRM_CFG, waLink, nombreCompleto, Avatar } from './Clientes'
import { cn } from '@/utils/cn'

// ── Config de tipos de interacción ────────────────────────────────────────────

const INTER_CFG: Record<Interaccion['tipo'], { label: string; icon: typeof PhoneCall; cls: string }> = {
  llamada:     { label: 'Llamada',     icon: PhoneCall,     cls: 'bg-blue-100 text-blue-700' },
  whatsapp:    { label: 'WhatsApp',    icon: MessageSquare, cls: 'bg-green-100 text-green-700' },
  email:       { label: 'Email',       icon: Mail,          cls: 'bg-purple-100 text-purple-700' },
  reunion:     { label: 'Reunión',     icon: Users,         cls: 'bg-amber-100 text-amber-700' },
  visita_obra: { label: 'Visita obra', icon: Building2,     cls: 'bg-primary/10 text-primary' },
  otro:        { label: 'Otro',        icon: Layers,        cls: 'bg-gray-100 text-gray-600' },
}

const ESTADO_CUOTA: Record<string, { cls: string; label: string }> = {
  pendiente:    { cls: 'badge-info',    label: 'Pendiente' },
  pagada:       { cls: 'badge-success', label: 'Pagada' },
  vencida:      { cls: 'badge-danger',  label: 'Vencida' },
  refinanciada: { cls: 'badge-warning', label: 'Refinanciada' },
}

// ── Modal nueva interacción ───────────────────────────────────────────────────

function NuevaInteraccionModal({ clienteId, onClose, onSave }: { clienteId: string; onClose: () => void; onSave: (i: Omit<Interaccion, 'id' | 'created_at'>) => Promise<void> }) {
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState({ tipo: 'llamada' as Interaccion['tipo'], fecha: hoy, descripcion: '', resultado: '', proxima_accion: '', proxima_fecha: '' })
  const [saving, setSaving] = useState(false)
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Nueva interacción</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lb}>Tipo</label>
              <select className={fi} value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                {Object.entries(INTER_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lb}>Fecha</label>
              <input type="date" className={fi} value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={lb}>Descripción *</label>
            <textarea className={fi} rows={3} autoFocus placeholder="¿De qué se trató el contacto?"
              value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
          </div>
          <div>
            <label className={lb}>Resultado</label>
            <input className={fi} placeholder="¿Cómo terminó?" value={form.resultado} onChange={e => setForm(p => ({ ...p, resultado: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lb}>Próxima acción</label>
              <input className={fi} value={form.proxima_accion} onChange={e => setForm(p => ({ ...p, proxima_accion: e.target.value }))} />
            </div>
            <div>
              <label className={lb}>Fecha seguimiento</label>
              <input type="date" className={fi} value={form.proxima_fecha} onChange={e => setForm(p => ({ ...p, proxima_fecha: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button disabled={saving || !form.descripcion.trim()}
            onClick={async () => {
              setSaving(true)
              try { await onSave({ cliente_id: clienteId, ...form }); onClose() }
              catch (e) { alert(e instanceof Error ? e.message : 'Error') }
              finally { setSaving(false) }
            }}
            className="btn-primary disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Modal registrar pago ──────────────────────────────────────────────────────

function PagoModal({ cuotaId, monto, moneda, onClose, onPago }: {
  cuotaId: string; monto: number; moneda: 'USD' | 'ARS'; onClose: () => void
  onPago: (id: string, p: { fecha_pago: string; monto_pagado: number; medio_pago: string; numero_recibo?: string }) => Promise<void>
}) {
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState({ fecha: hoy, monto: String(monto), medio: 'transferencia', recibo: '', notas: '' })
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Registrar pago — cuota {cuotaId}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lb}>Fecha pago</label>
              <input type="date" className={fi} value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
            </div>
            <div>
              <label className={lb}>Monto {moneda}</label>
              <input type="number" className={fi} value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={lb}>Medio de pago</label>
            <select className={fi} value={form.medio} onChange={e => setForm(p => ({ ...p, medio: e.target.value }))}>
              <option value="transferencia">Transferencia bancaria</option>
              <option value="efectivo">Efectivo</option>
              <option value="cheque">Cheque</option>
              <option value="criptos">Criptomonedas</option>
            </select>
          </div>
          <div>
            <label className={lb}>N° recibo / comprobante</label>
            <input className={fi} placeholder="REC-000001" value={form.recibo} onChange={e => setForm(p => ({ ...p, recibo: e.target.value }))} />
          </div>
          <div>
            <label className={lb}>Notas (mora, descuento...)</label>
            <textarea className={fi} rows={2} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={async () => {
            try { await onPago(cuotaId, { fecha_pago: form.fecha, monto_pagado: Number(form.monto), medio_pago: form.medio, numero_recibo: form.recibo || undefined }); onClose() }
            catch (e) { alert(e instanceof Error ? e.message : 'Error') }
          }} className="btn-primary">
            Registrar pago
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TAB 1: Datos ──────────────────────────────────────────────────────────────

function TabDatos({ cliente }: { cliente: Cliente }) {
  const crm = CRM_CFG[cliente.estado_crm]
  const vendedorNombre = cliente.vendedor
    ? `${cliente.vendedor.nombre} ${cliente.vendedor.apellido}`
    : '—'
  const filas: [string, string][] = [
    ['DNI',          cliente.dni ?? '—'],
    ['CUIT',         cliente.cuit ?? '—'],
    ['Email',        cliente.email ?? '—'],
    ['Teléfono',     cliente.telefono ?? '—'],
    ['WhatsApp',     cliente.whatsapp ?? '—'],
    ['Dirección',    cliente.direccion ?? '—'],
    ['Localidad',    [cliente.localidad, cliente.provincia].filter(Boolean).join(', ') || '—'],
    ['Origen lead',  cliente.origen ?? '—'],
    ['Vendedor',     vendedorNombre],
    ['Alta',         format(new Date(cliente.created_at), 'dd/MM/yyyy', { locale: es })],
  ]
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Avatar card */}
      <div className="card flex flex-col items-center text-center py-6">
        <Avatar cliente={cliente} size="lg" />
        <h3 className="font-bold text-gray-900 text-lg mt-3">{nombreCompleto(cliente)}</h3>
        <p className="text-sm text-gray-400">{cliente.tipo === 'persona_juridica' ? 'Empresa' : 'Persona física'}</p>
        <span className={cn('badge mt-3 text-xs px-3 py-1', crm.cls)}>{crm.label}</span>
        <div className="mt-5 w-full space-y-2">
          {cliente.whatsapp && (
            <a href={waLink(cliente.whatsapp)} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
              <MessageCircle size={15} /> WhatsApp
            </a>
          )}
          {cliente.telefono && (
            <a href={`tel:${cliente.telefono}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
              <Phone size={14} /> Llamar
            </a>
          )}
          {cliente.email && (
            <a href={`mailto:${cliente.email}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
              <Mail size={14} /> Email
            </a>
          )}
        </div>
      </div>
      {/* Ficha */}
      <div className="lg:col-span-2 card">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-800">Ficha del cliente</h4>
          <button className="flex items-center gap-1.5 text-xs text-primary font-medium">
            <Edit2 size={12} /> Editar
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {filas.map(([lbl, val]) => (
            <div key={lbl} className="border-b border-gray-50 pb-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{lbl}</p>
              <p className="text-sm text-gray-800 mt-0.5">{val}</p>
            </div>
          ))}
        </div>
        {cliente.notas && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Notas</p>
            <p className="text-sm text-gray-700">{cliente.notas}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── TAB 2: Interacciones ──────────────────────────────────────────────────────

function TabInteracciones({ clienteId, lista, onAdd }: { clienteId: string; lista: Interaccion[]; onAdd: (i: Omit<Interaccion, 'id' | 'created_at'>) => Promise<void> }) {
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Nueva interacción
        </button>
      </div>
      {lista.length === 0 ? (
        <div className="card flex flex-col items-center py-12 text-gray-400">
          <MessageCircle size={36} className="mb-3 text-gray-200" />
          <p className="font-medium">Sin interacciones registradas</p>
          <p className="text-sm mt-1">Cargá el primer contacto con este cliente</p>
        </div>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-4">
            {lista.map(inter => {
              const cfg = INTER_CFG[inter.tipo]
              const Icon = cfg.icon
              return (
                <div key={inter.id} className="relative">
                  <div className={cn('absolute -left-5 w-5 h-5 rounded-full flex items-center justify-center', cfg.cls)}>
                    <Icon size={10} />
                  </div>
                  <div className="card ml-2">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('badge text-[10px]', cfg.cls)}>{cfg.label}</span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(inter.fecha), "dd 'de' MMMM yyyy", { locale: es })}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">{inter.usuario_id ?? ''}</span>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">{inter.descripcion}</p>
                    {inter.resultado && (
                      <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-500">
                        <CheckCircle size={11} className="text-green-500 mt-0.5 shrink-0" />
                        <span><strong>Resultado:</strong> {inter.resultado}</span>
                      </div>
                    )}
                    {inter.proxima_accion && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-1.5 text-xs text-blue-700">
                        <Calendar size={11} className="mt-0.5 shrink-0" />
                        <span>
                          <strong>Próximo paso:</strong> {inter.proxima_accion}
                          {inter.proxima_fecha && ` — ${format(new Date(inter.proxima_fecha), 'dd/MM/yyyy', { locale: es })}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {showNew && <NuevaInteraccionModal clienteId={clienteId} onClose={() => setShowNew(false)} onSave={onAdd} />}
    </div>
  )
}

// ── TAB 3: Contratos ──────────────────────────────────────────────────────────

function TabContratos({ contratos }: { contratos: ContratoResumen[] }) {
  const navigate = useNavigate()
  const estadoCls: Record<string, string> = {
    vigente: 'badge-info', borrador: 'badge-gray', cancelado: 'badge-danger', escriturado: 'badge-success',
  }

  if (!contratos.length) return (
    <div className="card flex flex-col items-center py-12 text-gray-400">
      <FileText size={36} className="mb-3 text-gray-200" />
      <p className="font-medium">Sin contratos registrados</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {contratos.map(c => {
        const pct = c.cuotas_total > 0 ? (c.cuotas_pagadas / c.cuotas_total) * 100 : 0
        return (
          <div key={c.id} onClick={() => navigate('/contratos')}
            className="card cursor-pointer hover:shadow-md hover:border-primary/20 transition-all">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-900">N° {c.numero}</span>
                  <span className={cn('badge text-[10px]', estadoCls[c.estado] ?? 'badge-gray')}>
                    {c.estado.charAt(0).toUpperCase() + c.estado.slice(1)}
                  </span>
                  <span className="badge badge-gray text-[10px]">{c.tipo}</span>
                </div>
                <p className="text-sm text-gray-600">
                  <strong>{c.emprendimiento}</strong> — Unidad <strong>{c.unidad}</strong>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Precio: {fmt(c.precio_total, c.moneda)} · Cuota: {fmt(c.cuota_t1, c.moneda)}/mes
                  {c.fecha_firma && ` · Firmado: ${format(new Date(c.fecha_firma), 'dd/MM/yyyy', { locale: es })}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-gray-700">{c.cuotas_pagadas}/{c.cuotas_total}</p>
                <div className="w-20 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{pct.toFixed(0)}% pagado</p>
              </div>
            </div>
            {c.proximo_vencimiento && c.estado === 'vigente' && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5">
                <Clock size={11} />
                Próx. vencimiento: {format(new Date(c.proximo_vencimiento), 'dd/MM/yyyy', { locale: es })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── TAB 4: Cuotas ─────────────────────────────────────────────────────────────

function TabCuotas({ cuotas, onPago }: { cuotas: CuotaResumen[]; onPago: (id: string, p: { fecha_pago: string; monto_pagado: number; medio_pago: string; numero_recibo?: string }) => Promise<void> }) {
  const [pagoModal, setPagoModal] = useState<{ id: string; monto: number; moneda: 'USD'|'ARS' } | null>(null)
  const moneda  = (cuotas[0]?.moneda ?? 'USD') as 'USD' | 'ARS'
  const fmtM    = (n: number) => fmt(n, moneda)

  const totalOrig = cuotas.reduce((s, c) => s + c.monto_original, 0)
  const totalPag  = cuotas.filter(c => c.estado === 'pagada').reduce((s, c) => s + (c.monto_pagado ?? c.monto_original), 0)
  const totalVenc = cuotas.filter(c => c.estado === 'vencida').reduce((s, c) => s + c.monto_original, 0)
  const proxima   = cuotas
    .filter(c => c.estado === 'pendiente')
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0]

  return (
    <div className="space-y-5">
      {/* Cards resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total cuotas',    value: fmtM(totalOrig),            cls: 'text-primary' },
          { label: 'Total pagado',    value: fmtM(totalPag),             cls: 'text-success' },
          { label: 'Vencido',         value: fmtM(totalVenc),            cls: totalVenc > 0 ? 'text-danger' : 'text-gray-400' },
          { label: 'Saldo pendiente', value: fmtM(totalOrig - totalPag), cls: 'text-amber-700' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className={cn('text-xl font-bold', s.cls)}>{s.value}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Próxima cuota */}
      {proxima && (
        <div className={cn('flex items-center gap-2 p-3 rounded-xl border text-sm',
          new Date(proxima.fecha_vencimiento) < new Date()
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-blue-50 border-blue-200 text-blue-700'
        )}>
          <Clock size={15} className="shrink-0" />
          <span>
            <strong>Próxima cuota N° {proxima.numero}:</strong>{' '}
            {fmtM(proxima.monto_original)} — vence el{' '}
            {format(new Date(proxima.fecha_vencimiento), "dd 'de' MMMM yyyy", { locale: es })}
            {' '}· {proxima.contrato_numero}
          </span>
        </div>
      )}

      {/* Tabla */}
      {!cuotas.length ? (
        <div className="card flex flex-col items-center py-12 text-gray-400">
          <CreditCard size={36} className="mb-3 text-gray-200" />
          <p className="font-medium">Sin cuotas cargadas</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Contrato</th>
                <th className="px-4 py-3 text-center">N°</th>
                <th className="px-4 py-3 text-left">Vencimiento</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-left">Pago</th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cuotas
                .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))
                .map((c, i) => {
                  const cfg = ESTADO_CUOTA[c.estado]
                  const venc = new Date(c.fecha_vencimiento)
                  const esVencida = c.estado === 'vencida' || (c.estado === 'pendiente' && venc < new Date())
                  return (
                    <tr key={c.id} className={cn(
                      i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40',
                      esVencida && 'bg-red-50/60'
                    )}>
                      <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{c.contrato_numero}</td>
                      <td className="px-4 py-2.5 text-center text-xs text-gray-500">{c.numero}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">
                        {format(venc, 'dd/MM/yyyy', { locale: es })}
                        {(c.mora_dias ?? 0) > 0 && (
                          <span className="ml-1 text-[10px] text-red-600 font-semibold">{c.mora_dias}d mora</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900 font-mono tabular-nums">
                        {fmtM(c.monto_original)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn('badge text-[10px]', cfg?.cls ?? 'badge-gray')}>
                          {cfg?.label ?? c.estado}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {c.fecha_pago
                          ? <span className="text-green-600">
                              {format(new Date(c.fecha_pago), 'dd/MM/yy', { locale: es })} · {fmtM(c.monto_pagado ?? c.monto_original)}
                            </span>
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {(c.estado === 'pendiente' || c.estado === 'vencida') && (
                          <button
                            onClick={() => setPagoModal({ id: c.id, monto: c.monto_original, moneda: c.moneda })}
                            className="text-xs text-white bg-primary hover:bg-primary-light px-3 py-1.5 rounded-lg font-medium transition-colors"
                          >
                            Registrar pago
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
      )}

      {pagoModal && (
        <PagoModal
          cuotaId={pagoModal.id}
          monto={pagoModal.monto}
          moneda={pagoModal.moneda}
          onClose={() => setPagoModal(null)}
          onPago={onPago}
        />
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'datos',         label: 'Datos',         icon: User },
  { id: 'interacciones', label: 'Interacciones',  icon: MessageCircle },
  { id: 'contratos',     label: 'Contratos',      icon: FileText },
  { id: 'cuotas',        label: 'Cuotas',         icon: CreditCard },
] as const

type TabId = typeof TABS[number]['id']

export default function ClienteDetalle() {
  const { id }      = useParams<{ id: string }>()
  const [tab, setTab] = useState<TabId>('datos')
  const { cliente, interacciones, contratos, cuotas, loading, addInteraccion, registrarPago } = useClienteDetalle(id)

  if (loading) return (
    <div className="flex flex-col h-full">
      <Header title="Cargando cliente..." />
      <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
    </div>
  )

  if (!cliente) return (
    <div className="flex flex-col h-full">
      <Header title="Cliente no encontrado" />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <User size={40} className="mx-auto mb-3 text-gray-200" />
          <p>No se encontró el cliente</p>
          <Link to="/clientes" className="text-primary text-sm hover:underline mt-2 block">
            ← Volver a clientes
          </Link>
        </div>
      </div>
    </div>
  )

  const crm            = CRM_CFG[cliente.estado_crm]
  const cuotasVencidas = cuotas.filter(c => c.estado === 'vencida').length
  const contratosN     = contratos.length
  const interaccionesN = interacciones.length

  return (
    <div className="flex flex-col h-full">
      <Header
        title={nombreCompleto(cliente)}
        subtitle={[cliente.localidad, crm.label].filter(Boolean).join(' · ')}
        actions={
          <div className="flex items-center gap-2">
            {cliente.whatsapp && (
              <a href={waLink(cliente.whatsapp)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
            <Link to="/clientes" className="btn-ghost flex items-center gap-1.5 text-sm">
              <ArrowLeft size={15} /> Volver
            </Link>
          </div>
        }
      />

      {/* Alerta cuotas vencidas */}
      {cuotasVencidas > 0 && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle size={14} className="shrink-0 text-red-500" />
          <span>
            Este cliente tiene <strong>{cuotasVencidas} cuota{cuotasVencidas !== 1 ? 's' : ''} vencida{cuotasVencidas !== 1 ? 's' : ''}</strong>
          </span>
          <button onClick={() => setTab('cuotas')}
            className="ml-auto text-xs text-red-600 underline font-medium">
            Ver cuotas →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="flex">
          {TABS.map(t => {
            const Icon   = t.icon
            const active = tab === t.id
            const badge  = t.id === 'contratos'     ? contratosN
                         : t.id === 'interacciones' ? interaccionesN
                         : t.id === 'cuotas' && cuotasVencidas > 0 ? cuotasVencidas
                         : 0
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  active ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
                )}>
                <Icon size={15} />
                {t.label}
                {badge > 0 && (
                  <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5',
                    t.id === 'cuotas' && cuotasVencidas > 0 ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'
                  )}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Contenido del tab */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'datos'         && <TabDatos cliente={cliente} />}
        {tab === 'interacciones' && <TabInteracciones clienteId={id!} lista={interacciones} onAdd={async(i)=>addInteraccion({...i,cliente_id:id!})} />}
        {tab === 'contratos'     && <TabContratos contratos={contratos} />}
        {tab === 'cuotas'        && <TabCuotas cuotas={cuotas} onPago={registrarPago} />}
      </div>
    </div>
  )
}
