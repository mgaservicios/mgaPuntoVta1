# Plan: Manejo de Cierre de Cajas y Historial

**Fecha:** 2026-07-11
**Estado:** Pendiente de aprobacion
**Modulo:** Fondos / Caja

---

## 1. Problema Actual

| Situacion | Consecuencia |
|-----------|--------------|
| La caja no se cierra al final del dia | Queda abierta indefinidamente |
| No hay concepto de "dia" en la BD | No se puede agrupar movimientos por dia |
| El historial solo muestra cerradas | No se ven sesiones abiertas del dia anterior |
| No se pueden anular movimientos | Errores quedan registrados sin correccion |

---

## 2. Solucion Propuesta

### 2.1 Arrastre Automatico

Cuando una caja no se cierra y al dia siguiente hay una sesion abierta del dia anterior:

```
DIA 1:
  09:00 - Abre caja con $10.000
  18:00 - Tiene ventas por $50.000
  19:00 - Se olvida de cerrar -> caja queda abierta

DIA 2:
  09:00 - Entra al sistema
  -> Banner: "Caja abierta del dia 1 - Monto actual: $60.000"
  -> Opcion A: "Continuar caja"
     -> Se cierra sesion dia 1 ($60.000 cierre)
     -> Se abre sesion dia 2 ($60.000 apertura)
     -> Movimiento automatico: "Continuacion de caja anterior"
  -> Opcion B: "Cerrar y abrir nueva"
     -> Cerrar sesion dia 1 con monto contado
     -> Abrir sesion dia 2 con el monto cerrado
```

---

## 3. Cambios en Base de Datos

### 3.1 Campo `fecha` en `caja_sesiones`

```sql
ALTER TABLE caja_sesiones
  ADD COLUMN fecha date DEFAULT CURRENT_DATE;

-- Migrar datos existentes
UPDATE caja_sesiones
SET fecha = fecha_apertura::date
WHERE fecha IS NULL;

-- Hacer NOT NULL
ALTER TABLE caja_sesiones
  ALTER COLUMN fecha SET NOT NULL;
```

**Proposito:** Agrupar sesiones por dia calendario.

### 3.2 Campo `sesion_anterior_id`

```sql
ALTER TABLE caja_sesiones
  ADD COLUMN sesion_anterior_id bigint
  REFERENCES caja_sesiones(id);
```

**Proposito:** Encadenar sesiones cuando se arrastra saldo.

### 3.3 Tabla de auditoria `caja_movimientos_log`

```sql
CREATE TABLE caja_movimientos_log (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  movimiento_id     bigint NOT NULL,
  sesion_id         bigint NOT NULL,
  accion            text NOT NULL CHECK (accion IN ('anulacion')),
  tipo              text NOT NULL,
  tipo_concepto     text,
  concepto          text NOT NULL,
  monto             numeric(12,2) NOT NULL,
  usuario_original  uuid NOT NULL,
  motivo            text NOT NULL,
  usuario_anula     uuid NOT NULL REFERENCES users(id),
  created_at        timestamptz DEFAULT now()
);
```

**Proposito:** Registro de auditoria para anulaciones.

### 3.4 Permiso nuevo

```sql
INSERT INTO permisos (clave, nombre, modulo)
VALUES ('fondos.caja.anular', 'Anular movimientos de caja', 'fondos');
```

---

## 4. Cambios en API Routes

### 4.1 Modificar `POST /api/dashboard/caja/sesion` (abrir)

**Behavior actual:**
- Si hay sesion abierta -> error 409

**Behavior nuevo:**
- Si hay sesion abierta del dia anterior -> devolver info:
  ```json
  {
    "sesion_anterior": { "id": 123, "fecha": "2026-07-10", "monto_esperado": 60000 },
    "requiere_decision": true
  }
  ```
- Si hay sesion abierta de HOY -> behavior actual (error 409)

### 4.2 Crear `POST /api/dashboard/caja/sesion/[id]/continuar`

**Body:**
```json
{
  "accion": "continuar | cerrar_y_abrir",
  "monto_cierre": 60000,
  "observaciones": "string",
  "fecha_hora_cierre": "2026-07-11T09:00"
}
```

**Logica:**
1. Cerrar sesion anterior con `monto_cierre` y `monto_esperado`
2. Crear nueva sesion con `monto_apertura = monto_cierre`
3. Registrar `sesion_anterior_id` en la nueva sesion
4. Crear movimiento "Continuacion de caja anterior - $XX.XXX"

### 4.3 Crear `POST /api/dashboard/caja/sesion/[id]/anular-movimiento`

**Body:**
```json
{
  "movimiento_id": 456,
  "motivo": "Error en monto registrado"
}
```

**Validaciones:**
- Requiere permiso `fondos.caja.anular`
- Movimiento no puede ser tipo "Apertura"
- Movimiento no puede estar ya anulado

**Logica:**
1. Guardar movimiento original en `caja_movimientos_log`
2. Crear movimiento inverso (ingreso -> egreso o viceversa)
3. Registrar en log quien anulo y por que

### 4.4 Modificar `GET /api/dashboard/caja/historial`

**Parametros nuevos:**
```
filtro: 'abiertas' | 'cerradas' | 'todas' (default: 'cerradas')
fecha_especifica: YYYY-MM-DD (filtra por campo fecha de la sesion)
```

### 4.5 Crear `GET /api/dashboard/caja/dia/[fecha]`

Retorna todos los movimientos de un dia especifico:
```json
{
  "fecha": "2026-07-10",
  "sesiones": [
    {
      "id": 123,
      "estado": "cerrada",
      "monto_apertura": 10000,
      "monto_cierre": 60000
    }
  ],
  "movimientos": [],
  "totales": {
    "ingresos": 55000,
    "egresos": 5000,
    "saldo": 60000
  }
}
```

