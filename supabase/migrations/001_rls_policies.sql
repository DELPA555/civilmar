-- ============================================================
-- RLS POLICIES — Civilmar ERP
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── PERFILES ────────────────────────────────────────────────
-- Cada usuario puede leer su propio perfil (necesario para el login)
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perfiles: leer propio"
  ON perfiles FOR SELECT
  USING (auth.uid() = id);

-- Función SECURITY DEFINER para leer el rol sin recursión
-- (las políticas en `perfiles` no pueden consultar `perfiles` directamente)
CREATE OR REPLACE FUNCTION get_user_rol()
  RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER
  AS $f$ SELECT rol FROM perfiles WHERE id = auth.uid() $f$;

-- Admin puede leer todos los perfiles (para gestión de usuarios)
CREATE POLICY "perfiles: admin lee todos"
  ON perfiles FOR SELECT
  USING (get_user_rol() = 'admin');

-- Solo admin puede insertar/actualizar/eliminar perfiles
CREATE POLICY "perfiles: admin escribe"
  ON perfiles FOR ALL
  USING (get_user_rol() = 'admin');

-- ── EMPRENDIMIENTOS ─────────────────────────────────────────
ALTER TABLE emprendimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emprendimientos: autenticados leen"
  ON emprendimientos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "emprendimientos: admin/gerente escriben"
  ON emprendimientos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'gerente')
    )
  );

-- ── UNIDADES ────────────────────────────────────────────────
ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unidades: autenticados leen"
  ON unidades FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "unidades: admin/gerente/vendedor escriben"
  ON unidades FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'gerente', 'vendedor')
    )
  );

-- ── CLIENTES ────────────────────────────────────────────────
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Vendedor solo ve sus propios clientes; otros roles ven todos
CREATE POLICY "clientes: select según rol"
  ON clientes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid()
        AND (
          p.rol IN ('admin', 'gerente', 'administrativo', 'readonly')
          OR (p.rol = 'vendedor' AND clientes.vendedor_id = auth.uid())
        )
    )
  );

CREATE POLICY "clientes: admin/gerente/vendedor escriben"
  ON clientes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'gerente', 'vendedor')
    )
  );

-- ── INTERACCIONES ───────────────────────────────────────────
ALTER TABLE interacciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interacciones: autenticados leen/escriben"
  ON interacciones FOR ALL
  USING (auth.role() = 'authenticated');

-- ── CONTRATOS ───────────────────────────────────────────────
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contratos: autenticados leen"
  ON contratos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "contratos: admin/gerente/vendedor escriben"
  ON contratos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'gerente', 'vendedor')
    )
  );

-- ── CUOTAS ──────────────────────────────────────────────────
ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cuotas: autenticados leen"
  ON cuotas FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "cuotas: admin/gerente/administrativo escriben"
  ON cuotas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'gerente', 'administrativo')
    )
  );

-- ── INDICE CAC ──────────────────────────────────────────────
ALTER TABLE indice_cac ENABLE ROW LEVEL SECURITY;

CREATE POLICY "indice_cac: autenticados leen"
  ON indice_cac FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "indice_cac: admin/gerente/administrativo escriben"
  ON indice_cac FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'gerente', 'administrativo')
    )
  );

-- ── ETAPAS DE OBRA ──────────────────────────────────────────
ALTER TABLE etapas_obra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etapas_obra: autenticados leen"
  ON etapas_obra FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "etapas_obra: admin/gerente escriben"
  ON etapas_obra FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'gerente')
    )
  );

-- ── DIARIO DE OBRA ──────────────────────────────────────────
ALTER TABLE diario_obra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diario_obra: autenticados leen/escriben"
  ON diario_obra FOR ALL
  USING (auth.role() = 'authenticated');

-- ── PROVEEDORES ─────────────────────────────────────────────
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedores: autenticados leen"
  ON proveedores FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "proveedores: admin/gerente/administrativo escriben"
  ON proveedores FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'gerente', 'administrativo')
    )
  );

-- ── CONTRATISTAS ────────────────────────────────────────────
ALTER TABLE contratistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contratistas: autenticados leen"
  ON contratistas FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "contratistas: admin/gerente escriben"
  ON contratistas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'gerente')
    )
  );

-- ── CERTIFICACIONES ─────────────────────────────────────────
ALTER TABLE certificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certificaciones: autenticados leen"
  ON certificaciones FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "certificaciones: admin/gerente/administrativo escriben"
  ON certificaciones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'gerente', 'administrativo')
    )
  );

-- ── PROFESIONALES ───────────────────────────────────────────
ALTER TABLE profesionales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profesionales: autenticados leen"
  ON profesionales FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "profesionales: admin/gerente escriben"
  ON profesionales FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'gerente')
    )
  );

-- ── ORDENES DE COMPRA ───────────────────────────────────────
ALTER TABLE ordenes_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ordenes_compra: autenticados leen"
  ON ordenes_compra FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "ordenes_compra: admin/gerente/administrativo escriben"
  ON ordenes_compra FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'gerente', 'administrativo')
    )
  );

-- ── ITEMS ORDEN COMPRA ──────────────────────────────────────
ALTER TABLE items_orden_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_orden_compra: autenticados leen"
  ON items_orden_compra FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "items_orden_compra: admin/gerente/administrativo escriben"
  ON items_orden_compra FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'gerente', 'administrativo')
    )
  );

-- ── PAGOS PROVEEDORES ───────────────────────────────────────
ALTER TABLE pagos_proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagos_proveedores: autenticados leen"
  ON pagos_proveedores FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "pagos_proveedores: admin/gerente/administrativo escriben"
  ON pagos_proveedores FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'gerente', 'administrativo')
    )
  );

-- ── EMPRESAS ────────────────────────────────────────────────
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresas: autenticados leen"
  ON empresas FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "empresas: solo admin escribe"
  ON empresas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'admin'
    )
  );
