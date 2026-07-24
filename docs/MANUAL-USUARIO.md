# MgaPOS - Manual de Usuario

Guia completa de todos los modulos y operaciones del sistema.

---

## 1. VENTAS

### 1.1 Ticket de Venta (POS)

Direccion: `/dashboard/ventas/pos`

El punto de venta para realizar ventas directas al contado o con otros medios de pago.

**Flujo de una venta:**

1. **Seleccionar cliente** (opcional) - Buscar por nombre o crear uno nuevo con el icono `+`
2. **Buscar articulos** - Usar el buscador por codigo, nombre o codigo de barras
3. **Seleccionar variante** - Si el articulo tiene variantes (talle, color, etc.), se abre un selector
4. **Ajustar cantidad** - Usar los botones `+` y `-` o escribir directamente
5. **Descuento por articulo** - Opcional, aplicar descuento individual
6. **Seleccionar vendedor** - Opcional, asociar la venta a un vendedor
7. **Elegir lista de precio** - Por defecto usa la lista de venta publico
8. **Configurar pagos** - Seleccionar metodo de pago (Efectivo, Tarjeta, Cuenta Corriente, Nota de Credito, etc.)
   - Se pueden combinar multiples metodos de pago (ej: parte efectivo, parte tarjeta)
   - Para Cuenta Corriente es obligatorio seleccionar cliente
   - Para Nota de Credito hay que seleccionar la NC del cliente
9. **Confirmar venta** - El sistema calcula automaticamente el vuelto si paga en efectivo
10. **Imprimir ticket** - Opcion para imprimir el comprobante

**Restricciones:**
- Debe tener una caja abierta en la sucursal actual
- Si el parametro `controla_stock` esta activo, se valida que haya stock suficiente
- El total de la venta debe ser mayor a cero
- El monto pagado debe cubrir el total

### 1.2 Historial de Ventas

Direccion: `/dashboard/ventas`

Lista todas las ventas realizadas con filtros por fecha, cliente y vendedor.

**Operaciones:**
- **Ver historial** - Consultar ventas con filtros de busqueda
- **Ver detalle** - Ver el detalle completo de una venta (items, pagos, datos del cliente)
- **Imprimir** - Reimprimir el ticket de una venta
- **Anular venta** - Solo si tiene permiso. La anulacion devuelve el stock y registra el movimiento

### 1.3 Ordenes de Venta

Direccion: `/dashboard/ventas/ordenes`

Las ordenes de venta son pre-ventas que pueden confirmarse o anularse antes de convertirse en venta efectiva.

**Operaciones:**
- **Crear orden** - Similar al POS pero sin cobro inmediato
- **Editar orden** - Modificar items, cliente, vendedor
- **Confirmar orden** - Convierte la orden en venta efectiva y descuenta stock
- **Anular orden** - Cancela la orden sin efecto en stock ni caja

### 1.4 Clientes

Direccion: `/dashboard/ventas/clientes` (tambien accesible desde el POS)

Gestion de la base de datos de clientes.

**Operaciones:**
- **Ver clientes** - Listado con busqueda por nombre
- **Crear cliente** - Nombre (requerido), tipo (Particular/Empresa/Comercio), CUIT/DNI, telefono, email, direccion, localidad, notas
- **Editar cliente** - Modificar datos del cliente
- **Desactivar cliente** - Baja logica (el cliente no se elimina, solo se desactiva)

### 1.5 Notas de Credito

Direccion: `/dashboard/ventas/notas-credito`

Documentos de credito que se emiten a favor del cliente (devoluciones, ajustes, etc.).

**Operaciones:**
- **Crear nota de credito** - Seleccionar cliente, monto, fecha y observaciones. Opcionalmente asociar a un vendedor
- **Ver notas de credito** - Listado de NC emitidas
- **Anular nota de credito** - Cancelar una NC sin efecto
- **Usar en POS** - Las NC se pueden aplicar como metodo de pago en el POS

