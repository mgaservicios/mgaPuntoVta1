# DATABASE.md — Schema de base de datos

Base de datos PostgreSQL gestionada en Supabase.
Script completo en `supabase/schema.sql`.

> **Nota sobre `articulo_stock`:** El schema.sql define `id bigserial primary key` + índices parciales.
> La tabla real en Supabase se creó con PK compuesta `(articulo_id, sucursal_id)` sin columna `id`.
> Para soportar múltiples variantes por sucursal se debe migrar (ver sección al final).

---

## Extensiones

```sql
create extension if not exists pg_trgm;  -- búsqueda fuzzy
```

---

## Tablas

### `public.roles`
Roles del sistema. Dinámicos — se pueden agregar desde el panel.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| name | text UNIQUE NOT NULL | ej: 'Administrador' |
| description | text | |
| is_default | boolean | Solo uno puede ser true (partial unique index) |
| created_at | timestamptz | |

Datos iniciales: Administrador (id=1), Supervisor (id=2), Vendedor (id=3, is_default=true)

---

### `public.users`
Extiende `auth.users` de Supabase con perfil y rol.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid PK | FK → auth.users(id) ON DELETE CASCADE |
| email | text NOT NULL | |
| name | text | |
| role_id | bigint NOT NULL | FK → roles(id) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS habilitado. Solo service_role tiene acceso total; usuarios ven su propio perfil.

---

### `public.role_permissions`
Permisos por módulo y rol. Editable desde el panel de admin.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| role_id | bigint NOT NULL | FK → roles(id) |
| module | text NOT NULL | 'articulos','ventas','stock','cobranzas','caja','clientes','proveedores','admin' |
| can_view | boolean | |
| can_create | boolean | |
| can_edit | boolean | |
| can_delete | boolean | |

UNIQUE(role_id, module)

---

### `public.sucursales`
Locales/sucursales del negocio. Soporta personalización visual (logo y color de marca).

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| nombre | text NOT NULL | |
| direccion | text | |
| telefono | text | |
| activo | boolean | default true |
| logo_url | text | URL pública en Supabase Storage (bucket `sucursales`) |
| color | text | Color hex `#RRGGBB` — usado como fondo del sidebar y variable CSS `--primary` |
| created_at / updated_at | timestamptz | |

Migración: `supabase/migrations/20260609_sucursales_logo_color.sql`
Ver detalles del sistema de theming en [context/modulos/ui-theming.md](modulos/ui-theming.md).

---

### `public.user_sucursales`
Qué sucursales puede ver cada usuario.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| user_id | uuid NOT NULL | FK → users(id) ON DELETE CASCADE |
| sucursal_id | bigint NOT NULL | FK → sucursales(id) ON DELETE CASCADE |

UNIQUE(user_id, sucursal_id)

---

### `public.clientes`
Clientes del negocio.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| nombre | text NOT NULL | Índice GIN trgm para búsqueda fuzzy |
| tipo | text | CHECK: 'PARTICULAR','EMPRESA','COMERCIO' |
| email / telefono / direccion / localidad | text | |
| cuit | text | |
| notas | text | |
| activo | boolean | |
| created_at / updated_at | timestamptz | |

---

### `public.proveedores`
Proveedores de artículos.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| nombre / cuit / telefono / email / direccion / localidad / notas | text | |
| activo | boolean | |
| created_at / updated_at | timestamptz | |

---

### `public.categorias`
Categorías de artículos.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| nombre | text UNIQUE NOT NULL | |
| activo | boolean | |
| created_at | timestamptz | |

---

### `public.marcas`
Marcas de artículos.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| nombre | text UNIQUE NOT NULL | |
| activo | boolean | |
| created_at | timestamptz | |

---

### `public.atributo_tipos`
Tipos de atributo para variantes (ej: Talle, Color, Tamaño, Material).

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| nombre | text UNIQUE NOT NULL | |
| activo | boolean | |
| created_at | timestamptz | |

Datos iniciales: Talle, Color, Tamaño, Material.

