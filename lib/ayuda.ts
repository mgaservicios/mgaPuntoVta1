export interface AyudaOperacion {
  id: string
  nombre: string
  descripcion: string
  pasos?: string[]
  tips?: string[]
}

export interface AyudaModulo {
  id: string
  titulo: string
  icono: string
  color: string
  descripcion: string
  operaciones: AyudaOperacion[]
}

export const AYUDA_MODULOS: AyudaModulo[] = [
  {
    id: 'ventas',
    titulo: 'Ventas',
    icono: '🛒',
    color: 'blue',
    descripcion: 'Módulo principal de ventas. Permite realizar tickets en el punto de venta (POS), gestionar órdenes de venta, consultar el historial, administrar clientes y emitir notas de crédito.',
    operaciones: [
      {
        id: 'ventas-pos',
        nombre: 'Ticket de Venta (POS)',
        descripcion: 'El Punto de Venta permite registrar ventas en mostrador de forma rápida. Se agregan artículos por código, nombre o escáner, se aplican descuentos y se cobra con una o más formas de pago.',
        pasos: [
          'Ingresar al menú Ventas → Ticket de Venta.',
          'Buscar artículos escribiendo el código, nombre o parte del nombre en el campo de búsqueda.',
          'Seleccionar el artículo: se agrega a la grilla de la venta.',
          'Ajustar cantidad haciendo clic sobre la columna Cant. o usando las flechas.',
          'Para aplicar descuento por ítem, hacer clic en el campo % Desc. de esa línea.',
          'Cuando la venta esté completa, presionar el botón "Cobrar" (o F4).',
          'En la pantalla de cobro, seleccionar la forma de pago e ingresar el monto recibido.',
          'Confirmar el cobro. El sistema imprime/muestra el ticket y descuenta el stock.',
        ],
        tips: [
          'Se pueden usar múltiples formas de pago en una misma venta (ej. parte en efectivo, parte con tarjeta).',
          'Si el artículo tiene variantes (talle, color), el sistema las mostrará para que el usuario elija.',
          'El campo de búsqueda acepta código de barras: apuntar el escáner directamente allí.',
        ],
      },
      {
        id: 'ventas-ordenes',
        nombre: 'Órdenes de Venta',
        descripcion: 'Las órdenes de venta permiten presupuestar o confirmar ventas que no se cobran en el momento. Pueden quedar en estado Presupuesto, Confirmada o Anulada.',
        pasos: [
          'Ir a Ventas → Órdenes de venta.',
          'Presionar "Nueva orden".',
          'Seleccionar el cliente (obligatorio para órdenes).',
          'Agregar los artículos igual que en el POS.',
          'Guardar como Presupuesto (sin descontar stock) o Confirmar (descuenta stock).',
          'Para cobrar una orden confirmada: abrirla y presionar "Cobrar".',
        ],
        tips: [
          'Los presupuestos no mueven stock ni generan deuda en cuenta corriente.',
          'Al confirmar, la orden pasa a cuenta corriente del cliente si no se cobra en el momento.',
          'Se puede imprimir el presupuesto para entregárselo al cliente.',
        ],
      },
      {
        id: 'ventas-historial',
        nombre: 'Historial de Ventas',
        descripcion: 'Muestra todas las ventas realizadas con filtros por fecha, sucursal, vendedor, cliente y estado. Permite ver el detalle de cada venta y reimprimirla.',
        pasos: [
          'Ir a Ventas → Historial.',
          'Aplicar los filtros deseados: rango de fechas, sucursal, vendedor o cliente.',
          'Hacer clic en una venta para ver su detalle completo.',
          'Desde el detalle se puede reimprimir o anular la venta (si tiene permiso).',
        ],
        tips: [
          'El historial muestra tanto tickets de POS como órdenes de venta cobradas.',
          'Las ventas anuladas aparecen tachadas o con estado "Anulado".',
        ],
      },
      {
        id: 'ventas-clientes',
        nombre: 'Clientes',
        descripcion: 'Gestión del padrón de clientes. Permite crear, editar y consultar clientes, así como ver su cuenta corriente y el historial de compras.',
        pasos: [
          'Ir a Ventas → Clientes.',
          'Para crear un cliente: presionar "Nuevo cliente" e ingresar los datos.',
          'Para editar: buscar el cliente y hacer clic en su nombre.',
          'Desde la ficha del cliente se accede al saldo de cuenta corriente y el historial de compras.',
        ],
        tips: [
          'El DNI/CUIT es recomendado para identificar unívocamente al cliente.',
          'Los clientes con cuenta corriente tienen un límite de crédito configurable.',
        ],
      },
      {
        id: 'ventas-nc',
        nombre: 'Notas de Crédito',
        descripcion: 'Las notas de crédito permiten acreditar importes a un cliente, ya sea por devolución de mercadería o por error en una venta anterior.',
        pasos: [
          'Ir a Ventas → Notas de crédito.',
          'Presionar "Nueva nota de crédito".',
          'Seleccionar el cliente y el motivo.',
          'Ingresar los artículos o el importe a acreditar.',
          'Confirmar. El saldo queda disponible en la cuenta corriente del cliente.',
        ],
        tips: [
          'Las notas de crédito pueden aplicarse al cobrar la próxima orden del mismo cliente.',
          'Si la nota es por devolución de artículos, el stock se reintegra automáticamente.',
        ],
      },
    ],
  },
  {
    id: 'inventario',
    titulo: 'Inventario',
    icono: '📦',
    color: 'emerald',
    descripcion: 'Gestión completa del inventario: artículos, remitos de entrada/salida, proveedores, ajustes de stock y actualización de precios.',
    operaciones: [
      {
        id: 'inventario-articulos',
        nombre: 'Artículos',
        descripcion: 'Catálogo completo de artículos. Permite crear, editar, buscar y controlar todos los productos del negocio con sus precios, stock y variantes.',
        pasos: [
          'Ir a Inventario → Artículos.',
          'Para crear: presionar "Nuevo artículo" e ingresar código, nombre, categoría, precios y stock inicial.',
          'Para editar: buscar el artículo por nombre o código y hacer clic para abrirlo.',
          'Los artículos pueden tener variantes (ej. talle y color): configurarlas en la pestaña "Variantes".',
        ],
        tips: [
          'El código de barras debe ser único por artículo/variante.',
          'Activar "Controla stock" para que el sistema valide disponibilidad al vender.',
          'Los precios pueden pertenecer a diferentes listas (minorista, mayorista, etc.).',
        ],
      },
      {
        id: 'inventario-remitos',
        nombre: 'Remitos',
        descripcion: 'Registro de entradas y salidas de stock por remitos de proveedor o transferencias entre sucursales. Cada remito actualiza el stock en tiempo real.',
        pasos: [
          'Ir a Inventario → Remitos.',
          'Presionar "Nuevo remito" y elegir el tipo (entrada o salida).',
          'Seleccionar el proveedor (para entradas) o la sucursal destino (para transferencias).',
          'Agregar los artículos con cantidad y precio de costo.',
          'Confirmar el remito para que impacte en el stock.',
        ],
        tips: [
          'Los remitos anulados revierten el movimiento de stock.',
          'Se puede agregar el número de remito del proveedor para trazabilidad.',
        ],
      },
      {
        id: 'inventario-proveedores',
        nombre: 'Proveedores',
        descripcion: 'Padrón de proveedores utilizados para asociar remitos de compra y controlar costos.',
        pasos: [
          'Ir a Inventario → Proveedores.',
          'Crear nuevo proveedor con razón social, CUIT y datos de contacto.',
          'Asociar el proveedor al crear remitos de entrada de stock.',
        ],
        tips: [
          'Los proveedores con cuenta corriente registran las deudas generadas por remitos.',
        ],
      },
      {
        id: 'inventario-ajustes',
        nombre: 'Ajustes de Stock',
        descripcion: 'Permite corregir el stock de artículos sin necesidad de un remito formal. Útil para inventarios físicos o correcciones por merma.',
        pasos: [
          'Ir a Inventario → Ajustes de stock.',
          'Seleccionar el artículo a ajustar.',
          'Ingresar la cantidad nueva o la diferencia (positiva o negativa).',
          'Ingresar el motivo del ajuste.',
          'Confirmar. El stock se actualiza de inmediato.',
        ],
        tips: [
          'Los ajustes quedan registrados en el historial de movimientos de stock.',
          'Usar ajustes negativos para registrar mermas, roturas o artículos faltantes.',
        ],
      },
      {
        id: 'inventario-precios',
        nombre: 'Actualizar Precios',
        descripcion: 'Herramienta para actualizar precios de venta en forma masiva, por categoría, marca o selección manual, aplicando porcentajes de aumento o nuevos valores.',
        pasos: [
          'Ir a Inventario → Actualizar precios.',
          'Filtrar los artículos por categoría, marca o proveedor.',
          'Elegir el tipo de actualización: porcentaje de aumento o valor fijo.',
          'Ingresar el porcentaje o valor.',
          'Revisar la previsualización y confirmar la actualización.',
        ],
        tips: [
          'Se puede actualizar una lista de precios específica sin afectar las demás.',
          'La actualización es irreversible; verificar bien antes de confirmar.',
        ],
      },
      {
        id: 'inventario-importar-articulos',
        nombre: 'Importar Artículos (alta masiva)',
        descripcion: 'Permite crear artículos en forma masiva subiendo un archivo Excel (.xlsx, .xls) o CSV. Cada fila del archivo representa un artículo nuevo. Si categorías, subcategorías, marcas o proveedores no existen, el sistema los crea automáticamente.',
        pasos: [
          'Ir a Inventario → Importar artículos.',
          'Preparar un archivo Excel o CSV con los artículos a importar.',
          'La primera fila debe ser el encabezado con los nombres de columna (no distingue mayúsculas ni separadores).',
          'Arrastrar el archivo a la zona de carga o hacer clic para seleccionarlo.',
          'El sistema muestra una previsualización de las primeras 8 filas detectadas.',
          'Verificar que las columnas estén correctamente mapeadas.',
          'Presionar "Importar N artículos" para confirmar.',
          'Al finalizar, el sistema indica cuántos artículos se importaron y lista los errores si los hay.',
        ],
        tips: [
          'Columnas OBLIGATORIAS: nombre y proveedor. Sin alguna de estas, la fila se descarta.',
          'Columnas OPCIONALES: codigo (se genera automáticamente si está vacío), categoria, subcategoria, marca, unidad, precio_compra, precio_venta, precio_mayorista.',
          'Los precios se asignan a las listas configuradas: precio_compra → lista 1 (costo), precio_venta → lista 2 (minorista), precio_mayorista → lista 3.',
          'Si las listas de precio son "calculadas", los precios vacíos se calculan automáticamente a partir del costo.',
          'Separadores CSV aceptados: punto y coma (;), coma (,), tabulador (TAB) o pipe (|). El sistema los detecta automáticamente.',
          'Si una fila aparece descartada, revisar que tenga nombre y proveedor completos.',
          'El importador crea artículos nuevos; no actualiza artículos existentes. Para actualizar stock usar "Importar Stock".',
        ],
      },
      {
        id: 'inventario-importar-stock',
        nombre: 'Importar Stock (carga masiva de cantidades)',
        descripcion: 'Permite aumentar el stock de artículos existentes en forma masiva subiendo un archivo Excel o CSV con códigos y cantidades. El sistema genera remitos de entrada confirmados automáticamente.',
        pasos: [
          'Ir a Inventario → Importar stock.',
          'Preparar un archivo Excel (.xlsx, .xls) o CSV con dos columnas: codigo y stock.',
          'La primera fila debe ser el encabezado.',
          'Arrastrar el archivo a la zona de carga o hacer clic para seleccionarlo.',
          'El sistema muestra una previsualización con los artículos detectados y la cantidad a ingresar.',
          'Verificar la lista. Las filas con código vacío o stock 0 o negativo se descartan automáticamente.',
          'Presionar "Importar N artículos" para confirmar.',
          'El sistema genera remitos de entrada confirmados (hasta 50 ítems por remito) y suma las cantidades al stock de la sucursal activa.',
        ],
        tips: [
          'Columnas OBLIGATORIAS: codigo (código del artículo existente) y stock (cantidad a ingresar, debe ser mayor a 0).',
          'Nombres alternativos aceptados — para código: cod, codart, codarticulo. Para stock: cantidad, qty, cant.',
          'El stock se SUMA al stock actual; no lo reemplaza. Para corregir un stock a un valor exacto, usar Ajustes de stock.',
          'Solo funciona con artículos que ya existen en el sistema. Si el código no se encuentra, esa fila genera un error.',
          'Los remitos creados quedan visibles en Inventario → Remitos y pueden anularse si fue un error.',
          'Separadores CSV aceptados: punto y coma (;), coma (,), tabulador (TAB) o pipe (|). El sistema los detecta automáticamente.',
          'Se generan remitos de hasta 50 ítems cada uno. Una importación de 200 artículos generará 4 remitos.',
        ],
      },
    ],
  },
  {
    id: 'altas',
    titulo: 'Altas',
    icono: '🏷️',
    color: 'orange',
    descripcion: 'Tablas maestras del sistema: marcas, categorías, subcategorías, atributos, listas de precio, vendedores y formas de pago.',
    operaciones: [
      {
        id: 'altas-marcas',
        nombre: 'Marcas',
        descripcion: 'Gestión de marcas de artículos. Permite organizar el catálogo por fabricante o marca comercial.',
        pasos: [
          'Ir a Altas → Marcas.',
          'Presionar "Nueva marca" e ingresar el nombre.',
          'Guardar. La marca estará disponible al crear o editar artículos.',
        ],
        tips: [
          'Las marcas se pueden filtrar en las búsquedas de artículos y reportes.',
        ],
      },
      {
        id: 'altas-categorias',
        nombre: 'Categorías',
        descripcion: 'Categorías principales para clasificar los artículos del catálogo.',
        pasos: [
          'Ir a Altas → Categorías.',
          'Crear categoría ingresando nombre y opcionalmente una descripción.',
          'Las categorías agrupan artículos para búsquedas, reportes y actualización de precios masiva.',
        ],
        tips: [
          'Organizar bien las categorías facilita los reportes de venta por rubro.',
        ],
      },
      {
        id: 'altas-subcategorias',
        nombre: 'Subcategorías',
        descripcion: 'Subcategorías que dependen de una categoría principal, para una clasificación más detallada.',
        pasos: [
          'Ir a Altas → Subcategorías.',
          'Seleccionar la categoría padre.',
          'Crear la subcategoría con su nombre.',
        ],
        tips: [
          'Las subcategorías permiten filtros más específicos en consultas y reportes.',
        ],
      },
      {
        id: 'altas-atributos',
        nombre: 'Atributos',
        descripcion: 'Atributos de variantes de artículos (ej. Talle, Color). Cada atributo tiene valores posibles que se asignan a las variantes.',
        pasos: [
          'Ir a Altas → Atributos.',
          'Crear un atributo (ej. "Talle") y agregar sus valores (ej. S, M, L, XL).',
          'Al crear artículos con variantes, seleccionar los atributos correspondientes.',
        ],
        tips: [
          'Los atributos son globales y reutilizables en todos los artículos.',
        ],
      },
      {
        id: 'altas-listas',
        nombre: 'Listas de Precio',
        descripcion: 'Configuración de listas de precio diferenciadas (ej. minorista, mayorista, especial). Cada artículo puede tener precio distinto por lista.',
        pasos: [
          'Ir a Altas → Listas de precio.',
          'Crear una lista con nombre y descripción.',
          'Asignar la lista a clientes o usarla directamente al vender.',
        ],
        tips: [
          'La lista "por defecto" se usa cuando no se especifica otra al vender.',
          'Se puede asociar una lista a un cliente para que siempre use esos precios.',
        ],
      },
      {
        id: 'altas-vendedores',
        nombre: 'Vendedores',
        descripcion: 'Alta de vendedores para asignarlos a ventas y generar reportes de comisiones.',
        pasos: [
          'Ir a Altas → Vendedores.',
          'Crear vendedor con nombre y porcentaje de comisión.',
          'Al realizar una venta, seleccionar el vendedor responsable.',
        ],
        tips: [
          'Los reportes de ventas pueden filtrarse por vendedor para calcular comisiones.',
        ],
      },
      {
        id: 'altas-formas-pago',
        nombre: 'Formas de Pago',
        descripcion: 'Configuración de los medios de pago aceptados (efectivo, tarjeta, transferencia, cheque, etc.).',
        pasos: [
          'Ir a Altas → Formas de pago.',
          'Crear una forma de pago con nombre y tipo.',
          'Configurar si aplica recargo o descuento porcentual.',
          'Las formas de pago activas aparecen disponibles al cobrar.',
        ],
        tips: [
          'Las formas de pago desactivadas no aparecen en el punto de venta.',
          'El efectivo siempre debe existir como forma de pago base.',
        ],
      },
    ],
  },
  {
    id: 'consultas',
    titulo: 'Consultas',
    icono: '🔍',
    color: 'violet',
    descripcion: 'Consultas en tiempo real sobre stock, precios, movimientos de artículos y precios de costo.',
    operaciones: [
      {
        id: 'consultas-stock',
        nombre: 'Stock y Precios',
        descripcion: 'Consulta rápida del stock disponible y precios de todos los artículos. Permite buscar por nombre, código, categoría o marca.',
        pasos: [
          'Ir a Consultas → Stock y precios.',
          'Escribir el nombre, código o parte del nombre del artículo.',
          'El resultado muestra stock disponible por sucursal y precios por lista.',
          'Se puede filtrar por categoría, marca o proveedor.',
        ],
        tips: [
          'Esta pantalla es de solo lectura: no modifica precios ni stock.',
          'Los artículos con stock bajo aparecen resaltados en rojo o naranja.',
        ],
      },
      {
        id: 'consultas-seguimiento',
        nombre: 'Seguimiento de Movimientos',
        descripcion: 'Historial completo de movimientos de stock de un artículo: entradas por remito, salidas por venta, ajustes y transferencias.',
        pasos: [
          'Ir a Consultas → Seguimiento.',
          'Buscar el artículo.',
          'El sistema muestra todos los movimientos ordenados por fecha con origen y cantidad.',
        ],
        tips: [
          'Útil para detectar discrepancias de stock y rastrear su causa.',
          'Cada movimiento indica el documento de origen (remito, venta, ajuste).',
        ],
      },
      {
        id: 'consultas-costos',
        nombre: 'Precios de Costo',
        descripcion: 'Consulta de precios de costo de los artículos, visible solo para usuarios con permiso. Muestra el último costo registrado por remito.',
        pasos: [
          'Ir a Consultas → Precios de costo.',
          'Buscar el artículo.',
          'Se muestra el precio de costo actual y el historial de costos anteriores.',
        ],
        tips: [
          'El precio de costo se actualiza automáticamente al ingresar un remito de compra.',
          'Requiere permiso especial de acceso para proteger información sensible.',
        ],
      },
    ],
  },
  {
    id: 'fondos',
    titulo: 'Fondos',
    icono: '💰',
    color: 'amber',
    descripcion: 'Gestión de caja, arqueos, cierres de caja, cobranzas de cuenta corriente y emisión de recibos.',
    operaciones: [
      {
        id: 'fondos-caja',
        nombre: 'Caja',
        descripcion: 'Control del movimiento de efectivo del día. Muestra el saldo actual, ingresos, egresos y permite registrar movimientos manuales (retiros, fondos).',
        pasos: [
          'Ir a Fondos → Caja.',
          'Ver el resumen del día: saldo inicial, ingresos por ventas, egresos y saldo actual.',
          'Para registrar un ingreso o egreso manual: presionar el botón correspondiente e ingresar monto y descripción.',
          'Al finalizar el día, realizar el cierre de caja presionando "Cerrar caja".',
        ],
        tips: [
          'El cierre de caja registra el arqueo y deja la caja en cero para el próximo día.',
          'Los movimientos manuales quedan registrados con usuario y hora.',
        ],
      },
      {
        id: 'fondos-historial',
        nombre: 'Historial de Cierres',
        descripcion: 'Consulta de cierres de caja anteriores con el detalle de cada jornada: saldo inicial, total vendido, egresos y saldo final.',
        pasos: [
          'Ir a Fondos → Historial de cierres.',
          'Seleccionar el rango de fechas a consultar.',
          'Hacer clic en un cierre para ver su detalle.',
        ],
        tips: [
          'Útil para conciliar con resúmenes bancarios o reportes contables.',
        ],
      },
      {
        id: 'fondos-cobranzas',
        nombre: 'Cobranzas',
        descripcion: 'Registro de cobros de saldos de cuenta corriente de clientes, independientemente de una venta nueva.',
        pasos: [
          'Ir a Fondos → Cobranzas.',
          'Buscar el cliente a cobrar.',
          'El sistema muestra el saldo pendiente.',
          'Ingresar el monto a cobrar y la forma de pago.',
          'Confirmar. Se emite un recibo y se reduce el saldo del cliente.',
        ],
        tips: [
          'Se pueden hacer cobros parciales: el saldo restante queda pendiente.',
          'El recibo generado puede imprimirse o enviarse por correo.',
        ],
      },
      {
        id: 'fondos-recibos',
        nombre: 'Recibos',
        descripcion: 'Historial y reimpresión de recibos emitidos por cobranzas de cuenta corriente.',
        pasos: [
          'Ir a Fondos → Recibos.',
          'Filtrar por fecha, cliente o número de recibo.',
          'Hacer clic en un recibo para verlo o reimprimirlo.',
        ],
        tips: [
          'Los recibos anulados aparecen marcados pero no se eliminan del historial.',
        ],
      },
    ],
  },
  {
    id: 'listados',
    titulo: 'Listados',
    icono: '📋',
    color: 'slate',
    descripcion: 'Reportes y listados exportables: cuenta corriente de clientes, ventas por artículo y listas de precios.',
    operaciones: [
      {
        id: 'listados-cta-cte',
        nombre: 'Cuenta Corriente de Clientes',
        descripcion: 'Reporte de saldos de cuenta corriente por cliente. Muestra deudas pendientes, pagos realizados y saldo actual.',
        pasos: [
          'Ir a Listados → Cta. Cte. Clientes.',
          'Filtrar por cliente, rango de fechas o estado (con saldo, sin saldo, todos).',
          'El listado muestra cada movimiento (venta, pago, nota de crédito) con su impacto en el saldo.',
          'Exportar a Excel o imprimir si es necesario.',
        ],
        tips: [
          'Útil para la gestión de cobranzas: ver quién debe y cuánto.',
          'El saldo en rojo indica deuda; en verde indica saldo a favor del cliente.',
        ],
      },
      {
        id: 'listados-ventas-articulos',
        nombre: 'Venta de Artículos',
        descripcion: 'Reporte de artículos vendidos en un período: cantidad vendida, importe total y participación porcentual.',
        pasos: [
          'Ir a Listados → Venta de artículos.',
          'Seleccionar el período de análisis.',
          'Filtrar opcionalmente por categoría, marca o vendedor.',
          'El reporte se puede ordenar por cantidad o por importe.',
        ],
        tips: [
          'Identifica los artículos más vendidos (ranking de ventas).',
          'Exportable a Excel para análisis adicional.',
        ],
      },
      {
        id: 'listados-precios',
        nombre: 'Lista de Precios',
        descripcion: 'Genera e imprime una lista de precios actualizada para entregar a clientes o mostrar en el local.',
        pasos: [
          'Ir a Listados → Lista de precios.',
          'Seleccionar la lista de precios a imprimir.',
          'Filtrar por categoría o marca si se desea una lista parcial.',
          'Vista previa e imprimir o exportar a PDF.',
        ],
        tips: [
          'La lista refleja los precios actuales del sistema al momento de generarla.',
          'Se puede personalizar el logo y los datos de la empresa en Parámetros.',
        ],
      },
    ],
  },
  {
    id: 'optica',
    titulo: 'Óptica',
    icono: '👓',
    color: 'indigo',
    descripcion: 'Módulo específico para ópticas: gestión de órdenes de trabajo (OT), servicios, médicos derivantes e importación de stock óptico.',
    operaciones: [
      {
        id: 'optica-ordenes',
        nombre: 'Órdenes de Trabajo (OT)',
        descripcion: 'Gestión completa de órdenes de trabajo para lentes recetados. Incluye datos del paciente, graduación, selección de armazón y cristales, y seguimiento del estado.',
        pasos: [
          'Ir a Óptica → Órdenes de trabajo.',
          'Presionar "Nueva OT".',
          'Seleccionar el cliente (paciente) o crearlo si es nuevo.',
          'Ingresar los datos de la receta: esfera, cilindro, eje y adición para OD y OI.',
          'Seleccionar el armazón y los cristales del catálogo.',
          'Asignar el médico derivante (opcional).',
          'Guardar la OT. Queda en estado "En proceso".',
          'Al entregar los lentes terminados, cambiar el estado a "Lista para entregar" y luego "Entregada".',
          'Al cobrar, presionar "Cobrar OT".',
        ],
        tips: [
          'Se puede registrar una seña al crear la OT y el saldo al entregar.',
          'El sistema calcula automáticamente el saldo pendiente según los pagos recibidos.',
          'Las OT tienen un historial de cambios de estado con fecha y usuario.',
        ],
      },
      {
        id: 'optica-servicios',
        nombre: 'Servicios',
        descripcion: 'Registro de servicios ópticos simples: adaptaciones de lentes de contacto, reparaciones, ajustes de armazón, etc.',
        pasos: [
          'Ir a Óptica → Servicios.',
          'Presionar "Nuevo servicio".',
          'Seleccionar el cliente, el tipo de servicio y el precio.',
          'Guardar y cobrar directamente o dejar pendiente.',
        ],
        tips: [
          'Los servicios pueden generar deuda en cuenta corriente si no se cobran en el momento.',
        ],
      },
      {
        id: 'optica-medicos',
        nombre: 'Médicos',
        descripcion: 'Padrón de médicos oftalmólogos o optometristas que derivan pacientes. Se asocian a las órdenes de trabajo para trazabilidad.',
        pasos: [
          'Ir a Óptica → Médicos.',
          'Crear el médico con nombre, matrícula y especialidad.',
          'Al crear una OT, seleccionar el médico derivante en el campo correspondiente.',
        ],
        tips: [
          'Útil para reportes de derivación y relación comercial con médicos.',
        ],
      },
      {
        id: 'optica-importar',
        nombre: 'Importar Stock Óptico',
        descripcion: 'Importación especializada de catálogos ópticos (armazones, cristales, lentes de contacto) desde archivos con formato del proveedor.',
        pasos: [
          'Ir a Inventario → Importar óptica.',
          'Seleccionar el proveedor óptico.',
          'Subir el archivo en el formato indicado.',
          'Revisar la previsualización y confirmar la importación.',
        ],
        tips: [
          'Cada proveedor puede tener un formato de archivo diferente; consultar la documentación específica.',
          'Los artículos importados se crean con la categoría y atributos configurados para óptica.',
        ],
      },
    ],
  },
  {
    id: 'administracion',
    titulo: 'Administración',
    icono: '⚙️',
    color: 'rose',
    descripcion: 'Configuración y administración del sistema: sucursales, usuarios, roles, permisos y parámetros generales.',
    operaciones: [
      {
        id: 'admin-sucursales',
        nombre: 'Sucursales',
        descripcion: 'Alta y configuración de sucursales del negocio. Cada sucursal tiene su propio stock, caja y configuración visual.',
        pasos: [
          'Ir a Administración → Sucursales.',
          'Crear una sucursal con nombre, dirección y color de marca.',
          'Asignar usuarios a la sucursal desde el módulo de usuarios.',
        ],
        tips: [
          'El color de sucursal personaliza la apariencia del dashboard para los usuarios de esa sucursal.',
          'Los usuarios pueden estar habilitados para operar en múltiples sucursales.',
        ],
      },
      {
        id: 'admin-usuarios',
        nombre: 'Usuarios',
        descripcion: 'Gestión de usuarios del sistema: creación, edición, asignación de roles y habilitación de módulos.',
        pasos: [
          'Ir a Administración → Usuarios.',
          'Crear usuario con nombre, email y contraseña temporal.',
          'Asignar el rol del usuario (define sus permisos).',
          'Seleccionar la sucursal home y las sucursales a las que puede acceder.',
          'Activar los módulos que el usuario puede ver.',
        ],
        tips: [
          'La contraseña inicial debe cambiarse en el primer ingreso.',
          'Desactivar un usuario impide su acceso sin eliminar su historial.',
        ],
      },
      {
        id: 'admin-roles',
        nombre: 'Roles',
        descripcion: 'Definición de roles de usuario (ej. Vendedor, Supervisor, Gerente). Cada rol agrupa un conjunto de permisos.',
        pasos: [
          'Ir a Administración → Roles.',
          'Crear un rol con nombre descriptivo.',
          'Asignar permisos al rol desde la pantalla de Permisos.',
          'Aplicar el rol a los usuarios correspondientes.',
        ],
        tips: [
          'Usar roles facilita la gestión masiva de permisos: basta editar el rol para afectar a todos sus usuarios.',
        ],
      },
      {
        id: 'admin-permisos',
        nombre: 'Permisos',
        descripcion: 'Control granular de los permisos por rol: qué acciones puede realizar cada rol en cada módulo.',
        pasos: [
          'Ir a Administración → Permisos.',
          'Seleccionar el rol a configurar.',
          'Activar o desactivar permisos individuales por módulo y operación.',
          'Guardar los cambios.',
        ],
        tips: [
          'Los permisos se aplican en tiempo real: el usuario afectado los verá al recargar.',
          'El rol "Administrador" tiene acceso total y no puede restringirse desde esta pantalla.',
        ],
      },
      {
        id: 'admin-parametros',
        nombre: 'Parámetros',
        descripcion: 'Configuración general del sistema: nombre de la empresa, logo, datos fiscales, comportamiento del POS y otras opciones globales.',
        pasos: [
          'Ir a Administración → Parámetros.',
          'Completar los datos de la empresa: razón social, CUIT, dirección, teléfono.',
          'Subir el logo para que aparezca en tickets y documentos.',
          'Configurar opciones del POS: impresora, numeración de comprobantes, etc.',
          'Guardar los cambios.',
        ],
        tips: [
          'El logo debe ser PNG o JPG, fondo blanco o transparente, mínimo 200x200px.',
          'Los cambios en parámetros afectan a todas las sucursales salvo que se indique lo contrario.',
        ],
      },
      {
        id: 'admin-backup',
        nombre: 'Backup del sistema',
        descripcion: 'Exporta toda la información de la base de datos a un archivo Excel (.xlsx) con una hoja por tabla. Permite guardar una copia de seguridad fuera del servidor. Solo disponible para el rol Administrador.',
        pasos: [
          'Hacer clic en el botón "Descargar backup" ubicado debajo del logo en el menú lateral izquierdo.',
          'Leer el aviso de confirmación: se exportará toda la base de datos a un archivo Excel.',
          'Presionar "Descargar" para confirmar.',
          'Aguardar sin cerrar la ventana ni el navegador. Un diálogo bloqueante muestra el progreso.',
          'Al finalizar, el archivo backup-YYYY-MM-DD.xlsx se descarga automáticamente.',
          'Guardar el archivo en un lugar seguro fuera del servidor (disco externo, pendrive, nube, etc.).',
        ],
        tips: [
          'El archivo contiene una hoja por tabla: artículos, variantes, ventas, stock, cobranzas, caja, óptica, configuración, usuarios y más.',
          'NO cerrar la ventana ni el navegador durante la generación. El sistema lo advierte en pantalla.',
          'Se recomienda hacer un backup periódico como medida preventiva ante pérdida de datos.',
          'Los backups deben almacenarse fuera del servidor (pendrive, disco externo o servicio en la nube).',
          'El archivo es de solo lectura: no puede reimportarse automáticamente al sistema.',
        ],
      },
    ],
  },
]