---

## 2. INVENTARIO

### 2.1 Articulos

Direccion: `/dashboard/inventario/articulos`

ABM completo de articulos del negocio.

**Tipos de articulo:**
- **Simple** - Articulo sin variantes (ej: un lente de sol unico)
- **Con variantes** - Articulo con sub-opciones (ej: remera con talles y colores)

**Campos principales:**
- Codigo (unico), nombre, descripcion
- Tipo de articulo (simple/con variantes)
- Categoria, marca, proveedor
- Precio de venta y precio de compra (se actualizan automaticamente desde listas de precio y remitos)
- Stock actual y stock minimo (se calculan desde el stock por sucursal)
- Unidad de medida, codigo de barras, imagen

**Operaciones:**
- **Ver articulos** - Listado con busqueda por nombre o codigo
- **Crear articulo** - Alta de nuevo articulo
- **Editar articulo** - Modificar datos del articulo
- **Desactivar articulo** - Baja logica

### 2.2 Remitos

Direccion: `/dashboard/inventario/remitos`

Documentos de entrada y salida de mercaderia. Los remitos impactan directamente en el stock.

**Flujo de un remito de entrada (compra a proveedor):**

1. **Crear remito** - Seleccionar proveedor, fecha, vendedor (opcional)
2. **Agregar articulos** - Buscar articulo, cantidad, costo unitario
3. **Confirmar remito** - Al confirmar:
   - Se incrementa el stock del articulo en la sucursal
   - Se actualiza el precio de compra del articulo
   - Se genera un movimiento de stock tipo "entrada"
   - Se registra el historial de precios de costo

**Flujo de un remito de salida (envio a otra sucursal/proveedor):**

1. Crear remito seleccionando tipo "salida"
2. Seleccionar destino
3. Agregar articulos y cantidades
4. Confirmar - el stock disminuye

**Operaciones:**
- **Crear remito** - Alta de nuevo remito
- **Confirmar remito** - Aplica el movimiento de stock (irreversible)
- **Anular remito** - Solo si no fue confirmado
- **Ver remitos** - Listado con filtros

### 2.3 Ajustes de Stock

Direccion: `/dashboard/inventario/remitos/ajustes`

Ajustes manuales de stock para corregir diferencias de inventario.

**Operaciones:**
- **Ver ajustes** - Historial de ajustes realizados
- **Aplicar ajuste** - Seleccionar articulo/sucursal, cantidad nueva o diferencia, observaciones. Se genera un movimiento tipo "ajuste"

### 2.4 Proveedores

Direccion: `/dashboard/inventario/proveedores`

ABM de proveedores del negocio.

**Campos:** nombre, contacto, CUIT, telefono, direccion, localidad, provincia, codigo postal, tipo IVA

**Operaciones:**
- **Ver proveedores** - Listado con busqueda
- **Crear proveedor** - Alta de nuevo proveedor
- **Editar proveedor** - Modificar datos
- **Desactivar proveedor** - Baja logica

### 2.5 Importaciones

Direccion: `/dashboard/inventario/importar-*`

Importacion masiva de datos desde archivos CSV/Excel.

**Importar articulos** (`/dashboard/inventario/importar-articulos`)
- Subir CSV con articulos. El sistema detecta separador automaticamente
- Mapeo de columnas por nombre (ej: `codigo`, `nombre`, `precio_venta`, `stock`)
- Preview antes de importar

**Importar stock** (`/dashboard/inventario/importar-stock`)
- Subir CSV con columnas `codigo` y `stock`
- Crea un remito de entrada por articulo para ajustar el stock

**Importar proveedores** (`/dashboard/inventario/importar-proveedores`)
- Subir CSV con datos de proveedores (formato-specifico del sistema anterior)
- Si el ID del proveedor ya existe, lo actualiza; si no, lo crea nuevo

**Importar optica** (`/dashboard/inventario/importar-optica`)
- Importador con pestanas para: Proveedores, Articulos, Precios, Stock

