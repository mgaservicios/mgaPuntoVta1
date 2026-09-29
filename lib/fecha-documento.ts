const FECHA_MINIMA_ANIO = 2000
const FECHA_MAXIMA_ANIO = 2100

export type ResultadoFecha =
  | { ok: true; valor: string }
  | { ok: false; error: string }

export function validarFechaDocumento(
  entrada: unknown,
  porDefecto: () => string,
): ResultadoFecha {
  if (entrada === undefined || entrada === null || entrada === '') {
    return { ok: true, valor: porDefecto() }
  }

  if (typeof entrada !== 'string') {
    return { ok: false, error: 'Fecha inválida' }
  }

  const valor = entrada.trim()
  const d = new Date(valor)

  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `Fecha inválida: "${valor}"` }
  }

  // `new Date` interpreta los años 0-99 tal cual, sin completar el siglo. Un
  // "0008-05-18" o un "0026-07-16" pasan el parseo pero no son fechas reales:
  // entran al historial y rompen el orden de los movimientos.
  const anio = d.getUTCFullYear()
  if (anio < FECHA_MINIMA_ANIO || anio > FECHA_MAXIMA_ANIO) {
    return {
      ok: false,
      error: `Fecha fuera de rango (${FECHA_MINIMA_ANIO}-${FECHA_MAXIMA_ANIO}): "${valor}"`,
    }
  }

  return { ok: true, valor }
}
