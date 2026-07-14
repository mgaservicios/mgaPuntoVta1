export type PermOp  = { id: string; label: string }
export type PermSub = { id: string; label: string; ops: PermOp[] }
export type PermMod = { id: string; label: string; subs: PermSub[] }

export const PERM_MODULES: PermMod[] = [
  {
    id: 'ventas', label: 'Ventas',
    subs: [
      { id: 'ventas.pos', label: 'Ticket de Venta', ops: [
        { id: 'ventas.pos.cobrar', label: 'Realizar venta' },
      ]},
      { id: 'ventas.historial', label: 'Historial de ventas', ops: [
        { id: 'ventas.historial.ver',    label: 'Ver historial' },
        { id: 'ventas.historial.anular', label: 'Anular venta' },
      ]},
      { id: 'ventas.ordenes', label: 'Órdenes de venta', ops: [
        { id: 'ventas.ordenes.ver',       label: 'Ver órdenes' },
        { id: 'ventas.ordenes.crear',     label: 'Crear orden' },
        { id: 'ventas.ordenes.editar',    label: 'Editar orden' },
        { id: 'ventas.ordenes.confirmar', label: 'Confirmar orden' },
        { id: 'ventas.ordenes.anular',    label: 'Anular orden' },
      ]},
      { id: 'ventas.clientes', label: 'Clientes', ops: [
        { id: 'ventas.clientes.ver',        label: 'Ver clientes' },
        { id: 'ventas.clientes.crear',      label: 'Crear cliente' },
        { id: 'ventas.clientes.editar',     label: 'Editar cliente' },
        { id: 'ventas.clientes.desactivar', label: 'Desactivar cliente' },
      ]},
      { id: 'ventas.notas-credito', label: 'Notas de crédito', ops: [
        { id: 'ventas.notas-credito.ver',    label: 'Ver notas de crédito' },
        { id: 'ventas.notas-credito.crear',  label: 'Crear nota de crédito' },
        { id: 'ventas.notas-credito.anular', label: 'Anular nota de crédito' },
      ]},
    ],
  },
  {
    id: 'inventario', label: 'Inventario',
    subs: [
      { id: 'inventario.articulos', label: 'Artículos', ops: [
        { id: 'inventario.articulos.ver',        label: 'Ver artículos' },
        { id: 'inventario.articulos.crear',      label: 'Crear artículo' },
        { id: 'inventario.articulos.editar',     label: 'Editar artículo' },
        { id: 'inventario.articulos.desactivar', label: 'Desactivar artículo' },
      ]},
      { id: 'inventario.remitos', label: 'Remitos', ops: [
        { id: 'inventario.remitos.ver',       label: 'Ver remitos' },
        { id: 'inventario.remitos.crear',     label: 'Crear remito' },
        { id: 'inventario.remitos.confirmar', label: 'Confirmar remito' },
        { id: 'inventario.remitos.anular',    label: 'Anular remito' },
      ]},
      { id: 'inventario.ajustes', label: 'Ajustes de stock', ops: [
        { id: 'inventario.ajustes.ver',     label: 'Ver ajustes' },
        { id: 'inventario.ajustes.aplicar', label: 'Aplicar ajuste' },
      ]},
      { id: 'inventario.proveedores', label: 'Proveedores', ops: [
        { id: 'inventario.proveedores.ver',        label: 'Ver proveedores' },
        { id: 'inventario.proveedores.crear',      label: 'Crear proveedor' },
        { id: 'inventario.proveedores.editar',     label: 'Editar proveedor' },
        { id: 'inventario.proveedores.desactivar', label: 'Desactivar proveedor' },
      ]},
    ],
  },
  {
    id: 'consultas', label: 'Consultas',
    subs: [
      { id: 'consultas.stock', label: 'Stock y precios', ops: [
        { id: 'consultas.stock.ver', label: 'Ver stock y precios' },
      ]},
      { id: 'consultas.seguimiento', label: 'Seguimiento', ops: [
        { id: 'consultas.seguimiento.ver', label: 'Ver seguimiento' },
      ]},
      { id: 'consultas.precios_costo', label: 'Precios de costo', ops: [
        { id: 'consultas.precios_costo.ver', label: 'Ver historial de precios de costo' },
      ]},
    ],
  },
  {
    id: 'listados', label: 'Listados',
    subs: [
      { id: 'listados.cobranzas', label: 'Listado de cobranzas', ops: [
        { id: 'listados.cobranzas.ver', label: 'Ver listado de cobranzas' },
      ]},
      { id: 'listados.ventas_articulos', label: 'Listado de venta de artículos', ops: [
        { id: 'listados.ventas_articulos.ver', label: 'Ver listado de ventas por artículo' },
      ]},
      { id: 'listados.precios', label: 'Listado de precios', ops: [
        { id: 'listados.precios.ver', label: 'Ver listado de precios' },
      ]},
      { id: 'listados.movimientos_caja', label: 'Movimientos de caja', ops: [
        { id: 'listados.movimientos_caja.ver', label: 'Ver movimientos de caja' },
      ]},
    ],
  },
  {
    id: 'fondos', label: 'Fondos',
    subs: [
      { id: 'fondos.caja', label: 'Caja', ops: [
        { id: 'fondos.caja.ver',        label: 'Ver estado de caja' },
        { id: 'fondos.caja.abrir',      label: 'Abrir caja' },
        { id: 'fondos.caja.cerrar',     label: 'Cerrar caja' },
        { id: 'fondos.caja.movimiento', label: 'Registrar ingreso/egreso' },
        { id: 'fondos.caja.anular',     label: 'Anular movimientos' },
      ]},
      { id: 'fondos.cobranzas', label: 'Cobranzas', ops: [
        { id: 'fondos.cobranzas.ver', label: 'Ver cobranzas' },
      ]},
      { id: 'fondos.recibos', label: 'Recibos', ops: [
        { id: 'fondos.recibos.ver', label: 'Ver recibos' },
      ]},
    ],
  },
  {
    id: 'optica', label: 'Óptica',
    subs: [
      { id: 'optica.ordenes', label: 'Órdenes de trabajo', ops: [
        { id: 'optica.ordenes.ver',           label: 'Ver órdenes de trabajo' },
        { id: 'optica.ordenes.crear',         label: 'Crear OT' },
        { id: 'optica.ordenes.editar',        label: 'Editar OT' },
        { id: 'optica.ordenes.cambiar-estado', label: 'Cambiar estado' },
        { id: 'optica.ordenes.pagar',         label: 'Registrar pago' },
      ]},
      { id: 'optica.servicios', label: 'Servicios', ops: [
        { id: 'optica.servicios.ver',    label: 'Ver servicios' },
        { id: 'optica.servicios.crear',  label: 'Crear servicio' },
        { id: 'optica.servicios.editar', label: 'Editar servicio' },
        { id: 'optica.servicios.anular', label: 'Anular servicio' },
      ]},
      { id: 'optica.medicos', label: 'Médicos', ops: [
        { id: 'optica.medicos.ver',     label: 'Ver médicos' },
        { id: 'optica.medicos.crear',   label: 'Crear médico' },
        { id: 'optica.medicos.editar',  label: 'Editar médico' },
        { id: 'optica.medicos.eliminar', label: 'Eliminar médico' },
      ]},
    ],
  },
  {
    id: 'altas', label: 'Altas',
    subs: [
      { id: 'altas.marcas', label: 'Marcas', ops: [
        { id: 'altas.marcas.ver',      label: 'Ver marcas' },
        { id: 'altas.marcas.crear',    label: 'Crear marca' },
        { id: 'altas.marcas.editar',   label: 'Editar marca' },
        { id: 'altas.marcas.eliminar', label: 'Eliminar marca' },
      ]},
      { id: 'altas.categorias', label: 'Categorías', ops: [
        { id: 'altas.categorias.ver',      label: 'Ver categorías' },
        { id: 'altas.categorias.crear',    label: 'Crear categoría' },
        { id: 'altas.categorias.editar',   label: 'Editar categoría' },
        { id: 'altas.categorias.eliminar', label: 'Eliminar categoría' },
      ]},
      { id: 'altas.subcategorias', label: 'Subcategorías', ops: [
        { id: 'altas.subcategorias.ver',      label: 'Ver subcategorías' },
        { id: 'altas.subcategorias.crear',    label: 'Crear subcategoría' },
        { id: 'altas.subcategorias.editar',   label: 'Editar subcategoría' },
        { id: 'altas.subcategorias.eliminar', label: 'Eliminar subcategoría' },
      ]},
      { id: 'altas.atributos', label: 'Atributos', ops: [
        { id: 'altas.atributos.ver',      label: 'Ver atributos' },
        { id: 'altas.atributos.crear',    label: 'Crear atributo' },
        { id: 'altas.atributos.editar',   label: 'Editar atributo' },
        { id: 'altas.atributos.eliminar', label: 'Eliminar atributo' },
      ]},
      { id: 'altas.listas_precio', label: 'Listas de precio', ops: [
        { id: 'altas.listas_precio.ver',      label: 'Ver listas de precio' },
        { id: 'altas.listas_precio.crear',    label: 'Crear lista de precio' },
        { id: 'altas.listas_precio.editar',   label: 'Editar lista de precio' },
        { id: 'altas.listas_precio.eliminar', label: 'Desactivar lista de precio' },
      ]},
      { id: 'altas.vendedores', label: 'Vendedores', ops: [
        { id: 'altas.vendedores.ver',    label: 'Ver vendedores' },
        { id: 'altas.vendedores.crear',  label: 'Crear vendedor' },
        { id: 'altas.vendedores.editar', label: 'Editar vendedor' },
      ]},
      { id: 'altas.formas_pago', label: 'Formas de pago', ops: [
        { id: 'altas.formas_pago.ver',      label: 'Ver formas de pago' },
        { id: 'altas.formas_pago.crear',    label: 'Crear forma de pago' },
        { id: 'altas.formas_pago.editar',   label: 'Editar forma de pago' },
        { id: 'altas.formas_pago.eliminar', label: 'Eliminar forma de pago' },
      ]},
    ],
  },
  {
    id: 'admin', label: 'Administración',
    subs: [
      { id: 'admin.usuarios', label: 'Usuarios', ops: [
        { id: 'admin.usuarios.ver',    label: 'Ver usuarios' },
        { id: 'admin.usuarios.crear',  label: 'Crear usuario' },
        { id: 'admin.usuarios.editar', label: 'Editar usuario' },
      ]},
      { id: 'admin.roles', label: 'Roles', ops: [
        { id: 'admin.roles.ver',      label: 'Ver roles' },
        { id: 'admin.roles.crear',    label: 'Crear rol' },
        { id: 'admin.roles.editar',   label: 'Editar rol' },
        { id: 'admin.roles.eliminar', label: 'Eliminar rol' },
      ]},
      { id: 'admin.permisos', label: 'Permisos', ops: [
        { id: 'admin.permisos.ver',    label: 'Ver permisos' },
        { id: 'admin.permisos.editar', label: 'Editar permisos' },
      ]},
      { id: 'admin.sucursales', label: 'Sucursales', ops: [
        { id: 'admin.sucursales.ver',      label: 'Ver sucursales' },
        { id: 'admin.sucursales.crear',    label: 'Crear sucursal' },
        { id: 'admin.sucursales.editar',   label: 'Editar sucursal' },
        { id: 'admin.sucursales.eliminar', label: 'Eliminar sucursal' },
      ]},
      { id: 'admin.parametros', label: 'Parámetros', ops: [
        { id: 'admin.parametros.ver',    label: 'Ver parámetros' },
        { id: 'admin.parametros.editar', label: 'Editar parámetros' },
      ]},
    ],
  },
]