---

## 3. CONSULTAS

### 3.1 Stock y Precios

Direccion: `/dashboard/consultas/stock`

Vista consolidada del stock y precios de todos los articulos.

**Operaciones:**
- **Ver stock y precios** - Consultar stock actual por sucursal, precios de venta y compra, historial de movimientos

### 3.2 Seguimiento

Direccion: `/dashboard/consultas/seguimiento`

Seguimiento de operaciones y actividad del sistema.

### 3.3 Precios de Costo

Direccion: `/dashboard/consultas/precios-costo`

Historial de precios de compra de los articulos, util para analizar la evolucion de costos.

---

## 4. LISTADOS

### 4.1 Listado de Cobranzas

Direccion: `/dashboard/listados/cobranzas`

Reporte de cobranzas realizadas por periodo, metodo de pago y vendedor.

### 4.2 Listado de Ventas por Articulo

Direccion: `/dashboard/listados/ventas-articulos`

Ranking de articulos vendidos con cantidades, montos y tendencias.

### 4.3 Listado de Precios

Direccion: `/dashboard/listados/precios`

Listado imprimible de precios de venta de todos los articulos.

### 4.4 Movimientos de Caja

Direccion: `/dashboard/listados/movimientos-caja`

Reporte detallado de todos los movimientos de caja (aperturas, cierres, ingresos, egresos, ventas).

---

## 5. FONDOS

### 5.1 Caja

Direccion: `/dashboard/fondos`

Gestion de la caja diaria (fondo fijo, arqueo, movimientos).

**Flujo completo:**

1. **Abrir caja** - Ingresar monto de apertura y opcionalmente asociar un vendedor
2. **Registrar movimientos** - Ingresos y egresos varios con concepto, monto, tipo (ingreso/egreso) y vendedor
3. **Cerrar caja** - El sistema calcula automaticamente:
   - Monto esperado = apertura + ingresos - egresos + ventas
   - Diferencia = monto cerrado - monto esperado
   - Se puede agregar observaciones al cierre

**Operaciones:**
- **Ver estado de caja** - Monto actual, estado (abierta/cerrada), movimientos del dia
- **Abrir caja** - Iniciar el dia con un monto de apertura
- **Cerrar caja** - Cerrar la sesion y arquear
- **Registrar ingreso/egreso** - Movimientos manuales de dinero
- **Anular movimientos** - Anular un movimiento registrado

**Nota:** No se puede vender desde el POS si no hay una caja abierta en la sucursal.

### 5.2 Cobranzas

Direccion: `/dashboard/fondos/cobranzas`

Cobranzas de cuenta corriente de clientes. Registro de pagos de deudas pendientes.

### 5.3 Recibos

Direccion: `/dashboard/fondos/recibos`

Emision de recibos oficiales para cobranzas realizadas.

---

## 6. OPTICA

Modulo especializado para negocios de optica con gestion de ordenes de trabajo y servicios.

### 6.1 Ordenes de Trabajo (OT)

Direccion: `/dashboard/optica/ordenes`

Gestion de pedidos de armazon + cristales para clientes.

**Flujo de una OT:**

1. **Crear OT** - Seleccionar cliente, vendedor (opcional)
2. **Agregar items** - Articulos con variantes (armazon, cristal, tratamiento, etc.)
   - Cada item puede tener uso: "Propio del negocio" o "Del cliente"
3. **Asignar medico** - Opcional, asociar oftalmologo
4. **Estado de la OT** - Flujo: Pendiente → En proceso → Lista para entregar → Entregada
5. **Registrar pago** - Pago parcial o total de la OT
6. **Entregar** - Marcar como entregada y generar venta

**Estados posibles:**
- Pendiente
- En proceso (lente en armado)
- Lista para entregar
- Entregada (genera venta)
- Anulada