---

### `public.articulos`
Catálogo de artículos. Pueden ser simples o con variantes.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| codigo | text UNIQUE | Código interno |
| nombre | text NOT NULL | Índice GIN trgm |
| descripcion | text | |
| tipo_articulo | text | CHECK: 'simple','con_variantes' |
| categoria_id | bigint | FK → categorias(id) |
| marca_id | bigint | FK → marcas(id) |
| proveedor_id | bigint | FK → proveedores(id) |
| precio_venta | numeric(12,2) | null para artículos con variantes |
| precio_compra | numeric(12,2) | |
| stock_actual | numeric(10,3) | **Total calculado** — fuente real: articulo_stock |
| stock_minimo | numeric(10,3) | |
| unidad | text | CHECK: 'unidad','kg','gr','lt','ml','caja','bolsa','metro','par' |
| codigo_barras | text UNIQUE | |
| activo | boolean | |
| imagen_url | text | |
| created_at / updated_at | timestamptz | |

---

### `public.articulo_variantes`
Variantes de un artículo (ej: Zapatilla talle 40 color rojo).

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| articulo_id | bigint NOT NULL | FK → articulos(id) ON DELETE CASCADE |
| sku | text UNIQUE | Código de variante |
| codigo_barras | text UNIQUE | |
| precio_venta | numeric(12,2) | Precio específico de la variante |
| precio_compra | numeric(12,2) | |
| stock_actual | numeric(10,3) | **Total calculado** — fuente real: articulo_stock |
| stock_minimo | numeric(10,3) | |
| activo | boolean | |
| created_at / updated_at | timestamptz | |

---

### `public.variante_atributos`
Atributos de cada variante (ej: Talle = L, Color = Rojo).

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| variante_id | bigint NOT NULL | FK → articulo_variantes(id) ON DELETE CASCADE |
| atributo_tipo_id | bigint NOT NULL | FK → atributo_tipos(id) |
| valor | text NOT NULL | ej: 'L', 'Rojo' |

UNIQUE(variante_id, atributo_tipo_id) — Una variante no puede tener dos valores para el mismo atributo.

---

### `public.articulo_stock` ⚠️
Stock por artículo/variante/sucursal. **Fuente única de verdad del stock.**

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | ⚠️ En DB real: PK compuesta — ver nota |
| articulo_id | bigint NOT NULL | FK → articulos(id) ON DELETE CASCADE |
| variante_id | bigint | FK → articulo_variantes(id) ON DELETE CASCADE |
| sucursal_id | bigint NOT NULL | FK → sucursales(id) |
| stock_actual | numeric(10,3) | |
| stock_minimo | numeric(10,3) | |
| created_at / updated_at | timestamptz | |

**Índices únicos parciales:**
- `articulo_stock_simple_idx` ON (articulo_id, sucursal_id) WHERE variante_id IS NULL
- `articulo_stock_variante_idx` ON (articulo_id, variante_id, sucursal_id) WHERE variante_id IS NOT NULL

> **⚠️ Estado actual de la DB:** La tabla fue creada con PK `(articulo_id, sucursal_id)` sin columna `id`.
> Para soportar múltiples variantes del mismo artículo por sucursal se debe migrar:
> ```sql
> ALTER TABLE public.articulo_stock DROP CONSTRAINT articulo_stock_pkey;
> ALTER TABLE public.articulo_stock ADD COLUMN id bigserial;
> ALTER TABLE public.articulo_stock ADD CONSTRAINT articulo_stock_pkey PRIMARY KEY (id);
> CREATE UNIQUE INDEX articulo_stock_simple_idx ON public.articulo_stock (articulo_id, sucursal_id) WHERE variante_id IS NULL;
> CREATE UNIQUE INDEX articulo_stock_variante_idx ON public.articulo_stock (articulo_id, variante_id, sucursal_id) WHERE variante_id IS NOT NULL;
> ```

---

