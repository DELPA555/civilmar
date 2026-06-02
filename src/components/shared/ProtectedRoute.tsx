import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, puedeAcceder } from '@/context/AuthContext'

interface Props {
  children: React.ReactNode
  /** módulo requerido (coincide con el path sin /) — si se omite solo verifica auth */
  modulo?: string
  /** roles explícitos que pueden acceder */
  roles?: string[]
}

export default function ProtectedRoute({ children, modulo, roles }: Props) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  if (!user.activo) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="card max-w-sm text-center p-8">
          <p className="font-bold text-gray-800 mb-2">Cuenta desactivada</p>
          <p className="text-sm text-gray-500">Tu cuenta fue desactivada. Contactá al administrador.</p>
        </div>
      </div>
    )
  }

  if (roles && !roles.includes(user.rol)) {
    return <Navigate to="/" replace />
  }

  if (modulo && !puedeAcceder(user.rol, modulo)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