export interface BusquedaResultado {
  moduloId: string
  moduloTitulo: string
  operacionId: string
  operacionNombre: string
  campo: string
  fragmento: string
}

export function buscarEnAyuda(query: string): BusquedaResultado[] {
  if (!query || query.trim().length < 2) return []
  const q = query.trim().toLowerCase()
  const resultados: BusquedaResultado[] = []

  for (const modulo of AYUDA_MODULOS) {
    const checkText = (texto: string, campo: string, opId: string, opNombre: string) => {
      const idx = texto.toLowerCase().indexOf(q)
      if (idx === -1) return
      const start = Math.max(0, idx - 40)
      const end = Math.min(texto.length, idx + q.length + 40)
      const fragmento = (start > 0 ? '…' : '') + texto.slice(start, end) + (end < texto.length ? '…' : '')
      resultados.push({ moduloId: modulo.id, moduloTitulo: modulo.titulo, operacionId: opId, operacionNombre: opNombre, campo, fragmento })
    }

    if (modulo.titulo.toLowerCase().includes(q)) {
      resultados.push({ moduloId: modulo.id, moduloTitulo: modulo.titulo, operacionId: '', operacionNombre: '', campo: 'módulo', fragmento: modulo.descripcion.slice(0, 100) + '…' })
    }

    for (const op of modulo.operaciones) {
      checkText(op.nombre, 'operación', op.id, op.nombre)
      checkText(op.descripcion, 'descripción', op.id, op.nombre)
      for (const paso of op.pasos ?? []) checkText(paso, 'paso', op.id, op.nombre)
      for (const tip of op.tips ?? []) checkText(tip, 'tip', op.id, op.nombre)
    }
  }

  const seen = new Set<string>()
  return resultados.filter(r => {
    const key = `${r.moduloId}:${r.operacionId}:${r.campo}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
