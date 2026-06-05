import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import ProtectedRoute from '@/components/shared/ProtectedRoute'
import Layout from '@/components/layout/Layout'
import Login             from '@/pages/Login'
import Dashboard         from '@/pages/Dashboard'
import Emprendimientos   from '@/pages/Emprendimientos'
import EmprendimientoDetalle from '@/pages/EmprendimientoDetalle'
import Simulador         from '@/pages/Simulador'
import Clientes          from '@/pages/Clientes'
import ClienteDetalle    from '@/pages/ClienteDetalle'
import Contratos         from '@/pages/Contratos'
import ContratoNuevo     from '@/pages/ContratoNuevo'
import ContratoDetalle   from '@/pages/ContratoDetalle'
import Cobros            from '@/pages/Cobros'
import Proveedores       from '@/pages/Proveedores'
import ProveedorDetalle  from '@/pages/ProveedorDetalle'
import Contratistas      from '@/pages/Contratistas'
import ContratistaDetalle from '@/pages/ContratistaDetalle'
import Profesionales     from '@/pages/Profesionales'
import IndiceCAC         from '@/pages/IndiceCAC'
import Reportes          from '@/pages/Reportes'
import Configuracion     from '@/pages/Configuracion'
import Documentos        from '@/pages/Documentos'
import PresupuestoObra   from '@/pages/PresupuestoObra'
import Panol             from '@/pages/Panol'
import Jornadas          from '@/pages/Jornadas'
import Licitaciones           from '@/pages/Licitaciones'
import Usuarios               from '@/pages/Usuarios'
import Alertas                from '@/pages/Alertas'
import Comparador             from '@/pages/Comparador'
import DocumentacionLegal     from '@/pages/DocumentacionLegal'
import Notificaciones         from '@/pages/Notificaciones'
import InversorDashboard      from '@/pages/InversorDashboard'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/inversores/:token" element={<InversorDashboard />} />

          {/* Rutas protegidas — requieren auth */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />

            <Route path="emprendimientos" element={
              <ProtectedRoute modulo="emprendimientos"><Emprendimientos /></ProtectedRoute>
            } />
            <Route path="emprendimientos/:id" element={
              <ProtectedRoute modulo="emprendimientos"><EmprendimientoDetalle /></ProtectedRoute>
            } />

            <Route path="simulador" element={
              <ProtectedRoute modulo="simulador"><Simulador /></ProtectedRoute>
            } />

            <Route path="clientes" element={
              <ProtectedRoute modulo="clientes"><Clientes /></ProtectedRoute>
            } />
            <Route path="clientes/:id" element={
              <ProtectedRoute modulo="clientes"><ClienteDetalle /></ProtectedRoute>
            } />

            <Route path="contratos" element={
              <ProtectedRoute modulo="contratos"><Contratos /></ProtectedRoute>
            } />
            <Route path="contratos/nuevo" element={
              <ProtectedRoute modulo="contratos"><ContratoNuevo /></ProtectedRoute>
            } />
            <Route path="contratos/:id" element={
              <ProtectedRoute modulo="contratos"><ContratoDetalle /></ProtectedRoute>
            } />

            <Route path="cobros" element={
              <ProtectedRoute modulo="cobros"><Cobros /></ProtectedRoute>
            } />

            <Route path="proveedores" element={
              <ProtectedRoute modulo="proveedores"><Proveedores /></ProtectedRoute>
            } />
            <Route path="proveedores/:id" element={
              <ProtectedRoute modulo="proveedores"><ProveedorDetalle /></ProtectedRoute>
            } />

            <Route path="contratistas" element={
              <ProtectedRoute modulo="contratistas"><Contratistas /></ProtectedRoute>
            } />
            <Route path="contratistas/:id" element={
              <ProtectedRoute modulo="contratistas"><ContratistaDetalle /></ProtectedRoute>
            } />

            <Route path="profesionales" element={
              <ProtectedRoute modulo="profesionales"><Profesionales /></ProtectedRoute>
            } />

            <Route path="indice-cac" element={
              <ProtectedRoute modulo="indice-cac"><IndiceCAC /></ProtectedRoute>
            } />

            <Route path="documentos" element={
              <ProtectedRoute modulo="documentos"><Documentos /></ProtectedRoute>
            } />
            <Route path="presupuesto-obra" element={
              <ProtectedRoute modulo="presupuesto-obra"><PresupuestoObra /></ProtectedRoute>
            } />
            <Route path="panol" element={
              <ProtectedRoute modulo="panol"><Panol /></ProtectedRoute>
            } />
            <Route path="jornadas" element={
              <ProtectedRoute modulo="jornadas"><Jornadas /></ProtectedRoute>
            } />
            <Route path="licitaciones" element={
              <ProtectedRoute modulo="licitaciones"><Licitaciones /></ProtectedRoute>
            } />

            <Route path="reportes" element={
              <ProtectedRoute modulo="reportes"><Reportes /></ProtectedRoute>
            } />

            <Route path="alertas" element={
              <ProtectedRoute modulo="alertas"><Alertas /></ProtectedRoute>
            } />
            <Route path="comparador" element={
              <ProtectedRoute modulo="comparador" roles={['admin','gerente']}><Comparador /></ProtectedRoute>
            } />
            <Route path="documentacion-legal" element={
              <ProtectedRoute modulo="documentacion-legal"><DocumentacionLegal /></ProtectedRoute>
            } />
            <Route path="notificaciones" element={
              <ProtectedRoute modulo="notificaciones"><Notificaciones /></ProtectedRoute>
            } />

            <Route path="configuracion" element={
              <ProtectedRoute modulo="configuracion" roles={['admin', 'gerente']}>
                <Configuracion />
              </ProtectedRoute>
            } />
            <Route path="usuarios" element={
              <ProtectedRoute modulo="usuarios" roles={['admin']}>
                <Usuarios />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
