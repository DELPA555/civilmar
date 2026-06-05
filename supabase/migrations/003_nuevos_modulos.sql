-- ============================================================
-- MIGRACIÓN 003 — Multi-empresa, Portal, Alertas, Inversores,
--                 Documentación Legal, Fideicomiso, Notificaciones
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── MULTI-EMPRESA ─────────────────────────────────────────────────────────────

-- Ampliar tabla empresas existente
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS color_primario TEXT DEFAULT '#1a3a5c';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS color_acento TEXT DEFAULT '#c9a84c';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cuit TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS razon_social TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS condicion_iva TEXT DEFAULT 'RI';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ingresos_brutos TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;

-- Relación usuarios ↔ empresas (un usuario puede tener distinto rol por empresa)
CREATE TABLE IF NOT EXISTS usuarios_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  rol TEXT NOT NULL CHECK (rol IN ('admin','gerente','vendedor','administrativo','readonly')),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, empresa_id)
);
CREATE INDEX IF NOT EXISTS idx_uempresas_usuario ON usuarios_empresas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_uempresas_empresa ON usuarios_empresas(empresa_id);

-- empresa_id en emprendimientos (para filtrado multi-empresa)
ALTER TABLE emprendimientos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
CREATE INDEX IF NOT EXISTS idx_emp_empresa ON emprendimientos(empresa_id);