**Operaciones:**
- **Ver OT** - Listado con filtros por estado, cliente, fecha
- **Crear OT** - Nueva orden de trabajo
- **Editar OT** - Modificar items, cliente, datos clinicos
- **Cambiar estado** - Avanzar o retroceder en el flujo
- **Registrar pago** - Cuenta parcial o total

### 6.2 Servicios

Direccion: `/dashboard/optica/servicios`

Servicios de optica que no generan orden de trabajo (adaptaciones, reparaciones, etc.).

**Flujo:**
1. **Crear servicio** - Seleccionar cliente, tipo de servicio, descripcion
2. **Agregar items** - Articulos utilizados
3. **Registrar pago** - Cobro del servicio
4. **Estado** - Pendiente → Completado / Anulado

**Operaciones:**
- **Ver servicios** - Listado con filtros
- **Crear servicio** - Nuevo servicio
- **Editar servicio** - Modificar datos
- **Anular servicio** - Cancelar sin efecto

### 6.3 Medicos

Direccion: `/dashboard/optica/medicos`

ABM de oftalmologos asociados al negocio.

**Operaciones:**
- **Ver medicos** - Listado
- **Crear medico** - Nombre y datos de contacto
- **Editar medico** - Modificar datos
- **Eliminar medico** - Baja definitiva

### 6.4 Importar Clientes

Direccion: `/dashboard/optica/importar-clientes`

Importacion masiva de clientes desde CSV con columnas `nombre` y `telefono`.

---

## 7. ALTAS (Tablas de referencia)

### 7.1 Marcas

Direccion: `/dashboard/altas/marcas`

ABM de marcas de articulos.

**Operaciones:** Ver, crear, editar, eliminar

### 7.2 Categorias

Direccion: `/dashboard/altas/categorias`

ABM de categorias de articulos (ej: Lentes, Armazones, Accesorios).

**Operaciones:** Ver, crear, editar, eliminar

### 7.3 Subcategorias

Direccion: `/dashboard/altas/subcategorias`

ABM de subcategorias dentro de una categoria.

**Operaciones:** Ver, crear, editar, eliminar

### 7.4 Atributos

Direccion: `/dashboard/altas/atributos`

ABM de atributos para variantes de articulos (ej: Talle, Color, Material).

**Operaciones:** Ver, crear, editar, eliminar

### 7.5 Listas de Precio

Direccion: `/dashboard/admin/listas-precio`

Gestion de las listas de precio del negocio.

**Tipos:**
- **Manual** - Se cargan precios individuales por articulo
- **Calculada** - Se genera automaticamente con un porcentaje de recargo sobre una lista base

**Listas por defecto:**
- Compra (costo)
- Venta Publico (calculada, 30% sobre Compra)
- Venta Mayorista (manual)

**Operaciones:** Ver, crear, editar, desactivar

### 7.6 Vendedores

Direccion: `/dashboard/admin/vendedores`

ABM de vendedores del negocio. Se asocian a ventas, caja y ordenes para reportes de comisiones.

**Operaciones:** Ver, crear, editar

### 7.7 Formas de Pago

Direccion: `/dashboard/admin/formas-pago`

ABM de metodos de pago aceptados (Efectivo, Tarjeta de credito, Debito, Transferencia, etc.).

**Operaciones:** Ver, crear, editar, eliminar

---

## 8. ADMINISTRACION

### 8.1 Usuarios

Direccion: `/dashboard/admin/usuarios`

Gestion de usuarios del sistema (empleados que acceden al POS).

**Campos:** nombre, email, rol, sucursal asignada

**Operaciones:**
- **Ver usuarios** - Listado con rol y sucursal
- **Crear usuario** - Alta de nuevo usuario
- **Editar usuario** - Modificar datos, rol o sucursal

### 8.2 Roles

Direccion: `/dashboard/admin/roles`

Gestion de roles y permisos del sistema.

**Roles por defecto:**
- **Administrador** - Acceso total a todas las funcionalidades
- **Supervisor** - Acceso amplio con algunas restricciones
- **Vendedor** - Acceso basico para operar el POS

