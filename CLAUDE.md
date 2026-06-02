# ERP Civilmar — Instrucciones para Claude Code

## Descripción del Proyecto

Sistema ERP completo para desarrolladoras inmobiliarias que venden en pozo.
Stack: React 18 + TypeScript + Vite + Tailwind CSS + Shadcn/UI + Supabase (PostgreSQL) + React Router v6.

El modelo de negocio es muy específico:
- Venta de unidades en pozo con dos tramos de pago
- **Tramo 1 (durante obra):** cuota FIJA — en USD o en ARS con ajuste CAC mensual
- **Tramo 2 (post-obra):** saldo financiado a más meses con interés incorporado al precio
- El interés no es explícito: está incorporado en el precio de lista

---

## Stack Tecnológico

```
Frontend:   React 18 + TypeScript + Vite
UI:         Tailwind CSS + Shadcn/UI + Lucide React icons
Routing:    React Router v6
State:      Zustand
Forms:      React Hook Form + Zod
Tables:     TanStack Table v8
Charts:     Recharts
DB/Auth:    Supabase (PostgreSQL + Row Level Security)
PDF:        React-PDF o jsPDF
Excel:      SheetJS (xlsx)
Dates:      date-fns
Currency:   Numeral.js
```

---

## Estructura de Carpetas

```
civilmar/
├── public/
├── src/
│   ├── components/
│   │   ├── ui/              # Shadcn components
│   │   ├── layout/          # Sidebar, Header, Layout wrapper
│   │   ├── shared/          # DataTable, Modal, FormField, CurrencyInput
│   │   └── modules/         # Un folder por módulo
│   ├── pages/               # Una página por módulo
│   ├── hooks/               # useObras, useClientes, usePagos, etc.
│   ├── stores/              # Zustand stores
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── cac.ts           # Motor de indexación CAC
│   │   ├── simulador.ts     # Motor de simulación de cuotas
│   │   └── currency.ts      # Formateo USD/ARS
│   ├── types/               # TypeScript interfaces
│   └── utils/
├── supabase/
│   ├── migrations/          # SQL de base de datos
│   └── seed.sql             # Datos de ejemplo
├── CLAUDE.md
└── package.json
```

---

## Base de Datos — Supabase PostgreSQL

### Crear estas tablas en orden (respetar foreign keys):

