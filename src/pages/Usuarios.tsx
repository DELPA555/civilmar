import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Plus, X, Edit2, CheckCircle, XCircle, RefreshCw,
  Shield, Eye, EyeOff, User,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { adminClient } from '@/lib/adminClient'
import { useAuth, type Rol } from '@/context/AuthContext'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PerfilCompleto {
  id: string
  nombre: string
  apellido: string
  email: string
  rol: Rol
  activo: boolean
  created_at: string
  ultimo_acceso?: string   // viene de auth.users.last_sign_in_at
}

const ROL_CFG: Record<Rol, { label: string; cls: string; desc: string }> = {
  admin:         { label: 'Admin',          cls: 'badge-danger',  desc: 'Acceso total al sistema' },
  gerente:       { label: 'Gerente',        cls: 'bg-purple-100 text-purple-800', desc: 'Ve todo, edita contratos y aprueba pagos' },
  vendedor:      { label: 'Vendedor',       cls: 'badge-info',    desc: 'Clientes, simulador, contratos' },
  administrativo:{ label: 'Administrativo', cls: 'badge-warning', desc: 'Cobros, proveedores, reportes' },
  readonly:      { label: 'Solo lectura',   cls: 'badge-gray',    desc: 'Visualización sin edición' },
}

// ── Modal crear usuario ───────────────────────────────────────────────────────

function NuevoUsuarioModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    email: '', password: '', nombre: '', apellido: '', rol: 'vendedor' as Rol,
  })
  const [showPass, setShowPass] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'

  const crear = async () => {
    if (!form.email || !form.password || !form.nombre || !form.apellido) {
      setError('Completá todos los campos obligatorios'); return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres'); return
    }
    if (!adminClient) {
      setError('Service role key no configurada. Agregá VITE_SUPABASE_SERVICE_KEY al .env'); return
    }
    setSaving(true); setError(null)
    try {
      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
        email:          form.email,
        password:       form.password,
        email_confirm:  true,
        user_metadata:  { nombre: form.nombre, apellido: form.apellido },
      })
      if (authErr) throw new Error(authErr.message)
      if (!authData.user) throw new Error('No se pudo crear el usuario')

      // 2. Insertar perfil en la tabla perfiles
      const { error: perfilErr } = await supabase.from('perfiles').insert({
        id:       authData.user.id,
        nombre:   form.nombre,
        apellido: form.apellido,
        email:    form.email,
        rol:      form.rol,
        activo:   true,
      })
      if (perfilErr) {
        // Rollback: eliminar el usuario de Auth si falla la inserción del perfil
        await adminClient.auth.admin.deleteUser(authData.user.id)
        throw new Error(`Error al crear perfil: ${perfilErr.message}`)
      }

      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Nuevo usuario</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Nombre *</label><input className={fi} autoFocus value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div><label className={lb}>Apellido *</label><input className={fi} value={form.apellido} onChange={e => setForm(p => ({ ...p, apellido: e.target.value }))} /></div>
          </div>
          <div><label className={lb}>Email *</label><input type="email" className={fi} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div>
            <label className={lb}>Contraseña * (mínimo 8 caracteres)</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} className={cn(fi, 'pr-10')}
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className={lb}>Rol *</label>
            <select className={fi} value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value as Rol }))}>
              {(Object.entries(ROL_CFG) as [Rol, typeof ROL_CFG.admin][]).map(([rol, cfg]) => (
                <option key={rol} value={rol}>{cfg.label} — {cfg.desc}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={crear} disabled={saving}
            className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {saving ? 'Creando...' : <><Plus size={15} /> Crear usuario</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal editar usuario ──────────────────────────────────────────────────────

function EditarUsuarioModal({ usuario, onClose, onSaved }: {
  usuario: PerfilCompleto
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    nombre:   usuario.nombre,
    apellido: usuario.apellido,
    rol:      usuario.rol,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'

  const guardar = async () => {
    setSaving(true); setError(null)
    try {
      const { error: err } = await supabase.from('perfiles')
        .update({ nombre: form.nombre, apellido: form.apellido, rol: form.rol })
        .eq('id', usuario.id)
      if (err) throw new Error(err.message)
      onSaved(); onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Editar usuario</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm text-gray-600">
            <span className="font-medium">Email:</span> {usuario.email}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Nombre</label><input className={fi} value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div><label className={lb}>Apellido</label><input className={fi} value={form.apellido} onChange={e => setForm(p => ({ ...p, apellido: e.target.value }))} /></div>
          </div>
          <div>
            <label className={lb}>Rol</label>
            <select className={fi} value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value as Rol }))}>
              {(Object.entries(ROL_CFG) as [Rol, typeof ROL_CFG.admin][]).map(([rol, cfg]) => (
                <option key={rol} value={rol}>{cfg.label} — {cfg.desc}</option>
              ))}
            </select>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
            <Shield size={12} className="inline mr-1" />
            El cambio de rol tiene efecto inmediato en el próximo inicio de sesión.
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={guardar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Usuarios() {
  const { user: yo } = useAuth()
  const [usuarios,    setUsuarios]    = useState<PerfilCompleto[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showNew,     setShowNew]     = useState(false)
  const [editando,    setEditando]    = useState<PerfilCompleto | null>(null)
  const [accionando,  setAccionando]  = useState<string | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // Leer perfiles
      const { data: perfiles, error: pErr } = await supabase
        .from('perfiles').select('*').order('apellido').order('nombre')
      if (pErr) throw new Error(pErr.message)

      // Leer last_sign_in_at desde Auth Admin (si service key disponible)
      let lastSignIn: Record<string, string> = {}
      if (adminClient) {
        const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
        if (authUsers?.users) {
          authUsers.users.forEach(u => {
            if (u.last_sign_in_at) lastSignIn[u.id] = u.last_sign_in_at
          })
        }
      }

      setUsuarios((perfiles ?? []).map(p => ({
        ...p,
        ultimo_acceso: lastSignIn[p.id],
      })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const toggleActivo = async (u: PerfilCompleto) => {
    setAccionando(u.id)
    try {
      const { error: err } = await supabase.from('perfiles')
        .update({ activo: !u.activo }).eq('id', u.id)
      if (err) throw new Error(err.message)

      // Sincronizar con Supabase Auth (ban/unban)
      if (adminClient) {
        await adminClient.auth.admin.updateUserById(u.id, {
          ban_duration: u.activo ? '87600h' : 'none',
        })
      }
      await cargar()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setAccionando(null)
    }
  }

  const resetPassword = async (u: PerfilCompleto) => {
    if (!confirm(`¿Enviár email de recuperación a ${u.email}?`)) return
    const { error: err } = await supabase.auth.resetPasswordForEmail(u.email, {
      redirectTo: `${window.location.origin}/#/reset-password`,
    })
    if (err) alert(err.message)
    else alert(`Email de recuperación enviado a ${u.email}`)
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Gestión de usuarios"
        subtitle={`${usuarios.length} usuario${usuarios.length !== 1 ? 's' : ''} registrados`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={cargar} className="text-gray-400 hover:text-primary transition-colors">
              <RefreshCw size={15} />
            </button>
            <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Nuevo usuario
            </button>
          </div>
        }
      />

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {!adminClient && (
        <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-start gap-2">
          <Shield size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong>Service key no configurada.</strong> Para crear usuarios y ver último acceso, agregá{' '}
            <code className="bg-amber-100 px-1 rounded">VITE_SUPABASE_SERVICE_KEY</code> al archivo <code>.env</code>.
            Podés igual editar roles y activar/desactivar usuarios existentes.
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-center">Rol</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-left">Último acceso</th>
                  <th className="px-4 py-3 text-left">Alta</th>
                  <th className="px-4 py-3 text-right w-40">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {usuarios.map((u, i) => {
                  const rolCfg = ROL_CFG[u.rol] ?? ROL_CFG.readonly
                  const esYo   = u.id === yo?.id
                  return (
                    <tr key={u.id} className={cn(
                      i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30',
                      !u.activo && 'opacity-60'
                    )}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                            {u.nombre[0]}{u.apellido[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{u.nombre} {u.apellido}</p>
                            {esYo && <span className="text-[9px] text-primary font-bold uppercase tracking-wide">Vos</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{u.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('badge text-[10px]', rolCfg.cls)}>{rolCfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('badge text-[10px]', u.activo ? 'badge-success' : 'badge-danger')}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {u.ultimo_acceso
                          ? format(new Date(u.ultimo_acceso), "dd/MM/yy 'a las' HH:mm", { locale: es })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {format(new Date(u.created_at), 'dd/MM/yyyy', { locale: es })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Editar */}
                          <button
                            onClick={() => setEditando(u)}
                            title="Editar rol y datos"
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">
                            <Edit2 size={13} />
                          </button>

                          {/* Activar/Desactivar */}
                          {!esYo && (
                            <button
                              onClick={() => toggleActivo(u)}
                              disabled={accionando === u.id}
                              title={u.activo ? 'Desactivar usuario' : 'Activar usuario'}
                              className={cn('p-1.5 rounded-lg transition-colors',
                                u.activo
                                  ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                  : 'text-gray-400 hover:text-green-600 hover:bg-green-50',
                                accionando === u.id && 'opacity-50 cursor-not-allowed')}>
                              {u.activo ? <XCircle size={13} /> : <CheckCircle size={13} />}
                            </button>
                          )}

                          {/* Reset contraseña */}
                          <button
                            onClick={() => resetPassword(u)}
                            title="Enviar email de recuperación"
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                            <User size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {usuarios.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      <User size={32} className="mx-auto mb-3 text-gray-200" />
                      <p>Sin usuarios registrados</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Resumen de roles */}
        <div className="mt-5 card">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Permisos por rol</p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {(Object.entries(ROL_CFG) as [Rol, typeof ROL_CFG.admin][]).map(([rol, cfg]) => {
              const count = usuarios.filter(u => u.rol === rol && u.activo).length
              return (
                <div key={rol} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                  <span className={cn('badge text-[10px] mb-1 inline-block', cfg.cls)}>{cfg.label}</span>
                  <p className="text-lg font-bold text-gray-900">{count}</p>
                  <p className="text-[10px] text-gray-400">{cfg.desc.slice(0, 30)}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {showNew && (
        <NuevoUsuarioModal
          onClose={() => setShowNew(false)}
          onCreated={cargar}
        />
      )}
      {editando && (
        <EditarUsuarioModal
          usuario={editando}
          onClose={() => setEditando(null)}
          onSaved={cargar}
        />
      )}
    </div>
  )
}
