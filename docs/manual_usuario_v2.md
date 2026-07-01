---
title: "Manual de Usuario — MGA Punto de Venta"
date: "2026"
lang: es
geometry: "top=2.5cm, bottom=2.5cm, left=3cm, right=2.5cm"
fontsize: 11pt
linestretch: 1.4
toc: true
toc-depth: 2
toc-title: "Índice"
colorlinks: true
numbersections: false
header-includes:
  - \usepackage{fancyhdr}
  - \pagestyle{fancy}
  - \fancyhf{}
  - \fancyhead[L]{\small MGA Punto de Venta}
  - \fancyhead[R]{\small Manual de Usuario}
  - \fancyfoot[C]{\thepage}
  - \renewcommand{\headrulewidth}{0.4pt}
---

---

## 1. Introducción

**MGA Punto de Venta** es un sistema de gestión comercial integral. Permite realizar ventas, controlar stock, administrar clientes, gestionar caja, manejar órdenes de trabajo óptico y mucho más.

El sistema está organizado en **módulos** accesibles desde el menú lateral izquierdo. Dependiendo del **rol** del usuario (Administrador, Supervisor o Vendedor), se mostrarán diferentes opciones en el menú.

\newpage

## 2. Inicio de Sesión y Sucursales

### 2.1 Ingresar al Sistema

1. Abrí el navegador y accedé a la URL del sistema.
2. Ingresá tu **usuario** y **contraseña**.
3. Hacé clic en **Ingresar**.

### 2.2 Seleccionar Sucursal

Si tenés acceso a más de una sucursal, podés cambiar entre ellas desde el **selector de sucursales** ubicado en la barra superior.

- La sucursal activa determina qué stock, caja y movimientos ves.
- Al crear una venta, remito o movimiento, se aplica a la **sucursal activa** en ese momento.

\newpage

## 3. Módulo Ventas

### 3.1 Punto de Venta (POS)

Es la pantalla principal para cobrar.

**Pasos para realizar una venta:**

1. Seleccioná la **lista de precios** a utilizar (por defecto: Venta Público).
2. Buscá los artículos por nombre, código o código de barras. Se puede usar el lector de código de barras.
3. Los artículos se agregan al carrito con su precio correspondiente.
4. Opcional: seleccioná un **cliente** para asociar la venta.
5. Si querés aplicar un **descuento global**, ingresá el porcentaje o monto.
6. Seleccioná los **métodos de pago**:

| Método | Descripción |
|---|---|
| Efectivo | Ingresá el monto con que paga el cliente. El sistema calcula el vuelto automáticamente. |
| Transferencia | Débito bancario o transferencia. |
| Tarjeta de Débito | Pago con tarjeta de débito. |
| Tarjeta de Crédito | Permite seleccionar cantidad de cuotas. |
| Cuenta Corriente | Genera un cargo automático en la cuenta del cliente. |
| Nota de Crédito | Permite usar una NC emitida al cliente como medio de pago. |
| Otro | Otros métodos configurados en el sistema. |

7. Cuando esté todo listo, hacé clic en **Cobrar**.
8. El sistema descuenta automáticamente el stock y registra el movimiento en caja.
9. Al finalizar, preguntará si deseás **imprimir el ticket**.

---

### 3.2 Historial de Ventas

Muestra todas las ventas realizadas. Podés:

- **Filtrar** por estado y fecha.
- **Ver detalle** de una venta (ítems, pagos, cliente).
- **Anular** una venta existente — revierte el stock y la caja.
- **Imprimir** el ticket en formato 80 mm o A4.
- **Eliminar** *(solo Administrador)*: borra definitivamente una venta ya anulada.

---

### 3.3 Órdenes de Venta

Son pedidos o presupuestos que pasan por un flujo de estados.

**Estados:**

| Estado | Descripción |
|---|---|
| Borrador | Recién creada, no afecta stock ni caja. Se puede editar. |
| Confirmada | Se descontó el stock y se procesaron los pagos. |
| Anulada | Se revirtió el stock y los pagos. |

**Operaciones:**

- **Crear orden**: cargá los artículos, cliente y forma de pago. Queda en borrador.
- **Editar**: solo mientras esté en borrador.
- **Confirmar**: se descuenta el stock y se registran los pagos.
- **Anular**: revierte todo el impacto de la confirmación.
- **Pago rápido**: desde el listado, podés registrar un pago sin abrir la orden.
- **Imprimir**: ticket 80 mm o A4.
- **Eliminar** *(solo Administrador)*: solo borradores.

---