---

## 5. Cambios en Frontend

### 5.1 `fondos/page.tsx` - Deteccion de sesion anterior

```
Al cargar la pagina:
1. GET /caja/sesion
2. Si retorna sesion_anterior:
   +-------------------------------------------+
   | Caja abierta del dia anterior             |
   |                                           |
   | Fecha: 10/07/2026                         |
   | Monto actual: $60.000                     |
   |                                           |
   | [Continuar caja] [Cerrar y abrir nueva]   |
   +-------------------------------------------+
3. Si elige "Continuar":
   -> POST /caja/sesion/{id}/continuar
   -> Recargar pagina
4. Si elige "Cerrar y abrir nueva":
   -> Abrir CerrarCajaDialog
   -> Despues de cerrar, abrir AbrirCajaDialog
```

### 5.2 `historial/page.tsx` - Filtros mejorados

```
+-------------------------------------------------------+
| Filtros:                                              |
| [Desde: ___________] [Hasta: ___________]             |
| [Cerradas v] [Todas] [Abiertas]                      |
|                                                       |
| +---------------------------------------------------+ |
| | Cerrada - 10/07/2026                              | |
| | Sucursal: Centro | Diferencia: $500               | |
| | [Expandir]                                        | |
| +---------------------------------------------------+ |
|                                                       |
| +---------------------------------------------------+ |
| | Abierta - 11/07/2026                              | |
| | Sucursal: Centro | Monto actual: $60.000          | |
| | [Expandir]                                        | |
| +---------------------------------------------------+ |
+-------------------------------------------------------+
```

### 5.3 Anulacion de movimientos

En la vista expandida de una sesion, cada movimiento tiene un boton de anular:

```
+-------------------------------------------------------+
| Movimientos de la sesion                              |
|                                                       |
| Ingreso - Venta 123 - EFECTIVO         +$15.000      |
| Ingreso - Venta 124 - TRANSFERENCIA    +$8.000       |
| Egreso  - Retiro de caja               -$5.000  [X]  |
|                                                       |
| [X] = Solo visible con permiso fondos.caja.anular    |
+-------------------------------------------------------+

Al hacer clic en [X]:
+-------------------------------------------------------+
| Anular movimiento                                     |
|                                                       |
| Motivo: [____________________________]                |
|                                                       |
| [Cancelar] [Confirmar anulacion]                     |
+-------------------------------------------------------+
```

---

## 6. Tipos TypeScript

### 6.1 Actualizar `CajaSesion` en `types/ventas.ts`

```typescript
type CajaSesion = {
  // ... campos existentes
  fecha: string                    // date YYYY-MM-DD
  sesion_anterior_id: number | null
}
```

### 6.2 Nuevo tipo `CajaMovimientoLog`

```typescript
type CajaMovimientoLog = {
  id: number
  movimiento_id: number
  sesion_id: number
  accion: 'anulacion'
  tipo: TipoMovCaja
  tipo_concepto: string | null
  concepto: string
  monto: number
  usuario_original: string
  motivo: string
  usuario_anula: string
  created_at: string
}
```

---

## 7. Resumen de Archivos a Modificar/Crear

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `supabase/migrations/YYYYMMDD_caja_cierre_historial.sql` | **Crear** | Migracion BD |
| `types/ventas.ts` | Modificar | Agregar campos a `CajaSesion`, nuevo tipo `CajaMovimientoLog` |
| `app/api/dashboard/caja/sesion/route.ts` | Modificar | Logica de sesion anterior |
| `app/api/dashboard/caja/sesion/[id]/continuar/route.ts` | **Crear** | Endpoint continuar/cerrar |
| `app/api/dashboard/caja/sesion/[id]/anular-movimiento/route.ts` | **Crear** | Endpoint anular |
| `app/api/dashboard/caja/historial/route.ts` | Modificar | Filtros nuevos |
| `app/api/dashboard/caja/dia/[fecha]/route.ts` | **Crear** | Movimientos del dia |
| `app/(dashboard)/dashboard/fondos/page.tsx` | Modificar | Banner sesion anterior |
| `app/(dashboard)/dashboard/fondos/historial/page.tsx` | Modificar | Tabs, filtros, anulacion |

---

## 8. Permisos

| Permiso | Descripcion | Quien lo tiene |
|---------|-------------|----------------|
| `fondos.caja.ver` | Ver caja | Todos los que ven fondos |
| `fondos.caja.abrir` | Abrir caja | Supervisores, Admin |
| `fondos.caja.cerrar` | Cerrar caja | Supervisores, Admin |
| `fondos.caja.movimiento` | Crear movimientos manuales | Supervisores, Admin |
| `fondos.caja.anular` | Anular movimientos anteriores | **Solo Admin** |

---

## 9. Validacion

- [ ] Abrir caja con sesion anterior del dia -> mostrar banner
- [ ] Continuar caja -> saldo se arrastra correctamente
- [ ] Cerrar y abrir nueva -> ambos procesos se completan
- [ ] Anular movimiento -> se registra en log, se crea inverso
- [ ] Historial muestra abiertas y cerradas
- [ ] Filtro por dia especifico funciona
- [ ] No se puede anular movimiento de Apertura
- [ ] Solo admin puede anular movimientos

---

## 10. Preguntas Pendientes

1. La vista de "Movimientos del dia" como pagina separada o integrada en historial?
2. Notificacion cuando alguien anula un movimiento? (toast, email, log)
3. Quien puede ver el log de anulaciones? (admin, o tambien supervisores)

---

*Ultima actualizacion: 2026-07-11*