### `public.caja_sesiones`
Sesiones de caja (apertura/cierre).

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| usuario_id | uuid NOT NULL | FK → users(id) |
| fecha_apertura | timestamptz | |
| monto_apertura | numeric(12,2) | |
| fecha_cierre | timestamptz | |
| monto_cierre | numeric(12,2) | Ingresado al cerrar |
| monto_esperado | numeric(12,2) | Calculado por función |
| diferencia | numeric(12,2) | monto_cierre - monto_esperado |
| observaciones | text | |
| estado | text | CHECK: 'abierta','cerrada' |
| created_at | timestamptz | |

Índice único parcial: solo puede haber UNA sesión abierta a la vez.

---

### `public.caja_movimientos`
Ingresos/egresos manuales de caja (no ventas).

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| sesion_id | bigint NOT NULL | FK → caja_sesiones(id) |
| tipo | text | CHECK: 'ingreso','egreso' |
| concepto | text NOT NULL | |
| monto | numeric(12,2) NOT NULL | |
| usuario_id | uuid NOT NULL | FK → users(id) |
| created_at | timestamptz | |

Las anulaciones de ventas/órdenes generan movimientos de egreso automáticamente.

---

### `public.ventas`
Ventas realizadas en el POS.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| numero | text UNIQUE NOT NULL | Generado automáticamente |
| fecha | date | |
| cliente_id | bigint | FK → clientes(id) — nullable |
| vendedor_id | uuid NOT NULL | FK → users(id) |
| caja_sesion_id | bigint NOT NULL | FK → caja_sesiones(id) |
| subtotal | numeric(12,2) | |
| descuento_pct | numeric(5,2) | |
| descuento_monto | numeric(12,2) | |
| total | numeric(12,2) | |
| sucursal_id | bigint | FK → sucursales(id) — determina de qué sucursal se descuenta stock |
| estado | text | CHECK: 'completada','anulada' |
| observaciones | text | |
| created_at / updated_at | timestamptz | |

---

### `public.venta_items`
Ítems de cada venta.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| venta_id | bigint NOT NULL | FK → ventas(id) ON DELETE CASCADE |
| articulo_id | bigint NOT NULL | FK → articulos(id) |
| variante_id | bigint | FK → articulo_variantes(id) — nullable |
| nombre_articulo | text NOT NULL | Snapshot del nombre al momento de la venta |
| descripcion_variante | text | Snapshot de los atributos |
| cantidad | numeric(10,3) NOT NULL | Negativo = devolución |
| precio_unitario | numeric(12,2) NOT NULL | |
| descuento_pct | numeric(5,2) | |
| subtotal | numeric(12,2) NOT NULL | |
| created_at | timestamptz | |

---

### `public.notas_credito`
Notas de crédito emitidas a clientes.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| numero | text UNIQUE NOT NULL | |
| cliente_id | bigint NOT NULL | FK → clientes(id) |
| fecha | date | |
| monto | numeric(12,2) NOT NULL CHECK > 0 | Monto original |
| monto_disponible | numeric(12,2) NOT NULL CHECK >= 0 | Saldo restante |
| estado | text | CHECK: 'pendiente','utilizada','anulada' |
| observaciones | text | |
| created_by | uuid NOT NULL | FK → users(id) |
| created_at / updated_at | timestamptz | |

---

### `public.venta_pagos`
Métodos de pago de cada venta.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| venta_id | bigint NOT NULL | FK → ventas(id) ON DELETE CASCADE |
| metodo | text NOT NULL | CHECK: 'EFECTIVO','TRANSFERENCIA','TARJETA_DEBITO','TARJETA_CREDITO','CUENTA_CORRIENTE','NOTA_CREDITO','OTRO' |
| monto | numeric(12,2) NOT NULL | |
| referencia | text | |
| nota_credito_id | bigint | FK → notas_credito(id) — solo si metodo='NOTA_CREDITO' |
| created_at | timestamptz | |

---

