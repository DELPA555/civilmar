import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/utils/cn'

const schema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type FormData = z.infer<typeof schema>

type Mode = 'login' | 'reset'

export default function Login() {
  const { signIn, user, loading } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const from       = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  const [mode,     setMode]     = useState<Mode>('login')
  const [showPass, setShowPass] = useState(false)
  const [authErr,  setAuthErr]  = useState<string | null>(null)
  const [resetOk,  setResetOk]  = useState(false)

  // Navigate when user is fully loaded (after signIn resolves AND profile is fetched)
  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true })
    }
  }, [user, loading, navigate, from])

  const { register, handleSubmit, formState: { errors, isSubmitting }, getValues } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onLogin = async (data: FormData) => {
    setAuthErr(null)
    try {
      // signIn now awaits the profile fetch internally before resolving
      await signIn(data.email, data.password)
      // navigation is handled by the useEffect above once user/loading update
    } catch (e) {
      setAuthErr(e instanceof Error ? e.message : 'Error de autenticación')
    }
  }

  const onReset = async () => {
    const email = getValues('email')
    if (!email) { setAuthErr('Ingresá tu email para recuperar la contraseña'); return }
    setAuthErr(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) setAuthErr(error.message)
    else setResetOk(true)
  }

  const fi = cn(
    'w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
    'bg-white text-gray-900 placeholder-gray-400'
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-[#0d1f33] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent shadow-lg mb-4">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Civilmar ERP</h1>
          <p className="text-white/50 text-sm mt-1">Sistema de gestión inmobiliaria</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {mode === 'login' ? 'Iniciar sesión' : 'Recuperar contraseña'}
          </h2>

          {/* Alerta de error */}
          {authErr && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {authErr}
            </div>
          )}

          {/* Éxito reset */}
          {resetOk && (
            <div className="flex items-start gap-2.5 p-3 bg-green-50 border border-green-200 rounded-xl mb-4 text-sm text-green-700">
              <CheckCircle size={16} className="shrink-0 mt-0.5" />
              Te enviamos un email con instrucciones para restablecer tu contraseña.
            </div>
          )}

          <form onSubmit={handleSubmit(onLogin)} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                className={cn(fi, errors.email && 'border-red-300 focus:ring-red-200 focus:border-red-400')}
                {...register('email')}
                autoFocus
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Contraseña (solo en login) */}
            {mode === 'login' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={cn(fi, 'pr-11', errors.password && 'border-red-300 focus:ring-red-200 focus:border-red-400')}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>
            )}

            {/* Botón principal */}
            {mode === 'login' ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold hover:bg-primary-light transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              >
                {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Ingresando...</> : 'Iniciar sesión'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onReset}
                disabled={isSubmitting}
                className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold hover:bg-primary-light transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              >
                {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Enviando...</> : 'Enviar email de recuperación'}
              </button>
            )}

          </form>

          {/* Toggle modo */}
          <div className="mt-5 text-center">
            {mode === 'login' ? (
              <button
                onClick={() => { setMode('reset'); setAuthErr(null); setResetOk(false) }}
                className="text-xs text-primary hover:text-primary-light transition-colors font-medium"
              >
                ¿Olvidaste tu contraseña?
              </button>
            ) : (
              <button
                onClick={() => { setMode('login'); setAuthErr(null); setResetOk(false) }}
                className="text-xs text-primary hover:text-primary-light transition-colors font-medium"
              >
                ← Volver al inicio de sesión
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          Civilmar ERP v0.1.0 · © 2026
        </p>
      </div>
    </div>
  )
}