```sql
-- =============================================
-- 1. EMPRESAS / CONFIGURACIÓN
-- =============================================
CREATE TABLE empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  cuit TEXT,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  logo_url TEXT,
  moneda_default TEXT DEFAULT 'USD' CHECK (moneda_default IN ('USD', 'ARS')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. USUARIOS Y ROLES
-- =============================================
CREATE TABLE perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  email TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'gerente', 'vendedor', 'administrativo', 'readonly')),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. EMPRENDIMIENTOS / PROYECTOS
-- =============================================
CREATE TABLE emprendimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  direccion TEXT,
  localidad TEXT DEFAULT 'Mar del Plata',
  provincia TEXT DEFAULT 'Buenos Aires',
  tipo TEXT CHECK (tipo IN ('edificio', 'countries', 'loteo', 'duplex', 'otro')),
  estado TEXT DEFAULT 'en_obra' CHECK (estado IN ('en_proyecto', 'en_obra', 'terminado', 'entregado')),
  fecha_inicio DATE,
  fecha_fin_estimada DATE,
  fecha_fin_real DATE,
  meses_obra INTEGER DEFAULT 24,
  total_unidades INTEGER DEFAULT 0,
  imagen_url TEXT,
  plano_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. UNIDADES / LOTES
-- =============================================
CREATE TABLE unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emprendimiento_id UUID NOT NULL REFERENCES emprendimientos(id) ON DELETE CASCADE,
  identificador TEXT NOT NULL,       -- ej: "2B", "Lote 15", "PH 1"
  tipo TEXT CHECK (tipo IN ('departamento', 'lote', 'casa', 'local', 'cochera', 'otro')),
  planta INTEGER,
  metros_cubiertos NUMERIC(10,2),
  metros_semicubiertos NUMERIC(10,2),
  metros_totales NUMERIC(10,2),
  ambientes INTEGER,
  orientacion TEXT,
  descripcion TEXT,
  estado TEXT DEFAULT 'disponible' CHECK (estado IN ('disponible', 'reservada', 'vendida', 'escriturada', 'no_disponible')),
  precio_lista_usd NUMERIC(12,2),
  precio_lista_ars NUMERIC(16,2),
  moneda_venta TEXT DEFAULT 'USD' CHECK (moneda_venta IN ('USD', 'ARS')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(emprendimiento_id, identificador)
);

-- =============================================
-- 5. CLIENTES / CRM
-- =============================================
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT DEFAULT 'persona_fisica' CHECK (tipo IN ('persona_fisica', 'persona_juridica')),
  nombre TEXT NOT NULL,
  apellido TEXT,
  razon_social TEXT,
  dni TEXT,
  cuit TEXT,
  email TEXT,
  telefono TEXT,
  whatsapp TEXT,
  direccion TEXT,
  localidad TEXT,
  provincia TEXT,
  pais TEXT DEFAULT 'Argentina',
  estado_crm TEXT DEFAULT 'interesado' CHECK (estado_crm IN ('interesado', 'prospecto', 'reservado', 'comprador', 'escriturado', 'inactivo')),
  origen TEXT,                        -- ej: referido, portal, redes, etc.
  notas TEXT,
  vendedor_id UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. INTERACCIONES CRM
-- =============================================
CREATE TABLE interacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo TEXT CHECK (tipo IN ('llamada', 'whatsapp', 'email', 'reunion', 'visita_obra', 'otro')),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  descripcion TEXT NOT NULL,
  resultado TEXT,
  proxima_accion TEXT,
  proxima_fecha DATE,
  usuario_id UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. CONTRATOS / OPERACIONES
-- =============================================
CREATE TABLE contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,        -- ej: "2024-001"
  emprendimiento_id UUID NOT NULL REFERENCES emprendimientos(id),
  unidad_id UUID NOT NULL REFERENCES unidades(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  vendedor_id UUID REFERENCES perfiles(id),
  tipo TEXT DEFAULT 'boleto' CHECK (tipo IN ('reserva', 'boleto', 'escritura', 'cesion')),
  estado TEXT DEFAULT 'vigente' CHECK (estado IN ('borrador', 'vigente', 'cancelado', 'rescindido', 'escriturado')),
  moneda TEXT NOT NULL CHECK (moneda IN ('USD', 'ARS')),
  
  -- Precio y estructura de pago
  precio_total NUMERIC(16,2) NOT NULL,
  sena_monto NUMERIC(16,2) DEFAULT 0,
  sena_fecha DATE,
  
  -- Tramo 1: Durante la obra (cuota fija)
  tramo1_meses INTEGER NOT NULL,      -- normalmente 24 (duración de obra)
  tramo1_cuota NUMERIC(16,2) NOT NULL,
  tramo1_inicio DATE NOT NULL,
  tramo1_con_cac BOOLEAN DEFAULT FALSE, -- solo si es en ARS
  
  -- Tramo 2: Post-obra (financiado)
  tramo2_meses INTEGER DEFAULT 0,     -- 0 si paga todo durante la obra
  tramo2_cuota NUMERIC(16,2) DEFAULT 0,
  tramo2_inicio DATE,
  tramo2_tasa_anual NUMERIC(6,4) DEFAULT 0, -- interés anual ya incorporado al precio
  
  -- Totales calculados
  total_tramo1 NUMERIC(16,2),
  total_tramo2 NUMERIC(16,2),
  total_con_sena NUMERIC(16,2),
  
  fecha_firma DATE,
  fecha_escritura_estimada DATE,
  fecha_escritura_real DATE,
  notas TEXT,
  documento_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. PLAN DE CUOTAS (tabla detalle)
-- =============================================
CREATE TABLE cuotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  numero_cuota INTEGER NOT NULL,
  tramo TEXT NOT NULL CHECK (tramo IN ('sena', 'tramo1', 'tramo2')),
  fecha_vencimiento DATE NOT NULL,
  monto_original NUMERIC(16,2) NOT NULL,
  monto_actualizado NUMERIC(16,2),    -- después de aplicar CAC
  indice_cac_aplicado NUMERIC(10,4),  -- valor del CAC cuando se actualizó
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada', 'vencida', 'refinanciada')),
  fecha_pago DATE,
  monto_pagado NUMERIC(16,2),
  medio_pago TEXT,                    -- transferencia, efectivo, cheque
  numero_recibo TEXT,
  mora_dias INTEGER DEFAULT 0,
  mora_monto NUMERIC(16,2) DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 9. ÍNDICE CAC (carga mensual)
-- =============================================
CREATE TABLE indice_cac (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor NUMERIC(12,4) NOT NULL,
  variacion_mensual NUMERIC(8,4),
  variacion_anual NUMERIC(8,4),
  fuente TEXT DEFAULT 'INDEC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(anio, mes)
);

-- =============================================
-- 10. PROFESIONALES
-- =============================================
CREATE TABLE profesionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  especialidad TEXT CHECK (especialidad IN ('arquitecto', 'ingeniero_civil', 'ingeniero_electrico', 'ingeniero_mecanico', 'maestro_mayor_obras', 'agrimensor', 'abogado', 'escribano', 'otro')),
  matricula TEXT,
  cuit TEXT,
  email TEXT,
  telefono TEXT,
  whatsapp TEXT,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 11. CONTRATISTAS / SUBCONTRATISTAS
-- =============================================
CREATE TABLE contratistas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social TEXT NOT NULL,
  nombre_contacto TEXT,
  cuit TEXT,
  rubro TEXT,                         -- ej: hormigon, electricidad, pintura
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  calificacion INTEGER CHECK (calificacion BETWEEN 1 AND 5),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 12. PROVEEDORES
-- =============================================
CREATE TABLE proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social TEXT NOT NULL,
  nombre_contacto TEXT,
  cuit TEXT,
  rubro TEXT,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  condicion_pago TEXT,               -- ej: 30 dias, contado, etc.
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  calificacion INTEGER CHECK (calificacion BETWEEN 1 AND 5),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 13. ETAPAS DE OBRA
-- =============================================
CREATE TABLE etapas_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emprendimiento_id UUID NOT NULL REFERENCES emprendimientos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,              -- ej: Excavación, Estructura, Mampostería
  orden INTEGER NOT NULL,
  porcentaje_obra NUMERIC(5,2),      -- % que representa del total de la obra
  fecha_inicio_estimada DATE,
  fecha_fin_estimada DATE,
  fecha_inicio_real DATE,
  fecha_fin_real DATE,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_curso', 'terminada', 'con_retraso')),
  avance_porcentaje NUMERIC(5,2) DEFAULT 0,
  presupuesto NUMERIC(16,2),
  costo_real NUMERIC(16,2) DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 14. CERTIFICACIONES DE CONTRATISTAS
-- =============================================
CREATE TABLE certificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emprendimiento_id UUID NOT NULL REFERENCES emprendimientos(id),
  etapa_id UUID REFERENCES etapas_obra(id),
  contratista_id UUID NOT NULL REFERENCES contratistas(id),
  numero_certificado TEXT,
  fecha DATE NOT NULL,
  descripcion TEXT,
  monto_certificado NUMERIC(16,2) NOT NULL,
  moneda TEXT DEFAULT 'ARS' CHECK (moneda IN ('USD', 'ARS')),
  porcentaje_retencion NUMERIC(5,2) DEFAULT 5,
  monto_retencion NUMERIC(16,2),
  monto_neto NUMERIC(16,2),
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'pagado')),
  fecha_pago DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 15. ÓRDENES DE COMPRA (proveedores)
-- =============================================
CREATE TABLE ordenes_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  emprendimiento_id UUID REFERENCES emprendimientos(id),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id),
  fecha DATE NOT NULL,
  descripcion TEXT,
  estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador', 'aprobada', 'recibida', 'cancelada')),
  moneda TEXT DEFAULT 'ARS' CHECK (moneda IN ('USD', 'ARS')),
  subtotal NUMERIC(16,2),
  iva NUMERIC(16,2),
  total NUMERIC(16,2),
  condicion_pago TEXT,
  fecha_entrega_estimada DATE,
  fecha_entrega_real DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 16. ITEMS DE ORDEN DE COMPRA
-- =============================================
CREATE TABLE items_orden_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  unidad TEXT,
  cantidad NUMERIC(12,3),
  precio_unitario NUMERIC(14,4),
  total NUMERIC(16,2)
);

-- =============================================
-- 17. PAGOS A PROVEEDORES / CONTRATISTAS
-- =============================================
CREATE TABLE pagos_proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_beneficiario TEXT NOT NULL CHECK (tipo_beneficiario IN ('proveedor', 'contratista', 'profesional')),
  beneficiario_id UUID NOT NULL,     -- ID del proveedor, contratista o profesional
  emprendimiento_id UUID REFERENCES emprendimientos(id),
  orden_compra_id UUID REFERENCES ordenes_compra(id),
  certificacion_id UUID REFERENCES certificaciones(id),
  fecha DATE NOT NULL,
  concepto TEXT NOT NULL,
  moneda TEXT DEFAULT 'ARS' CHECK (moneda IN ('USD', 'ARS')),
  monto NUMERIC(16,2) NOT NULL,
  medio_pago TEXT,
  numero_comprobante TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 18. DIARIO DE OBRA
-- =============================================
CREATE TABLE diario_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emprendimiento_id UUID NOT NULL REFERENCES emprendimientos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  temperatura_min INTEGER,
  temperatura_max INTEGER,
  condiciones_clima TEXT,
  personal_presente INTEGER,
  tareas_realizadas TEXT NOT NULL,
  materiales_utilizados TEXT,
  incidentes TEXT,
  observaciones TEXT,
  usuario_id UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================
CREATE INDEX idx_unidades_emprendimiento ON unidades(emprendimiento_id);
CREATE INDEX idx_unidades_estado ON unidades(estado);
CREATE INDEX idx_contratos_cliente ON contratos(cliente_id);
CREATE INDEX idx_contratos_unidad ON contratos(unidad_id);
CREATE INDEX idx_cuotas_contrato ON cuotas(contrato_id);
CREATE INDEX idx_cuotas_estado ON cuotas(estado);
CREATE INDEX idx_cuotas_vencimiento ON cuotas(fecha_vencimiento);
CREATE INDEX idx_clientes_estado ON clientes(estado_crm);
CREATE INDEX idx_etapas_emprendimiento ON etapas_obra(emprendimiento_id);

-- =============================================
-- FUNCIÓN: Actualizar updated_at automáticamente
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_emprendimientos BEFORE UPDATE ON emprendimientos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contratos BEFORE UPDATE ON contratos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clientes BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Módulos a Implementar (en orden de prioridad)

### MÓDULO 1 — Dashboard Principal
**Archivo:** `src/pages/Dashboard.tsx`

KPIs en cards superiores:
- Unidades disponibles / vendidas / escrituradas
- Cuotas cobradas este mes (USD y ARS por separado)
- Cuotas vencidas pendientes de cobro
- Avance promedio de obras activas

Gráficos con Recharts:
- Flujo de caja mensual proyectado (barras)
- Estado de unidades por emprendimiento (donut)
- Cobros vs. proyectado (línea)

---

### MÓDULO 2 — Emprendimientos y Obras
**Archivos:** `src/pages/Emprendimientos.tsx`, `src/pages/EmprendimientoDetalle.tsx`

Lista de emprendimientos con:
- Cards con foto, nombre, estado, % avance, unidades disponibles
- Click → vista detalle

Vista detalle del emprendimiento:
- Info general + mapa de unidades (grilla visual con estados por color)
- Tab "Etapas de Obra" con barra de progreso por etapa
- Tab "Diario de Obra" con historial y formulario de carga
- Tab "Contratistas asignados" con sus certificaciones
- Tab "Documentos" (planos, permisos, fotos)

**Estados de unidad con colores:**
- Disponible = verde
- Reservada = amarillo
- Vendida = azul
- Escriturada = gris
- No disponible = rojo

---

### MÓDULO 3 — Simulador de Ventas ⭐ (MÁS IMPORTANTE)
**Archivo:** `src/pages/Simulador.tsx`

Formulario interactivo con:
```
Emprendimiento: [selector]
Unidad: [selector filtrado]
Precio de lista: [campo con moneda]
Moneda: [USD / ARS]
Seña: [monto] [fecha]
Meses de obra (Tramo 1): [número] default 24
Con actualización CAC: [checkbox] (solo ARS)
Meses financiación post-obra (Tramo 2): [número]
Tasa anual incorporada: [número %]
Fecha de inicio de cuotas: [date picker]
```

**Output del simulador:**
- Tabla completa de cuotas numeradas con fecha y monto
- Resumen: cuota tramo 1, cuota tramo 2, total a pagar
- Botón "Generar Contrato" → pre-llena formulario de contrato
- Botón "Exportar PDF" → genera plan de pagos en PDF
- Botón "Enviar por WhatsApp" → abre wa.me con resumen

**Motor de cálculo** (`src/lib/simulador.ts`):
```typescript
interface SimuladorInput {
  precioTotal: number;
  moneda: 'USD' | 'ARS';
  sena: number;
  fechaSena: Date;
  tramo1Meses: number;
  tramo1Inicio: Date;
  tramo1ConCac: boolean;
  tramo2Meses: number;
  tramo2TasaAnual: number; // ya incorporada al precio
  tramo2Inicio?: Date;
}

