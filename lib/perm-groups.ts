export type PermOp  = { id: string; label: string }
export type PermSub = { id: string; label: string; ops: PermOp[] }
export type PermMod = { id: string; label: string; subs: PermSub[] }

export const PERM_MODULES: PermMod[] = [
  {
    id: 'ventas', label: 'Ventas',
    subs: [
      { id: 'ventas.pos', label: 'Punto de Venta', ops: [
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
    ],
  },
  {
    id: 'caja', label: 'Caja',
    subs: [
      { id: 'caja.caja', label: 'Caja', ops: [
        { id: 'caja.caja.ver',        label: 'Ver estado de caja' },
        { id: 'caja.caja.abrir',      label: 'Abrir caja' },
        { id: 'caja.caja.cerrar',     label: 'Cerrar caja' },
        { id: 'caja.caja.movimiento', label: 'Registrar ingreso/egreso' },
      ]},
      { id: 'caja.cobranzas', label: 'Cobranzas', ops: [
        { id: 'caja.cobranzas.ver', label: 'Ver cobranzas' },
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
      { id: 'admin.listas_precio', label: 'Listas de precio', ops: [
        { id: 'admin.listas_precio.ver',      label: 'Ver listas de precio' },
        { id: 'admin.listas_precio.crear',    label: 'Crear lista de precio' },
        { id: 'admin.listas_precio.editar',   label: 'Editar lista de precio' },
        { id: 'admin.listas_precio.eliminar', label: 'Desactivar lista de precio' },
      ]},
    ],
  },
]

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
  ['/dashboard/caja',                         'caja.caja.ver'],
  ['/dashboard/cobranzas',                    'caja.cobranzas.ver'],
  ['/dashboard/optica/ordenes',               'optica.ordenes.ver'],
  ['/dashboard/optica/medicos',               'optica.medicos.ver'],
  ['/dashboard/altas/marcas',                 'altas.marcas.ver'],
  ['/dashboard/altas/categorias',             'altas.categorias.ver'],
  ['/dashboard/altas/subcategorias',          'altas.subcategorias.ver'],
  ['/dashboard/altas/atributos',              'altas.atributos.ver'],
  ['/dashboard/admin/sucursales',             'admin.sucursales.ver'],
  ['/dashboard/admin/usuarios',               'admin.usuarios.ver'],
  ['/dashboard/admin/roles',                  'admin.roles.ver'],
  ['/dashboard/admin/permisos',               'admin.permisos.ver'],
  ['/dashboard/admin/listas-precio',          'admin.listas_precio.ver'],
]
