import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type Rol = 'admin' | 'gerente' | 'vendedor' | 'administrativo' | 'readonly'

export interface AuthUser {
  id: string
  email: string
  nombre: string
  apellido: string
  rol: Rol
  activo: boolean
}

interface AuthContextValue {
  user:    AuthUser | null
  session: Session | null
  loading: boolean
  signIn:  (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchPerfil(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, apellido, rol, activo, email')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return data as AuthUser
}

function fallbackUser(s: Session): AuthUser {
  // Used when perfiles row can't be read (e.g. RLS without SELECT policy)
  const email = s.user.email ?? ''
  const meta  = s.user.user_metadata ?? {}
  return {
    id:       s.user.id,
    email,
    nombre:   (meta.nombre as string) ?? (meta.full_name as string) ?? email.split('@')[0] ?? 'Usuario',
    apellido: (meta.apellido as string) ?? '',
    rol:      'admin',
    activo:   true,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // resolveSignIn: if a signIn() call is waiting, resolve it after loadUser completes
  const resolveSignIn = useRef<(() => void) | null>(null)

  const loadUser = useCallback(async (s: Session | null) => {
    setSession(s)
    if (!s) {
      setUser(null)
      setLoading(false)
      return
    }

    // Keep loading=true while fetching the profile so ProtectedRoute
    // shows a spinner instead of prematurely redirecting to /login
    setLoading(true)

    const perfil = await fetchPerfil(s.user.id)
    setUser(perfil ?? fallbackUser(s))
    setLoading(false)

    // Unblock any pending signIn() awaiter
    if (resolveSignIn.current) {
      resolveSignIn.current()
      resolveSignIn.current = null
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => loadUser(session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Token refresh — just update session silently, don't reload the profile
      if (event === 'TOKEN_REFRESHED') { setSession(session); return }
      loadUser(session)
    })

    return () => subscription.unsubscribe()
  }, [loadUser])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)

    // Wait for loadUser to finish so the caller can navigate safely
    await new Promise<void>(resolve => { resolveSignIn.current = resolve })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Permisos por rol
const PERMISOS: Record<Rol, string[]> = {
  admin:          ['*'],
  gerente:        ['dashboard','emprendimientos','simulador','clientes','contratos','cobros','proveedores','contratistas','profesionales','indice-cac','reportes','configuracion'],
  vendedor:       ['dashboard','simulador','emprendimientos','clientes','contratos'],
  administrativo: ['dashboard','cobros','proveedores','contratistas','profesionales','indice-cac','reportes'],
  readonly:       ['dashboard','emprendimientos','clientes','contratos','cobros','reportes'],
}

export function puedeAcceder(rol: Rol, modulo: string): boolean {
  const perms = PERMISOS[rol]
  return perms.includes('*') || perms.includes(modulo)
}