// Mapeo PERM_MODULE id → valor de empresa_modulos.modulo en BD maestra
// Sub-secciones (altas, consultas, listados) heredan el módulo padre
export const PERM_MODULE_BD_KEY: Record<string, string> = {
  'ventas':     'ventas',
  'inventario': 'inventario',
  'altas':      'altas',
  'consultas':  'consultas',
  'listados':   'listados',
  'fondos':     'fondos',
  'optica':     'optica',
  'admin':      'administracion',
}

export const ALL_OPERATIONS: string[] = PERM_MODULES.flatMap(
  (m) => m.subs.flatMap((s) => s.ops.map((o) => o.id))
)

// Ordered most-specific first so the first match wins
export const ROUTE_TO_PERM: [string, string][] = [
  ['/dashboard/ventas/pos',                   'ventas.pos.cobrar'],
  ['/dashboard/ventas/ordenes',               'ventas.ordenes.ver'],
  ['/dashboard/ventas/clientes',              'ventas.clientes.ver'],
  ['/dashboard/ventas/notas-credito',         'ventas.notas-credito.ver'],
  ['/dashboard/ventas',                       'ventas.historial.ver'],
  ['/dashboard/inventario/articulos',         'inventario.articulos.ver'],
  ['/dashboard/inventario/remitos/ajustes',   'inventario.ajustes.ver'],
  ['/dashboard/inventario/remitos',           'inventario.remitos.ver'],
  ['/dashboard/inventario/proveedores',       'inventario.proveedores.ver'],
  ['/dashboard/consultas/stock',              'consultas.stock.ver'],
  ['/dashboard/consultas/seguimiento',        'consultas.seguimiento.ver'],
  ['/dashboard/consultas/precios-costo',     'consultas.precios_costo.ver'],
  ['/dashboard/listados/cobranzas',           'listados.cobranzas.ver'],
  ['/dashboard/listados/ventas-articulos',    'listados.ventas_articulos.ver'],
  ['/dashboard/listados/precios',             'listados.precios.ver'],
  ['/dashboard/listados/movimientos-caja',     'listados.movimientos_caja.ver'],
  ['/dashboard/fondos',                        'fondos.caja.ver'],
  ['/dashboard/fondos/historial',             'fondos.caja.ver'],
  ['/dashboard/fondos/cobranzas',             'fondos.cobranzas.ver'],
  ['/dashboard/fondos/recibos',               'fondos.recibos.ver'],
  ['/dashboard/optica/ordenes',               'optica.ordenes.ver'],
  ['/dashboard/optica/servicios',             'optica.servicios.ver'],
  ['/dashboard/optica/medicos',               'optica.medicos.ver'],
  ['/dashboard/altas/marcas',                 'altas.marcas.ver'],
  ['/dashboard/altas/categorias',             'altas.categorias.ver'],
  ['/dashboard/altas/subcategorias',          'altas.subcategorias.ver'],
  ['/dashboard/altas/atributos',              'altas.atributos.ver'],
  ['/dashboard/admin/sucursales',             'admin.sucursales.ver'],
  ['/dashboard/admin/usuarios',               'admin.usuarios.ver'],
  ['/dashboard/admin/roles',                  'admin.roles.ver'],
  ['/dashboard/admin/permisos',               'admin.permisos.ver'],
  ['/dashboard/admin/listas-precio',          'altas.listas_precio.ver'],
  ['/dashboard/admin/vendedores',             'altas.vendedores.ver'],
  ['/dashboard/admin/formas-pago',            'altas.formas_pago.ver'],
  ['/dashboard/admin/parametros',             'admin.parametros.ver'],
  ['/dashboard/inventario/importar-optica',    'optica.ordenes.ver'],
  ['/dashboard/inventario/actualizar-precios','inventario.articulos.ver'],
]
