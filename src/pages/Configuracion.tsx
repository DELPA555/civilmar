import { useState } from 'react'
import { Building2, Users, FileText, Sliders, Save, Plus, Trash2, Edit2, Eye, EyeOff } from 'lucide-react'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

const TABS = [
  { id: 'empresa',    label: 'Empresa',    icon: Building2 },
  { id: 'usuarios',   label: 'Usuarios',   icon: Users },
  { id: 'plantillas', label: 'Plantillas', icon: FileText },
  { id: 'parametros', label: 'Parámetros', icon: Sliders },
] as const
type TabId = typeof TABS[number]['id']

const ROLE_CFG: Record<string, { cls: string; label: string; permisos: string[] }> = {
  admin:         { cls: 'badge-danger',   label: 'Admin',         permisos: ['Todo'] },
  gerente:       { cls: 'bg-purple-100 text-purple-800', label: 'Gerente', permisos: ['Ver todo', 'Editar contratos', 'Aprobar pagos', 'Reportes'] },
  vendedor:      { cls: 'badge-info',     label: 'Vendedor',      permisos: ['Clientes', 'Simulador', 'Contratos (solo lectura)', 'Emprendimientos'] },
  administrativo:{ cls: 'badge-warning',  label: 'Administrativo',permisos: ['Cobros', 'Proveedores', 'Reportes', 'CAC'] },
  readonly:      { cls: 'badge-gray',     label: 'Solo lectura',  permisos: ['Ver (sin editar)'] },
}

const USUARIOS_MOCK = [
  { id: '1', nombre: 'Admin',         email: 'admin@civilmar.com',   rol: 'admin',         activo: true,  ultimo_acceso: '2026-06-01' },
  { id: '2', nombre: 'Lucía Herrera', email: 'lucia@civilmar.com',   rol: 'vendedor',      activo: true,  ultimo_acceso: '2026-06-01' },
  { id: '3', nombre: 'Carlos Méndez', email: 'carlos@civilmar.com',  rol: 'vendedor',      activo: true,  ultimo_acceso: '2026-05-31' },
  { id: '4', nombre: 'Ana Rodríguez', email: 'ana@civilmar.com',     rol: 'administrativo',activo: true,  ultimo_acceso: '2026-05-30' },
  { id: '5', nombre: 'Vista General', email: 'reportes@civilmar.com',rol: 'readonly',      activo: false, ultimo_acceso: '2026-03-15' },
]

const PLANTILLAS_MOCK = [
  { id: 'p1', nombre: 'Boleto de compraventa', variables: ['{{nombre_cliente}}', '{{dni_cliente}}', '{{emprendimiento}}', '{{unidad}}', '{{precio_total}}', '{{cuota_tramo1}}', '{{fecha_firma}}'], descripcion: 'Plantilla estándar para boletos' },
  { id: 'p2', nombre: 'Reserva de unidad',     variables: ['{{nombre_cliente}}', '{{emprendimiento}}', '{{unidad}}', '{{monto_reserva}}', '{{fecha}}'], descripcion: 'Acuerdo de reserva' },
  { id: 'p3', nombre: 'Recibo de cobro',       variables: ['{{nombre_cliente}}', '{{numero_cuota}}', '{{monto}}', '{{fecha_pago}}', '{{numero_recibo}}'], descripcion: 'Recibo de pago de cuota' },
  { id: 'p4', nombre: 'Estado de cuenta',      variables: ['{{nombre_cliente}}', '{{contratos}}', '{{total_adeudado}}', '{{fecha}}'], descripcion: 'Resumen financiero del cliente' },
]

// ── Tabs ──────────────────────────────────────────────────────────────────────

