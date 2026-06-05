# notas-credito.md — Notas de Crédito y Cobranzas

Adjuntá este archivo para trabajar en notas de crédito o cuenta corriente de clientes.

---

## Archivos del módulo

| Archivo | Descripción |
|---------|-------------|
| `app/(dashboard)/dashboard/notas-credito/page.tsx` | Lista de notas de crédito |
| `app/(dashboard)/dashboard/notas-credito/nueva/page.tsx` | Crear nota de crédito |
| `app/(dashboard)/dashboard/notas-credito/[id]/page.tsx` | Detalle |
| `app/api/dashboard/notas-credito/route.ts` | GET + POST |
| `app/api/dashboard/notas-credito/[id]/route.ts` | GET + PUT + DELETE |
| `app/api/dashboard/notas-credito/[id]/anular/route.ts` | POST anular |
| `types/notas-credito.ts` | Tipos TypeScript |

---

## Nota de Crédito

Crédito emitido a un cliente. Se puede usar como medio de pago en ventas y órdenes.

### Campos clave
- `monto`: valor original (inmutable)
- `monto_disponible`: saldo restante (decrece al usarse, aumenta al anular la transacción)
- `estado`: `'pendiente'` → `'utilizada'` | `'anulada'`

### Estados
```
pendiente ──► utilizada   (cuando monto_disponible llega a 0)
pendiente ──► anulada     (anulación manual)
utilizada ──► pendiente   (si se anula la venta/orden que la usó → saldo restaurado)
```

---

## Usar NC como medio de pago

Al incluir un pago con `metodo: 'NOTA_CREDITO'`:
1. Se debe pasar `nota_credito_id` en el objeto de pago
2. **Nunca enviar `nota_credito_id: null`** — causa error en PostgREST schema cache. Usar spread condicional:
   ```typescript
   ...(p.nota_credito_id != null ? { nota_credito_id: p.nota_credito_id } : {})
   ```
3. Al confirmar: `monto_disponible -= monto_pago`; si llega a 0, `estado = 'utilizada'`
4. Al anular la venta/orden: `monto_disponible = min(monto_original, monto_disponible + monto_pago)`; `estado = 'pendiente'`

---

## Cobranzas (cuenta corriente)

La tabla `cobranzas` registra cargos y pagos de la cuenta corriente de un cliente.

### Generación automática
| Evento | Tipo | Descripción |
|--------|------|-------------|
| Venta con CUENTA_CORRIENTE | CARGO | "Venta {numero}" o descriptor de orden |
| Orden confirmada con CUENTA_CORRIENTE | CARGO | "Orden de venta {numero}" |
| Anulación de venta con CC | PAGO | "Anulación venta {numero}" |
| Anulación de orden con CC | PAGO | "Anulación orden {numero}" |

### Saldo del cliente
```sql
SELECT saldo_cliente(p_cliente_id)
-- Positivo = cliente debe
-- Negativo = negocio debe al cliente (saldo a favor)
```

---

## Tipos clave (`types/notas-credito.ts`)

```typescript
type EstadoNotaCredito = 'pendiente' | 'utilizada' | 'anulada'

type NotaCredito = {
  id: number
  numero: string
  cliente_id: number
  fecha: string
  monto: number           // Original — inmutable
  monto_disponible: number  // Saldo restante
  estado: EstadoNotaCredito
  observaciones: string | null
  created_by: string
  created_at: string
  updated_at: string
}
```

---

*Última actualización: 2026-05-28*
