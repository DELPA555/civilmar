-- ============================================================
-- MIGRACIÓN 002 — Módulos: Presupuesto, Pañol, Jornadas, Licitaciones
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── PRESUPUESTO APU ──────────────────────────────────────────────────────────

CREATE TABLE presupuesto_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emprendimiento_id UUID NOT NULL REFERENCES emprendimientos(id) ON DELETE CASCADE,
  version INTEGER DEFAULT 1,
  descripcion TEXT,
  estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador', 'aprobado', 'revision')),
  moneda TEXT DEFAULT 'ARS' CHECK (moneda IN ('ARS', 'USD')),
  superficie_total NUMERIC(10,2),       -- m² totales construidos
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE items_presupuesto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id UUID NOT NULL REFERENCES presupuesto_obra(id) ON DELETE CASCADE,
  rubro TEXT NOT NULL,                  -- excavacion, estructura, mamposteria, etc.
  descripcion TEXT NOT NULL,
  unidad TEXT NOT NULL,                 -- m2, m3, kg, gl, etc.
  cantidad NUMERIC(12,3) DEFAULT 0,
  precio_unitario_materiales NUMERIC(14,4) DEFAULT 0,
  precio_unitario_mano_obra  NUMERIC(14,4) DEFAULT 0,
  precio_unitario_equipos    NUMERIC(14,4) DEFAULT 0,
  total NUMERIC(16,2) GENERATED ALWAYS AS (
    cantidad * (precio_unitario_materiales + precio_unitario_mano_obra + precio_unitario_equipos)
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── PAÑOL Y DEPÓSITO ─────────────────────────────────────────────────────────

CREATE TABLE depositos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  emprendimiento_id UUID REFERENCES emprendimientos(id),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE materiales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE,
  descripcion TEXT NOT NULL,
  unidad TEXT NOT NULL,                 -- m2, m3, kg, unidad, litro, etc.
  categoria TEXT,                       -- ferreteria, electrico, sanitario, etc.
  stock_minimo NUMERIC(12,3) DEFAULT 0,
  costo_promedio NUMERIC(14,4) DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE movimientos_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materiales(id),
  deposito_id UUID NOT NULL REFERENCES depositos(id),
  emprendimiento_id UUID REFERENCES emprendimientos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'devolucion', 'ajuste')),
  cantidad NUMERIC(12,3) NOT NULL,
  costo_unitario NUMERIC(14,4),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion TEXT NOT NULL,
  remito TEXT,                          -- número de remito/factura
  usuario_id UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vista de stock actual por material y depósito
CREATE OR REPLACE VIEW stock_actual AS
SELECT
  m.id AS material_id,
  m.codigo,
  m.descripcion,
  m.unidad,
  m.categoria,
  m.stock_minimo,
  m.costo_promedio,
  d.id AS deposito_id,
  d.nombre AS deposito,
  COALESCE(SUM(
    CASE
      WHEN ms.tipo IN ('ingreso', 'devolucion') THEN ms.cantidad
      WHEN ms.tipo IN ('egreso')                THEN -ms.cantidad
      WHEN ms.tipo = 'ajuste'                   THEN ms.cantidad
      ELSE 0
    END
  ), 0) AS stock_actual
FROM materiales m
CROSS JOIN depositos d
LEFT JOIN movimientos_stock ms ON ms.material_id = m.id AND ms.deposito_id = d.id
WHERE m.activo = TRUE AND d.activo = TRUE
GROUP BY m.id, m.codigo, m.descripcion, m.unidad, m.categoria, m.stock_minimo, m.costo_promedio, d.id, d.nombre;

-- ── JORNADAS Y PERSONAL ───────────────────────────────────────────────────────

CREATE TABLE operarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'oficial', 'oficial_especializado', 'medio_oficial', 'ayudante', 'capataz', 'otro'
  )),
  cuil TEXT,
  telefono TEXT,
  fecha_ingreso DATE,
  jornal_base NUMERIC(12,2) DEFAULT 0,     -- ARS por jornada
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE jornadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operario_id UUID NOT NULL REFERENCES operarios(id),
  emprendimiento_id UUID NOT NULL REFERENCES emprendimientos(id),
  fecha DATE NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('presente', 'ausente', 'medio_dia', 'horas_extra', 'feriado')),
  horas NUMERIC(4,2) DEFAULT 8,
  jornal_aplicado NUMERIC(12,2),          -- calculado al registrar
  notas TEXT,
  usuario_id UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(operario_id, emprendimiento_id, fecha)
);

-- ── LICITACIONES Y COTIZACIONES ───────────────────────────────────────────────