### 3.4 Clientes

ABM completo de clientes del sistema.

**Campos disponibles:**

- Nombre *(obligatorio)*
- Tipo: Particular / Empresa / Comercio
- Email, Teléfono, Dirección, Localidad
- CUIT
- Notas internas

**Operaciones:**

- **Listar** clientes con buscador por nombre.
- **Crear** nuevo cliente.
- **Editar** datos del cliente.
- **Desactivar** cliente — no se elimina físicamente.

El **saldo** de cada cliente se calcula automáticamente según sus movimientos de cuenta corriente.

---

### 3.5 Notas de Crédito

Documentos que representan un saldo a favor del cliente, que puede usar como medio de pago en futuras ventas.

**Estados:** Pendiente → Utilizada / Anulada

**Operaciones:**

- **Emitir** una NC a un cliente con un monto específico.
- **Usar** como pago en una venta u orden — el sistema descuenta automáticamente del monto disponible.
- **Anular** una NC — devuelve el saldo disponible.

\newpage

## 4. Módulo Inventario

### 4.1 Artículos

Catálogo completo de productos.

**Tipos de artículos:**

- **Simple**: un solo precio y stock.
- **Con variantes**: el artículo tiene versiones (ej: talle S/M/L, color rojo/azul). Cada variante tiene su propio precio y stock.

**Operaciones:**

- **Listar** artículos con búsqueda por nombre o código. Se ve el stock total y por sucursal.
- **Crear** artículo nuevo (código, nombre, categoría, precio, etc.).
- **Editar** artículo: cambiar datos, subir imagen, administrar variantes y precios por lista.
- **Desactivar**: el artículo deja de aparecer en el POS pero no se borra.
- **Subir imagen**: desde el editor de artículo.
- **Gestionar variantes**: crear, editar o eliminar variantes con atributos (talle, color, etc.).
- **Precios por lista**: asignar precios diferentes según la lista de precio (ej: Venta Público, Mayorista, etc.).

---

### 4.2 Remitos

Documentos de entrada y salida de stock.

**Tipos:**

| Tipo | Efecto |
|---|---|
| Entrada | Ingresa stock al depósito (compra a proveedor, devolución). |
| Salida | Egresa stock (transferencia a otra sucursal, devolución a proveedor). |

**Estados:** Borrador → Confirmado → Anulado

**Operaciones:**

- **Crear remito**: seleccionar tipo, sucursal, contraparte (proveedor, persona u otra sucursal) e ítems.
- **Ver detalle**: ítems, fechas, estado.
- **Editar**: en borrador se pueden cambiar todos los ítems.
- **Confirmar**: aplica los cambios de stock en la sucursal correspondiente.
- **Anular**: revierte todos los cambios de stock.
- **Transferencia entre sucursales**: al hacer un remito de salida hacia otra sucursal, se crea automáticamente el remito de entrada en la sucursal destino.
- **Eliminar** *(solo Administrador)*: solo remitos en borrador o anulados.

---

### 4.3 Ajustes de Stock

Permite corregir discrepancias de stock manualmente.

**Operaciones:**

- **Ver discrepancias**: el sistema compara el stock real vs el esperado.
- **Aplicar ajuste**: ingresar el stock correcto. Se genera un remito automático de ajuste.

---

### 4.4 Proveedores

ABM de proveedores del negocio.

**Operaciones:** Listar, Crear, Editar, Desactivar.

**Uso:** se asocian a artículos como proveedor habitual y a remitos de entrada.

---

### 4.5 Importar Stock

Herramienta para cargar cantidades de stock de forma masiva desde un archivo Excel o CSV. Ideal para carga inicial de inventario o para registrar ingresos masivos de mercadería.

**Acceso:** Inventario → Importar stock

**Formatos soportados:** Excel (`.xlsx`, `.xls`) y CSV (`.csv`) con separadores `,` `;` `|` o tabulación.

**Columnas del archivo:**

| Columna | Descripción |
|---|---|
| `codigo` | Código del artículo existente en el sistema *(obligatorio)* |
| `stock` | Cantidad a ingresar *(obligatorio, mayor a 0)* |

Las columnas no distinguen mayúsculas ni acentos. También se reconocen nombres alternativos como `cod`, `codart`, `cantidad`, `qty`, `cant`.

**Proceso de importación:**