interface Cuota {
  numero: number;
  tramo: 'sena' | 'tramo1' | 'tramo2';
  fechaVencimiento: Date;
  montoOriginal: number;
  montoConCac?: number;
}

function calcularPlanDePagos(input: SimuladorInput): Cuota[]
```

Lógica:
1. Saldo = precioTotal - sena
2. Si tramo2Meses = 0: cuota tramo1 = saldo / tramo1Meses
3. Si tramo2Meses > 0: 
   - Determinar cuánto se paga en tramo1 vs cuánto queda para tramo2
   - Cuota tramo1 = porción / tramo1Meses
   - Saldo tramo2 se amortiza con la tasa incorporada (sistema francés simplificado)
4. Si con CAC: cada cuota tiene flag para recalcular al cobrar

---

### MÓDULO 4 — Clientes y CRM
**Archivos:** `src/pages/Clientes.tsx`, `src/pages/ClienteDetalle.tsx`

Lista con filtros: estado CRM, vendedor, emprendimiento, fecha.
Buscador por nombre, DNI, teléfono.

Vista detalle del cliente:
- Tab "Datos" — ficha completa editable
- Tab "Interacciones" — timeline de contactos con formulario de carga
- Tab "Contratos" — sus operaciones activas
- Tab "Cuotas" — estado de pagos de todos sus contratos
- Botón WhatsApp directo con número pre-cargado

Pipeline CRM visual (kanban o funnel):
```
Interesado → Prospecto → Reservado → Comprador → Escriturado
```

---

### MÓDULO 5 — Contratos
**Archivos:** `src/pages/Contratos.tsx`, `src/pages/ContratoDetalle.tsx`, `src/pages/ContratoNuevo.tsx`

Lista con filtros y buscador.
Formulario nuevo contrato (pre-llenado desde simulador si viene de ahí).

Vista detalle:
- Resumen del contrato
- Plan de cuotas completo con estado de cada una
- Historial de pagos
- Botón "Generar PDF boleto/contrato"
- Si es en ARS: botón "Actualizar cuotas con CAC del mes"

---

### MÓDULO 6 — Gestión de Cobros
**Archivos:** `src/pages/Cobros.tsx`

Vista principal: tabla de cuotas con filtros:
- Por estado (pendiente / vencida / pagada)
- Por emprendimiento
- Por mes de vencimiento
- Por moneda

Al hacer click en una cuota → modal para registrar pago:
- Fecha de pago
- Monto pagado (puede ser diferente al original)
- Medio de pago
- Número de recibo
- Notas (mora, descuento, etc.)

Panel de "Cuotas vencidas" con semáforo de urgencia por días de atraso.
Resumen mensual: cobrado vs. proyectado, por moneda.

---

### MÓDULO 7 — Proveedores
**Archivos:** `src/pages/Proveedores.tsx`, `src/pages/ProveedorDetalle.tsx`

Lista de proveedores con cuenta corriente resumida.
Vista detalle:
- Ficha del proveedor
- Órdenes de compra vinculadas
- Pagos realizados
- Saldo pendiente

Formulario de orden de compra con items detallados.

---

### MÓDULO 8 — Contratistas
**Archivos:** `src/pages/Contratistas.tsx`, `src/pages/ContratistaDetalle.tsx`

Similar a proveedores pero con:
- Certificaciones de avance (con retención de garantía)
- Vinculación a etapas de obra
- Cuenta corriente: certificado vs. pagado vs. retenido

---

### MÓDULO 9 — Profesionales
**Archivos:** `src/pages/Profesionales.tsx`

Gestión de arquitectos, ingenieros, escribanos.
Honorarios pactados, pagos realizados, documentación.

---

### MÓDULO 10 — Índice CAC
**Archivos:** `src/pages/IndiceCAC.tsx`

Tabla para cargar el índice CAC mensual (INDEC).
Variación mensual y anual calculada automáticamente.
Al guardar un nuevo mes → opción de actualizar todas las cuotas ARS pendientes de ese período.

---

### MÓDULO 11 — Reportes
**Archivos:** `src/pages/Reportes.tsx`

Reportes disponibles:
1. Flujo de caja proyectado (próximos 12 meses por emprendimiento)
2. Cuotas vencidas por cliente (aging report)
3. Rentabilidad por emprendimiento (ingresos vs. egresos)
4. Comisiones de vendedores
5. Avance de obra vs. cronograma
6. Estado de cuenta por cliente (para entregar)

Todos exportables a Excel y PDF.

---

### MÓDULO 12 — Configuración
**Archivos:** `src/pages/Configuracion.tsx`

- Datos de la empresa
- Gestión de usuarios y roles
- Configuración de permisos por rol
- Plantillas de documentos (con variables {{nombre_cliente}}, {{unidad}}, etc.)
- Parámetros generales (moneda por defecto, tasas por defecto)

---

## Diseño Visual

**Tema:** Profesional, limpio, corporativo inmobiliario.
**Colores principales:**
```css
--primary: #1a3a5c;      /* Azul marino oscuro */
--primary-light: #2d5a8e; /* Azul medio */
--accent: #c9a84c;        /* Dorado/ocre — asociado a real estate premium */
--success: #2d7a4f;
--warning: #b8860b;
--danger: #c0392b;
--bg: #f8f9fa;
--sidebar-bg: #1a3a5c;
--sidebar-text: #e8edf2;
```

**Sidebar:**
- Fondo azul marino oscuro
- Logo de la empresa arriba
- Íconos + texto, ítem activo resaltado en dorado
- Agrupado por secciones: Obras, Ventas, Finanzas, Administración

**Cards y tablas:**
- Fondo blanco, bordes suaves, sombra muy sutil
- Headers de tabla en azul marino claro
- Estados con badges de colores semánticos

---

## Rutas de la Aplicación

```tsx
// src/App.tsx — React Router v6
<Routes>
  <Route path="/" element={<Layout />}>
    <Route index element={<Dashboard />} />
    <Route path="emprendimientos" element={<Emprendimientos />} />
    <Route path="emprendimientos/:id" element={<EmprendimientoDetalle />} />
    <Route path="simulador" element={<Simulador />} />
    <Route path="clientes" element={<Clientes />} />
    <Route path="clientes/:id" element={<ClienteDetalle />} />
    <Route path="contratos" element={<Contratos />} />
    <Route path="contratos/nuevo" element={<ContratoNuevo />} />
    <Route path="contratos/:id" element={<ContratoDetalle />} />
    <Route path="cobros" element={<Cobros />} />
    <Route path="proveedores" element={<Proveedores />} />
    <Route path="contratistas" element={<Contratistas />} />
    <Route path="profesionales" element={<Profesionales />} />
    <Route path="indice-cac" element={<IndiceCAC />} />
    <Route path="reportes" element={<Reportes />} />
    <Route path="configuracion" element={<Configuracion />} />
  </Route>
  <Route path="/login" element={<Login />} />
