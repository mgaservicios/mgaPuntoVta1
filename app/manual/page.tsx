'use client'

import { useState } from 'react'
import { Printer, X } from 'lucide-react'

export default function ManualPage() {
  const [darkBar, setDarkBar] = useState(true)

  return (
    <>
      {/* Barra de acción — solo visible en pantalla */}
      {darkBar && (
        <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-gray-900 text-white shadow-lg">
          <span className="text-sm font-medium">MgaPOS — Manual de Usuario</span>
          <div className="flex gap-2">
            <button
              onClick={() => setDarkBar(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
              Cerrar barra
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-500 transition-colors font-medium"
            >
              <Printer className="w-4 h-4" />
              Guardar PDF / Imprimir
            </button>
          </div>
        </div>
      )}

      {/* Documento */}
      <div className={`${darkBar ? 'print:pt-0 pt-16' : ''} bg-white min-h-screen`}>
        <div className="max-w-[210mm] mx-auto px-10 py-8 print:px-8 print:py-6 text-gray-900 text-[13px] leading-relaxed font-sans">

          {/* ══ TÍTULO ══ */}
          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <h1 className="text-2xl font-bold tracking-tight">MgaPOS · Manual de usuario</h1>
            <p className="text-gray-500 text-xs mt-1">Guía rápida de operaciones por módulo</p>
          </div>

          {/* ══ MÓDULOS ══ */}
          <div className="space-y-5">

            {/* ── CAJA ── */}
            <Section title="Caja" color="blue">
              <Row label="Abrir sesión">
                Hacer clic en <b>Abrir caja</b>, ingresar monto inicial y (opcionalmente) vendedor.
                Solo puede haber una sesión abierta por sucursal a la vez.
              </Row>
              <Row label="Movimientos">
                Con la caja abierta, usar <b>+ Movimiento</b> para registrar ingresos o egresos con concepto y monto.
              </Row>
              <Row label="Cerrar caja">
                Ingresar el monto físico contado. El sistema calcula la diferencia vs. el esperado.
                El cierre es definitivo; no se puede reabrir.
              </Row>
              <Row label="Historial">
                En <b>Historial</b> se ven todas las sesiones cerradas con sus totales y movimientos.
              </Row>
            </Section>

            {/* ── POS ── */}
            <Section title="Ticket de Venta (POS)" color="green">
              <Row label="Requisito">
                Debe haber una <b>caja abierta</b> antes de cobrar. Si no hay sesión activa, el sistema lo avisa.
              </Row>
              <Row label="Agregar artículos">
                Buscar por nombre o código en el campo de búsqueda. Ajustar cantidad con los botones <b>+/−</b>.
              </Row>
              <Row label="Cliente / Vendedor">
                Campos opcionales. El cliente permite acumular cuenta corriente. El vendedor queda registrado en el comprobante.
              </Row>
              <Row label="Cobrar">
                Seleccionar método de pago (efectivo, tarjeta, transferencia, cuenta corriente, nota de crédito).
                Se pueden combinar métodos. Confirmar con <b>Cobrar</b>.
              </Row>
              <Row label="No permitido">
                No se puede modificar una venta ya cobrada. Ante error, usar una <b>Nota de crédito</b>.
              </Row>
            </Section>

            {/* ── ÓRDENES DE VENTA ── */}
            <Section title="Órdenes de Venta" color="purple">
              <Row label="Crear">
                Nueva orden: seleccionar cliente, agregar artículos, condición de pago y vendedor.
              </Row>
              <Row label="Estados">
                <b>Borrador</b> → <b>Confirmada</b> → <b>Anulada</b>.
                Solo en estado Confirmada se pueden registrar pagos.
                Una orden anulada no admite más cambios.
              </Row>
              <Row label="Pagos">
                En la orden confirmada, botón <b>+ Pago</b>. Se puede pagar en cuotas o en partes.
              </Row>
              <Row label="Imprimir">
                Botón <b>Imprimir</b> en la cabecera. Se genera comprobante A4 o ticket.
              </Row>
            </Section>

            {/* ── NOTAS DE CRÉDITO ── */}
            <Section title="Notas de Crédito" color="orange">
              <Row label="Crear">
                Ingresar cliente, monto, fecha y concepto. Campo vendedor opcional.
              </Row>
              <Row label="Uso">
                Al registrar un pago en una Orden de Venta, seleccionar método <b>Nota de crédito</b> y elegir la nota disponible del cliente.
              </Row>
            </Section>

            {/* ── CLIENTES ── */}
            <Section title="Clientes" color="teal">
              <Row label="Alta">
                Nombre (obligatorio), teléfono, CUIT, dirección, tipo de cuenta.
              </Row>
              <Row label="Cuenta corriente">
                Si el cliente tiene tipo CC, el saldo se acumula con compras y se cancela con pagos.
                Desde el perfil del cliente se ve el historial de movimientos.
              </Row>
              <Row label="Editar / Eliminar">
                Se puede editar siempre. Eliminar solo si no tiene transacciones asociadas.
              </Row>
            </Section>

            {/* ── INVENTARIO ── */}
            <Section title="Inventario — Artículos" color="slate">
              <Row label="Crear artículo">
                Nombre, categoría, marca, precio de venta y costo. Opcionalmente variantes (talle, color, etc.).
              </Row>
              <Row label="Stock">
                Se actualiza automáticamente con cada venta (POS/OV) y con los remitos de entrada.
              </Row>
              <Row label="Listas de precio">
                Si hay varias listas configuradas, cada artículo puede tener precio diferente por lista.
              </Row>
            </Section>

            <Section title="Inventario — Remitos" color="slate">
              <Row label="Tipos">
                <b>Entrada</b> (compra a proveedor), <b>Salida</b> (egreso manual), <b>Traslado</b> (entre sucursales), <b>Ajuste</b> (corrección de stock).
              </Row>
              <Row label="Crear">
                Seleccionar tipo, proveedor o destino, fecha, artículos y cantidades. Agregar vendedor si corresponde.
              </Row>
              <Row label="Confirmar">
                Al guardar, el remito afecta el stock en forma inmediata. <b>No se puede deshacer</b>.
              </Row>
            </Section>

            {/* ── ÓPTICA OT ── */}
            <Section title="Óptica — Órdenes de Trabajo (OT)" color="indigo">
              <Row label="Crear">
                Cliente, médico (opcional), receta con medidas (esfera, cilindro, eje, adición, DP para lejos y cerca),
                artículos (armazón, cristales, tratamientos), vendedor.
              </Row>
              <Row label="Estados">
                <b>Pendiente</b> → <b>En proceso</b> → <b>En laboratorio</b> → <b>Terminado</b> → <b>Entregado</b> · <b>Anulado</b>.
                Usar el botón de estado en la cabecera de la OT.
              </Row>
              <Row label="Tareas">
                Se pueden agregar tareas internas o de laboratorio con fecha límite y responsable.
              </Row>
              <Row label="Pagos / Señas">
                Registrar anticipos y pagos parciales desde la pestaña <b>Pagos</b>. El saldo pendiente se muestra en el comprobante impreso.
              </Row>
              <Row label="Imprimir">
                Comprobante A4 con receta, artículos y estado de pago. Incluye código de barras.
              </Row>
            </Section>

            {/* ── ÓPTICA SV ── */}
            <Section title="Óptica — Servicios (Reparaciones)" color="rose">
              <Row label="Crear">
                Cliente, detalle del trabajo, tipos de reparación (soldadura, patillas, cristales, etc.) con precio individual.
                Fecha prometida de entrega opcional.
              </Row>
              <Row label="Estados">
                <b>Pendiente</b> → <b>En proceso</b> → <b>Terminado</b> → <b>Entregado</b> · <b>Anulado</b>.
              </Row>
              <Row label="Pagos">
                Igual que OT: señas y pagos parciales o totales.
              </Row>
            </Section>

            {/* ── CONSULTAS ── */}
            <Section title="Consultas y Listados" color="gray">
              <Row label="Stock y precios">
                Vista actual de inventario con stock disponible y precio de venta por artículo.
              </Row>
              <Row label="Seguimiento">
                Historial de transacciones por cliente (ventas, OTs, SVs, pagos).
              </Row>
              <Row label="Cobranzas">
                Listado de pagos recibidos filtrable por período y sucursal.
              </Row>
              <Row label="Lista de precios">
                Exportación del catálogo de artículos con precios. Imprimible.
              </Row>
            </Section>

            {/* ── ADMIN ── */}
            <Section title="Administración (solo administradores)" color="red">
              <Row label="Sucursales">
                Alta y configuración de cada punto de venta (nombre, logo, color).
              </Row>
              <Row label="Usuarios">
                Crear cuentas: asignar rol, sucursal de inicio y sucursales habilitadas.
              </Row>
              <Row label="Roles y permisos">
                Definir qué acciones puede realizar cada rol (ver, crear, editar, eliminar por módulo).
              </Row>
              <Row label="Vendedores">
                Lista de vendedores por sucursal. Se asocian a las transacciones para reportes de comisiones.
              </Row>
              <Row label="Listas de precio">
                Configurar nombres de listas para usarlas en artículos y clientes.
              </Row>
            </Section>

          </div>

          {/* ══ PIE ══ */}
          <div className="border-t border-gray-200 mt-8 pt-4 text-center text-[10px] text-gray-400">
            MgaPOS · Manual de usuario · MGA Informática
          </div>

        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}

// ── Componentes helper ────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  blue:   'border-blue-500 bg-blue-50',
  green:  'border-green-500 bg-green-50',
  purple: 'border-purple-500 bg-purple-50',
  orange: 'border-orange-400 bg-orange-50',
  teal:   'border-teal-500 bg-teal-50',
  slate:  'border-slate-400 bg-slate-50',
  indigo: 'border-indigo-500 bg-indigo-50',
  rose:   'border-rose-500 bg-rose-50',
  gray:   'border-gray-400 bg-gray-50',
  red:    'border-red-500 bg-red-50',
}

const TITLE_COLOR_MAP: Record<string, string> = {
  blue:   'text-blue-700',
  green:  'text-green-700',
  purple: 'text-purple-700',
  orange: 'text-orange-700',
  teal:   'text-teal-700',
  slate:  'text-slate-700',
  indigo: 'text-indigo-700',
  rose:   'text-rose-700',
  gray:   'text-gray-700',
  red:    'text-red-700',
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className={`border-l-4 rounded-r-lg pl-4 pr-3 py-3 ${COLOR_MAP[color] ?? COLOR_MAP.gray}`}>
      <h2 className={`font-bold text-sm mb-2 ${TITLE_COLOR_MAP[color] ?? ''}`}>{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-[12px]">
      <span className="shrink-0 w-36 font-semibold text-gray-600 leading-snug">{label}</span>
      <span className="text-gray-700 leading-snug">{children}</span>
    </div>
  )
}