### `public.movimientos_stock`
Auditoría de movimientos de stock (append-only).

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| articulo_id | bigint NOT NULL | FK → articulos(id) |
| variante_id | bigint | FK → articulo_variantes(id) |
| tipo | text | CHECK: 'entrada','salida','ajuste','venta','devolucion' |
| cantidad | numeric(10,3) NOT NULL | |
| costo_unitario | numeric(12,2) | |
| stock_antes | numeric(10,3) NOT NULL | |
| stock_despues | numeric(10,3) NOT NULL | |
| venta_id / venta_item_id | bigint | FK hacia ventas |
| proveedor_id | bigint | FK → proveedores(id) |
| sucursal_id | bigint | FK → sucursales(id) |
| usuario_id | uuid NOT NULL | FK → users(id) |
| referencia / observaciones | text | |
| created_at | timestamptz | |

---

### `public.cobranzas`
Cargos y pagos de cuenta corriente de clientes.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| cliente_id | bigint NOT NULL | FK → clientes(id) |
| venta_id | bigint | FK → ventas(id) — nullable |
| orden_id | bigint | FK → ordenes_venta(id) — nullable; OV que generó el CARGO |
| optica_orden_id | bigint | FK → optica_ordenes(id) — nullable; OT que generó el CARGO |
| optica_servicio_id | bigint | FK → optica_servicios(id) — nullable; SV que generó el CARGO |
| tipo | text | CHECK: 'CARGO','PAGO' |
| monto | numeric(12,2) NOT NULL | |
| fecha | date NOT NULL | |
| metodo | text | CHECK: 'EFECTIVO','TRANSFERENCIA','TARJETA_DEBITO','TARJETA_CREDITO','CHEQUE','OTRO' — se usa en PAGOs |
| descripcion / notas | text | |
| usuario_id | uuid NOT NULL | FK → users(id) |
| created_at | timestamptz | |

Saldo del cliente = suma de CARGOs − suma de PAGOs (función `saldo_cliente()`).

**Flujo de CARGOs:** cuando se registra un pago con CUENTA_CORRIENTE en cualquier módulo,
se crea automáticamente un CARGO en esta tabla con la FK al documento origen:
- POS: `venta_id`
- Órdenes de venta (confirmación o pago adicional): `orden_id`
- Óptica OT: `optica_orden_id`
- Óptica SV: `optica_servicio_id`

**Anulaciones:** al anular una OT o SV que tenía pagos CC, se crea un PAGO reversal con la
misma FK para cancelar la deuda.

Migración: `supabase/migrations/20260609_cobranzas_refs.sql`

---

### `public.ordenes_venta`
Órdenes de venta (pedidos/presupuestos).

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| numero | text UNIQUE NOT NULL | |
| fecha / vencimiento | date | |
| cliente_id | bigint | FK → clientes(id) — nullable |
| vendedor_id | uuid NOT NULL | FK → users(id) |
| condicion_pago | text | CHECK: 'contado','cuenta_corriente','otro' |
| subtotal / descuento_pct / descuento_monto / total | numeric | |
| estado | text | CHECK: 'borrador','confirmada','anulada' |
| sucursal_id | bigint | FK → sucursales(id) — stock se descuenta de aquí al confirmar |
| observaciones | text | |
| created_by | uuid NOT NULL | FK → users(id) |
| created_at / updated_at | timestamptz | |

---

### `public.orden_venta_items`
Ítems de cada orden.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| orden_id | bigint NOT NULL | FK → ordenes_venta(id) ON DELETE CASCADE |
| articulo_id | bigint NOT NULL | FK → articulos(id) |
| variante_id | bigint | FK → articulo_variantes(id) — nullable |
| nombre_articulo / descripcion_variante | text | Snapshots al confirmar |
| cantidad | numeric(10,3) NOT NULL | |
| precio_unitario | numeric(12,2) NOT NULL | |
| descuento_pct | numeric(5,2) | |
| subtotal | numeric(12,2) NOT NULL | |
| created_at | timestamptz | |

---

