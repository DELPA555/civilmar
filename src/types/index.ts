// ── Tipos globales del ERP Civilmar ──────────────────────────────────────────

export type Moneda = 'USD' | 'ARS'
export type EstadoUnidad = 'disponible' | 'reservada' | 'vendida' | 'escriturada' | 'no_disponible'
export type EstadoCRM = 'interesado' | 'prospecto' | 'reservado' | 'comprador' | 'escriturado' | 'inactivo'
export type EstadoCuota = 'pendiente' | 'pagada' | 'vencida' | 'refinanciada'
export type RolUsuario = 'admin' | 'gerente' | 'vendedor' | 'administrativo' | 'readonly'

export interface Empresa {
  id: string
  nombre: string
  cuit?: string
  direccion?: string
  telefono?: string
  email?: string
  logo_url?: string
  moneda_default: Moneda
  created_at: string
}

export interface Perfil {
  id: string
  nombre: string
  apellido: string
  email: string
  rol: RolUsuario
  activo: boolean
  created_at: string
}

export interface Emprendimiento {
  id: string
  nombre: string
  descripcion?: string
  direccion?: string
  localidad: string
  provincia: string
  tipo?: 'edificio' | 'countries' | 'loteo' | 'duplex' | 'otro'
  estado: 'en_proyecto' | 'en_obra' | 'terminado' | 'entregado'
  fecha_inicio?: string
  fecha_fin_estimada?: string
  fecha_fin_real?: string
  meses_obra: number
  total_unidades: number
  imagen_url?: string
  plano_url?: string
  created_at: string
  updated_at: string
  // Calculados / joined
  unidades_disponibles?: number
  unidades_vendidas?: number
  avance_promedio?: number
}

export interface Unidad {
  id: string
  emprendimiento_id: string
  identificador: string
  tipo?: 'departamento' | 'lote' | 'casa' | 'local' | 'cochera' | 'otro'
  planta?: number
  metros_cubiertos?: number
  metros_semicubiertos?: number
  metros_totales?: number
  ambientes?: number
  orientacion?: string
  descripcion?: string
  estado: EstadoUnidad
  precio_lista_usd?: number
  precio_lista_ars?: number
  moneda_venta: Moneda
  created_at: string
}

export interface Cliente {
  id: string
  tipo: 'persona_fisica' | 'persona_juridica'
  nombre: string
  apellido?: string
  razon_social?: string
  dni?: string
  cuit?: string
  email?: string
  telefono?: string
  whatsapp?: string
  direccion?: string
  localidad?: string
  provincia?: string
  pais: string
  estado_crm: EstadoCRM
  origen?: string
  notas?: string
  vendedor_id?: string
  created_at: string
  updated_at: string
  // Joined
  vendedor?: Pick<Perfil, 'id' | 'nombre' | 'apellido'>
}

export interface Interaccion {
  id: string
  cliente_id: string
  tipo: 'llamada' | 'whatsapp' | 'email' | 'reunion' | 'visita_obra' | 'otro'
  fecha: string
  descripcion: string
  resultado?: string
  proxima_accion?: string
  proxima_fecha?: string
  usuario_id?: string
  created_at: string
}

export interface Contrato {
  id: string
  numero: string
  emprendimiento_id: string
  unidad_id: string
  cliente_id: string
  vendedor_id?: string
  tipo: 'reserva' | 'boleto' | 'escritura' | 'cesion'
  estado: 'borrador' | 'vigente' | 'cancelado' | 'rescindido' | 'escriturado'
  moneda: Moneda
  precio_total: number
  sena_monto: number
  sena_fecha?: string
  tramo1_meses: number
  tramo1_cuota: number
  tramo1_inicio: string
  tramo1_con_cac: boolean
  tramo2_meses: number
  tramo2_cuota: number
  tramo2_inicio?: string
  tramo2_tasa_anual: number
  total_tramo1?: number
  total_tramo2?: number
  total_con_sena?: number
  fecha_firma?: string
  fecha_escritura_estimada?: string
  fecha_escritura_real?: string
  notas?: string
  documento_url?: string
  created_at: string
  updated_at: string
  // Joined
  cliente?: Pick<Cliente, 'id' | 'nombre' | 'apellido' | 'dni'>
  unidad?: Pick<Unidad, 'id' | 'identificador' | 'tipo'>
  emprendimiento?: Pick<Emprendimiento, 'id' | 'nombre'>
}

export interface Cuota {
  id: string
  contrato_id: string
  numero_cuota: number
  tramo: 'sena' | 'tramo1' | 'tramo2'
  fecha_vencimiento: string
  monto_original: number
  monto_actualizado?: number
  indice_cac_aplicado?: number
  estado: EstadoCuota
  fecha_pago?: string
  monto_pagado?: number
  medio_pago?: string
  numero_recibo?: string
  mora_dias: number
  mora_monto: number
  notas?: string
  created_at: string
}

export interface IndiceCAC {
  id: string
  anio: number
  mes: number
  valor: number
  variacion_mensual?: number
  variacion_anual?: number
  fuente: string
  created_at: string
}

export interface EtapaObra {
  id: string
  emprendimiento_id: string
  nombre: string
  orden: number
  porcentaje_obra?: number
  fecha_inicio_estimada?: string
  fecha_fin_estimada?: string
  fecha_inicio_real?: string
  fecha_fin_real?: string
  estado: 'pendiente' | 'en_curso' | 'terminada' | 'con_retraso'
  avance_porcentaje: number
  presupuesto?: number
  costo_real: number
  notas?: string
  created_at: string
}

export interface Contratista {
  id: string
  razon_social: string
  nombre_contacto?: string
  cuit?: string
  rubro?: string
  email?: string
  telefono?: string
  direccion?: string
  estado: 'activo' | 'inactivo'
  calificacion?: number
  notas?: string
  created_at: string
}

export interface Proveedor {
  id: string
  razon_social: string
  nombre_contacto?: string
  cuit?: string
  rubro?: string
  email?: string
  telefono?: string
  direccion?: string
  condicion_pago?: string
  estado: 'activo' | 'inactivo'
  calificacion?: number
  notas?: string
  created_at: string
}

export interface Profesional {
  id: string
  nombre: string
  apellido: string
  especialidad?: string
  matricula?: string
  cuit?: string
  email?: string
  telefono?: string
  whatsapp?: string
  estado: 'activo' | 'inactivo'
  notas?: string
  created_at: string
}
