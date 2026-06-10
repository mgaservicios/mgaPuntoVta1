# Manual de Usuario — MGA Punto de Venta (versión 2)

## Índice

1. [¿Qué es MGA Punto de Venta?](#1-qu%C3%A9-es-mga-punto-de-venta)
2. [Inicio de sesión y sucursal activa](#2-inicio-de-sesi%C3%B3n-y-sucursal-activa)
3. [Ventas](#3-ventas)
   - [3.1 Punto de Venta (POS)](#31-punto-de-venta-pos)
   - [3.2 Historial de ventas](#32-historial-de-ventas)
   - [3.3 Órdenes de venta](#33-%C3%B3rdenes-de-venta)
   - [3.4 Clientes](#34-clientes)
   - [3.5 Notas de crédito](#35-notas-de-cr%C3%A9dito)
4. [Inventario](#4-inventario)
   - [4.1 Artículos](#41-art%C3%ADculos)
   - [4.2 Remitos](#42-remitos)
   - [4.3 Ajustes de stock](#43-ajustes-de-stock)
   - [4.4 Proveedores](#44-proveedores)
   - [4.5 Importador Óptica](#45-importador-%C3%B3ptica)
5. [Altas](#5-altas)
   - [5.1 Marcas](#51-marcas)
   - [5.2 Categorías](#52-categor%C3%ADas)
   - [5.3 Subcategorías](#53-subcategor%C3%ADas)
   - [5.4 Atributos](#54-atributos)
6. [Consultas](#6-consultas)
   - [6.1 Stock y precios](#61-stock-y-precios)
   - [6.2 Seguimiento](#62-seguimiento)
   - [6.3 Precios de costo](#63-precios-de-costo)
7. [Fondos](#7-fondos)
   - [7.1 Caja](#71-caja)
   - [7.2 Cobranzas](#72-cobranzas)
   - [7.3 Recibos](#73-recibos)
8. [Listados](#8-listados)
9. [Óptica](#9-%C3%B3ptica)
   - [9.1 Órdenes de Trabajo (OT)](#91-%C3%B3rdenes-de-trabajo-ot)
   - [9.2 Servicios de Óptica](#92-servicios-de-%C3%B3ptica)
   - [9.3 Médicos](#93-m%C3%A9dicos)
10. [Administración](#10-administraci%C3%B3n)
    - [10.1 Sucursales](#101-sucursales)
    - [10.2 Usuarios](#102-usuarios)
    - [10.3 Roles](#103-roles)
    - [10.4 Permisos](#104-permisos)
    - [10.5 Listas de Precio](#105-listas-de-precio)
    - [10.6 Vendedores](#106-vendedores)
    - [10.7 Formas de Pago](#107-formas-de-pago)
11. [Roles y permisos](#11-roles-y-permisos)

---

## 1. Qué es MGA Punto de Venta?

MGA Punto de Venta es un sistema pensado para gestionar ventas, stock, caja, clientes, cuentas por cobrar y servicios de óptica. El sistema se ordena en módulos fáciles de usar y muestra solo las opciones disponibles según tu rol.

> Tip: si no ves una opción en el menú, es probable que tu usuario no tenga permiso para acceder a ese módulo.

---

## 2. Inicio de sesión y sucursal activa

### 2.1 Ingresar al sistema

1. Abre el navegador.
2. Ingresa la dirección web del sistema.
3. Introduce tu usuario y contraseña.
4. Haz clic en **Ingresar**.

### 2.2 Seleccionar sucursal

Si tienes acceso a más de una sucursal, elige la sucursal activa desde el selector en la barra superior.

- La sucursal activa define el stock, la caja y los movimientos que ves.
- Todas las ventas, remitos y operaciones se registran en la sucursal seleccionada.

---

## 3. Ventas

### 3.1 Punto de Venta (POS)

Esta es la pantalla principal para cobrar y registrar ventas.

**Cómo realizar una venta:**

1. Selecciona la **lista de precios** que usarás (por ejemplo, Venta Público).
2. Busca los artículos por nombre, código o código de barras.
3. Añade los artículos al carrito.
4. Opcional: selecciona un **cliente**.
5. Si corresponde, aplica un **descuento global**.
6. Elige el método de pago:
   - **Efectivo**: ingresa el monto recibido y el sistema calcula el vuelto.
   - **Transferencia**.
   - **Tarjeta de Débito**.
   - **Tarjeta de Crédito**: permite seleccionar cuotas.
   - **Cuenta Corriente**: genera un cargo en la cuenta del cliente.
   - **Nota de Crédito**: usa una nota de crédito existente como pago.
   - **Otro**: métodos adicionales configurados.
7. Presiona **Cobrar**.
8. El sistema actualiza el stock y registra el movimiento en caja.
9. Al finalizar, puedes elegir imprimir el ticket.

### 3.2 Historial de ventas

El historial muestra todas las ventas realizadas.

Puedes:

- Filtrar por fecha y estado.
- Ver el detalle de cada venta (items, pagos, cliente).
- Anular una venta para revertir stock y caja.
- Imprimir el ticket en formato 80mm o A4.
- Eliminar ventas anuladas (solo usuarios Administrador).

### 3.3 Órdenes de venta

Las órdenes de venta son pedidos o presupuestos que siguen un proceso.

**Estados:**

- **Borrador**: aún no afecta stock ni caja.
- **Confirmada**: el stock se descuenta y se registran los pagos.
- **Anulada**: se revierten los cambios.

**Operaciones principales:**

- Crear una orden con artículo, cliente y forma de pago.
- Editar mientras está en borrador.
- Confirmar para aplicar stock y pagos.
- Anular para revertir el registro.
- Usar pago rápido desde el listado.
- Imprimir ticket 80mm o A4.
- Eliminar borradores (solo Administrador).

### 3.4 Clientes

En este módulo gestionas los datos de tus clientes.

**Información clave del cliente:**

- Nombre.
- Tipo: Particular, Empresa o Comercio.
- Email, teléfono, dirección y localidad.
- CUIT.
- Notas.

**Acciones disponibles:**

- Buscar clientes por nombre.
- Crear clientes nuevos.
- Editar datos existentes.
- Desactivar clientes sin borrarlos.

El saldo del cliente se calcula automáticamente con los movimientos de cuenta corriente.

### 3.5 Notas de crédito

Las notas de crédito representan un monto a favor del cliente.

**Estados posibles:**

- Pendiente.
- Utilizada.
- Anulada.

**Qué puedes hacer:**

- Emitir una nota de crédito para un cliente.
- Usarla como medio de pago en una venta u orden.
- Anularla para devolver el saldo disponible.

---

## 4. Inventario

### 4.1 Artículos

Aquí se administra el catálogo de productos.

**Tipos de artículos:**

- **Simple:** un solo precio y un solo stock.
- **Con variantes:** el artículo tiene versiones como talle, color o material.

**Funciones principales:**

- Buscar artículos por nombre o código.
- Crear artículos nuevos.
- Editar datos, precios y variantes.
- Subir imágenes.
- Desactivar artículos sin eliminarlos.
- Configurar precios por lista (por ejemplo, Venta Público o Mayorista).

### 4.2 Remitos

Los remitos son documentos de ingreso o egreso de mercadería.

**Tipos de remito:**

- **Entrada:** ingresa stock al depósito.
- **Salida:** sale stock del depósito.

**Estados disponibles:**

- Borrador.
- Confirmado.
- Anulado.

**Qué permite hacer:**

- Crear remitos seleccionando tipo, sucursal, contraparte e ítems.
- Ver el detalle de cada remito.
- Editar remitos en estado borrador.
- Confirmar para aplicar el stock.
- Anular para revertir los cambios.

Si haces una transferencia entre sucursales, el sistema crea automáticamente el remito de entrada en la sucursal de destino.

### 4.3 Ajustes de stock

Se utiliza para corregir diferencias entre stock físico y stock del sistema.

**Acciones:**

- Ver las discrepancias detectadas.
- Registrar el stock correcto.
- Generar un remito de ajuste automático.

### 4.4 Proveedores

Aquí se administra la lista de proveedores.

**Qué se puede hacer:**

- Listar proveedores.
- Crear nuevos proveedores.
- Editar datos.
- Desactivar proveedores.

Los proveedores se usan en remitos de entrada y se pueden asociar a artículos.

### 4.5 Importador Óptica

Herramienta para cargar datos desde archivos CSV.

**Pestañas principales:**

1. **Artículos:** importa código, descripción, categoría y código de barras.
2. **Precios:** actualiza precios de venta de artículos existentes.
3. **Stock:** crea remitos de entrada automáticos para el stock inicial.

El sistema detecta el separador del CSV (coma, punto y coma o tabulación) y muestra una vista previa antes de importar.

---

## 5. Altas

En este módulo se definen los datos que clasifican los artículos.

### 5.1 Marcas

Administra las marcas disponibles para tus productos.

### 5.2 Categorías

Agrupa los artículos en categorías como lentes, armazones o accesorios.

### 5.3 Subcategorías

Organiza categorías en subcategorías (por ejemplo, dentro de Lentes: Sol, Recetados).

### 5.4 Atributos

Define atributos que se usan en las variantes de artículos, como talle, color o material.

---

## 6. Consultas

### 6.1 Stock y precios

Consulta el stock disponible por artículo y sucursal, y compara precios en cada lista.

### 6.2 Seguimiento

Revisa el historial de movimientos de stock: cuándo entró, cuándo salió y qué documento lo generó.

### 6.3 Precios de costo

Compara el precio de costo con el precio de venta y el margen de cada artículo.

---

## 7. Fondos

### 7.1 Caja

Gestiona la caja diaria de cada sucursal.

**Proceso de uso:**

1. Abrir la sesión de caja con el monto inicial.
2. Registrar ventas y cobros en la caja abierta.
3. Registrar ingresos o egresos manuales.
4. Cerrar la sesión con el monto final contado.

El sistema calcula automáticamente:

- Monto esperado = apertura + efectivo de ventas + ingresos manuales - egresos manuales.
- Diferencia = monto real contado - monto esperado.

> Nota: solo puede haber una sesión de caja abierta por sucursal.

### 7.2 Cobranzas

Administra las cuentas corrientes de los clientes.

**Qué puedes hacer:**

- Ver clientes con saldo.
- Consultar el historial de movimientos de cada cliente.
- Registrar pagos y generar recibos.
- Imprimir el comprobante de cobro.

Los cargos se generan automáticamente cuando se vende a **Cuenta Corriente** desde POS, órdenes de venta, órdenes de trabajo u óptica.

### 7.3 Recibos

Historial de recibos emitidos y creación de recibos manuales.

**Opciones:**

- Listar recibos existentes.
- Crear un recibo manual con cliente, monto, método, descripción y fecha.
- Imprimir el recibo.

---

## 8. Listados

Módulo de informes rápidos.

### 8.1 Cuenta Corriente Clientes

Reporte con todos los movimientos de cuenta corriente por cliente, filtrable por fecha y nombre.

### 8.2 Venta de Artículos

Reporte de ventas por artículo, con filtros por rango de fechas y tipo de documento.

### 8.3 Lista de Precios

Listado imprimible de precios filtrado por lista, categoría, subcategoría y marca.

---

## 9. Óptica

### 9.1 Órdenes de Trabajo (OT)

Gestiona pedidos de lentes recetados y armazones.

**Estados principales:**

- Nuevo.
- Pendiente.
- En proceso.
- En laboratorio.
- Terminado.
- Entregado.
- Anulado.

**Pasos para crear una OT:**

1. Seleccionar o crear el cliente.
2. Seleccionar el médico (opcional).
3. Completar la graduación para OD y OI.
4. Agregar ítems: armazón, cristal, tratamiento u otros cargos.
5. Registrar el costo del trabajo del laboratorio.
6. Registrar un anticipo si corresponde.

El sistema calcula el total y el saldo pendiente.

**Funciones adicionales:**

- Registrar tareas vinculadas a un laboratorio.
- Cambiar el estado según avance.
- Registrar pagos parciales o totales.
- Anular con reversión automática si corresponde.
- Imprimir comprobante en formato A4.
- Subir la imagen de la receta médica.

### 9.2 Servicios de Óptica

Administra trabajos de reparación y ajuste.

**Estados:**

- Pendiente.
- En proceso.
- Terminado.
- Entregado.
- Anulado.

**Qué permite hacer:**

- Crear servicios con cliente y detalle del trabajo.
- Elegir tipos de reparación y precios.
- Registrar tareas y pagos.
- Cambiar estado a entregado o anulado.
- Imprimir comprobante A4.

**Numeración automática:** SV-XXXXX.

### 9.3 Médicos

Administra los médicos oftalmólogos derivados.

**Campos:**

- Nombre.
- Matrícula.
- Teléfono.
- Estado activo/inactivo.

**Operaciones:**

- Listar.
- Crear.
- Editar.
- Eliminar.

---

## 10. Administración

Este módulo está disponible solo para usuarios Administrador.

### 10.1 Sucursales

Gestiona las sucursales del negocio.

**Campos:**

- Nombre.
- Dirección.
- Teléfono.
- Logo.
- Color temático.

### 10.2 Usuarios

Administra los usuarios del sistema.

**Acciones:**

- Listar usuarios.
- Crear usuarios con nombre, email, rol y contraseña.
- Editar datos y rol.
- Eliminar usuarios.

### 10.3 Roles

Configura los roles del sistema.

**Funciones:**

- Listar roles.
- Crear roles nuevos.
- Editar roles existentes.
- Eliminar roles.
- Definir rol predeterminado para nuevos usuarios.

### 10.4 Permisos

Controla lo que cada rol puede hacer en el sistema.

**Cómo funciona:**

- Las filas representan operaciones.
- Las columnas representan roles.
- Cada casilla indica si el permiso está activado o desactivado.

Los permisos se organizan por módulo, submódulo y operación.

### 10.5 Listas de Precio

Administra las listas de precios de venta y costo.

**Opciones:**

- Crear listas nuevas.
- Editar precios por lista.
- Usar diferentes listas según el tipo de cliente o venta.

### 10.6 Vendedores

Gestiona los vendedores independientes del acceso al sistema.

**Funciones:**

- Listar vendedores.
- Crear nuevos vendedores.
- Editar datos.
- Eliminar vendedores.

Los vendedores se asignan a ventas, órdenes y OT para seguimiento.

### 10.7 Formas de Pago

Administra los métodos de pago disponibles.

**Tipos comunes:**

- Tarjeta de Crédito.
- Tarjeta de Débito.
- Transferencia Bancaria.
- Billetera.
- Moneda.

**Opciones:**

- Crear y editar métodos.
- Activar o desactivar formas de pago.
- Configurar cuotas para tarjetas de crédito.

---

## 11. Roles y permisos

### Roles predefinidos

| Rol | Qué puede hacer |
|---|---|
| Administrador | Acceso total y administración del sistema. |
| Supervisor | Consultas, stock y clientes. No puede borrar datos. |
| Vendedor | Ventas, clientes y caja. No accede a administración ni stock avanzado. |

### Accesos por módulo

| Módulo | Administrador | Supervisor | Vendedor |
|---|---|---|---|
| Ventas (POS, Historial) | Completo | Consulta | Ver y crear |
| Órdenes de Venta | Completo | Consulta | Ver y crear |
| Clientes | Completo | Completo | Ver y crear |
| Artículos | Completo | Consulta | Consulta |
| Stock / Remitos | Completo | Completo | Sin acceso |
| Ajustes de Stock | Completo | Completo | Sin acceso |
| Caja | Completo | Consulta | Ver y crear |
| Cobranzas | Completo | Consulta | Sin acceso |
| Óptica (OT, Servicios) | Completo | Completo | Completo |
| Administración | Completo | Sin acceso | Sin acceso |

> Nota: los permisos pueden ajustarse desde el módulo de Permisos.

---

*Manual de usuario MGA Punto de Venta — versión 2*