1. Arrastrá el archivo al área marcada o hacé clic para seleccionarlo.
2. El sistema muestra una **vista previa** con las primeras 8 filas válidas e informa cuántas fueron descartadas (por código vacío o stock inválido).
3. Hacé clic en **Importar N artículos**.
4. El sistema:
   - Busca cada artículo por su código en la base de datos.
   - Genera **remitos de entrada** automáticos (hasta 50 ítems por remito), confirmados al instante.
   - Suma el stock al `articulo_stock` de la **sucursal activa**.
   - Sincroniza el stock total en `articulos.stock_actual` considerando todas las sucursales.
   - Usa el proveedor **"Stock Inicial"** como contraparte (lo crea automáticamente si no existe).
5. Al finalizar, muestra la cantidad de artículos importados, los remitos generados y los errores por código no encontrado.

> Los remitos generados quedan visibles en **Inventario → Remitos** con estado *Confirmado* y numeración `E-NNNNN`.

---

### 4.6 Importador Óptica

Herramienta para importar datos desde archivos CSV. Ideal para carga inicial o migraciones en negocios de óptica.

**Tres pestañas:**

| Pestaña | Qué importa |
|---|---|
| Artículos | Código, descripción, categoría y código de barras. Crea o actualiza por código. |
| Precios | Asigna precios de venta a artículos existentes. |
| Stock | Genera remitos de entrada automáticos (hasta 50 ítems por remito) para cargar stock inicial. |

El sistema detecta automáticamente el separador del CSV (punto y coma, coma, tabulación, etc.) y muestra una vista previa antes de importar.

\newpage

## 5. Módulo Altas

Catálogo para clasificar artículos. Estos datos se configuran una vez y se usan al crear o editar artículos.

### 5.1 Marcas

ABM de marcas. Cada artículo puede pertenecer a una marca (ej: Oakley, Ray-Ban, Essilor).

### 5.2 Categorías

ABM de categorías generales (ej: Lentes, Armazones, Accesorios).

### 5.3 Subcategorías

ABM de subcategorías dentro de una categoría (ej: dentro de Lentes → Lentes de Sol, Lentes Recetados).

### 5.4 Atributos

Tipos de atributos para las variantes de artículo (ej: Talle, Color, Material, Tamaño). Cada atributo puede tener múltiples valores posibles.

\newpage

## 6. Módulo Consultas

### 6.1 Stock y Precios

Consultá el stock disponible de cualquier artículo desglosado por sucursal y sus precios en las diferentes listas.

### 6.2 Seguimiento

Trazabilidad completa de todos los movimientos de stock: cuándo entró, cuándo salió, qué documento lo generó.

### 6.3 Precios de Costo

Comparativa de precios de costo, precio de venta y margen de rentabilidad por artículo.

\newpage

## 7. Módulo Fondos

### 7.1 Caja

Gestión de la caja diaria por sucursal.

**Flujo de trabajo:**

1. **Abrir sesión**: al empezar el día, registrá el monto de apertura (efectivo con el que arranca la caja).
2. **Operar**: todas las ventas, cobros y anulaciones registran movimientos automáticos en la caja abierta.
3. **Movimientos manuales**: podés registrar ingresos o egresos extraordinarios (ej: pago de un gasto, retiro de dinero).
4. **Cerrar sesión**: al final del día, ingresá el monto de efectivo real. El sistema calcula:
   - **Monto esperado** = apertura + ventas efectivo + ingresos manuales − egresos manuales
   - **Diferencia** = monto real vs monto esperado
5. **Historial**: consultá sesiones de caja anteriores con filtro por fecha.

> Solo puede haber **una sesión abierta por sucursal** a la vez.

---

### 7.2 Cobranzas

Gestión de cuenta corriente de clientes.

**Operaciones:**

- **Listar clientes con saldo**: muestra quiénes deben y cuánto.
- **Expandir cliente**: historial de todos los movimientos (cargos automáticos y pagos registrados).
- **Cobrar**: registrá un pago con el método correspondiente. Se genera un recibo automático.
- **Imprimir recibo** del cobro realizado.

Los **cargos** se generan automáticamente al vender a "Cuenta Corriente" desde el POS, Órdenes de Venta, Órdenes de Trabajo o Servicios de Óptica.

---

### 7.3 Recibos

Historial de todos los recibos emitidos, con opción de generar un recibo manual.

**Operaciones:** Listar, Crear recibo manual (cliente, monto, método, descripción, fecha), Imprimir.

\newpage

## 8. Módulo Listados

### 8.1 Cuenta Corriente Clientes

Listado detallado de todos los movimientos de cuenta corriente por cliente, con filtros por fecha y nombre.

### 8.2 Venta de Artículos

Reporte de ventas agrupado por artículo. Filtrable por rango de fechas y tipo de documento (venta, orden, OT, servicio).