**Operaciones:**
- **Ver roles** - Listado de roles
- **Crear rol** - Nuevo rol con nombre personalizado
- **Editar rol** - Modificar nombre
- **Eliminar rol** - Solo roles creados (no los por defecto)

### 8.3 Permisos

Direccion: `/dashboard/admin/permisos`

Matriz de permisos por rol. Controla que puede ver y hacer cada rol.

**Estructura:** Modulo > Submodulo > Operacion

**Modulos disponibles:**
- Ventas (POS, historial, ordenes, clientes, notas de credito)
- Inventario (articulos, remitos, ajustes, proveedores, importaciones)
- Consultas (stock, seguimiento, precios de costo)
- Listados (cobranzas, ventas por articulo, precios, movimientos de caja)
- Fondos (caja, cobranzas, recibos)
- Optica (ordenes, servicios, medicos, importaciones)
- Altas (marcas, categorias, subcategorias, atributos, listas de precio, vendedores, formas de pago)
- Administracion (usuarios, roles, permisos, sucursales, parametros)

**Como funciona:**
- El Administrador tiene acceso total (no necesita permisos asignados)
- Para otros roles, se activan/desactivan operaciones individuales
- Los permisos se aplican tanto a la navegacion del sidebar como a las rutas de la API

### 8.4 Sucursales

Direccion: `/dashboard/admin/sucursales`

Gestion de sucursales del negocio. Cada sucursal tiene su propio stock.

**Campos:** nombre, direccion, telefono, logo, color, controla_stock (si valida stock al vender)

**Operaciones:**
- **Ver sucursales** - Listado
- **Crear sucursal** - Nueva sucursal
- **Editar sucursal** - Modificar datos
- **Eliminar sucursal** - Baja (solo si no tiene datos asociados)

### 8.5 Parametros

Direccion: `/dashboard/admin/parametros`

Configuracion global del sistema.

**Parametros principales:**
- `controla_stock` - Si esta en `true`, el POS valida stock suficiente antes de vender
- `lista_precio_defecto_id` - Lista de precio que se usa por defecto en el POS
- `numeradores` - Configuracion de numeracion de comprobantes

**Operaciones:**
- **Ver parametros** - Consultar configuracion actual
- **Editar parametros** - Modificar valores (solo Administrador)

### 8.6 Backup

Direccion: `/dashboard/admin/backup`

Exportacion completa de la base de datos del tenant a formato Excel.

- Genera un archivo .xlsx con todas las tablas del sistema
- Incluye: ventas, articulos, stock, clientes, proveedores, caja, etc.
- Disponible solo para Administradores
- El archivo se descarga automaticamente

---

## SUPERADMIN (Plataforma)

Acceso via `/superadmin` con contraseña dedicada.

### Funciones:

- **Listar empresas** - Ver todas las empresas del tenant
- **Primer acceso** - Crear usuario administrador y primera sucursal para una empresa nueva
- **Resetear datos** - Eliminar todos los datos operacionales de una empresa (conserva usuarios, roles, permisos)
- **Limpiar stock** - Poner stock en 0 de una sucursal especifica
- **Limpiar precios** - Eliminar todo el historial de precios de una empresa

---

## GLOSARIO

| Termino | Significado |
|---------|-------------|
| POS | Punto de venta - pantalla de cobro |
| OT | Orden de trabajo - pedido de optica |
| NC | Nota de credito - documento de credito a favor del cliente |
| Remito | Documento de entrada/salida de mercaderia |
| Variante | Sub-opcion de un articulo (ej: remera talla M color azul) |
| Lista de precio | Conjunto de precios para un grupo de articulos |
| Cuenta corriente | Credito al cliente - puede deber y pagar despues |
| Arqueo | Conteo fisico del dinero en caja al cerrar |
| Tenant | Cada empresa es un tenant aislado con su propia base de datos |
| Sucursal | Local/filial del negocio, tiene stock propio |
