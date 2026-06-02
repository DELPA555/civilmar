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

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Ruta pública */}
          <Route path="/login" element={<Login />} />

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

            <Route path="reportes" element={
              <ProtectedRoute modulo="reportes"><Reportes /></ProtectedRoute>
            } />

            <Route path="configuracion" element={
              <ProtectedRoute modulo="configuracion" roles={['admin', 'gerente']}>
                <Configuracion />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