### `public.orden_venta_pagos`
Métodos de pago de cada orden.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| orden_id | bigint NOT NULL | FK → ordenes_venta(id) ON DELETE CASCADE |
| metodo | text NOT NULL | CHECK: 'EFECTIVO','TRANSFERENCIA','TARJETA_DEBITO','TARJETA_CREDITO','CUENTA_CORRIENTE','NOTA_CREDITO','CHEQUE','OTRO' |
| monto | numeric(12,2) NOT NULL | |
| referencia | text | |
| nota_credito_id | bigint | FK → notas_credito(id) — solo si metodo='NOTA_CREDITO' |
| fecha_pago | date | |
| created_at | timestamptz | |

---

### `public.remitos`
Documentos de entrada/salida de stock.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| numero | text UNIQUE NOT NULL | |
| tipo | text | CHECK: 'entrada','salida' |
| sucursal_id | bigint NOT NULL | FK → sucursales(id) — sucursal que recibe o entrega |
| contraparte_tipo | text | CHECK: 'persona','proveedor','sucursal' |
| contraparte_nombre | text | Para tipo 'persona' |
| contraparte_sucursal_id | bigint | FK → sucursales(id) — para tipo 'sucursal' |
| contraparte_proveedor_id | bigint | FK → proveedores(id) — para tipo 'proveedor' |
| fecha | timestamptz | |
| estado | text | CHECK: 'borrador','confirmado','anulado' |
| observaciones | text | |
| created_by | uuid NOT NULL | FK → users(id) |
| created_at / updated_at | timestamptz | |

---

### `public.remito_items`
Ítems de cada remito.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigserial PK | |
| remito_id | bigint NOT NULL | FK → remitos(id) ON DELETE CASCADE |
| articulo_id | bigint NOT NULL | FK → articulos(id) |
| variante_id | bigint | FK → articulo_variantes(id) — nullable |
| cantidad | numeric(10,3) NOT NULL | |
| costo_unitario | numeric(12,2) | |
| created_at | timestamptz | |

---

---

### `public.optica_medicos`
Médicos que firman recetas ópticas.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| nombre | text NOT NULL | |
| matricula | text | |
| telefono | text | |
| activo | boolean | default true |
| created_at | timestamptz | |

---

### `public.optica_ordenes`
Órdenes de trabajo óptica. Incluye graduación completa, ítems, tareas y pagos relacionados.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| numero | text UNIQUE NOT NULL | Correlativo `OT-XXXXX` |
| fecha | date | default `current_date` |
| fecha_prometida | date | |
| cliente_id | bigint | FK → clientes(id) — nullable |
| medico_id | bigint | FK → optica_medicos(id) — nullable |
| medico_nombre | text | Alternativa libre |
| receta_url | text | URL Supabase Storage |
| lejos_od/oi_esfera/cilindro/eje | numeric/smallint | Graduación lejos |
| cerca_od/oi_esfera/cilindro/eje | numeric/smallint | Graduación cerca |
| adicion | numeric(4,2) | |
| dp | numeric(5,2) | Distancia pupilar |
| estado | text | CHECK: ver ciclo de vida en optica-ordenes.md |
| observaciones | text | |
| costo_trabajo | numeric(12,2) | Mano de obra manual |
| anticipo | numeric(12,2) | Seña informativa al crear |
| subtotal / descuento_pct / descuento_monto / total | numeric | |
| sucursal_id | bigint | FK → sucursales(id) |
| created_by | uuid NOT NULL | FK → users(id) |
| created_at / updated_at | timestamptz | |

---

### `public.optica_orden_items`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| orden_id | bigint NOT NULL | FK → optica_ordenes(id) ON DELETE CASCADE |
| tipo | text | CHECK: `'armazon'`, `'cristal'`, `'tratamiento'`, `'otro'` |
| uso | text | CHECK: `'lejos'`, `'cerca'`, `'ambos'` — nullable |
| nombre | text NOT NULL | |
| armazon_propio | boolean | Si el cliente trajo el armazón |
| articulo_id / variante_id | bigint | FK → articulos / articulo_variantes — nullable |
| cantidad / precio_unitario / descuento_pct / subtotal | numeric | |
| notas | text | |

