export type TipoArticulo = 'simple' | 'con_variantes'

export interface UnidadMedida {
  id: number
  nombre: string
  activo: boolean
}

export interface Subcategoria {
  id: number
  nombre: string
  activo: boolean
  categoria_id: number
}

export interface Categoria {
  id: number
  nombre: string
  activo: boolean
  subcategorias?: Subcategoria[]
}

export interface Marca {
  id: number
  nombre: string
  activo: boolean
}

export interface AtributoTipo {
  id: number
  nombre: string
  activo: boolean
}

export interface VarianteAtributo {
  id: number
  variante_id: number
  atributo_tipo_id: number
  valor: string
  atributo_tipos?: { nombre: string }
}

export interface ArticuloVariante {
  id: number
  articulo_id: number
  sku: string | null
  codigo_barras: string | null
  precio_venta: number | null
  precio_compra: number | null
  stock_actual: number
  stock_minimo: number
  activo: boolean
  variante_atributos?: VarianteAtributo[]
  created_at: string
  updated_at: string
}

export interface Articulo {
  id: number
  codigo: string | null
  nombre: string
  descripcion: string | null
  tipo_articulo: TipoArticulo
  categoria_id: number | null
  subcategoria_id: number | null
  marca_id: number | null
  proveedor_id: number | null
  precio_venta: number | null
  precio_compra: number | null
  stock_actual: number
  stock_minimo: number
  unidad_id: number | null
  codigo_barras: string | null
  activo: boolean
  imagen_url: string | null
  categorias?: { id: number; nombre: string }
  subcategorias?: { id: number; nombre: string }
  marcas?: { id: number; nombre: string }
  unidades_medida?: { id: number; nombre: string }
  created_at: string
  updated_at: string
}

export interface ArticuloWithVariantes extends Articulo {
  articulo_variantes?: ArticuloVariante[]
}

export interface ArticuloFormData {
  nombre: string
  codigo?: string
  descripcion?: string
  tipo_articulo: TipoArticulo
  categoria_id?: number | null
  subcategoria_id?: number | null
  marca_id?: number | null
  proveedor_id?: number | null
  precio_venta?: number | null
  precio_compra?: number | null
  stock_actual?: number
  stock_minimo?: number
  unidad_id?: number | null
  codigo_barras?: string | null
  imagen_url?: string | null
  activo: boolean
}

export interface VarianteFormData {
  sku?: string
  codigo_barras?: string
  precio_venta?: number | null
  precio_compra?: number | null
  stock_minimo?: number
  activo: boolean
  atributos: { atributo_tipo_id: number; valor: string }[]
}

export interface AtributoValor {
  id: number
  atributo_tipo_id: number
  valor: string
  activo: boolean
  orden: number
}

export interface PendingVariante {
  tempId: string
  atributos: { atributo_tipo_id: number; valor: string }[]
}
