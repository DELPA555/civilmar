import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Calculator, Users, FileText,
  CreditCard, Truck, HardHat, UserCog, TrendingUp, Settings,
  BarChart3, LogOut, Package, CalendarDays,
  ShoppingCart, FileSignature, UserCog as UserAdmin, type LucideIcon,
} from 'lucide-react'
import { useAuth, puedeAcceder } from '@/context/AuthContext'
import { cn } from '@/utils/cn'

interface NavItem { to: string; label: string; icon: LucideIcon; modulo: string }

const GRUPOS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Principal',
    items: [
      { to: '/',          label: 'Dashboard', icon: LayoutDashboard, modulo: 'dashboard' },
      { to: '/simulador', label: 'Simulador',  icon: Calculator,     modulo: 'simulador' },
    ],
  },
  {
    label: 'Obras',
    items: [
      { to: '/emprendimientos', label: 'Emprendimientos', icon: Building2, modulo: 'emprendimientos' },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { to: '/clientes',  label: 'Clientes / CRM', icon: Users,    modulo: 'clientes' },
      { to: '/contratos', label: 'Contratos',       icon: FileText, modulo: 'contratos' },
      { to: '/cobros',    label: 'Cobros / Cuotas', icon: CreditCard, modulo: 'cobros' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { to: '/proveedores',   label: 'Proveedores',    icon: Truck,       modulo: 'proveedores' },
      { to: '/contratistas',  label: 'Contratistas',   icon: HardHat,     modulo: 'contratistas' },
      { to: '/profesionales', label: 'Profesionales',  icon: UserCog,     modulo: 'profesionales' },
      { to: '/indice-cac',    label: 'Índice CAC',     icon: TrendingUp,  modulo: 'indice-cac' },
      { to: '/licitaciones',  label: 'Licitaciones',   icon: ShoppingCart,modulo: 'licitaciones' },
    ],
  },
  {
    label: 'Obra',
    items: [
      { to: '/presupuesto-obra', label: 'Presupuesto APU', icon: Calculator,  modulo: 'presupuesto-obra' },
      { to: '/panol',            label: 'Pañol / Depósito',icon: Package,     modulo: 'panol' },
      { to: '/jornadas',         label: 'Jornadas',        icon: CalendarDays,modulo: 'jornadas' },
    ],
  },
  {
    label: 'Reportes',
    items: [
      { to: '/documentos',    label: 'Documentos',     icon: FileSignature, modulo: 'documentos' },
      { to: '/reportes',      label: 'Reportes',       icon: BarChart3,     modulo: 'reportes' },
      { to: '/usuarios',      label: 'Usuarios',       icon: UserAdmin,     modulo: 'usuarios' },
      { to: '/configuracion', label: 'Configuración',  icon: Settings,      modulo: 'configuracion' },
    ],
  },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const location  = useLocation()
  const navigate  = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const initiales = user
    ? `${user.nombre[0]}${user.apellido[0]}`.toUpperCase()
    : '?'

  return (
    <aside className="w-60 h-screen flex flex-col shrink-0 bg-sidebar-bg shadow-xl">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Building2 size={20} className="text-white" />
        </div>
        <div>
          <div className="text-white font-bold text-base tracking-tight leading-none">Civilmar</div>
          <div className="text-sidebar-text/50 text-[10px] tracking-widest uppercase mt-0.5">ERP Inmobiliario</div>
        </div>
      </div>

      {/* Nav — filtrado por rol */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
        {GRUPOS.map(grupo => {
          const visibles = grupo.items.filter(item =>
            !user || puedeAcceder(user.rol, item.modulo)
          )
          if (!visibles.length) return null
          return (
            <div key={grupo.label}>
              <p className="text-[10px] font-semibold text-sidebar-text/40 uppercase tracking-widest px-3 mb-1.5">
                {grupo.label}
              </p>
              <div className="space-y-0.5">
                {visibles.map(item => {
                  const isActive = item.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.to)
                  const Icon = item.icon
                  return (
                    <NavLink key={item.to} to={item.to}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        isActive
                          ? 'bg-accent text-white font-semibold'
                          : 'text-sidebar-text/80 hover:text-sidebar-text hover:bg-white/10'
                      )}>
                      <Icon size={16} className={isActive ? 'text-white' : ''} />
                      {item.label}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Usuario + logout */}
      <div className="px-4 py-4 border-t border-white/10 space-y-2">
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initiales}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sidebar-text text-xs font-medium truncate">{user.nombre} {user.apellido}</p>
              <p className="text-sidebar-text/40 text-[10px] capitalize">{user.rol}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sidebar-text/40 hover:text-red-400 transition-colors text-[11px] w-full"
        >
          <LogOut size={12} /> Cerrar sesión
        </button>
        <div className="text-sidebar-text/20 text-[10px]">v0.1.0 · Civilmar ERP</div>
      </div>
    </aside>
  )
}