-- ── PORTAL DEL CLIENTE ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  fecha_expiracion TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year'),
  activo BOOLEAN DEFAULT TRUE,
  ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_cliente ON portal_tokens(cliente_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_tokens_token ON portal_tokens(token);

-- ── NOTIFICACIONES WHATSAPP ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notificaciones_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'vencimiento_5dias', 'vencimiento_hoy', 'pago_confirmado',
    'actualizacion_cac', 'avance_obra', 'manual', 'otro'
  )),
  mensaje TEXT NOT NULL,
  telefono TEXT,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','enviado','fallido','cancelado')),
  referencia_id UUID,
  referencia_tipo TEXT,
  fecha_envio TIMESTAMPTZ,
  error_detalle TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_cliente ON notificaciones_log(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notif_tipo ON notificaciones_log(tipo);
CREATE INDEX IF NOT EXISTS idx_notif_estado ON notificaciones_log(estado);
CREATE INDEX IF NOT EXISTS idx_notif_fecha ON notificaciones_log(created_at);

CREATE TABLE IF NOT EXISTS notificaciones_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT TRUE,
  plantilla TEXT NOT NULL,
  dias_anticipacion INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO notificaciones_config (tipo, plantilla, dias_anticipacion) VALUES
  ('vencimiento_5dias', 'Hola {{nombre}}, tu cuota N° {{numero_cuota}} de {{emprendimiento}} vence el {{fecha}} por {{monto}}. Podés verla en: {{portal_link}}', 5),
  ('vencimiento_hoy',   'Hola {{nombre}}, hoy vence tu cuota N° {{numero_cuota}} por {{monto}}. Recordá regularizar tu situación.', 0),
  ('pago_confirmado',   'Recibimos tu pago de {{monto}} el {{fecha}}. Recibo N° {{numero_recibo}} disponible en tu portal: {{portal_link}}', 0),
  ('actualizacion_cac', 'Tu cuota fue actualizada por índice CAC. Nuevo valor: {{monto}} (anterior: {{monto_anterior}}).', 0),
  ('avance_obra',       'La obra {{emprendimiento}} avanzó al {{porcentaje}}%. Podés ver las fotos en: {{portal_link}}', 0)
ON CONFLICT (tipo) DO NOTHING;

-- ── DASHBOARD INVERSORES ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inversores_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inversor_nombre TEXT NOT NULL,
  inversor_email TEXT,
  emprendimiento_id UUID REFERENCES emprendimientos(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  activo BOOLEAN DEFAULT TRUE,
  ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inversores_token ON inversores_tokens(token);

-- ── DOCUMENTACIÓN LEGAL ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documentos_legales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN (
    'habilitacion_municipal','seguro_obra','art','poliza_caucion',
    'plano_aprobado','permiso_construccion','certificado_afip','otro'
  )),
  entidad_tipo TEXT NOT NULL CHECK (entidad_tipo IN ('emprendimiento','contratista','profesional','proveedor')),
  entidad_id UUID NOT NULL,
  descripcion TEXT,
  fecha_emision DATE,
  fecha_vencimiento DATE,
  documento_url TEXT,
  estado TEXT GENERATED ALWAYS AS (
    CASE
      WHEN fecha_vencimiento IS NULL THEN 'sin_vencimiento'
      WHEN fecha_vencimiento < CURRENT_DATE THEN 'vencido'
      WHEN fecha_vencimiento <= CURRENT_DATE + 30 THEN 'por_vencer'
      ELSE 'vigente'
    END
  ) STORED,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_docs_legales_entidad ON documentos_legales(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_docs_legales_vencimiento ON documentos_legales(fecha_vencimiento);

-- ── FIDEICOMISO AL COSTO ──────────────────────────────────────────────────────

ALTER TABLE emprendimientos ADD COLUMN IF NOT EXISTS es_fideicomiso BOOLEAN DEFAULT FALSE;
ALTER TABLE emprendimientos ADD COLUMN IF NOT EXISTS costo_total_estimado NUMERIC(16,2);

CREATE TABLE IF NOT EXISTS fiduciantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emprendimiento_id UUID NOT NULL REFERENCES emprendimientos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT,
  cuit TEXT,
  email TEXT,
  telefono TEXT,
  porcentaje_participacion NUMERIC(5,2) NOT NULL CHECK (porcentaje_participacion > 0 AND porcentaje_participacion <= 100),
  activo BOOLEAN DEFAULT TRUE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fiduciantes_emp ON fiduciantes(emprendimiento_id);

CREATE TABLE IF NOT EXISTS aportes_fideicomiso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiduciante_id UUID NOT NULL REFERENCES fiduciantes(id) ON DELETE CASCADE,
  emprendimiento_id UUID NOT NULL REFERENCES emprendimientos(id),
  periodo TEXT NOT NULL,  -- 'YYYY-MM'
  monto_requerido NUMERIC(16,2) DEFAULT 0,
  monto_aportado NUMERIC(16,2) DEFAULT 0,
  fecha_aporte DATE,
  medio_pago TEXT,
  comprobante TEXT,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','parcial','completo','excedente')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aportes_fiduciante ON aportes_fideicomiso(fiduciante_id);
CREATE INDEX IF NOT EXISTS idx_aportes_periodo ON aportes_fideicomiso(periodo);

CREATE TABLE IF NOT EXISTS liquidaciones_fideicomiso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emprendimiento_id UUID NOT NULL REFERENCES emprendimientos(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  avance_porcentaje NUMERIC(5,2),
  costo_periodo NUMERIC(16,2) DEFAULT 0,
  total_aportado_periodo NUMERIC(16,2) DEFAULT 0,
  notas TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(emprendimiento_id, periodo)
);

-- ── ALERTAS (centro de alertas) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alertas_gestionadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  referencia_tipo TEXT,
  referencia_id UUID,
  usuario_id UUID REFERENCES perfiles(id),
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','vista','gestionada','ignorada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  gestionada_at TIMESTAMPTZ,
  UNIQUE(tipo, referencia_id)
);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON alertas_gestionadas(tipo);
CREATE INDEX IF NOT EXISTS idx_alertas_estado ON alertas_gestionadas(estado);

-- ── RLS POLÍTICAS NUEVAS ──────────────────────────────────────────────────────

ALTER TABLE usuarios_empresas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE inversores_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_legales   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiduciantes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE aportes_fideicomiso  ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidaciones_fideicomiso ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_gestionadas  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uempresas: autenticados leen"     ON usuarios_empresas FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "uempresas: admin escribe"         ON usuarios_empresas FOR ALL USING (get_user_rol()='admin');
CREATE POLICY "portal: autenticados leen"        ON portal_tokens FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "portal: admin/gerente/vendedor"   ON portal_tokens FOR ALL USING (get_user_rol() IN ('admin','gerente','vendedor'));
CREATE POLICY "notif_log: autenticados leen"     ON notificaciones_log FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "notif_log: admin/gerente escribe" ON notificaciones_log FOR ALL USING (get_user_rol() IN ('admin','gerente'));
CREATE POLICY "notif_cfg: autenticados leen"     ON notificaciones_config FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "notif_cfg: admin escribe"         ON notificaciones_config FOR ALL USING (get_user_rol() IN ('admin','gerente'));
CREATE POLICY "inversores: autenticados"         ON inversores_tokens FOR ALL USING (get_user_rol() IN ('admin','gerente'));
CREATE POLICY "docs_legales: autenticados leen"  ON documentos_legales FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "docs_legales: admin/gerente"      ON documentos_legales FOR ALL USING (get_user_rol() IN ('admin','gerente'));
CREATE POLICY "fiduciantes: autenticados leen"   ON fiduciantes FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "fiduciantes: admin/gerente"       ON fiduciantes FOR ALL USING (get_user_rol() IN ('admin','gerente'));
CREATE POLICY "aportes: autenticados leen"       ON aportes_fideicomiso FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "aportes: admin/gerente"           ON aportes_fideicomiso FOR ALL USING (get_user_rol() IN ('admin','gerente'));
CREATE POLICY "liquidaciones: autenticados leen" ON liquidaciones_fideicomiso FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "liquidaciones: admin/gerente"     ON liquidaciones_fideicomiso FOR ALL USING (get_user_rol() IN ('admin','gerente'));
CREATE POLICY "alertas: autenticados"            ON alertas_gestionadas FOR ALL USING (auth.role()='authenticated');