### 8.3 Lista de Precios

Listado imprimible de precios filtrado por lista de precio, categoría, subcategoría y marca. Útil para entregar a clientes o exhibir en el local.

\newpage

## 9. Módulo Óptica

### 9.1 Órdenes de Trabajo (OT)

Sistema completo para gestionar pedidos de lentes recetados y armazones.

**Estados:**

| Estado | Descripción |
|---|---|
| Nuevo | Recién ingresado. |
| Pendiente | Esperando inicio del trabajo. |
| En Proceso | En producción. |
| En Laboratorio | Enviado al laboratorio externo. |
| Terminado | Listo para entregar. |
| Entregado | Retirado por el cliente *(final)*. |
| Anulado | Cancelado con reversión de pagos *(final)*. |

**Cómo crear una OT:**

1. Seleccioná o creá el **cliente** (paciente).
2. Seleccioná el **médico** derivante *(opcional, de la lista de médicos)*.
3. Cargá la **graduación** completa — lejos y cerca — para ojo derecho (OD) e izquierdo (OI): esfera, cilindro, eje, adición, distancia pupilar (DP), altura.
4. Agregá los **ítems**:
   - **Armazón**: seleccioná del catálogo o cargá uno propio.
   - **Cristal**: tipo de lente.
   - **Tratamiento**: antirreflejo, fotocromático, etc.
   - **Otro**: cargo adicional.
5. Ingresá el **costo** del trabajo (lo que cobra el laboratorio).
6. Registrá un **anticipo** *(opcional)*.
7. El sistema calcula el total y el saldo pendiente automáticamente.

**Otras operaciones:**

- **Tareas**: cada OT puede tener tareas asociadas a un laboratorio propio o externo, con seguimiento de estado.
- **Pagos**: se pueden registrar pagos parciales o totales en cualquier estado, excepto anulado.
- **Cambiar estado**: según el avance real del trabajo.
- **Anular**: si hay saldo pendiente, se genera automáticamente un asiento de reversión.
- **Imprimir**: comprobante A4 con código de barras, graduación completa, desglose de ítems y pagos.
- **Subir receta**: imagen de la receta médica desde el detalle de la OT.
- **Selector de lista de precios**: permite elegir qué lista usar para los precios al crear la OT.

---

### 9.2 Servicios de Óptica

Gestión de reparaciones y ajustes: soldadura, cambio de cristales, embutir bisagra, etc.

**Estados:** Pendiente → En Proceso → Terminado → Entregado *(final)* / Anulado *(final)*

**Operaciones:**

- **Crear servicio**: seleccioná el cliente *(obligatorio)*, describí el trabajo y elegí los tipos de reparación — se pueden seleccionar múltiples, cada uno con su precio.
- **Tareas**: seguimiento simple de estado (en proceso / terminada).
- **Pagos**: registrá con método y caja asociada.
- **Cambiar estado** a terminado, entregado o anulado.
- **Anular**: genera reversión automática si hay saldo pendiente.
- **Imprimir**: comprobante A4 con código de barras.

> Numeración automática: **SV-XXXXX**.

---

### 9.3 Médicos

ABM de médicos oftalmólogos derivantes.

**Campos:** Nombre, Matrícula, Teléfono, Activo.

**Operaciones:** Listar, Crear, Editar, Eliminar.

\newpage

## 10. Módulo Administración

> Este módulo está disponible únicamente para usuarios con rol **Administrador**.

### 10.1 Sucursales

CRUD de sucursales del negocio.

**Campos:** Nombre, Dirección, Teléfono, Logo (imagen que aparece en el sistema), Color (personaliza el tema visual de la sucursal).

### 10.2 Usuarios

Gestión de usuarios del sistema.

**Operaciones:** Listar, Crear (nombre, email, rol, contraseña inicial), Editar (datos y rol), Eliminar.

### 10.3 Roles

Roles del sistema (Administrador, Supervisor, Vendedor, o roles personalizados).

**Operaciones:** Listar, Crear, Editar, Eliminar. Se puede definir un rol como predeterminado para nuevos usuarios.

### 10.4 Permisos

Matriz de permisos granular. Define **qué puede hacer cada rol** en cada módulo.

**Estructura:**

- **Filas** = operaciones del sistema (Ver artículos, Crear ventas, Anular remitos, etc.)
- **Columnas** = roles configurados
- **Cada celda** = permiso activo o inactivo

Los permisos se organizan en: **Módulo → Submódulo → Operación**.