function TabEmpresa() {
  const [form, setForm] = useState({
    nombre: 'Civilmar SA', cuit: '30-12345678-9', direccion: 'Av. Luro 2800 5°A',
    localidad: 'Mar del Plata', provincia: 'Buenos Aires', telefono: '223-123-4567',
    email: 'info@civilmar.com', web: 'www.civilmar.com',
    moneda_default: 'USD', iva_condicion: 'Responsable Inscripto',
  })
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'
  const F = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card space-y-4">
        <h4 className="font-semibold text-gray-800">Datos de la empresa</h4>
        <div><label className={lb}>Razón social *</label><input className={fi} value={form.nombre} onChange={e => F('nombre', e.target.value)} /></div>
        <div><label className={lb}>CUIT *</label><input className={fi} value={form.cuit} onChange={e => F('cuit', e.target.value)} /></div>
        <div><label className={lb}>Dirección</label><input className={fi} value={form.direccion} onChange={e => F('direccion', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lb}>Localidad</label><input className={fi} value={form.localidad} onChange={e => F('localidad', e.target.value)} /></div>
          <div><label className={lb}>Provincia</label><input className={fi} value={form.provincia} onChange={e => F('provincia', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lb}>Teléfono</label><input className={fi} value={form.telefono} onChange={e => F('telefono', e.target.value)} /></div>
          <div><label className={lb}>Email</label><input type="email" className={fi} value={form.email} onChange={e => F('email', e.target.value)} /></div>
        </div>
        <div><label className={lb}>Sitio web</label><input className={fi} value={form.web} onChange={e => F('web', e.target.value)} /></div>
      </div>
      <div className="card space-y-4">
        <h4 className="font-semibold text-gray-800">Configuración fiscal y comercial</h4>
        <div><label className={lb}>Condición IVA</label>
          <select className={fi} value={form.iva_condicion} onChange={e => F('iva_condicion', e.target.value)}>
            <option>Responsable Inscripto</option><option>Monotributo</option><option>Exento</option>
          </select>
        </div>
        <div><label className={lb}>Moneda por defecto</label>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 h-10">
            {(['USD', 'ARS'] as const).map(m => (
              <button key={m} type="button" onClick={() => F('moneda_default', m)}
                className={cn('flex-1 text-sm font-semibold transition-colors', form.moneda_default === m ? 'bg-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}>
                {m === 'USD' ? 'U$D (dólares)' : '$ ARS (pesos)'}
              </button>
            ))}
          </div>
        </div>
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer">
          <p className="text-sm text-gray-500 mb-2">Logo de la empresa</p>
          <button className="btn-primary text-sm px-4">Subir logo</button>
          <p className="text-xs text-gray-400 mt-2">PNG o SVG, máx. 2 MB</p>
        </div>
        <button onClick={() => alert('Guardado')} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
          <Save size={15} /> Guardar cambios
        </button>
      </div>
    </div>
  )
}

function TabUsuarios() {
  const [showPass, setShowPass] = useState<string | null>(null)
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-2 text-sm"><Plus size={15} /> Nuevo usuario</button>
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead><tr className="table-header">
            <th className="px-4 py-3 text-left">Usuario</th>
            <th className="px-4 py-3 text-left">Email</th>
            <th className="px-4 py-3 text-center">Rol</th>
            <th className="px-4 py-3 text-center">Permisos</th>
            <th className="px-4 py-3 text-center">Estado</th>
            <th className="px-4 py-3 text-left">Último acceso</th>
            <th className="px-4 py-3 text-right w-24">Acciones</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {USUARIOS_MOCK.map((u, i) => {
              const rcfg = ROLE_CFG[u.rol]
              return (
                <tr key={u.id} className={cn(i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30', !u.activo && 'opacity-60')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {u.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="font-medium text-gray-800">{u.nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{u.email}</td>
                  <td className="px-4 py-3 text-center"><span className={cn('badge text-[10px]', rcfg.cls)}>{rcfg.label}</span></td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setShowPass(showPass === u.id ? null : u.id)} className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto">
                      {showPass === u.id ? <EyeOff size={11} /> : <Eye size={11} />}
                      {showPass === u.id ? 'Ocultar' : 'Ver'}
                    </button>
                    {showPass === u.id && (
                      <div className="mt-1 text-[10px] text-gray-500 text-left max-w-[160px]">
                        {rcfg.permisos.join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('badge text-[10px]', u.activo ? 'badge-success' : 'badge-gray')}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{u.ultimo_acceso}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded transition-colors"><Edit2 size={13} /></button>
                      {u.rol !== 'admin' && <button className="p-1.5 text-gray-400 hover:text-danger hover:bg-red-50 rounded transition-colors"><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h4 className="font-semibold text-gray-800 text-sm mb-3">Permisos por rol</h4>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(ROLE_CFG).map(([rol, cfg]) => (
            <div key={rol} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <span className={cn('badge text-[10px] mb-2 inline-block', cfg.cls)}>{cfg.label}</span>
              <ul className="space-y-0.5">
                {cfg.permisos.map(p => <li key={p} className="text-[10px] text-gray-500 flex items-center gap-1.5">· {p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TabPlantillas() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-2 text-sm"><Plus size={15} /> Nueva plantilla</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PLANTILLAS_MOCK.map(p => (
          <div key={p.id} className="card hover:shadow-md hover:border-primary/20 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">{p.nombre}</h4>
                <p className="text-xs text-gray-400 mt-0.5">{p.descripcion}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded transition-colors"><Edit2 size={13} /></button>
                <button className="p-1.5 text-gray-400 hover:text-danger hover:bg-red-50 rounded transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Variables disponibles</p>
              <div className="flex flex-wrap gap-1">
                {p.variables.map(v => (
                  <span key={v} className="badge bg-primary/10 text-primary text-[9px] font-mono">{v}</span>
                ))}
              </div>
            </div>
            <button className="mt-3 w-full text-xs text-primary border border-primary/20 rounded-lg py-1.5 hover:bg-primary/5 transition-colors font-medium">
              Editar plantilla
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function TabParametros() {
  const [params, setParams] = useState({
    tasa_comision: '2', tasa_mora: '1.5', dias_gracia_mora: '5',
    porcentaje_retencion: '5', dias_reserva: '15',
    moneda_default: 'USD', tipo_cambio_referencia: '1280',
    cac_auto_update: false, notif_vencimientos: true, dias_alerta_vencimiento: '7',
  })
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'
  const F = (k: string, v: string | boolean) => setParams(p => ({ ...p, [k]: v }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card space-y-4">
        <h4 className="font-semibold text-gray-800">Parámetros financieros</h4>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lb}>Tasa comisión vendedor (%)</label><input type="number" className={fi} value={params.tasa_comision} onChange={e => F('tasa_comision', e.target.value)} /></div>
          <div><label className={lb}>Tasa de mora mensual (%)</label><input type="number" className={fi} value={params.tasa_mora} onChange={e => F('tasa_mora', e.target.value)} /></div>
          <div><label className={lb}>Días de gracia mora</label><input type="number" className={fi} value={params.dias_gracia_mora} onChange={e => F('dias_gracia_mora', e.target.value)} /></div>
          <div><label className={lb}>Retención contratistas (%)</label><input type="number" className={fi} value={params.porcentaje_retencion} onChange={e => F('porcentaje_retencion', e.target.value)} /></div>
          <div><label className={lb}>Días validez reserva</label><input type="number" className={fi} value={params.dias_reserva} onChange={e => F('dias_reserva', e.target.value)} /></div>
          <div><label className={lb}>Tipo de cambio ref. (ARS/USD)</label><input type="number" className={fi} value={params.tipo_cambio_referencia} onChange={e => F('tipo_cambio_referencia', e.target.value)} /></div>
        </div>
      </div>
      <div className="card space-y-4">
        <h4 className="font-semibold text-gray-800">Automatizaciones y notificaciones</h4>
        {[
          { key: 'cac_auto_update', label: 'Actualizar cuotas CAC automáticamente al cargar índice', desc: 'Aplica la variación a todas las cuotas ARS pendientes' },
          { key: 'notif_vencimientos', label: 'Alertas de vencimientos próximos', desc: 'Notificación interna cuando una cuota está por vencer' },
        ].map(opt => (
          <label key={opt.key} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer hover:bg-primary/5 hover:border-primary/20 transition-colors">
            <input type="checkbox" className="mt-0.5 accent-primary w-4 h-4"
              checked={params[opt.key as keyof typeof params] as boolean}
              onChange={e => F(opt.key, e.target.checked)} />
            <div>
              <p className="text-sm font-medium text-gray-800">{opt.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</p>
            </div>
          </label>
        ))}
        <div><label className={lb}>Días de anticipación para alerta vencimiento</label><input type="number" className={fi} value={params.dias_alerta_vencimiento} onChange={e => F('dias_alerta_vencimiento', e.target.value)} /></div>
        <button onClick={() => alert('Parámetros guardados')} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
          <Save size={15} /> Guardar parámetros
        </button>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function Configuracion() {
  const [tab, setTab] = useState<TabId>('empresa')
  return (
    <div className="flex flex-col h-full">
      <Header title="Configuración" subtitle="Datos de empresa, usuarios, plantillas y parámetros" />
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="flex">
          {TABS.map(t => { const Icon = t.icon; return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors', tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              <Icon size={15} />{t.label}
            </button>
          )})}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {tab === 'empresa'    && <TabEmpresa />}
        {tab === 'usuarios'   && <TabUsuarios />}
        {tab === 'plantillas' && <TabPlantillas />}
        {tab === 'parametros' && <TabParametros />}
      </div>
    </div>
  )
}