---

### `public.optica_orden_tareas`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| orden_id | bigint NOT NULL | FK → optica_ordenes(id) ON DELETE CASCADE |
| titulo / descripcion | text | |
| estado | text | CHECK: `'en_proceso'`, `'en_laboratorio'`, `'terminada'` |
| fecha / fecha_fin | date | `fecha_fin` se completa al marcar `terminada` |
| usuario_id | uuid | FK → users(id) — **hay dos FK a users** (también `created_by`) |
| laboratorio_nombre | text | |
| laboratorio_tipo | text | CHECK: `'propio'`, `'externo'` |
| created_by | uuid | FK → users(id) |
| created_at / updated_at | timestamptz | |

> **⚠️ Gotcha PostgREST:** Dos FK a `users`. Usar siempre `users!usuario_id(name, email)` en `.select()`.

---

### `public.optica_orden_pagos`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| orden_id | bigint NOT NULL | FK → optica_ordenes(id) ON DELETE CASCADE |
| caja_sesion_id | bigint | FK → caja_sesiones(id) — nullable |
| metodo | text | CHECK: `EFECTIVO`, `TRANSFERENCIA`, `TARJETA_DEBITO`, `TARJETA_CREDITO`, `CUENTA_CORRIENTE`, `CHEQUE`, `OTRO` |
| monto | numeric(12,2) | Puede ser **negativo** (pago de anulación) |
| concepto / referencia | text | `concepto = 'ANULACION OT OT-XXXXX'` para pagos de anulación |
| fecha_pago | date | |
| usuario_id | uuid | FK → users(id) |
| created_at | timestamptz | |

---

### `public.optica_servicios`
Servicios de reparación / ajuste óptica.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| numero | text UNIQUE NOT NULL | Correlativo `SV-XXXXX` |
| fecha | date | default `current_date` |
| fecha_prometida | date | |
| cliente_id | bigint NOT NULL | FK → clientes(id) — **obligatorio** |
| detalle | text | Descripción general del trabajo |
| observaciones | text | Notas internas |
| costo_trabajo | numeric(12,2) | Mano de obra general manual |
| subtotal | numeric(12,2) | sum(tipos.precio) + costo_trabajo |
| descuento_pct / descuento_monto | numeric | |
| total | numeric(12,2) | subtotal − descuento_monto |
| anticipo | numeric(12,2) | Seña informativa al crear |
| estado | text | CHECK: `'pendiente'`,`'en_proceso'`,`'terminado'`,`'entregado'`,`'anulado'` |
| sucursal_id | bigint | FK → sucursales(id) |
| created_by | uuid NOT NULL | FK → users(id) |
| created_at / updated_at | timestamptz | |

---

### `public.optica_servicio_tipos`
Tipos de reparación por servicio (uno o varios por servicio).

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| servicio_id | bigint NOT NULL | FK → optica_servicios(id) ON DELETE CASCADE |
| tipo | text NOT NULL | CHECK: `garantia`, `soldadura`, `patillas`, `plaquetas`, `terminales`, `tanza`, `cristales`, `embutir_bisgra`, `pase_armazon`, `cambio_cristales_sol_neutros`, `otros` |
| detalle | text | Descripción específica del tipo |
| precio | numeric(12,2) | Precio individual — suma al subtotal del servicio |
| estado | text NOT NULL | CHECK: `'pendiente'`, `'en_proceso'`, `'terminado'` — default `'pendiente'` |

Migración: `supabase/migrations/20260609_servicio_tipos_estado.sql`

---

### `public.optica_servicio_tareas`
Tareas de seguimiento del servicio. Sin campos de laboratorio (a diferencia de `optica_orden_tareas`).

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| servicio_id | bigint NOT NULL | FK → optica_servicios(id) ON DELETE CASCADE |
| titulo | text NOT NULL | |
| descripcion | text | |
| estado | text | CHECK: `'en_proceso'`, `'terminada'` |
| fecha / fecha_fin | date | `fecha_fin` se completa al marcar `terminada` |
| usuario_id | uuid | FK → users(id) — **hay dos FK a users** (también `created_by`) |
| created_by | uuid | FK → users(id) |
| created_at / updated_at | timestamptz | |