### 10.5 Listas de Precio

Gestión de listas de precios de venta y costo.

Se pueden crear múltiples listas (ej: Venta Público, Mayorista, Costo). Cada artículo puede tener precio distinto en cada lista.

### 10.6 Vendedores

Catálogo de vendedores, independiente de los usuarios del sistema.

**Operaciones:** Listar, Crear, Editar, Eliminar. Se asigna un vendedor a cada venta, orden y OT para comisiones o seguimiento.

### 10.7 Formas de Pago

Métodos de pago disponibles en el sistema.

**Tipos:** Tarjeta de Crédito, Tarjeta de Débito, Bancaria, Billetera, Moneda.

**Operaciones:** Crear, Editar, Activar / Desactivar.

**Cuotas:** para Tarjetas de Crédito se pueden configurar planes de cuotas con recargo porcentual.

---

### 10.8 Backup del sistema

Exporta toda la información de la base de datos a un archivo Excel (`.xlsx`) con una hoja por tabla. Permite guardar una copia de seguridad fuera del servidor.

> Disponible únicamente para el rol **Administrador**.

**Cómo hacer un backup:**

1. Hacer clic en el botón **"Descargar backup"** ubicado debajo del logo en el menú lateral izquierdo.
2. Leer el aviso de confirmación y presionar **"Descargar"**.
3. Aguardar sin cerrar la ventana ni el navegador. Un diálogo en pantalla muestra el progreso e indica que **NO se debe cerrar la ventana**.
4. Al finalizar, el archivo `backup-YYYY-MM-DD.xlsx` se descarga automáticamente.
5. Guardar el archivo en un lugar seguro **fuera del servidor** (disco externo, pendrive, servicio en la nube, etc.).

**Contenido del backup — hojas incluidas:**

| Hoja | Datos |
|---|---|
| Articulos, Variantes, Atributos | Catálogo completo de productos |
| Categorias, Subcategorias, Marcas | Tablas maestras |
| Proveedores, Unidades | Datos de proveedores y unidades de medida |
| Listas Precio, Precios | Precios por lista |
| Stock, Mov Stock | Stock por sucursal y movimientos |
| Ventas, Venta Items, Venta Pagos | Historial de ventas |
| Ordenes, Orden Items, Orden Pagos | Órdenes de venta |
| Caja Sesiones, Caja Movimientos | Historial de caja |
| Cobranzas, Notas Credito | Cuenta corriente |
| Remitos, Remito Items | Remitos de stock |
| Optica Ordenes, OT Items, OT Pagos | Órdenes de trabajo óptico |
| Optica Servicios, Sv Pagos | Servicios ópticos |
| Optica Medicos | Médicos derivantes |
| Sucursales, Formas Pago, Vendedores | Configuración |
| Parametros, Usuarios | Parámetros del sistema y usuarios |

> **Importante:** NO cerrar la ventana del navegador durante la generación del backup. El sistema lo advierte en pantalla con un cartel bloqueante.

> El archivo generado es de **solo lectura**: no puede reimportarse automáticamente al sistema.

\newpage

## 11. Roles y Permisos

### Roles predefinidos

| Rol | Descripción |
|---|---|
| **Administrador** | Acceso total al sistema. Puede administrar usuarios, roles y permisos. |
| **Supervisor** | Puede ver reportes, gestionar stock y clientes. No puede borrar datos. |
| **Vendedor** | Puede realizar ventas en POS, gestionar clientes y operar caja. No accede a stock ni administración. |

---

### Resumen de accesos por módulo

| Módulo | Administrador | Supervisor | Vendedor |
|---|---|---|---|
| Ventas — POS e Historial | CRUD completo | Solo consulta | Ver + Crear |
| Órdenes de Venta | CRUD completo | Solo consulta | Ver + Crear |
| Clientes | CRUD completo | CRUD completo | Ver + Crear |
| Artículos | CRUD completo | Solo consulta | Solo consulta |
| Stock / Remitos | CRUD completo | CRUD completo | Sin acceso |
| Ajustes de Stock | CRUD completo | CRUD completo | Sin acceso |
| Caja | CRUD completo | Solo consulta | Ver + Crear |
| Cobranzas | CRUD completo | Solo consulta | Sin acceso |
| Óptica — OT y Servicios | CRUD completo | CRUD completo | CRUD completo |
| Administración | CRUD completo | Sin acceso | Sin acceso |

> Los permisos pueden ser personalizados por el Administrador desde **Administración → Permisos**.

---

*MGA Punto de Venta — Manual de Usuario — 2026*
