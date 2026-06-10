# Manual de Usuario — MGA Punto de Venta

## Índice

1. [Introducción](#1-introducción)
2. [Inicio de Sesión y Sucursales](#2-inicio-de-sesión-y-sucursales)
3. [Módulo Ventas](#3-módulo-ventas)
4. [Módulo Inventario](#4-módulo-inventario)
5. [Módulo Altas](#5-módulo-altas)
6. [Módulo Consultas](#6-módulo-consultas)
7. [Módulo Fondos](#7-módulo-fondos)
8. [Módulo Listados](#8-módulo-listados)
9. [Módulo Óptica](#9-módulo-óptica)
10. [Módulo Administración](#10-módulo-administración)
11. [Roles y Permisos](#11-roles-y-permisos)

---

## 1. Introducción

**MGA Punto de Venta** es un sistema de gestión comercial integral. Permite realizar ventas, controlar stock, administrar clientes, gestionar caja, manejar órdenes de trabajo óptico y mucho más.

El sistema está organizado en **módulos** accesibles desde el menú lateral izquierdo. Dependiendo del **rol** del usuario (Administrador, Supervisor o Vendedor), se mostrarán diferentes opciones en el menú.

---

## 2. Inicio de Sesión y Sucursales

### 2.1 Ingresar al Sistema

1. Abrí el navegador y accedé a la URL del sistema.
2. Ingresá tu **usuario** y **contraseña**.
3. Hacé clic en **Ingresar**.

### 2.2 Seleccionar Sucursal

Si tenés acceso a más de una sucursal, podés cambiar entre ellas desde el **selector de sucursales** ubicado en la barra superior.

- La sucursal activa determina qué stock, caja y movimientos ves.
- Al crear una venta, remito o movimiento, se aplica a la **sucursal activa** en ese momento.

---

## 3. Módulo Ventas

### 3.1 Punto de Venta (POS)

Es la pantalla principal para cobrar.

**Pasos para realizar una venta:**

1. Seleccioná la **lista de precios** a utilizar (default: Venta Público).
2. Buscá los artículos por nombre, código o código de barras. Se puede usar el lector de código de barras.
3. Los artículos se agregan al carrito con su precio correspondiente.
4. Opcional: seleccioná un **cliente** para asociar la venta.
5. Si querés aplicar un **descuento global**, ingresá el porcentaje o monto.
6. Seleccioná los **métodos de pago**:
   - **Efectivo**: ingresá el monto con que paga el cliente. El sistema calcula el vuelto automáticamente.
   - **Transferencia**: débito bancario o transferencia.
   - **Tarjeta de Débito**
   - **Tarjeta de Crédito**: permite seleccionar cantidad de cuotas.
   - **Cuenta Corriente**: genera un cargo automático en la cuenta del cliente.
   - **Nota de Crédito**: permite usar una NC emitida al cliente como medio de pago.
   - **Otro**: otros métodos configurados.
7. Cuando esté todo listo, hacé clic en **Cobrar**.
8. El sistema descuenta automáticamente el stock y registra el movimiento en caja.
9. Al finalizar, preguntará si deseás **imprimir el ticket**.

### 3.2 Historial de Ventas

Muestra todas las ventas realizadas. Podés:

- **Filtrar** por estado y fecha.
- **Ver detalle** de una venta (ítems, pagos, cliente).
- **Anular** una venta existente (revierte el stock y la caja).
- **Imprimir** el ticket en formato 80mm o A4.
- **Eliminar** (solo Administrador): borra definitivamente una venta ya anulada.

### 3.3 Órdenes de Venta

Son pedidos o presupuestos que pasan por un flujo de estados:

**Estados:**
- **Borrador**: recién creada, no afecta stock ni caja. Se puede editar.
- **Confirmada**: se descontó el stock y se procesaron los pagos. Pasa a ser como una venta.
- **Anulada**: se revirtió el stock y los pagos.

**Operaciones:**
- **Crear orden**: cargá los artículos, cliente y forma de pago. Queda en borrador.
- **Editar**: solo mientras esté en borrador.
- **Confirmar**: al confirmar, se descuenta el stock del carrito y se registran los pagos.
- **Anular**: revierte todo el impacto de la confirmación.
- **Pago rápido**: desde el listado, podés registrar un pago sin abrir la orden.
- **Imprimir**: ticket 80mm o A4.
- **Eliminar** (solo Administrador): solo borradores.

### 3.4 Clientes

ABM completo de clientes del sistema.

**Campos:**
- Nombre (obligatorio)
- Tipo: Particular / Empresa / Comercio
- Email, Teléfono, Dirección, Localidad
- CUIT
- Notas

**Operaciones:**
- **Listar** clientes con buscador por nombre.
- **Crear** nuevo cliente.
- **Editar** datos del cliente.
- **Desactivar** cliente (no se elimina físicamente).

El **saldo** de cada cliente se calcula automáticamente según sus movimientos de cuenta corriente.

### 3.5 Notas de Crédito

Documentos que representan un saldo a favor del cliente, que puede usar como medio de pago en futuras ventas.

**Estados:** Pendiente → Utilizada / Anulada

**Operaciones:**
- **Emitir** una NC a un cliente con un monto específico.
- **Usar** como pago en una venta u orden (el sistema descuenta automáticamente del monto disponible).
- **Anular** una NC (vuelve el saldo disponible).

---

## 4. Módulo Inventario

### 4.1 Artículos

Catálogo completo de productos.

**Tipos de artículos:**
- **Simple**: un solo precio y stock.
- **Con variantes**: el artículo tiene versiones (ej: talle S/M/L, color rojo/azul). Cada variante tiene su propio precio y stock.

**Operaciones:**
- **Listar** artículos con búsqueda por nombre o código. Se ve el stock total y sucursal por sucursal.
- **Crear** artículo nuevo (código, nombre, categoría, precio, etc.).
- **Editar** artículo: cambiar datos, subir imagen, administrar variantes y precios por lista.
- **Desactivar**: el artículo deja de aparecer en el POS pero no se borra.
- **Subir imagen**: desde el editor de artículo.
- **Gestionar variantes**: crear, editar o eliminar variantes con atributos (talle, color, etc.).
- **Precios por lista**: asignar precios diferentes según la lista de precio (ej: Venta Público, Mayorista, etc.).

### 4.2 Remitos

Documentos de entrada y salida de stock.

**Tipos:**
- **Entrada**: ingresa stock al depósito (compra a proveedor, devolución).
- **Salida**: egresa stock (transferencia a otra sucursal, devolución a proveedor).

**Estados:** Borrador → Confirmado → Anulado

**Operaciones:**
- **Crear remito**: seleccionar tipo, sucursal, contraparte (proveedor, persona, otra sucursal) e ítems.
- **Ver detalle**: ítems, fechas, estado.
- **Editar**: en borrador se pueden cambiar todos los ítems. En confirmado se ajusta la diferencia.
- **Confirmar**: aplica los cambios de stock en la sucursal correspondiente.
- **Anular**: revierte todos los cambios de stock.
- **Transferencia entre sucursales**: al hacer un remito de salida hacia otra sucursal, se crea automáticamente el remito de entrada en la sucursal destino.
- **Eliminar** (solo Administrador): solo remitos en borrador o anulados.

### 4.3 Ajustes de Stock

Permite corregir discrepancias de stock manualmente.

**Operaciones:**
- **Ver discrepancias**: el sistema compara el stock real vs el esperado.
- **Aplicar ajuste**: ingresar el stock correcto. Se genera un remito automático de ajuste.

### 4.4 Proveedores

ABM de proveedores.

**Operaciones:** Listar, Crear, Editar, Desactivar.
**Uso:** Se asocian a artículos como proveedor habitual y a remitos de entrada.

### 4.5 Importador Óptica

Herramienta para importar datos desde archivos CSV. Ideal para carga inicial o migraciones.

**Tres pestañas:**

1. **Artículos**: importá código, descripción, categoría y código de barras. Crea o actualiza artículos por código.
2. **Precios**: asigná precios de venta a los artículos existentes.
3. **Stock**: genera remitos de entrada automáticos (hasta 50 ítems por remito) para cargar el stock inicial.

El sistema detecta automáticamente el separador del CSV (punto y coma, coma, tabulación, etc.) y muestra una vista previa antes de importar.

---

## 5. Módulo Altas

Catálogo para clasificar artículos.

### 5.1 Marcas
ABM de marcas. Cada artículo puede pertenecer a una marca.

### 5.2 Categorías
ABM de categorías (ej: Lentes, Armazones, Accesorios, etc.).

### 5.3 Subcategorías
ABM de subcategorías dentro de una categoría (ej: dentro de Lentes → Lentes de Sol, Lentes Recetados).

### 5.4 Atributos
Tipos de atributos para las variantes de artículo (ej: Talle, Color, Material, Tamaño).

---

## 6. Módulo Consultas

### 6.1 Stock y Precios
Consultar el stock disponible de cualquier artículo desglosado por sucursal y sus precios en las diferentes listas.

### 6.2 Seguimiento
Trazabilidad completa de todos los movimientos de stock: cuándo entró, cuándo salió, qué documento lo generó, etc.

### 6.3 Precios de Costo
Comparativa de precios de costo, precio de venta y margen por artículo.

---

## 7. Módulo Fondos

### 7.1 Caja

Gestión de la caja diaria por sucursal.

**Flujo de trabajo:**

1. **Abrir sesión**: al empezar el día, registrá el monto de apertura (dinero en efectivo con el que arranca la caja).
2. **Operar**: todas las ventas, cobros y anulaciones registran movimientos automáticos en la caja abierta.
3. **Movimientos manuales**: podés registrar ingresos o egresos extraordinarios (ej: pago de un gasto, retiro de dinero).
4. **Cerrar sesión**: al final del día, ingresá el monto de efectivo real. El sistema calcula:
   - **Monto esperado** = apertura + ventas efectivo + ingresos manuales - egresos manuales
   - **Diferencia** = monto real vs monto esperado
5. **Historial**: consultá sesiones de caja anteriores con filtro por fecha.

Solo puede haber **una sesión abierta por sucursal** a la vez.

### 7.2 Cobranzas

Gestión de cuenta corriente de clientes.

**Operaciones:**
- **Listar clientes** con saldo: muestra quiénes deben y cuánto.
- **Expandir cliente**: historial de todos los movimientos (cargos automáticos y pagos registrados).
- **Cobrar**: registrá un pago con el método correspondiente. Se genera un recibo automático.
- **Imprimir recibo** del cobro realizado.

Los **cargos** se generan automáticamente al vender a "Cuenta Corriente" desde el POS, Órdenes de Venta, Órdenes de Trabajo o Servicios de Óptica.

### 7.3 Recibos

Historial de todos los recibos emitidos, con opción de generar un recibo manual.

**Operaciones:** Listar, Crear recibo manual (cliente, monto, método, descripción, fecha), Imprimir.

---

## 8. Módulo Listados

### 8.1 Cuenta Corriente Clientes
Listado detallado de todos los movimientos de cuenta corriente por cliente, con filtros por fecha y nombre.

### 8.2 Venta de Artículos
Reporte de ventas agrupado por artículo. Filtrable por rango de fechas y tipo de documento (venta, orden, OT, servicio).

### 8.3 Lista de Precios
Listado imprimible de precios filtrado por lista de precio, categoría, subcategoría y marca.

---

## 9. Módulo Óptica

### 9.1 Órdenes de Trabajo (OT)

Sistema completo para gestionar pedidos de lentes recetados y armazones.

**Estados:** Nuevo → Pendiente → En Proceso → En Laboratorio → Terminado → Entregado (final) / Anulado (final)

**Operaciones:**

- **Crear OT**:
  1. Seleccionar o crear el **cliente**.
  2. Seleccionar el **médico** (opcional, de la lista de médicos).
  3. Cargar la **graduación** completa: valores de lejos y cerca para ojo derecho (OD) e izquierdo (OI): esfera, cilindro, eje, adición, distancia pupilar (DP), altura.
  4. Agregar **ítems**:
     - **Armazón**: seleccionar artículo del catálogo o cargar uno propio.
     - **Cristal**: tipo de lente.
     - **Tratamiento**: antirreflejo, fotocromático, etc.
     - **Otro**: cargo adicional.
  5. Ingresar el **costo** del trabajo (lo que cobra el laboratorio).
  6. Registrar un **anticipo** (opcional).
  7. El sistema calcula el total y el saldo pendiente.

- **Tareas**: cada OT puede tener una o más tareas asociadas a un laboratorio (propio o externo). Se puede hacer seguimiento del estado de cada tarea.

- **Pagos**: se pueden registrar pagos parciales o totales en cualquier estado (excepto anulado).

- **Cambiar estado**: según el avance real del trabajo.

- **Anular**: si hay saldo pendiente, se genera automáticamente un asiento de reversión.

- **Imprimir**: comprobante en formato A4 con código de barras, graduación completa, desglose de ítems y pagos.

- **Subir receta**: imagen de la receta médica (formulario de receta upload desde el detalle).

**Selector de lista de precios:** permite elegir qué lista usar para los precios al crear la OT.

### 9.2 Servicios de Óptica

Gestión de reparaciones y ajustes: soldadura, cambio de cristales, embutir bisagra, etc.

**Estados:** Pendiente → En Proceso → Terminado → Entregado (final) / Anulado (final)

**Operaciones:**
- **Crear servicio**: seleccionar cliente (obligatorio), detalle del trabajo, tipos de reparación (se pueden seleccionar múltiples, cada uno con su precio).
- **Tareas**: seguimiento simple (en proceso / terminada).
- **Pagos**: registrar con método y caja asociada.
- **Cambiar estado** a entregado o anulado.
- **Anular**: genera reversión automática si hay saldo.
- **Imprimir**: comprobante A4 con código de barras.

Numeración automática: **SV-XXXXX**.

### 9.3 Médicos

ABM de médicos oftalmólogos derivantes.

**Campos:** Nombre, Matrícula, Teléfono, Activo.
**Operaciones:** Listar, Crear, Editar, Eliminar.

---

## 10. Módulo Administración

**Accesible solo para Administradores.**

### 10.1 Sucursales
CRUD de sucursales del negocio.

**Campos:** Nombre, Dirección, Teléfono, Logo (imagen que aparece en el sistema), Color (personaliza el tema visual de la sucursal).

### 10.2 Usuarios
Gestión de usuarios del sistema.

**Operaciones:** Listar, Crear (nombre, email, rol, contraseña), Editar (cambio de datos y rol), Eliminar.

### 10.3 Roles
Roles del sistema (Administrador, Supervisor, Vendedor, o roles personalizados).

**Operaciones:** Listar, Crear, Editar, Eliminar. Se puede definir un rol como "default" para nuevos usuarios.

### 10.4 Permisos
Matriz de permisos granular. Desde esta pantalla se define **qué puede hacer cada rol** en cada módulo.

**Estructura:** Filas = operaciones del sistema (Ver artículos, Crear ventas, Anular remitos, etc.). Columnas = roles. Cada celda = permiso activo o inactivo.

Los permisos se organizan en: **Módulo → Submódulo → Operación**.

### 10.5 Listas de Precio
Gestión de listas de precios de venta y costo.

Se pueden crear múltiples listas (ej: Venta Público, Mayorista, Costo). Cada artículo puede tener precio distinto en cada lista.

### 10.6 Vendedores
Catálogo de vendedores (independiente de los usuarios del sistema).

**Operaciones:** Listar, Crear, Editar, Eliminar. Se asigna un vendedor a cada venta, orden y OT para comisiones o seguimiento.

### 10.7 Formas de Pago
Métodos de pago disponibles en el sistema.

- **Tipos:** Tarjeta de Crédito, Tarjeta de Débito, Bancaria, Billetera, Moneda.
- **Operaciones:** Crear, Editar, Activar/Desactivar.
- **Cuotas:** para Tarjetas de Crédito, se pueden configurar planes de cuotas con recargo porcentual.

---

## 11. Roles y Permisos

### Roles predefinidos

| Rol | Descripción |
|-----|-------------|
| **Administrador** | Acceso total al sistema. Sin restricciones. Puede administrar usuarios, roles y permisos. |
| **Supervisor** | Puede ver reportes, gestionar stock y clientes. No puede borrar datos. |
| **Vendedor** | Puede realizar ventas en POS, gestionar clientes y operar caja. No ve stock ni admin. |

### Resumen de accesos por módulo

| Módulo | Admin | Supervisor | Vendedor |
|--------|-------|-----------|---------|
| Ventas (POS, Historial) | CRUD completo | Solo consulta | Ver + Crear |
| Órdenes de Venta | CRUD completo | Solo consulta | Ver + Crear |
| Clientes | CRUD completo | CRUD completo | Ver + Crear |
| Artículos | CRUD completo | Solo consulta | Solo consulta |
| Stock / Remitos | CRUD completo | CRUD completo | Sin acceso |
| Ajustes de Stock | CRUD completo | CRUD completo | Sin acceso |
| Caja | CRUD completo | Solo consulta | Ver + Crear (abrir/cerrar) |
| Cobranzas | CRUD completo | Solo consulta | Sin acceso |
| Óptica (OT, Servicios) | CRUD completo | CRUD completo | CRUD completo |
| Administración | CRUD completo | Sin acceso | Sin acceso |

> **Nota:** Los permisos pueden ser personalizados por el Administrador desde la pantalla de Permisos.

---

*Documento generado el 09/06/2026 — MGA Punto de Venta*