> **⚠️ Gotcha PostgREST:** Dos FK a `users`. Usar siempre `users!usuario_id(name, email)` en `.select()`.

---

### `public.optica_servicio_pagos`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| servicio_id | bigint NOT NULL | FK → optica_servicios(id) ON DELETE CASCADE |
| caja_sesion_id | bigint | FK → caja_sesiones(id) — nullable |
| metodo | text | CHECK: `EFECTIVO`, `TRANSFERENCIA`, `TARJETA_DEBITO`, `TARJETA_CREDITO`, `CUENTA_CORRIENTE`, `CHEQUE`, `OTRO` |
| monto | numeric(12,2) | Puede ser **negativo** (pago de anulación) |
| concepto / referencia | text | `concepto = 'ANULACION SV SV-XXXXX'` para pagos de anulación |
| fecha_pago | date | |
| usuario_id | uuid | FK → users(id) |
| created_at | timestamptz | |

---

### `public.eliminaciones_log`
Auditoría de eliminaciones de documentos. Solo administradores pueden eliminar; se inserta en este log tras cada eliminación exitosa.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | bigint IDENTITY PK | |
| tipo | text NOT NULL | CHECK: `'optica_ot'`, `'optica_servicio'`, `'orden_venta'`, `'venta'`, `'remito'` |
| referencia_id | bigint NOT NULL | ID del registro eliminado |
| numero | text | Número del documento (snapshot) |
| cliente_nombre | text | Nombre del cliente al momento de eliminar |
| total | numeric(12,2) | Total del documento |
| fecha_documento | date | Fecha del documento original |
| sucursal_id | bigint | FK → sucursales(id) — nullable |
| estado_previo | text | Estado que tenía al momento de eliminar |
| usuario_id | uuid NOT NULL | FK → auth.users(id) — quién eliminó |
| datos_extra | jsonb | Campos adicionales (cliente_id, tipo_remito, etc.) |
| eliminado_at | timestamptz | default `now()` |

Migración: `supabase/migrations/20260603_eliminaciones_log.sql`

---

## Funciones SQL

### `buscar_articulos(p_query text, p_limit int)`
Búsqueda fuzzy de artículos para POS y ajuste de stock.
Combina `ILIKE` (nombre, código, código de barras) con `similarity()` (pg_trgm).
Solo retorna artículos activos. Ordenados por relevancia.

Retorna: `id, codigo, nombre, tipo_articulo, precio_venta, stock_actual, imagen_url`

### `saldo_cliente(p_cliente_id bigint)`
Calcula saldo de cuenta corriente del cliente.
`SUM(CARGO) - SUM(PAGO)` desde `cobranzas`. Positivo = cliente debe.

### `caja_monto_esperado(p_sesion_id bigint)`
Calcula el efectivo esperado en caja al momento del cierre:
`monto_apertura + ventas_efectivo + ingresos_manuales - egresos_manuales`

---

## Índices únicos parciales relevantes

```sql
-- Solo un rol default
CREATE UNIQUE INDEX roles_is_default_true ON roles (is_default) WHERE is_default = true;

-- Solo una sesión de caja abierta a la vez
CREATE UNIQUE INDEX caja_un_abierta ON caja_sesiones (estado) WHERE estado = 'abierta';

-- Stock por sucursal — permite múltiples variantes del mismo artículo
CREATE UNIQUE INDEX articulo_stock_simple_idx ON articulo_stock (articulo_id, sucursal_id) WHERE variante_id IS NULL;
CREATE UNIQUE INDEX articulo_stock_variante_idx ON articulo_stock (articulo_id, variante_id, sucursal_id) WHERE variante_id IS NOT NULL;
```

---

*Última actualización: 2026-06-09*