CREATE TABLE licitaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emprendimiento_id UUID REFERENCES emprendimientos(id),
  numero TEXT UNIQUE NOT NULL,
  descripcion TEXT NOT NULL,
  fecha_solicitud DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_limite DATE,
  estado TEXT DEFAULT 'abierta' CHECK (estado IN ('abierta', 'en_evaluacion', 'adjudicada', 'cancelada')),
  proveedor_adjudicado_id UUID REFERENCES proveedores(id),
  orden_compra_id UUID REFERENCES ordenes_compra(id),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE items_licitacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacion_id UUID NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  unidad TEXT,
  cantidad NUMERIC(12,3),
  especificaciones TEXT
);

CREATE TABLE cotizaciones_proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacion_id UUID NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
  proveedor_id UUID NOT NULL REFERENCES proveedores(id),
  fecha_cotizacion DATE,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'recibida', 'adjudicada', 'rechazada')),
  moneda TEXT DEFAULT 'ARS' CHECK (moneda IN ('ARS', 'USD')),
  monto_total NUMERIC(16,2),
  plazo_entrega_dias INTEGER,
  condicion_pago TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE items_cotizacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id UUID NOT NULL REFERENCES cotizaciones_proveedores(id) ON DELETE CASCADE,
  item_licitacion_id UUID REFERENCES items_licitacion(id),
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(12,3),
  precio_unitario NUMERIC(14,4),
  total NUMERIC(16,2)
);

-- ── ÍNDICES ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_presupuesto_emp   ON presupuesto_obra(emprendimiento_id);
CREATE INDEX idx_items_pres        ON items_presupuesto(presupuesto_id);
CREATE INDEX idx_mov_material      ON movimientos_stock(material_id);
CREATE INDEX idx_mov_deposito      ON movimientos_stock(deposito_id);
CREATE INDEX idx_mov_fecha         ON movimientos_stock(fecha);
CREATE INDEX idx_jornadas_operario ON jornadas(operario_id);
CREATE INDEX idx_jornadas_fecha    ON jornadas(fecha);
CREATE INDEX idx_jornadas_emp      ON jornadas(emprendimiento_id);
CREATE INDEX idx_licit_emp         ON licitaciones(emprendimiento_id);
CREATE INDEX idx_cotiz_licit       ON cotizaciones_proveedores(licitacion_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE presupuesto_obra        ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_presupuesto       ENABLE ROW LEVEL SECURITY;
ALTER TABLE depositos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiales              ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock       ENABLE ROW LEVEL SECURITY;
ALTER TABLE operarios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornadas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE licitaciones            ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_licitacion        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones_proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_cotizacion        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presupuesto_obra: autenticados leen"      ON presupuesto_obra        FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "presupuesto_obra: admin/gerente escriben" ON presupuesto_obra        FOR ALL    USING (get_user_rol() IN ('admin','gerente'));
CREATE POLICY "items_pres: autenticados leen"            ON items_presupuesto       FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "items_pres: admin/gerente escriben"       ON items_presupuesto       FOR ALL    USING (get_user_rol() IN ('admin','gerente'));
CREATE POLICY "depositos: autenticados leen"             ON depositos               FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "depositos: admin/gerente/admin escriben"  ON depositos               FOR ALL    USING (get_user_rol() IN ('admin','gerente','administrativo'));
CREATE POLICY "materiales: autenticados leen"            ON materiales              FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "materiales: admin/gerente/adm escriben"   ON materiales              FOR ALL    USING (get_user_rol() IN ('admin','gerente','administrativo'));
CREATE POLICY "movstock: autenticados leen"              ON movimientos_stock       FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "movstock: admin/gerente/adm escriben"     ON movimientos_stock       FOR ALL    USING (get_user_rol() IN ('admin','gerente','administrativo'));
CREATE POLICY "operarios: autenticados leen"             ON operarios               FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "operarios: admin/gerente/adm escriben"    ON operarios               FOR ALL    USING (get_user_rol() IN ('admin','gerente','administrativo'));
CREATE POLICY "jornadas: autenticados leen"              ON jornadas                FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "jornadas: admin/gerente/adm escriben"     ON jornadas                FOR ALL    USING (get_user_rol() IN ('admin','gerente','administrativo'));
CREATE POLICY "licit: autenticados leen"                 ON licitaciones            FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "licit: admin/gerente/adm escriben"        ON licitaciones            FOR ALL    USING (get_user_rol() IN ('admin','gerente','administrativo'));
CREATE POLICY "items_licit: autenticados leen"           ON items_licitacion        FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "items_licit: admin/gerente/adm escriben"  ON items_licitacion        FOR ALL    USING (get_user_rol() IN ('admin','gerente','administrativo'));
CREATE POLICY "cotiz: autenticados leen"                 ON cotizaciones_proveedores FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "cotiz: admin/gerente/adm escriben"        ON cotizaciones_proveedores FOR ALL    USING (get_user_rol() IN ('admin','gerente','administrativo'));
CREATE POLICY "items_cotiz: autenticados leen"           ON items_cotizacion        FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "items_cotiz: admin/gerente/adm escriben"  ON items_cotizacion        FOR ALL    USING (get_user_rol() IN ('admin','gerente','administrativo'));