</Routes>
```

---

## Variables de Entorno

```env
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

---

## Comandos para iniciar el proyecto

```bash
# 1. Crear proyecto
npm create vite@latest civilmar -- --template react-ts
cd civilmar

# 2. Instalar dependencias
npm install @supabase/supabase-js react-router-dom zustand react-hook-form zod @hookform/resolvers @tanstack/react-table recharts date-fns numeral jspdf jspdf-autotable xlsx lucide-react

# 3. Instalar Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 4. Instalar Shadcn/UI
npx shadcn-ui@latest init

# 5. Agregar componentes Shadcn necesarios
npx shadcn-ui@latest add button card dialog form input label select table tabs badge toast sheet calendar popover

# 6. Configurar Supabase
# Crear proyecto en supabase.com
# Ejecutar el SQL de base de datos en el SQL Editor de Supabase
# Copiar las credenciales al .env

# 7. Iniciar desarrollo
npm run dev
```

---

## Prioridad de desarrollo recomendada

1. **Layout + Auth** — sidebar, login con Supabase
2. **Simulador de ventas** — es la herramienta más usada
3. **Emprendimientos + Unidades** — base de todo
4. **Clientes + CRM** — gestión comercial
5. **Contratos** — generado desde el simulador
6. **Cobros / Cuotas** — gestión financiera diaria
7. **CAC** — motor de indexación
8. **Proveedores + Contratistas** — gestión de obra
9. **Dashboard + Reportes** — visión ejecutiva
10. **Configuración** — ajustes finales

---

## Notas importantes para Claude Code

- Usar **TypeScript estricto** en todos los archivos
- Todos los montos monetarios como `number` en el código, pero mostrar siempre formateados con separador de miles y 2 decimales
- Los montos USD mostrar con símbolo `U$D` (uso argentino), ARS con `$`
- Las fechas siempre en formato `DD/MM/YYYY` en la UI (Argentina)
- El CAC se aplica acumulativamente: si una cuota se actualizó en enero y ahora es marzo, se aplica la variación de febrero y marzo adicional
- Las cuotas vencidas deben destacarse visualmente (borde rojo, badge "VENCIDA N días")
- El simulador es el corazón del sistema — hacerlo lo más usable posible con preview en tiempo real mientras se editan los campos
- Implementar RLS (Row Level Security) en Supabase: los vendedores solo ven sus propios clientes
